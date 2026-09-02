/* ══════════════════════════════════════════════════════════════════════════════
 * LA PANTALLA DE CAPACIDAD
 *
 * Dibuja los cinco pasos. La CUENTA no vive aca: esta en services_v245/capacidadService.js
 * y se comprueba sola contra los datos de verdad, sin abrir la pantalla.
 *
 * Los cinco pasos, en el orden en que se leen:
 *
 *   1. CUANTO ENTRA      el cubicaje, medido sobre la foto del robot
 *   2. DONDE VA          la marca manda la zona
 *   3. CUANTO BAJA       lo decide el CASO del articulo, no su marca
 *   4. COMO SE REPARTE   de 800 pares, cuantos a cada talla
 *   5. HASTA CUANTO      el tope, con la perilla
 *
 * Arriba de todo va el SEMAFORO, que es la pregunta que hoy no hace nadie: la de "¿entra
 * en el cuerpo?" ya esta en el paso 5, pero nadie mira si entra en el ALMACEN.
 * ══════════════════════════════════════════════════════════════════════════════ */

import { calcularCapacidad, pideConPerilla, perillaQueEntra, traerConfig, publicarTopes, RANGOS }
  from '../services_v245/capacidadService.js?v=29.0551';

const mil = (n) => Math.round(Number(n) || 0).toLocaleString('es-PE');
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* El estilo va con la pantalla y no en el css general: es de esta sola vista, y asi no
   engorda lo que carga toda la plataforma. Todo el color sale del tema. */
