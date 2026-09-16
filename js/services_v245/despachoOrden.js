/**
 * LEER LA ORDEN DE DESPACHO QUE MANDA COMERCIAL
 *
 * El archivo llega por WhatsApp al teléfono y se carga desde ahí. Este módulo lo lee,
 * lo cuadra contra sus propios totales y lo guarda. Lo usan la app del celular y —el
 * día que se agregue— la web: la lectura vive en un solo sitio porque un Excel leído
 * de dos formas distintas es la manera más rápida de que dos pantallas muestren
 * números distintos del mismo día.
 *
 * ── LO QUE SE APRENDIÓ LEYENDO EL ARCHIVO DE VERDAD ──────────────────────────
 *
 * Nada de esto se adivinó; salió de abrir `Despacho del 15.09.xlsx`, y es lo que hace
 * que esto funcione también con el del lunes que viene:
 *
 *   1. LA HOJA NO SE PUEDE BUSCAR POR NOMBRE. Se llama "Orden_Despacho - 2026-09-14T164"
 *      —lleva la fecha y la hora adentro, y Excel corta el nombre a 31 letras—, así que
 *      cambia en cada archivo. Se busca la hoja que TENGA LOS TÍTULOS.
 *   2. LOS TÍTULOS ESTÁN EN LA FILA 9, y tampoco se fija el 9: arriba hay un resumen
 *      que hoy ocupa 8 filas y mañana puede ocupar 7. Se busca la fila de títulos.
 *   3. LOS TÍTULOS TRAEN UN ESPACIO DURO PEGADO (el carácter A0). Sin limpiarlo no
 *      coincide NI UNO de los catorce.
 *   4. LA COLUMNA C VIENE ESCONDIDA (Promotor) y se lee igual. Escondida no es borrada.
 *   5. HAY FILAS VACÍAS DE RELLENO al final. Sin ignorarlas se cargan guías fantasma:
 *      en la BBDD de comercial hay 3.129 guías reales y 388 filas vacías.
 *
 * ── PEDIDO Y ENVIADO NO SON EL MISMO NÚMERO ──────────────────────────────────
 *
 *   Daniel, 15-sep-2026: *"son 368 pedidos, pares enviados son 403"*.
 *
 * Las guías suman lo PEDIDO; el camión llevó más, por los premios que se agregan. Y el
 * archivo NO dice de qué guía es cada premio: las observaciones dicen "PREMIO
 * SANDALIAS", "PREMIO 800.00", sin una sola cantidad. Así que la cantidad por guía
 * queda en la pedida —el único número que el archivo da por guía— y el total enviado se
 * guarda con la orden. Decir 368 como "lo que salió" sería un número que el papel del
 * chofer desmiente.
 *
 * ── ESTE CARGADOR NUNCA BORRA ────────────────────────────────────────────────
 *
 * Agrega la orden a la semana que le toca y no toca nada más. Tampoco toca el paquete
 * `despacho_catalogo`, que es el respaldo de la importación del AppSheet: bajarlo y
 * volver a subirlo desde un teléfono serían dos megabytes por cada carga.
 *
 * Y volver a cargar la MISMA orden no duplica ni renumera: se reconoce por su número,
 * se reemplazan sus guías y se reusan sus id. El id es lo que amarra la liquidación —el
 * estado, la factura y la foto viven aparte y apuntan a él—, así que renumerar dejaría
 * lo liquidado colgando de números que ya no existen.
 */

import * as DES from './despachoCatalogo.js?v=29.0807';

/* Los catorce títulos que manda comercial, y a qué campo va cada uno. Se reconocen por
   el título y no por la posición: es lo único que sobrevive a que alguien mueva una
   columna de sitio. */
export const TITULOS = {
    'asesor': 'ase', 'NombreLider': 'lider', 'Promotor': 'prom', 'Rotulo': 'rot',
    'Agencia': 'age', 'Destino': 'dest', 'Pedido': 'ped', 'Total_Cantidad': 'cant',
    'PedidoBolsas': 'pedBol', 'TotalBolsas': 'bolsas', 'TotalVenta': 'venta',
    'CobroFlete': 'flete', 'Observacion': 'obs', 'Detalle': 'det'
};
const NUMEROS = ['cant', 'bolsas', 'venta', 'pedBol'];
const MINIMO_TITULOS = 10;
const CANALES_VALIDOS = Object.keys(DES.CANALES);      // con 10 de 14 ya es la hoja buena

