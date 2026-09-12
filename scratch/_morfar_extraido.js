/* Copiado tal cual de js/views/dashboard_v28.js para probarlo en el navegador. */

const morfar = (viejo, nuevo) => {
    if (viejo.isEqualNode(nuevo)) return;
    if (viejo.nodeType !== nuevo.nodeType || viejo.nodeName !== nuevo.nodeName) {
        viejo.replaceWith(nuevo.cloneNode(true));
        return;
    }
    if (viejo.nodeType !== 1) {                       // texto o comentario
        if (viejo.nodeValue !== nuevo.nodeValue) viejo.nodeValue = nuevo.nodeValue;
        return;
    }
    Array.from(nuevo.attributes).forEach(at => {
        if (viejo.getAttribute(at.name) !== at.value) viejo.setAttribute(at.name, at.value);
    });
    Array.from(viejo.attributes).forEach(at => {
        if (!nuevo.hasAttribute(at.name)) viejo.removeAttribute(at.name);
    });
    if (viejo === document.activeElement
        && (viejo.nodeName === 'INPUT' || viejo.nodeName === 'TEXTAREA' || viejo.nodeName === 'SELECT')) {
        return;
    }
    const hv = Array.from(viejo.childNodes);
    const hn = Array.from(nuevo.childNodes);
    const cuantos = Math.max(hv.length, hn.length);
    for (let i = 0; i < cuantos; i++) {
        if (!hn[i]) { if (hv[i]) hv[i].remove(); continue; }
        if (!hv[i]) { viejo.appendChild(hn[i].cloneNode(true)); continue; }
        morfar(hv[i], hn[i]);
    }
};

const aplicarDibujo = (container, html) => {
    if (!container.firstChild) { container.innerHTML = html; return 'entero'; }
    try {
        const molde = document.createElement('div');
        molde.innerHTML = html;
        const hv = Array.from(container.childNodes);
        const hn = Array.from(molde.childNodes);
        const cuantos = Math.max(hv.length, hn.length);
        for (let i = 0; i < cuantos; i++) {
            if (!hn[i]) { if (hv[i]) hv[i].remove(); continue; }
            if (!hv[i]) { container.appendChild(hn[i].cloneNode(true)); continue; }
            morfar(hv[i], hn[i]);
        }
        return 'por partes';
    } catch (e) {
        console.warn('[PINTADO] no se pudo actualizar por partes; se rehace entero:', e && e.message);
        container.innerHTML = html;
        return 'entero';
    }
};
