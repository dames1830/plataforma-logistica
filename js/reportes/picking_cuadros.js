/* ============================================================================
   PICKING — los cuadros del reporte
   ----------------------------------------------------------------------------
   Las secciones que faltaban de la maqueta del 09-ago-2026. Están acá y no en
   `dashboard_v28.js` por lo mismo que la pantalla de prepack: sin depender de
   nada del dashboard se pueden abrir y probar sin entrar con contraseña, que
   es donde se escondió el `esc is not defined` del 11-ago.

   Cada función recibe el resumen ya calculado (`js/reportes/picking.js`) y
   devuelve HTML. Ninguna calcula nada: si un número no cuadra, el problema
   está en el cálculo, no acá.
   ============================================================================ */

const F = (n) => Number(n || 0).toLocaleString('es-PE');
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const pct = (a, b) => b ? (100 * a / b).toFixed(1) : '0.0';

const panel = (titulo, bajada, cuerpo, pie, color = 'rgba(255,255,255,0.06)') => `
  <div class="glass-panel" style="padding:0; overflow:hidden; border:1px solid ${color};">
    <div style="padding:1rem 1.3rem; border-bottom:1px solid rgba(255,255,255,0.06);">
      <h3 style="margin:0; color:#fff; font-size:0.9rem; font-weight:900; letter-spacing:0.5px;">${titulo}</h3>
      ${bajada ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px; line-height:1.6;">${bajada}</div>` : ''}
    </div>
    ${cuerpo}
    ${pie ? `<div style="padding:0.75rem 1.3rem; background:rgba(0,0,0,0.25); font-size:0.68rem; color:rgba(255,255,255,0.4); line-height:1.8;">${pie}</div>` : ''}
  </div>`;

const th = (t, der) => `<th style="padding:0.55rem 0.9rem; text-align:${der ? 'right' : 'left'}; font-weight:700; color:var(--text-muted); font-size:0.7rem;">${t}</th>`;
const td = (t, der, extra = '') => `<td style="padding:0.5rem 0.9rem; text-align:${der ? 'right' : 'left'}; ${extra}">${t}</td>`;
const tabla = (cab, filas, alto) => `
  <div style="overflow:auto; ${alto ? `max-height:${alto};` : ''}">
    <table style="width:100%; border-collapse:collapse; font-size:0.77rem; color:#d1d5db;">
      <thead style="position:sticky; top:0; background:#1e293b;"><tr>${cab}</tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;

/** Barra proporcional, para que la fila se lea sin tener que comparar cifras. */
const barra = (v, max, color) => `
  <div style="background:rgba(255,255,255,0.05); border-radius:4px; height:7px; overflow:hidden; min-width:60px;">
    <div style="width:${max ? (100 * v / max).toFixed(1) : 0}%; height:100%; background:${color};"></div>
  </div>`;

/* --- A qué hora se picó ----------------------------------------------------- */

export const cuadroPorHora = (R) => {
    const d = R.por_hora || [];
    if (!d.length) return '';
    const max = Math.max(...d.map(x => x.pares));
    const pico = d.reduce((a, b) => b.pares > a.pares ? b : a);
    const filas = d.map(x => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          ${td(`<b style="color:#fff;">${String(x.hora).padStart(2, '0')}:00</b>`)}
          ${td(barra(x.pares, max, x.hora === pico.hora ? '#22c55e' : '#6366f1'), false, 'width:45%;')}
          ${td(`<b style="color:#fff;">${F(x.pares)}</b>`, true)}
          ${td(F(x.lineas), true, 'color:var(--text-muted);')}
          ${td(x.personas, true, 'color:var(--text-muted);')}
        </tr>`).join('');
    return panel('🕐 A QUÉ HORA SE PICÓ',
        `El pico es a las <b style="color:#4ade80;">${String(pico.hora).padStart(2, '0')}:00</b>, con ${F(pico.pares)} pares.`,
        tabla(th('Hora') + th('') + th('Pares', 1) + th('Líneas', 1) + th('Personas', 1), filas, '340px'),
        'La hora es la del reloj, no la de la jornada. Con varias fechas elegidas se suma la misma hora de cada día; las personas no se suman —es la misma gente— y se muestra el día más cargado.');
};

/* --- Qué curvas se picaron -------------------------------------------------- */

export const cuadroCurvas = (R) => {
    const d = R.curvas || [];
    if (!d.length) return '';
    const total = d.reduce((s, x) => s + x.pares, 0);
    const tot = d.reduce((s, x) => ({ cajas: s.cajas + x.cajas, lineas: s.lineas + x.lineas, pares: s.pares + x.pares }),
                         { cajas: 0, lineas: 0, pares: 0 });
    const max = Math.max(...d.map(x => x.pares));
    const filas = d.map(x => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          ${td(`<b style="color:#fff;">${x.curva} pares</b>`)}
          ${td(barra(x.pares, max, '#f59e0b'), false, 'width:35%;')}
          ${td(`<b style="color:#fff;">${F(x.cajas)}</b>`, true)}
          ${td(F(x.lineas), true, 'color:var(--text-muted);')}
          ${td(`<b style="color:#fff;">${F(x.pares)}</b>`, true)}
          ${td(pct(x.pares, total) + '%', true, 'color:var(--text-muted);')}
        </tr>`).join('')
      + `<tr style="border-top:2px solid rgba(255,255,255,0.1); font-weight:900; color:#fff;">
          ${td('Total')}${td('')}${td(F(tot.cajas), 1)}${td(F(tot.lineas), 1)}${td(F(tot.pares), 1)}${td('100%', 1)}
        </tr>`;
    return panel('📦 QUÉ CURVAS SE PICARON',
        'De todo lo que salió en caja, qué tamaños de curva fueron.',
        tabla(th('Pares por caja') + th('') + th('Cajas', 1) + th('Líneas', 1) + th('Pares', 1) + th('% de los ' + F(total), 1), filas),
        '<b style="color:rgba(255,255,255,0.6);">Las cajas no son las líneas.</b> Una misma línea puede llevar más de una caja del mismo código: por eso la curva de 10 tiene más cajas que líneas.');
};

