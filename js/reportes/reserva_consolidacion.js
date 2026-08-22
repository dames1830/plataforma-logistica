/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LA CONSOLIDACIÓN DE RESERVA — el cálculo, fuera de la pantalla
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Vivía dentro de `dashboard_v28.js` y por eso solo lo podía correr el navegador con la
 * pantalla abierta. La consecuencia la vio Daniel el 22-ago-2026: la foto de cada día se
 * guardaba **cuando alguien entraba a Análisis Reserva**, así que un día que nadie abriera
 * la pantalla quedaba como un agujero en el calendario, y no se podía recuperar porque el
 * stock de ese día ya lo había pisado el del día siguiente.
 *
 * Ahora vive acá, suelto y sin depender de nada de la aplicación, para que el ROBOT del
 * ancla lo corra al terminar y guarde la foto solo. Es el mismo camino que ya usa el robot
 * del picking por hora con `picking.js`: **el robot no recalcula, corre el código de la
 * plataforma**. Si un día la regla cambia, cambia en un solo lado.
 *
 * NO IMPORTA NADA. Se puede cargar con un `import()` suelto, sin abrir la aplicación ni
 * iniciar sesión. Todo lo que necesita entra por parámetro.
 */

/* ── Las medidas del selectivo de reserva ─────────────────────────────── */
export const NIVELES_RESERVA = ['H', 'G', 'F', 'E', 'D'];
export const COLS_RESERVA = 12;
export const paletaDeReservaExiste = (col, cuerpo, nivel) => {
    if (col < 1 || col > COLS_RESERVA || cuerpo < 1 || cuerpo > 22) return false;
    if (cuerpo === 22 && col !== 1) return false;
    if (cuerpo === 11 && col !== 1 && (nivel === 'D' || nivel === 'E')) return false;
    return true;
};
/**
 * CUÁNTO CABE EN UNA PALETA DE RESERVA. Regla de Daniel, 19-ago-2026: *"si tiene más de
 * 160 unidades la paleta, consideremos que es una paleta llena"*.
 *
 * NO es el `paresPorPaleta` de Configuración —que dice 200 y sirve para OTRA cosa: para
 * calcular cuántas paletas y cuántos minutos lleva paletizar lo que sube—. Este número
 * mide lo que YA está arriba. Si algún día se juntan, que sea a propósito.
 *
 * Y vale solo para CALZADO: una paleta de bolsas trae 12.000 unidades y medirla contra
 * 160 diría que está al 7.500%.
 */

/* ── El padre sale del producto: `8054009-1-43` -> `8054009` ──────────── */
/**
 * EL INDICE DEL MAESTRO: `sku7 -> { familia, detalle }`.
 *
 * Lo usan los dos: la pantalla -desde `indexarMaestro`, que ademas arma otras cosas- y el
 * ROBOT, que corre este archivo suelto. Antes vivia solo dentro del dashboard y el robot no
 * tenia como armarlo sin copiar el codigo; copiado, el dia que cambie una columna una de las
 * dos copias queda mintiendo.
 *
 * `getCol` es opcional a proposito: la pantalla le pasa el suyo -que busca por NOMBRE de
 * columna- y el robot no le pasa nada, con lo que se lee por POSICION. Es exactamente el
 * mismo respaldo que ya tenia el codigo original (`|| raw[1]`).
 */
export const indicePorSku = (maestro, getCol) => {
    const leer = (row, nombres, pos) => {
        const raw = Array.isArray(row) ? row : Object.values(row);
        const v = getCol ? getCol(row, nombres) : null;
        return String(((v === null || v === undefined || v === '') ? raw[pos] : v) || '').trim();
    };
    const porSku = new Map();
    (maestro || []).forEach(row => {
        if (!row) return;
        const sku = leer(row, ['CodArticulo', 'SKU', 'Articulo'], 1).substring(0, 7);
        const fam = leer(row, ['G. Gender', 'G Gender', 'GENDER'], 2).toUpperCase();
        const det = leer(row, ['Gender RIMS', 'GENDERRIMS', 'GENDER_RIMS'], 3).toUpperCase();
        // La fila de titulos entra como una fila mas cuando el Excel llega como arreglos.
        if (fam.includes('GENDER') || det.includes('GENDER') || det.includes('RIMS')) return;
        if (sku && !porSku.has(sku)) porSku.set(sku, { familia: fam, detalle: det });
    });
    return porSku;
};

export const _padreDeProducto = (sku) => String(sku || '').trim().split('-')[0].trim().substring(0, 7);


