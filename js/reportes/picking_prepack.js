/* ============================================================================
   PREPACK CONTRA SUELTO — la pantalla
   ----------------------------------------------------------------------------
   Porta la maqueta del 09-ago-2026 al producto. Ocho secciones que llevan de la
   pregunta al número, y CADA NÚMERO SE PUEDE ABRIR para ver de dónde sale: las
   mediciones que lo respaldan, el embudo que las filtra y la escalera hasta la
   mediana. Sin eso es un dato que hay que creer; con eso es un dato que se
   puede discutir en un comité.

   ES UN MÓDULO AUTÓNOMO A PROPÓSITO. No toca `dataStore`, ni el usuario, ni
   ninguna función del dashboard: recibe los días ya cargados y devuelve HTML.
   Así se prueba sin login —el defecto de `esc is not defined` del 11-ago salió
   justamente de escribir una pantalla dentro de `dashboard_v28.js`, donde los
   ayudantes están duplicados dentro de cada función y es fácil usar uno que en
   ese punto no existe.
   ============================================================================ */

import {
    EQUIVALENCIA_PREPACK, juntarCronometros, tiempoDe, tiempoSituacion,
    escaleraDe, embudoDe, TOPE_HUECO_SEG
} from './picking.js?v=29.0505';

const F = (n) => Number(n || 0).toLocaleString('es-PE');
const DMY = (d) => String(d || '').split('-').reverse().join('/');
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const pct = (a, b) => b ? (100 * a / b).toFixed(1) : '0.0';

/* --- Piezas de estilo, para que las ocho secciones se lean como una sola ---- */

const seccion = (n, titulo, bajada, cuerpo) => `
  <div class="glass-panel" style="padding:0; overflow:hidden; border:1px solid rgba(var(--ink-rgb), 0.07); margin-bottom:1.1rem;">
    <div style="padding:1rem 1.3rem; border-bottom:1px solid rgba(var(--ink-rgb), 0.06); display:flex; align-items:center; gap:11px;">
      <span style="background:rgba(var(--primary2-rgb), 0.18); color:var(--brand-pale); width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:var(--t-sm); font-weight:900; flex:none;">${n}</span>
      <div>
        <h3 style="margin:0; color:var(--text-strong); font-size:var(--t-md); font-weight:900; letter-spacing:0.4px;">${titulo}</h3>
        ${bajada ? `<div style="font-size:var(--t-xs); color:var(--text-muted); margin-top:2px; line-height:1.6;">${bajada}</div>` : ''}
      </div>
    </div>
    <div style="padding:1.1rem 1.3rem;">${cuerpo}</div>
  </div>`;

const remate = (texto, color = 'var(--success-soft)') => `
  <div style="margin-top:0.9rem; padding:0.7rem 1rem; background:rgba(var(--ink-rgb), 0.03); border-left:3px solid ${color}; border-radius:8px; font-size:var(--t-sm); color:var(--text-strong); font-weight:700; line-height:1.6;">
    ${texto}
  </div>`;

/** Un número que se puede abrir. `tipo` es 'suelto' o la curva; `campo`, n o seg. */
const abrible = (texto, tipo, campo, extra = '') => `
  <a href="#" class="pp-num" data-tipo="${tipo}" data-campo="${campo}"
     style="color:inherit; text-decoration:underline dotted rgba(var(--brand-pale-rgb), 0.7); text-underline-offset:3px; cursor:pointer; ${extra}">${texto}</a>`;

/* --- Las ocho secciones ----------------------------------------------------- */

const sec1 = (C) => {
    const total = C.mov.suelto + C.mov.prepack;
    const caja = (titulo, texto, mov, pie, color) => `
      <div style="flex:1; min-width:260px; background:rgba(var(--ink-rgb), 0.03); border:1px solid rgba(var(--ink-rgb), 0.07); border-top:3px solid ${color}; border-radius:12px; padding:1rem 1.1rem;">
        <div style="font-size:var(--t-md); font-weight:900; color:var(--text-strong); margin-bottom:0.5rem;">${titulo}</div>
        <div style="font-size:var(--t-sm); color:var(--text-muted); line-height:1.8;">${texto}</div>
        <div style="margin-top:0.7rem; font-size:var(--t-sm); color:${color}; font-weight:800;">${mov}</div>
        ${pie ? `<div style="font-size:var(--t-xs); color:var(--text-muted); margin-top:2px;">${pie}</div>` : ''}
      </div>`;
    return `<div style="display:flex; gap:1rem; flex-wrap:wrap;">
      ${caja('Suelto',
        'El operario camina hasta una ubicación y saca un par. Una ida, un par. Es la forma de trabajo más común del almacén.',
        `${F(C.mov.suelto)} movimientos · ${pct(C.mov.suelto, total)}% del total`, '', 'var(--sky)')}
      ${caja('Prepack',
        'El operario saca una caja cerrada con una curva de tallas adentro. Una ida, varios pares. <b style="color:rgba(var(--ink-rgb), 0.8);">El sistema anota 1</b>, aunque adentro vayan 10.',
        `${F(C.mov.prepack)} movimientos · ${pct(C.mov.prepack, total)}% del total`,
        `${F(C.mov.cajas)} cajas`, 'var(--warning)')}
    </div>`;
};

