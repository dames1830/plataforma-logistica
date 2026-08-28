---
name: laminas-camara
description: El estándar de las láminas del ícono de cámara — los resúmenes que Daniel captura y manda al grupo de WhatsApp de sus jefes. Úsala SIEMPRE que agregues un botón de cámara a un reporte, toques una lámina existente (laminaUCA, la del cuadro de asistencia) o Daniel diga que una imagen se ve borrosa, pixelada, con los bordes sucios o "no tan nítida" en WhatsApp. Cubre el formato cerrado de la lámina, por qué el COLOR arruina el borde y no el tamaño, la ruta Copiar + HD, y por qué vectorizar no sirve.
---

# Las láminas del ícono de cámara

Daniel manda estos resúmenes al **grupo de WhatsApp de sus jefes**. Ese es el único destino, y
es lo que decide cada regla de acá: una captura de la pantalla entera llega ilegible en el
celular, y WhatsApp reencoda todo lo que pasa por él.

**Todas las láminas van iguales.** Si agregas una cámara a un reporte nuevo, copia el formato;
no inventes uno. El jefe que las recibe tiene que reconocerlas de una mirada.

Lo que comparten todas vive en **`js/services_v245/laminas.js`** —no copiado en cada módulo—:
`escalaParaFoto`, `paraFoto`, `botonCopiar`, `filasPorBloque` y `enBloques`.

Las dos que existen hoy, las dos en `js/views/dashboard_v28.js`:

| | Qué es | Fondo | Se parte |
|---|---|---|---|
| `laminaUCA` | una tarjeta de resumen | el del tema | no |
| `mostrarImagen` | el cuadro de asistencia, una tabla | `--bg-dark` | sí, en bloques |

## LA REGLA DE ORO

> **El borde sucio lo causa el COLOR, no el tamaño. Primero el brillo, después la resolución.**

WhatsApp reencoda la foto en **JPEG**, y el JPEG guarda el **color a la mitad de resolución que
el brillo**. Un número de color claro sobre fondo claro tiene su borde casi solo en el color
—que es justo lo que se resume—, así que sale con halo: verdoso de un lado, cálido del otro.
Daniel lo describió como *"se distorsiona un poco los bordes de los números, los bordes de las
letras"*.

Medido el 27-ago-2026 pasando la lámina por la misma tubería (achicar + reencodar):

| | Cómo llega |
|---|---|
| color claro a 1.013 puntos | el peor: halo en todos los trazos |
| el mismo color a 1.600 | mejor, pero el halo sigue |
| **el mismo color oscurecido, a 1.013** | **el más limpio de todos** |

**El color oscurecido con MENOS resolución le gana a subir la resolución.** Si alguna vez
alguien propone "subamos el tamaño" como primera respuesta a un borde sucio, está atacando la
mitad chica del problema.

## Los colores no se dibujan como vienen del tema

Se conserva el **tono** —el verde sigue verde, el dorado sigue dorado— y se lleva el **brillo**
lo más lejos posible del fondo. En tema claro oscurece; en tema **oscuro aclara**. Un solo
camino para los cuatro temas. Es `paraFoto(color, fondo, metaClaro, metaOscuro)` — **el fondo
se le pasa**, no lo adivina: cada lámina se dibuja sobre uno distinto.

| Qué | Meta en fondo claro | Meta en fondo oscuro |
|---|---|---|
| Las cifras | 0,16 | 0,86 |
| Los rótulos | 0,34 | 0,72 |

Los rótulos van a medio camino a propósito: se siguen leyendo como secundarios, pero con más
contraste que el gris del tema. **No pintar todo de negro**: se pierde el código de color, y
Daniel eligió expresamente conservarlo.

### Pero NO en todas las láminas

**En el cuadro de asistencia va el color del tema, sin tocar.** Se probó oscurecerlo y Daniel
lo rechazó el 27-ago-2026: *"toma los mismos colores... el rojito para la x, el amarillo para
los círculos y el verde para los visto buenos"*.

La diferencia es qué hay que hacer con el color:

| | Qué es el color | Qué pesa más |
|---|---|---|
| **UCA** | decoración de un número que se LEE | el borde limpio |
| **Asistencia** | el dato mismo: 33 símbolos que hay que DISTINGUIR de un vistazo | el código de color |

Si el color es el dato, no se toca. La nitidez de esa lámina sale del botón Copiar y de
partirla en bloques, que no cuestan nada a cambio.

## Reducir NO ensucia, limpia

Cuando WhatsApp promedia dos o tres puntos del original en cada punto final, el borde sale
**más suave**. Lo que rompe es el JPEG al tamaño final. Así que hay que entregarle **de sobra,
no justo**.

    canvas = ANCHO × ESCALA × ZOOM        ESCALA = escalaParaFoto(ladoLargo, ZOOM)