const CSS = `
#cap { --azul: var(--primary-2); }
#cap .tapa { background: var(--azul); border-radius: 12px 12px 0 0; padding: .9rem 1.2rem;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
#cap .tapa h1 { margin: 0; color: #fff; font: 800 17px/1.2 var(--font-ui), sans-serif;
  letter-spacing: 1.1px; text-transform: uppercase; }
#cap .tapa .sub { color: rgba(255,255,255,.72); font-size: var(--t-xs); }
#cap .sello { margin-left: auto; color: rgba(255,255,255,.72); font-size: var(--t-xs);
  text-align: right; line-height: 1.5; }
#cap .semaforo { background: var(--panel-solid); border: 1px solid var(--border); border-top: 0;
  border-radius: 0 0 12px 12px; padding: 1rem 1.2rem 1.1rem; margin-bottom: 1.1rem; }
#cap .barra { display: flex; height: 26px; border-radius: 5px; overflow: hidden;
  background: rgba(var(--ink-rgb), .05); margin: 5px 0 3px; }
#cap .barra i { display: block; height: 100%; }
#cap .rot { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  font-size: var(--t-xs); color: var(--text-muted); }
#cap .rot b { color: var(--text-strong); font-size: var(--t-sm); font-weight: 800; }
#cap .veredicto { margin-top: .8rem; padding: .6rem .85rem; border-radius: 8px;
  font-size: var(--t-sm); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
#cap .veredicto b { font-size: var(--t-md); font-weight: 900; }
#cap .mal { background: rgba(var(--danger-rgb), .12); color: var(--danger);
  border: 1px solid rgba(var(--danger-rgb), .35); }
#cap .bien { background: rgba(var(--success-rgb), .12); color: var(--success);
  border: 1px solid rgba(var(--success-rgb), .35); }
#cap .paso { background: var(--panel-solid); border: 1px solid var(--border);
  border-radius: 11px; margin-bottom: .7rem; overflow: hidden; }
#cap .paso > summary { list-style: none; cursor: pointer; padding: .75rem 1rem;
  display: flex; align-items: center; gap: 12px; user-select: none; }
#cap .paso > summary::-webkit-details-marker { display: none; }
#cap .paso > summary:hover { background: rgba(var(--ink-rgb), .03); }
#cap .num { flex: none; width: 25px; height: 25px; border-radius: 50%; background: var(--azul);
  color: #fff; font: 800 12px/25px var(--font-ui), sans-serif; text-align: center; }
#cap .tit { color: var(--text-strong); font-weight: 800; font-size: var(--t-sm); letter-spacing: .4px; }
#cap .qhace { color: var(--text-muted); font-size: var(--t-xs); }
#cap .chev { margin-left: auto; color: var(--text-muted); font-size: var(--t-xs); transition: transform .15s; }
#cap .paso[open] .chev { transform: rotate(90deg); }
#cap .cuerpo { padding: 0 1rem 1rem; }
#cap table { width: 100%; border-collapse: collapse; font-size: var(--t-sm); }
#cap th { padding: .42rem .6rem; text-align: left; font-size: var(--t-xs); font-weight: 700;
  letter-spacing: .07em; color: var(--text-muted); text-transform: uppercase;
  border-bottom: 1px solid var(--border); white-space: nowrap; }
#cap td { padding: .36rem .6rem; color: var(--text-main);
  border-bottom: 1px solid rgba(var(--ink-rgb), .04); }
#cap td.n, #cap th.n { text-align: right; font-variant-numeric: tabular-nums; }
#cap td.c, #cap th.c { text-align: center; }
#cap .celda { display: flex; flex-direction: column; align-items: center; gap: 1px; }
#cap .chip { font-size: 9.5px; padding: 1px 5px; border-radius: 20px; white-space: nowrap; }
#cap .medido { background: rgba(var(--success-rgb), .14); color: var(--success); }
#cap .heredado { background: rgba(var(--ink-rgb), .08); color: var(--text-muted); }
#cap .sinmed { background: rgba(var(--danger-rgb), .12); color: var(--danger); }
#cap .apagado { color: var(--text-muted); }
#cap input[type=number] { width: 64px; padding: .24rem 0; text-align: center; font-weight: 800;
  font-size: var(--t-sm); background: var(--panel-deeper); color: var(--text-strong);
  border: 1px solid var(--border); border-radius: 6px; outline: none; font-family: inherit; }
#cap input.rojo { border-color: var(--danger); background: rgba(var(--danger-rgb), .12); }
#cap .boton { background: var(--azul); color: #fff; border: 0; border-radius: 7px;
  padding: .45rem .85rem; font: 700 12px var(--font-ui), sans-serif; cursor: pointer; letter-spacing: .3px; }
#cap .boton.claro { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
#cap .boton:hover { filter: brightness(1.15); }
#cap .filtros { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: .2rem 0 .7rem; }
#cap .f { border: 1px solid var(--border); background: transparent; color: var(--text-muted);
  border-radius: 20px; padding: .22rem .7rem; font-size: var(--t-xs); cursor: pointer; font-family: inherit; }
#cap .f.on { background: var(--azul); color: #fff; border-color: var(--azul); }
#cap .nota { font-size: var(--t-xs); color: var(--text-muted); line-height: 1.65; margin: .1rem 0 .7rem; }
#cap .aviso { margin-top: .5rem; padding: .5rem .7rem; border-radius: 7px; font-size: var(--t-xs);
  background: rgba(var(--danger-rgb), .1); color: var(--danger); border: 1px solid rgba(var(--danger-rgb), .3); }
#cap .scroll { max-height: 430px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
#cap .scroll thead th { position: sticky; top: 0; background: var(--panel-solid); z-index: 1; }
#cap .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: .5rem; }
#cap .tarj { border: 1px solid var(--border); border-radius: 8px; padding: .5rem .7rem; }
#cap .tarj .m { color: var(--text-strong); font-weight: 800; font-size: var(--t-sm); }
#cap .tarj .d { color: var(--text-muted); font-size: var(--t-xs); }
#cap .franja { display: flex; height: 6px; border-radius: 4px; overflow: hidden;
  background: rgba(var(--ink-rgb), .06); margin-top: 3px; }
#cap .tallas { display: flex; flex-wrap: wrap; gap: 5px; margin-top: .45rem; }
#cap .tll { width: 44px; text-align: center; }
#cap .tll b { display: block; font-size: var(--t-xs); font-weight: 400; color: var(--text-muted); }
#cap .tll span { display: block; font-size: 10px; color: var(--text-muted); }
#cap .tll.com b { font-weight: 900; color: var(--text-strong); }
#cap .tll.com span { color: var(--text-strong); }
#cap .todo { background: rgba(var(--cyan-neon-rgb), .16); color: var(--cyan-neon); }
#cap .escolar { background: rgba(var(--violet-rgb), .16); color: var(--violet); }
#cap .uncuerpo { background: rgba(var(--primary-rgb), .16); color: var(--primary); }
#cap .estimada { background: rgba(var(--warning-rgb), .14); color: var(--warning); }
#cap input.estimada { border-color: rgba(var(--warning-rgb), .5); }
`;