const sec2 = (C, dias) => {
    const dif = C.pares_reales - C.pares_wms;
    const filas = dias.map(d => {
        const p = d.pp;
        const x = p.pares_reales - p.pares_wms;
        return `<tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.03);">
          <td style="padding:0.45rem 0.9rem;">${DMY(d.dia)}</td>
          <td style="padding:0.45rem 0.9rem; text-align:right; color:var(--text-muted);">${F(p.pares_wms)}</td>
          <td style="padding:0.45rem 0.9rem; text-align:right; color:var(--text-strong); font-weight:700;">${F(p.pares_reales)}</td>
          <td style="padding:0.45rem 0.9rem; text-align:right; color:var(--success-soft); font-weight:700;">+${F(x)}</td>
          <td style="padding:0.45rem 0.9rem; text-align:right; color:var(--text-muted);">${pct(x, p.pares_wms)}%</td>
        </tr>`;
    }).join('');
    return `
      <div style="text-align:center; margin-bottom:1.1rem;">
        <div style="font-size:var(--t-2xl); font-weight:900; color:var(--success-soft); line-height:1.1;">${F(dif)}</div>
        <div style="font-size:var(--t-sm); color:var(--text-muted); line-height:1.7;">
          pares que salieron y el reporte no contaba — un <b style="color:var(--success-soft);">${pct(dif, C.pares_wms)}% más</b> de lo que se creía.
        </div>
      </div>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:var(--t-sm); color:var(--text-grey);">
          <thead><tr style="color:var(--text-muted); text-align:left;">
            <th style="padding:0.45rem 0.9rem; font-weight:700;">Jornada</th>
            <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Dice el WMS</th>
            <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Salió de verdad</th>
            <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">No se veía</th>
            <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">%</th>
          </tr></thead>
          <tbody>${filas}
            <tr style="border-top:2px solid rgba(var(--ink-rgb), 0.1); font-weight:900; color:var(--text-strong);">
              <td style="padding:0.55rem 0.9rem;">Total</td>
              <td style="padding:0.55rem 0.9rem; text-align:right;">${F(C.pares_wms)}</td>
              <td style="padding:0.55rem 0.9rem; text-align:right;">${F(C.pares_reales)}</td>
              <td style="padding:0.55rem 0.9rem; text-align:right; color:var(--success-soft);">+${F(dif)}</td>
              <td style="padding:0.55rem 0.9rem; text-align:right;">${pct(dif, C.pares_wms)}%</td>
            </tr>
          </tbody>
        </table>
      </div>`;
};

const sec3 = (C) => {
    const s = tiempoDe(C, 'suelto');
    const c10 = tiempoDe(C, '10');
    if (!s.mediana) return '<div class="txt-dato">Sin mediciones en las fechas elegidas.</div>';
    const unoAUno = s.mediana * 10;
    const factor = c10.mediana ? (c10.mediana / s.mediana).toFixed(2) : '—';
    const barra = (rot, seg, ancho, color) => `
      <div style="margin-bottom:0.7rem;">
        <div style="display:flex; justify-content:space-between; font-size:var(--t-sm); margin-bottom:4px;">
          <span style="color:rgba(var(--ink-rgb), 0.75);">${rot}</span>
          <b style="color:${color};">${seg} s</b>
        </div>
        <div style="background:rgba(var(--ink-rgb), 0.05); border-radius:5px; height:12px; overflow:hidden;">
          <div style="width:${ancho}%; height:100%; background:${color};"></div>
        </div>
      </div>`;
    return `
      ${barra('1 par suelto', s.mediana, 100 * s.mediana / unoAUno, 'var(--sky)')}
      ${barra('1 caja de 10 pares', c10.mediana || 0, 100 * (c10.mediana || 0) / unoAUno, 'var(--warning)')}
      ${barra('Esos 10 pares, uno por uno', unoAUno, 100, 'var(--danger)')}
      ${remate(`Una caja de 10 pares no cuesta 10 veces más. Cuesta <b style="color:var(--success-soft);">${factor} veces más</b>.`)}
      <div style="margin-top:0.8rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.35); line-height:1.7;">
        Cronometrado con el reloj del propio archivo: el hueco entre un movimiento y el siguiente es lo que costó ese movimiento.
        Se descartan los huecos de más de ${TOPE_HUECO_SEG / 60} minutos, que son paradas y no trabajo. Se usa la mediana y no el
        promedio, para que un caso raro no arrastre el número. Base: ${abrible(F(s.n) + ' movimientos', 'suelto', 'n')}.
      </div>`;
};

