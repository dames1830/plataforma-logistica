/* ══════════════════════════════════════════════════════════════════════════════
 * LO QUE COMPARTEN TODAS LAS LAMINAS DE LA CAMARA
 *
 * Son los resumenes que Daniel captura y manda al grupo de WhatsApp de sus jefes.
 * Hay dos -el cuadro de asistencia y el reporte UCA- y va a haber mas, asi que las
 * reglas que valen para todas viven aca y no copiadas en cada modulo.
 *
 * El estandar completo esta en `.claude/skills/laminas-camara/SKILL.md`.
 * ══════════════════════════════════════════════════════════════════════════════ */

/* CUANTAS VECES SE DIBUJA POR DENTRO. No cambia lo que se ve en pantalla: cambia con
   cuanto material se copia al portapapeles.

   Reducir NO ensucia, limpia: cuando WhatsApp promedia dos o tres puntos del original en
   cada punto final, el borde sale mas suave. Lo que rompe es el JPEG al tamano final. Asi
   que conviene entregarle de sobra: la foto normal recorta a ~1.600 por el lado largo y la
   foto en HD a ~2.560. */
export const ESCALA_FOTO = 3;

/* EL TOPE ES SOBRE EL LADO MAS LARGO, no sobre el total de puntos. Por eso una lamina mas
   cuadrada conserva mas: el lado corto no gasta presupuesto. Sirve para decidir en cuantos
   bloques se parte una tabla larga. */
export const TOPE_NORMAL = 1600;
export const TOPE_HD = 2560;

/**
 * CUANTAS VECES HAY QUE DIBUJAR PARA LLENAR EL TOPE DE HD.
 *
 * WhatsApp no agranda: si la lamina llega con menos de 2.560 por el lado largo, la deja
 * como esta. Dibujarla justo por debajo del tope es regalar nitidez -paso con el cuadro de
 * asistencia partido en dos: llegaba con 2.370 y se quedaba ahi-.
 *
 * Nunca menos de ESCALA_FOTO: para la foto normal, que recorta a 1.600, entregar de sobra
 * sigue conviniendo porque la reduccion promedia puntos y suaviza el borde.
 *
 * @param largoDiseno el lado mas largo de la lamina, en unidades de diseno
 * @param zoom        cuanto se agranda para verla en pantalla
 */
export function escalaParaFoto(largoDiseno, zoom) {
  if (!largoDiseno || !zoom) return ESCALA_FOTO;
  return Math.max(ESCALA_FOTO, TOPE_HD / (largoDiseno * zoom));
}

const canvasSuelto = () => document.createElement('canvas').getContext('2d');

