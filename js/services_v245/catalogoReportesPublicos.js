/* ══════════════════════════════════════════════════════════════════════════════
 *  EL CATÁLOGO DE LOS REPORTES PÚBLICOS — una sola lista para los dos lados
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  Daniel, 07-sep-2026: *"necesito que todos los reportes puedan estar ahí en el
 *  módulo de permisos de reportes públicos. Cuando nosotros creamos un submódulo
 *  o un módulo en la web, debería ir también al permiso de reportes públicos,
 *  porque ahorita yo quiero dar acceso a distribución y despacho potencial, pero
 *  no está. Y de repente hay otros reportes que no están también"*.
 *
 *  EL PROBLEMA ERA QUE LA LISTA ESTABA DOS VECES Y ESCRITA A MANO: una en el
 *  modal de permisos (`dashboard_v28.js`) y otra en la página pública
 *  (`reportes_publicos.js`). Cada submódulo nuevo había que acordarse de
 *  agregarlo en los dos, y no pasó: Distribución, Despacho Potencial, Picking
 *  por día, Embalaje por día, Cruce y Producción quedaron fuera de las dos.
 *
 *  Ahora la lista vive acá y la leen los dos. Agregar un reporte al link público
 *  es agregar UNA línea en este archivo.
 *
 *  ── OJO: EL PÚBLICO NO ES EL ESPEJO DE LA WEB ────────────────────────────────
 *
 *  Los sub-reportes públicos de Almacenaje —Marcas, Rendimiento Operarios,
 *  Producción por Hora— NO son los submódulos de la web —Tareas Día, KPI Tareas,
 *  Productividad—. La página pública tiene su propio juego de reportes, armado
 *  para gente de afuera. Por eso este catálogo es la UNIÓN de los dos y no una
 *  copia de `TABS`.
 *
 *  ── QUÉ SIGNIFICA `listo` ────────────────────────────────────────────────────
 *
 *      listo: true    la página pública sabe dibujarlo HOY
 *      listo: false   está en la web pero todavía no se portó al link público
 *
 *  Los que no están listos SE MUESTRAN IGUAL en la matriz de permisos, marcados,
 *  para que se vea que existen y qué falta. Si se autoriza uno, el link público
 *  lo dice con todas sus letras en vez de mostrar una pantalla en blanco.
 *
 *  NO VAN LAS PANTALLAS DE ADMINISTRACIÓN NI DE CONFIGURACIÓN —usuarios,
 *  permisos, parámetros, jornada—: no son reportes y no tienen nada que hacer en
 *  un enlace que se manda para afuera.
 * ════════════════════════════════════════════════════════════════════════════ */

