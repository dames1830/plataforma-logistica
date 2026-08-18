# Web Logistica Deam1830

Plataforma de gestion de almacen: almacenaje, picking, slotting, reposicion y
reportes. La usa el equipo de un almacen de calzado. El usuario del proyecto es
Daniel Ames (dames1830), que **no es programador**: hay que explicarle en
espanol claro, con el porque antes que los pasos, y confirmar antes de
cualquier accion que no se pueda deshacer.

---

## Regla de oro: se trabaja en `beta`, nunca en `main`

`main` es produccion: lo que hay ahi es lo que el almacen esta usando ahora
mismo. Todo cambio entra por `beta` y se prueba contra `database_beta.db`.

Subir a `main` requiere una orden explicita de Daniel, y esa orden vale **solo
para ese lanzamiento**: no queda abierta para el siguiente.

Antes de empezar, comprobar en que rama se esta parado:

    git branch --show-current

---

## Versionado: siempre con `bump.py`

La version viaja en ~34 sitios distintos (los `?v=` de cada import, el
`const VERSION`, los textos "SYSTEM BUILD"). Si quedan desincronizados, el
navegador sirve unos archivos viejos y otros nuevos, y la web se rompe de
formas dificiles de rastrear. **Nunca editar la version a mano.**

    python bump.py            # sube el correlativo   (29.0249 -> 29.0250)
    python bump.py check      # solo revisa si estan todas iguales
    python bump.py 30         # arranca una version grande nueva (-> 30.0001)

Formato `MAYOR.NNNN`: el mayor cambia en un lanzamiento grande, el correlativo
de 4 digitos sube en cada entrega.

Como bump.py toca muchos archivos a la vez, el commit va **siempre** con `-A`:

    python bump.py
    git add -A
    git commit -m "v29.0250 - descripcion de que cambio"

El mensaje del commit describe el efecto para el usuario, no el detalle
tecnico: "El turno contaba la paleta que desaparece, no la que se trabaja".

---

## Mapa del proyecto

    index.html                    entrada de la plataforma
    reportes.html                 reportes publicos (sin login)

    js/app.js                     arranque, sesion y ruteo (687 lineas)
    js/env.js                     detecta entorno y sella las llamadas con X-Environment
    js/views/
        dashboard_v28.js          ESTE es el que corre: casi todos los modulos
                                  (33.000+ lineas)
        login.js  slotting.js  reportes_publicos.js  public_layout_activo.js
    js/services_v245/             la capa de datos, un archivo por tema:
        reportesComunes.js        reglas compartidas de los reportes
        jornadaService.js         la fecha logica del turno
        adminService.js  auth.js  slottingService.js  zonasService.js
        metasService.js  tallasService.js  robotsService.js
        sync_engine_v24_9.js      sincronizacion por versiones
        csvHub_v6.js  archivosNube.js  cyclicCountService.js

    backend/main.py               la API (1.666 lineas)
    backend/database.db           produccion
    backend/database_beta.db      pruebas (separada a proposito)

    robot/                        procesos que corren en el servidor Contabo
        generar_slotting.py  generar_rotacion.py  horario_robot.py

    Documentacion/                notas del proyecto
    .claude/skills/               reglas de negocio que se cargan solas:
        reglas-almacenaje/  cadena-de-modulos/

---

## Trampas conocidas

**Las fechas nunca salen de `toISOString()`.** Devuelve UTC y adelanta el dia a
las 19:00 hora de Lima, justo cuando entra el turno noche. Va
`getLogicalDate()`, que delega en `jornadaService.fechaLogicaDe()`.

**`dashboard_v28.js` es el archivo que corre.** Si aparece otro archivo con
nombre parecido en `js/backup_admin/` o `js/backups_v24/`, es codigo muerto:
editarlo no cambia nada en la pantalla y hace perder horas.

**Los reportes cuentan por el dia trabajado**, no por el dia en que nacio el
registro. La regla vive en `reportesComunes.js` y la usan ~20 sitios. Al
cambiarla, revisar tambien las agrupaciones, no solo los filtros.

**El caché de configuracion en localStorage.** Un campo nuevo no llega a las PC
que ya tienen caché guardado. Antes de dar algo por probado, comparar beta
contra produccion en la misma maquina.

**Compilar no es probar.** Que el import cargue sin error no significa que la
pantalla dibuje: los errores de dibujado no los ve el chequeo de sintaxis.

**El desenfoque de `glass-panel` recorta.** Un menu que se sale del recuadro
sale cortado y parece que llegara vacio.

---

## Como se prueba

Entorno beta separado, con su propia base (`database_beta.db`). `env.js` sella
cada llamada con la cabecera `X-Environment` para que no se crucen los datos.

    ./abrir_pruebas.bat        abre el entorno de pruebas
    ./revisar_pruebas.bat      revisa que este todo en orden

Para lo visual: **maqueta antes de codear**. Si el cambio se ve en pantalla, hay
que mostrarselo a Daniel antes de escribir el codigo definitivo. Siempre cambia
algo al verlo.

---

## Estilo

- Espanol neutro, sin voseo: se escribe "actualiza" y "puedes", nunca "actualiza"
  con tilde final ni "podes" con tilde en la o (las formas rioplatenses).
- Los cuadros tienen que cuadrar: Daniel suma las filas con la calculadora. Si
  una no cierra, cae el reporte entero.
- Un porcentaje nunca va solo: siempre con la cantidad, y diciendo de que es.
- Un cuadro, una sola fecha. Dos columnas de dias distintos se leen como error.
