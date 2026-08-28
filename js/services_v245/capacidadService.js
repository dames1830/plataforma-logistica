/* ══════════════════════════════════════════════════════════════════════════════
 * CAPACIDAD: TODO LO QUE DECIDE CUANTA MERCADERIA AGUANTA EL PISO
 *
 * Daniel, 27-ago-2026: *"en almacenaje hay una configuracion de capacidad... esta
 * disperso ahorita por todo. Deberia haber un modulo nada mas para todo"*.
 *
 * Aca vive la CUENTA; el dibujo esta en la vista. Se separan a proposito: los numeros de
 * esta pantalla deciden cuanta mercaderia baja al piso, asi que tienen que poder
 * comprobarse solos, sin abrir la pantalla.
 *
 * SE RECALCULA SOLO. *"Yo quiero que eso se arme en automatico cada vez que carga el
 * stock"*. No guarda medidas propias: lee la foto que ya sube el robot y vuelve a medir.
 * Lo unico que se guarda es lo escrito a mano —los objetivos—, que viven en la
 * configuracion de siempre.
 *
 * LOS CINCO PASOS, en el orden en que se leen:
 *
 *   1. CUANTO ENTRA      el cubicaje: cuantos pares caben en un cuerpo, por tipo y rango
 *   2. DONDE VA          la marca manda la zona, y dentro de la zona sus columnas
 *   3. CUANTO BAJA       lo decide el CASO del articulo, no su marca
 *   4. COMO SE REPARTE   de 800 pares, cuantos a cada talla
 *   5. HASTA CUANTO      el tope, con sus dos techos: el cuerpo y el almacen entero
 * ══════════════════════════════════════════════════════════════════════════════ */

export const RANGOS = ['18-25', '26-30', '31-35', '36-39', '40-44', '45+'];
export const TALLAS_POR_RANGO = { '18-25': 8, '26-30': 5, '31-35': 5, '36-39': 4, '40-44': 5, '45+': 3 };
const ZONAS_PISO = ['SEL', 'MZN01', 'MZN02', 'MZN03'];
const CUERPOS_ZONA = { SEL: 284, MZN01: 408, MZN02: 271, MZN03: 480 };
const TIPOS = ['ZAPATO', 'DEPORTIVO', 'BOTA', 'SANDALIA'];

/* Los tres regimenes que NO toca la perilla: su numero lo puso Daniel y no se negocia. */
export const PARES_ESCOLAR = 50;
export const TODO_AL_PISO = ['Adidas', 'Puma', 'Skechers', 'Marie Claire'];
export const UN_CUERPO = ['Power', 'Weinbrenner', 'Bata Industrials'];

const RX_TALLA = /-([1-9])-([A-Z0-9.]+)$/i;
const RX_PREPACK = /^\d{7}-\d-\d{5}$/;
const NUM = /^\d+\.?\d*$/;

export function rangoDe(talla) {
  /* SOLO NUMEROS. `parseFloat('35A')` devuelve 35, y asi entraban 25 articulos con la
     talla escrita con letra —"35A", "9.5B"— a un rango que no les toca. Una talla que no
     es un numero no se puede ordenar, asi que no tiene rango. */
  const s = String(talla == null ? '' : talla).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  if (!isFinite(n) || n <= 0) return null;
  return n < 26 ? '18-25' : n < 31 ? '26-30' : n < 36 ? '31-35'
       : n < 40 ? '36-39' : n < 45 ? '40-44' : '45+';
}

/** El tipo sale del Maestro. Es lo que decide cuanto entra en un cuerpo. */
export function tipoDe(sub, cat) {
  const u = (String(sub || '') + ' ' + String(cat || '')).toUpperCase();
  if (!u.trim()) return null;
  if (u.includes('BOOT') || u.includes('BOTA') || u.includes('HEIGHT CUT')) return 'BOTA';
  if (u.includes('THONG') || u.includes('SANDAL') || u.includes('PLASTIC')) return 'SANDALIA';
  for (const p of ['SPORT', 'TENNIS', 'TRAINING', 'CANVAS', 'GYMNAST']) {
    if (u.includes(p)) return 'DEPORTIVO';
  }
  return 'ZAPATO';
}

/** La talla, de la descripcion. Es la misma que usa el resto de la plataforma. */
export function tallaDeDescripcion(d) {
  const t = String(d || '').trim();
  const m = RX_TALLA.exec(t);
  if (m) return m[2].trim();
  const p = t.split('-');
  if (p.length >= 3) {
    const pen = p[p.length - 2].trim();
    if (pen.length === 1 && pen >= '1' && pen <= '9') return p[p.length - 1].trim();
  }
  return null;
}

