/* ═══════════════════════════════════════════════════════════════════════════════════════
 *  LAS REGLAS DE UNA TAREA DE ALMACENAJE, EN UN SOLO SITIO
 *  ───────────────────────────────────────────────────────────────────────────────────────
 *  Nace el 12-sep-2026, cuando la pantalla de Tareas llego al celular. Hasta ese dia estas
 *  cuentas vivian sueltas dentro de `dashboard_v28.js`; con dos pantallas mirando lo mismo,
 *  una copia en cada una es como vuelven los problemas que una regla unica ya resolvio.
 *
 *  Daniel, ese mismo dia, sobre la app: *"el funcionamiento no se tiene que perder, la
 *  logica, la seguridad, todo eso. El diseño si se pierde un poco porque no voy a poner
 *  todo lo de la web en un aplicativo de celular"*. Exactamente eso: el dibujo cambia, la
 *  cuenta no — y para que no cambie, se escribe una vez.
 *
 *  NO HAY DATOS PROPIOS DEL CELULAR. La app escribe la MISMA tarea del area
 *  `almacenaje_tasks` que lee la web, con el mismo `id`. Por eso al asignar desde el
 *  telefono se llenan solas, en la web, las columnas de usuarios, horas, productividad y
 *  objetivo: no son dos verdades que sincronizar, es un registro visto desde dos pantallas.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

/**
 * COMO SE LLAMA CADA ESTADO. `Vencida` se dice NO TRABAJADA y no "vencida": las dos se
 * leerian como "ya esta lista", cuando significan lo contrario. Es el mismo criterio que
 * `rotuloEstado` tenia en el tablero.
 */
export const ROTULOS_ESTADO = { Vencida: 'NO TRABAJADA' };

export const rotuloEstado = (t) => {
    const s = String((t && (t.status || t.estado)) || '');
    return ROTULOS_ESTADO[s] || s.toUpperCase();
};

/** El nombre corto: `2026-09-12_Tarea21` -> `Tarea21`. */
export const numeroDeTarea = (id) => {
    const s = String(id || '');
    return s.includes('_') ? s.split('_').pop() : s;
};

/**
 * EL USUARIO, COMO LO GUARDA LA PLATAFORMA: inicial del nombre + primer apellido, en
 * minusculas. `Mario Piscoya Diaz` -> `mpiscoya`. No es un adorno: es la llave con la que
 * se guardan `u1` y `u2`, asi que tiene que salir igual en las dos pantallas o la tarea
 * queda asignada a alguien que no existe.
 */
export const usuarioCorto = (w) => {
    const nom = String((w && (w.nombre || w.Nombre)) || '').trim().toLowerCase();
    const ape = String((w && (w.apellidos || w.Apellidos)) || '').trim().split(' ')[0].toLowerCase();
    return nom ? `${nom[0]}${ape}` : 's/n';
};

/**
 * LOS MINUTOS TRABAJADOS, descontando el break de 23:00 a 23:50.
 *
 * Sin descontarlo, una tarea que cruza el break sale casi una hora mas larga de lo que se
 * trabajo y nadie cumple nunca el objetivo. Y si el termino cae antes que el inicio es que
 * cruzo la medianoche, no que esta al reves.
 */
export const minutosTrabajados = (t) => {
    if (!t || !t.inicio || !t.termino) return 0;
    const s = new Date(t.inicio);
    let e = new Date(t.termino);
    if (isNaN(s) || isNaN(e)) return 0;
    if (e < s) e = new Date(e.getTime() + 86400000);

    /* El break es el de ESTA jornada. Una tarea que empieza pasada la medianoche pertenece
       al turno que arranco el dia anterior, asi que se mira el break de ese dia. */
    const sd = s.getHours() < 12 ? new Date(s.getTime() - 43200000) : s;
    const bS = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 23, 0, 0);
    const bE = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 23, 50, 0);
    const solape = Math.max(0, Math.min(e, bE) - Math.max(s, bS));
    return Math.max(0, Math.floor(((e - s) - solape) / 60000));
};

