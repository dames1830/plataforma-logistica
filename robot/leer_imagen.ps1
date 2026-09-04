# =============================================================================
#  LEE EL TEXTO DE UNA IMAGEN CON EL OCR QUE YA TRAE WINDOWS
# =============================================================================
#
#  Daniel, 03-sep-2026: *"no envie Excel, solo envie una imagen nada mas.
#  Entonces, con eso tenemos que lidiar"*. El correo de citas de recepcion trae
#  la tabla pegada como captura de pantalla: no hay una sola letra que leer.
#
#  POR QUE EL OCR DE WINDOWS Y NO TESSERACT
#      Windows Server 2025 trae `Windows.Media.Ocr` de fabrica -comprobado en el
#      servidor: build 26100, idioma en-US-. Tesseract habria que instalarlo, y
#      instalar software nuevo en el servidor de produccion por una tabla de ocho
#      filas no se justifica.
#
#  DEVUELVE CADA PALABRA CON SU POSICION, no un texto corrido. Sin las
#  coordenadas no se puede rearmar una tabla: "08:00 CALZADOS PERU 2026-09057
#  1,138" es una sola linea de texto y no se sabe donde termina una columna y
#  empieza la otra. Con x, y, ancho y alto, las filas se agrupan por altura y las
#  columnas por posicion horizontal.
#
#  SE AGRANDA LA IMAGEN ANTES DE LEERLA. El texto de una captura de Outlook es
#  chico y el OCR se equivoca mas en los digitos, que es justo lo que importa.
#  Con la imagen al triple, los numeros salen limpios.
#
#  USO
#      powershell -ExecutionPolicy Bypass -File leer_imagen.ps1 -Ruta foto.png
#      powershell ... -Ruta foto.png -Escala 4
#
#  Escribe JSON por la salida estandar: { ancho, alto, escala, palabras: [...] }
# =============================================================================
param(
    [Parameter(Mandatory = $true)][string] $Ruta,
    [int] $Escala = 3
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Ruta)) {
    Write-Output (@{ error = "no existe el archivo $Ruta" } | ConvertTo-Json -Compress)
    exit 1
}

# WinRT devuelve IAsyncOperation y PowerShell no sabe esperarlo solo. Este es el
# puente estandar: se convierte a Task de .NET y se espera ahi.
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
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

try {
    $completa = (Resolve-Path -LiteralPath $Ruta).Path
    $archivo = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync($completa)) ([Windows.Storage.StorageFile])
    $flujo   = Esperar ($archivo.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec     = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($flujo)) ([Windows.Graphics.Imaging.BitmapDecoder])

    $ancho = [int]$dec.PixelWidth
    $alto  = [int]$dec.PixelHeight

    # AL TRIPLE, pero sin pasarse del tope del motor (el OCR rechaza imagenes
    # enormes). 4000 px de lado es de sobra para una tabla de correo.
    $esc = $Escala
    while ($esc -gt 1 -and (($ancho * $esc) -gt 4000 -or ($alto * $esc) -gt 4000)) { $esc = $esc - 1 }

    $tr = New-Object Windows.Graphics.Imaging.BitmapTransform
    $tr.ScaledWidth  = [uint32]($ancho * $esc)
    $tr.ScaledHeight = [uint32]($alto * $esc)
    $tr.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant

    $bmp = Esperar ($dec.GetSoftwareBitmapAsync(
                        [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
                        [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied,
                        $tr,
                        [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,
                        [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)
                   ) ([Windows.Graphics.Imaging.SoftwareBitmap])

    # En el servidor solo esta en-US. Se pide explicito y, si no, lo que haya en el
    # perfil: pedir un idioma que no esta instalado devuelve $null sin avisar.
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

    $salida = [ordered]@{
        ancho    = $ancho
        alto     = $alto
        escala   = $esc
        lineas   = $res.Lines.Count
        palabras = $palabras
    }
    Write-Output ($salida | ConvertTo-Json -Depth 4 -Compress)
} catch {
    Write-Output (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress)
    exit 1
}