/** Cualquier formato de color -hex, rgb(), nombre- a sus tres canales. */
export function aRGB(color) {
  const t = canvasSuelto();
  t.fillStyle = '#000';
  t.fillStyle = color;                       /* el navegador normaliza lo que sea */
  const v = t.fillStyle;
  if (v.charAt(0) === '#') return [parseInt(v.substr(1, 2), 16),
                                   parseInt(v.substr(3, 2), 16),
                                   parseInt(v.substr(5, 2), 16)];
  const n = (v.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
  return [n[0] || 0, n[1] || 0, n[2] || 0];
}

/** Brillo percibido: el ojo ve el verde mucho mas que el azul. */
export function brillo(color) {
  const c = Array.isArray(color) ? color : aRGB(color);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

/**
 * EL COLOR CON EL QUE HAY QUE DIBUJAR PARA QUE AGUANTE WHATSAPP.
 *
 * Daniel, 27-ago-2026: *"se distorsiona un poco los bordes de los numeros, los bordes de
 * las letras"*. WhatsApp reencoda la foto en JPEG, y el JPEG guarda el COLOR a la mitad de
 * resolucion que el brillo. Un numero de color claro sobre fondo claro tiene su borde casi
 * solo en el color -que es lo que se resume-, asi que sale con halo: verdoso de un lado,
 * calido del otro.
 *
 * MEDIDO, no supuesto (`scratch/prueba_lamina_whatsapp.html`): con el color oscurecido el
 * borde queda casi limpio, y le gana incluso a subir la resolucion. **El brillo pesa mas
 * que el tamano.**
 *
 * No se pinta de negro: se conserva el TONO -el verde sigue verde- y se lleva el BRILLO lo
 * mas lejos posible del fondo. Sobre fondo claro oscurece; sobre fondo oscuro ACLARA.
 *
 * @param color      el color del tema, tal cual
 * @param fondo      sobre que se va a dibujar; decide si hay que oscurecer o aclarar
 * @param metaClaro  brillo objetivo cuando el fondo es claro   (cifras 0,16 · rotulos 0,34)
 * @param metaOscuro brillo objetivo cuando el fondo es oscuro  (cifras 0,86 · rotulos 0,72)
 */
export function paraFoto(color, fondo, metaClaro, metaOscuro) {
  const c = aRGB(color);
  const b = brillo(c);
  const meta = brillo(fondo) > 0.5 ? metaClaro : metaOscuro;
  let r;
  if (meta < b) {
    r = c.map((x) => x * (b > 0 ? meta / b : 1));           /* oscurecer: se escala */
  } else {
    const t = b < 1 ? (meta - b) / (1 - b) : 0;             /* aclarar: se mezcla con blanco */
    r = c.map((x) => x + (255 - x) * t);
  }
  return 'rgb(' + r.map((x) => Math.max(0, Math.min(255, Math.round(x)))).join(',') + ')';
}

/**
 * EL BOTON COPIAR: el camino sin captura de pantalla.
 *
 * Una captura solo entrega lo que la lamina mide EN PANTALLA, y si la lamina no entra en la
 * ventana ademas sale cortada -a Daniel le faltaba la leyenda del pie-. El portapapeles se
 * lleva el dibujo entero sin importar el tamano de la pantalla. Se pega con Ctrl+V.
 */
export function botonCopiar(lienzo, estilo, rotulo) {
  const b = document.createElement('button');
  b.textContent = rotulo || 'Copiar imagen';
  b.style.cssText = estilo || '';
  b.onclick = () => {
    /* El blob va como PROMESA dentro del ClipboardItem, sin esperarlo antes: si se espera,
       el navegador ya no reconoce que esto viene de un clic y niega el permiso. */
    let escribir;
    try {
      const png = new Promise((res) => lienzo.toBlob(res, 'image/png'));
      escribir = navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    } catch (e) {
      escribir = Promise.reject(e);
    }
    escribir.then(
      () => { b.textContent = 'Copiada · pégala con Ctrl+V'; },
      () => { b.textContent = 'No se pudo copiar · usa clic derecho'; }
    );
  };
  return b;
}

/**
 * EN CUANTOS BLOQUES CONVIENE PARTIR UNA TABLA LARGA.
 *
 * El tope de WhatsApp cae sobre el LADO MAS LARGO, asi que una lamina alta y angosta gasta
 * todo el presupuesto en el alto y a cada fila le tocan menos puntos. Partirla en bloques
 * mas cuadrados le devuelve altura a la fila.
 *
 * Medido con el cuadro de asistencia de 42 personas (632 de ancho, 162 fijos + 17 por fila):
 *
 *     bloques   filas   forma       fila en HD
 *        1        42    632×876      50 puntos
 *        2        21    632×519      69 puntos     <- todo lo que hay que ganar
 *        3        14    632×400      69 puntos     <- ya no gana nada, y es un mensaje mas
 *
 * Se para en cuanto el alto baja del ancho: desde ahi el lado largo pasa a ser el ancho y
 * partir mas solo agrega mensajes. Los bloques quedan parejos, no uno lleno y otro con las
 * sobras.
 *
 * @param cuantas  filas a repartir
 * @param ancho    ancho de la lamina, en unidades de diseno
 * @param altoFijo lo que ocupa todo lo que NO son filas (titulo, tarjetas, pie, margen)
 * @param altoFila alto de una fila
 * @returns filas por bloque
 */
export function filasPorBloque(cuantas, ancho, altoFijo, altoFila) {
  const cabenCuadrado = Math.floor((ancho - altoFijo) / altoFila);
  if (cabenCuadrado < 1 || cuantas <= cabenCuadrado) return cuantas;
  const bloques = Math.ceil(cuantas / cabenCuadrado);
  return Math.ceil(cuantas / bloques);                      /* parejos, no el ultimo cojo */
}

/** Parte una lista en trozos de a lo sumo `tam`. */
export function enBloques(lista, tam) {
  if (!tam || tam >= lista.length) return [lista];
  const r = [];
  for (let i = 0; i < lista.length; i += tam) r.push(lista.slice(i, i + tam));
  return r;
}