**Y WHATSAPP NO AGRANDA.** Si la lámina llega con menos de 2.560 por el lado largo, la deja
como está: dibujarla por debajo del tope es regalar nitidez. Pasó con el cuadro de asistencia
partido en dos —llegaba con 2.370 y se quedaba ahí, con la fila en 64 puntos en vez de 69—.
Por eso la escala no es un número fijo: `escalaParaFoto()` la calcula para **llenar el tope de
HD**, y nunca baja de `ESCALA_FOTO` (3), porque para la foto normal entregar de sobra sigue
conviniendo.

El **ZOOM** —lo que se ve en pantalla— es otra cosa. En la del UCA se calcula contra la
ventana, con dos candados: que la lámina **entre entera sin scroll** y que no pase de 2,4 veces
el diseño. En la de asistencia es fijo en 1,25, porque ahí no se captura: se copia.

## SI LA TABLA ES MAS ALTA QUE ANCHA, SE PARTE EN BLOQUES

El tope cae sobre el **lado más largo**. Una tabla alta y angosta gasta todo el presupuesto en
el alto, y a cada fila le tocan menos puntos. Partirla en bloques más cuadrados se los devuelve.

Medido con el cuadro de asistencia de 42 personas (632 de ancho, 162 fijos + 17 por fila):

| Bloques | Filas | Forma | Fila en HD | En foto normal |
|---|---|---|---|---|
| 1 | 42 | 632×876 | 50 puntos | 31 |
| **2** | **21** | **632×519** | **69 puntos** | **43** |
| 3 | 14 | 632×400 | 69 | 43 |

**Dos bloques ganan un 38%. Tres no ganan nada más** —desde ahí el lado largo pasa a ser el
ancho— y cada bloque extra es un mensaje extra a cambio de cero. `filasPorBloque()` se detiene
solo en cuanto el alto baja del ancho, y reparte **parejo**: 21 y 21, no 27 y 15.

Cada bloque tiene que **valerse solo**, porque llegan como fotos sueltas:

- **La palabra "bloque" no aparece en ningún lado.** Se puso un "BLOQUE 1 DE 2" dentro del
  dibujo y Daniel lo mandó quitar: *"quítale lo que dice bloque uno y bloque dos"*. Ojo: **los
  botones también contaban** —decían "Copiar bloque 1"— y hubo que volver sobre ello. Ahora
  dicen qué filas se llevan: "Copiar 1 al 21". La numeración de la izquierda ya dice el resto.
- **La numeración sigue de largo**: el 22 del segundo bloque es el 22 de la lista, no otro 1.
- **La leyenda del pie va en los dos.**
- **Las tarjetas del resumen cuentan a TODOS**, no a los del bloque. Si el bloque 1 dijera
  "21 operarios" y el 2 también, ninguno cuadraría con la realidad. Los cuadros tienen que
  cuadrar.

## La ruta que Daniel tiene que usar

1. **Botón Copiar**, no la captura de pantalla. La captura solo entrega lo que la lámina mide
   en pantalla; el portapapeles se lleva el dibujo entero. Se pega con Ctrl+V.
2. **Activar HD** al enviar la foto. Sube el tope de 1.600 a 2.560. Es el salto más grande de
   todos, y no cuesta nada.

**El blob va como PROMESA dentro del `ClipboardItem`, sin esperarlo antes.** Si se hace `await`
del blob y después se llama a `navigator.clipboard.write()`, el navegador ya no reconoce que la
acción viene de un clic y niega el permiso.

## SE MUESTRA, NO SE DESCARGA

Misma ventana que el cuadro de asistencia: fondo oscuro, la lámina, y los botones **Copiar** y
**Cerrar**. Se captura o se guarda con clic derecho.

El 18-ago-2026 la descarga directa falló: en un navegador con restricciones el atributo
`download` se ignora y el archivo cae sin extensión. **No volver a intentarlo.**

### La ventana tiene TRES salidas, siempre

El botón **Cerrar**, **tocar fuera** y la tecla **Esc**. Es la convención de la casa —la
siguen las fichas de KPI y los modales del dashboard— y a las láminas les faltaba la tercera:
Daniel, 27-ago-2026, *"en algunas imágenes le aprieto Esc y me deja ver la web; en este caso
no me deja"*. Lo que se pega en la pantalla tiene que poder despegarse.

Va por `cerrarConEsc()` de `laminas.js`, que **devuelve la función que quita el oyente**. Hay
que llamarla **cierre como cierre** la ventana, o queda un oyente suelto escuchando para
siempre:

    const quitarEsc = cerrarConEsc(() => fondo.remove());
    const cerrarTodo = () => { quitarEsc(); fondo.remove(); };
    cerrar.onclick = cerrarTodo;
    fondo.onclick = (e) => { if (e.target === fondo) cerrarTodo(); };

Que el oyente se quitó no se puede ver desde fuera —no hay forma de listar los oyentes de un
documento—, así que eso se comprueba leyendo el código: las dos salidas tienen que pasar por
`cerrarTodo`.

## VECTORIZAR NO SIRVE

**WhatsApp no manda vectores.** Todo lo que va como *foto* se convierte a JPEG al enviarlo, así
que el vector se aplana antes y el problema aparece igual. La única ruta vectorial de verdad
sería un **PDF como documento**: nítido a cualquier zoom, pero llega como archivo para abrir y
no como imagen en el chat — y el punto de la lámina es que se lea de una pasada, sin abrir
nada. Ofrecerlo solo si Daniel lo pide.