/* --- El recorrido ----------------------------------------------------------- */

export const cuadroRecorrido = (R) => {
    const r = R.recorrido;
    if (!r || !r.contenedores) return '';
    const filas = (r.dist || []).map(([zonas, n]) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          ${td(zonas === 1 ? 'Una sola zona' : `${zonas} zonas`)}
          ${td(barra(n, r.contenedores, zonas === 1 ? '#22c55e' : '#f59e0b'), false, 'width:45%;')}
          ${td(`<b style="color:#fff;">${F(n)}</b>`, true)}
          ${td(pct(n, r.contenedores) + '%', true, 'color:var(--text-muted);')}
        </tr>`).join('');
    return panel('🚶 EL RECORRIDO',
        `<b style="color:#fbbf24;">${r.pct}%</b> de los contenedores obliga a visitar más de una zona.`,
        `<div style="padding:1rem 1.3rem; display:flex; gap:1rem; flex-wrap:wrap;">
           <div style="flex:1; min-width:150px;"><div style="font-size:1.4rem; font-weight:900; color:#fff;">${F(r.contenedores)}</div>
             <div style="font-size:0.68rem; color:var(--text-muted);">contenedores armados</div></div>
           <div style="flex:1; min-width:150px;"><div style="font-size:1.4rem; font-weight:900; color:#fbbf24;">${F(r.con_varias_zonas)}</div>
             <div style="font-size:0.68rem; color:var(--text-muted);">obligaron a cambiar de zona</div></div>
           <div style="flex:1; min-width:150px;"><div style="font-size:1.4rem; font-weight:900; color:#fff;">${F(r.lineas_en_multi)}</div>
             <div style="font-size:0.68rem; color:var(--text-muted);">líneas dentro de esos</div></div>
         </div>`
        + tabla(th('El contenedor se armó en') + th('') + th('Contenedores', 1) + th('%', 1), filas),
        'Un contenedor que se arma en una sola zona no obliga a caminar entre pasillos. Cuantos más crucen zonas, más tiempo se va en el traslado y no en sacar.');
};

/* --- Ubicación repetida ----------------------------------------------------- */

export const cuadroRepetida = (R) => {
    const r = R.repetida;
    if (!r || !r.visitas) return '';
    const max = Math.max(...(r.top || []).map(x => x.visitas), 1);
    const filas = (r.top || []).map(x => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          ${td(`<b style="color:#93c5fd;">${esc(x.ubicacion)}</b>`)}
          ${td(barra(x.visitas, max, '#38bdf8'), false, 'width:50%;')}
          ${td(`<b style="color:#fff;">${F(x.visitas)}</b>`, true)}
        </tr>`).join('');
    return panel('📍 UBICACIÓN REPETIDA',
        `<b style="color:#38bdf8;">${r.pct}%</b> de las visitas son volver a un sitio donde ya se estuvo.`,
        `<div style="padding:1rem 1.3rem; display:flex; gap:1rem; flex-wrap:wrap;">
           <div style="flex:1; min-width:140px;"><div style="font-size:1.4rem; font-weight:900; color:#fff;">${F(r.visitas)}</div>
             <div style="font-size:0.68rem; color:var(--text-muted);">visitas en total</div></div>
           <div style="flex:1; min-width:140px;"><div style="font-size:1.4rem; font-weight:900; color:#fff;">${F(r.ubicaciones)}</div>
             <div style="font-size:0.68rem; color:var(--text-muted);">ubicaciones distintas</div></div>
           <div style="flex:1; min-width:140px;"><div style="font-size:1.4rem; font-weight:900; color:#38bdf8;">${F(r.repetidas)}</div>
             <div style="font-size:0.68rem; color:var(--text-muted);">visitas repetidas</div></div>
         </div>`
        + tabla(th('A dónde más se volvió') + th('') + th('Visitas', 1), filas),
        'Las ubicaciones distintas del período son la <b style="color:rgba(255,255,255,0.6);">unión</b>, no la suma: una a la que se fue los nueve días es una sola ubicación, no nueve.');
};

