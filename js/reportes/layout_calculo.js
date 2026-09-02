/* ============================================================================
   EL MAPA DE CALOR — el cálculo, sin pantalla
   ----------------------------------------------------------------------------
   Acá vive lo que convierte el stock en el mapa: qué hay en cada cuerpo, de qué
   temporada, y cuánto está mal ubicado. Nada de esto dibuja: devuelve el mismo
   `payload` que hasta hoy armaba la pantalla y que se publica en
   `layout_activo_{zona}`.

   POR QUÉ SE SACÓ DE LA PANTALLA. Hasta esta entrega el mapa se calculaba como
   EFECTO de dibujarlo: `renderLayoutActivo` armaba el payload de paso y lo
   dejaba en `window.compartirLayoutPayload`. El botón "PUBLICAR TODAS" no tenía
   más remedio que recorrer las cuatro zonas dibujando cada una y subiendo lo que
   quedaba en memoria. Eso obliga a que alguien tenga la pantalla abierta, y es
   justo lo que un robot no puede hacer.

   Daniel, 23-ago-2026: *"quiero que el mapa de calor se actualice cada vez que
   se actualice el avance, cada hora, en automático"*.

   NO SE REESCRIBE EN PYTHON. El robot del picking ya resolvió este mismo
   problema: en vez de traducir el cálculo, abre la web publicada, importa el
   archivo de producción y llama a la misma función que llama la pantalla. Dos
   cálculos que tienen que dar igual siempre terminan separándose; ese precio ya
   se pagó una vez.

   POR ESO ESTE ARCHIVO NO TOCA EL DOM NI `window`. Su única dependencia es
   `zonasService`, que trae la grilla, los pasillos y la franja de cada columna.
   Quien lo use desde afuera tiene que llamar antes a `zonasService.cargarZonas()`.
   ============================================================================ */

import * as zonasService from '../services_v245/zonasService.js?v=29.0556';

/**
 * TRAER LAS ZONAS, DESDE ESTE MISMO ARCHIVO.
 *
 * Parece de más —`zonasService.cargarZonas()` es público— pero no lo es, y la trampa es
 * fea: los módulos se identifican por su URL COMPLETA, `?v=` incluido. Quien importe
 * `zonasService.js` sin la versión se lleva OTRA copia del módulo, con su propio estado, y
 * `cargarZonas()` llenaría esa copia mientras el cálculo sigue mirando la de fábrica.
 * El mapa saldría entero, sin un error a la vista, con la grilla y las franjas equivocadas.
 *
 * Reexportándola desde acá, quien use el cálculo carga las zonas en la instancia correcta
 * sin tener que saber nada de esto.
 */
export const cargarZonas = () => zonasService.cargarZonas();

/** Las temporadas que cuentan como ACTUAL. Todo lo demás es ANTERIOR. */
export const TEMPORADAS_ACTUALES = ['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', 'ACTUAL'];

/**
 * Los prefijos con los que una zona aparece escrita en la ubicación del WMS.
 *
 * El mezzanine se matricula de las dos formas —`MZN01-...` y `MZ1-...`—, así que
 * una zona puede tener más de un prefijo. Sirve para CUALQUIER zona: antes cada
 * una estaba escrita a mano y por eso el mezzanine 3 quedaba "en construcción",
 * cuando lo único que le faltaba era que alguna rama lo nombrara.
 */
export const prefijosDeZona = (zona) => {
  const z = String(zona || '').toUpperCase();
  const m = /^MZN(\d+)$/.exec(z);
  return m ? [z, 'MZ' + m[1]] : [z];
};

/**
 * Lee una columna por NOMBRE aproximado y, si no la encuentra, por POSICIÓN.
 *
 * El encabezado del reporte de Oracle cambia de acento y de mayúsculas según de
 * dónde se exporte, así que buscar solo por nombre deja el mapa vacío sin avisar.
 * Los `IDXn` son la red de abajo: la posición es contrato con el robot.
 */
export const getColSafe = (row, possibleNames) => {
  if (!row) return '';
  for (const key of Object.keys(row)) {
    const upperKey = key.toUpperCase().trim();
    if (possibleNames.some(name => upperKey.includes(name.toUpperCase()))) return String(row[key]);
  }
  const raw = Array.isArray(row) ? row : Object.values(row);
  for (const name of possibleNames) {
    if (name === 'IDX0') return String(raw[0] || '');
    if (name === 'IDX1') return String(raw[1] || '');
    if (name === 'IDX2') return String(raw[2] || '');
    if (name === 'IDX3') return String(raw[3] || '');
    if (name === 'IDX4') return String(raw[4] || '');
    if (name === 'IDX5') return String(raw[5] || '');
    if (name === 'IDX7') return String(raw[7] || '');
    if (name === 'IDX10') return String(raw[10] || '');
    if (name === 'IDX13') return String(raw[13] || '');
    if (name === 'IDX14') return String(raw[14] || '');
  }
  return '';
};