## El formato, que es cerrado

    UBICACIONES DE LA RESERVA          ← título, en mayúsculas, arriba a la izquierda
    27/8/2026 · 10:17 p. m.            ← fecha y hora, chico y suave

    ┌ ANALIZADAS ┐ ┌ VACÍAS ┐ ┌ OCUPADAS ┐     ← las cifras que se suman, en fila

    ┌───────── OCUPACIÓN DE LA RESERVA ─────────┐
    │                   93%                     │   ← EL número, el que se reporta
    └───────────────────────────────────────────┘
                                178 ubicaciones libres

- **Solo el resumen.** Nada de tablas, listas ni discrepancias: en el celular no se leen.
- **Un número grande, uno solo.** Es el que Daniel reporta.
- **El porcentaje va con la cantidad**, y diciendo de qué es. En el UCA va el de **OCUPACIÓN**
  (ocupadas ÷ analizadas), no el de disponibilidad que muestra la tarjeta de la pantalla — lo
  pidió así Daniel, es el número con el que reporta.
- **El sexo NO se deduce del nombre.** La tarjeta de hombres y mujeres sale del campo `sexo`
  del maestro de trabajadores, cruzado por DNI, y arranca vacío. Suponerlo sería inventar un
  dato sobre una persona de verdad, y una tarjeta que reparte a 88 personas por una suposición
  dice una cifra falsa con cara de cierta. Quien no esté marcado no suma a ninguno de los dos
  y la tarjeta lo dice: "3 SIN MARCAR", en rojo.
- **Sin firma al pie.** Se sacó el 27-ago-2026: *"quita esa palabra que dice Logística
  Deam1830"*.
- **Los colores salen del tema activo**, pasados por `paraFoto()`. Así la lámina se ve como la
  pantalla de la que salió y no hay dos paletas que mantener.
- **Se engancha con las cifras ya calculadas** que la pantalla tiene a la vista. No las vuelve a
  contar: si el reporte y la lámina se contradicen, cae la lámina y cae el reporte.

## El botón, en la pantalla del reporte

Va al lado del de Excel, y sigue la regla de los íconos de la casa (v29.0404): **solo el
dibujo, sin fondo ni borde y sin texto al lado**, con `title` obligatorio porque es lo único
que dice qué hace.

    <button id="btnFotoUCA" class="btn-icono" title="Armar la lámina del resumen para
      mandarla por WhatsApp">${icono('camara', 18)}</button>

El dibujo vive en el catálogo `js/services_v245/iconos.js`, no suelto en el módulo.

## Errores comunes

- **Atacar el tamaño primero.** Es la mitad chica. Ver la regla de oro.
- **Pintar los números de negro.** Arregla el borde y borra el código de color. Se oscurece
  conservando el tono.
- **Oscurecer también en tema oscuro.** Ahí hay que **aclarar**: lo que importa es alejarse del
  fondo, no bajar el brillo.
- **Dejar que la lámina no entre en la pantalla.** La captura sale cortada y Daniel manda media
  tarjeta.
- **Hacer `await` del blob antes de `clipboard.write()`.** Se pierde el permiso del clic.
- **Creer que `--bg-dark` es oscura.** Pese al nombre vale `#0f172a` en indigo y negro, pero
  `#F3F2F1` en los dos temas claros. Por eso `paraFoto` recibe el fondo y decide sola, y por eso
  una prueba que dé por hecho que oscurece **falla en la mitad de los temas**.
- **Probar el color sin fijar el tema.** Un bucle que recorre los cuatro deja el **negro**
  puesto; el punto más oscuro del dibujo pasa a ser el fondo y no el número, y la comprobación
  sale **verde por la razón equivocada**. Pasó el 27-ago-2026. Fijar `data-tema` antes de medir,
  y comprobar los dos fondos por separado.

## Cómo se comprueba

Sobre los **puntos del dibujo**, no sobre el código: se lee el canvas con `getImageData` y se
busca el extremo —el más oscuro en tema claro, el más claro en tema oscuro— dentro de la zona
del número.

    scratch/prueba_camara_uca.html        el botón, los dos botones, el color y el tamaño
    scratch/prueba_lamina_asistencia.html el reparto en bloques y que las tarjetas cuadren
    scratch/prueba_lamina_whatsapp.html   pasa la lámina por la tubería de WhatsApp y compara

Las láminas usan el módulo compartido, y un `new Function` **no ve los import del archivo**:
hay que entregarle a mano lo que la lámina saca de `laminas.js`.

La segunda saca la lámina **del archivo de verdad** con `indexOf`, y puede comparar contra una
versión anterior bajándola primero:

    git show <commit>:js/views/dashboard_v28.js > scratch/_dashboard_antes.js

Ese archivo pesa 2,4 MB y **no se guarda en el repo**: se borra después de comparar.

Ver el skill `cadena-de-modulos` y, para los cuatro temas, `css/temas.css`.