const sec4 = (C) => {
    const sm = tiempoSituacion(C, 'suelto', 'mismo'), sc = tiempoSituacion(C, 'suelto', 'camino');
    const pm = tiempoSituacion(C, 'prepack', 'mismo'), pc = tiempoSituacion(C, 'prepack', 'camino');
    const s = tiempoDe(C, 'suelto');
    const totalS = sm.n + sc.n, totalP = pm.n + pc.n;
    if (!totalS || !totalP) return '<div class="txt-dato">Sin mediciones suficientes.</div>';

    const mezcla = tiempoDe(C, 'suelto').mediana;
    const todoPrepack = (() => {
        // La mediana de todo el prepack junto, sin partir por curva
        const h = {};
        Object.keys(C.hist || {}).filter(k => k !== 'suelto').forEach(k => {
            Object.keys(C.hist[k]).forEach(sg => { h[sg] = (h[sg] || 0) + C.hist[k][sg]; });
        });
        const vals = Object.keys(h).map(Number).sort((a, b) => a - b);
        const tot = vals.reduce((a, v) => a + h[v], 0);
        let ac = 0;
        for (const v of vals) { ac += h[v]; if (ac > Math.floor(tot / 2)) return v; }
        return null;
    })();

    const fila = (rot, sub, a, b, cuenta) => `
      <tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.03);">
        <td style="padding:0.5rem 0.9rem;">${rot}${sub ? `<div style="font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.3);">${sub}</div>` : ''}</td>
        <td style="padding:0.5rem 0.9rem; text-align:right; color:var(--sky); font-weight:700;">${a} s</td>
        <td style="padding:0.5rem 0.9rem; text-align:right; color:var(--warning); font-weight:700;">${b} s</td>
        <td style="padding:0.5rem 0.9rem; text-align:right; color:var(--text-strong); font-weight:800;">${cuenta}</td>
      </tr>`;

    return `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1rem;">
        <div style="flex:1; min-width:240px; background:rgba(var(--ink-rgb), 0.03); border-radius:10px; padding:0.9rem 1rem;">
          <div style="font-size:var(--t-sm); font-weight:800; color:var(--text-strong);">Ya estaba parado ahí</div>
          <div style="font-size:var(--t-lg); font-weight:900; margin:4px 0; color:var(--text-strong);">${sm.mediana} s <span style="color:rgba(var(--ink-rgb), 0.3);">/</span> ${pm.mediana} s</div>
          <div style="font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">Acá sí la caja cuesta más del doble: es el esfuerzo real de manipularla.</div>
        </div>
        <div style="flex:1; min-width:240px; background:rgba(var(--ink-rgb), 0.03); border-radius:10px; padding:0.9rem 1rem;">
          <div style="font-size:var(--t-sm); font-weight:800; color:var(--text-strong);">Tuvo que caminar</div>
          <div style="font-size:var(--t-lg); font-weight:900; margin:4px 0; color:var(--text-strong);">${sc.mediana} s <span style="color:rgba(var(--ink-rgb), 0.3);">/</span> ${pc.mediana} s</div>
          <div style="font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">La diferencia casi desaparece: la caminata pesa igual para los dos.</div>
        </div>
      </div>
      ${remate('El trabajo está en <b style="color:var(--success-soft);">llegar al sitio</b>, no en levantar la caja.')}

      <div style="margin-top:1.2rem; font-size:var(--t-sm); font-weight:900; color:var(--text-strong); letter-spacing:0.4px;">PERO NO CAMINAN LO MISMO</div>
      <div style="font-size:var(--t-sm); color:var(--text-muted); margin:4px 0 0.7rem; line-height:1.7;">
        Un par suelto se saca muchas veces seguidas de la misma ubicación. Una caja, casi nunca: obliga a moverse casi siempre.
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:var(--t-sm); color:var(--text-grey); margin-bottom:1rem;">
        <thead><tr style="color:var(--text-muted); text-align:left;">
          <th style="padding:0.45rem 0.9rem; font-weight:700;"></th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Ya estaba ahí</th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Tuvo que caminar</th>
        </tr></thead>
        <tbody>
          <tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.03);">
            <td style="padding:0.45rem 0.9rem;">Par suelto</td>
            <td style="padding:0.45rem 0.9rem; text-align:right;">${F(sm.n)} <span style="color:rgba(var(--ink-rgb), 0.35);">(${pct(sm.n, totalS)}%)</span></td>
            <td style="padding:0.45rem 0.9rem; text-align:right;">${F(sc.n)} <span style="color:rgba(var(--ink-rgb), 0.35);">(${pct(sc.n, totalS)}%)</span></td>
          </tr>
          <tr>
            <td style="padding:0.45rem 0.9rem;">Caja de prepack</td>
            <td style="padding:0.45rem 0.9rem; text-align:right;">${F(pm.n)} <span style="color:rgba(var(--ink-rgb), 0.35);">(${pct(pm.n, totalP)}%)</span></td>
            <td style="padding:0.45rem 0.9rem; text-align:right;">${F(pc.n)} <span style="color:rgba(var(--ink-rgb), 0.35);">(${pct(pc.n, totalP)}%)</span></td>
          </tr>
        </tbody>
      </table>

      <div style="font-size:var(--t-sm); color:var(--text-muted); margin-bottom:0.6rem; line-height:1.7;">
        Por eso el factor cambia tanto según la situación — y por eso el número real no es ninguno de los dos extremos,
        sino la mezcla que de verdad ocurre:
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:var(--t-sm); color:var(--text-grey);">
        <thead><tr style="color:var(--text-muted); text-align:left;">
          <th style="padding:0.45rem 0.9rem; font-weight:700;">Situación</th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Un suelto tarda</th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Una caja tarda</th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Cuántas veces más</th>
        </tr></thead>
        <tbody>
          ${fila('Los dos ya estaban ahí', 'ninguno camina', sm.mediana, pm.mediana, `${pm.mediana} ÷ ${sm.mediana} = ${(pm.mediana / sm.mediana).toFixed(2)}`)}
          ${fila('Los dos tuvieron que caminar', '', sc.mediana, pc.mediana, `${pc.mediana} ÷ ${sc.mediana} = ${(pc.mediana / sc.mediana).toFixed(2)}`)}
          ${fila('Todo mezclado', 'como pasa de verdad', mezcla, todoPrepack, `${todoPrepack} ÷ ${mezcla} = ${(todoPrepack / mezcla).toFixed(2)}`)}
        </tbody>
      </table>
      <div style="margin-top:0.8rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.4); line-height:1.8;">
        Ya parado en el sitio, la caja cuesta el doble que un par. Pero en cuanto hay que caminar, la caminata pesa igual
        para los dos y la distancia entre ellos se achica.
        <br><b style="color:rgba(var(--ink-rgb), 0.6);">Y ahí aparece una palanca de layout:</b> una caja que obliga a moverse tarda
        ${pc.mediana} s; una que se saca sin moverse, ${pm.mediana} s. Son <b style="color:rgba(var(--ink-rgb), 0.6);">${pc.mediana - pm.mediana} segundos menos por caja</b>.
        Hoy ${F(pc.n)} cajas —el ${pct(pc.n, totalP)}%— obligan a moverse; si el prepack estuviera concentrado en menos
        ubicaciones, ahí hay hasta <b style="color:rgba(var(--ink-rgb), 0.6);">${((pc.mediana - pm.mediana) * pc.n / 3600).toFixed(1)} horas</b> de trabajo en estas ${C.jornadas || 1} jornadas.
      </div>`;
};