/**
 * Del Maestro salen dos cosas y nada más: la temporada de cada código y su
 * Gender RIMS. Se indexan por SKU completo y por padre de 7, porque el stock
 * trae el completo y las reglas se piensan por padre.
 *
 * La temporada se guarda por columna O (índice 14) con la N (13) de respaldo, y
 * gana la que diga ACTUAL: un padre con tallas de dos temporadas se considera
 * actual, que es como se mira en el piso.
 */
export const indexarMaestroLayout = (articulosRaw) => {
  const skuTemporada = {};
  const skuGender = {};

  const idxSku = 1;      // Columna B
  const idxGender = 3;   // Columna D
  const idxTemp = 14;    // Columna O

  (articulosRaw || []).forEach((row, i) => {
    if (i === 0 && Array.isArray(row) && String(row[0]).toUpperCase().includes('COD')) return;
    let sku = '', temp = '', gender = '';
    if (Array.isArray(row)) {
      sku = String(row[idxSku] || '').trim();
      temp = String(row[idxTemp] || row[13] || '').trim();
      gender = String(row[idxGender] || '').trim();
    } else {
      const rawValues = Object.values(row);
      sku = getColSafe(row, ['ARTICULO', 'ARTCULO', 'PRODUCTO', 'SKU', 'CODIGO']).trim();
      temp = getColSafe(row, ['TEMPORADA', 'SEASON']).trim() || String(rawValues[14] || rawValues[13] || '').trim();
      gender = getColSafe(row, ['GENDER RIMS', 'RIMS']).trim();
    }

    if (sku) {
      const sku7 = sku.substring(0, 7);
      const tUpper = temp ? temp.toUpperCase() : 'DESCONOCIDA';
      if (!skuTemporada[sku7] || !skuTemporada[sku7].includes('ACTUAL')) skuTemporada[sku7] = tUpper;
      if (!skuTemporada[sku] || !skuTemporada[sku].includes('ACTUAL')) skuTemporada[sku] = tUpper;

      if (!skuGender[sku7]) skuGender[sku7] = gender ? gender.toUpperCase() : '';
      if (!skuGender[sku]) skuGender[sku] = gender ? gender.toUpperCase() : '';
    }
  });

  return { skuTemporada, skuGender };
};

/**
 * CUÁNTO TIENE CADA PADRE EN TODO EL ACTIVO, sin mirar zona.
 *
 * De acá sale si un artículo es SALDO, y por eso se cuenta sobre el stock
 * ENTERO y no sobre la zona que se está dibujando: un código con 30 pares en el
 * selectivo y 300 en el mezzanine no es saldo, aunque en el selectivo lo parezca.
 */
export const stockPorPadre = (activoRaw) => {
  const padreStock = {};
  (activoRaw || []).forEach(row => {
    const ubi = getColSafe(row, ['UBICACI', 'LOCATION', 'UBI', 'IDX3']).trim().toUpperCase();
    const skuFull = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'ITEM', 'IDX1']).trim();
    const cant = parseFloat(getColSafe(row, ['CANTIDAD', 'QTY', 'STOCK', 'IDX5'])) || 0;
    if (!ubi || cant <= 0 || !skuFull) return;
    const sku7 = skuFull.substring(0, 7);
    padreStock[sku7] = (padreStock[sku7] || 0) + cant;
  });
  return padreStock;
};

/**
 * EL MAPA DE UNA ZONA.
 *
 * @param stock    filas del stock activo (las seis columnas del robot, o el CSV crudo)
 * @param maestro  filas del Maestro de Artículos
 * @param zona     'SEL' | 'MZN01' | 'MZN02' | 'MZN03' | 'MZN04'
 *
 * Devuelve `{ payload, layoutData, skuGender, padreStock }`. El `payload` es lo
 * que se publica y lo que la pantalla dibuja; los otros tres los usa la pantalla
 * para el globito y el depurador, y al robot no le sirven.
 *
 * Si falta el stock o falta el Maestro devuelve `payload: null`: un mapa vacío y
 * un mapa sin datos se ven igual, y publicar el primero borraría el bueno.
 */
