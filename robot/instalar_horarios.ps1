# ==============================================================================
#  QUE LAS TAREAS DE WINDOWS LE PREGUNTEN A LA WEB
# ==============================================================================
#
#  Deja las tareas del robot despertando cada 10 minutos y llamando primero a
#  horario_robot.py, que decide si les toca. La hora pasa a vivir en la web.
#
#  NO TOCA NINGUN .bat DE LOS QUE YA ANDAN. Se crea un envoltorio nuevo y se
#  cambia a que apunta la tarea; el .bat original queda intacto y sigue
#  sirviendo para correr a mano.
#
#  USO, en PowerShell COMO ADMINISTRADOR y en el servidor:
#
#     powershell -ExecutionPolicy Bypass -File C:\wms_scraping\instalar_horarios.ps1
#         solo MUESTRA como estan las tareas y deja el respaldo. No cambia nada.
#
#     powershell -ExecutionPolicy Bypass -File C:\wms_scraping\instalar_horarios.ps1 -Aplicar
#         hace los cambios, despues de haber guardado el respaldo.
#
#  Para volver atras queda un REVERTIR_HORARIOS.ps1 al lado, escrito con los
#  valores que tenian las tareas antes de tocarlas.
# ==============================================================================

param([switch]$Aplicar)

$ErrorActionPreference = 'Stop'
$RAIZ = 'C:\wms_scraping'
$ENVOLTORIO = Join-Path $RAIZ 'correr_si_toca.bat'
$SELLO = Get-Date -Format 'yyyyMMdd_HHmm'
$RESPALDO = Join-Path $RAIZ "tareas_antes_$SELLO.json"
$REVERTIR = Join-Path $RAIZ 'REVERTIR_HORARIOS.ps1'

# Que tarea de la web le corresponde a cada tarea de Windows. El ancla lleva las
# DOS: es una sola tarea con dos horarios, y corre si a cualquiera le toca.
# Los nombres son los REALES del servidor, leidos el 18-ago-2026. Ojo con el ultimo:
# la tarea de los reportes diarios no se llama "Reportes diarios" sino por lo que baja.
$MAPA = [ordered]@{
  'Robot Oracle WMS'                  = 'ancla_noche,ancla_manana'
  'Stock por hora'                    = 'stock_hora'
  'Picking por hora'                  = 'picking_hora'
  'Picking y Detalle Orden de ayer'   = 'reportes'
}

Write-Host ''
Write-Host '===============================================================' -ForegroundColor Cyan
Write-Host ' HORARIOS DEL ROBOT - instalacion en el servidor' -ForegroundColor Cyan
Write-Host '===============================================================' -ForegroundColor Cyan

# --- 1. La maquina correcta ---------------------------------------------------
$maquina = $env:COMPUTERNAME
Write-Host ''
Write-Host "Maquina: $maquina"
if ($maquina -notlike 'vmi*') {
  Write-Host ''
  Write-Host 'ESTO NO PARECE EL SERVIDOR.' -ForegroundColor Red
  Write-Host 'El servidor es vmi3488466. Si esta en la laptop, cierre y entre por SERVIDOR WMS.' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $RAIZ 'horario_robot.py'))) {
  Write-Host ''
  Write-Host "FALTA $RAIZ\horario_robot.py" -ForegroundColor Red
  Write-Host 'Bajelo primero con:' -ForegroundColor Yellow
  Write-Host '  curl.exe -L -o C:\wms_scraping\horario_robot.py https://dames1830.github.io/plataforma-logistica/robot/horario_robot.py'
  exit 1
}

# --- 2. Como estan hoy, y el respaldo ----------------------------------------
$antes = @()
foreach ($nombre in $MAPA.Keys) {
  $t = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
  if (-not $t) {
    Write-Host ''
    Write-Host "  [!] No encuentro la tarea '$nombre'" -ForegroundColor Yellow
    continue
  }
  $acciones = @()
  foreach ($a in $t.Actions) {
    $acciones += [pscustomobject]@{ Execute = $a.Execute; Arguments = $a.Arguments; WorkingDirectory = $a.WorkingDirectory }
  }
  $disparos = @()
  foreach ($g in $t.Triggers) {
    $disparos += [pscustomobject]@{
      Tipo = $g.CimClass.CimClassName; Inicio = $g.StartBoundary
      Dias = "$($g.DaysOfWeek)"; Repite = "$($g.Repetition.Interval)"
    }
  }
  $antes += [pscustomobject]@{ Tarea = $nombre; Web = $MAPA[$nombre]; Acciones = $acciones; Disparos = $disparos }

  Write-Host ''
  Write-Host "=== $nombre" -ForegroundColor White
  Write-Host "    en la web: $($MAPA[$nombre])"
  foreach ($a in $acciones) { Write-Host "    corre    : $($a.Execute) $($a.Arguments)" }
  foreach ($d in $disparos) { Write-Host "    dispara  : $($d.Inicio)  dias=$($d.Dias)  repite=$($d.Repite)" }
}

