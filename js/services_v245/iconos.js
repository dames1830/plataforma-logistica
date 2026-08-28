/**
 * LOS ICONOS DEL MENU
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Dibujos propios en SVG, de un solo trazo, del color que hereden.
 *
 * POR QUE NO EMOJI
 *   Habia 877 emoji haciendo de icono. Tres problemas, todos reales:
 *
 *   1. Se ven distinto en cada version de Windows. El mismo menu no es el mismo
 *      menu en dos PC del almacen.
 *   2. NO SE PUEDEN TEÑIR: el emoji trae sus colores metidos. Por eso en el tema
 *      negro hubo que apagarlos con un filtro de escala de grises, que es un
 *      parche, no una solucion.
 *   3. Habia 24 botones que eran solo un emoji, sin etiqueta: nadie sabe que
 *      hacen sin probarlos.
 *
 *   Un SVG con `stroke: currentColor` toma el color del texto que lo rodea, asi
 *   que sigue el tema solo, sin filtros y sin excepciones.
 *
 * COMO SE USA
 *     import { icono } from './iconos.js';
 *     `<a class="nav-item">${icono('almacenaje')} Almacenaje</a>`
 *
 * Si se pide un nombre que no existe devuelve '' -no un cuadro roto-, asi que
 * una pestaña nueva sin icono se ve sin icono y nada mas.
 */

const TRAZOS = {
  inicio:      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-5h5v5"/>',
  inventario:  '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  descargas:   '<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5L16.5 10"/><path d="M4 20h16"/>',
  picking:     '<path d="M3 5h2l2.2 10.5h10.3"/><path d="m6 8h13l-1.4 6H7.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  packing:     '<path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z"/><path d="M3 8.5 12 13l9-4.5"/><path d="M12 13v7"/>',
  despacho:    '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  no_retail:   '<path d="M4 9h16v11H4z"/><path d="M4 9 6 4h12l2 5"/><path d="M9 20v-6h6v6"/>',
  recepcion:   '<path d="M12 21V10"/><path d="m7.5 14 4.5-4.5L16.5 14"/><path d="M4 4h16"/>',
  almacenaje:  '<path d="M3 21V9l9-5 9 5v12"/><path d="M3 13h18M3 17h18"/><path d="M9 21V9M15 21V9"/>',
  slotting:    '<rect x="3" y="3" width="7.5" height="7.5" rx="1.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2"/><path d="M17.25 13.5v7.5M13.5 17.25h7.5"/>',
  buffer:      '<path d="M6 3h12"/><path d="M6 21h12"/><path d="M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9"/><path d="M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9"/>',
  analisis_sku:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  admin_pers:  '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16 19c0-2.4 1.6-4 3.5-4"/>',
  /* LA HOJA CON LA ESQUINA DOBLADA. Es el modelo que eligio Daniel -26-ago-2026,
     "este modelo me gusta, solo debes poner en blanco la X y PDF letra"- y va
     igual en TODA la plataforma: "todos deben ser asi".

     LA MARCA VA EN BLANCO FIJO. Antes salia de var(--text-strong), que en los
     temas claros es casi negro: quedaba una X negra sobre verde y un PDF negro
     sobre rojo, y no se leian. Ahora es #FFFFFF y no depende del tema.

     LOS TONOS TAMPOCO SIGUEN AL TEMA, a proposito: el Excel se reconoce por su
     verde y el PDF por su rojo. Si cambiaran de tono en cada tema dejarian de
     leerse de un vistazo. Medidos contra los cuatro fondos y contra la marca
     blanca de encima -el minimo de un dibujo es 3:1-:

       hoja Excel #21A366  3,23 blanco | 6,12 negro | 5,52 indigo | 3,23 la X
       hoja PDF   #E0473F  4,08 blanco | 4,85 negro | 4,37 indigo | 4,08 letra

     El doblez es un tono mas oscuro de la misma hoja: da el relieve y tambien
     se despega de los cuatro fondos -lo peor, 3,03:1-. */
  excel:       '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#21A366" stroke="none"/>'
             + '<path d="M14 2v6h6" fill="#17794A" stroke="none"/>'
             + '<path d="M8.6 11.6h1.7l1.2 2 1.2-2h1.7l-2 3.1 2.1 3.2h-1.7l-1.3-2.1-1.3 2.1H8.5l2.1-3.2-2-3.1z" fill="#FFFFFF" stroke="none"/>',
  pdf:         '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#E0473F" stroke="none"/>'
             + '<path d="M14 2v6h6" fill="#B33A33" stroke="none"/>'
             + '<text x="12.5" y="17.6" font-family="Arial,Helvetica,sans-serif" font-size="7" '
             + 'font-weight="bold" fill="#FFFFFF" stroke="none" text-anchor="middle">PDF</text>',
  /* La tarjeta para compartir: no es un documento, asi que no lleva hoja. Mismo
     criterio igual -color fijo y la marca en blanco-. #0E8FA8 da 3,81 sobre
     blanco, 5,20 sobre negro y 4,69 sobre el indigo. */
  tarjeta:     '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.6" fill="#0E8FA8" stroke="none"/>'
             + '<circle cx="9" cy="12" r="2.7" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>'
             + '<path d="M14 9.6h4M14 12h4M14 14.4h2.6" stroke="#FFFFFF" stroke-width="1.5"/>',
  imprimir:    '<path d="M7 8V3.5h10V8"/><rect x="4" y="8" width="16" height="7.5" rx="1.5"/><path d="M7 14h10v6.5H7z"/>',
  wms:         '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  /* Los de las filas: refrescar, editar, borrar, guardar y cerrar. */
  refrescar:   '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5V10H14"/>',
  editar:      '<path d="M4 20h4.2L19.6 8.6a2.2 2.2 0 0 0-3.1-3.1L5 17v3z"/><path d="m14.8 6.7 3.1 3.1"/>',
  borrar:      '<path d="M4 7h16"/><path d="M10 4h4"/><path d="M6.6 7 7.6 20.2h8.8L17.4 7"/><path d="M10.4 10.6v6M13.6 10.6v6"/>',
  guardar:     '<path d="M5 3h11l3.5 3.5V21H5z"/><path d="M8.5 3v5.5h6.5V3"/><path d="M8.5 21v-6.5h7V21"/>',
  cerrar:      '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  /* El candado, en sus dos estados. Mismo cuerpo, lo unico que cambia es el arco:
     cerrado baja a los dos lados; abierto solo a la izquierda y se levanta. */
  candado:     '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/>'
             + '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.7" r="1.3"/>',
  candado_abierto: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/>'
             + '<path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/><circle cx="12" cy="15.7" r="1.3"/>',
  config:      '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>'
};