export const procesarLayout = ({ stock, maestro, zona }) => {
  const { skuTemporada, skuGender } = indexarMaestroLayout(maestro);
  const layoutData = {};
  const stats = {
    'ACTUAL':   { units: 0, bad_placed: 0, padres: new Set() },
    'ANTERIOR': { units: 0, bad_placed: 0, padres: new Set() }
  };
  let totalUnits = 0;
  const uniquePadres = new Set();
  const padreStock = stockPorPadre(stock);

  if (!(stock || []).length || !(maestro || []).length) {
    return { payload: null, layoutData, skuGender, padreStock };
  }

  // La grilla, el paso del elevador, el corte de saldos y la temporada de cada columna
  // salen de Análisis SKU > Zonas de Almacenaje. Antes estaban escritos acá adentro.
  const zonasCfg = zonasService.zonasActual().zonas[zona]
    || { columnas: 24, cuerpos: 22, saldoMenorA: 80, franjas: {}, pasillos: [] };

  const prefijos = prefijosDeZona(zona);

  (stock || []).forEach(row => {
    const ubi = getColSafe(row, ['UBICACI', 'LOCATION', 'UBI', 'IDX3']).trim().toUpperCase();
    const skuFull = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'ITEM', 'IDX1']).trim();
    const cant = parseFloat(getColSafe(row, ['CANTIDAD', 'QTY', 'STOCK', 'IDX5'])) || 0;

    if (!ubi || cant <= 0 || !skuFull) return;
    if (!prefijos.some(p => ubi.startsWith(p))) return;

    const sku7 = skuFull.substring(0, 7);
    const totalStockForPadre = padreStock[sku7] || 0;
    const isSaldo = totalStockForPadre < zonasCfg.saldoMenorA;

    let col = 0;
    let rackRow = 0;
    {
      let ubiClean = ubi;
      prefijos.forEach(p => { ubiClean = ubiClean.split(p).join(''); });

      const numMatches = ubiClean.match(/\d+/g);
      if (numMatches) {
        const allNums = numMatches.join('');
        if (allNums.length >= 4) {
          col = parseInt(allNums.substring(0, 2), 10);
          rackRow = parseInt(allNums.substring(2, 4), 10);
        } else if (numMatches.length >= 2) {
          col = parseInt(numMatches[0], 10);
          rackRow = parseInt(numMatches[1], 10);
        }
      }
    }
    if (col === 0 || rackRow === 0) return;

    const maxCols = zonasCfg.columnas;
    if (!(col >= 1 && col <= maxCols && rackRow >= 1 && rackRow <= zonasCfg.cuerpos)) return;
    // Paso del elevador: ahí no hay ubicaciones de almacenaje
    if (zonasService.esPasillo(zona, col, rackRow)) return;

    if (!layoutData[col]) layoutData[col] = {};
    if (!layoutData[col][rackRow]) layoutData[col][rackRow] = { totalQty: 0, skus: [], seasons: {} };

    const cell = layoutData[col][rackRow];
    cell.totalQty += cant;

    const temporadaRaw = skuTemporada[sku7] || skuTemporada[skuFull] || 'DESCONOCIDA';
    const temporadaClean = TEMPORADAS_ACTUALES.some(act => temporadaRaw.includes(act))
      ? 'ACTUAL' : 'ANTERIOR';

    if (!cell.seasons[temporadaClean]) cell.seasons[temporadaClean] = 0;
    cell.seasons[temporadaClean] += cant;

    const existingSku = cell.skus.find(s => s.sku === skuFull);
    if (existingSku) existingSku.cant += cant;
    else cell.skus.push({ sku: skuFull, cant, temporada: temporadaClean === 'ACTUAL' ? 'T. Actual' : 'T. Anterior' });

    uniquePadres.add(sku7);
    totalUnits += cant;
    stats[temporadaClean].units += cant;
    stats[temporadaClean].padres.add(sku7);

    // Si está bien ubicado sale de Zonas de Almacenaje, no de acá: antes esto
    // estaba escrito a mano y mover una columna de temporada era editar código.
    // Las columnas de saldos aceptan las dos temporadas, pero solo si el
    // artículo es saldo; la de escolar solo mira que sea escolar.
    const genderRaw = skuGender[skuFull] || skuGender[sku7] || '';
    const isSchool = genderRaw.includes('SCHOOL');
    const franjaCol = zonasService.franjaDeColumna(zona, col);

    let isValid;
    if (!zonasCfg.franjas || !Object.keys(zonasCfg.franjas).length) {
      isValid = true;                       // zona sin reglas: no se acusa a nadie
    } else if (franjaCol === 'escolar')  isValid = isSchool;
    else if (franjaCol === 'saldos')     isValid = isSaldo;
    // LA COLUMNA DE CATÁLOGO ACEPTA TODO. Es la 8 del mezzanine 3: ahí va
    // entero lo que llega por el buffer D, de la marca que venga y de la
    // temporada que sea. Sin esta rama, sus 22 cuerpos salían acusados de
    // mal ubicados en cuanto se encendiera el mapa de MZN03.
    else if (franjaCol === 'catalogo')   isValid = true;
    else if (franjaCol === 'actual')     isValid = (temporadaClean === 'ACTUAL');
    else if (franjaCol === 'anterior')   isValid = (temporadaClean === 'ANTERIOR');
    else                                 isValid = false;   // columna sin uso

    if (!isValid) stats[temporadaClean].bad_placed += cant;
  });

  stats['ACTUAL'].padres = Array.from(stats['ACTUAL'].padres);
  stats['ANTERIOR'].padres = Array.from(stats['ANTERIOR'].padres);

  const payload = {
    type: 'processed',
    layoutData,
    stats,
    totalUnits,
    uniquePadresSize: uniquePadres.size
  };

  return { payload, layoutData, skuGender, padreStock };
};
