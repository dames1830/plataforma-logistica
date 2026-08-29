const iconoCalendario = (color) =>
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"`
    + ` stroke-linecap="round" style="flex-shrink:0;" aria-hidden="true">`
    + `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`;

/**
 * EL RANGO DE FECHAS DE TODA LA PLATAFORMA.
 *
 * Daniel, 28-ago-2026: siempre "Desde … hasta …", con su ícono y los colores del
 * tema. Antes cada pantalla armaba el suyo —21 rangos escritos a mano, unos con
 * `DE:`/`HASTA:`, otros con `DE`/`A`, y la mayoría sin decir qué era el primer
 * campo—. Una sola caja que se lee como una frase, y el día que haya que
 * cambiarle algo se cambia acá y sale igual en las 21.
 *
 * Los valores por defecto son variables del tema, así que no hay que pasarle
 * nada: `selectorRango(desde, hasta, 'window.miSetter')` ya sale bien en los
 * cuatro temas. Todas las `var()` llevan valor de reserva porque los reportes
 * públicos se abren sin sesión y ni siquiera cargan `main.css`.
 *
 * Se puede enganchar de las dos formas, según cómo esté hecha la pantalla:
 *   - `setter`: nombre de una función global que recibe (desde, hasta), con null
 *     en el que no cambió. Sale como `onchange` en línea.
 *   - `idDesde` / `idHasta`: para las pantallas que ya escuchan por id con
 *     `addEventListener`. Las dos se pueden usar a la vez.
 */
const selectorRango = (desde, hasta, setter, opciones = {}) => {
    const {
        color   = "var(--brand-light, #818cf8)",          // el ícono
        fondo   = "rgba(var(--ink-rgb, 255,255,255), 0.04)",
        borde   = "var(--border, rgba(255,255,255,0.1))",
        texto   = "var(--text-strong, #ffffff)",          // la fecha
        rotulo  = "var(--text-muted, #94a3b8)",           // 'Desde' y 'hasta'
        esquema = "var(--scheme, dark)",
        idDesde = '',
        idHasta = ''
    } = opciones;

    const campo = (eti, val, id, ev) => `
        <span style="font-size:11px; color:${rotulo}; font-weight:800; letter-spacing:0.04em; white-space:nowrap;">${eti}</span>
        <input type="date"${id ? ` id="${id}"` : ''} value="${val || ''}"${ev ? ` onchange="${ev}"` : ''} style="background:transparent; border:none; color:${texto}; font-size:12.5px; font-weight:700; outline:none; cursor:pointer; font-family:var(--font-ui, 'Inter', sans-serif); color-scheme:${esquema};">`;

    /* La clase `rango-fechas` no pinta nada por sí sola: es el agarre para las pocas
       reglas de `temas.css` que necesitan alcanzar el rango entero —la franja azul de
       Power BI, por ejemplo—. Antes esas reglas apuntaban al `input[type="date"]`
       suelto, que era la pastilla; ahora la pastilla es este recuadro y el input va
       transparente adentro. */
    return `
    <div class="rango-fechas" style="display:inline-flex; align-items:center; gap:9px; background:${fondo}; border:1px solid ${borde}; border-radius:9px; padding:5px 12px; flex-wrap:wrap;">
        ${iconoCalendario(color)}
        ${campo('Desde', desde, idDesde, setter ? `${setter}(this.value, null)` : '')}
        ${campo('hasta', hasta, idHasta, setter ? `${setter}(null, this.value)` : '')}
    </div>`;
};
