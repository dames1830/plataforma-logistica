/**
 * EL LAYOUT EN EXCEL: UNA PESTAÑA POR ZONA.
 *
 * Daniel, 18-sep-2026: *"quiero un excel para exportar, al exportar que en cada pestaña me
 * creé su layout: pestaña llamada SEL = ahí va el layout de SEL, pestaña llamada MZN01 = ahí
 * va el MZN01"*.
 *
 * Cada pestaña es el mapa de calor como sale en la pantalla, y NADA MÁS: las mismas columnas en
 * el mismo orden (el mezzanine va de la última a la primera), los cuerpos de arriba abajo, las
 * columnas bloqueadas, los pasos del elevador, los macizos que arrancan más arriba y la temporada
 * de cada columna en la tira de arriba. Adentro de cada casilla van los pares de esa ubicación.
 *
 * Daniel vio la maqueta —que traía también el resumen de la zona a la derecha y una pestaña
 * DETALLE con la lista de artículos— y marcó el mapa: *"solo quiero eso en el excel"*. La nota
 * de cada casilla se queda: dice la ubicación, las unidades y cuántos artículos tiene, como las
 * primeras líneas del globito de la pantalla. La lista entera no entra: la librería dibuja la
 * nota de un tamaño fijo (dos columnas por cuatro filas) y no deja cambiarlo.
 *
 * `zonas` es el zonasService de QUIEN LLAMA, ya cargado. No se importa acá a propósito: la web
 * lo importa con ?v= y el reporte público sin él, y cada URL es una copia distinta del módulo.
 * Una tercera copia importada acá estaría sin cargar y dibujaría las zonas de fábrica. Ver el
 * comentario de cargarZonas en layout_calculo.js.
 */

const argb = (hex) => 'FF' + String(hex).replace('#', '').toUpperCase();
const solido = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });

/* Los colores del mapa, los mismos de la pantalla. El vacío es el del reporte público: el
   Excel es claro y el gris oscuro de la web se leería como una casilla ocupada. */
const C = {
  actual: '#3b82f6', anterior: '#ef4444', vacio: '#EEE9E3',
  tinta: '#1C2B3A', gris: '#716A64', bloqueada: '#64748b', blanco: '#FFFFFF',
};
const MIXTO = {
  type: 'gradient', gradient: 'angle', degree: 45,
  stops: [{ position: 0, color: { argb: argb('#fbbf24') } }, { position: 1, color: { argb: argb('#ec4899') } }],
};
const RAYADO = { type: 'pattern', pattern: 'lightUp', fgColor: { argb: argb('#CFC8BE') }, bgColor: { argb: argb(C.blanco) } };
const SEPARA = { style: 'thin', color: { argb: argb(C.blanco) } };
const REJILLA = { top: SEPARA, left: SEPARA, bottom: SEPARA, right: SEPARA };

/** Igual que el título de la pantalla: "LAYOUT SEL - BATA". */
const marcaDelTitulo = (zona) => zona === 'MZN01' ? 'BG Y POWER' : (zona === 'MZN02' ? 'NORTH STAR' : 'BATA');

const dos = (n) => String(n).padStart(2, '0');

/** Las tres primeras líneas del globito de la pantalla. */
const notaDeCelda = (zona, col, cuerpo, celda) =>
  `${zona} ${dos(col)} - Cuerpo ${cuerpo}\nTotal Unid: ${celda.totalQty}\nSKUs: ${celda.skus.length}`;

/**
 * Una pestaña: el mapa de la zona.
 * mapa = { zona, payload, subtitulo }
 */