/** Saca el espacio duro y los espacios de más. Sin esto no coincide ningún título. */
const limpio = (v) => String(v === undefined || v === null ? '' : v)
    /* El espacio duro va escrito como \u00a0 A PROPOSITO. Si se pone el caracter de
       verdad, en la pantalla se ve igual que un espacio normal y el primero que
       'limpie' el archivo lo borra sin saber que rompio los catorce titulos. */
    .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

/* ── LAS FECHAS DE EXCEL NO SON FECHAS ─────────────────────────────────
   Adentro son un número: los días que pasaron desde el 30 de diciembre de 1899. El
   14 de setiembre de 2026 es el 46.279, y eso fue lo que salió en pantalla la primera
   vez: "creada el 46279".

   Se arma con las partes locales y NUNCA con toISOString, que devuelve UTC y en Lima
   adelanta el día a las 19:00 —la trampa número uno de este proyecto—. */
const dd = (n) => String(n).padStart(2, '0');
const deFecha = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
const aFechaTexto = (v) => {
    if (v instanceof Date && !isNaN(v)) return deFecha(v);
    if (typeof v === 'number' && v > 20000 && v < 90000) {
        /* El día 0 de Excel es el 30-dic-1899. Se arma a mediodía para que ningun
           cambio de horario corra la fecha un día. */
        return deFecha(new Date(1899, 11, 30 + Math.floor(v), 12));
    }
    const t = String(v || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) return `${m[3]}-${dd(m[2])}-${dd(m[1])}`;
    return t.slice(0, 10);
};

const numero = (v) => {
    if (typeof v === 'number') return v;
    const n = Number(String(v || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
};

/* Los rótulos de la cabecera de arriba, y dónde guardarlos. La cabecera va en pares
   "rótulo, valor" repartidos en columnas, así que se busca el rótulo y se lee la celda
   de al lado. */
const CABECERA = [
    [/^nro\.? ?documento$/, 'od', 'texto'],
    [/^fec\.? ?creaci/, 'creada', 'fecha'],
    [/^estado$/, 'estadoOD', 'texto'],
    [/^total monto$/, 'monto', 'num'],
    [/^pares pedido$/, 'paresPedido', 'num'],
    [/^pares enviado$/, 'paresEnviado', 'num'],
    [/^bolsas pedido$/, 'bolsas', 'num']
];

/* ══ EL ARCHIVO QUE LLEGO POR COMPARTIR ════════════════════════════════
   Cuando se comparte el Excel desde WhatsApp, Android se lo manda al ayudante -el
   service worker-, que lo deja guardado un momento y abre la app. Esto lo recoge.

   SE BORRA APENAS SE LEE. Si quedara guardado, la proxima vez que alguien abriera la
   app se le abriria solo el cargador con el archivo de la semana pasada, sin entender
   por que. Un archivo compartido es de una sola vez. */
const CAJON_COMPARTIDO = 'compartido-v1';
const LLAVE_COMPARTIDO = './__compartido__';

export const archivoCompartido = async () => {
    try {
        if (!self.caches) return null;
        const cajon = await caches.open(CAJON_COMPARTIDO);
        const r = await cajon.match(LLAVE_COMPARTIDO);
        if (!r) return null;
        await cajon.delete(LLAVE_COMPARTIDO);
        const trozo = await r.blob();
        if (!trozo || !trozo.size) return null;
        let nombre = 'compartido.xlsx';
        try { nombre = decodeURIComponent(r.headers.get('X-Nombre') || nombre); } catch (e) { /* se queda el de siempre */ }
        return new File([trozo], nombre, { type: r.headers.get('Content-Type') || trozo.type });
    } catch (e) {
        console.warn('[despacho] no se pudo recoger el compartido:', e && e.message);
        return null;
    }
};

/**
 * Lee el archivo y devuelve lo que trae, SIN guardar nada.
 * `{ ok, motivo, orden, filas, cuadre }`
 */
export const leerArchivo = async (archivo) => {
    if (!window.XLSX) return { ok: false, motivo: 'no se pudo cargar el lector de Excel' };
    let libro;
    try {
        libro = window.XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: 'array' });
    } catch (e) {
        return { ok: false, motivo: 'no parece un Excel: ' + ((e && e.message) || '') };
    }

    for (const nombre of libro.SheetNames) {
        const hoja = libro.Sheets[nombre];
        /* `header:1` da la hoja como filas de celdas, que es lo que hace falta para
           buscar los títulos: con el modo normal habría que saber de antemano dónde
           están, que es justo lo que no se sabe. `defval:''` mantiene las columnas
           alineadas aunque una celda venga vacía. */
        const rejilla = window.XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', blankrows: true });
        for (let r = 0; r < Math.min(rejilla.length, 40); r++) {
            const fila = (rejilla[r] || []).map(limpio);
            const cuantos = Object.keys(TITULOS).filter((t) => fila.indexOf(t) >= 0).length;
            if (cuantos < MINIMO_TITULOS) continue;

            const donde = {};
            fila.forEach((t, c) => { if (TITULOS[t] !== undefined) donde[TITULOS[t]] = c; });

            const orden = { hoja: nombre, archivo: archivo.name || '' };
            for (let rr = 0; rr < r; rr++) {
                const f = rejilla[rr] || [];
                for (let cc = 0; cc < f.length - 1; cc++) {
                    const et = limpio(f[cc]).toLowerCase().replace(/\.$/, '');
                    const par = CABECERA.find(([re]) => re.test(et));
                    if (!par) continue;
                    const crudo = f[cc + 1];
                    orden[par[1]] = par[2] === 'num' ? numero(crudo)
                                  : par[2] === 'fecha' ? aFechaTexto(crudo)
                                  : limpio(crudo);
                }
            }

            const filas = [];
            for (let rr = r + 1; rr < rejilla.length; rr++) {
                const f = rejilla[rr] || [];
                const g = {};
                Object.keys(donde).forEach((campo) => {
                    const v = f[donde[campo]];
                    if (v === undefined || limpio(v) === '') return;
                    g[campo] = NUMEROS.indexOf(campo) >= 0 ? numero(v) : limpio(v);
                });
                /* Sin rótulo y sin pedido es relleno del final, no una guía. */
                if (g.rot || g.ped) filas.push(g);
            }
            if (!filas.length) return { ok: false, motivo: 'la hoja tiene los títulos pero ninguna guía' };

            return { ok: true, orden, filas, cuadre: cuadrar(orden, filas) };
        }
    }
    return { ok: false, motivo: 'no encontré la fila de títulos en ninguna hoja' };
};