$antes | ConvertTo-Json -Depth 6 | Set-Content -Path $RESPALDO -Encoding UTF8
Write-Host ''
Write-Host "Respaldo guardado en: $RESPALDO" -ForegroundColor Green

if (-not $Aplicar) {
  Write-Host ''
  Write-Host 'MODO MIRAR: no se cambio nada.' -ForegroundColor Yellow
  Write-Host 'Si esta todo bien, vuelva a correrlo agregando  -Aplicar' -ForegroundColor Yellow
  Write-Host ''
  exit 0
}

# --- 3. El envoltorio ---------------------------------------------------------
# ASCII puro y sin tildes: un .bat con eñes se rompe entero en cmd.exe.
$bat = @(
  '@echo off',
  'REM  Generado por instalar_horarios.ps1 - no editar a mano.',
  'REM  Uso:  correr_si_toca.bat <tareas-de-la-web> "<comando completo>"',
  'REM  Devuelve 0 y no hace nada si a esa tarea no le toca ahora.',
  'python C:\wms_scraping\horario_robot.py %~1',
  'if errorlevel 1 (',
  '  echo [HORARIO] no le toca; no se corre nada.',
  '  exit /b 0',
  ')',
  'echo [HORARIO] le toca; arrancando...',
  'call %~2',
  'exit /b %errorlevel%'
) -join "`r`n"

[System.IO.File]::WriteAllText($ENVOLTORIO, $bat, [System.Text.Encoding]::ASCII)
Write-Host ''
Write-Host "Envoltorio escrito: $ENVOLTORIO" -ForegroundColor Green

# --- 4. Reconfigurar cada tarea ----------------------------------------------
foreach ($fila in $antes) {
  $nombre = $fila.Tarea
  $t = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
  if (-not $t) { continue }

  $orig = $fila.Acciones[0]
  $comando = $orig.Execute
  if ($orig.Arguments) { $comando = "$($orig.Execute) $($orig.Arguments)" }

  # Ya instalado: no se vuelve a envolver
  if ($orig.Execute -like '*correr_si_toca*') {
    Write-Host ''
    Write-Host "=== $nombre : ya estaba envuelto, se deja como esta" -ForegroundColor Yellow
    continue
  }

  $argumentos = '"' + $fila.Web + '" "' + $comando + '"'
  $accion = New-ScheduledTaskAction -Execute $ENVOLTORIO -Argument $argumentos -WorkingDirectory $RAIZ

  # Un solo disparador: todos los dias a las 00:00, repitiendo cada 10 minutos
  # durante 24 horas. Los dias y la hora los decide la web, no esto.
  $d = New-ScheduledTaskTrigger -Daily -At '00:00'
  $rep = (New-ScheduledTaskTrigger -Once -At '00:00' `
            -RepetitionInterval (New-TimeSpan -Minutes 10) `
            -RepetitionDuration (New-TimeSpan -Hours 24)).Repetition
  $d.Repetition = $rep

  Set-ScheduledTask -TaskName $nombre -Action $accion -Trigger $d | Out-Null

  Write-Host ''
  Write-Host "=== $nombre" -ForegroundColor Green
  Write-Host "    ahora corre: $ENVOLTORIO $argumentos"
  Write-Host "    dispara    : cada 10 minutos, todos los dias"
}

# --- 5. El boton de volver atras ---------------------------------------------
$rev = @(
  '# Devuelve las tareas del robot a como estaban antes de instalar los horarios.',
  '# Generado el ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ' por instalar_horarios.ps1',
  '$ErrorActionPreference = ''Stop''',
  '$datos = Get-Content -Raw ''' + $RESPALDO + ''' | ConvertFrom-Json',
  'foreach ($f in $datos) {',
  '  $a = $f.Acciones[0]',
  '  $accion = New-ScheduledTaskAction -Execute $a.Execute -Argument $a.Arguments',
  '  $disp = @()',
  '  foreach ($d in $f.Disparos) {',
  '    $g = New-ScheduledTaskTrigger -Daily -At ([datetime]$d.Inicio)',
  '    $disp += $g',
  '  }',
  '  Set-ScheduledTask -TaskName $f.Tarea -Action $accion -Trigger $disp | Out-Null',
  '  Write-Host "revertida: $($f.Tarea)"',
  '}',
  'Write-Host "OJO: los dias de la semana hay que revisarlos a mano en el Programador."'
) -join "`r`n"
[System.IO.File]::WriteAllText($REVERTIR, $rev, [System.Text.Encoding]::ASCII)

Write-Host ''
Write-Host '===============================================================' -ForegroundColor Cyan
Write-Host ' LISTO. Para volver atras:' -ForegroundColor Cyan
Write-Host "   powershell -ExecutionPolicy Bypass -File $REVERTIR" -ForegroundColor Cyan
Write-Host '===============================================================' -ForegroundColor Cyan
Write-Host ''
