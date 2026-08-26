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
  config:      '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>'
};

/** Devuelve el <svg> listo para meter en el HTML. '' si el nombre no existe. */
export const icono = (nombre, tam = 17) => {
  const t = TRAZOS[nombre];
  if (!t) return '';
  return '<svg class="ic-svg" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" '
       + 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" '
       + 'stroke-linejoin="round" aria-hidden="true" focusable="false">' + t + '</svg>';
};

/** true si hay dibujo para ese nombre. */
export const hayIcono = (nombre) => !!TRAZOS[nombre];
