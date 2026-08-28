# Cerrar la escritura anónima de datos — instructivo de encendido

Desde la v29.0415 el servidor **puede** exigir credencial para escribir datos
(`POST/PATCH /api/logistics/{area}`). Viene **apagado**: hay que encenderlo por
pasos para no dejar a nadie fuera. No enciendas nada hasta terminar el paso 3.

## El interruptor
El servidor mira dos variables de entorno:
- `ROBOT_TOKEN` — el token que usan los robots. **Secreto**, no va en el repo.
- `EXIGIR_TOKEN_ESCRITURA` — `false` (o sin poner) = modo aviso; `true` = exige.

Seguro de fábrica: si enciendes `EXIGIR_TOKEN_ESCRITURA` sin haber puesto
`ROBOT_TOKEN`, el servidor lo ignora y sigue en modo aviso. Nunca queda
exigiendo un token que no existe.

## El token: se genera y NUNCA se escribe aquí

El token es un secreto. **No va en este archivo ni en ningún otro del repo** —el
repo se sirve público en `deam1830.com/robot/`, así que un token escrito aquí lo
puede leer cualquiera y el candado deja de servir. (Eso pasó una vez: el token
que estuvo escrito acá quedó quemado y se cambió por otro.)

Se genera con:
```
python -c "import secrets; print('rbt_'+secrets.token_urlsafe(30))"
```

Y el valor va SOLO en DOS lugares, nunca en un archivo del repo:
1. En **Render** (el servidor), como variable de entorno `ROBOT_TOKEN`.
2. En el **Contabo** (donde corren los robots), como variable de entorno
   `ROBOT_TOKEN` del sistema, para que los scripts la lean con `os.environ`.

Los dos tienen que tener EL MISMO valor. Si alguna vez se sospecha que se filtró,
se genera otro y se cambia en los dos lugares —los robots no hay que tocarlos,
leen la variable.

## Los pasos, en este orden

**1. Desplegar el servidor (v29.0415).** Sale en modo AVISO: acepta todo como
   siempre, pero cuenta las escrituras anónimas. NO rompe nada.

**2. Poner `ROBOT_TOKEN` en Render y en el Contabo.** Con el mismo valor de
   arriba. Los robots ya traen el código que lo lee; sin la variable mandan
   vacío y, como el candado sigue apagado, siguen funcionando.

**3. Que las PC vuelvan a entrar.** Cada PC de operario tiene que cerrar sesión
   y entrar de nuevo UNA vez: así su navegador recibe el token nuevo. La web ya
   lo manda en cada guardado; solo falta que lo tenga.

**3 bis. Desplegar la web v29.0487 y volver a subir DOS robots.** Sin esto el
   paso 4 no llega nunca — ver la sección de abajo. Los robots que hay que
   volver a subir al Contabo por curl son `generar_rotacion.py` y
   `archivar_tareas.py`. Ver [[robot-scripts-versionados]] para cómo se suben.

**4. Mirar el contador.** En
   `https://logistics-backend-wv0x.onrender.com/api/health` —**esa** es la
   dirección del servidor; `deam1830.com/api/health` da 404, ahí solo vive la web—,
   el campo `candado_escritura.escrituras_anonimas`. Desde v29.0488 trae el
   **desglose**: `por_area` dice qué se está escribiendo sin credencial y
   `por_quien` si viene de un navegador o de un script, los dos de mayor a menor.
   Déjalo un día entero —que pasen todos los robots y todos los turnos— y fíjate si
   sigue subiendo:
   - Si **dejó de subir**: ya nadie escribe sin token. Se puede encender.
   - Si **sigue subiendo**: `por_area` dice exactamente qué falta y `por_quien`
     de dónde viene. Revísalo antes de encender, o dejarías ese fuera.

   **El contador vive en la memoria del servidor: un despliegue lo pone en cero.**
   Así que se cuenta desde el último despliegue, no desde siempre.

## POR QUÉ EL CONTADOR NUNCA BAJABA (28-ago-2026, v29.0487)

El 28-ago el contador marcaba **1.547** escrituras anónimas y la última era de
minutos antes, sobre `tabla_tallas`. No era una PC con sesión vieja: **era la web
misma**.

El token lo mandaba **solo el motor de sincronización** (`pushChange`). Pero la web
escribe al servidor desde **~30 sitios más** que no pasan por el motor: la tabla de
tallas, el análisis del buffer, la configuración del análisis, la jornada, las
metas, el slotting, las zonas, las tallas, los robots, la capacidad, el tema de
cada usuario, el layout del activo, el plan del buffer, las actividades del turno,
el caché de No Retail… Todos anónimos. El paso 4 no iba a llegar nunca.

**El arreglo no fue tocar los 30**, que es repetir el mismo descuido 30 veces y
olvidarse en el sitio 31. La credencial se pone en `js/env.js`, que ya envolvía el
`fetch` para sellar el entorno: es el ÚNICO sitio por donde pasan todas las
llamadas. Reglas:

- Solo en las que **escriben** (POST/PATCH/PUT/DELETE). Un GET sin cabeceras raras
  es una petición "simple" y sale directo; agregarle una cabecera obligaría a una
  consulta previa y **duplicaría todas las lecturas**.
- Solo a **este** servidor, nunca a un dominio ajeno.
- Si la llamada ya trae su credencial, no se le pisa (puede ser la de un robot).
- **Sin sesión no se pone nada** y la llamada sale igual que antes: hoy no rompe a
  nadie, y el día que se encienda el candado esas escrituras darán 403 — que es
  justamente el punto.

Y **dos robots escribían sin token**: `generar_rotacion.py` (publica Rotación y
Permanencia) y `archivar_tareas.py`. Los otros cuatro ya estaban sellados.

**Ojo con los reportes públicos.** Se abren sin sesión y desde ahí se pueden
editar y borrar registros del historial del buffer. Con el candado encendido eso
deja de funcionar: es una decisión, no un efecto secundario.

**5. Encender.** Poner `EXIGIR_TOKEN_ESCRITURA=true` en Render. Desde ese
   momento, escribir datos sin token de sesión o de robot devuelve 403.

## Si algo sale mal
Apagar es instantáneo y sin desplegar nada: en Render, poner
`EXIGIR_TOKEN_ESCRITURA=false` (o borrar la variable). El servidor vuelve a
aceptar todo en el acto.

## Qué NO cierra este paso (sigue abierto, para después)
- **Leer** cualquier área sigue libre (sin esto no arranca ni el login).
- `POST /api/archivos` (subir archivos) y los endpoints de `buffer` siguen sin
  candado.
- La página de reportes públicos todavía puede borrar historial de buffer.