const sec5 = (C) => {
    const s = tiempoDe(C, 'suelto');
    const curvas = Object.keys(EQUIVALENCIA_PREPACK.curvas).map(Number).sort((a, b) => a - b);
    const filas = curvas.map(c => {
        const t = tiempoDe(C, String(c));
        if (!t.n) return '';
        const flojo = t.n < EQUIVALENCIA_PREPACK.minimo_muestra;
        const factor = (t.mediana && s.mediana) ? (t.mediana / s.mediana) : null;
        const usa = flojo ? EQUIVALENCIA_PREPACK.factor_general : (factor ? +factor.toFixed(2) : null);
        return `<tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.03);">
          <td style="padding:0.5rem 0.9rem; color:var(--text-strong);">${c} pares</td>
          <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(F(t.n), String(c), 'n')}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(t.mediana + ' s', String(c), 'seg')}</td>
          <td style="padding:0.5rem 0.9rem; text-align:right; font-weight:900; color:${flojo ? 'rgba(var(--ink-rgb), 0.35)' : 'var(--success-soft)'};">${usa ? usa.toFixed(2) : '—'}</td>
          <td style="padding:0.5rem 0.9rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.35);">${flojo ? 'muestra chica: se usa el general' : ''}</td>
        </tr>`;
    }).join('');
    return `
      <table style="width:100%; border-collapse:collapse; font-size:var(--t-sm); color:var(--text-grey);">
        <thead><tr style="color:var(--text-muted); text-align:left;">
          <th style="padding:0.45rem 0.9rem; font-weight:700;">Caja de</th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Cuántas se midieron</th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Tarda</th>
          <th style="padding:0.45rem 0.9rem; text-align:right; font-weight:700;">Equivale a</th>
          <th></th>
        </tr></thead>
        <tbody>
          <tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.06); background:rgba(var(--sky-rgb), 0.05);">
            <td style="padding:0.5rem 0.9rem; color:var(--text-strong); font-weight:700;">1 par suelto</td>
            <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(F(s.n), 'suelto', 'n')}</td>
            <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(s.mediana + ' s', 'suelto', 'seg')}</td>
            <td style="padding:0.5rem 0.9rem; text-align:right; font-weight:900; color:var(--sky);">1.00</td>
            <td style="padding:0.5rem 0.9rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.35);">la referencia</td>
          </tr>
          ${filas}
        </tbody>
      </table>
      <div style="margin-top:0.8rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.4); line-height:1.8;">
        Un par suelto es la referencia y vale 1,00. Cada tamaño de caja vale lo que tarda, comparado con él.
        <b style="color:var(--brand-pale);">Toque cualquier número subrayado</b> para ver de dónde sale.
        Por debajo de ${EQUIVALENCIA_PREPACK.minimo_muestra} mediciones no se usa el factor propio, sino el general
        (${EQUIVALENCIA_PREPACK.factor_general}).
      </div>`;
};

