/**
 * ROTACIÓN Y PERMANENCIA
 *
 * Son DOS análisis estándar y distintos, y el nombre que eligió Daniel los traduce a los dos:
 *
 *   ROTACIÓN     el FSN de siempre — Fast / Slow / Non-moving.
 *   PERMANENCIA  el aging de inventario: cuánto tiempo lleva la mercadería en el CD.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ACÁ NO SE CALCULA NADA: SE DIBUJA.
 *
 * El cálculo necesita las ~180 fotos diarias de stock, que son 1,3 GB y viven en OneDrive.
 * Lo muele el robot (`generar_rotacion.py`) y publica el área `rotacion_permanencia`; esta
 * pantalla la lee y la pinta. Mismo reparto que el KPI de picking y los SKU sin salida.
 *
 * Si algún día hace falta cambiar el corte de las 10 semanas o la ventana de 3 meses, se
 * tocan EN EL ROBOT. Poniéndolos también acá, las dos cuentas se separarían el primer día
 * que alguien cambie una sola.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe el paquete por `OPC.datos`, igual que
 * marcas.js y turno_actividades.js.
 */

/* Tres clases, no cuatro: el "medio" que tuvo la primera maqueta era un agregado y el FSN
   estándar no lo tiene. */
const CH = {
  NON:  { color: '#f87171', fondo: 'rgba(248,113,113,.15)', nombre: 'Non mover' },
  SLOW: { color: '#fbbf24', fondo: 'rgba(251,191,36,.15)',  nombre: 'Slow' },
  FAST: { color: '#34d399', fondo: 'rgba(52,211,153,.15)',  nombre: 'Fast' }
};
const CLASES = ['NON', 'SLOW', 'FAST'];
const GRUPOS = [
  ['CALZ',   'Calzado',                'pares'],
  ['NOCALZ', 'No calzado',             'unidades'],
  ['SINM',   'Insumos / Materiales',   'unidades']
];

