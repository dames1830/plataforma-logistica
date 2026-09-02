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
/* LA TALLA SALE DE LA DESCRIPCION, NO DEL SKU. `8054009-1-07` no es la talla 07: es la
 * 43. El ultimo tramo del SKU es un indice, y la talla de verdad viene al final de la
 * descripcion -`...BATA INDUSTRIALS-1-43`-. Se usa `extractTalla`, que es la que ya
 * resuelve esto en toda la plataforma; escribir otra aca seria tener dos verdades. */
import { extractTalla } from '../services_v245/csvHub_v6.js?v=29.0522';

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
        /* SI NO SE PUEDE SACAR LA TALLA, NO SE INVENTA. Hay SKU con codigo de variante de
           cinco digitos -`5892371-1-10085`- cuya descripcion no trae la talla en ningun
           lado: son 6 de unas 570 lineas. Poner el codigo del SKU en su lugar llenaba la
           columna con "10085" y "08093" con cara de talla. Mejor vacio: un dato que no
           esta se ve, uno inventado no. */
        const ta = extractTalla(row.DESCRIPCION);
        if (ta) e.tallas.get(p).add(ta);
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
        /* `ubic` es el detalle para IR A BUSCARLAS: ubicacion, selectivo, LPN de la
           paleta, pares, tallas, y con quien comparte sitio. Va ORDENADO DE MENOR A
             MAYOR, porque consolidar es mover las paletas mas flacas a las mas llenas:
           las primeras `reduce` son las que hay que bajar.
           NO se guarda en la foto del dia -ver fotoChicaDeReserva-: son ~570 filas y
           triplicarian el peso del historico. Sirve para el Excel del dia. */
        const ubic = Object.keys(p.cols).reduce((a, c) => a.concat(p.cols[c]), [])
                           .sort((x, y) => x.p - y.p);
        return { padre: p.padre, n: p.n, tot: p.tot, cap: p.cap, quedan: p.quedan,
                 reduce: p.reduce, sel: Object.keys(p.cols).length,
                 g: (idx.porSku.get(p.padre) || {}).detalle || '',
                 ac: ubicFrag ? Math.round(1000 * acum / ubicFrag) / 10 : 0,
                 ubic: ubic };
    }).slice(0, 30);

    /* `padresTodos` es la lista COMPLETA en tres numeros -padre, ubicaciones, reduce-, para
       poder buscar CUALQUIERA por su codigo. La necesita el cierre del turno: a las 07:00 hay
       que medir los MISMOS 30 padres que se guardaron a las 19:20, y esos no son los 30
       primeros de la mañana. Son ~353 filas de tres numeros; no se guarda en la foto. */
    return { matriz: matriz, padres: padres.slice(0, 15), totalPadres: padres.length,
             fragmentados: fragmentados, fragTotal: conReduce.length, fragUbic: ubicFrag,
             padresTodos: padres.map(p => [p.padre, p.n, p.reduce]) };
};


/**
 * DE CUANDO ES LA FOTO QUE HAY AHORA MISMO EN LA RESERVA.
 *
 * LOS DOS CORTES CUENTAN: el ancla de la NOCHE y el de la MAÑANA. Daniel, 28-ago-2026:
 * *"quiero que ese reporte se actualice tambien con el stock ancla de las siete de la
 * mañana [...] que el dia de hoy se actualice solamente por hoy dia a estas horas"*.
 *
 * Cambia una regla suya anterior -21-ago-2026: *"en la mañana no quiero que se actualice,
 * solo en la noche nada mas"*-. El motivo del cambio: a media mañana el reporte mostraba
 * el dia ANTERIOR, porque hasta las 19:00 el sello no avanzaba. Con el ancla de las 07:00
 * ya publicando stock, esperar doce horas para ver el numero de hoy no tenia sentido.
 *
 * QUEDA UNA SOLA FOTO POR DIA, no dos. La de la mañana ocupa el dia hasta que la noche la
 * reemplaza, asi que los dias pasados siguen siendo la foto de la noche -que es el
 * compromiso- y solo el dia en curso muestra el corte de la mañana. La `hora` que devuelve
 * dice cual de los dos se esta viendo, y por eso quien busca una foto guardada de HOY tiene
 * que comparar fecha Y hora: si no, a las 19:00 encontraria la de la mañana y no se
 * actualizaria nunca.
 *
 * LAS HORAS NO ESTAN ESCRITAS ACA. Entran por parametro desde Configuracion -> Parametros
 * (`ancla_noche` y `ancla_manana`), que es donde Daniel las cambia: *"la cosa es que
 * siempre tiene que mirar a la hora de la interfaz. No es una hora fija, porque yo lo puedo
 * cambiar"*. Si mueve una a las 20:00, esto la sigue sin tocar una linea, y un dia apagado
 * en los checks no tiene foto -que es la verdad-.
 *
 * Llamarla con un solo ancla sigue funcionando igual que antes.
 */
