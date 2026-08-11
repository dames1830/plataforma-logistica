/* ============================================================================
   PICKING — Balance y Cobertura del piso
   ----------------------------------------------------------------------------
   Las dos secciones de la maqueta que NO salen del archivo de picking: hay que
   cruzarlo con las tareas de almacenaje (qué bajó al piso) y con el stock (qué
   hay hoy). Por eso llegaron las últimas.

   EL ALMACENAJE SE CUENTA POR JORNADA, NO POR FECHA DE CALENDARIO. El 83% se
   hace de noche, y una noche que arranca a las 19:00 y termina de madrugada es
   UNA jornada. Esa regla ya está escrita en `reportesComunes.js`
   (`diaOperativoDeTarea`) y acá se RECIBE, no se recalcula: la última vez que
   se reescribió aparte, el miércoles 05-ago pasó de 20.657 pares —el número
   que Daniel tenía anotado— a 12.831.

   Lo mismo con `marcaNormalizada`: "Bubblegummers Licenses" y "B.G Licenses"
   son la misma marca, y si cada reporte la agrupa a su manera los cuadros no
   cuadran entre pantallas.
   ============================================================================ */

const F = (n) => Number(n || 0).toLocaleString('es-PE');

/* El nombre con el que se AGRUPA es el oficial del Maestro; el que se MUESTRA es
   el corto, porque 'Bubblegummers Licenses' parte la fila en dos y descuadra la
   lectura del cuadro entero. Se recibe de fuera para no duplicar la tabla. */
let corta = (m) => m;
export const usarNombreCorto = (fn) => { if (typeof fn === 'function') corta = fn; };
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * BALANCE DEL PISO — lo que bajó contra lo que salió, por marca.
 *
 * `tareas`   las de almacenaje (vivas + histórico)
 * `dias`     [{dia, resumen}] del picking ya filtrado por el rango
 * `esCalzado`(sku) → bool, y `marcaDe`(sku) → marca, los dos del Maestro
 * `diaDeTarea`(t) → la jornada, de reportesComunes
 * `normalizar`(marca) → marcaNormalizada
 *
 * Del lado del almacenaje solo cuentan las tareas FINALIZADAS y con operario y
 * hora: una tarea sin trabajar no bajó nada. Lo que se mandó a almacenar y
 * nadie hizo se cuenta aparte, en `vencido`, porque es justo lo que hay que
 * mirar cuando el piso no se llena.
 */