export const esPrepackSku = (s) => RX_PREPACK.test(String(s));

/* Lee una fila venga como objeto o como arreglo con cabecera. */
const dame = (fila, nombres, cab) => {
  for (const n of nombres) {
    if (fila && !Array.isArray(fila) && fila[n] !== undefined) return fila[n];
    if (cab && cab[n] !== undefined && Array.isArray(fila)) return fila[cab[n]];
  }
  return '';
};

/**
 * LA CUENTA ENTERA.
 *
 * @param config  la configuracion publicada (zonas, tallas, factoresRepl)
 * @param maestro el Maestro de articulos, con cabecera en la fila 0
 * @param activo  el stock del piso
 * @returns el mismo objeto que dibuja la pantalla
 */
export function calcularCapacidad(config, maestro, activo) {
  const C = config || {};
  const Z = C.zonas || {}, T = C.tallas || {};
  const dArt = Z.densidadArticulo || {};
  const dMT = Z.densidadMarcaTipo || {};
  const dTipo = Z.densidadTipo || {};
  const TOPES = ((C.factoresRepl || {}).marcaGeneroTalla) || {};

  /* ── La ficha de cada articulo: genero, marca y tipo ── */
  const filas = maestro || [];
  const cab = {};
  if (filas.length && Array.isArray(filas[0])) filas[0].forEach((n, i) => { cab[n] = i; });
  const ficha = new Map();
  for (let i = (Array.isArray(filas[0]) ? 1 : 0); i < filas.length; i++) {
    const a = filas[i];
    const cod = String(dame(a, ['CodArticulo', 'Cod Articulo', 'CODARTICULO'], cab) || '').trim();
    const s7 = cod.split('-')[0].slice(0, 7);
    const g = String(dame(a, ['Gender RIMS', 'GENDER RIMS'], cab) || '').trim();
    if (!s7 || ficha.has(s7) || !g || g === '-') continue;
    ficha.set(s7, {
      gen: g,
      marca: String(dame(a, ['Marcas', 'MARCAS', 'Marca'], cab) || '').trim() || 'SIN MARCA',
      tipo: tipoDe(dame(a, ['Subcategory RIMS'], cab), dame(a, ['Category RIMS'], cab))
    });
  }

  /* ── El piso: pares, cuerpos y el rango de cada articulo ── */
  const grupos = new Map();      // marca|genero|talla -> lo que hay abajo
  const cuerpos = new Map();     // ubicacion (3 tramos) -> pares y de quien son
  const rangoArt = new Map();    // articulo -> pares por rango

  for (const f of (activo || [])) {
    const zona = String(dame(f, ['Área', 'Area', 'AREA'], cab) || '').trim().toUpperCase();
    const sku = String(dame(f, ['Artículo', 'Articulo', 'SKU'], cab) || '').trim();
    const q = parseFloat(dame(f, ['Cantidad actual', 'Cantidad', 'CANTIDAD'], cab)) || 0;
    if (!sku || q <= 0 || esPrepackSku(sku)) continue;
    const s7 = sku.slice(0, 7);
    const fi = ficha.get(s7);
    const t = tallaDeDescripcion(dame(f, ['Descripción de artículo', 'Descripcion de articulo', 'DESCRIPCION'], cab));
    const r = t ? rangoDe(t) : null;
    if (r) {
      if (!rangoArt.has(s7)) rangoArt.set(s7, {});
      const rr = rangoArt.get(s7);
      rr[r] = (rr[r] || 0) + q;
    }
    if (!ZONAS_PISO.includes(zona) || !fi || !t) continue;
    const c = String(dame(f, ['Ubicación', 'Ubicacion', 'UBICACION'], cab) || '').split('-').slice(0, 3).join('-');
    if (!cuerpos.has(c)) cuerpos.set(c, { pares: 0, porSku: {}, zona: '' });
    const cu = cuerpos.get(c);
    cu.pares += q;
    cu.porSku[s7] = (cu.porSku[s7] || 0) + q;
    cu.zona = zona;
    const k = fi.marca.toUpperCase() + '|' + fi.gen.toUpperCase() + '|' + t;
    if (!grupos.has(k)) grupos.set(k, { skus: new Set(), piso: 0, tipos: {}, marca: '' });
    const g = grupos.get(k);
    g.skus.add(sku);
    g.piso += q;
    g.marca = fi.marca;
    if (fi.tipo) g.tipos[fi.tipo] = (g.tipos[fi.tipo] || 0) + q;
  }

  const mayorDe = (obj) => {
    let mk = null, mv = -Infinity;
    for (const k in obj) if (obj[k] > mv) { mv = obj[k]; mk = k; }
    return mk;
  };

  /* ══ PASO 1 · CUANTO ENTRA ════════════════════════════════════════════════
   * El cubicaje MEDIDO: la mediana de lo que el robot ya cubico, por tipo y rango. Con
   * menos de tres articulos no se da por medido: una sola medida no es una medida. */
  const med = new Map();
  for (const clave in dArt) {
    const cap = dArt[clave];
    if (!clave.includes('|') || !cap || cap <= 0) continue;
    const s7 = clave.split('|')[1].slice(0, 7);
    const fi = ficha.get(s7);
    const rr = rangoArt.get(s7);
    if (!fi || !fi.tipo || !rr) continue;
    const k = fi.tipo + '|' + mayorDe(rr);
    if (!med.has(k)) med.set(k, []);
    med.get(k).push(cap);
  }
  const medido = new Map();
  for (const tipo of TIPOS) {
    for (const r of RANGOS) {
      const v = (med.get(tipo + '|' + r) || []).slice().sort((a, b) => a - b);
      if (v.length >= 3) medido.set(tipo + '|' + r, { cap: v[Math.floor(v.length / 2)], n: v.length });
    }
  }

  /* LO QUE NO ESTA MEDIDO NO SE HEREDA DE UNA TABLA PLANA.
   *
   * Daniel, 27-ago-2026, mirando la columna 45+: *"le estas poniendo por defecto 500 a
   * zapatos, y eso esta mal"*. Tenia razon, y no era un casillero suelto: la tabla de
   * respaldo da UN numero por tipo sin mirar la talla, asi que los cinco casilleros sin
   * medir salian con el numero del zapato mas chico. Un 45 no puede entrar mas que un 42.
   *
   * Se estima bajando desde el vecino medido, con el encogimiento que muestran los propios
   * datos. Queda marcado como ESTIMADO para que se vea que a ese casillero le falta
   * cubicar. */
  const razones = [];
  for (const tipo of TIPOS) {
    for (let i = 0; i + 1 < RANGOS.length; i++) {
      const a = medido.get(tipo + '|' + RANGOS[i]), b = medido.get(tipo + '|' + RANGOS[i + 1]);
      if (a && b) razones.push(b.cap / a.cap);
    }
  }
  razones.sort((a, b) => a - b);
  const ENCOGE = razones.length ? razones[Math.floor(razones.length / 2)] : 0.8;

  const cubicaje = TIPOS.map((tipo) => {
    const fila = { tipo, rangos: {} };
    RANGOS.forEach((r, j) => {
      const m = medido.get(tipo + '|' + r);
      if (m) { fila.rangos[r] = { cap: m.cap, n: m.n, fuente: 'medido' }; return; }
      let mejor = null;
      RANGOS.forEach((rr, k) => {
        if (!medido.has(tipo + '|' + rr)) return;
        const d = Math.abs(j - k);
        if (!mejor || d < mejor.d) mejor = { d, k };
      });
      if (mejor) {
        fila.rangos[r] = {
          cap: Math.round(medido.get(tipo + '|' + RANGOS[mejor.k]).cap * Math.pow(ENCOGE, j - mejor.k)),
          n: 0, fuente: 'estimado', desde: RANGOS[mejor.k]
        };
      } else {
        fila.rangos[r] = { cap: null, n: 0, fuente: 'sin' };
      }
    });
    return fila;
  });
  const capMedida = {};
  cubicaje.forEach(f => RANGOS.forEach(r => { if (f.rangos[r].cap) capMedida[f.tipo + '|' + r] = f.rangos[r].cap; }));

  /** La misma escalera que usa el almacenaje: de lo mas fino a lo mas grueso. */
  const capDe = (marca, tipo, r) =>
    dMT[marca + '|' + tipo + '|' + r] || dMT[tipo + '|' + r]
    || capMedida[tipo + '|' + r] || dMT[marca + '|' + tipo] || dTipo[tipo] || null;

  /* ══ PASO 5 · HASTA CUANTO ════════════════════════════════════════════════
   * NO TODAS LAS FILAS SE REPARTEN. Se preguntan EN ESTE ORDEN y manda el primero:
   *
   *   TODO       Adidas, Puma, Skechers y Marie Claire. No tienen tope: lo que hay abajo
   *              no es una decision, es lo que llego. Y le gana al escolar.
   *   ESCOLAR    50 pares por talla, asi sea nuevo o reposicion.
   *   UN CUERPO  Power, Weinbrenner y Bata Industrials: el cuerpo entero.
   *   PERILLA    el resto. Se reparte lo que queda de piso. */
  const topes = [];
  let pide = 0, seLoPasan = 0, sinMedida = 0;
  for (const clave in TOPES) {
    const val = TOPES[clave];
    const p = clave.split('|');
    if (p.length !== 3) continue;
    const [marca, genero, talla] = p;
    const g = grupos.get(marca + '|' + genero + '|' + talla);
    if (!g) continue;
    const r = rangoDe(talla);
    const tipo = Object.keys(g.tipos).length ? mayorDe(g.tipos) : null;
    const cap = (r && tipo) ? capDe(g.marca, tipo, r) : null;
    const propone = cap ? Math.floor(cap / (TALLAS_POR_RANGO[r] || 4)) : null;
    const n = g.skus.size;
    pide += n * val;
    if (propone === null) sinMedida++;
    else if (val > propone) seLoPasan++;
    let regimen, fijo;
    if (TODO_AL_PISO.includes(g.marca)) { regimen = 'todo'; fijo = n ? Math.round(g.piso / n) : 0; }
    else if (genero.toUpperCase().includes('SCHOOL')) { regimen = 'escolar'; fijo = PARES_ESCOLAR; }
    else if (UN_CUERPO.includes(g.marca)) { regimen = 'un-cuerpo'; fijo = propone; }
    else { regimen = 'perilla'; fijo = null; }
    topes.push({ marca: g.marca, genero, talla, rango: r, tipo, skus: n,
                 piso: Math.round(g.piso), tuyo: val, propone, cap, regimen, fijo, clave });
  }

  /* ══ EL SEMAFORO: ¿aguanta el piso? ═══════════════════════════════════════
   * Es la pregunta que hoy no hace nadie. La de "¿entra en el cuerpo?" ya esta en el paso
   * 5; nadie mira si entra en el ALMACEN. */
  let hay = 0, capTotal = 0, libre = 0;
  cuerpos.forEach((v) => {
    hay += v.pares;
    const s7 = mayorDe(v.porSku);
    const fi = ficha.get(s7) || {};
    const rr = rangoArt.get(s7);
    const r = rr ? mayorDe(rr) : null;
    const cap = dArt[v.zona + '|' + s7] || capDe(fi.marca || '', fi.tipo, r) || 300;
    capTotal += cap;
    if (cap > v.pares) libre += cap - v.pares;
  });
  const capProm = capTotal / Math.max(1, cuerpos.size);
  const vacios = Math.max(0, Object.values(CUERPOS_ZONA).reduce((a, b) => a + b, 0) - cuerpos.size);
  const libreTot = libre + vacios * capProm;
  const falta = Math.max(0, pide - hay - libreTot);

  /* Los que ENTRAN primero y despues los que se pasan: se lee de arriba lo que esta bien. */
  const orden = (t) => [
    (t.propone !== null && t.tuyo <= t.propone) ? 1 : 0,
    t.marca, t.genero, NUM.test(t.talla) ? parseFloat(t.talla) : 0
  ];
  topes.sort((a, b) => {
    const x = orden(a), y = orden(b);
    for (let i = 0; i < x.length; i++) {
      if (x[i] < y[i]) return -1;
      if (x[i] > y[i]) return 1;
    }
    return 0;
  });

  const sinCubicar = {};
  RANGOS.forEach(r => {
    const s = new Set();
    rangoArt.forEach((rr, s7) => {
      if (mayorDe(rr) !== r) return;
      let cubicado = false;
      for (const k in dArt) if (k.endsWith('|' + s7)) { cubicado = true; break; }
      if (!cubicado) s.add(s7);
    });
    sinCubicar[r] = s.size;
  });

  return {
    semaforo: { hay: Math.round(hay), pide: Math.round(pide), libre: Math.round(libreTot),
                cuerpos: cuerpos.size, vacios, capProm: Math.round(capProm),
                falta: Math.round(falta), cuerposFalta: Math.round(falta / capProm) },
    cubicaje, rangos: RANGOS, tallasPorRango: TALLAS_POR_RANGO,
    zonasMarca: Z.marcas || {},
    cuantoBaja: T.marcas || {},
    encoge: Math.round(ENCOGE * 1000) / 1000,
    sinCubicar,
    /* LO QUE DE VERDAD DECIDE CUANTO BAJA. Sale de `casoDelItem`, no de la tabla por
       marca: se pregunta en este orden y el primero que da SI manda. */
    casos: [
      { n: 'Escolar', q: '50 pares de CADA talla', p: 'cualquier marca, así sea nuevo o reposición' },
      { n: 'Catálogo (buffer D)', q: 'todo', p: 'va al MZN03 columna 8' },
      { n: 'Bajó de reserva o lo pidió Replenishment', q: 'todo', p: 'vuelve a sus mismos cuerpos' },
      { n: 'No es calzado', q: 'todo', p: 'MZN04, sin cuerpo exacto' },
      { n: 'Adidas · Puma · Skechers', q: 'todo', p: 'la única fila de la tabla de marcas que todavía se lee' },
      { n: 'REPOSICIÓN — 20 pares o más en el almacén', q: 'se completa 1 cuerpo', p: 'activo + reserva, sin contar lo que llega' },
      { n: 'CÓDIGO NUEVO — menos de 20, o cero', q: 'baja el 60%', p: 'es lo que se vende en las dos primeras semanas' }
    ],
    tallasComerciales: T.categorias || {},
    topes,
    resumenTopes: {
      total: topes.length, pasan: seLoPasan, sinMedida,
      entran: topes.length - seLoPasan - sinMedida,
      todo: topes.filter(t => t.regimen === 'todo').length,
      escolar: topes.filter(t => t.regimen === 'escolar').length,
      unCuerpo: topes.filter(t => t.regimen === 'un-cuerpo').length,
      perilla: topes.filter(t => t.regimen === 'perilla').length
    },
    paresEscolar: PARES_ESCOLAR, unCuerpo: UN_CUERPO, todoAlPiso: TODO_AL_PISO
  };
}

