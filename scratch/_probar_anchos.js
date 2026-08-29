// Mide, para el ancho actual, si algo se desborda o se parte
(() => {
  const r = { ventana: window.innerWidth, pagina_de_lado: document.documentElement.scrollWidth > window.innerWidth };
  r.tablas_con_scroll = [];
  document.querySelectorAll('.pan').forEach(p => {
    const t = p.querySelector('table');
    if (!t) return;
    const cont = t.parentElement;
    if (t.scrollWidth > t.clientWidth + 1 || cont.scrollWidth > cont.clientWidth + 1)
      r.tablas_con_scroll.push(p.querySelector('h3').innerText.slice(0, 24));
  });
  let parte = 0; const ej = [];
  document.querySelectorAll('.ancho9 tbody td, .ancho9 thead th').forEach(c => {
    const cs = getComputedStyle(c);
    const lh = parseFloat(cs.fontSize) * 1.25;
    const h = c.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (h > lh * 1.6) { parte++; if (ej.length < 3) ej.push(c.innerText.slice(0, 22)); }
  });
  r.celdas_partidas = parte; r.ejemplos = ej;
  r.columnas = [...document.querySelectorAll('.pan')].map(p => Math.round(p.getBoundingClientRect().left));
  return r;
})()