export const calcularBalance = ({ tareas, dias, esCalzado, marcaDe, diaDeTarea, normalizar, topeAlmacenaje }) => {
    if (!dias.length) return null;

    // UNA JORNADA ENTRA SI TIENE ALMACENAJE **O** PICKING.
    //
    // Regla de Daniel, 11-ago-2026: *"cuando ni picking ni almacenaje hay, ahí no
    // lo cuentes, pero si hay almacenaje deberías contarlo, así no haya ni un par
    // picado — y al revés también. La lógica de ese reporte es que me muestre
    // cuánto se almacena y cuánto se pica"*.
    //
    // Antes el tramo terminaba en el último archivo de picking, y todo lo que se
    // almacenó después quedaba fuera sin decirlo: el 11-ago eran 31.512 pares del
    // sábado 8 y el lunes 10 que no aparecían en ningún lado. Un cuadro que
    // esconde lo que entró no sirve para avisar de que el piso se está llenando.
    //
    // `topeAlmacenaje` es hasta dónde mirar cuando NO hay filtro de fechas: la
    // última jornada con almacenaje, aunque su picking todavía no se haya subido.
    // Con fechas marcadas manda lo marcado, así que elegir un día suelto sigue sin
    // arrastrar al de al lado.
    const fechas = dias.map(d => d.dia).sort();
    const desde = fechas[0];
    const hasta = (topeAlmacenaje && topeAlmacenaje > fechas[fechas.length - 1])
        ? topeAlmacenaje : fechas[fechas.length - 1];
    const jornadas = new Set(fechas);

    const almacenado = new Map();   // marca → pares
    let noCalzado = 0, vencido = 0;

    (tareas || []).forEach(t => {
        if (!t) return;
        const d = diaDeTarea(t);
        if (!d || d < desde || d > hasta) return;
        jornadas.add(d);

        // Finalizada Y con operario Y con hora: las tres, o no bajó al piso.
        const hecha = t.status === 'Finalizado' && t.u1 && t.inicio;
        (t.items || []).forEach(art => {
            if (!art) return;
            // LOS ÍTEMS LLEGAN DE DOS FORMAS Y HAY QUE ACEPTAR LAS DOS.
            //
            // En el servidor viajan COMPRIMIDOS como arreglo —[sku7, marca, gender,
            // coleccion, bufferQty, ...]— para que el bloque no pese de más. En el
            // navegador ya vienen EXPANDIDOS como objeto, porque el motor los
            // descomprime al bajarlos.
            //
            // Mirando solo el arreglo, en la pantalla no entraba ni una tarea y la
            // columna Almacena salía en cero. En la prueba de Node no se veía,
            // porque ahí se lee el JSON crudo del servidor, que sí es arreglo.
            const sku = Array.isArray(art) ? art[0] : art.sku7;
            const q = Number(Array.isArray(art) ? art[4] : art.bufferQty) || 0;
            if (!sku || !q) return;
            if (!hecha) {
                if (t.status !== 'Finalizado') vencido += q;
                return;
            }
            if (esCalzado(sku)) {
                const m = normalizar(marcaDe(sku)) || 'Sin marca';
                almacenado.set(m, (almacenado.get(m) || 0) + q);
            } else {
                noCalzado += q;
            }
        });
    });

    // Del lado del picking, las dos formas de contar. `pares` abre la caja de
    // prepack; `cajas` la cuenta como una, que es lo que hacía la maqueta.
    const picadoPares = new Map(), picadoCajas = new Map();
    dias.forEach(({ resumen }) => {
        const c = resumen && resumen.seg && resumen.seg.calzado;
        if (!c) return;
        (c.marcas || []).forEach(x => {
            const m = normalizar(x.nom) || 'Sin marca';
            picadoPares.set(m, (picadoPares.get(m) || 0) + x.pares);
        });
        (c.marcas_cajas || []).forEach(x => {
            const m = normalizar(x.nom) || 'Sin marca';
            picadoCajas.set(m, (picadoCajas.get(m) || 0) + x.cajas);
        });
    });

    const marcas = [...new Set([...almacenado.keys(), ...picadoPares.keys()])];
    const filas = marcas.map(m => {
        const a = almacenado.get(m) || 0;
        const p = picadoPares.get(m) || 0;
        const pc = picadoCajas.get(m) || 0;
        return { marca: m, almacenado: a, picado: p, picadoCajas: pc, dif: a - p };
    }).sort((x, y) => (y.almacenado + y.picado) - (x.almacenado + x.picado));

    const tot = filas.reduce((s, f) => ({
        almacenado: s.almacenado + f.almacenado,
        picado: s.picado + f.picado,
        picadoCajas: s.picadoCajas + f.picadoCajas
    }), { almacenado: 0, picado: 0, picadoCajas: 0 });

    return { filas, ...tot, no_calzado: noCalzado, vencido, jornadas: jornadas.size };
};

/**
 * QUÉ PASA con cada marca, en PARES y no en veces.
 *
 * Decisión de Daniel del 08-ago-2026: la razón `almacena ÷ pica` no sabe de
 * volumen. Bubblegummers, con 5.761 pares de brecha, caía en 0,81 y salía
 * "parejo" —*"parejo significa que picas mil y almacenas mil"*—, mientras Bata
 * Industrials con −1.181 se llevaba la etiqueta más alarmante del cuadro.
 * El porcentaje va sobre EL MAYOR de los dos lados, que es lo que dice el pie.
 */
const quePasa = (f) => {
    const may = Math.max(f.almacenado, f.picado);
    if (!may) return { texto: '—', color: 'var(--text-muted)' };
    if (!f.picado) return { texto: 'entra y no sale', color: '#fbbf24' };
    if (!f.almacenado) return { texto: 'sale y no entra', color: '#38bdf8' };
    const d = Math.abs(f.dif), p = Math.round(100 * d / may);
    if (!p) return { texto: 'parejo', color: 'var(--text-muted)' };
    return f.dif > 0
        ? { texto: `entraron <b>${F(d)} más</b> (${p}%)`, color: '#fbbf24' }
        : { texto: `salieron <b>${F(d)} más</b> (${p}%)`, color: '#38bdf8' };
};

