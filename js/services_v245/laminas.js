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
 * LA TERCERA SALIDA DE UNA VENTANA: LA TECLA ESC.
 *
 * Las otras dos son el boton Cerrar y tocar fuera. Es la convencion de la casa -la usan las
 * fichas de KPI y los modales del dashboard, cinco sitios- y a las laminas les faltaba:
 * Daniel, 27-ago-2026, *"en algunas imagenes le aprieto Esc y me deja ver la web; en este
 * caso no me deja"*.
 *
 * Devuelve la funcion que quita el oyente. Hay que llamarla CIERRE COMO CIERRE la ventana,
 * o queda un oyente suelto escuchando para siempre.
 */
export function cerrarConEsc(cerrar) {
  const esc = (e) => {
    if (e.key !== 'Escape') return;
    document.removeEventListener('keydown', esc);
    cerrar();
  };
  document.addEventListener('keydown', esc);
  return () => document.removeEventListener('keydown', esc);
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


/**
 * LA LAMINA DE RESUMEN, EN SU FORMATO CERRADO.
 *
 * Titulo, fecha, una fila de cifras que se suman y UN numero grande: el que se reporta.
 * Todas las laminas de camara van iguales para que el jefe que las recibe las reconozca de
 * una mirada -el estandar completo esta en .claude/skills/laminas-camara/SKILL.md-.
 *
 * Vive aca y no copiada en cada modulo: la usan el reporte UCA y el Replenishment, y ya
 * hubo que volver sobre las dos cuando cambio una regla.
 *
 * @param titulo   en mayusculas, arriba a la izquierda
 * @param tarjetas [{ rotulo, valor, color }] — las cifras que se suman, en fila
 * @param grande   { rotulo, valor, color } — el numero que se reporta
 * @param pie      texto chico abajo a la derecha (opcional)
 */
export function laminaResumen({ titulo, tarjetas, grande, pie }) {
  const ANCHO = 460, ALTO = 268;
  const FUENTE = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  /* Tan grande como entre en la pantalla, con dos candados: que entre ENTERA -si no, una
     captura sale cortada- y que no pase de 2,4 veces el diseno. Los 130 puntos que se
     restan del alto son los botones, el espacio entre medio y el margen. */
  const cabe = Math.min((window.innerWidth * 0.92) / ANCHO, (window.innerHeight - 130) / ALTO);
  const ZOOM = Math.max(1.25, Math.min(2.4, cabe));
  const ESCALA = escalaParaFoto(Math.max(ANCHO, ALTO), ZOOM);

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(ANCHO * ESCALA * ZOOM);
  lienzo.height = Math.round(ALTO * ESCALA * ZOOM);
  const g = lienzo.getContext('2d');
  g.scale(ESCALA * ZOOM, ESCALA * ZOOM);
  g.textBaseline = 'middle';

  /* Los colores salen del tema puesto: la lamina se ve como la pantalla de la que salio y
     no hay dos paletas que mantener. Pasados por paraFoto, que es lo que hace que WhatsApp
     no le ensucie el borde. */
  const col = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const FONDO = col('--panel-deeper') || '#0d1117';
  const CAJA = col('--panel-solid') || '#161b22';
  const LINEA = col('--border') || 'rgba(255,255,255,.1)';
  const FUERTE = paraFoto(col('--text-strong') || '#fff', CAJA, 0.16, 0.86);
  const SUAVE = paraFoto(col('--text-muted') || '#8b949e', CAJA, 0.34, 0.72);
  /* LAS CIFRAS VAN CON EL COLOR QUE LES PASAN, SIN TOCAR.
     Daniel, 28-ago-2026: *"ponle colores, pues: los quebrados en rojo, por quebrar en
     amarillo"*. Aca el color ES el dato -dice el estado de un vistazo-, no la decoracion de
     un numero que se lee. Es la misma decision que en el cuadro de asistencia: cuando el
     color significa algo, no se oscurece aunque el JPEG de WhatsApp lo trate peor.
     Los grises SI pasan por paraFoto: su borde ya vive en el brillo y no pierden nada. */
  const tinta = (c) => c || FUERTE;

  g.fillStyle = FONDO;
  g.fillRect(0, 0, ANCHO, ALTO);

  const texto = (t, x, y, tam, color, peso, alin) => {
    g.font = (peso || 400) + ' ' + tam + 'px ' + FUENTE;
    g.fillStyle = color;
    g.textAlign = alin || 'left';
    g.fillText(String(t), x, y);
  };
  const mil = (n) => Number(n || 0).toLocaleString('es-PE');

  texto(titulo, 24, 34, 15, FUERTE, 800);
  const ahora = new Date();
  texto(ahora.toLocaleDateString('es-PE') + '  ·  '
        + ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        24, 55, 11, SUAVE, 400);

  const cuantas = Math.max(1, tarjetas.length);
  const hueco = 8;
  const anchoT = (ANCHO - 48 - hueco * (cuantas - 1)) / cuantas;
  tarjetas.forEach((t, i) => {
    const x = 24 + i * (anchoT + hueco);
    g.fillStyle = CAJA;
    g.strokeStyle = LINEA;
    g.beginPath();
    g.roundRect(x, 74, anchoT, 66, 9);
    g.fill();
    g.stroke();
    texto(t.rotulo, x + anchoT / 2, 94, 10, SUAVE, 700, 'center');
    /* La cifra se encoge si no entra: con cuatro tarjetas y seis digitos se salia. */
    let tam = 24;
    const v = mil(t.valor);
    g.font = '800 ' + tam + 'px ' + FUENTE;
    while (tam > 12 && g.measureText(v).width > anchoT - 12) {
      tam -= 1;
      g.font = '800 ' + tam + 'px ' + FUENTE;
    }
    texto(v, x + anchoT / 2, 119, tam, tinta(t.color), 800, 'center');
  });

  g.fillStyle = CAJA;
  g.strokeStyle = LINEA;
  g.beginPath();
  g.roundRect(24, 152, ANCHO - 48, 84, 9);
  g.fill();
  g.stroke();
  texto(grande.rotulo, ANCHO / 2, 174, 11, SUAVE, 700, 'center');
  texto(mil(grande.valor), ANCHO / 2, 206, 40, tinta(grande.color), 800, 'center');

  if (pie) texto(pie, ANCHO - 24, 252, 10, SUAVE, 400, 'right');

  /* SE MUESTRA, NO SE DESCARGA: el 18-ago-2026 la descarga directa fallo -el navegador
     ignora el atributo `download` y el archivo cae sin extension-. Y tres salidas: el
     boton Cerrar, tocar fuera y la tecla Esc. */
  const fondo = document.createElement('div');
  fondo.style.cssText = 'position:fixed; inset:0; background:rgba(var(--shadow-rgb), 0.88); '
    + 'z-index:99999; display:flex; align-items:center; justify-content:center; padding:1.5rem; overflow:auto;';
  const caja = document.createElement('div');
  caja.style.cssText = 'display:flex; flex-direction:column; gap:0.8rem; align-items:flex-end; max-width:95vw;';
  lienzo.style.cssText = 'width:' + Math.round(ANCHO * ZOOM) + 'px; max-width:100%; height:auto; '
    + 'border-radius:10px; display:block; box-shadow:0 8px 40px rgba(var(--shadow-rgb), 0.6);';
  const ESTILO = 'padding:0.5rem 1.4rem; font-size:var(--t-sm); border-radius:8px; '
    + 'background:rgba(var(--ink-rgb), 0.08); color:var(--text-pale); font-weight:600; cursor:pointer; '
    + 'border:1px solid rgba(var(--ink-rgb), 0.18); font-family:inherit;';
  const copiar = botonCopiar(lienzo, ESTILO);
  const cerrar = document.createElement('button');
  cerrar.textContent = 'Cerrar';
  cerrar.style.cssText = ESTILO;
  const botones = document.createElement('div');
  botones.style.cssText = 'display:flex; gap:0.5rem;';
  botones.appendChild(copiar);
  botones.appendChild(cerrar);
  caja.appendChild(lienzo);
  caja.appendChild(botones);
  fondo.appendChild(caja);
  document.body.appendChild(fondo);

  const quitarEsc = cerrarConEsc(() => fondo.remove());
  const cerrarTodo = () => { quitarEsc(); fondo.remove(); };
  cerrar.onclick = cerrarTodo;
  fondo.onclick = (e) => { if (e.target === fondo) cerrarTodo(); };
  return lienzo;
}