const sec6 = (C, dias) => {
    const curvas = [10, 6, 8, 12].filter(c => tiempoDe(C, String(c)).n > 0);
    if (!curvas.length) return '';
    const tabla = (c) => {
        const filas = dias.map(d => {
            const cr = juntarCronometros([d.pp]);
            const s = tiempoDe(cr, 'suelto'), t = tiempoDe(cr, String(c));
            const pocas = t.n < 30;
            return `<tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.03);">
              <td style="padding:0.4rem 0.9rem;">${DMY(d.dia)}</td>
              <td style="padding:0.4rem 0.9rem; text-align:right; color:var(--text-muted);">${F(s.n)}</td>
              <td style="padding:0.4rem 0.9rem; text-align:right;">${s.mediana ? s.mediana + ' s' : '—'}</td>
              <td style="padding:0.4rem 0.9rem; text-align:right; color:var(--text-muted);">${F(t.n)}</td>
              <td style="padding:0.4rem 0.9rem; text-align:right;">${(!pocas && t.mediana) ? t.mediana + ' s' : '—'}</td>
              <td style="padding:0.4rem 0.9rem; text-align:right; color:${pocas ? 'rgba(var(--ink-rgb), 0.3)' : 'var(--text-strong)'}; font-weight:${pocas ? '400' : '700'};">
                ${(!pocas && t.mediana && s.mediana) ? `${t.mediana} ÷ ${s.mediana} = ${(t.mediana / s.mediana).toFixed(2)}` : 'muy pocas para calcular'}
              </td>
            </tr>`;
        }).join('');
        const s = tiempoDe(C, 'suelto'), t = tiempoDe(C, String(c));
        return `
          <div style="font-size:var(--t-sm); font-weight:900; color:var(--warning); letter-spacing:0.5px; margin:1rem 0 0.4rem;">CAJA DE ${c} PARES</div>
          <div style="overflow:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:var(--t-sm); color:var(--text-grey);">
            <thead><tr style="color:var(--text-muted); text-align:left;">
              <th style="padding:0.4rem 0.9rem; font-weight:700;">Jornada</th>
              <th style="padding:0.4rem 0.9rem; text-align:right; font-weight:700;">Sueltos medidos</th>
              <th style="padding:0.4rem 0.9rem; text-align:right; font-weight:700;">Tarda</th>
              <th style="padding:0.4rem 0.9rem; text-align:right; font-weight:700;">Cajas medidas</th>
              <th style="padding:0.4rem 0.9rem; text-align:right; font-weight:700;">Tarda</th>
              <th style="padding:0.4rem 0.9rem; text-align:right; font-weight:700;">La cuenta</th>
            </tr></thead>
            <tbody>${filas}
              <tr style="border-top:2px solid rgba(var(--ink-rgb), 0.1); font-weight:900; color:var(--text-strong);">
                <td style="padding:0.5rem 0.9rem;">Las ${dias.length} juntas</td>
                <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(F(s.n), 'suelto', 'n')}</td>
                <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(s.mediana + ' s', 'suelto', 'seg')}</td>
                <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(F(t.n), String(c), 'n')}</td>
                <td style="padding:0.5rem 0.9rem; text-align:right;">${abrible(t.mediana + ' s', String(c), 'seg')}</td>
                <td style="padding:0.5rem 0.9rem; text-align:right; color:var(--success-soft);">${t.mediana} ÷ ${s.mediana} = ${(t.mediana / s.mediana).toFixed(2)}</td>
              </tr>
            </tbody>
          </table></div>`;
    };
    return `
      <div style="font-size:var(--t-sm); color:var(--text-muted); line-height:1.8; margin-bottom:0.3rem;">
        El factor es una división: lo que tarda la caja ÷ lo que tarda un par suelto. Acá está la cuenta hecha
        <b style="color:rgba(var(--ink-rgb), 0.6);">jornada por jornada</b>, para que se vea que el número de arriba no sale de un solo día.
        Un día con menos de 30 mediciones no se calcula: no alcanza.
      </div>
      ${curvas.map(tabla).join('')}`;
};