const hojaDeZona = (wb, Z, { zona, payload, subtitulo }, anterior) => {
  const cfg = Z.zonasActual().zonas[zona];
  const esMezz = /^MZN/.test(zona);
  const totalCols = cfg ? cfg.columnas : 14;
  const maxRows = cfg ? cfg.cuerpos : 22;
  const cols = [];
  if (esMezz) { for (let i = totalCols; i >= 1; i--) cols.push(i); } else { for (let i = 1; i <= totalCols; i++) cols.push(i); }
  const FR = Z.FRANJAS;
  const hayFranjas = !!(cfg && Object.keys(cfg.franjas || {}).length);
  const hayVariasMarcas = Z.marcasDeZona(zona).length > 1;
  const ld = payload.layoutData || {};

  const ws = wb.addWorksheet(zona, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
                 margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });

  // Las filas del dibujo.
  const R_TIT = 1, R_SUB = 2, R_LEY = 4, R_FRANJA = 6, R0 = 7;
  const R_NUM = R0 + maxRows, R_MARCA = R_NUM + 1;
  const filaDe = (cuerpoVisible) => R0 + (maxRows - cuerpoVisible);
  const colDe = (i) => 2 + i;                     // la A lleva el número de cuerpo

  // La bloqueada va angosta, como en la pantalla, pero con lugar para su número tachado.
  ws.getColumn(1).width = 4.5;
  cols.forEach((c, i) => {
    ws.getColumn(colDe(i)).width = Z.esColumnaBloqueada(zona, c) ? 3 : 7.2;
  });

  // Título y de cuándo es.
  const tit = ws.getCell(R_TIT, 2);
  tit.value = `LAYOUT ${zona} - ${marcaDelTitulo(zona)}${anterior ? ' · VERSIÓN ANTERIOR' : ''}`;
  tit.font = { bold: true, size: 15, color: { argb: argb(C.tinta) } };
  const sub = ws.getCell(R_SUB, 2);
  sub.value = subtitulo || '';
  sub.font = { size: 9, color: { argb: argb(C.gris) } };

  // La leyenda, como arriba del mapa. Va sobre columnas anchas: en el MZN02 caía una en las
  // bloqueadas y el rótulo quedaba apretado.
  const anchas = cols.map((c, i) => colDe(i)).filter((xc, i) => !Z.esColumnaBloqueada(zona, cols[i]));
  [['T. Anterior', solido(C.anterior)], ['T. Actual', solido(C.actual)],
   ['Mixto', MIXTO], ['Vacío', solido(C.vacio)]].forEach(([txt, fill], k) => {
    const cu = ws.getCell(R_LEY, anchas[k * 3] || 2 + k * 3);
    cu.fill = fill;
    cu.border = REJILLA;
    const et = ws.getCell(R_LEY, anchas[k * 3 + 1] || 3 + k * 3);
    et.value = txt;
    et.font = { bold: true, size: 9, color: { argb: argb('#4A4540') } };
  });
  ws.getRow(R_LEY).height = 14;

  // La tira de arriba: la temporada de cada columna.
  if (hayFranjas) {
    cols.forEach((c, i) => {
      const bloq = Z.esColumnaBloqueada(zona, c);
      const f = Z.franjaDeColumna(zona, c);
      const d = FR[f] || FR.ninguna;
      if (bloq || f === 'ninguna') return;
      const x = ws.getCell(R_FRANJA, colDe(i));
      x.value = d.corta;
      x.fill = solido(d.color);
      x.font = { bold: true, size: 7, color: { argb: argb(C.tinta) } };
      x.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      x.border = REJILLA;
    });
    ws.getRow(R_FRANJA).height = 13;
  }

  // Los números de cuerpo, a la izquierda.
  for (let r = maxRows; r >= 1; r--) {
    const x = ws.getCell(filaDe(r), 1);
    x.value = r;
    x.font = { bold: true, size: 8, color: { argb: argb(C.gris) } };
    x.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(filaDe(r)).height = 17;
  }

  // El mapa.
  cols.forEach((c, i) => {
    const xc = colDe(i);
    if (Z.esColumnaBloqueada(zona, c)) {
      for (let r = maxRows; r >= 1; r--) {
        const x = ws.getCell(filaDe(r), xc);
        x.fill = RAYADO;
        x.border = REJILLA;
      }
      // Número con formato 00, no texto: escrito como "05" Excel lo marca con el
      // triángulo verde de "número guardado como texto".
      const n = ws.getCell(R_NUM, xc);
      n.value = c;
      n.numFmt = '00';
      n.font = { bold: true, size: 7, strike: true, color: { argb: argb(C.bloqueada) } };
      n.alignment = { horizontal: 'center' };
      return;
    }
    // Los macizos arrancan más arriba: los cuerpos que le faltan a la columna van ABAJO,
    // así que el que se dibuja en la posición 4 es el cuerpo 1. Igual que la pantalla.
    const topeCol = cfg ? Z.cuerposDeColumna(zona, c) : maxRows;
    const faltanAbajo = Math.max(0, maxRows - topeCol);
    for (let r = maxRows; r >= 1; r--) {
      if (r <= faltanAbajo) continue;
      const cuerpo = r - faltanAbajo;
      if (cfg && Z.esPasillo(zona, c, cuerpo)) continue;
      const x = ws.getCell(filaDe(r), xc);
      x.border = REJILLA;
      x.alignment = { horizontal: 'center', vertical: 'middle' };
      const celda = ld[c] && ld[c][cuerpo];
      if (!celda) { x.fill = solido(C.vacio); continue; }
      const temporadas = Object.keys(celda.seasons || {});
      const mixto = temporadas.length > 1;
      x.fill = mixto ? MIXTO : solido(temporadas[0] === 'ACTUAL' ? C.actual : C.anterior);
      x.value = celda.totalQty;
      x.numFmt = '#,##0';
      x.font = { bold: true, size: 9, color: { argb: argb(mixto ? C.tinta : C.blanco) } };
      x.note = notaDeCelda(zona, c, cuerpo, celda);
    }
    const n = ws.getCell(R_NUM, xc);
    n.value = c;
    n.numFmt = '00';
    n.font = { bold: true, size: 10, color: { argb: argb(C.tinta) } };
    n.alignment = { horizontal: 'center' };
    if (hayVariasMarcas) {
      const d = Z.duenoDeColumna(zona, c);
      if (d) {
        const m = ws.getCell(R_MARCA, xc);
        m.value = d.sigla;
        m.fill = solido(d.color);
        m.font = { bold: true, size: 8, color: { argb: argb(C.blanco) } };
        m.alignment = { horizontal: 'center' };
        m.border = REJILLA;
      }
    }
  });

  const ultimaCol = colDe(cols.length - 1);
  ws.pageSetup.printArea = `A1:${ws.getColumn(ultimaCol).letter}${hayVariasMarcas ? R_MARCA : R_NUM}`;
  return ws;
};

/**
 * El libro entero. mapas = [{ zona, payload, subtitulo }], en el orden de las pestañas.
 * Las zonas sin mapa (sin payload o sin pares) no llevan pestaña.
 */
export const libroDelLayout = ({ zonas, mapas, anterior = false }) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LOGÍSTICA DEAM1830';
  wb.created = new Date();
  const conMapa = mapas.filter((m) => m && m.payload && m.payload.totalUnits > 0);
  conMapa.forEach((m) => hojaDeZona(wb, zonas, m, anterior));
  return wb;
};

/** Arma el libro y lo baja con ese nombre. Devuelve cuántas zonas llevó. */
export const descargarLayoutExcel = async ({ zonas, mapas, anterior = false, nombre }) => {
  const wb = libroDelLayout({ zonas, mapas, anterior });
  if (!wb.worksheets.length) return 0;
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return wb.worksheets.length;
};