/**
 * @param {Array}  filas  las filas del Stock Reserva
 * @param {Object} idx    el indice del Maestro: `{ porSku: Map<sku7, {familia, detalle}> }`.
 *                        Entra por parametro y no se lo pide a la aplicacion, que es lo que
 *                        permite que el robot lo corra sin abrir nada.
 */
export const consolidacionDeReserva = (filas, idx) => {
    if (!idx || !idx.porSku) return null;
    if (!idx || !idx.porSku || idx.porSku.size === 0) return null;
    const esCalzado = (padre) => {
        const m = idx.porSku.get(padre);
        return !!m && String(m.familia || '').trim() === 'FOOTWEAR';
    };

    // Una sola pasada: cada ubicación con lo que tiene encima, padre por padre.
    const ubis = new Map();
    (filas || []).forEach(row => {
        if (!row) return;
        if (!row.ES_ALTO && !String(row.NIVEL).toUpperCase().includes('AL')) return;
        const u = String(row.UBICACION || '').trim();
        if (!u.startsWith('SEL-')) return;
        const q = parseFloat(row.CANTIDAD) || 0;
        if (q <= 0) return;
        const p = _padreDeProducto(row.PRODUCTO);
        if (!p) return;
        let e = ubis.get(u);
        if (!e) { e = { padres: new Map(), lpn: String(row.LPN || '').trim(), tallas: new Map() }; ubis.set(u, e); }
        e.padres.set(p, (e.padres.get(p) || 0) + q);
        if (!e.lpn) e.lpn = String(row.LPN || '').trim();
        if (!e.tallas.has(p)) e.tallas.set(p, new Set());
        e.tallas.get(p).add(String(row.PRODUCTO || '').split('-').pop());
    });
    if (!ubis.size) return null;

    // Cada ubicación es del padre que más pares tiene.
    const porCol = new Map();
    const porPadre = new Map();
    ubis.forEach((e, u) => {
        const col = parseInt(u.split('-')[1], 10);
        if (!col) return;
        let dom = null, max = -1, total = 0;
        e.padres.forEach((q, p) => { total += q; if (q > max) { max = q; dom = p; } });
        let c = porCol.get(col);
        if (!c) { c = { ocupadas: 0, fw: 0, nofw: 0, pares: 0, hasta50: 0, de51a100: 0 }; porCol.set(col, c); }
        c.ocupadas++;
        if (!esCalzado(dom)) { c.nofw++; return; }
        c.fw++; c.pares += total;
        if (total <= 50) c.hasta50++;
        else if (total <= 100) c.de51a100++;
        let d = porPadre.get(dom);
        if (!d) { d = { ubic: [], tot: 0, cap: 0 }; porPadre.set(dom, d); }
        const mio = e.padres.get(dom);
        d.ubic.push({ u: u, col: col, lpn: e.lpn, p: Math.round(mio),
                      t: [...(e.tallas.get(dom) || [])].sort(),
                      ot: [...e.padres.keys()].filter(x => x !== dom) });
        d.tot += mio;
        if (mio > d.cap) d.cap = mio;
    });

    // Cuadro 1: la matriz, selectivo por selectivo.
    const matriz = [];
    for (let col = 1; col <= COLS_RESERVA; col++) {
        let existen = 0;
        for (let cuerpo = 1; cuerpo <= 22; cuerpo++) {
            NIVELES_RESERVA.forEach(nv => { if (paletaDeReservaExiste(col, cuerpo, nv)) existen += 2; });
        }
        const c = porCol.get(col) || { ocupadas: 0, fw: 0, nofw: 0, pares: 0, hasta50: 0, de51a100: 0 };
        matriz.push({ col: col, existen: existen, libres: existen - c.ocupadas,
                      pct: existen ? Math.round(100 * c.ocupadas / existen) : 0,
                      ocupadas: c.ocupadas, fw: c.fw, nofw: c.nofw, pares: c.pares,
                      hasta50: c.hasta50, de51a100: c.de51a100 });
    }

    // Cuadro 2: los padres, ordenados por lo que devuelven.
    const padres = [];
    porPadre.forEach((d, padre) => {
        if (d.ubic.length < 2 || d.cap <= 0) return;
        const quedan = Math.max(1, Math.ceil(d.tot / d.cap));
        const cols = {};
        d.ubic.forEach(x => { (cols[x.col] = cols[x.col] || []).push(x); });
        padres.push({ padre: padre, n: d.ubic.length, tot: Math.round(d.tot),
                      cap: Math.round(d.cap), quedan: quedan,
                      reduce: Math.max(0, d.ubic.length - quedan), cols: cols });
    });
    padres.sort((a, b) => (b.reduce - a.reduce) || (b.n - a.n));
    /* LOS FRAGMENTADOS — el tercer cuadro. Los mismos padres, ordenados por UBICACIONES en
     * vez de por lo que devuelven, y SOLO los que de verdad se pueden reducir.
     *
     * Daniel, 22-ago-2026: *"no me pongas articulos que no puedes reducir. En el comite voy
     * a decir son treinta articulos que se pueden reducir, y me va a decir: que vas a reducir
     * de este si me pones cero"*. Una fila con reduccion cero no es informacion, es una
     * objecion servida.
     *
     * EL ACUMULADO SE CALCULA SOBRE TODOS los que reducen y recien despues se cortan 30: si
     * se calculara sobre los 30, la linea llegaria al 100% en el ultimo y diria que con esos
     * treinta se resuelve todo. Medido el 21-ago: los 30 primeros liberan 183 de 489.
     *
     * Va sin `cols` a proposito -esa es la que trae todas las ubicaciones una por una-:
     * este cuadro no las necesita y la foto que se guarda cada dia tiene que seguir siendo
     * chica. Ver fotoChicaDeReserva. */
    const conReduce = padres.filter(p => p.reduce > 0)
                            .sort((a, b) => (b.n - a.n) || (b.tot - a.tot));
    const ubicFrag = conReduce.reduce((s, p) => s + p.n, 0);
    let acum = 0;
    const fragmentados = conReduce.map(p => {
        acum += p.n;
        return { padre: p.padre, n: p.n, tot: p.tot, cap: p.cap, quedan: p.quedan,
                 reduce: p.reduce, sel: Object.keys(p.cols).length,
                 g: (idx.porSku.get(p.padre) || {}).detalle || '',
                 ac: ubicFrag ? Math.round(1000 * acum / ubicFrag) / 10 : 0 };
    }).slice(0, 30);

    return { matriz: matriz, padres: padres.slice(0, 15), totalPadres: padres.length,
             fragmentados: fragmentados, fragTotal: conReduce.length, fragUbic: ubicFrag };
};