const sec8 = (C) => {
    const ahorro = C.pares_reales - C.pares_wms;
    const viajes = C.mov.cajas ? (C.pares_reales - C.pares_wms) : 0;
    const total = C.mov.suelto + C.mov.prepack;
    const paresEnCaja = C.pares_reales - (C.pares_wms - C.mov.cajas) - C.mov.cajas + C.mov.cajas;
    // Los pares que viajaron en caja: lo que el WMS cuenta como cajas, abierto.
    const paresCaja = C.pares_reales - (C.pares_wms - C.mov.cajas);
    return `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:0.9rem;">
        <div style="flex:1; min-width:200px; text-align:center; background:rgba(var(--ink-rgb), 0.03); border-radius:10px; padding:0.9rem;">
          <div style="font-size:var(--t-xl); font-weight:900; color:var(--success-soft);">${F(viajes)}</div>
          <div style="font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">viajes ahorrados en ${C.jornadas || 1} jornadas</div>
        </div>
        <div style="flex:1; min-width:200px; text-align:center; background:rgba(var(--ink-rgb), 0.03); border-radius:10px; padding:0.9rem;">
          <div style="font-size:var(--t-xl); font-weight:900; color:var(--text-strong);">${pct(paresCaja, C.pares_reales)}%</div>
          <div style="font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">de los pares sale en caja…</div>
        </div>
        <div style="flex:1; min-width:200px; text-align:center; background:rgba(var(--ink-rgb), 0.03); border-radius:10px; padding:0.9rem;">
          <div style="font-size:var(--t-xl); font-weight:900; color:var(--text-strong);">${pct(C.mov.prepack, total)}%</div>
          <div style="font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">…usando solo esta parte de los movimientos</div>
        </div>
      </div>
      <div style="font-size:var(--t-sm); color:rgba(var(--ink-rgb), 0.55); line-height:1.9;">
        Esos <b style="color:var(--text-strong);">${F(paresCaja)} pares</b> salieron en <b style="color:var(--text-strong);">${F(C.mov.cajas)} cajas</b>.
        Si hubieran salido par por par, habrían costado un movimiento cada uno.
      </div>`;
};

/* --- El detalle que se abre ------------------------------------------------- */

