# =============================================================================
#  LEE UNA TABLA QUE LLEGO COMO IMAGEN, CON EL OCR QUE YA TRAE WINDOWS
# =============================================================================
#
#  Daniel, 03-sep-2026: *"no envie Excel, solo envie una imagen nada mas.
#  Entonces, con eso tenemos que lidiar"*. El correo de citas de recepcion trae la
#  tabla pegada como captura de pantalla.
#
#  POR QUE EL OCR DE WINDOWS Y NO TESSERACT
#      Windows Server 2025 lo trae de fabrica -comprobado en el servidor: build
#      26100, `Windows.Media.Ocr`, idioma en-US-. Instalar Tesseract en el servidor
#      de produccion por una tabla de ocho filas no se justifica.
#
#  DOS MODOS
#      normal      lee la imagen entera y devuelve palabras con su posicion
#      -PorCeldas  encuentra la grilla y lee CADA CELDA por separado
#
#  POR QUE HIZO FALTA EL MODO POR CELDAS. Leyendo la tabla entera, medido contra
#  los 20 valores que tienen que salir bien de la captura real del 04-sep, el motor
#  saca 14: se marea en una tabla ancha con columnas vacias y se come el 560, el
#  840 y el total 4011. Celda por celda, cada lectura es UN valor solo.
#
#  LA IMAGEN SE AGRANDA Y SE PASA A BLANCO Y NEGRO. Sin eso el motor devolvia
#  "2026-20570" donde dice 2026-10570 -un 1 leido como 2-, y con esa orden de
#  compra el cruce contra el ASN apunta a algo que no existe.
#
#  LA GRILLA SE BUSCA EN LA IMAGEN CHICA, no en la agrandada. Al quintuple son seis
#  millones de pixeles y recorrerlos en PowerShell tarda mas de un minuto; en la
#  original son 240 mil y tarda un segundo. Las coordenadas se multiplican despues.
#
#  SE USA GDI+ Y NO EL BUFFER DE WinRT: `SoftwareBitmap.CopyFromBuffer` no acepta
#  el buffer que arma PowerShell -llega como System.__ComObject-.
#
#  ESTE SCRIPT NECESITA WINDOWS POWERSHELL 5.1, NO pwsh 7. El puente a WinRT
#  -System.WindowsRuntimeSystemExtensions- no existe en .NET Core y falla con
#  "Operation is not supported on this platform".
#
#  USO
#      powershell -ExecutionPolicy Bypass -File leer_imagen.ps1 -Ruta foto.png
#      powershell ... -Ruta foto.png -PorCeldas
#      powershell ... -Ruta foto.png -Guardar limpia.png      (deja la limpia)
# =============================================================================
param(
    [Parameter(Mandatory = $true)][string] $Ruta,
    [int] $Escala = 5,
    [int] $Umbral = 150,
    [string] $Guardar = '',
    [switch] $SinLimpiar,
    [switch] $PorCeldas,
    # Cuanto de una linea de pixeles tiene que estar en negro para ser una raya de
    # la grilla. 0.6 aguanta que la raya venga cortada por el texto de al lado.
    [double] $Raya = 0.6,
    # Aire blanco alrededor de cada recorte: el motor pierde los caracteres pegados
    # al borde y con margen los recupera.
    [int] $Margen = 24
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Ruta)) {
    Write-Output (@{ error = "no existe el archivo $Ruta" } | ConvertTo-Json -Compress)
    exit 1
}

Add-Type -AssemblyName System.Drawing | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

# WinRT devuelve IAsyncOperation y PowerShell no sabe esperarlo solo: se convierte
# a Task de .NET y se espera ahi.
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

$script:Motor = $null
function ObtenerMotor {
    if ($script:Motor) { return $script:Motor }
    # En el servidor solo esta en-US. Se pide explicito y, si no, lo del perfil:
    # pedir un idioma que no esta instalado devuelve $null SIN AVISAR.
    try { $script:Motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language 'en-US')) } catch { }
    if (-not $script:Motor) { $script:Motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
    if (-not $script:Motor) { throw 'no hay ningun motor de OCR disponible en esta maquina' }
    return $script:Motor
}