/**
 * EL ARCHIVO TRAE CON QUÉ CUADRARSE A SÍ MISMO, así que se usa.
 * Si lo leído no da los mismos pares y el mismo monto que dice su propio resumen, es
 * que se leyó mal —una columna movida, una fila de más— y cargarlo sería meter un
 * número equivocado que después nadie encuentra.
 */
export const cuadrar = (orden, filas) => {
    const pares = filas.reduce((a, f) => a + (Number(f.cant) || 0), 0);
    const venta = filas.reduce((a, f) => a + (Number(f.venta) || 0), 0);
    const dicePares = orden.paresPedido;
    const diceMonto = orden.monto;
    const paresOk = dicePares === null || dicePares === undefined || Math.round(pares) === Math.round(dicePares);
    const montoOk = diceMonto === null || diceMonto === undefined || Math.abs(venta - diceMonto) < 0.05;
    /* Los premios: lo enviado menos lo pedido. No es un descuadre, es otra cosa. */
    const premios = (orden.paresEnviado && dicePares) ? (orden.paresEnviado - dicePares) : 0;
    return { pares, venta, dicePares, diceMonto, paresOk, montoOk, premios, ok: paresOk && montoOk };
};

/** Las guías de esa orden que ya estaban cargadas, por si se manda el archivo dos veces. */
export const yaCargada = (indice, od) =>
    ((indice && indice.ordenes) || []).find((o) => o && o.od && od && o.od === od) || null;

/**
 * Guarda la orden. Agrega a la semana que le toca y NO borra nada más.
 * `avisar(texto)` para ir contando qué hace.
 */