/** Los mismos minutos, escritos `HH:MM`. Es la columna "productividad" de la web. */
export const tiempoHHMM = (t) => {
    if (!t || !t.inicio || !t.termino) return '';
    const m = minutosTrabajados(t);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * LAS UNIDADES QUE DE VERDAD SE MOVIERON.
 *
 * Cuentan SOLO las ubicaciones que empiezan con `CDBUFFER` y NO con `CDBUFFER-C`: el
 * buffer C es limpieza, no almacenaje, y meterlo infla la productividad de quien no lo
 * trabajo. Si el item trae `avance` manda ese; si no lo trae y la tarea esta Finalizada,
 * vale la cantidad entera.
 */
export const avanceDeTarea = (t) => {
    if (!t) return 0;
    let suma = 0;
    (t.items || []).forEach(art => {
        ((art && art.items) || []).forEach(i => {
            const ubi = String((i && i.ubi) || '').toUpperCase().trim();
            if (!ubi.startsWith('CDBUFFER') || ubi.startsWith('CDBUFFER-C')) return;
            if (i.avance !== undefined && i.avance !== null) suma += parseFloat(i.avance) || 0;
            else if (String(t.status) === 'Finalizado') suma += parseFloat(i.qty) || 0;
        });
    });
    return suma;
};

/**
 * CUANTO PODIA TARDAR.
 *
 *     permitido = tiempoBase + (unidades / metaUph) * 60
 *
 * El `tiempoBase` es el recorrido: ir a la zona buffer, ubicar el articulo, llevarlo y
 * volver. Sin el, una tarea de un par jamas cumpliria — a 400 u/h se le exigirian nueve
 * segundos, y solo el camino ya toma varios minutos.
 */
export const minutosPermitidos = (unidades, meta) => {
    const base = Number((meta && meta.tiempoBase) || 0);
    const uph = Number((meta && meta.metaUph) || 0);
    return base + (uph > 0 ? (Number(unidades || 0) / uph) * 60 : 0);
};

/**
 * CUMPLIO / NO CUMPLIO, o `null` si todavia no se puede saber.
 *
 * `null` no es lo mismo que "no cumplio": una tarea sin terminar no fallo nada. El que
 * dibuje esto tiene que distinguirlos o va a pintar de rojo trabajo que esta en curso.
 *
 * @param {object} t     la tarea
 * @param {object} meta  lo que devuelve `metasService.resolverMeta()`
 */
export const objetivoDe = (t, meta) => {
    if (!t || String(t.status) !== 'Finalizado' || !t.inicio || !t.termino) return null;
    const min = minutosTrabajados(t);
    if (min <= 0) return null;
    return min <= minutosPermitidos(avanceDeTarea(t), meta) ? 'CUMPLIO' : 'NO_CUMPLIO';
};

/**
 * LA CATEGORIA CON LA QUE SE BUSCA LA META: `{ familia, detalle }`.
 *
 * Manda la del articulo que mas unidades pone. Una tarea puede mezclar dos categorias, y
 * medir contra la del primer articulo de la lista seria medir contra lo accesorio.
 *
 * Las tareas viejas vuelven del servidor sin `genderRims` y ahi el detalle queda vacio;
 * `resolverMeta` ya sabe caer a la familia y despues a la global, asi que no se rompe.
 */
export const categoriaDeTarea = (t) => {
    const familias = new Map();
    const detalles = new Map();
    ((t && t.items) || []).forEach(art => {
        const u = parseFloat(art && art.bufferQty) || 0;
        const f = String((art && art.gender) || '').trim();
        const d = String((art && art.genderRims) || '').trim();
        if (f) familias.set(f, (familias.get(f) || 0) + u);
        if (d) detalles.set(d, (detalles.get(d) || 0) + u);
    });
    const mayor = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
        familia: (mayor(familias) || [''])[0],
        detalle: (mayor(detalles) || [''])[0]
    };
};

/** Las dos horas, `HH:MM`, para pintarlas o meterlas en un `<input type="time">`. */
export const horaCorta = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * DE `HH:MM` A LA MARCA QUE SE GUARDA, con la fecha del TRABAJO y no la del nacimiento de
 * la tarea.
 *
 * Una tarea vive hasta 48 horas: si se guardara con `t.fecha`, el turno de hoy trabajando
 * una tarea nacida ayer quedaria registrado como trabajo de ayer y el reporte del dia
 * mostraria cero. Lo cazo Daniel el 06-ago-2026 con 3.072 pares que no aparecian.
 *
 * Y nunca con `toISOString()`: devuelve UTC y a las 19:00 de Lima ya es el dia siguiente.
 *
 * @param {string} hhmm        '21:12'
 * @param {string} fechaTrabajo la jornada logica, 'AAAA-MM-DD'
 */
export const selloDeHora = (hhmm, fechaTrabajo) => {
    const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m || !fechaTrabajo) return '';
    return `${fechaTrabajo}T${String(m[1]).padStart(2, '0')}:${m[2]}:00`;
};
