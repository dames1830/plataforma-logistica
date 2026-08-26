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

## El token de este despliegue
```
ROBOT_TOKEN = rbt_wbxGk4sW3qWmv8pUNBccS_7jjw4YY6MhG6ffbMqq
```
Guárdalo. Va en DOS lugares y en ninguno más:
1. En **Render** (el servidor), como variable de entorno `ROBOT_TOKEN`.
2. En el **Contabo** (donde corren los robots), como variable de entorno
   `ROBOT_TOKEN` del sistema, para que los scripts la lean con `os.environ`.

## Los pasos, en este orden

**1. Desplegar el servidor (v29.0415).** Sale en modo AVISO: acepta todo como
   siempre, pero cuenta las escrituras anónimas. NO rompe nada.

**2. Poner `ROBOT_TOKEN` en Render y en el Contabo.** Con el mismo valor de
   arriba. Los robots ya traen el código que lo lee; sin la variable mandan
   vacío y, como el candado sigue apagado, siguen funcionando.

**3. Que las PC vuelvan a entrar.** Cada PC de operario tiene que cerrar sesión
   y entrar de nuevo UNA vez: así su navegador recibe el token nuevo. La web ya
   lo manda en cada guardado; solo falta que lo tenga.

**4. Mirar el contador.** En `https://deam1830.com/api/health`, el campo
   `candado_escritura.escrituras_anonimas.total`. Déjalo un día entero —que
   pasen todos los robots y todos los turnos— y fíjate si sigue subiendo:
   - Si **dejó de subir**: ya nadie escribe sin token. Se puede encender.
   - Si **sigue subiendo**: `ultima_area` dice quién falta. Revísalo antes de
     encender, o dejarías ese fuera.

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
