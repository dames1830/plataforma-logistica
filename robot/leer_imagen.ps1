# =============================================================================
#  LEE EL TEXTO DE UNA IMAGEN CON EL OCR QUE YA TRAE WINDOWS
# =============================================================================
#
#  Daniel, 03-sep-2026: *"no envie Excel, solo envie una imagen nada mas.
#  Entonces, con eso tenemos que lidiar"*. El correo de citas de recepcion trae la
#  tabla pegada como captura de pantalla: no hay una sola letra que leer.
#
#  POR QUE EL OCR DE WINDOWS Y NO TESSERACT
#      Windows Server 2025 lo trae de fabrica -comprobado en el servidor: build
#      26100, `Windows.Media.Ocr`, idioma en-US-. Instalar Tesseract en el
#      servidor de produccion por una tabla de ocho filas no se justifica.
#
#  DEVUELVE CADA PALABRA CON SU POSICION, no un texto corrido. Sin coordenadas no
#  se puede rearmar una tabla: "08:20 D FASTER 2026-09057 134" es una sola linea y
#  no se sabe donde termina una columna. Con x e y, las filas se agrupan por
#  altura y las columnas por posicion horizontal.
#
#  LA IMAGEN SE AGRANDA Y SE PASA A BLANCO Y NEGRO ANTES DE LEERLA
#      Medido sobre la captura real del 04-sep-2026 (884x274) leida al 3x y en
#      color, el motor devolvio "2026-20570" donde dice 2026-10570 -un 1 leido
#      como 2- y se comio cuatro cantidades, el total entre ellas. Con esos
#      numeros el cruce con el ASN apunta a una orden que no existe.
#
#      La tabla llega con fondos de color -encabezado azul, filas naranja,
#      amarilla y verde- y letra chica. Agrandarla y dejarla negro sobre blanco es
#      lo que le falta al motor para no dudar en los digitos.
#
#  SE USA GDI+ Y NO EL BUFFER DE WinRT. `SoftwareBitmap.CopyFromBuffer` no acepta
#  el buffer que PowerShell le arma -llega como System.__ComObject y no lo sabe
#  convertir-. Con System.Drawing ademas queda una copia limpia en disco, que es
#  lo que se puede mirar cuando un numero no cuadra.
#
#  USO
#      powershell -ExecutionPolicy Bypass -File leer_imagen.ps1 -Ruta foto.png
#      powershell ... -Ruta foto.png -Escala 6 -Guardar limpia.png
#      powershell ... -Ruta foto.png -SinLimpiar        (como vino, para comparar)
#
#  Escribe JSON por la salida estandar: { ancho, alto, escala, palabras: [...] }
# =============================================================================
param(
    [Parameter(Mandatory = $true)][string] $Ruta,
    [int] $Escala = 5,
    [int] $Umbral = 150,
    [string] $Guardar = '',
    [switch] $SinLimpiar
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Ruta)) {
    Write-Output (@{ error = "no existe el archivo $Ruta" } | ConvertTo-Json -Compress)
    exit 1
}

Add-Type -AssemblyName System.Drawing | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

# WinRT devuelve IAsyncOperation y PowerShell no sabe esperarlo solo. Este es el
# puente estandar: se convierte a Task de .NET y se espera ahi.
$asTaskGenerico = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Esperar($operacion, $tipo) {
    $asTask = $asTaskGenerico.MakeGenericMethod($tipo)
    $tarea = $asTask.Invoke($null, @($operacion))
    $tarea.Wait(-1) | Out-Null
    $tarea.Result
}

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$temporal = ''
try {
    $completa = (Resolve-Path -LiteralPath $Ruta).Path
    $orig = [System.Drawing.Bitmap]::FromFile($completa)
    $ancho = $orig.Width
    $alto  = $orig.Height

    # El motor acepta imagenes grandes; una captura de correo ronda los 900 de
    # ancho, asi que al quintuple sigue holgada. El tope es por prudencia.
    $esc = $Escala
    while ($esc -gt 1 -and ((($ancho * $esc) -gt 9000) -or (($alto * $esc) -gt 9000))) { $esc = $esc - 1 }

    $grande = New-Object System.Drawing.Bitmap ([int]($ancho * $esc)), ([int]($alto * $esc))
    $g = [System.Drawing.Graphics]::FromImage($grande)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($orig, 0, 0, $grande.Width, $grande.Height)
    $g.Dispose()
    $orig.Dispose()

    if (-not $SinLimpiar) {
        # LockBits y un solo recorrido del arreglo. GetPixel pixel a pixel sobre
        # seis millones de puntos tarda minutos; asi tarda menos de un segundo.
        $rect = New-Object System.Drawing.Rectangle 0, 0, $grande.Width, $grande.Height
        $datos = $grande.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
                                  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $n = [Math]::Abs($datos.Stride) * $grande.Height
        $bytes = New-Object byte[] $n
        [System.Runtime.InteropServices.Marshal]::Copy($datos.Scan0, $bytes, 0, $n)
        for ($i = 0; $i -lt $n; $i += 4) {
            # Gris por luminancia. El encabezado es azul oscuro con letra BLANCA:
            # ahi el umbral lo deja en blanco sobre blanco y esa fila se pierde,
            # pero el encabezado no aporta datos -las columnas se reconocen por
            # posicion- y las filas de datos son letra oscura sobre color claro.
            $gr = (0.114 * $bytes[$i]) + (0.587 * $bytes[$i + 1]) + (0.299 * $bytes[$i + 2])
            $v = [byte]255
            if ($gr -lt $Umbral) { $v = [byte]0 }
            $bytes[$i] = $v; $bytes[$i + 1] = $v; $bytes[$i + 2] = $v; $bytes[$i + 3] = [byte]255
        }
        [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $datos.Scan0, $n)
        $grande.UnlockBits($datos)
    }

    $temporal = if ($Guardar) { $Guardar } else { [System.IO.Path]::Combine($env:TEMP, 'ocr_' + [guid]::NewGuid().ToString('N') + '.png') }
    $grande.Save($temporal, [System.Drawing.Imaging.ImageFormat]::Png)
    $grande.Dispose()

    $archivo = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync($temporal)) ([Windows.Storage.StorageFile])
    $flujo   = Esperar ($archivo.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec     = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($flujo)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp     = Esperar ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

    # En el servidor solo esta en-US. Se pide explicito y, si no, lo del perfil:
    # pedir un idioma que no esta instalado devuelve $null sin avisar.
    $motor = $null
    try { $motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language 'en-US')) } catch { }
    if (-not $motor) { $motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
    if (-not $motor) { throw 'no hay ningun motor de OCR disponible en esta maquina' }

    $res = Esperar ($motor.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])

    $palabras = New-Object System.Collections.ArrayList
    foreach ($linea in $res.Lines) {
        foreach ($p in $linea.Words) {
            $r = $p.BoundingRect
            $null = $palabras.Add([ordered]@{
                t = $p.Text
                x = [int]$r.X
                y = [int]$r.Y
                w = [int]$r.Width
                h = [int]$r.Height
            })
        }
    }

    $flujo.Dispose()
    Write-Output ([ordered]@{
        ancho    = $ancho
        alto     = $alto
        escala   = $esc
        limpiada = (-not $SinLimpiar.IsPresent)
        lineas   = @($res.Lines).Count
        palabras = $palabras
    } | ConvertTo-Json -Depth 4 -Compress)
} catch {
    Write-Output (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress)
    exit 1
} finally {
    if ($temporal -and (-not $Guardar) -and (Test-Path -LiteralPath $temporal)) {
        try { [System.IO.File]::Delete($temporal) } catch { }
    }
}