# Lee un Bitmap de GDI+ y devuelve el objeto OcrResult. Pasa por un PNG temporal
# porque es el unico camino que PowerShell puede recorrer entre GDI+ y WinRT.
function LeerBitmap($bmpGdi) {
    $tmp = [System.IO.Path]::Combine($env:TEMP, 'ocr_' + [guid]::NewGuid().ToString('N') + '.png')
    try {
        $bmpGdi.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
        $arch  = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
        $flujo = Esperar ($arch.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $dec   = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($flujo)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $sb    = Esperar ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $res   = Esperar ((ObtenerMotor).RecognizeAsync($sb)) ([Windows.Media.Ocr.OcrResult])
        $flujo.Dispose()
        return $res
    } finally {
        if (Test-Path -LiteralPath $tmp) { try { [System.IO.File]::Delete($tmp) } catch { } }
    }
}

# Los tramos de indices seguidos que superan el corte, devueltos como su centro.
# Una raya de la grilla ocupa varios pixeles de ancho y sin agrupar saldrian tres
# columnas donde hay una.
# Cuantos pixeles negros tiene cada fila, mirando SOLO entre dos columnas. Es lo
# que hace falta para encontrar las lineas de una celda combinada: las de la fila
# de D FASTER cruzan la columna O/C y no el resto de la tabla.
function ContarFilas($xa, $xb, $alto) {
    $c = New-Object int[] $alto
    for ($y = 0; $y -lt $alto; $y++) {
        $linea = $script:Negro[$y]
        $n = 0
        for ($x = $xa; $x -lt $xb; $x++) { if ($linea[$x]) { $n++ } }
        $c[$y] = $n
    }
    return $c
}


# Los bordes de la imagen cuentan como rayas: en la captura real el borde
# izquierdo no se dibuja y sin el toda la tabla sale corrida una columna.
function ConBordes($rayas, $largo) {
    $out = New-Object System.Collections.ArrayList
    if ($rayas.Count -eq 0 -or $rayas[0] -gt 4) { $null = $out.Add(0) }
    foreach ($r in $rayas) { $null = $out.Add($r) }
    if ($rayas.Count -eq 0 -or $rayas[$rayas.Count - 1] -lt ($largo - 5)) { $null = $out.Add($largo - 1) }
    return $out
}


function Rayas($cuentas, $largo, $corte, $gruesa = 4) {
    $salida = New-Object System.Collections.ArrayList
    $ini = -1
    for ($i = 0; $i -le $cuentas.Length; $i++) {
        $esRaya = ($i -lt $cuentas.Length) -and ($cuentas[$i] -ge ($largo * $corte))
        if ($esRaya -and $ini -lt 0) { $ini = $i }
        elseif (-not $esRaya -and $ini -ge 0) {
            $fin = $i - 1
            if (($fin - $ini) -gt $gruesa) {
                # BANDA, no raya: el encabezado azul queda todo negro y mide diez
                # o mas pixeles. Devolver su centro dejaba la primera fila de datos
                # arrancando ADENTRO del encabezado, y ahi el motor no lee nada.
                $null = $salida.Add($ini)
                $null = $salida.Add($fin)
            } else {
                $null = $salida.Add([int](($ini + $fin) / 2))
            }
            $ini = -1
        }
    }
    return $salida
}

$temporal = ''
try {
    $completa = (Resolve-Path -LiteralPath $Ruta).Path
    $orig = [System.Drawing.Bitmap]::FromFile($completa)
    $ancho = $orig.Width
    $alto  = $orig.Height

    # ── LA GRILLA, SOBRE LA IMAGEN CHICA ────────────────────────────────────
    $porFila = New-Object int[] $alto
    $porCol  = New-Object int[] $ancho
    if ($PorCeldas) {
        $r0 = New-Object System.Drawing.Rectangle 0, 0, $ancho, $alto
        $d0 = $orig.LockBits($r0, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                             [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $st = $d0.Stride
        $n0 = [Math]::Abs($st) * $alto
        $b0 = New-Object byte[] $n0
        [System.Runtime.InteropServices.Marshal]::Copy($d0.Scan0, $b0, 0, $n0)
        $orig.UnlockBits($d0)
        # NEGRO O NO, UNA VEZ. Se guarda el mapa y despues se cuenta por franjas
        # sin volver a mirar pixeles: contar de nuevo por cada columna seria
        # recorrer 240.000 puntos once veces.
        $script:Negro = New-Object 'bool[][]' $alto
        for ($y = 0; $y -lt $alto; $y++) {
            $fila = $y * $st
            $linea = New-Object bool[] $ancho
            for ($x = 0; $x -lt $ancho; $x++) {
                $i = $fila + ($x * 4)
                $gr = (0.114 * $b0[$i]) + (0.587 * $b0[$i + 1]) + (0.299 * $b0[$i + 2])
                if ($gr -lt $Umbral) { $linea[$x] = $true; $porFila[$y]++; $porCol[$x]++ }
            }
            $script:Negro[$y] = $linea
        }
    }

    # ── LA COPIA GRANDE Y LIMPIA, que es la que se recorta y se lee ─────────
    $esc = $Escala
    while ($esc -gt 1 -and ((($ancho * $esc) -gt 9000) -or (($alto * $esc) -gt 9000))) { $esc = $esc - 1 }

    $grande = New-Object System.Drawing.Bitmap ([int]($ancho * $esc)), ([int]($alto * $esc))
    $g = [System.Drawing.Graphics]::FromImage($grande)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($orig, 0, 0, $grande.Width, $grande.Height)
    $g.Dispose()
    $orig.Dispose()

    if (-not $SinLimpiar) {
        # LockBits y un solo recorrido. GetPixel sobre seis millones de puntos
        # tarda minutos; asi tarda menos de un segundo.
        $rect = New-Object System.Drawing.Rectangle 0, 0, $grande.Width, $grande.Height
        $datos = $grande.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
                                  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $n = [Math]::Abs($datos.Stride) * $grande.Height
        $bytes = New-Object byte[] $n
        [System.Runtime.InteropServices.Marshal]::Copy($datos.Scan0, $bytes, 0, $n)
        for ($i = 0; $i -lt $n; $i += 4) {
            $gr = (0.114 * $bytes[$i]) + (0.587 * $bytes[$i + 1]) + (0.299 * $bytes[$i + 2])
            $v = [byte]255
            if ($gr -lt $Umbral) { $v = [byte]0 }
            $bytes[$i] = $v; $bytes[$i + 1] = $v; $bytes[$i + 2] = $v; $bytes[$i + 3] = [byte]255
        }
        [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $datos.Scan0, $n)
        $grande.UnlockBits($datos)
    }
    if ($Guardar) { $grande.Save($Guardar, [System.Drawing.Imaging.ImageFormat]::Png) }

    if (-not $PorCeldas) {
        $res = LeerBitmap $grande
        $palabras = New-Object System.Collections.ArrayList
        foreach ($linea in $res.Lines) {
            foreach ($p in $linea.Words) {
                $r = $p.BoundingRect
                $null = $palabras.Add([ordered]@{ t = $p.Text; x = [int]$r.X; y = [int]$r.Y; w = [int]$r.Width; h = [int]$r.Height })
            }
        }
        $grande.Dispose()
        Write-Output ([ordered]@{ ancho = $ancho; alto = $alto; escala = $esc
                                  lineas = @($res.Lines).Count; palabras = $palabras } | ConvertTo-Json -Depth 4 -Compress)
        exit 0
    }

    # ── LAS RAYAS ───────────────────────────────────────────────────────────
    $hor = ConBordes (Rayas $porFila $ancho $Raya) $alto
    $ver = ConBordes (Rayas $porCol  $alto  $Raya) $ancho
    if ($hor.Count -lt 2 -or $ver.Count -lt 2) {
        throw "no se encontro la grilla ($($hor.Count) rayas horizontales, $($ver.Count) verticales)"
    }

    # ── CADA COLUMNA, CON SUS PROPIAS FILAS ─────────────────────────────────
    $tablas = New-Object System.Collections.ArrayList
    $leidas = 0
    foreach ($bl in @(, @($hor[0], $hor[$hor.Count - 1]))) {
        $y0 = $bl[0]; $y1 = $bl[1]
        $columnas = New-Object System.Collections.ArrayList
        for ($c = 1; $c -lt $ver.Count; $c++) {
            $xa = $ver[$c - 1]; $xb = $ver[$c]
            if (($xb - $xa) -lt 8) { continue }

            # LAS FILAS DE ESTA COLUMNA, no las de la tabla. Donde la celda esta
            # combinada no hay rayas adentro y sale un solo trozo; donde no lo
            # esta, salen todos los renglones.
            $cuentas = ContarFilas ($xa + 2) ($xb - 1) $alto
            $propias = Rayas $cuentas ($xb - $xa - 3) $Raya
            $limites = New-Object System.Collections.ArrayList
            $null = $limites.Add($y0)
            foreach ($r in $propias) { if ($r -gt ($y0 + 4) -and $r -lt ($y1 - 4)) { $null = $limites.Add($r) } }
            $null = $limites.Add($y1)

            $trozos = New-Object System.Collections.ArrayList
            for ($f = 1; $f -lt $limites.Count; $f++) {
                $ya = $limites[$f - 1]; $yb = $limites[$f]
                if (($yb - $ya) -lt 7) { continue }
                $rc = New-Object System.Drawing.Rectangle ([int](($xa + 2) * $esc)), ([int](($ya + 2) * $esc)),
                                                          ([int](($xb - $xa - 4) * $esc)), ([int](($yb - $ya - 4) * $esc))
                if ($rc.Width -lt 10 -or $rc.Height -lt 10) { continue }
                $trozo = $grande.Clone($rc, $grande.PixelFormat)

                # ¿HAY ALGO ESCRITO? La mitad derecha de la tabla -Hora inicio, Hora
                # fin, Rampa, Cuadrilla- viene siempre en blanco. Preguntarlo antes
                # de llamar al motor evita mas de la mitad de las lecturas.
                #
                # DE A CUATRO PIXELES, no de a dieciseis: con el salto grande se
                # perdian celdas enteras. Al quintuple un trazo mide unos cinco
                # pixeles y el muestreo lo esquivaba.
                $rr = New-Object System.Drawing.Rectangle 0, 0, $trozo.Width, $trozo.Height
                $dd = $trozo.LockBits($rr, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                                      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
                $nn = [Math]::Abs($dd.Stride) * $trozo.Height
                $bb = New-Object byte[] $nn
                [System.Runtime.InteropServices.Marshal]::Copy($dd.Scan0, $bb, 0, $nn)
                $trozo.UnlockBits($dd)
                $hay = $false
                for ($k = 0; $k -lt $nn; $k += 16) { if ($bb[$k] -lt 128) { $hay = $true; break } }
                if (-not $hay) { $trozo.Dispose(); continue }

                $conAire = New-Object System.Drawing.Bitmap ($trozo.Width + 2 * $Margen), ($trozo.Height + 2 * $Margen)
                $gg = [System.Drawing.Graphics]::FromImage($conAire)
                $gg.Clear([System.Drawing.Color]::White)
                $gg.DrawImageUnscaled($trozo, $Margen, $Margen)
                $gg.Dispose()
                $trozo.Dispose()
                $texto = ((LeerBitmap $conAire).Text -replace '\s+', ' ').Trim()
                $conAire.Dispose()
                $leidas++
                if ($texto) { $null = $trozos.Add([ordered]@{ y0 = $ya; y1 = $yb; t = $texto }) }
            }
            $null = $columnas.Add([ordered]@{ x0 = $xa; x1 = $xb; limites = @($limites); trozos = @($trozos) })
        }
        $null = $tablas.Add([ordered]@{ desde = $y0; hasta = $y1; columnas = @($columnas) })
    }
    # ── Y UNA SEGUNDA PASADA, LA TABLA ENTERA DE UN SAQUE ───────────────────
    # No sobra: el motor descarta un numero de tres cifras cuando esta solo en su
    # recuadro, pero lo lee sin dudar cuando viene pegado a su orden de compra en
    # la misma linea. Al reves, el total de la ultima fila -que no tiene nada al
    # lado- solo sale leyendo esa celda sola. Cada forma ve lo que la otra no.
    $sueltas = New-Object System.Collections.ArrayList
    try {
        $res2 = LeerBitmap $grande
        foreach ($linea in $res2.Lines) {
            foreach ($pp in $linea.Words) {
                $rr2 = $pp.BoundingRect
                # Se devuelven en coordenadas de la imagen ORIGINAL, para que caigan
                # dentro de las mismas celdas sin tener que dividir despues.
                $null = $sueltas.Add([ordered]@{
                    t = $pp.Text
                    x = [int]($rr2.X / $esc); y = [int]($rr2.Y / $esc)
                    w = [int]($rr2.Width / $esc); h = [int]($rr2.Height / $esc) })
            }
        }
    } catch { }
    $grande.Dispose()

    Write-Output ([ordered]@{
        ancho = $ancho; alto = $alto; escala = $esc
        hor = @($hor); ver = @($ver)
        celdasLeidas = $leidas
        tablas = $tablas
        sueltas = @($sueltas)
    } | ConvertTo-Json -Depth 6 -Compress)
} catch {
    Write-Output (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress)
    exit 1
} finally {
    if ($temporal -and (Test-Path -LiteralPath $temporal)) { try { [System.IO.File]::Delete($temporal) } catch { } }
}