/* EL COLOR DE LOS DIBUJOS DE ACCION.
   Los del menu siguen al tema -toman `currentColor`- porque acompanan a un
   texto y tienen que pesar lo mismo que el. Los de accion NO: van a un boton
   sin nombre, y ahi el color es la mitad de lo que dice que hace el boton.
   Por eso llevan un color fijo, el mismo en los cuatro temas, igual que el
   de Excel.

   CADA UNO SE ELIGIO MIDIENDO, no a ojo: el mismo color tiene que despegarse
   del blanco de los temas claros Y del negro del tema oscuro. Eso deja una
   franja estrecha de tonos medios. Los de aca dan, en el peor de sus fondos:

     imprimir 3,63:1 | wms 3,63:1 | refrescar 3,45:1 | editar 3,25:1
     borrar   4,00:1 | guardar 3,61:1 | cerrar 3,75:1 | excel 3,23:1

   El minimo de un dibujo es 3:1. Un tono mas claro se pierde sobre blanco y
   uno mas oscuro se pierde sobre negro: no hay margen para subirlos. */
const COLORES = {
  imprimir:  '#3B82F6',
  wms:       '#D2691E',
  refrescar: '#2563EB',
  editar:    '#B8860B',
  borrar:    '#E04A4A',
  guardar:   '#0E7C86',
  cerrar:    '#64748B'
};

/** Devuelve el <svg> listo para meter en el HTML. '' si el nombre no existe. */
export const icono = (nombre, tam = 17) => {
  const t = TRAZOS[nombre];
  if (!t) return '';
  // El de Excel trae sus colores dentro del propio dibujo -cuadro verde y X
  // blanca-, asi que no toca el trazo de afuera.
  const trazo = COLORES[nombre] || 'currentColor';
  return '<svg class="ic-svg" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" '
       + 'fill="none" stroke="' + trazo + '" stroke-width="1.7" stroke-linecap="round" '
       + 'stroke-linejoin="round" aria-hidden="true" focusable="false">' + t + '</svg>';
};

/** true si hay dibujo para ese nombre. */
export const hayIcono = (nombre) => !!TRAZOS[nombre];