/* --- Las corridas ----------------------------------------------------------- */

export const cuadroCorridas = (R) => {
    const d = R.corridas || [];
    if (!d.length) return '';
    const filas = d.map(x => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          ${td(`<b style="color:#fff;">${esc(x.ola)}</b>`)}
          ${td(F(x.lineas), true)}
          ${td(`<b style="color:#fff;">${F(x.pares)}</b>`, true)}
          ${td(x.personas, true, 'color:var(--text-muted);')}
          ${td(`${x.desde}–${x.hasta}`, true, 'color:var(--text-muted); font-size:0.72rem;')}
          ${td(x.minutos + ' min', true, 'color:var(--text-muted);')}
        </tr>`).join('');
    return panel('🌊 LAS CORRIDAS MÁS GRANDES',
        'Cada corrida es una ola de trabajo del WMS.',
        tabla(th('Corrida') + th('Líneas', 1) + th('Pares', 1) + th('Personas', 1) + th('Franja', 1) + th('Duró', 1), filas, '340px'),
        'Con varias fechas elegidas las corridas no se juntan —cada día tiene las suyas—: se muestran las más grandes del período.');
};

/* --- Los artículos que más salieron ----------------------------------------- */

export const cuadroArticulos = (R) => {
    const d = R.articulos || [];
    if (!d.length) return '';
    const max = Math.max(...d.map(x => x.pares));
    const filas = d.slice(0, 25).map((x, i) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          ${td(`<span style="color:${i < 3 ? '#facc15' : 'var(--text-muted)'}; font-weight:800;">${i + 1}</span>`)}
          ${td(`<b style="color:#fff;">${esc(x.codigo)}</b>`)}
          ${td(esc(x.desc || '').slice(0, 46), false, 'color:var(--text-muted); font-size:0.72rem;')}
          ${td(esc(x.marca), false, 'color:var(--text-muted);')}
          ${td(esc(x.coleccion), false, 'color:var(--text-muted); font-size:0.72rem;')}
          ${td(barra(x.pares, max, '#a78bfa'), false, 'width:14%;')}
          ${td(`<b style="color:#fff;">${F(x.pares)}</b>`, true)}
          ${td(F(x.lineas), true, 'color:var(--text-muted);')}
          ${td(F(x.ubicaciones), true, 'color:var(--text-muted);')}
        </tr>`).join('');
    return panel('🏆 LOS ARTÍCULOS QUE MÁS SALIERON',
        'Los 25 con más pares del período.',
        tabla(th('#') + th('Código') + th('Descripción') + th('Marca') + th('Colección') + th('') + th('Pares', 1) + th('Líneas', 1) + th('Ubicaciones', 1), filas, '420px'),
        'Las ubicaciones son de cuántos sitios distintos salió ese código; con varias fechas se toma el día más amplio.');
};

/* --- Por género ------------------------------------------------------------- */

export const cuadroGenero = (R, cuadroPick) => cuadroPick
    ? cuadroPick('👟 POR GÉNERO', R.genero, R.pares, 'Sale de la jerarquía del propio archivo del WMS, no del Maestro.')
    : '';

/* --- Qué pasó ese día -------------------------------------------------------
   MENSAJES CALCULADOS, NUNCA ESCRITOS A MANO. Cada uno sale de los propios
   números del período y desaparece si no aplica: el de colecciones viejas solo
   se asoma cuando pasan del 3%, y el del día anterior solo con un día elegido.
   Un cuadro con frases fijas envejece mal; éste dice lo que hay.
   -------------------------------------------------------------------------- */

const COLOR_MSG = { bueno: '#4ade80', aviso: '#fbbf24', dato: '#818cf8' };