const panelDetalle = (C, tipo, campo) => {
    const nombre = tipo === 'suelto' ? 'Pares sueltos' : `Cajas de ${tipo} pares`;
    if (campo === 'n') {
        const pasos = embudoDe(C, tipo);
        if (!pasos.length) return '';
        return `
          <h4 style="margin:0 0 0.2rem; color:var(--text-strong); font-size:var(--t-sm); font-weight:900;">De dónde salen esas ${F(pasos[pasos.length - 1].n)} mediciones</h4>
          <p style="margin:0 0 0.7rem; font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">
            ${nombre}. Es una <b>cantidad</b>, no un tiempo: cuántas veces se pudo cronometrar.
          </p>
          <table style="width:100%; border-collapse:collapse; font-size:var(--t-xs); color:var(--text-grey);">
            <thead><tr style="color:var(--text-muted); text-align:left;">
              <th style="padding:0.35rem 0.7rem; font-weight:700;"></th>
              <th style="padding:0.35rem 0.7rem; text-align:right; font-weight:700;">Quedan</th>
              <th style="padding:0.35rem 0.7rem; font-weight:700;">Por qué se quita</th>
            </tr></thead>
            <tbody>
              ${pasos.map((e, i) => `
                <tr style="${i === pasos.length - 1 ? 'border-top:1px solid rgba(var(--ink-rgb), 0.1); font-weight:800; color:var(--text-strong);' : 'border-bottom:1px solid rgba(var(--ink-rgb), 0.03);'}">
                  <td style="padding:0.35rem 0.7rem;">${esc(e.q)}</td>
                  <td style="padding:0.35rem 0.7rem; text-align:right;"><b>${F(e.n)}</b></td>
                  <td style="padding:0.35rem 0.7rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.35);">${esc(e.p)}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
    }

    const esc2 = escaleraDe(C, tipo);
    if (!esc2) return '';
    const muestras = (C.muestras && C.muestras[tipo]) || [];
    return `
      <h4 style="margin:0 0 0.2rem; color:var(--text-strong); font-size:var(--t-sm); font-weight:900;">De dónde salen esos ${esc2.mediana} segundos</h4>
      <p style="margin:0 0 0.6rem; font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">
        ${nombre}. Se midieron <b>${F(esc2.n)}</b> veces. Así salieron algunas:
      </p>
      ${muestras.length ? `
        <table style="width:100%; border-collapse:collapse; font-size:var(--t-xs); color:var(--text-grey); margin-bottom:0.8rem;">
          <thead><tr style="color:var(--text-muted); text-align:left;">
            <th style="padding:0.35rem 0.7rem; font-weight:700;">Operario</th>
            <th style="padding:0.35rem 0.7rem; text-align:right; font-weight:700;">Movimiento anterior</th>
            <th style="padding:0.35rem 0.7rem; text-align:right; font-weight:700;">Este</th>
            <th style="padding:0.35rem 0.7rem; text-align:right; font-weight:700;">Tardó</th>
            <th style="padding:0.35rem 0.7rem; font-weight:700;">Ubicación</th>
          </tr></thead>
          <tbody>${muestras.map(m => `
            <tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.03);">
              <td style="padding:0.35rem 0.7rem;">${esc(m.user)}</td>
              <td style="padding:0.35rem 0.7rem; text-align:right; color:var(--text-muted);">${esc(m.ant)}</td>
              <td style="padding:0.35rem 0.7rem; text-align:right; color:var(--text-muted);">${esc(m.hora)}</td>
              <td style="padding:0.35rem 0.7rem; text-align:right;"><b>${m.seg} s</b></td>
              <td style="padding:0.35rem 0.7rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.35);">${esc(m.ubi)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : ''}
      <p style="margin:0 0 0.5rem; font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">
        …y así ${F(esc2.n)} veces. Ordenadas de menor a mayor, se toma <b>la del medio</b>:
      </p>
      <table style="width:100%; border-collapse:collapse; font-size:var(--t-xs); color:var(--text-grey);">
        <tbody>${esc2.puestos.map(p => `
          <tr style="${p.medio ? 'background:rgba(var(--warning-rgb), 0.1);' : 'border-bottom:1px solid rgba(var(--ink-rgb), 0.03);'}">
            <td style="padding:0.35rem 0.7rem; text-align:right; color:var(--text-muted);">la nº ${F(p.pos)}</td>
            <td style="padding:0.35rem 0.7rem; text-align:right;"><b style="${p.medio ? 'color:var(--warning); font-size:var(--t-lg);' : ''}">${p.seg} s</b></td>
            <td style="padding:0.35rem 0.7rem; font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.4);">${p.et}${p.medio ? ' ← el número del cuadro' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${esc2.centro.length ? `
        <p style="margin:0.7rem 0 0.35rem; font-size:var(--t-xs); color:var(--text-muted);">Justo en el corte:</p>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${esc2.centro.map((v, i) => `<span style="padding:3px 9px; border-radius:6px; font-size:var(--t-xs); ${i === Math.floor(esc2.centro.length / 2) ? 'background:rgba(var(--warning-rgb), 0.2); color:var(--warning); font-weight:900;' : 'background:rgba(var(--ink-rgb), 0.05); color:rgba(var(--ink-rgb), 0.5);'}">${v} s</span>`).join('')}
        </div>` : ''}`;
};

/* --- La pantalla ------------------------------------------------------------ */

/**
 * Dibuja la pantalla entera dentro de `contenedor`.
 * `dias` es [{dia, pp}] ya filtrado por el rango elegido.
 */
export const pintarPrepack = (contenedor, dias) => {
    if (!contenedor) return;
    if (!dias || !dias.length) {
        contenedor.innerHTML = `
          <div class="glass-panel" style="padding:3rem 2rem; text-align:center; color:var(--text-muted);">
            <div style="font-size:var(--t-2xl); margin-bottom:0.6rem;">📦</div>
            <h4 style="margin:0 0 0.5rem; color:var(--text-main); font-weight:800;">No hay jornadas en el rango elegido</h4>
            <p style="margin:0 auto; max-width:52ch; font-size:var(--t-sm); line-height:1.7;">
              Este análisis se arma con los archivos de picking. Cargalos en <b style="color:var(--brand-pale);">Picking → Archivo Picking</b>.
            </p>
          </div>`;
        return;
    }

    const C = juntarCronometros(dias.map(d => d.pp));
    if (!C) { contenedor.innerHTML = '<div style="padding:2rem; color:var(--text-muted);">Estas jornadas se cargaron con una versión anterior: hay que volver a subir los archivos para tener el cronómetro.</div>'; return; }

    contenedor.innerHTML = `
      <div style="margin-bottom:1.1rem;">
        <div style="font-size:var(--t-xs); color:var(--brand-pale); font-weight:900; letter-spacing:1.5px;">ANÁLISIS DE PICKING</div>
        <h2 style="margin:2px 0 4px; color:var(--text-strong); font-size:var(--t-xl); font-weight:900;">Prepack contra suelto</h2>
        <div style="font-size:var(--t-sm); color:var(--text-muted); line-height:1.7;">
          Cuánto trabajo cuesta de verdad cada uno, y por qué el reporte del WMS se queda corto.
          Datos reales de ${dias.length} ${dias.length === 1 ? 'jornada' : 'jornadas'}, del ${DMY(dias[0].dia)} al ${DMY(dias[dias.length - 1].dia)}.
          <b style="color:rgba(var(--ink-rgb), 0.6);">Nada estimado: todo sale del archivo del WMS.</b>
        </div>
      </div>
      ${seccion(1, 'Qué es cada uno', '', sec1(C))}
      ${seccion(2, 'El problema: hay mercadería que el reporte no ve',
          'El WMS anota 1 por cada caja, sin mirar cuántos pares lleva dentro. Abriendo la curva aparece lo que de verdad salió.', sec2(C, dias))}
      ${seccion(3, 'Cuánto cuesta sacar cada uno', '', sec3(C))}
      ${seccion(4, 'Por qué: el tiempo se va caminando, no cargando',
          'Separando los movimientos según dónde estaba el operario justo antes, se ve de dónde sale el tiempo.', sec4(C))}
      ${seccion(5, 'La tabla de equivalencia', '', sec5(C))}
      ${seccion(6, 'De dónde sale cada factor', '', sec6(C, dias))}
      ${seccion(8, 'Lo que el prepack le ahorra al almacén', '', sec8(C))}
      <div id="pp_detalle"></div>`;

    // Un clic en un número abre, DEBAJO de su propia fila, de dónde sale. Así el
    // detalle no vive apilado en la página: aparece solo cuando se pide.
    contenedor.onclick = (ev) => {
        const a = ev.target.closest('.pp-num');
        if (!a) return;
        ev.preventDefault();
        const yaAbierto = a.classList.contains('pp-on');
        contenedor.querySelectorAll('.pp-fila-det').forEach(t => t.remove());
        contenedor.querySelectorAll('.pp-on').forEach(x => x.classList.remove('pp-on'));
        if (yaAbierto) return;

        const html = panelDetalle(C, a.dataset.tipo, a.dataset.campo);
        if (!html) return;
        a.classList.add('pp-on');
        const tr = a.closest('tr');
        const caja = `<div style="background:rgba(var(--bg-rgb), 0.75); border:1px solid rgba(var(--primary2-rgb), 0.3); border-radius:10px; padding:0.9rem 1.1rem; margin:0.5rem 0;">
            <span class="pp-num" style="float:right; cursor:pointer; color:var(--text-muted); font-size:var(--t-xs);" data-tipo="${a.dataset.tipo}" data-campo="${a.dataset.campo}">cerrar ✕</span>
            ${html}
          </div>`;
        if (tr) {
            const nueva = document.createElement('tr');
            nueva.className = 'pp-fila-det';
            nueva.innerHTML = `<td colspan="${tr.children.length}" style="padding:0;">${caja}</td>`;
            tr.after(nueva);
            nueva.scrollIntoView({ block: 'nearest' });
        } else {
            const div = document.createElement('div');
            div.className = 'pp-fila-det';
            div.innerHTML = caja;
            a.closest('div').after(div);
        }
    };
};