export const cuadroBalance = (B) => {
    if (!B || !B.filas.length) return '';
    const max = Math.max(...B.filas.map(f => Math.max(f.almacenado, f.picado)), 1);
    const barra = (v, color) => `<div style="height:6px; border-radius:3px; background:${color}; width:${(100 * v / max).toFixed(1)}%; min-width:${v ? 2 : 0}px;"></div>`;

    const filas = B.filas.map(f => {
        const q = quePasa(f);
        const salida = f.almacenado ? Math.round(100 * f.picado / f.almacenado) : null;
        return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          <td style="padding:0.5rem 0.9rem; color:#fff; font-weight:700;">${esc(corta(f.marca))}</td>
          <td style="padding:0.5rem 0.9rem; width:26%;">
            ${barra(f.almacenado, '#f59e0b')}<div style="height:3px;"></div>${barra(f.picado, '#818cf8')}
          </td>
          <td style="padding:0.5rem 0.9rem; text-align:right; font-weight:700;">${F(f.almacenado)}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right; font-weight:700;">${F(f.picado)}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right; color:${salida !== null && salida > 100 ? '#4ade80' : 'var(--text-muted)'};">${salida === null ? '—' : salida + '%'}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right; font-weight:800; color:${f.dif >= 0 ? '#fbbf24' : '#38bdf8'};">${f.dif >= 0 ? '+' : ''}${F(f.dif)}</td>
          <td style="padding:0.5rem 0.9rem; color:${q.color}; font-size:0.73rem;">${q.texto}</td>
        </tr>`;
    }).join('');

    const difTot = B.almacenado - B.picado;
    return `
      <div class="glass-panel" style="padding:0; overflow:hidden; border:1px solid rgba(245,158,11,0.25);">
        <div style="padding:1rem 1.3rem; border-bottom:1px solid rgba(255,255,255,0.06);">
          <h3 style="margin:0; color:#fff; font-size:0.92rem; font-weight:900; letter-spacing:0.5px;">
            ⚖️ BALANCE DEL PISO · ${B.jornadas} ${B.jornadas === 1 ? 'JORNADA' : 'JORNADAS'} ·
            ${F(B.almacenado)} ALMACENADOS CONTRA ${F(B.picado)} PICADOS
          </h3>
          <div style="font-size:0.71rem; color:var(--text-muted); margin-top:4px; line-height:1.7;">
            Calzado contra calzado, en los dos lados. El almacenaje sale de las tareas finalizadas con operario y
            horario; el picking, del archivo del día. <b style="color:rgba(255,255,255,0.6);">El almacenaje se cuenta
            por jornada</b>, no por fecha de calendario: una noche que arranca a las 19:00 y termina de madrugada es
            una sola jornada. No depende del segmento elegido arriba.
          </div>
          <div style="margin-top:0.6rem; font-size:0.7rem; color:var(--text-muted);">
            <span style="color:#f59e0b;">■</span> Almacena — pares que bajaron al piso
            &nbsp;&nbsp;<span style="color:#818cf8;">■</span> Pica — pares que salieron
          </div>
        </div>
        <div style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.78rem; color:#d1d5db;">
            <thead style="position:sticky; top:0; background:#1e293b;"><tr>
              <th style="padding:0.55rem 0.9rem; text-align:left; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Marca</th>
              <th></th>
              <th style="padding:0.55rem 0.9rem; text-align:right; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Almacena</th>
              <th style="padding:0.55rem 0.9rem; text-align:right; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Pica</th>
              <th style="padding:0.55rem 0.9rem; text-align:right; font-weight:700; color:var(--text-muted); font-size:0.7rem;">% salida</th>
              <th style="padding:0.55rem 0.9rem; text-align:right; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Diferencia</th>
              <th style="padding:0.55rem 0.9rem; text-align:left; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Qué pasa</th>
            </tr></thead>
            <tbody>${filas}
              <tr style="border-top:2px solid rgba(255,255,255,0.12); font-weight:900; color:#fff;">
                <td style="padding:0.6rem 0.9rem;">Total</td><td></td>
                <td style="padding:0.6rem 0.9rem; text-align:right;">${F(B.almacenado)}</td>
                <td style="padding:0.6rem 0.9rem; text-align:right;">${F(B.picado)}</td>
                <td style="padding:0.6rem 0.9rem; text-align:right;">${B.almacenado ? Math.round(100 * B.picado / B.almacenado) + '%' : '—'}</td>
                <td style="padding:0.6rem 0.9rem; text-align:right; color:${difTot >= 0 ? '#fbbf24' : '#38bdf8'};">${difTot >= 0 ? '+' : ''}${F(difTot)}</td>
                <td style="padding:0.6rem 0.9rem; font-size:0.73rem; color:var(--text-muted);">${difTot >= 0 ? 'el piso se llenó' : 'el piso se vació'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="padding:1rem 1.3rem; display:flex; gap:1rem; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.06);">
          <div style="flex:1; min-width:190px; background:rgba(239,68,68,0.07); border-radius:10px; padding:0.8rem 1rem;">
            <div style="font-size:1.4rem; font-weight:900; color:#f87171;">${F(B.vencido)}</div>
            <div style="font-size:0.65rem; font-weight:800; letter-spacing:0.6px; text-transform:uppercase; color:var(--text-muted);">Vencido sin trabajar</div>
            <div style="font-size:0.68rem; color:var(--text-muted);">se mandó a almacenar y nadie lo hizo</div>
          </div>
          <div style="flex:1; min-width:190px; background:rgba(255,255,255,0.03); border-radius:10px; padding:0.8rem 1rem;">
            <div style="font-size:1.4rem; font-weight:900; color:#fff;">${F(B.no_calzado)}</div>
            <div style="font-size:0.65rem; font-weight:800; letter-spacing:0.6px; text-transform:uppercase; color:var(--text-muted);">Almacenado que no es calzado</div>
            <div style="font-size:0.68rem; color:var(--text-muted);">bolsas y complementos, fuera del cuadro</div>
          </div>
          <div style="flex:1; min-width:190px; background:rgba(255,255,255,0.03); border-radius:10px; padding:0.8rem 1rem;">
            <div style="font-size:1.4rem; font-weight:900; color:${difTot >= 0 ? '#fbbf24' : '#38bdf8'};">${difTot >= 0 ? '+' : ''}${F(difTot)}</div>
            <div style="font-size:0.65rem; font-weight:800; letter-spacing:0.6px; text-transform:uppercase; color:var(--text-muted);">Acumulado de las ${B.jornadas} jornadas</div>
            <div style="font-size:0.68rem; color:var(--text-muted);">${F(B.almacenado)} almacenados − ${F(B.picado)} picados</div>
          </div>
        </div>
        <div style="padding:0.8rem 1.3rem; background:rgba(0,0,0,0.25); font-size:0.68rem; color:rgba(255,255,255,0.4); line-height:1.8;">
          <b style="color:rgba(255,255,255,0.6);">% salida</b> es cuánto de lo almacenado volvió a salir picado; por encima del 100% el piso se está vaciando.
          En <b style="color:rgba(255,255,255,0.6);">Qué pasa</b> el porcentaje es otra cosa: la brecha entre los dos lados, medida sobre el mayor de ellos.
          <br><b style="color:#fbbf24;">Ojo con la comparación:</b> acá el picking cuenta <b>pares</b>, con la caja de prepack abierta.
          La maqueta contaba <b>cajas</b> —${F(B.picadoCajas)} en este período contra ${F(B.picado)} pares— y por eso su titular era más bajo.
          El almacenaje siempre contó pares, así que comparar contra cajas subestimaba el picking.
        </div>
      </div>`;
};

/**
 * COBERTURA DEL PISO — cuántos días dura lo que hay, al ritmo medido.
 *
 * `stock` son las filas del stock activo publicado. Cuenta TODO el calzado que
 * haya, sin mirar zona: la pregunta es cuánto aguanta el almacén, no dónde está.
 */
export const calcularCobertura = ({ stock, dias, esCalzado, marcaDe, normalizar, colArticulo, colCantidad }) => {
    if (!stock || !stock.length || !dias.length) return null;

    const enPiso = new Map();
    stock.forEach(fila => {
        const raw = Array.isArray(fila) ? fila : Object.values(fila);
        const sku = String(raw[colArticulo] || '').trim();
        const q = parseFloat(String(raw[colCantidad] || '0').replace(',', '.')) || 0;
        if (!sku || q <= 0 || !esCalzado(sku)) return;
        const m = normalizar(marcaDe(sku)) || 'Sin marca';
        enPiso.set(m, (enPiso.get(m) || 0) + q);
    });
    if (!enPiso.size) return null;

    const picado = new Map();
    dias.forEach(({ resumen }) => {
        const c = resumen && resumen.seg && resumen.seg.calzado;
        (c && c.marcas || []).forEach(x => {
            const m = normalizar(x.nom) || 'Sin marca';
            picado.set(m, (picado.get(m) || 0) + x.pares);
        });
    });

    const nd = dias.length;
    const filas = [...enPiso.entries()].map(([marca, stockM]) => {
        const porDia = Math.round((picado.get(marca) || 0) / nd);
        return { marca, stock: stockM, pica_dia: porDia, dias: porDia ? +(stockM / porDia).toFixed(1) : null };
    }).sort((a, b) => {
        if (a.dias === null) return 1;
        if (b.dias === null) return -1;
        return a.dias - b.dias;
    });

    return { filas, total: [...enPiso.values()].reduce((s, v) => s + v, 0), dias_medidos: nd };
};

export const cuadroCobertura = (C) => {
    if (!C || !C.filas.length) return '';
    const lectura = (f) => {
        if (f.dias === null) return { t: 'no salió nada en los días medidos', c: 'var(--text-muted)' };
        if (f.dias < 7) return { t: 'se queda sin piso', c: '#f87171' };
        if (f.dias > 90) return { t: 'ocupa piso sin rotar', c: '#fbbf24' };
        return { t: '', c: 'var(--text-muted)' };
    };
    const filas = C.filas.map(f => {
        const l = lectura(f);
        return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          <td style="padding:0.5rem 0.9rem; color:#fff; font-weight:700;">${esc(corta(f.marca))}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right;">${F(f.stock)}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right; color:var(--text-muted);">${F(f.pica_dia)}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right; font-weight:800; color:${l.c === 'var(--text-muted)' ? '#fff' : l.c};">${f.dias === null ? '—' : f.dias}</td>
          <td style="padding:0.5rem 0.9rem; font-size:0.73rem; color:${l.c};">${l.t}</td>
        </tr>`;
    }).join('');
    return `
      <div class="glass-panel" style="padding:0; overflow:hidden; border:1px solid rgba(255,255,255,0.07);">
        <div style="padding:1rem 1.3rem; border-bottom:1px solid rgba(255,255,255,0.06);">
          <h3 style="margin:0; color:#fff; font-size:0.9rem; font-weight:900; letter-spacing:0.5px;">📅 COBERTURA DEL PISO</h3>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px; line-height:1.6;">
            Cuántos días dura en el piso lo que hay, al ritmo de picking medido.
          </div>
        </div>
        <div style="overflow:auto; max-height:420px;">
          <table style="width:100%; border-collapse:collapse; font-size:0.78rem; color:#d1d5db;">
            <thead style="position:sticky; top:0; background:#1e293b;"><tr>
              <th style="padding:0.55rem 0.9rem; text-align:left; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Marca</th>
              <th style="padding:0.55rem 0.9rem; text-align:right; font-weight:700; color:var(--text-muted); font-size:0.7rem;">En el piso</th>
              <th style="padding:0.55rem 0.9rem; text-align:right; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Pica por día</th>
              <th style="padding:0.55rem 0.9rem; text-align:right; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Días que dura</th>
              <th style="padding:0.55rem 0.9rem; text-align:left; font-weight:700; color:var(--text-muted); font-size:0.7rem;">Lectura</th>
            </tr></thead>
            <tbody>${filas}
              <tr style="border-top:2px solid rgba(255,255,255,0.12); font-weight:900; color:#fff;">
                <td style="padding:0.6rem 0.9rem;">Total en el piso</td>
                <td style="padding:0.6rem 0.9rem; text-align:right;">${F(C.total)}</td>
                <td colspan="3" style="padding:0.6rem 0.9rem; font-size:0.72rem; color:var(--text-muted); font-weight:400;">
                  calculado con ${C.dias_medidos} ${C.dias_medidos === 1 ? 'día' : 'días'} de picking: con más archivos se afina
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="padding:0.75rem 1.3rem; background:rgba(0,0,0,0.25); font-size:0.68rem; color:rgba(255,255,255,0.4); line-height:1.8;">
          El stock es el activo publicado por el robot, todo el calzado sin mirar zona. El ritmo es el promedio de los
          días elegidos arriba: si se elige un solo día, el ritmo es el de ese día y la cobertura se mueve mucho.
        </div>
      </div>`;
};