/**
 * DE QUE DIA ES LA FOTO QUE HAY AHORA MISMO EN LA RESERVA.
 *
 * Se guarda UNA sola foto por dia, la del ancla de la NOCHE. Regla de Daniel, 21-ago-2026:
 * *"en la mañana no quiero que se actualice, solo en la noche nada mas"*.
 *
 * LA HORA NO ESTA ESCRITA ACA. Entra por parametro desde Configuracion -> Parametros
 * (`ancla_noche`), que es
 * donde Daniel la cambia: *"la cosa es que siempre tiene que mirar a la hora de la interfaz.
 * No es una hora fija, porque yo lo puedo cambiar"*. Si la mueve a las 20:00, esto la sigue
 * sin tocar una linea. Si apaga el dia en los checks, ese dia no hay foto y el calendario
 * lo muestra vacio, que es la verdad.
 *
 * Antes del ancla, lo que hay cargado sigue siendo la foto de ANOCHE: por eso el dia
 * retrocede uno. Devuelve null si hoy no toca ancla de noche.
 */
export const selloDeLaFoto = (ahora, anclaNoche) => {
    const noche = anclaNoche || {};
    if (noche.activa === false) return null;
    const hhmm = String(noche.hora || '19:00');
    const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const corte = (parseInt(m[1], 10) * 60) + parseInt(m[2], 10);
    const ref = ahora instanceof Date ? ahora : new Date();
    const ahoraMin = (ref.getHours() * 60) + ref.getMinutes();
    const dia = new Date(ref);
    if (ahoraMin < corte) dia.setDate(dia.getDate() - 1);
    const dd = (n) => String(n).padStart(2, '0');
    const fecha = `${dia.getFullYear()}-${dd(dia.getMonth() + 1)}-${dd(dia.getDate())}`;
    // Los dias apagados en los checks no tienen ancla, asi que no tienen foto.
    const clave = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'][dia.getDay()];
    if (noche.dias && noche.dias[clave] === false) return null;
    return { fecha, hora: hhmm };
};

export const fotoChicaDeReserva = (datos, sello) => (!datos || !sello) ? null : ({
    fecha: sello.fecha, hora: sello.hora,
    matriz: datos.matriz, padres: datos.padres, totalPadres: datos.totalPadres,
    // Los 30 fragmentados van sin sus ubicaciones una por una, asi que la foto sigue chica.
    fragmentados: datos.fragmentados, fragTotal: datos.fragTotal, fragUbic: datos.fragUbic
});

