/**
 * SLOTTING → TAREAS
 *
 * La pantalla donde el equipo trabaja los cuerpos que tienen más de un artículo. Cada tarea
 * junta unos 300 pares por sacar, ordenados por ubicación para no cruzar el almacén.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe todo por `OPC` y quien lo monta
 * —dashboard_v28.js— busca y guarda. Mismo reparto que turno_actividades.js y marcas.js.
 *
 *   OPC.cajon      lo guardado, por jornada: { '2026-08-14': { tareas: [...] } }
 *   OPC.alGuardar  se llama con el cajón entero cuando cambia un estado o una nota
 *   OPC.alBarrer   se llama con BUSCAR AHORA; devuelve el cajón nuevo
 *   OPC.svc        slottingService
 *
 * TODO VA ENCERRADO BAJO `#slt`: los nombres que usa —fila, chip, panel— chocarían sueltos
 * con los del tablero.
 */

export const montarSlotting = (container, OPC = {}) => {
  const svc = OPC.svc;
  let cajon = OPC.cajon || {};
  let fecha = (svc.fechasDe(cajon)[0]) || '';
  let filtro = 'todos';

  const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (n) => (Number(n) || 0).toLocaleString('es-PE');

  const pintar = () => {
    const fechas = svc.fechasDe(cajon);
    const corrida = cajon[fecha];
    const res = svc.resumen(corrida);
    const tareas = ((corrida && corrida.tareas) || [])
        .filter(t => filtro === 'todos' || t.estado === filtro);

    const chip = (id, etiqueta, n, color) => `
      <button class="slt-chip" data-f="${id}" style="
        background:${filtro === id ? color : 'rgba(255,255,255,0.03)'};
        color:${filtro === id ? '#0b0f19' : 'var(--text-muted)'};
        border:1px solid ${filtro === id ? color : 'rgba(255,255,255,0.08)'};
        border-radius:20px; padding:0.35rem 0.9rem; font-size:0.72rem; font-weight:800;
        cursor:pointer; letter-spacing:0.04em; white-space:nowrap;">${etiqueta} · ${n}</button>`;

    container.innerHTML = `
      <div id="slt">
        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:1.1rem 1.4rem; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
            <div>
              <div style="font-size:0.68rem; color:var(--text-muted); font-weight:800; letter-spacing:0.12em; text-transform:uppercase;">
                Tareas de ordenamiento${res.zona ? ' · ' + esc(res.zona) : ''}
              </div>
              <div style="display:flex; align-items:baseline; gap:0.6rem; margin-top:0.35rem; flex-wrap:wrap;">
                <span style="font-size:2rem; font-weight:800; color:#fff; line-height:1;">${res.hecha}</span>
                <span style="font-size:1rem; color:var(--text-muted);">de ${res.total} tareas hechas</span>
                <span style="font-size:1.1rem; font-weight:800; color:#22c55e;">${res.avance}%</span>
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
                ${res.cuerpos} cuerpos con más de un artículo · <b style="color:#94a3b8;">${num(res.pares)} pares</b> por sacar
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
              ${fechas.length > 1 ? `
                <select id="slt_fecha" style="background:rgba(255,255,255,0.04); border:1px solid var(--border);
                        color:#fff; border-radius:7px; padding:0.4rem 0.7rem; font-size:0.75rem; cursor:pointer;">
                  ${fechas.map(f => `<option value="${f}" ${f === fecha ? 'selected' : ''}>${f}</option>`).join('')}
                </select>` : ''}
              ${res.total ? `
                <button id="slt_imprimir" class="btn" style="background:rgba(255,255,255,0.06); width:auto;
                        border:1px solid var(--border); color:#e2e8f0;
                        padding:0.5rem 1.2rem; border-radius:8px; font-size:0.75rem; font-weight:800;">
                  🖨️ IMPRIMIR
                </button>` : ''}
              <button id="slt_barrer" class="btn" style="background:var(--primary); width:auto;
                      padding:0.5rem 1.2rem; border-radius:8px; font-size:0.75rem; font-weight:800;">
                🔍 BUSCAR AHORA
              </button>
            </div>
          </div>
          <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-top:0.9rem;">
            <div style="width:${res.avance}%; height:100%; background:linear-gradient(90deg,#22c55e,#4ade80); border-radius:10px;"></div>
          </div>
          <div style="font-size:0.68rem; color:var(--text-muted); margin-top:0.5rem;">
            ${res.generado ? `Generado: <b style="color:#94a3b8;">${esc(res.generado)}</b>` : 'Todavía no se buscó nada.'}
          </div>
        </div>

        ${res.total ? `
        <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.9rem; flex-wrap:wrap;">
          ${chip('todos', 'Todas', res.total, '#94a3b8')}
          ${chip('pendiente', 'Por hacer', res.pendiente, '#f59e0b')}
          ${chip('proceso', 'En proceso', res.proceso, '#3b82f6')}
          ${chip('hecha', 'Hechas', res.hecha, '#22c55e')}
        </div>` : ''}

        <div style="display:flex; flex-direction:column; gap:0.6rem;">
          ${tareas.length ? tareas.map(tarjeta).join('') : `
            <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted); font-size:0.85rem;
                        background:rgba(255,255,255,0.02); border:1px dashed var(--border); border-radius:10px;">
              ${res.total ? 'No hay tareas con ese filtro.'
                          : 'Todavía no hay tareas. Aprieta <b>BUSCAR AHORA</b> para revisar el almacén.'}
            </div>`}
        </div>
      </div>`;
    enganchar();
  };

  /** Una tarea, con sus líneas a la vista: el operario tiene que ver qué sacar sin abrir nada. */
  function tarjeta(t) {
    const est = svc.ESTADOS[t.estado] || svc.ESTADOS.pendiente;
    return `
      <div style="background:rgba(15,23,42,0.45); border:1px solid var(--border);
                  border-left:4px solid ${est.color}; border-radius:10px; padding:0.85rem 1.1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap;">
            <span style="font-size:1rem; font-weight:800; color:#fff;">TAREA ${t.n}</span>
            <span style="font-size:0.65rem; font-weight:800; padding:2px 9px; border-radius:20px;
                         background:${est.color}22; color:${est.color}; border:1px solid ${est.color}44;">
              ${est.etiqueta.toUpperCase()}</span>
            <span style="font-size:0.72rem; color:var(--text-muted);">
              ${num(t.pares)} pares · ${(t.lineas || []).length} líneas</span>
          </div>
          <select data-n="${t.n}" class="slt-estado" style="background:rgba(255,255,255,0.04);
                  border:1px solid var(--border); color:#fff; border-radius:7px;
                  padding:0.35rem 0.6rem; font-size:0.72rem; cursor:pointer;">
            ${Object.keys(svc.ESTADOS).map(k =>
              `<option value="${k}" ${t.estado === k ? 'selected' : ''}>${svc.ESTADOS[k].etiqueta}</option>`).join('')}
          </select>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:0.7rem; font-size:0.75rem;">
          <thead>
            <tr style="color:var(--text-muted); font-size:0.62rem; letter-spacing:0.08em; text-transform:uppercase;">
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">De dónde</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Sacar</th>
              <th style="text-align:right; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Pares</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Marca</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Temporada</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">A dónde va</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">El cuerpo queda para</th>
            </tr>
          </thead>
          <tbody>
            ${(t.lineas || []).map(l => `
              <tr>
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#fff;">${esc(l.ubi)}</td>
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#f59e0b; font-weight:700;">${esc(l.sku7)}</td>
                <td style="padding:4px 6px; text-align:right; font-family:ui-monospace,Consolas,monospace; color:#fff;">${num(l.pares)}</td>
                <td style="padding:4px 6px; color:#cbd5e1;">${esc(l.marca) || '—'}</td>
                <td style="padding:4px 6px; color:#94a3b8;">${esc(l.temporada) || '—'}</td>
                <!-- EL DESTINO SOLO LO TRAE EL ARRASTRE. Las líneas del cuerpo mezclado dicen
                     qué sacar y el equipo decide adónde; el arrastre lo sabe, porque la tarea
                     de almacenaje ya eligió el cuerpo esa misma noche. -->
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#93c5fd; font-weight:700;">
                  ${l.llevarA ? esc(l.llevarA) : '<span style="color:var(--text-muted); font-family:inherit; font-weight:400;">a criterio</span>'}</td>
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#22c55e;">
                  ${l.motivo === 'arrastre'
                    ? '<span style="color:var(--text-muted); font-family:inherit;">junta la familia</span>'
                    : `${esc(l.dueno)} <span style="color:var(--text-muted);">(${num(l.duenoPares)})</span>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <input class="slt-nota" data-n="${t.n}" value="${esc(t.nota)}" placeholder="Nota..."
               style="width:100%; margin-top:0.6rem; background:rgba(255,255,255,0.02);
               border:1px solid var(--border); color:#cbd5e1; border-radius:6px;
               padding:0.35rem 0.6rem; font-size:0.72rem;">
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
   * EL PAPEL. Diseñado con Daniel el 14-ago-2026, mirando la maqueta y corrigiéndola.
   *
   * Cinco columnas más el tilde: ✓ · Origen · SKU · Talla · Pares · Destino.
   *
   *   EL ORIGEN VA COMPLETO, con nivel. Para SACAR hay que saber exactamente dónde está: el
   *   8517900 tiene la talla 43 partida entre el nivel B y el C del mismo cuerpo. El DESTINO
   *   va con el cuerpo, porque al GUARDAR el nivel no importa — regla del 05-ago.
   *
   *   UNA LÍNEA POR SKU Y TALLA. *"Así podré saber qué tallas voy a sacar"*.
   *
   *   LA BANDA DE LA COLUMNA VA ARRIBA DE LOS TÍTULOS: primero dónde estoy parado, después
   *   qué dice cada casilla. Si la tarea toca dos columnas, se repiten las dos.
   *
   *   TOTAL POR ARTÍCULO con fondo suave al cambiar de código, y UN ARTÍCULO NO SE PARTE
   *   entre dos hojas: sus filas y su total viajan juntos, igual que en el papel de almacenaje.
   *
   *   LA COMPAGINACIÓN VA ARRIBA, a la derecha del subtítulo.
   *
   * Todo en blanco y negro: la impresora del almacén es monocromática, así que los destacados
   * van con fondo gris, nunca con color.
   * ══════════════════════════════════════════════════════════════════════════════ */
  const CSS_PAPEL = `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #58585b; }
    body { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; color: #000; }
    .pg { width: 210mm; height: 297mm; padding: 9mm 7mm; background: #fff;
          margin: 0 auto 6mm; position: relative; overflow: hidden; }
    .t1 { text-align: center; font-size: 26pt; font-weight: 700; line-height: 1.05; }
    .t1.cont { font-size: 18pt; }
    .t2 { text-align: center; font-size: 10.5pt; margin-top: 1mm; position: relative; }
    .pagX { position: absolute; right: 0; top: -0.5mm; font-size: 11pt; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    .firmas { margin-top: 3mm; font-size: 10.5pt; }
    .firmas td { border: 1px solid #888780; height: 10mm; padding: 0 2mm; }
    .firmas .rot { background: #F1EFE8; font-weight: 400; white-space: nowrap; }
    .det { margin-top: 3mm; }
    .det th { border: 1px solid #888780; height: 7mm; text-align: center;
              font-size: 10.5pt; font-weight: 700; background: #F1EFE8; }
    .det td { border: 1px solid #888780; height: 8.5mm; text-align: center;
              padding: 0 1mm; font-size: 12pt; }
    .det td.b { font-weight: 700; }
    .det td.t { font-weight: 700; font-size: 13pt; }
    .det td.dest { background: #F1EFE8; font-weight: 700; font-size: 13pt; }
    .det tr.tot td { background: #E5E3DC; font-weight: 700; height: 7.5mm; font-size: 11pt; }
    .det tr.tt td { background: #2C2C2A; color: #fff; font-weight: 700; height: 8mm; font-size: 12pt; }
    .banda th { background: #2C2C2A; color: #fff; font-weight: 700; text-align: left;
                height: 8mm; font-size: 13pt; letter-spacing: 1.5px; padding: 0 2mm; }
    .tick div { width: 4.6mm; height: 4.6mm; border: 1.5px solid #000; margin: 0 auto; }
    .nota { margin-top: 2.5mm; border: 1px solid #888780; height: 12mm; font-size: 9pt;
            padding: 1mm 2mm; color: #555; }
    .cierre { display: flex; align-items: center; justify-content: center; height: 100%;
              color: #888780; font-size: 13pt; font-weight: 700; text-align: center; }
    @media print { body { background: #fff; } .pg { margin: 0; page-break-after: always; }
                   .pg:last-child { page-break-after: auto; } .noimp { display: none !important; } }
    .noimp { position: sticky; top: 0; z-index: 9; background: #1e293b; color: #e2e8f0;
             padding: 10px 14px; font: 600 13px/1.5 system-ui, sans-serif; text-align: center; }
    .noimp button { background: #4f46e5; color: #fff; border: 0; border-radius: 8px;
             padding: 7px 18px; font: 700 13px system-ui, sans-serif; cursor: pointer; margin-left: 10px; }`;

  const CABECERA = `<tr>
      <th style="width:7%">✓</th><th style="width:26%">Origen</th><th style="width:24%">SKU</th>
      <th style="width:10%">Talla</th><th style="width:10%">Pares</th><th style="width:23%">Destino</th>
    </tr>`;

  /** La columna del almacén de una ubicación: 'SEL-06-01' -> 'SEL-06'. */
  const columnaDe = (ubi) => String(ubi || '').split('-').slice(0, 2).join('-');

  /**
   * Las filas de una tarea, ya en el orden del papel y con las bandas puestas.
   *
   * Cada línea del barrido trae su `detalle` —una entrada por SKU y talla, con la ubicación
   * completa—. Las tareas viejas, guardadas antes de que existiera, no lo traen: para esas se
   * arma una sola fila con lo que hay, que es mejor que no imprimir nada.
   */
  function filasDelPapel(t) {
    const bloques = [];
    let columna = null;
    (t.lineas || []).forEach(l => {
      const col = columnaDe(l.ubi);
      const det = (l.detalle && l.detalle.length)
        ? l.detalle
        : [{ ubi: l.ubi, skuFull: l.sku7, talla: '—', pares: l.pares }];
      const filas = det.map(d => ({ tipo: 'det', ubi: d.ubi, sku: d.skuFull,
                                    talla: d.talla, pares: d.pares, destino: l.llevarA || '' }));
      filas.push({ tipo: 'tot', sku7: l.sku7, pares: l.pares });
      // Un artículo es un BLOQUE: sus filas y su total no se separan nunca
      bloques.push({ columna, nuevaColumna: col !== columna, col, filas });
      columna = col;
    });
    return bloques;
  }

  /** El alto que ocupa cada cosa, en milímetros. Las alturas son fijas y salen del CSS. */
  const ALTO = { det: 8.5, tot: 7.5, banda: 8, titulos: 7, tabla: 3, total: 8, nota: 14.5 };

  function imprimirTareas() {
    const corrida = cajon[fecha] || {};
    const tareas = (corrida.tareas || []).filter(t => filtro === 'todos' || t.estado === filtro);
    if (!tareas.length) return;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
      <title>Slotting · ${esc(fecha)}</title><style>${CSS_PAPEL}</style></head>
      <body><div class="noimp">Tareas de Slotting · ${esc(fecha)}
      <button onclick="window.print()">🖨️ Imprimir</button></div><div id="hojas"></div></body></html>`);
    win.document.close();
    const hojas = win.document.getElementById('hojas');

    tareas.forEach(t => {
      const bloques = filasDelPapel(t);
      const nLineas = bloques.reduce((a, b) => a + b.filas.length - 1, 0);
      const subtitulo = `${esc(fecha)}${corrida.zona ? ' · ' + esc(corrida.zona) : ''}`
                      + ` · ${nLineas} líneas · ${num(t.pares)} pares`;

      // Se reparten los bloques en hojas ANTES de dibujar, así se sabe cuántas son y el
      // "Páginas 1 de 3" sale bien desde la primera. Sin esto habría que dibujar dos veces.
      const paginas = [];
      let actual = [], libre = 0, colActual = null;
      const alturaUtil = (primera) => 297 - 18 - (primera ? 16 + 23 : 13) - ALTO.tabla;
      libre = alturaUtil(true);
      bloques.forEach(b => {
        const cabecera = (b.col !== colActual) ? ALTO.banda + ALTO.titulos : 0;
        const alto = cabecera + b.filas.reduce((a, f) => a + ALTO[f.tipo], 0);
        if (actual.length && alto > libre) {
          paginas.push(actual);
          actual = []; colActual = null;
          libre = alturaUtil(false) - (ALTO.banda + ALTO.titulos)
                - b.filas.reduce((a, f) => a + ALTO[f.tipo], 0);
          actual.push({ ...b, nuevaColumna: true });
          colActual = b.col;
          return;
        }
        libre -= alto;
        actual.push({ ...b, nuevaColumna: b.col !== colActual });
        colActual = b.col;
      });
      if (actual.length) paginas.push(actual);
      // El cierre —total de la tarea y observaciones— va en la última; si no entra, abre una
      if (paginas.length && libre < ALTO.total + ALTO.nota) paginas.push([]);

      paginas.forEach((bloquesDeLaHoja, i) => {
        const primera = i === 0, ultima = i === paginas.length - 1;
        let cuerpo = '', colActual = null;
        bloquesDeLaHoja.forEach(b => {
          if (b.col !== colActual) {
            if (cuerpo) cuerpo += '</tbody></table>';
            cuerpo += `<table class="det"><thead>`
                    + `<tr class="banda"><th colspan="6">COLUMNA ${esc(b.col)}</th></tr>`
                    + CABECERA + `</thead><tbody>`;
            colActual = b.col;
          }
          b.filas.forEach(f => {
            cuerpo += f.tipo === 'det'
              ? `<tr><td class="tick"><div></div></td><td class="b">${esc(f.ubi)}</td>`
                + `<td>${esc(f.sku)}</td><td class="t">${esc(f.talla)}</td>`
                + `<td class="b">${num(f.pares)}</td><td class="dest">${esc(f.destino)}</td></tr>`
              : `<tr class="tot"><td colspan="4">Total ${esc(f.sku7)}</td><td>${num(f.pares)}</td><td></td></tr>`;
          });
        });
        if (cuerpo) cuerpo += '</tbody></table>';
        if (ultima) {
          cuerpo += `<table class="det"><tbody><tr class="tt">`
                  + `<td colspan="4">TOTAL DE LA TAREA</td><td>${num(t.pares)}</td><td></td>`
                  + `</tr></tbody></table><div class="nota">Observaciones:</div>`;
        }

        const pg = win.document.createElement('div');
        pg.className = 'pg';
        pg.innerHTML =
            `<div class="t1${primera ? '' : ' cont'}">SLOTTING · TAREA ${esc(t.n)}${primera ? '' : ' (cont.)'}</div>`
          + `<div class="t2">${subtitulo}<span class="pagX">Páginas ${i + 1} de ${paginas.length}</span></div>`
          + (primera ? `<table class="firmas">
               <tr><td class="rot" style="width:24mm">Nombres</td><td></td>
                   <td class="rot" style="width:16mm">Inicio</td><td style="width:20mm"></td>
                   <td class="rot" style="width:18mm">Término</td><td style="width:20mm"></td></tr>
               <tr><td class="rot">Revisado por</td><td colspan="5"></td></tr>
             </table>` : '')
          + cuerpo;
        hojas.appendChild(pg);
      });

      /* LA IMPRESORA DEL ALMACÉN IMPRIME A DOBLE CARA, y eso obliga a cerrar cada tarea en
       * un número PAR de páginas.
       *
       * Daniel, 15-ago-2026: *"recuerda que la impresora de mi trabajo por defecto imprime a
       * doble cara"*. Sin esto, una tarea de una sola página deja la siguiente al dorso de su
       * misma hoja: el operario se lleva su tarea y sin querer se lleva la del compañero, o
       * se la deja. Y son la mayoría — casi todas las tareas entran en una hoja.
       *
       * Es el mismo problema que ya se había resuelto en el Excel poniendo una HOJA por tarea:
       * ahí Excel arranca cada una en una hoja física nueva. Acá se consigue agregando una
       * página en blanco cuando quedan impares.
       *
       * La hoja en blanco lleva un cartel: sin él parece un error de impresión y alguien la
       * saca, que es justo lo que rompe el emparejado. */
      if (paginas.length % 2 === 1) {
        const blanca = win.document.createElement('div');
        blanca.className = 'pg';
        blanca.innerHTML = `<div class="cierre">Esta hoja va en blanco a propósito.<br>`
                         + `La tarea ${esc(t.n)} termina en la página anterior.</div>`;
        hojas.appendChild(blanca);
      }
    });
  }

  function enganchar() {
    container.querySelectorAll('.slt-chip').forEach(b =>
      b.addEventListener('click', () => { filtro = b.dataset.f; pintar(); }));

    const imp = container.querySelector('#slt_imprimir');
    if (imp) imp.addEventListener('click', imprimirTareas);

    const sf = container.querySelector('#slt_fecha');
    if (sf) sf.addEventListener('change', () => { fecha = sf.value; pintar(); });

    const dameTarea = (n) => ((cajon[fecha] || {}).tareas || []).find(t => String(t.n) === String(n));

    container.querySelectorAll('.slt-estado').forEach(s =>
      s.addEventListener('change', async () => {
        const t = dameTarea(s.dataset.n);
        if (!t) return;
        t.estado = s.value;
        if (OPC.alGuardar) await OPC.alGuardar(cajon);
        pintar();
      }));

    container.querySelectorAll('.slt-nota').forEach(inp => {
      let esperar = null;
      inp.addEventListener('input', () => {
        const t = dameTarea(inp.dataset.n);
        if (!t) return;
        t.nota = inp.value;
        // Con espera: guardar en cada tecla escribiría cientos de veces
        clearTimeout(esperar);
        esperar = setTimeout(() => { if (OPC.alGuardar) OPC.alGuardar(cajon); }, 900);
      });
    });

    const btn = container.querySelector('#slt_barrer');
    if (btn) btn.addEventListener('click', async () => {
      if (!OPC.alBarrer) return;
      btn.disabled = true;
      btn.textContent = '⌛ REVISANDO EL ALMACÉN...';
      try {
        const nuevo = await OPC.alBarrer();
        if (nuevo) { cajon = nuevo; fecha = svc.fechasDe(cajon)[0] || fecha; }
      } catch (e) { console.error('[Slotting] no se pudo barrer:', e); }
      btn.disabled = false;
      pintar();
    });
  }

  pintar();
};