export const montarRotacion = (container, OPC = {}) => {
  const D = (OPC.datos && OPC.datos.articulos) || [];
  const meta = OPC.datos || {};
  const TOPE = meta.topeSemanas || 10;
  const TRAMOS = (meta.tramos && meta.tramos.length ? meta.tramos : [[0, 4], [5, 10], [11, 20], [21, 9999]])
    .map(t => [t[0], t[1], t[1] >= 9999 ? `${t[0]}+` : `${t[0]}-${t[1]}`]);

  let sel = 'CALZ';
  let orden = { k: 'hoy', asc: false };
  let busca = '';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mil = (n) => Number(n || 0).toLocaleString('es-PE');
  const coma = (n) => String(n).replace('.', ',');

  const deGrupo = () => D.filter(f => f.gr === sel);
  const suma = (a) => a.reduce((s, f) => s + (f.hoy || 0), 0);
  const unidad = () => (GRUPOS.find(g => g[0] === sel) || GRUPOS[0])[2];

  /* Se busca sin tildes y sin mayúsculas —nadie escribe "Colección" con tilde en un
     buscador— y se exigen TODAS las palabras, así "bata sandal" encuentra las sandalias
     Bata sin importar el orden. */
  const limpio = (s) => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const coincide = (f, palabras) => {
    const t = limpio(`${f.cod} ${f.marca} ${f.mod} ${f.col}`);
    return palabras.every(p => t.includes(p));
  };

  /* La clave por la que ORDENA no siempre es lo que se ve: la fecha se muestra 18-07 y
     ordena por la ISO —"18-07" y "04-06" como texto ponen junio detrás de julio— y la
     cobertura del non mover ordena como infinito, que es lo que de verdad es. */
  const COLS = [
    { r: 'Código',        k: 'cod',   t: 's' },
    { r: 'Marca',         k: 'marca', t: 's' },
    { r: 'Colec.',        k: 'col',   t: 's', a: 'center' },
    { r: 'Modelo',        k: 'mod',   t: 's' },
    { r: 'Llegó',         k: 'lleg',  t: 's', a: 'center' },
    { r: 'Semanas en CD', k: 'sem',   t: 'n', a: 'right' },
    { r: 'Stock hoy',     k: 'hoy',   t: 'n', a: 'right' },
    { r: 'Salió',         k: 'salio_v', t: 'n', a: 'right' },
    { r: 'Por semana',    k: 'vel',   t: 'n', a: 'right' },
    { r: 'Cobertura',     k: '_cob',  t: 'n', a: 'right' },
    { r: 'Días parado',   k: 'par',   t: 'n', a: 'right' },
    { r: 'Rotación',      k: 'clase', t: 's', a: 'center' }
  ];
  const valor = (f, k) => k === '_cob' ? (f.cob === null || f.cob === undefined ? Infinity : f.cob) : f[k];

  const pintar = () => {
    const F = deGrupo();
    const U = unidad();
    const cl = (c) => F.filter(f => f.clase === c);
    /* EL CRUCE ES LO QUE HAY QUE ATACAR: viejo Y lento a la vez. Un artículo viejo que
       rota bien está viejo porque le reponen, y no es un problema. */
    const duro = F.filter(f => f.sem > TOPE && f.clase !== 'FAST');

    const tarjeta = (color, rotulo, valorTxt, pie, colorValor) => `
      <div style="flex:1; min-width:158px; background:rgba(255,255,255,.03);
                  border:1px solid rgba(255,255,255,.07); border-left:3px solid ${color};
                  border-radius:12px; padding:.9rem 1.1rem;">
        <div style="font-size:.6rem; letter-spacing:.8px; text-transform:uppercase;
                    color:var(--text-muted); margin-bottom:.35rem; font-weight:800;">${rotulo}</div>
        <div style="font-size:1.6rem; font-weight:800; line-height:1.1; color:${colorValor || '#fff'};">${valorTxt}</div>
        <div style="font-size:.68rem; color:#64748b; margin-top:.3rem;">${pie}</div>
      </div>`;

    const filtro = (g) => {
      const n = D.filter(f => f.gr === g[0]);
      const on = sel === g[0];
      return `<button class="rot-g" data-g="${g[0]}" style="
        background:${on ? 'var(--primary)' : 'rgba(255,255,255,0.03)'};
        color:${on ? '#fff' : 'var(--text-muted)'};
        border:1px solid ${on ? 'var(--primary)' : 'rgba(255,255,255,.1)'};
        border-radius:8px; padding:.4rem .8rem; font-size:.72rem; font-weight:700; cursor:pointer;">
        ${g[1]}<small style="display:block; font-size:.6rem; font-weight:400; opacity:.8;">
        ${mil(n.length)} art. · ${mil(suma(n))}</small></button>`;
    };

    // ── La matriz: rotación contra permanencia ──────────────────────────────────
    let matriz = '';
    CLASES.forEach(c => {
      matriz += `<tr><td style="padding:.5rem .7rem; color:${CH[c].color}; font-weight:800;">${CH[c].nombre}</td>`;
      TRAMOS.forEach(t => {
        const x = F.filter(f => f.clase === c && f.sem >= t[0] && f.sem <= t[1]);
        // En rojo lo que está quieto Y viejo a la vez: ahí es donde hay que entrar
        const alerta = c !== 'FAST' && t[0] >= 11;
        matriz += `<td style="padding:.5rem .7rem; text-align:right; border-bottom:1px solid rgba(255,255,255,.04);
                   ${alerta ? 'background:rgba(248,113,113,0.10);' : ''}">
          ${suma(x) ? mil(suma(x)) : '<span style="color:#475569;">0</span>'}
          <span style="display:block; font-size:.62rem; color:#64748b;">${mil(x.length)} art.</span></td>`;
      });
      matriz += `<td style="padding:.5rem .7rem; text-align:right; color:#fff; font-weight:800;
                 border-bottom:1px solid rgba(255,255,255,.04);">${mil(suma(cl(c)))}</td></tr>`;
    });
    matriz += `<tr style="border-top:2px solid rgba(255,255,255,.12); font-weight:800; color:#fff;">
      <td style="padding:.5rem .7rem;">Total</td>`;
    TRAMOS.forEach(t => {
      const x = F.filter(f => f.sem >= t[0] && f.sem <= t[1]);
      matriz += `<td style="padding:.5rem .7rem; text-align:right;">${mil(suma(x))}
        <span style="display:block; font-size:.62rem; color:#64748b; font-weight:400;">${mil(x.length)} art.</span></td>`;
    });
    matriz += `<td style="padding:.5rem .7rem; text-align:right;">${mil(suma(F))}</td></tr>`;

    // ── El detalle ──────────────────────────────────────────────────────────────
    const palabras = limpio(busca).split(/\s+/).filter(Boolean);
    let filas = palabras.length ? F.filter(f => coincide(f, palabras)) : F.slice();
    filas.sort((a, b) => {
      const col = COLS.find(c => c.k === orden.k) || COLS[6];
      let x = valor(a, orden.k), y = valor(b, orden.k);
      if (col.t === 's') { x = String(x || ''); y = String(y || ''); return orden.asc ? x.localeCompare(y) : y.localeCompare(x); }
      return orden.asc ? (x - y) : (y - x);
    });

    const cabecera = COLS.map(c => `
      <th class="rot-ord" data-k="${c.k}" style="padding:.55rem .6rem; font-weight:700;
          color:var(--text-muted); font-size:.64rem; letter-spacing:.4px; text-transform:uppercase;
          white-space:nowrap; cursor:pointer; text-align:${c.a || 'left'};">
        ${c.r}${orden.k === c.k ? (orden.asc ? ' ↑' : ' ↓') : ''}</th>`).join('');

    const cuerpo = filas.slice(0, 600).map(f => {
      const c = CH[f.clase];
      return `<tr style="border-bottom:1px solid rgba(255,255,255,.04);">
        <td style="padding:.5rem .6rem; color:#fff; white-space:nowrap;">${esc(f.cod)}${
          f.nuevo ? '<span style="font-size:.6rem; color:#818cf8; margin-left:4px;">nuevo</span>' : ''}</td>
        <td style="padding:.5rem .6rem; white-space:nowrap;">${esc(f.marca)}</td>
        <td style="padding:.5rem .6rem; text-align:center; color:var(--text-muted); white-space:nowrap;">${esc(f.col)}</td>
        <td style="padding:.5rem .6rem; color:var(--text-muted); min-width:7.5rem;">${esc(f.mod || '')}</td>
        <td style="padding:.5rem .6rem; text-align:center; color:var(--text-muted); white-space:nowrap;">${esc(String(f.lleg).slice(8, 10))}-${esc(String(f.lleg).slice(5, 7))}</td>
        <td style="padding:.5rem .6rem; text-align:right; font-weight:800; white-space:nowrap;
            color:${f.sem > 20 ? '#f87171' : f.sem > TOPE ? '#fbbf24' : 'var(--text-muted)'};">${f.sem}</td>
        <td style="padding:.5rem .6rem; text-align:right; color:#fff; white-space:nowrap;">${mil(f.hoy)}</td>
        <td style="padding:.5rem .6rem; text-align:right; white-space:nowrap;
            color:${f.salio_v ? '#34d399' : '#475569'};">${mil(f.salio_v)}</td>
        <td style="padding:.5rem .6rem; text-align:right; color:var(--text-muted); white-space:nowrap;">${f.vel ? coma(f.vel) : '0'}</td>
        <td style="padding:.5rem .6rem; text-align:right; white-space:nowrap; color:${c.color};">${
          f.cob === null || f.cob === undefined ? 'sin salidas'
            : (f.cob >= 999 ? '+999 sem' : coma(f.cob) + ' sem')}</td>
        <td style="padding:.5rem .6rem; text-align:right; white-space:nowrap;
            color:${f.par >= 60 ? '#f87171' : f.par >= 28 ? '#fbbf24' : 'var(--text-muted)'};">${mil(f.par)}</td>
        <td style="padding:.5rem .6rem; text-align:center;"><span style="font-size:.62rem; font-weight:800;
            padding:2px 7px; border-radius:5px; color:${c.color}; background:${c.fondo};">${c.nombre}</span></td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div id="rot">
        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding-bottom:.9rem;
                    margin-bottom:1.2rem; border-bottom:1px solid rgba(255,255,255,.05);">
          <h3 style="font-size:1rem; font-weight:800; letter-spacing:.4px; margin:0; color:#fff;">Rotación y Permanencia</h3>
          <span style="font-size:.68rem; color:var(--text-muted);">
            ventana de ${meta.mesesVentana || 3} meses · ${esc(meta.desde || '')} al ${esc(meta.hasta || '')}
            · ${mil(meta.fotos || 0)} fotos${meta.generado ? ' · generado ' + esc(meta.generado) : ''}</span>
          <div style="display:flex; gap:6px; margin-left:auto; flex-wrap:wrap;">${GRUPOS.map(filtro).join('')}</div>
        </div>

        ${sel === 'SINM' ? `
          <div style="background:rgba(251,191,36,.08); border:1px solid rgba(251,191,36,.25); border-radius:10px;
                      padding:.7rem 1rem; font-size:.74rem; color:#fbbf24; margin-bottom:1.2rem; line-height:1.6;">
            <b>Esto no es mercadería: son insumos y materiales.</b> Etiquetas, hang tags y cartones.
            Un rollo de 10.000 etiquetas cuenta como 10.000 unidades, así que inflan el stock y no dicen
            nada de la rotación de la mercadería. Están acá para que se vean, no para medirlos con la misma vara.
          </div>` : ''}

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:1.4rem;">
          ${tarjeta('#818cf8', U.charAt(0).toUpperCase() + U.slice(1) + ' en el CD', mil(suma(F)), mil(F.length) + ' artículos')}
          ${tarjeta('#f87171', 'Non movers', mil(suma(cl('NON'))), mil(cl('NON').length) + ' artículos · sin salidas en la ventana', '#f87171')}
          ${tarjeta('#fbbf24', 'Slow movers', mil(suma(cl('SLOW'))), mil(cl('SLOW').length) + ' artículos · cobertura > ' + TOPE + ' sem')}
          ${tarjeta('#34d399', 'Fast movers', mil(suma(cl('FAST'))), mil(cl('FAST').length) + ' artículos · cobertura ≤ ' + TOPE + ' sem')}
          ${tarjeta('#f87171', 'Viejos Y lentos', mil(suma(duro)), mil(duro.length) + ' artículos · +' + TOPE + ' sem y no rotan', '#f87171')}
        </div>

        <h4 style="font-size:.72rem; font-weight:800; letter-spacing:1px; text-transform:uppercase;
                   margin:1.4rem 0 .6rem; color:#fff;">La foto de un golpe
          <span style="font-weight:400; text-transform:none; letter-spacing:0; color:#64748b; font-size:.72rem; margin-left:.5rem;">
            — ${U} por rotación y semanas en el CD · en rojo, lo que está quieto <b>y</b> viejo: ahí es donde hay que entrar</span></h4>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:.78rem; color:#d1d5db; min-width:640px;">
            <thead><tr style="background:#1e293b;">
              <th style="padding:.55rem .7rem; text-align:left; color:var(--text-muted); font-size:.64rem; text-transform:uppercase;">Rotación</th>
              ${TRAMOS.map(t => `<th style="padding:.55rem .7rem; text-align:right; color:var(--text-muted); font-size:.64rem; text-transform:uppercase;">${t[2]} sem</th>`).join('')}
              <th style="padding:.55rem .7rem; text-align:right; color:var(--text-muted); font-size:.64rem; text-transform:uppercase;">Total</th>
            </tr></thead>
            <tbody>${matriz}</tbody>
          </table>
        </div>

        <h4 style="font-size:.72rem; font-weight:800; letter-spacing:1px; text-transform:uppercase;
                   margin:1.6rem 0 .6rem; color:#f87171; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          El detalle
          <span style="font-weight:400; text-transform:none; letter-spacing:0; color:#64748b; font-size:.72rem;">
            ${mil(filas.length)} artículo${filas.length === 1 ? '' : 's'}${filas.length > 600 ? ' · se muestran los primeros 600' : ''}</span>
          <input id="rot_busca" type="search" autocomplete="off" value="${esc(busca)}"
                 placeholder="Filtrar por código, marca, modelo o colección..."
                 style="margin-left:auto; background:rgba(255,255,255,0.04); color:#fff;
                 border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:.4rem .7rem;
                 font-size:.75rem; min-width:17rem; font-weight:400;">
        </h4>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:.78rem; color:#d1d5db;">
            <thead><tr style="background:#1e293b;">${cabecera}</tr></thead>
            <tbody>${cuerpo || `<tr><td colspan="12" style="padding:2rem; text-align:center; color:var(--text-muted);">
              No hay artículos con ese filtro.</td></tr>`}</tbody>
          </table>
        </div>

        <div style="margin-top:1rem; font-size:.72rem; color:#64748b; line-height:1.8;">
          <b style="color:#94a3b8;">Análisis FSN</b> (Fast / Slow / Non-moving) más
          <b style="color:#94a3b8;">aging de inventario</b>: son dos análisis estándar y distintos,
          y el nombre del reporte traduce los dos.
          <br>Se mide por <b style="color:#94a3b8;">artículo</b>, no por SKU: se suman todas las tallas del código.
          <br><b style="color:#94a3b8;">La ventana es fija e igual para todos.</b> Es lo que hace comparable
          a un artículo que llegó hace dos semanas con uno que lleva ocho meses.
          <b style="color:#94a3b8;">Non mover</b> es el que no tuvo <i>ninguna</i> salida en la ventana
          —no "nunca en su vida"—.
          <br><b style="color:#94a3b8;">Cobertura</b>: a este ritmo, cuántas semanas más tarda en agotarse.
          <b style="color:#94a3b8;">Fast</b> es el que no llega a las ${TOPE} semanas; <b style="color:#94a3b8;">slow</b>, el que las pasa.
          <br>Los marcados <span style="color:#818cf8;">nuevo</span> llevan menos de ${meta.nuevoSemanas || 4} semanas
          en el CD: su ritmo todavía es flojo y conviene no sacar conclusiones.
          <br>Lo que salió es la suma de las <b style="color:#94a3b8;">bajadas</b>, no "entró menos queda":
          un artículo que bajó 300 y después recibió 500 movió 300, no −200.
          <br><b style="color:#94a3b8;">Las semanas en el CD son "por lo menos".</b> Se cuentan desde la
          primera foto en la que aparece el artículo, y la historia empieza el ${esc(String(meta.desdeHistoria || '').slice(0, 10) || '02-01-2026')}:
          lo que ya estaba antes marca el tope y puede llevar más tiempo del que dice.
          <br>Sin ABC por valor: no tenemos el costo del artículo en ninguna fuente.
        </div>
      </div>`;

    enganchar();
  };

  function enganchar() {
    container.querySelectorAll('.rot-g').forEach(b =>
      b.addEventListener('click', () => { sel = b.dataset.g; pintar(); }));

    container.querySelectorAll('.rot-ord').forEach(th =>
      th.addEventListener('click', () => {
        const k = th.dataset.k;
        orden = (orden.k === k) ? { k, asc: !orden.asc } : { k, asc: false };
        pintar();
      }));

    const b = container.querySelector('#rot_busca');
    if (b) {
      let esperar = null;
      b.addEventListener('input', () => {
        clearTimeout(esperar);
        // Con espera: son cientos de filas y redibujar en cada tecla se siente pesado
        esperar = setTimeout(() => {
          const donde = b.selectionStart;
          busca = b.value;
          pintar();
          const nuevo = container.querySelector('#rot_busca');
          if (nuevo) { nuevo.focus(); nuevo.setSelectionRange(donde, donde); }
        }, 250);
      });
    }
  }

  pintar();
};