export const selloDeLaFoto = (ahora, anclaNoche, anclaManana) => {
    const ref = ahora instanceof Date ? ahora : new Date();
    const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    const dd = (n) => String(n).padStart(2, '0');

    // Los cortes que publican stock, del mas tarde al mas temprano: asi, al mirar un dia,
    // el primero que calce es el ultimo que corrio.
    const cortes = [];
    [anclaNoche, anclaManana].forEach((a) => {
        const c = a || {};
        if (!a || c.activa === false) return;
        const m = String(c.hora || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return;
        cortes.push({ min: (parseInt(m[1], 10) * 60) + parseInt(m[2], 10),
                      hora: String(c.hora), dias: c.dias });
    });
    if (!cortes.length) return null;
    cortes.sort((a, b) => b.min - a.min);

    /* Se camina hacia atras dia por dia hasta dar con un corte que ya paso y cuyo dia este
       encendido. Ocho dias de margen: con la semana entera apagada no hay foto y punto,
       pero una semana con dias sueltos apagados -el domingo- si tiene que encontrarla. */
    const ahoraMin = (ref.getHours() * 60) + ref.getMinutes();
    for (let atras = 0; atras < 8; atras++) {
        const dia = new Date(ref);
        dia.setDate(dia.getDate() - atras);
        const clave = DIAS[dia.getDay()];
        for (let i = 0; i < cortes.length; i++) {
            const c = cortes[i];
            if (atras === 0 && c.min > ahoraMin) continue;   // hoy, pero todavia no llego
            if (c.dias && c.dias[clave] === false) continue; // ese dia no corre
            return { fecha: `${dia.getFullYear()}-${dd(dia.getMonth() + 1)}-${dd(dia.getDate())}`,
                     hora: c.hora };
        }
    }
    return null;
};

/**
 * EL CIERRE DEL TURNO NOCHE — cuanto se consolido de verdad.
 *
 * Idea de Daniel, 22-ago-2026: *"tu meta es el stock ancla de la noche y tu avance es el
 * stock ancla del dia siguiente, de las siete de la mañana"*. Y tiene razon: entre las 19:20
 * y las 07:00 el almacen **no recibe mercaderia**, asi que lo que baje en ese rato es trabajo
 * del turno. Comparar un dia contra otro no sirve: ahi el numero tambien sube cuando llega
 * importacion y se acomoda fragmentada, y el avance iria para atras sin que nadie hiciera
 * nada mal.
 *
 * SE MIDEN LOS MISMOS PADRES, no los 30 de la mañana. Si un articulo se consolido bien, a
 * las 07:00 ya no esta entre los mas fragmentados —justamente porque se arreglo— y medir la
 * lista nueva diria que no paso nada.
 *
 * UN PADRE QUE YA NO FIGURA quedo con una sola ubicacion o sin nada que reducir: cuenta como
 * `reduce` cero, que es la verdad.
 *
 * @param {Array} guardados  los `fragmentados` de la foto de las 19:20
 * @param {Array} deAhora    el `padresTodos` de la corrida de las 07:00
 */
export const cierreDeFragmentados = (guardados, deAhora) => {
    if (!Array.isArray(guardados) || !guardados.length) return null;
    const mapa = new Map((deAhora || []).map(x => [x[0], { n: x[1], reduce: x[2] }]));
    let ubic = 0, reduce = 0, siguen = 0;
    guardados.forEach(g => {
        const h = mapa.get(g.padre);
        // Sin rastro: quedo en una sola ubicacion. Una, no cero: el articulo sigue existiendo.
        ubic += h ? h.n : 1;
        reduce += h ? h.reduce : 0;
        if (h && h.reduce > 0) siguen++;
    });
    return { ubic: ubic, reduce: reduce, arts: siguen };
};

export const fotoChicaDeReserva = (datos, sello) => (!datos || !sello) ? null : ({
    fecha: sello.fecha, hora: sello.hora,
    matriz: datos.matriz, padres: datos.padres, totalPadres: datos.totalPadres,
    // Los 30 fragmentados van SIN su detalle de ubicaciones -son ~570 filas y triplicarian
    // el peso-, asi que la foto del dia sigue chica. El detalle solo existe para el dia que
    // se esta mirando en vivo, que es cuando sirve para ir a mover paletas.
    fragmentados: (datos.fragmentados || []).map(({ ubic, ...resto }) => resto),
    fragTotal: datos.fragTotal, fragUbic: datos.fragUbic
});


/* ══════════════════════════════════════════════════════════════════════════════
 * EL PLAN DE CONSOLIDACIÓN — qué paleta va a qué paleta
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * `consolidacionDeReserva` dice CUÁNTAS ubicaciones se pueden reducir. Esto dice CÓMO:
 * de qué paleta bajar, en cuál echarla y con cuánto queda.
 *
 * Daniel, 23-ago-2026: *"dime de qué paleta tengo que bajar, a qué paleta le tengo que
 * poner para completar la paleta llena. Quiero que tú me detalles todo el movimiento que
 * tiene que hacer el operario para yo solamente descargar el Excel"*.
 *
 * LAS CUATRO REGLAS, todas medidas contra la reserva real antes de escribirlas:
 *
 * 1. SOLID Y PREPACK SON DOS LÍNEAS DISTINTAS DEL MISMO ARTÍCULO y se consolidan por
 *    separado. El 5898406 tiene 8 paletas de solid con tallas 35 a 40 y 10 de prepack: son
 *    la misma referencia y no se tocan entre sí. El prepack se reconoce por la forma del
 *    código —7 dígitos, guion, 1 dígito, guion, CINCO dígitos—; ese sufijo no es una talla,
 *    es el código del pack. Medido: de 2.391 paletas, NINGUNA mezcla las dos cosas. Si
 *    alguna vez aparece una, es un error de quien matriculó y sale marcada.
 *
 * 2. LA PALETA BAJA ENTERA SI CABE ENTERA; SI NO, SE PARTE. El viaje único era la regla
 *    original, pero el 24-ago-2026 Daniel comprometió 183 ubicaciones ante el comité y la
 *    medición mostró que con viaje único solo se alcanzaban 110: una paleta que no entra
 *    en ningún hueco no se libera jamás, aunque el comité la cuente. Partiendo llega a 154.
 *    De 198 paletas, 154 siguen siendo de un solo viaje y 44 se reparten; la hoja dice
 *    cuántos pares van a cada destino y el operario cuenta, no decide.
 *
 * 3. LAS TALLAS SE MEZCLAN, mientras sea el mismo artículo. *"Pueden mezclar las tallas
 *    siempre y cuando sea del mismo artículo, normal, no hay problema"* —Daniel, 24-ago-2026.
 *    La regla contraria la había puesto yo, no él, y costaba 45 ubicaciones de las 183.
 *
 * 4. EL PREPACK TIENE PISO, NO TOPE. Regla de Daniel, 24-ago-2026: *"si la paleta tiene más
 *    de veinte, cumple con que esté llena. Si tiene menos de veinte, hay que consolidar"*.
 *    Cuánto aguanta la que recibe sale de la SERIE, porque *"en la serie uno, como son
 *    Bubblegummers, entran más"* — y está medido: la serie 1 tiene mediana 50 y las series
 *    5 y 8 tienen 17 y 16.
 */

/** El prepack se reconoce por la forma del código. La misma regla que usa el picking. */
const FORMA_PREPACK = /^\d{7}-\d-\d{5}$/;
export const esPrepackDeReserva = (sku) => FORMA_PREPACK.test(String(sku || '').trim());

/** Piso del prepack: por debajo de esto hay que consolidar. */
export const PISO_PREPACK = 20;

/** Cuánto aguanta una paleta de prepack, por serie. Es la MEDIANA de lo que cada serie ya
 *  logra hoy, medida el 24-ago-2026 sobre las 418 paletas de prepack de la reserva. No es un
 *  número inventado, y entra por `opciones.topes` para poder cambiarlo sin tocar esto. */
export const TOPES_PREPACK = { '1': 50, '2': 37, '3': 30, '4': 24, '5': 20,
                               '6': 30, '7': 36, '8': 20, '9': 20, '0': 48 };

export const planDeConsolidacion = (filas, idx, opciones) => {
    const o = opciones || {};
    const piso = o.piso || PISO_PREPACK;
    const topes = o.topes || TOPES_PREPACK;
    const serieDe = typeof o.serieDe === 'function' ? o.serieDe : () => null;
    const porGrupo = o.porGrupo || 25;
    if (!idx || !idx.porSku) return null;

    /* Cada ubicación se parte en sus dos líneas de trabajo. La llave lleva el tipo, así una
       paleta de prepack nunca puede terminar de destino de una de solid. */
    const ub = new Map();
    (filas || []).forEach(row => {
        if (!row) return;
        if (!row.ES_ALTO && !String(row.NIVEL).toUpperCase().includes('AL')) return;
        const u = String(row.UBICACION || '').trim();
        if (!u.startsWith('SEL-')) return;
        const q = parseFloat(row.CANTIDAD) || 0;
        if (q <= 0) return;
        const sku = String(row.PRODUCTO || '').trim();
        const padre = _padreDeProducto(sku);
        if (!padre) return;
        const tipo = esPrepackDeReserva(sku) ? 'PREPACK' : 'SOLID';
        /* En SOLID la marca es la TALLA; en PREPACK, el SKU completo. Es lo que el operario
           lee para saber si esa caja va ahí. Daniel: *"si tiene solid pones la talla, y si
           tiene prepack le pones todo el SKU para que el operario distinga"*. */
        const marca = tipo === 'PREPACK' ? sku : (extractTalla(row.DESCRIPCION) || 'S/T');
        const k = u + '|' + padre + '|' + tipo;
        let e = ub.get(k);
        if (!e) { e = { u, padre, tipo, lpn: String(row.LPN || '').trim(), q: 0, d: {} }; ub.set(k, e); }
        e.q += q;
        e.d[marca] = (e.d[marca] || 0) + q;
        if (!e.lpn) e.lpn = String(row.LPN || '').trim();
    });

    /* Una ubicación es de la línea que más pares tiene. Si tiene las dos, es un error de
       matriculación y se anota: hoy no pasa en ninguna de las 2.391. */
    const porUbi = new Map();
    ub.forEach(e => { const l = porUbi.get(e.u) || []; l.push(e); porUbi.set(e.u, l); });
    const mezcladas = [];
    const G = new Map();
    porUbi.forEach((l, u) => {
        if (new Set(l.map(x => x.tipo)).size > 1) mezcladas.push(u);
        const d = l.reduce((a, b) => (b.q > a.q ? b : a));
        const k = d.padre + '|' + d.tipo;
        const g = G.get(k) || []; g.push(d); G.set(k, g);
    });

    const llaves = (x) => Object.keys(x).filter(t => x[t] > 0);
    /* CADA TALLA CON SU CANTIDAD, SIEMPRE, EN LAS DOS PUNTAS. Lo pidieron los operarios y lo
       trajo Daniel el 24-ago-2026: *"que eso mismo lo pongas en tallas destino, para que ellos
       sepan qué tallas y cuánto tiene"*. Antes el destino mostraba solo "42/44" y el operario
       no sabía si la 44 que llevaba se juntaba con 5 o con 300. Va con cantidad hasta cuando
       hay una sola talla, para que todos los renglones se lean igual. */
    const rotulo = (x) => {
        const k = llaves(x).sort();
        if (!k.length) return '—';
        return k.map(t => t + '×' + Math.round(x[t])).join(' · ');
    };

    const lineas = [];
    G.forEach((ps0, k) => {
        if (ps0.length < 2) return;
        const corte = k.lastIndexOf('|');
        const padre = k.slice(0, corte), tipo = k.slice(corte + 1);
        const ps = ps0.map(x => ({ ...x, dd: { ...x.d } }));
        let cap, org, rec;
        if (tipo === 'SOLID') {
            cap = Math.max(...ps.map(x => x.q));
            const tot = ps.reduce((s, x) => s + x.q, 0);
            const red = ps.length - Math.max(1, Math.ceil(tot / cap));
            if (red <= 0) return;
            const orden = ps.slice().sort((a, b) => a.q - b.q);
            org = orden.slice(0, red); rec = orden.slice(red);
        } else {
            const s = String(serieDe(padre));
            cap = Math.max(piso, topes[s] || piso, ...ps.map(x => x.q));
            org = ps.filter(x => x.q < piso).sort((a, b) => b.q - a.q);
            rec = ps.filter(x => x.q >= piso).sort((a, b) => b.q - a.q);
            if (!org.length) return;
            if (!rec.length) rec = [org.shift()];   // sin ninguna que cumpla, la más gorda hace de base
        }
        rec = rec.map(x => ({ ...x, hueco: cap - x.q }));
        const mv = [];
        const anota = (x, r, cuanto, det, partir, parte, resta) => {
            mv.push({ padre: padre, tipo: tipo, partir: partir, parte: parte,
                      deU: x.u, deLpn: x.lpn, deQue: rotulo(det),
                      tiene: Math.round(x.q), pares: Math.round(cuanto),
                      quedaAhi: Math.round(resta),
                      aU: r.u, aLpn: r.lpn, aQue: rotulo(r.dd),
                      tenia: Math.round(r.q), queda: Math.round(r.q + cuanto),
                      cap: Math.round(cap) });
            r.q += cuanto; r.hueco -= cuanto;
            llaves(det).forEach(t => { r.dd[t] = (r.dd[t] || 0) + det[t]; });
        };
        org.forEach(x => {
            /* PRIMERO, ENTERA EN EL HUECO MÁS JUSTO. Yendo al más grande primero, una paleta
               se parte en siete destinos y el operario camina de más. */
            const caben = rec.filter(r => r.hueco >= x.q);
            if (caben.length) {
                anota(x, caben.reduce((m, y) => (y.hueco < m.hueco ? y : m)),
                      x.q, { ...x.dd }, false, '', 0);
                return;
            }
            /* SI NO CABE ENTERA, SE PARTE. Regla de Daniel, 24-ago-2026, después de ver que el
               compromiso con el comité —183 ubicaciones— era inalcanzable con el viaje único:
               medido sobre la reserva, bajaba a 110. Una paleta que no cabe en ningún hueco no
               se libera nunca, aunque el cálculo del comité la cuente.
               SE REPARTE TALLA POR TALLA, no a granel: así cada renglón dice qué tallas lleva
               y ninguno queda diciendo "llévate 32" sin decir de qué. */
            const orden = rec.filter(r => r.hueco > 0).sort((a, b) => b.hueco - a.hueco);
            if (orden.reduce((s, r) => s + r.hueco, 0) < x.q) return;   // no alcanza: se queda
            const pend = { ...x.dd };
            const trozos = [];
            let resta = x.q;
            for (const r of orden) {
                if (resta <= 0) break;
                let cabe = r.hueco, dio = {}, suma = 0;
                for (const t of llaves(pend).sort()) {
                    if (cabe <= 0) break;
                    const pon = Math.min(pend[t], cabe);
                    dio[t] = (dio[t] || 0) + pon; pend[t] -= pon;
                    cabe -= pon; suma += pon; resta -= pon;
                }
                if (suma > 0) trozos.push({ r: r, dio: dio, suma: suma });
            }
            let falta = x.q;
            trozos.forEach((t, i) => {
                falta -= t.suma;
                anota(x, t.r, t.suma, t.dio, true, (i + 1) + ' de ' + trozos.length, falta);
            });
        });
        if (mv.length) {
            const libera = new Set(mv.map(m => m.deU)).size;
            const partidas = new Set(mv.filter(m => m.partir).map(m => m.deU)).size;
            lineas.push({ padre: padre, tipo: tipo, n: ps.length, cap: Math.round(cap),
                          libera: libera, partidas: partidas,
                          g: (idx.porSku.get(padre) || {}).detalle || '', mv: mv });
        }
    });

    /* Primero el SOLID, que es donde está el volumen; dentro, el que más libera. Los GRUPOS
       son BLOQUES DE TRABAJO EN ORDEN, no equipos: *"el mismo grupo de personas va a ser el
       grupo uno, termina y va a ser el grupo dos"*. Por eso el 1 es el que más rinde: si una
       noche solo alcanza para uno, que sea el mejor. */
    lineas.sort((a, b) => (a.tipo === b.tipo ? 0 : (a.tipo === 'SOLID' ? -1 : 1))
                       || (b.libera - a.libera) || (b.n - a.n));
    let g = null;
    const grupos = [];
    lineas.forEach(l => {
        if (!g || g.paletas + l.libera > porGrupo) {
            g = { n: grupos.length + 1, lineas: [], paletas: 0 };
            grupos.push(g);
        }
        l.grupo = g.n; g.lineas.push(l); g.paletas += l.libera;
    });

    /* `paletas` CUENTA UBICACIONES QUE QUEDAN LIBRES, NO RENGLONES. Desde que una paleta se
       puede partir en dos o tres, los renglones son más que las paletas: contar renglones
       inflaría el avance y el cuadro dejaría de cuadrar con el mapa. */
    const suma = (f) => lineas.reduce((s, l) => s + f(l), 0);
    return { lineas: lineas, grupos: grupos, mezcladas: mezcladas,
             paletas: suma(l => l.libera),
             renglones: suma(l => l.mv.length),
             partidas: suma(l => l.partidas),
             solid: lineas.filter(l => l.tipo === 'SOLID').reduce((s, l) => s + l.libera, 0),
             prepack: lineas.filter(l => l.tipo === 'PREPACK').reduce((s, l) => s + l.libera, 0) };
};

/* ══════════════════════════════════════════════════════════════════════════════
 * PREPACK CHICO EN RESERVA — cuantas ubicaciones se liberan bajandolo
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Daniel, 25-ago-2026: *"quiero bajarme los prepack que son de diez a menos para mandarlo a
 * otras zonas, para desocupar espacios en reserva"*.
 *
 * LA UBICACION SOLO SE LIBERA SI QUEDA VACIA. Un prepack de 6 cajas en una paleta que ademas
 * tiene 200 pares de solid no desocupa nada: la ubicacion sigue ocupada. Medido el 25-ago
 * sobre la reserva de las 07:36, de 55 ubicaciones con 10 cajas o menos **solo 43 quedan
 * vacias**. Mandar al montacarguista a las 55 seria hacerle perder doce viajes.
 *
 * El tope entra por parametro y no esta clavado: Daniel puede querer verlo a 15 o a 20. */
export const prepackChicoDeReserva = (filas, tope) => {
    const TOPE = Number(tope) || 10;
    const ubis = new Map();
    (filas || []).forEach(row => {
        if (!row) return;
        if (!row.ES_ALTO && !String(row.NIVEL).toUpperCase().includes('AL')) return;
        const u = String(row.UBICACION || '').trim();
        if (!u.startsWith('SEL-')) return;
        const q = parseFloat(row.CANTIDAD) || 0;
        if (q <= 0) return;
        const sku = String(row.PRODUCTO || '').trim();
        let e = ubis.get(u);
        if (!e) { e = { u: u, lpn: String(row.LPN || '').trim(), lineas: [], total: 0 }; ubis.set(u, e); }
        e.lineas.push({ sku: sku, q: q, pre: esPrepackDeReserva(sku) });
        e.total += q;
        if (!e.lpn) e.lpn = String(row.LPN || '').trim();
    });

    const bajar = [], conRestos = [];
    let ubiPre = 0, cajasPre = 0, artsPre = new Set(), artsChico = new Set(), cajasChico = 0;
    ubis.forEach(e => {
        const pre = e.lineas.filter(l => l.pre);
        if (pre.length) {
            ubiPre++;
            pre.forEach(l => { cajasPre += l.q; artsPre.add(l.sku.split('-')[0]); });
        }
        const chicos = pre.filter(l => l.q <= TOPE);
        if (!chicos.length) return;
        const sacando = chicos.reduce((s, l) => s + l.q, 0);
        cajasChico += sacando;
        chicos.forEach(l => artsChico.add(l.sku.split('-')[0]));
        const fila = { u: e.u, lpn: e.lpn, q: Math.round(sacando),
                       queda: Math.round(e.total - sacando),
                       skus: chicos.map(l => l.sku + ' x' + Math.round(l.q)).join(' + ') };
        (fila.queda <= 0 ? bajar : conRestos).push(fila);
    });
    const porUbi = (a, b) => a.u.localeCompare(b.u);
    bajar.sort(porUbi); conRestos.sort(porUbi);

    return {
        tope: TOPE,
        ubicaciones: ubis.size,
        conPrepack: ubiPre, cajasPrepack: Math.round(cajasPre), artsPrepack: artsPre.size,
        chicas: bajar.length + conRestos.length,
        cajasChicas: Math.round(cajasChico), artsChicas: artsChico.size,
        bajar: bajar,            // las que quedan VACIAS: a estas va el montacarguista
        conRestos: conRestos,    // tienen algo mas encima: sacarlas no libera nada
        cajasBajar: bajar.reduce((s, x) => s + x.q, 0)
    };
};