/**
 * @param container  donde se dibuja
 * @param opciones   { config, maestro, activo, guardar(topes), avisar(titulo, texto, tipo) }
 */
export async function renderCapacidad(container, opciones) {
  const O = opciones || {};
  container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center;
      color:var(--text-muted);">Midiendo el almacén…</div>`;

  /* La configuracion se trae del servidor, no del cache de esta PC: los objetivos los
     puede haber cambiado otro. */
  let config = O.config;
  if (!config) {
    try { config = await traerConfig(); }
    catch (e) {
      container.innerHTML = `<div class="glass-panel" style="padding:2.5rem; text-align:center;">
        <h3 style="color:var(--danger); margin:0 0 .6rem;">No se pudo leer la configuración</h3>
        <p style="color:var(--text-muted); margin:0; font-size:var(--t-sm);">${esc(e.message)}</p></div>`;
      return;
    }
  }
  if (!container.isConnected) return;
  const D = calcularCapacidad(config, O.maestro, O.activo);
  if (!container.isConnected) return;

  if (!D.topes.length) {
    container.innerHTML = `<div class="glass-panel" style="padding:2.5rem; text-align:center;">
      <h3 style="color:var(--text-strong); margin:0 0 .6rem;">No hay con qué medir</h3>
      <p style="color:var(--text-muted); margin:0; font-size:var(--t-sm);">
        Falta el stock del piso o el Maestro de artículos. Cargue el análisis SKU y vuelva.</p></div>`;
    return;
  }

  /* Lo escrito a mano. Es lo UNICO que se guarda: todo lo demas se vuelve a medir con
     cada foto que sube el robot. */
  const tuyo = new Map(D.topes.map((t, i) => [i, t.tuyo]));
  let pctCuerpo = null;                 // null = como está hoy, escrito a mano
  let tocado = false;

  const pisoAguanta = D.semaforo.hay + D.semaforo.libre;
  const pctQueEntra = perillaQueEntra(D, pisoAguanta);
  const pctConColchon = perillaQueEntra(D, pisoAguanta * 0.88);

  container.innerHTML = `<style>${CSS}</style>
    <div id="cap">
      <div class="tapa">
        <div>
          <h1>Capacidad</h1>
          <div class="sub">Todo lo que decide cuánta mercadería aguanta el piso, en un solo lugar</div>
        </div>
        <div class="sello">
          ${mil(D.semaforo.cuerpos)} cuerpos ocupados · ${mil(D.semaforo.vacios)} vacíos<br>
          se vuelve a medir con cada foto que sube el robot
        </div>
      </div>
      <div class="semaforo" id="capSemaforo"></div>
      <div id="capPasos"></div>
    </div>`;

  const $ = (s) => container.querySelector(s);

  /* ══ EL SEMAFORO ═══════════════════════════════════════════════════════════
     Dos barras a la misma escala: lo que el piso aguanta y lo que los topes piden. */
  const pintarSemaforo = () => {
    const pide = D.topes.reduce((a, t, i) => a + t.skus * (tuyo.get(i) || 0), 0);
    const cabe = pisoAguanta;
    const tope = Math.max(pide, cabe) || 1;
    const p = (v) => (v / tope * 100).toFixed(2) + '%';
    const falta = pide - cabe;
    $('#capSemaforo').innerHTML = `
      <div class="rot"><span>EL PISO AGUANTA</span><span><b>${mil(cabe)}</b> pares</span></div>
      <div class="barra">
        <i style="width:${p(D.semaforo.hay)}; background:var(--primary-2);" title="ya hay"></i>
        <i style="width:${p(D.semaforo.libre)}; background:var(--blue-mid);" title="queda libre"></i>
      </div>
      <div class="rot" style="margin-bottom:.9rem;">
        <span>ya hay <b style="font-size:var(--t-xs);">${mil(D.semaforo.hay)}</b>
          · queda libre <b style="font-size:var(--t-xs);">${mil(D.semaforo.libre)}</b></span>
      </div>
      <div class="rot"><span>LO QUE PIDEN TUS TOPES</span><span><b>${mil(pide)}</b> pares</span></div>
      <div class="barra">
        <i style="width:${p(Math.min(pide, cabe))}; background:var(--success);"></i>
        ${falta > 0 ? `<i style="width:${p(falta)}; background:var(--danger);"></i>` : ''}
      </div>
      <div class="veredicto ${falta > 0 ? 'mal' : 'bien'}">
        ${falta > 0
          ? `<b>NO ENTRA</b> faltan ${mil(falta)} pares de sitio, unos
             ${mil(falta / D.semaforo.capProm)} cuerpos más de los que tiene el almacén.`
          : `<b>ENTRA</b> sobran ${mil(-falta)} pares de sitio — el piso quedaría al
             <b>${(pide / cabe * 100).toFixed(1).replace('.', ',')}%</b>.`}
      </div>
      ${falta <= 0 && pide / cabe > 0.92 ? `<div class="nota" style="margin:.5rem 0 0;">
        Entra, pero <b style="color:var(--text-strong)">sin aire</b>: una llegada grande no
        tendría dónde caer. Bajando la perilla del paso 5 se deja colchón.</div>` : ''}`;
  };

  /* ══ PASO 1 · CUANTO ENTRA ═══════════════════════════════════════════════ */
  const paso1 = () => {
    const filas = D.cubicaje.map(f => `<tr>
        <td style="color:var(--text-strong); font-weight:800;">${esc(f.tipo)}</td>
        ${RANGOS.map(r => {
          const c = f.rangos[r];
          if (!c.cap) return `<td class="c"><span class="chip sinmed">sin medir</span></td>`;
          return `<td class="c"><div class="celda">
              <b style="color:var(--text-strong); font-size:var(--t-sm);">${mil(c.cap)}</b>
              <span class="chip ${c.fuente === 'medido' ? 'medido' : 'estimada'}">${
                c.fuente === 'medido' ? c.n + ' art. medidos' : 'estimado'}</span>
            </div></td>`;
        }).join('')}
      </tr>`).join('');
    const faltan = RANGOS.reduce((a, r) => a + (D.sinCubicar[r] || 0), 0);
    return `
      <p class="nota"><b style="color:var(--text-strong)">De acá sale todo lo demás.</b>
        Un cuerpo guarda el artículo entero, así que lo que entra se reparte entre las tallas
        de su rango. Un deportivo chico entra varias veces más que uno grande: por eso un
        tope parejo no puede estar bien en las dos puntas.</p>
      <table>
        <thead><tr><th>TIPO</th>${RANGOS.map(r =>
          `<th class="c">${r}<br><span style="font-weight:400; text-transform:none;">${
            D.tallasPorRango[r]} tallas</span></th>`).join('')}</tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p class="nota" style="margin-top:.7rem;">
        <span class="chip medido">medido</span> sale de los artículos que el robot ya cubicó.
        <span class="chip estimada">estimado</span> no está cubicado: se baja desde el rango
        medido más cercano con el encogimiento que muestran los propios datos
        (<b style="color:var(--text-strong)">×${D.encoge}</b> de un rango al siguiente).</p>
      <div class="aviso" style="background:rgba(var(--ink-rgb),.05); color:var(--text-muted);
           border-color:var(--border);">Para que dejen de ser estimados hay que cubicar
        <b style="color:var(--text-strong)">${mil(D.sinCubicar['45+'])} artículos de 45 a más</b>.
        En todo el almacén quedan ${mil(faltan)} artículos sin cubicar.</div>`;
  };

  /* ══ PASO 2 · DONDE VA ═══════════════════════════════════════════════════ */
  const paso2 = () => `
    <p class="nota">La marca manda la zona, y dentro de la zona sus columnas. Esto no cambia:
      solo se muestra acá para no tener que ir a otra pantalla a mirarlo.</p>
    <div class="rejilla">${Object.keys(D.zonasMarca).sort().map(m => {
      const z = D.zonasMarca[m] || {};
      return `<div class="tarj">
        <div class="m">${esc(m)}</div>
        <div class="d">${esc(z.zona || '—')} · ${z.columnas && z.columnas.length
          ? 'columnas ' + z.columnas.join(', ') : 'toda la zona'}</div>
      </div>`;
    }).join('')}</div>
    <!-- Acá se monta el editor DE VERDAD, el mismo que estaba en Análisis SKU → Zonas de
         Almacenaje. No es una copia: es esa pantalla, traída a su paso. -->
    <div id="capZonas" style="margin-top:1rem;"></div>`;

  /* ══ PASO 3 · CUANTO BAJA ════════════════════════════════════════════════ */
  const paso3 = () => {
    const ETIQ = { porcentaje: 'porcentaje del stock', cuerpos: 'llenar N cuerpos',
                   todo: 'todo lo que llegue', caso: 'la decide el caso' };
    return `
      <p class="nota">De lo que Recepción deja en el buffer, cuánto se almacena abajo y cuánto
        sube a reserva. <b style="color:var(--text-strong)">Lo decide el caso del artículo, no
        su marca.</b> Se pregunta en este orden y manda el primero que dice que sí.</p>
      <table>
        <thead><tr><th class="n" style="width:26px;">#</th><th>SI EL ARTÍCULO ES…</th>
          <th>BAJA AL PISO</th><th>POR QUÉ</th></tr></thead>
        <tbody>${D.casos.map((c, i) => `<tr>
          <td class="n apagado">${i + 1}</td>
          <td style="color:var(--text-strong); font-weight:700;">${esc(c.n)}</td>
          <td style="color:var(--text-strong); font-weight:800;">${esc(c.q)}</td>
          <td class="apagado">${esc(c.p)}</td></tr>`).join('')}</tbody>
      </table>
      <table style="margin-top:.9rem;">
        <thead><tr><th>MARCA</th><th>REGLA</th><th class="c">CUÁNTO</th></tr></thead>
        <tbody>${Object.keys(D.cuantoBaja).sort().map(m => {
          const r = D.cuantoBaja[m] || {};
          return `<tr>
            <td style="color:var(--text-strong); font-weight:700;">${esc(m)}</td>
            <td class="apagado">${ETIQ[r.modo] || esc(r.modo || '—')}</td>
            <td class="c">${r.modo === 'todo' || r.modo === 'caso' ? '<span class="apagado">—</span>'
              : `<b style="color:var(--text-strong)">${esc(r.valor)}</b>
                 <span class="apagado">${r.modo === 'porcentaje' ? '%' : 'cuerpos'}</span>`}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  };

  /* ══ PASO 4 · COMO SE REPARTE ════════════════════════════════════════════ */
  const paso4 = () => `
    <p class="nota">Cuando bajan 800 pares de un artículo, esto decide cuántos van a cada
      talla. Las <b style="color:var(--text-strong)">comerciales</b> se llevan más: son las
      que se piden y las que dejan el hueco cuando faltan.</p>
    <div class="rejilla" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr));">
      ${Object.keys(D.tallasComerciales).map(c => {
        const x = D.tallasComerciales[c] || {};
        const tallas = x.tallas || [];
        const com = new Set(x.comerciales || []);
        const pcts = x.porcentajes || {};
        /* LAS TALLAS SE ENVUELVEN, NO SE APRETUJAN. Estaban en una sola fila y con veinte
           tallas se montaban una encima de otra —Daniel, 27-ago-2026: *"se están
           superponiendo"*—. Cada talla es una casilla que baja de renglón. */
        const mayor = Math.max(1, ...tallas.map(t => Number(pcts[t]) || 0));
        return `<div class="tarj">
          <div class="m">${esc(c)}</div>
          <div class="d">${tallas.length} tallas · ${com.size} comerciales</div>
          <div class="tallas">
            ${tallas.map(t => {
              const p = Number(pcts[t]) || 0;
              return `<div class="tll ${com.has(t) ? 'com' : ''}">
                <b>${esc(t)}</b><span>${p}%</span>
                <div class="franja"><i style="width:${(p / mayor * 100).toFixed(1)}%;
                     background:${com.has(t) ? 'var(--primary-2)' : 'var(--blue-mid)'};"></i></div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
    <!-- Y acá el editor de verdad: el mismo que estaba abajo de Config. Tareas. Trae
         además "cuánto baja al piso", que es el paso 3. -->
    <div id="capReparto" style="margin-top:1rem;"></div>`;

  /* ══ PASO 5 · HASTA CUANTO ═══════════════════════════════════════════════ */
  const paso5 = () => `
    <p class="nota">El tope es cuántos pares tiene que haber abajo de cada SKU en esa talla.
      Tiene <b style="color:var(--text-strong)">dos techos</b>: lo que entra en su cuerpo
      (paso 1) y lo que aguanta el piso entero (el semáforo de arriba). El primero ya se
      revisa hoy; el segundo no lo revisa nadie.</p>
    <table style="margin-bottom:.8rem;">
      <thead><tr><th>ESTAS FILAS…</th><th>SU TOPE ES</th><th class="n">FILAS</th></tr></thead>
      <tbody>
        <tr><td><span class="chip todo">todo</span> ${D.todoAlPiso.join(' · ')}</td>
          <td style="color:var(--text-strong); font-weight:800;">sin tope — todo lo que llega baja</td>
          <td class="n">${D.resumenTopes.todo}</td></tr>
        <tr><td><span class="chip escolar">escolar</span> las demás marcas</td>
          <td style="color:var(--text-strong); font-weight:800;">${D.paresEscolar} pares por talla, fijo</td>
          <td class="n">${D.resumenTopes.escolar}</td></tr>
        <tr><td><span class="chip uncuerpo">un cuerpo</span> ${D.unCuerpo.join(' · ')}</td>
          <td style="color:var(--text-strong); font-weight:800;">el cuerpo entero, repartido entre sus tallas</td>
          <td class="n">${D.resumenTopes.unCuerpo}</td></tr>
        <tr><td><span class="chip heredado">se reparten</span> todo lo demás</td>
          <td style="color:var(--text-strong); font-weight:800;">lo que quede de piso, con la perilla</td>
          <td class="n">${D.resumenTopes.perilla}</td></tr>
      </tbody>
    </table>
    <p class="nota">Las tres primeras <b style="color:var(--text-strong)">no las toca la
      perilla</b>: su número lo puso Daniel y no se negocia. <b style="color:var(--text-strong)">El
      orden manda</b>: <i>todo</i> le gana al escolar, y el escolar le gana a <i>un cuerpo</i>.</p>
    <div class="tarj" style="margin-bottom:.8rem; padding:.7rem .9rem;">
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <span class="tit">LLENAR EL CUERPO AL</span>
        <input type="number" id="capPct" min="1" max="100" value="100" style="width:58px;">
        <span style="color:var(--text-muted); font-size:var(--t-sm);">%</span>
        <input type="range" id="capBarra" min="1" max="100" value="100"
               style="flex:1 1 180px; accent-color:var(--primary-2);">
        <button class="boton claro" id="capMax">El máximo que entra (${pctQueEntra}%)</button>
        <button class="boton claro" id="capColchon">Con colchón (${pctConColchon}%)</button>
        <button class="boton" id="capGuardar" disabled>Aplicar a la tabla</button>
      </div>
      <div class="d" style="margin-top:.45rem;" id="capExplica"></div>
    </div>
    <!-- LA TABLA ES LA DE SIEMPRE, montada aca. Trae el Excel, el aplicar a toda la
         marca y las excepciones por SKU. Encima queda el semaforo y la perilla, que es
         lo que esta pantalla agrega. Una sola tabla: Daniel, 28-ago-2026, *"no quiero
         tener doble cosas"*. -->
    <div id="capTopes"></div>`;

  /* Lo que le toca a cada talla. NO TODAS SE REPARTEN: el escolar tiene su numero dado y
     las marcas de un cuerpo se llevan el cuerpo entero. La perilla solo mueve al resto. */
  const proponeCon = (t) => {
    if (t.regimen === 'todo') return t.fijo;
    if (t.regimen === 'escolar') return D.paresEscolar;
    if (t.regimen === 'un-cuerpo') return t.propone;
    return t.propone === null ? null
      : Math.max(1, Math.round(t.propone * (pctCuerpo === null ? 100 : pctCuerpo) / 100));
  };

  const explicar = () => {
    const p = pctCuerpo === null ? null : pctCuerpo;
    $('#capExplica').innerHTML = p === null
      ? 'Los objetivos son los que están cargados hoy. Mové la perilla para repartir el piso.'
      : `Con el cuerpo al <b style="color:var(--text-strong)">${p}%</b>, los topes pedirían
         <b style="color:var(--text-strong)">${mil(pideConPerilla(D, p))}</b> pares
         y el piso aguanta ${mil(pisoAguanta)}.`;
  };

  const aplicarPerilla = (p) => {
    pctCuerpo = p;
    D.topes.forEach((t, i) => {
      const v = proponeCon(t);
      if (v !== null) tuyo.set(i, v);
    });
    tocado = true;
    $('#capGuardar').disabled = false;
    $('#capPct').value = p;
    $('#capBarra').value = p;
    explicar();
    pintarSemaforo();
  };

  /* La tabla de siempre lee los objetivos del servidor al dibujarse, asi que despues de
     publicar hay que pedirle que se rehaga o seguiria mostrando los de antes. */
  const montarTabla = async () => {
    if (typeof O.montarTopes !== 'function') return;
    try { await O.montarTopes($('#capTopes')); }
    catch (e) { console.warn('[CAPACIDAD] no se pudo montar la tabla de topes:', e && e.message); }
  };

  const PASOS = [
    ['1', 'CUÁNTO ENTRA', 'el cubicaje: cuántos pares caben en un cuerpo', paso1, true],
    ['2', 'DÓNDE VA', 'la marca manda la zona y sus columnas', paso2, false],
    ['3', 'CUÁNTO BAJA', 'lo decide el caso del artículo, no su marca', paso3, false],
    ['4', 'CÓMO SE REPARTE', 'de 800 pares, cuántos a cada talla', paso4, false],
    ['5', 'HASTA CUÁNTO', 'el tope, con sus dos techos', paso5, true]
  ];
  $('#capPasos').innerHTML = PASOS.map(([n, tit, q, fn, abierto]) => `
    <details class="paso" ${abierto ? 'open' : ''}>
      <summary><span class="num">${n}</span>
        <span><span class="tit">${tit}</span><br><span class="qhace">${q}</span></span>
        <span class="chev">▶</span></summary>
      <div class="cuerpo">${fn()}</div>
    </details>`).join('');

  pintarSemaforo();
  explicar();

  /* LOS EDITORES DE VERDAD, montados adentro. Se pasan desde afuera porque viven en el
     archivo grande y no se pueden importar; traerlos asi es lo que evita reescribirlos
     —y reescribir un editor que ya funciona es como se pierden comportamientos—. */
  if (typeof O.montarZonas === 'function') {
    try { await O.montarZonas($('#capZonas')); }
    catch (e) { console.warn('[CAPACIDAD] no se pudo montar el editor de zonas:', e && e.message); }
  }
  if (typeof O.montarReparto === 'function') {
    try { await O.montarReparto($('#capReparto')); }
    catch (e) { console.warn('[CAPACIDAD] no se pudo montar el reparto:', e && e.message); }
  }
  await montarTabla();

  /* ── Lo que se toca ── */
  container.addEventListener('input', (e) => {
    if (e.target.id === 'capBarra' || e.target.id === 'capPct') {
      const p = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1));
      aplicarPerilla(p);
    }
  });

  container.addEventListener('click', async (e) => {
    if (e.target.id === 'capMax') { aplicarPerilla(pctQueEntra); return; }
    if (e.target.id === 'capColchon') { aplicarPerilla(pctConColchon); return; }
    if (e.target.id === 'capGuardar') {
      const b = e.target;
      b.disabled = true;
      b.textContent = 'Guardando…';
      /* Se manda SOLO la clave de los topes. El que guarda relee el cajón entero antes de
         escribir: mandar el cajón completo borraría la jornada, las zonas y el reparto por
         tallas de un plumazo. */
      const nuevos = {};
      D.topes.forEach((t, i) => { nuevos[t.clave] = tuyo.get(i); });
      try {
        await (O.guardar ? O.guardar(nuevos) : publicarTopes(nuevos));
        b.textContent = 'Aplicado';
        tocado = false;
        /* Sin volver a montarla, la tabla de abajo seguiria mostrando los objetivos de
           antes y pareceria que no paso nada. */
        await montarTabla();
        if (O.avisar) O.avisar('OBJETIVOS APLICADOS',
          Object.keys(nuevos).length + ' combinaciones publicadas. Todas las PC las bajan solas.', 'success');
      } catch (err) {
        b.textContent = 'No se pudo guardar';
        b.disabled = false;
        if (O.avisar) O.avisar('NO SE PUDO GUARDAR', String(err && err.message || err), 'error');
      }
    }
  });
}