export const CATALOGO = [
    {
        id: 'inventario', label: 'Inventario', icon: '📦',
        /* CAMPO VIEJO donde se guardaban estos permisos antes de unificar. Se
           sigue leyendo y escribiendo para no romper los grupos ya creados. */
        campoViejo: 'reportesInventario',
        subs: [
            { id: 'archivo_inventario',   label: 'Archivo Inventario',   listo: true },
            { id: 'kpi_inventarios',      label: 'KPI Inventarios',      listo: true },
            { id: 'analisis_inventarios', label: 'Análisis Inventarios', listo: true },
            { id: 'modulo_inventarios',   label: 'Módulo Inventarios',   listo: true },
            { id: 'descargas_inventario', label: 'Descargas',            listo: true },
        ],
    },
    {
        id: 'picking', label: 'Picking', icon: '🛒',
        subs: [
            { id: 'archivo_picking',  label: 'Archivo Picking',             listo: true },
            { id: 'reporte_picking',  label: 'KPI Picking y Embalaje',      listo: false },
            { id: 'picking_dia',      label: 'Picking por día',             listo: false },
            { id: 'embalaje_dia',     label: 'Embalaje por día',            listo: false },
            { id: 'cruce_wms',        label: 'Cruce',                       listo: false },
            { id: 'prod_proyeccion',  label: 'Producción Picking Embalaje', listo: false },
        ],
    },
    {
        id: 'despacho', label: 'Despacho', icon: '🚚',
        subs: [
            { id: 'archivo_despacho',   label: 'Archivo Despacho',  listo: true },
            /* LOS DOS QUE DANIEL PIDIÓ el 07-sep-2026. Salen del área que publica
               `robot/distribucion.py`, así que el link público los lee del
               servidor igual que la plataforma. */
            { id: 'distribucion',       label: 'Distribución',      listo: true },
            { id: 'despacho_potencial', label: 'Despacho Potencial',listo: true },
        ],
    },
    {
        id: 'no_retail', label: 'NO RETAIL', icon: '🏬',
        subs: [
            { id: 'archivo_no_retail',   label: 'Archivo NO RETAIL',     listo: true },
            { id: 'despacho_no_retail',  label: 'Despacho de NO RETAIL', listo: false },
            { id: 'tracking_no_retail',  label: 'Tracking',              listo: false },
            { id: 'kpi_no_retail',       label: 'KPI No Retail',         listo: false },
        ],
    },
    {
        id: 'recepcion', label: 'Recepción', icon: '📥',
        subs: [
            { id: 'archivo_recepcion',   label: 'Archivo Recepción',  listo: true },
            { id: 'reportes_recepcion',  label: 'Reportes Recepción', listo: false },
            { id: 'asn_recepcion',       label: 'ASN Detalle',        listo: false },
        ],
    },
    {
        id: 'almacenaje', label: 'Almacenaje', icon: '🏗️',
        campoViejo: 'reportesAlmacenaje',
        subs: [
            /* ESTOS CINCO SON PROPIOS DEL LINK PÚBLICO: no existen como submódulo
               en la web. Ver la nota de arriba. */
            { id: 'reporte_marcas',      label: 'Marcas (Día/Noche)',     listo: true },
            { id: 'rendimiento_ops',     label: 'Rendimiento Operarios',  listo: true },
            { id: 'produccion_hora',     label: 'Producción por Hora',    listo: true },
            { id: 'almacenado_semana',   label: 'Almacenado Semana/Marca',listo: true },
            { id: 'grafico_rendimiento', label: 'Gráfico Rendimiento',    listo: true },
            { id: 'tareas_dia',          label: 'Tareas Día',             listo: false },
            { id: 'kpi_tareas',          label: 'KPI Tareas',             listo: false },
            { id: 'productividad',       label: 'Productividad',          listo: false },
            { id: 'capacidad',           label: 'Capacidad',              listo: false },
        ],
    },
    {
        id: 'slotting', label: 'Slotting', icon: '🗂️',
        subs: [
            { id: 'slot_tareas', label: 'Tareas Día',   listo: false },
            { id: 'slot_kpi',    label: 'KPI Slotting', listo: false },
        ],
    },
    {
        id: 'buffer', label: 'Zona Buffer', icon: '⏳',
        campoViejo: 'reportesBuffer',
        subs: [
            { id: 'pendiente',        label: 'Pendiente',        listo: false },
            { id: 'historial_buffer', label: 'Historial Buffer', listo: true },
            { id: 'analisis_buffer',  label: 'Análisis Buffer',  listo: true },
            { id: 'kpi_buffer',       label: 'Buffer KPI',       listo: false },
        ],
    },
    {
        id: 'analisis_sku', label: 'Análisis SKU', icon: '🔍',
        campoViejo: 'reportesAnalisis',
        subs: [
            { id: 'archivo_analisis',  label: 'Archivo Análisis', listo: true },
            { id: 'articulo_temp',     label: 'Artículo Temp',    listo: true },
            { id: 'replenishment',     label: 'Replenishment',    listo: true },
            { id: 'analisis_reserva',  label: 'Análisis Reserva', listo: true },
            { id: 'layout_activo',     label: 'Layout Activo',    listo: true },
        ],
    },
    {
        id: 'performance', label: 'Performance', icon: '📈',
        subs: [
            { id: 'actividades', label: 'Actividades del turno', listo: false },
            { id: 'graficos',    label: 'Asistencia',            listo: false },
        ],
    },
];

/** Todos los módulos, para la primera fila de la matriz. */
export const MODULOS = CATALOGO.map(m => ({ id: m.id, label: m.label, icon: m.icon }));

/** Un submódulo por su id, con el módulo al que pertenece. */
export const buscarSub = (id) => {
    for (const m of CATALOGO) {
        const s = (m.subs || []).find(x => x.id === id);
        if (s) return { ...s, modulo: m.id, moduloLabel: m.label };
    }
    return null;
};

/**
 * Los permisos de un grupo, en un formato solo.
 *
 * LEE LOS DOS FORMATOS. Los grupos creados antes guardaban un campo por módulo
 * —`reportesAlmacenaje`, `reportesBuffer`, `reportesInventario`,
 * `reportesAnalisis`—; los nuevos guardan una sola lista `submodulos`. Se juntan
 * los dos, así que un grupo viejo sigue funcionando sin tocarlo.
 *
 * @returns {{modulos: Set<string>, subs: Set<string>}}
 */
export const permisosDe = (g) => {
    const modulos = new Set(g && g.modulos ? g.modulos : []);
    const subs = new Set(g && g.submodulos ? g.submodulos : []);
    for (const m of CATALOGO) {
        if (!m.campoViejo) continue;
        for (const id of (g && g[m.campoViejo]) || []) subs.add(id);
    }
    return { modulos, subs };
};

/**
 * Lo que hay que guardar en el grupo.
 *
 * SE ESCRIBEN LOS DOS FORMATOS a propósito. La página pública puede estar
 * abierta en el navegador de alguien con la versión anterior cargada; mientras
 * siga leyendo los campos viejos, un permiso guardado hoy le tiene que llegar
 * igual. Cuando ya no quede nadie en la versión vieja, los campos viejos se
 * pueden quitar de acá y nada más.
 */
export const paraGuardar = (modulos, subs) => {
    const out = { modulos: [...modulos], submodulos: [...subs] };
    for (const m of CATALOGO) {
        if (!m.campoViejo) continue;
        const suyos = (m.subs || []).map(s => s.id);
        out[m.campoViejo] = [...subs].filter(id => suyos.includes(id));
    }
    return out;
};

/** Cuántos módulos tiene autorizados un grupo, para la columna de la tabla. */
export const cuentaModulos = (g) => permisosDe(g).modulos.size;