export const guardarOrden = async (orden, filas, fecha, avisar, canal) => {
    /* EL CANAL LO PONE LA PANTALLA QUE CARGA. Cargar desde Tracking Retail marca las
       guias como retail y desde Despacho de Catalogo como catalogo; el celular, que
       muestra todos los canales, carga como catalogo, que es lo que manda comercial
       hoy. Asi la orden cae en el modulo correcto sin preguntar nada. */
    const elCanal = (CANALES_VALIDOS.indexOf(String(canal || '')) >= 0) ? String(canal) : 'catalogo';
    const decir = (t) => { if (avisar) avisar(t); };
    const lunes = DES.lunesDe(fecha);

    decir('Mirando qué hay…');
    const indice = (await DES.traerIndice(true)) || { semanas: {}, total: 0 };
    const previas = (await DES.traerSemana(lunes, true)) || [];

    /* SE REEMPLAZAN LAS DE ESTA MISMA ORDEN, no se agregan otra vez. Y se reusan sus
       números: el id es lo que amarra la liquidación. */
    const mismas = {};
    previas.forEach((f) => {
        if (f.od && orden.od && f.od === orden.od) mismas[String(f.rot || '') + '|' + String(f.ped || '')] = f;
    });
    const quedan = previas.filter((f) => !(f.od && orden.od && f.od === orden.od));

    const usados = {};
    previas.forEach((f) => { usados[String(f.id)] = 1; });
    let libre = Math.max(Number(indice.ultimoId) || 0,
                         ...previas.map((f) => Number(f.id) || 0), 40000) + 1;

    const nuevas = filas.map((f) => {
        const g = Object.assign({}, f);
        const antes = mismas[String(f.rot || '') + '|' + String(f.ped || '')];
        if (antes) {
            g.id = String(antes.id);
            /* Lo que el liquidador ya había puesto NO se pisa con el archivo. */
            ['est', 'fact', 'factA', 'gasto', 'bulto', 'inc', 'entr', 'repr',
             'foto', 'foto2', 'pdf', 'liquidadoEl'].forEach((k) => {
                if (antes[k] !== undefined && antes[k] !== '') g[k] = antes[k];
            });
        } else {
            while (usados[String(libre)]) libre++;
            g.id = String(libre);
            usados[g.id] = 1;
            libre++;
        }
        g.desp = fecha;
        g.canal = elCanal;
        g.od = orden.od || '';
        if (!g.est) g.est = 'PENDIENTE';
        return g;
    });

    const todas = quedan.concat(nuevas);
    todas.sort((a, b) => Number(a.id) - Number(b.id));

    decir('Guardando ' + nuevas.length + ' guías…');
    await DES.guardarSemana(lunes, todas);

    /* El índice: la cuenta de la semana, el último número usado y la orden en la lista,
       para que la próxima vez se sepa que esta ya entró sin bajar nada. */
    const sin = todas.filter(DES.sinLiquidar).length;
    const porCanal = { catalogo: 0, retail: 0 };
    todas.filter(DES.sinLiquidar).forEach((f) => {
        const c = DES.canalDe(f); porCanal[c] = (porCanal[c] || 0) + 1;
    });
    indice.semanas = indice.semanas || {};
    indice.semanas[lunes] = Object.assign({}, indice.semanas[lunes], {
        n: todas.length, sin, sinPorCanal: porCanal,
        d0: todas.reduce((a, f) => (!a || f.desp < a ? f.desp : a), ''),
        d1: todas.reduce((a, f) => (f.desp > a ? f.desp : a), '')
    });
    indice.total = Object.keys(indice.semanas).reduce((a, k) => a + (indice.semanas[k].n || 0), 0);
    /* `desde` es la FECHA de la guia mas vieja, no el lunes de su semana. Con el lunes,
       el indice decia que habia despachos el 14 cuando el primero era el 15. */
    const lunesTodos = Object.keys(indice.semanas).sort();
    indice.desde = lunesTodos.map((l) => indice.semanas[l].d0).filter(Boolean).sort()[0] || fecha;
    indice.hasta = todas.length ? indice.semanas[lunes].d1 : indice.hasta;
    if (fecha > (indice.hasta || '')) indice.hasta = fecha;
    indice.ultimoId = Math.max(Number(indice.ultimoId) || 0, ...todas.map((f) => Number(f.id) || 0));
    indice.ordenes = (indice.ordenes || []).filter((o) => !(o && o.od && o.od === orden.od));
    indice.ordenes.push(Object.assign({}, orden, {
        fecha, guias: nuevas.length, cargada: DES.hoyTexto()
    }));

    await DES.guardarArea(DES.AREA_INDICE, indice);
    decir('');
    return { guardadas: nuevas.length, reusadas: Object.keys(mismas).length, lunes };
};
