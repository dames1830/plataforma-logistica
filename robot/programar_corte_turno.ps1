# =============================================================================
#  REGISTRA LA TAREA "Robot corte de turno" EN WINDOWS
# =============================================================================
#
#  Lo llama PROGRAMAR_CORTE_TURNO.bat. Va aparte y no adentro del .bat porque
#  el comando lleva un argumento que a su vez es una ruta entre comillas
#  -correr_si_toca.bat corte_turno "...ejecutar_corte_turno.bat"- y las comillas
#  anidadas se rompen distinto en cmd, en un .bat y en la consola. En un .ps1 no
#  hay nada que escapar y ademas se puede probar con -Simular.
#
#  EL DISPARADOR ES UNO SOLO: todos los dias a las 00:00, repitiendo cada 10
#  minutos durante 24 horas. La hora de verdad -las 20:00- y los dias los decide
#  la web; Windows solo despierta al robot y `correr_si_toca.bat` pregunta si le
#  toca. Es como quedaron las otras nueve tareas.
#
#  USO
#      powershell -ExecutionPolicy Bypass -File programar_corte_turno.ps1
#      powershell -ExecutionPolicy Bypass -File programar_corte_turno.ps1 -Simular
# =============================================================================
param(
    [string] $Raiz = $PSScriptRoot,
    [switch] $Simular
)

$ErrorActionPreference = 'Stop'
$NOMBRE = 'Robot corte de turno'

$Raiz = $Raiz.TrimEnd('\')
$envoltorio = Join-Path $Raiz 'correr_si_toca.bat'
$comando    = Join-Path $Raiz 'ejecutar_corte_turno.bat'

foreach ($f in @($envoltorio, $comando, (Join-Path $Raiz 'corte_turno.py'))) {
    if (-not (Test-Path $f)) {
        Write-Host "ERROR: falta $f" -ForegroundColor Red
        exit 1
    }
}

# LOS DOS ARGUMENTOS VAN ENTRE COMILLAS, igual que en 'Picking por hora':
#     "picking_hora" "C:\wms_scraping\ejecutar_picking_hora.bat"
# `correr_si_toca.bat` los lee con %~1 y %~2, que quitan las comillas solos.
$accion = New-ScheduledTaskAction -Execute $envoltorio `
                                  -Argument ('"corte_turno" "' + $comando + '"') `
                                  -WorkingDirectory $Raiz

# LA MISMA CUENTA QUE 'Picking por hora', leida del servidor y no supuesta:
# Administrator / Interactive / Limited.
#
# No puede ser SYSTEM. De los tres scripts que entran a Oracle, `oblpn_embalaje.py`
# y `asn_web_report.py` ajustan PLAYWRIGHT_BROWSERS_PATH al perfil de Administrator
# -por eso sus tareas si corren como SYSTEM-, pero `picking_por_hora.py` no lo hace:
# como SYSTEM no encuentra el navegador y la bajada falla.
#
# El precio es que la tarea solo corre con la sesion abierta. Es la misma condicion
# de los otros cuatro robots de Oracle, y por eso cerrar una sesion de RDP los deja
# a todos en 0x800710E0.
$principal = New-ScheduledTaskPrincipal -UserId 'Administrator' `
                                        -LogonType Interactive `
                                        -RunLevel Limited

$disparador = New-ScheduledTaskTrigger -Daily -At '00:00'
$disparador.Repetition = (New-ScheduledTaskTrigger -Once -At '00:00' `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration (New-TimeSpan -Hours 24)).Repetition

# 90 minutos de tope: el corte se presupuesta en 75 y el ultimo paso puede
# estirarse. IgnoreNew para que un despertar no arranque una segunda copia
# encima de la que ya esta trabajando.
$ajustes = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 90) `
                                        -StartWhenAvailable `
                                        -MultipleInstances IgnoreNew

Write-Host ''
Write-Host "  tarea      : $NOMBRE"
Write-Host "  ejecuta    : $($accion.Execute)"
Write-Host "  argumentos : $($accion.Arguments)"
Write-Host "  cuenta     : $($principal.UserId) / $($principal.LogonType) / $($principal.RunLevel)"
Write-Host "  dispara    : cada 10 minutos, todos los dias"
Write-Host "  tope       : 90 minutos"
Write-Host ''

if ($Simular) {
    Write-Host '  -Simular: no se registro nada.' -ForegroundColor Yellow
    exit 0
}

Register-ScheduledTask -TaskName $NOMBRE -Action $accion -Trigger $disparador `
                       -Settings $ajustes -Principal $principal -Force | Out-Null

Write-Host '  Tarea registrada.' -ForegroundColor Green