/**
 * LA PERILLA. Cuanto pide el piso si los cuerpos se llenan al `pct`.
 *
 * Lo fijo NO se mueve: el escolar y las marcas de un cuerpo tienen su numero dado.
 */
export function pideConPerilla(D, pct) {
  const fijo = D.topes.reduce((a, t) =>
    a + (t.regimen === 'perilla' ? 0 : t.skus * (t.fijo || 0)), 0);
  return fijo + D.topes.reduce((a, t) => a + (t.regimen !== 'perilla' ? 0
    : t.skus * (t.propone === null ? t.tuyo : Math.max(1, Math.round(t.propone * pct / 100)))), 0);
}

/**
 * El porcentaje mas alto con el que TODAVIA ENTRA.
 *
 * Se prueba de verdad en vez de dividir: los objetivos se redondean y los que no tienen
 * medida se quedan como estan, asi que la division de servilleta se pasa por unos cientos
 * de pares y el semaforo quedaria rojo.
 */
export function perillaQueEntra(D, limite) {
  for (let p = 100; p > 1; p--) if (pideConPerilla(D, p) <= limite) return p;
  return 1;
}


/* ══════════════════════════════════════════════════════════════════════════════
 * LEER Y PUBLICAR LA CONFIGURACION
 *
 * La pantalla lo hace por su cuenta y no llamando al Analisis SKU: esa funcion vive
 * dentro de otra pantalla, a una profundidad que desde el ruteo no se alcanza —se
 * comprobo contando llaves antes de intentarlo—.
 * ══════════════════════════════════════════════════════════════════════════════ */

const URL_CONFIG = () =>
  (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com') + '/api/logistics/config';

export async function traerConfig() {
  const r = await fetch(URL_CONFIG() + '?t=' + Date.now());
  if (!r.ok) throw new Error('el servidor no contesto (' + r.status + ')');
  const cuerpo = await r.json();
  return (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
}

/**
 * Publica SOLO los objetivos.
 *
 * SE RELEE EL CAJON ENTERO ANTES DE ESCRIBIR y se reemplaza una sola clave. Mandar el
 * cajon que se leyo al abrir la pantalla borraria de un plumazo la jornada, las zonas y el
 * reparto por tallas si alguien los cambio mientras tanto. Es la misma regla que siguen
 * jornadaService y tallasService.
 */
export async function publicarTopes(nuevos) {
  const cajon = await traerConfig() || {};
  cajon.factoresRepl = cajon.factoresRepl || {};
  cajon.factoresRepl.marcaGeneroTalla = nuevos;
  const r = await fetch(URL_CONFIG(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cajon)
  });
  if (!r.ok) throw new Error('no se pudo guardar (' + r.status + ')');
  return true;
}