export const cuadroQuePaso = (R, segmento, ayer) => {
    const u = segmento === 'no_calzado' ? 'unidades' : 'pares';
    const m = [];

    // 1. Contra el día anterior. Solo con UN día elegido: comparar un tramo de
    //    nueve jornadas contra "el anterior" no significa nada.
    if (ayer && ayer.pares) {
        const d = ayer.pares ? Math.round(100 * (R.pares - ayer.pares) / ayer.pares) : 0;
        m.push({ t: `Contra la jornada anterior: ${d >= 0 ? 'más' : 'menos'} ${u}`,
                 d: `${F(R.pares)} ${u} contra ${F(ayer.pares)} (${d >= 0 ? '+' : ''}${d}%), con `
                  + `${R._personas.length} personas contra ${ayer._personas.length} y ${F(R.lineas)} líneas `
                  + `contra ${F(ayer.lineas)}. El promedio por línea pasó de ${ayer.pares_x_linea} a ${R.pares_x_linea}.`,
                 tipo: d >= 0 ? 'bueno' : 'aviso' });
    }

    // 2. La brecha de productividad
    const con = (R.gente || []).filter(p => p.ritmo);
    if (con.length >= 3) {
        const mej = con[0], peo = con[con.length - 1];
        const veces = +(mej.ritmo / peo.ritmo).toFixed(1);
        m.push({ t: 'La distancia entre el que más rinde y el que menos',
                 d: `${esc(mej.usuario)} rinde ${F(mej.ritmo)} y ${esc(peo.usuario)} ${F(peo.ritmo)}: `
                  + `<b>${veces} veces</b>. Son ${con.length} personas con horas suficientes para medirse; `
                  + `las otras ${R._personas.length - con.length} entraron poco rato y no entran en el podio.`,
                 tipo: veces > 2.5 ? 'aviso' : 'dato' });
    }

    // 3. Dónde se camina
    const zl = (R.zonas || []).slice().sort((a, b) => b.lineas - a.lineas)[0];
    if (zl) {
        m.push({ t: `${esc(zl.nom)} es donde más se camina`,
                 d: `${F(zl.lineas)} líneas (${pct(zl.lineas, R.lineas)}% de ${F(R.lineas)}) salieron de ahí, `
                  + `repartidas en ${F(zl.ubicaciones)} ubicaciones distintas, por ${F(zl.pares)} ${u}.`,
                 tipo: 'dato' });
    }

    // 4. Colección vieja: solo si pesa
    const vieja = (R.coleccion || []).filter(x => /^\d{4}/.test(x.nom) && parseInt(x.nom, 10) <= 2025);
    const vp = vieja.reduce((s, x) => s + x.pares, 0);
    if (vp > 0.03 * R.pares) {
        const peor = vieja.reduce((a, b) => b.pares > a.pares ? b : a);
        m.push({ t: 'Sale mercadería de colecciones viejas',
                 d: `${F(vp)} ${u} (${pct(vp, R.pares)}% de ${F(R.pares)}) son de colecciones de 2025 o anteriores. `
                  + `La más pesada es ${esc(peor.nom)} con ${F(peor.pares)} ${u}, ${pct(peor.pares, R.pares)}% del total.`,
                 tipo: 'aviso' });
    }

    // 5. La colección que manda
    const c0 = (R.coleccion || [])[0];
    if (c0) {
        m.push({ t: `La colección que más sale es ${esc(c0.nom)}`,
                 d: `${F(c0.pares)} ${u} (${pct(c0.pares, R.pares)}% de ${F(R.pares)}) en ${F(c0.lineas)} líneas. `
                  + `Se tocaron ${R.coleccion.length} colecciones distintas.`,
                 tipo: 'dato' });
    }

    // 6. La corrida más grande
    const ol = (R.corridas || [])[0];
    if (ol) {
        m.push({ t: 'La corrida más grande',
                 d: `${F(ol.lineas)} líneas y ${F(ol.pares)} ${u} entre ${ol.desde} y ${ol.hasta} `
                  + `(${ol.minutos} minutos) con ${ol.personas} personas. En total hubo ${F(R.olas)} corridas.`,
                 tipo: 'dato' });
    }

    // 7. Solo para el segmento que no es calzado: por qué va aparte
    const t0 = (R.articulos || [])[0];
    if (segmento === 'no_calzado' && t0) {
        m.unshift({ t: 'Por qué esto va aparte',
                    d: `«${esc(String(t0.desc || '').slice(0, 46))}» son ${F(t0.pares)} unidades en ${F(t0.lineas)} líneas. `
                     + `Medir eso junto al calzado ensucia el número: no es lo mismo bajar ${F(t0.pares)} unidades `
                     + `de ${t0.ubicaciones} ubicación(es) que recorrer el almacén par por par.`,
                    tipo: 'aviso' });
    }

    if (!m.length) return '';
    const filas = m.map(x => `
        <div style="padding:0.8rem 1.3rem; border-bottom:1px solid rgba(255,255,255,0.04); border-left:3px solid ${COLOR_MSG[x.tipo]};">
          <div style="font-size:0.82rem; font-weight:800; color:#fff; margin-bottom:3px;">${x.t}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.75;">${x.d}</div>
        </div>`).join('');
    return panel('💬 QUÉ PASÓ EN ESTE PERÍODO',
        'Sale de los propios números: si algo no aplica, no aparece.', filas, '');
};
