/**
 * Zonas de Almacenaje
 *
 * Dónde va cada mercadería y cuánta entra. Hasta la v29.0012 esto vivía escrito a mano
 * dentro de dashboard_v28.js —y en parte en ningún lado, solo en la cabeza de la gente—,
 * así que mover una columna de temporada anterior a actual era editar JavaScript.
 *
 * Cuatro cosas se configuran acá:
 *
 *   LAYOUT    por zona: cuántas columnas y cuerpos tiene, cuáles son pasillos del elevador,
 *             qué temporada le toca a cada columna, y desde cuántos pares deja de ser saldo.
 *   MARCAS    a qué zona va cada marca. Bata al selectivo, Bubblegummers al mezzanine 1...
 *   OTHERS    las ojotas no siguen a su marca: la subcategoría manda. Las de bolsa
 *             transparente van al mezzanine 4, las de caja al selectivo.
 *   DENSIDAD  cuántos pares entran en un cuerpo, según la serie (el primer dígito del
 *             código) y la zona. Un cuerpo de serie 0 aguanta 1.388 pares; uno de serie 7,
 *             181. El sistema la mide solo, y acá se puede pisar a mano.
 *
 * Vive en el área 'config' del servidor, que el backend trata como SINGLETON. Es un cajón
 * compartido —la jornada vive ahí al lado— así que al guardar se relee y se reemplaza SOLO
 * la clave 'zonas', para no llevarse por delante lo del vecino.
 *
 * La lectura es SÍNCRONA a propósito, igual que en jornadaService: se descarga una vez al
 * arrancar y de ahí en más se lee de memoria.
 */

const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config';
/**
 * OJO CON SUBIRLE LA VERSIÓN A ESTA CLAVE: hay que hacerlo cada vez que se agrega algo a la
 * configuración que tenga un valor de fábrica nuevo.
 *
 * El caché de cada PC se normaliza al leerlo, y normalizar rellena lo que falta con vacío,
 * no con el valor de fábrica. Así que una PC con caché viejo se queda con el campo nuevo en
 * blanco para siempre y el cambio no llega nunca — que es justo lo que pasó el 02-ago con
 * las columnas por marca: andaba en una PC recién estrenada y no en la de Daniel.
 *
 * v2 = las marcas pasaron de 'Bata': 'SEL' a { zona, columnas }.
 * v3 = MZN01 y MZN02 bajaron de 22 a 20 cuerpos, y apareció cuerposPorColumna.
 * v4 = apareció columnasBloqueadas, con las columnas que Daniel sacó de circulación.
 * v5 = MZN03 y MZN04 bajaron de 22 a 20 cuerpos, y MZN04 estrenó cuerposPorColumna.
 * v6 = apareció la franja 'saldoGrande' con su corte `saldoGrandeHasta`, y la columna 4 del
 *      selectivo dejó de ser temporada anterior para ser la del saldo grande.
 * v7 = apareció `densidadMarcaStd`: el Bata Comfit entra 600 donde su serie diría 450.
 * v8 = apareció `densidadColumna`: el MZN01-24 entra 800, y la columna le gana a la serie
 *      y a la sub-marca porque es la medida del mueble.
 */
const CACHE_KEY = 'config_zonas_v8';

/**
 * Las temporadas que puede tener una columna.
 *
 * `corta` es el nombre para el mapa, donde cada columna mide unos 46 píxeles. Va en la barra
 * de arriba, para que el asistente no solo vea de qué color es cada celda sino DÓNDE tiene
 * que dejar la temporada actual y dónde la anterior.
 */
export const FRANJAS = {
    actual:      { etiqueta: 'Temporada actual',   corta: 'ACTUAL',   color: '#3b82f6' },
    anterior:    { etiqueta: 'Temporada anterior', corta: 'ANTERIOR', color: '#ef4444' },
    saldos:      { etiqueta: 'Saldos',             corta: 'SALDOS',   color: '#f59e0b' },
    saldoGrande: { etiqueta: 'Saldo grande',       corta: 'SALDO+',   color: '#fb923c' },
    escolar:     { etiqueta: 'Escolar',            corta: 'ESCOLAR',  color: '#22c55e' },
    catalogo:    { etiqueta: 'Catálogo',           corta: 'CATÁLOGO', color: '#a855f7' },
    ninguna:     { etiqueta: 'Sin uso',            corta: '',         color: '#64748b' }
};

/**
 * CATÁLOGO ES LA ÚNICA FRANJA QUE NO FILTRA POR MARCA.
 *
 * Es la columna 8 del mezzanine 3, y ahí conviven Skechers, Adidas y Puma. No es un error de
 * matrícula: es a propósito. Lo que llega al buffer D va entero a esa columna, venga de la
 * marca que venga y sea de la temporada que sea. Llega cada quince o veinte días.
 */
export const SIN_FILTRO_DE_MARCA = 'catalogo';

/** Repite una franja para un rango de columnas: rango(5, 13, 'actual'). */
const rango = (desde, hasta, franja) => {
    const o = {};
    for (let c = desde; c <= hasta; c++) o[c] = franja;
    return o;
};

/**
 * Lo que hoy hace el código, tal cual, para que al abrir el módulo por primera vez nada
 * cambie de comportamiento. Las densidades salen de medir el stock real del 01-ago-2026:
 * se miraron los cuerpos que tenían UN SOLO artículo y se tomó el máximo por serie.
 */
export const zonasPorDefecto = () => ({
    zonas: {
        SEL: {
            etiqueta: 'Selectivo',
            activa: true,
            columnas: 14,
            cuerpos: 22,
            saldoMenorA: 20,
            /* LA BANDA DEL SALDO GRANDE, dictada por Daniel el 14-ago-2026: "los saldos que
             * son mayores o igual a veinte se enviarán al SEL cuatro, siempre y cuando el
             * saldo sea T. Actual". El corte de arriba —199— lo eligió él sobre los números
             * del piso: sin tope la regla se lleva el selectivo entero, porque los 153
             * artículos de la franja actual tienen 20 pares o más.
             *
             * Es la banda que faltaba entre el saldo y el artículo normal: el corte de los 20
             * era un acantilado —con 19 pares se comparte cuerpo y con 20 se ocupa uno entero
             * de 330—, y un artículo de 25 pares en un cuerpo completo es el desperdicio más
             * caro que tiene el almacén.
             *
             * Solo el selectivo. En los mezzanines no está dictada: van con 0, que la apaga. */
            saldoGrandeHasta: 199,
            // Los cuerpos 11 y 22 de las columnas 2 a 13 son el paso del elevador: el rack
            // se abre abajo y recién desde el nivel F cruza por encima.
            pasillos: [{ desdeCol: 2, hastaCol: 13, cuerpos: [11, 22] }],
            franjas: { ...rango(1, 2, 'saldos'), 3: 'anterior', 4: 'saldoGrande',
                       ...rango(5, 13, 'actual'), 14: 'escolar' }
        },
        MZN01: {
            etiqueta: 'Mezzanine 1',
            activa: true,
            columnas: 24,
            // 20, NO 22. Los 22 son del selectivo, y estaban acá de arrastre: por eso la
            // sugerencia mandaba a MZN01-04-21 y MZN01-04-22, cuerpos que no existen.
            // Medido sobre el layout publicado el 02-ago: 17 columnas llegan al 20 y
            // cuatro se quedan en 17.
            cuerpos: 20,
            cuerposPorColumna: { 2: 17, 3: 17, 22: 17, 23: 17 },
            saldoMenorA: 20,
            pasillos: [],
            // Sacadas de circulación por Daniel el 05-ago-2026. Están vacías de punta a
            // punta —el stock lo confirma: cero pares en las tres— y no se pueden usar.
            columnasBloqueadas: [5, 6, 9],
            franjas: { ...rango(1, 3, 'anterior'), ...rango(4, 20, 'actual'),
                       ...rango(21, 23, 'anterior'), 24: 'actual' },
            /* La 1 es de Power y es su única de temporada anterior: no se le cambia la franja,
             * se le suma el escolar. Daniel, 14-ago-2026: "el escolar de la marca Power puede
             * ir en el mezzanine uno punto cero uno". */
            franjasExtra: { 1: 'escolar' }
        },
        MZN02: {
            etiqueta: 'Mezzanine 2',
            activa: true,
            columnas: 24,
            // Igual que MZN01: el tope es 20, con tres columnas que se quedan en 17
            cuerpos: 20,
            cuerposPorColumna: { 2: 17, 3: 17, 23: 17 },
            saldoMenorA: 20,
            pasillos: [],
            // Sacadas de circulación por Daniel el 05-ago-2026, vacías de punta a punta.
            // Quedan en uso solo 1, 2, 3, 4, 7, 8, 11, 12, 15, 16, 19 y 20 — y son
            // exactamente las que tienen stock hoy, así que la lista cierra con el almacén.
            columnasBloqueadas: [5, 6, 9, 10, 13, 14, 17, 18, 21, 22],
            franjas: { ...rango(1, 5, 'anterior'), ...rango(6, 24, 'actual') },
            /* La 4 es la única de temporada anterior que le queda al MZN02 con las columnas
             * bloqueadas, así que el escolar de North Star se le suma en vez de reemplazarla.
             * Daniel, 14-ago-2026: "ahí puede ir el escolar con las temporadas anteriores". */
            franjasExtra: { 4: 'escolar' }
        },
        // Sin reglas todavía. Daniel las carga desde este mismo módulo cuando las ordene:
        // mientras 'activa' esté en false, la sugerencia avisa en vez de inventar.
        MZN03: {
            etiqueta: 'Mezzanine 3',
            activa: false,
            columnas: 24,
            // 20, NO 22. Los 22 son del selectivo y estaban acá de arrastre, igual que
            // pasaba en MZN01 y MZN02 antes de la v29.0037. Medido sobre el stock del
            // 05-ago: ninguna ubicación de MZN03 pasa del cuerpo 20. Lo cazó Daniel
            // mirando el layout — "los mezzanines tienen 20 cuerpos, el de 22 es el
            // selectivo"— después de que esta configuración diera 528 ubicaciones.
            cuerpos: 20,
            saldoMenorA: 20,
            pasillos: [],
            franjas: {}
        },
        MZN04: {
            etiqueta: 'Mezzanine 4',
            activa: false,
            columnas: 24,
            // Mismo arrastre que MZN03: el stock tampoco pasa del cuerpo 20.
            cuerpos: 20,
            // Las columnas cortas salieron de medir el stock: son las mismas cuatro que
            // en MZN01. Ver [[mezzanine-4-como-funciona]].
            cuerposPorColumna: { 2: 17, 3: 17, 22: 17, 23: 17 },
            saldoMenorA: 20,
            pasillos: [],
            franjas: {}
        }
    },

    /**
     * Esto no estaba en el código: se dedujo del stock real. Con footwear y sin contar el
     * andamio, cada marca está casi entera en una sola zona (Power 100% en MZN01,
     * Puma/Adidas/Skechers 100% en MZN03, Bata 71% en el selectivo).
     *
     * LA ZONA NO ALCANZA CUANDO DOS MARCAS LA COMPARTEN. MZN01 es de tres, y el corte lo
     * dio Daniel el 02-ago-2026:
     *
     *   Power ............ col 1 a 11
     *   Bubblegummers .... col 12 a 23
     *   B.G Licenses ..... col 24
     *
     * Sin esto la sugerencia mandaba Bubblegummers a la columna 4, que es de Power. Encaja
     * con las franjas que ya estaban escritas —a Power le quedan 1-3 anterior y 4-11 actual;
     * a Bubblegummers 21-23 anterior y 12-20 actual—, lo que confirma que el corte es real.
     *
     * El stock del 02-ago coincide salvo en la columna 10, que tiene 1.926 pares de
     * Bubblegummers dentro del tramo de Power: es mercadería mal ubicada, no una excepción
     * de la regla. No estorba, porque un cuerpo con stock cuenta como ocupado igual.
     *
     * `columnas: []` significa la zona entera, que es el caso de las marcas que no comparten
     * —Bata en el selectivo, North Star en el mezzanine 2—.
     *
     * OJO: B.G Licenses no tiene ninguna columna de temporada anterior, así que un artículo
     * suyo que no sea de la actual sale por Slotting. Es correcto —sin ubicación no se
     * almacena— pero conviene saberlo antes de que aparezca.
     */
    marcas: {
        'Bata':          { zona: 'SEL',   columnas: [] },
        'Power':         { zona: 'MZN01', columnas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
        'Bubblegummers': { zona: 'MZN01', columnas: [12,13,14,15,16,17,18,19,20,21,22,23] },
        'B.G Licenses':  { zona: 'MZN01', columnas: [24] },
        'North Star':    { zona: 'MZN02', columnas: [] },
        'Puma':          { zona: 'MZN03', columnas: [] },
        'Adidas':        { zona: 'MZN03', columnas: [] },
        'Weinbrenner':   { zona: 'MZN03', columnas: [] },
        'Bata Industrials': { zona: 'MZN03', columnas: [] },
        'Marie Claire':  { zona: 'MZN03', columnas: [] },
        'Skechers':      { zona: 'MZN03', columnas: [] }
    },

    /**
     * Las ojotas (Gender RIMS '06 OTHERS') NO siguen a su marca. Lo que decide es el
     * empaque, y el corte va por la subcategoría COMPLETA, no por la familia: F46 tiene
     * pantuflas en caja Y el botín Kate en bolsa. Agrupar por familia da mal.
     * Se compara por prefijo, así que 'F44' alcanza para todas las F44_*.
     */
    others: [
        { subcategoria: 'F44',                 zona: 'MZN04', nota: 'ojota en bolsa (factor 20/40)' },
        { subcategoria: 'F45',                 zona: 'MZN04', nota: 'ojota en bolsa (factor 20/40)' },
        { subcategoria: 'F46_75_KIDS WINTER',  zona: 'MZN04', nota: 'botín Kate, viene en bolsa' },
        { subcategoria: 'F46_71_MEN WINTER',   zona: 'SEL',   nota: 'pantufla en caja' },
        { subcategoria: 'F46_73_WOMEN WINTER', zona: 'SEL',   nota: 'pantufla en caja' }
    ],

    /**
     * Pares por cuerpo. Medido, no inventado: el PERCENTIL 75 de lo que hay en los cuerpos
     * que tienen un solo artículo.
     *
     * Se usa el p75 y no el máximo. El máximo son casos raros —cuerpos con dos artículos
     * que el filtro no atrapó, o calzado más chico de lo normal— y da el doble de lo que
     * entra de verdad. Daniel validó dos puntos y los dos caen en el p75: adulto en el
     * selectivo 300-330 (p75 = 326) y Weinbrenner en el mezzanine 3 210-240 (p75 = 233).
     * Con el máximo habrían salido 604 y 321, y el sistema mandaría a llenar cuerpos que
     * no cierran.
     */
    /*
     * EL MEZZANINE 2 NO VA POR SERIE: SON 480 PARA TODA LA ZONA.
     *
     * Los demás números salen del percentil 75 de los cuerpos que tienen un solo artículo.
     * Los del MZN02 no: los midió Daniel en el piso el 14-ago-2026 y son 480 parejo, sin
     * importar la serie —la zona es de North Star casi entera, 62.783 de 62.788 pares—.
     *
     * La medida vale más que el percentil. El p75 dice cuánto SUELE haber adentro, y eso es
     * menos que lo que ENTRA: un cuerpo a medio llenar arrastra la medición hacia abajo. Con
     * los 259-352 que había acá, un artículo de 960 pares pedía cuatro cuerpos donde entran
     * en dos.
     *
     * Se dejan las series escritas Y el respaldo en 480 a propósito: las primeras para que se
     * vean en la pantalla de configuración, el segundo para que una serie que hoy no está en
     * la zona no caiga en los 300 genéricos.
     */
    densidad: {
        /* SELECTIVO: DE LA SERIE 4 PARA ARRIBA SON 330, medido por Daniel el 14-ago-2026.
         *
         * Este es el que más daño hacía, y en la dirección contraria al MZN02: el percentil
         * decía 548 para la serie 5 y 400 para la 6, o sea MÁS de lo que entra. El sistema
         * mandaba al operario con mercadería que no cabía. Medido sobre las tareas vivas de
         * ese día, 5 de 16 destinos del selectivo se pasaban —el peor, 412 pares a un cuerpo
         * vacío del que el sistema creía que aguantaba 548—. Es exactamente la queja que
         * trajo Daniel del piso: "la tarea dice que lo almacene ahí y ya está ocupado".
         *
         * Las series 0 y 1 se quedan como estaban: son calzado chico y entran muchos más.
         * Las series 2 y 3 siguen sin medir y caen en el respaldo.
         *
         * CORREGIDO POR DANIEL EL 15-ago-2026. El selectivo entero es de Bata, y la capacidad
         * es de la MARCA, no de una medición de un día: *"la capacidad de un cuerpo en la marca
         * Bata fuera de la serie cero y uno es de cuatrocientos cincuenta"*. Las series 0 y 1
         * son 700. Con esto las series 2 y 3 dejan de caer en el respaldo de 300, y el 330 del
         * 14-ago queda atrás por corto. */
        SEL:   { 0: 700, 1: 700, 2: 450, 3: 450, 4: 450, 5: 450, 6: 450, 7: 450, 8: 450, 9: 450 },
        MZN01: { 0: 642, 1: 426, 2: 386, 3: 332, 4: 284, 5: 372, 8: 347 },
        MZN02: { 4: 480, 5: 480, 6: 480, 8: 480 },
        MZN03: { 2: 332, 3: 338, 4: 170, 5: 260, 6: 159, 7: 139, 8: 233 },
        MZN04: { 5: 289, 6: 190, 8: 347, 9: 192 }
    },

    /** Cuando no hay medición para esa serie en esa zona. Es el p75 de todo el almacén,
     *  salvo el MZN02, que va con su medida real. */
    densidadRespaldo: { SEL: 300, MZN01: 300, MZN02: 480, MZN03: 300, MZN04: 300 },

    /* LA SUB-MARCA LE GANA A LA SERIE. Daniel, 15-ago-2026.
     *
     * *"De la marca Bata, categoría Comfit, entran seiscientos pares por cuerpo, porque es una
     * categoría o es un modelo que es muy delgado, tipo sandalias, tipo alpargatas."*
     *
     * Es una propiedad del PRODUCTO —lo delgado que es—, no de la zona ni de la serie, así que
     * va en un mapa plano y vale en cualquier zona donde caiga. La serie no lo puede capturar:
     * el Comfit está repartido en las series 3 a 8, mezclado con Bata normal.
     *
     * SALE DE `MarcaStd`, la columna 9 del Maestro, no de `Marcas`. Ahí dice "Bata Comfit"
     * mientras la otra dice solo "Bata" — por eso el sistema nunca lo había podido distinguir.
     * Son 887 artículos y 11.901 pares en el selectivo al 15-ago-2026.
     *
     * En el mismo Maestro hay más sub-marcas —Bata Red, Bata Red Label, Bata 3d, Bata
     * Flexible— que hoy van con la capacidad de su serie. Si alguna resulta tener otra
     * densidad, se agrega acá y nada más. */
    /* 700 DESDE EL 18-ago-2026. Daniel lo subió de 600 mirando el cuerpo `SEL-06-13`, que
       tenía 687 pares de un solo Comfit —el 5553848— y seguía recibiendo. Los 600 salían de
       su primera estimación del 15-ago; esta es la medida con el cuerpo cargado a la vista. */
    densidadMarcaStd: { 'Bata Comfit': 700 },

    /* LA COLUMNA LE GANA A TODO. Daniel, 17-ago-2026:
     *
     *   *"Para el mezzanine uno, fila veinticuatro, donde está B.G Licenses, la capacidad de
     *   cada cuerpo es más o menos de ochocientos pares. Solo entran en el mezzanine uno fila
     *   veinticuatro, que es solamente para la marca B.G Licenses. No sirve para otras
     *   columnas ni para otras filas."*
     *
     * Es una medida del MUEBLE, no del zapato ni de la marca, así que le gana a la serie y a
     * la sub-marca: en esa columna entran 800 y no hay más que discutir. Por eso va por zona y
     * columna, y por eso el alcance es exactamente el que él dictó — una sola columna.
     *
     * NO SE PODÍA EXPRESAR CON LO QUE HABÍA. La densidad por serie es de toda la zona, y el
     * MZN01 lo comparten Power y Bubblegummers; `densidadMarcaStd` va por `MarcaStd` del
     * Maestro, donde esta marca aparece con SEIS nombres distintos —Licenses, Disney, Marvel,
     * Bubblegummers/Disney, Bubblegummers/Marvel y Bubblegummers/Universal—, así que no hay un
     * nombre al que colgarle el número.
     *
     * Lo que cambia, medido sobre la tarea 10 del 17-ago (artículo 2811556, 865 pares del
     * buffer, reposición de un cuerpo): con 570 bajaban 545 y subían 320 en dos paletas; con
     * 800 bajan 765 y sube una sola paleta de 100. El cuerpo queda en 797 de 800. */
    densidadColumna: { MZN01: { 24: 800 } },

    /** La categoría que no sigue a su marca. */
    categoriaOthers: '06 OTHERS'
});

const _num = (v, respaldo, min, max) => {
    const n = Number(v);
    return (Number.isFinite(n) && n >= min && n <= max) ? Math.round(n) : respaldo;
};

/** Deja fuera cualquier cosa que no sea configuración válida, para que un dato roto no rompa la sugerencia. */
const normalizar = (crudo) => {
    const def = zonasPorDefecto();
    const c = (crudo && typeof crudo === 'object') ? crudo : {};

    const zonas = {};
    Object.keys(def.zonas).forEach(z => {
        const d = def.zonas[z];
        const v = (c.zonas && typeof c.zonas[z] === 'object') ? c.zonas[z] : {};
        const franjas = {};
        const origen = (v.franjas && typeof v.franjas === 'object') ? v.franjas : d.franjas;
        Object.keys(origen).forEach(k => {
            const col = Number(k);
            if (Number.isInteger(col) && col >= 1 && col <= 99 && FRANJAS[origen[k]]) {
                franjas[col] = origen[k];
            }
        });

        /* UNA COLUMNA QUE ADEMÁS SIRVE PARA OTRA COSA.
         *
         * Daniel, 14-ago-2026: el escolar de Power va a la columna 1 del MZN01 y el de North
         * Star a la 4 del MZN02 —"ahí puede ir el escolar con las temporadas anteriores"—. Las
         * dos son la ÚNICA columna de temporada anterior de su marca, así que cambiarles la
         * franja las dejaría sin dónde poner lo anterior.
         *
         * Va como campo aparte y no cambiando `franjas` a una lista, a propósito: `franjas` la
         * leen diez sitios —los dos mapas de calor, la capacidad de los saldos, el respaldo de
         * marca— y todos esperan un solo valor por columna. Acá se agrega lo que la columna
         * ADMITE ADEMÁS, sin tocarle lo que la columna ES. */
        const extra = {};
        const oExtra = (v.franjasExtra && typeof v.franjasExtra === 'object')
            ? v.franjasExtra : (d.franjasExtra || {});
        Object.keys(oExtra).forEach(k => {
            const col = Number(k);
            if (Number.isInteger(col) && col >= 1 && col <= 99 && FRANJAS[oExtra[k]]
                && franjas[col] && franjas[col] !== oExtra[k]) {
                extra[col] = oExtra[k];
            }
        });

        // Las columnas que no llegan al tope de la zona. En MZN01 la mayoría tiene 20
        // cuerpos y cuatro se quedan en 17.
        const cpc = {};
        const oCpc = (v.cuerposPorColumna && typeof v.cuerposPorColumna === 'object')
            ? v.cuerposPorColumna : (d.cuerposPorColumna || {});
        Object.keys(oCpc).forEach(k => {
            const col = Number(k), n = _num(oCpc[k], 0, 1, 99);
            if (Number.isInteger(col) && col >= 1 && col <= 99 && n) cpc[col] = n;
        });

        // Las columnas que no se pueden usar. Se toman de la configuración publicada si
        // viene, y si no, de fábrica: una PC con caché viejo no puede quedarse sin ellas
        // —por eso además subió el CACHE_KEY a v4—.
        const bloq = [...new Set(
            (Array.isArray(v.columnasBloqueadas) ? v.columnasBloqueadas : (d.columnasBloqueadas || []))
                .map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 99)
        )].sort((a, b) => a - b);

        zonas[z] = {
            etiqueta: String(v.etiqueta || d.etiqueta),
            activa: typeof v.activa === 'boolean' ? v.activa : d.activa,
            columnas: _num(v.columnas, d.columnas, 1, 99),
            cuerpos: _num(v.cuerpos, d.cuerpos, 1, 99),
            cuerposPorColumna: cpc,
            saldoMenorA: _num(v.saldoMenorA, d.saldoMenorA, 0, 100000),
            // 0 apaga la banda. Una configuración publicada antes de la v29.0214 no la trae,
            // y entonces manda el valor de fábrica: 199 en el selectivo, 0 en el resto.
            saldoGrandeHasta: _num(v.saldoGrandeHasta, d.saldoGrandeHasta || 0, 0, 100000),
            pasillos: Array.isArray(v.pasillos) ? v.pasillos.filter(p =>
                p && Number.isFinite(Number(p.desdeCol)) && Array.isArray(p.cuerpos)) : d.pasillos,
            columnasBloqueadas: bloq,
            franjas,
            franjasExtra: extra
        };
    });

    // Se acepta la forma vieja —'Bata': 'SEL'— además de la nueva —{ zona, columnas }—:
    // la configuración que ya está guardada en el servidor todavía tiene la primera, y al
    // leerla no puede quedarse sin marcas. Una marca vieja entra sin columnas, o sea la
    // zona entera, que es exactamente como se venía comportando.
    const marcas = {};
    const mSrc = (c.marcas && typeof c.marcas === 'object') ? c.marcas : def.marcas;
    Object.keys(mSrc).forEach(m => {
        const v = mSrc[m];
        const zona = (v && typeof v === 'object') ? v.zona : v;
        if (!zonas[zona]) return;
        const cols = (v && typeof v === 'object' && Array.isArray(v.columnas))
            ? v.columnas.map(Number).filter(n => Number.isFinite(n) && n >= 1 && n <= zonas[zona].columnas)
            : [];
        // El nombre corto del mapa. Si no viene, lo pone etiquetaDeMarca().
        const et = (v && typeof v === 'object' && v.etiqueta)
            ? String(v.etiqueta).trim().toUpperCase().slice(0, 12) : '';
        marcas[m] = { zona, columnas: [...new Set(cols)].sort((a, b) => a - b), etiqueta: et };
    });

    const others = (Array.isArray(c.others) ? c.others : def.others)
        .filter(o => o && o.subcategoria && zonas[o.zona])
        .map(o => ({ subcategoria: String(o.subcategoria).trim().toUpperCase(),
                     zona: o.zona, nota: String(o.nota || '') }));

    const densidad = {};
    Object.keys(zonas).forEach(z => {
        densidad[z] = {};
        const src = (c.densidad && c.densidad[z]) || def.densidad[z] || {};
        Object.keys(src).forEach(s => {
            const n = _num(src[s], 0, 1, 100000);
            if (n) densidad[z][String(s)] = n;
        });
    });

    const respaldo = {};
    Object.keys(zonas).forEach(z => {
        respaldo[z] = _num((c.densidadRespaldo || {})[z], def.densidadRespaldo[z] || 330, 1, 100000);
    });

    // La densidad por sub-marca: mapa plano nombre -> pares. Si la publicada no lo trae, manda
    // la de fábrica, para que un Comfit no vuelva a medirse con la capacidad de su serie.
    const porMarcaStd = {};
    const srcMS = (c.densidadMarcaStd && Object.keys(c.densidadMarcaStd).length)
      ? c.densidadMarcaStd : def.densidadMarcaStd;
    Object.keys(srcMS || {}).forEach(m => {
        const n = _num(srcMS[m], 0, 1, 100000);
        if (n) porMarcaStd[String(m).trim()] = n;
    });

    /* La capacidad por columna, igual que la de sub-marca: si la publicada no la trae, manda
       la de fábrica, para que el MZN01-24 no vuelva a medirse con la capacidad de la zona. */
    const porColumna = {};
    const srcCol = (c.densidadColumna && Object.keys(c.densidadColumna).length)
      ? c.densidadColumna : def.densidadColumna;
    Object.keys(srcCol || {}).forEach(z => {
        Object.keys(srcCol[z] || {}).forEach(col => {
            const n = _num(srcCol[z][col], 0, 1, 100000);
            const cn = _num(col, 0, 1, 999);
            if (n && cn) {
                if (!porColumna[z]) porColumna[z] = {};
                porColumna[z][cn] = n;
            }
        });
    });

    return { zonas, marcas, others, densidad, densidadRespaldo: respaldo,
             densidadMarcaStd: porMarcaStd,
             densidadColumna: porColumna,
             categoriaOthers: String(c.categoriaOthers || def.categoriaOthers) };
};

let _zonas = null;

const leerCache = () => {
    try {
        const txt = localStorage.getItem(CACHE_KEY);
        return txt ? normalizar(JSON.parse(txt)) : null;
    } catch (e) { return null; }
};

const escribirCache = (cfg) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) { /* sin caché se sigue igual */ }
};

/** La configuración vigente, SIN esperar a nadie. */
export const zonasActual = () => {
    if (_zonas) return _zonas;
    const local = leerCache();
    if (local) { _zonas = local; return _zonas; }
    return zonasPorDefecto();
};

/** Trae la configuración publicada. Se llama una vez al arrancar la app. */
export const cargarZonas = async () => {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && datos.zonas) {
                _zonas = normalizar(datos.zonas);
                escribirCache(_zonas);
                return _zonas;
            }
        }
    } catch (e) {
        console.warn('[Zonas] no se pudo traer la publicada, se usa la de esta PC:', e && e.message);
    }
    _zonas = leerCache() || zonasPorDefecto();
    return _zonas;
};

/**
 * Publica para todas las PC. Se relee 'config' y se reemplaza SOLO la clave 'zonas':
 * el área es compartida con la jornada y pisarla entera se la llevaría puesta.
 */
export const guardarZonas = async (nueva) => {
    const cfg = normalizar(nueva);
    _zonas = cfg;
    escribirCache(cfg);

    let cajon = {};
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
    } catch (e) { /* si no se puede releer, se manda solo lo de zonas */ }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cajon, zonas: cfg })
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return cfg;
};

// ── Lo que consulta la sugerencia ────────────────────────────────────────────

/** La regla de una marca: su zona y sus columnas. Null si esa marca no está configurada. */
export const reglaDeMarca = (marca) => {
    const m = String(marca || '').trim();
    const cfg = zonasActual();
    if (cfg.marcas[m]) return cfg.marcas[m];
    // Sin distinguir mayúsculas ni espacios de más, que el Maestro no siempre es prolijo
    const buscado = m.toUpperCase().replace(/\s+/g, ' ');
    const hallado = Object.keys(cfg.marcas).find(k => k.toUpperCase().replace(/\s+/g, ' ') === buscado);
    return hallado ? cfg.marcas[hallado] : null;
};

/** La zona de una marca. Devuelve null si esa marca no está configurada. */
export const zonaDeMarca = (marca) => {
    const r = reglaDeMarca(marca);
    return r ? r.zona : null;
};

/**
 * Las columnas de esa marca dentro de su zona. Vacío = la zona entera, sin repartir.
 * Las bloqueadas se sacan acá también: si a Power le tocan la 1 a la 11 y la 5, 6 y 9 están
 * fuera de circulación, sus columnas son las ocho que quedan.
 */
export const columnasDeMarca = (marca) => {
    const r = reglaDeMarca(marca);
    if (!r || !Array.isArray(r.columnas)) return [];
    const z = zonasActual().zonas[r.zona];
    const bloq = (z && z.columnasBloqueadas) || [];
    return r.columnas.filter(c => !bloq.includes(Number(c)));
};

/**
 * MARCAS QUE COMPARTEN COLUMNAS EN ALGUNAS FRANJAS.
 *
 * B.G Licenses ES Bubblegummers: la misma marca, solo que la licencia trae los dibujitos
 * licenciados y la regular no. Daniel lo dijo el 06-ago-2026 — su temporada ACTUAL se queda
 * sola en la 24 del mezzanine 1, que es la columna de las licencias, pero SU TEMPORADA
 * ANTERIOR Y SUS SALDOS van con los de Bubblegummers. Son lo mismo y no tiene sentido
 * guardarlos aparte.
 *
 * Sin esto no había a dónde mandarlos. A B.G Licenses le toca una sola columna y es de
 * temporada actual, así que los 864 pares de "T. Anterior" que había en el buffer ese día
 * caían en el respaldo `todasSuyas` y terminaban en la 24, mezclados con la actual y sin que
 * el papel dijera nada.
 */
const COMPARTE_COLUMNAS = {
    /* B.G Licenses ES Bubblegummers: la misma marca, solo que la licencia trae dibujitos
     * licenciados. Le toca una sola columna propia —la 24, de temporada actual—, así que todo
     * lo demás lo guarda en las de Bubblegummers.
     *
     * El ESCOLAR se agregó el 14-ago-2026, a pedido de Daniel: *"si llega escolar de
     * Bubblegummers licencia, que se ponga en el sitio de escolar de Bubblegummers, que es lo
     * mismo"*. Sin esto no tenía a dónde ir —la columna de escolar del MZN01 es la 21 y es de
     * Bubblegummers— y caía en el respaldo, mezclado con la temporada actual. */
    'B.G LICENSES': { con: 'Bubblegummers', franjas: ['anterior', 'saldos', 'escolar'] }
};

/**
 * Las columnas que le tocan a una marca EN ESA FRANJA. Casi siempre son las suyas; las de
 * COMPARTE_COLUMNAS piden prestadas las de otra marca en las franjas que comparten.
 */
export const columnasDeMarcaEnFranja = (marca, franja) => {
    const propias = columnasDeMarca(marca);
    const clave = String(marca || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const acuerdo = COMPARTE_COLUMNAS[clave];
    if (!acuerdo || !acuerdo.franjas.includes(franja)) return propias;

    // Prestar solo dentro de la misma zona. Mandar un artículo del mezzanine 1 a una columna
    // del 3 sería peor que dejarlo mezclado, y con la configuración de hoy no puede pasar
    // -las dos están en MZN01-, pero acá no se da por sentado.
    const mia = reglaDeMarca(marca), otra = reglaDeMarca(acuerdo.con);
    if (!mia || !otra || mia.zona !== otra.zona) return propias;

    const prestadas = columnasDeMarca(acuerdo.con);
    // Si la otra marca no tiene columnas repartidas, se sigue con las propias: es preferible
    // dejarlo mezclado a mandarlo a Slotting por una configuración incompleta.
    return prestadas.length ? prestadas : propias;
};

/**
 * EL NOMBRE CON EL QUE LA MARCA SE MUESTRA EN EL MAPA.
 *
 * No es el del Maestro: en el mapa cada columna mide unos 46 píxeles y "Bata Industrials" no
 * entra. Y además nadie en el almacén la llama así — Daniel lo dijo el 05-ago-2026:
 * *"no le pongas Bata Industrial, ponle INDUSTRIAL nada más"*.
 *
 * Se puede pisar por marca desde Zonas de Almacenaje con el campo `etiqueta`.
 */
const ETIQUETAS_POR_DEFECTO = {
    'Bata Industrials': 'INDUSTRIAL',
    'Marie Claire':     'M. CLAIRE',
    'B.G Licenses':     'BG LICENC.',
    'Bubblegummers':    'BUBBLEGUM',
    'North Star':       'NORTH STAR',
    'Weinbrenner':      'WEINBRENN'
};

export const etiquetaDeMarca = (marca) => {
    const r = reglaDeMarca(marca);
    if (r && r.etiqueta) return String(r.etiqueta).toUpperCase();
    return (ETIQUETAS_POR_DEFECTO[String(marca || '').trim()] || String(marca || '')).toUpperCase();
};

/**
 * LAS TRES PRIMERAS LETRAS. Es lo que va al pie de cada columna del mapa: WEI, PUM, ADI,
 * IND... Con el nombre entero las columnas quedaban tapadas de texto.
 *
 * Se toman solo letras y números, así "M. CLAIRE" da MCL y no "M. ", y "B.G Licenses" da BGL.
 */
export const siglaDeMarca = (marca) =>
    etiquetaDeMarca(marca).replace(/[^A-ZÁÉÍÓÚÑ0-9]/gi, '').slice(0, 3);

/**
 * Los colores del mapa. Con dos exclusiones, y las dos importan:
 *
 *   - NADA DE AZUL NI ROJO: esos ya significan temporada actual y temporada anterior en las
 *     celdas. Repetirlos haría que dos cosas distintas se vieran igual.
 *   - NADA DEL VIOLETA DEL CATÁLOGO (#a855f7): esa columna no es de ninguna marca y lleva el
 *     color que ya tiene la franja 'catalogo' en FRANJAS. Estaba en esta lista y en MZN03 le
 *     tocaba a Skechers, así que la columna 8 y las 9-11 salían del mismo color.
 */
export const PALETA_MARCAS = ['#f59e0b', '#ec4899', '#14b8a6', '#22c55e', '#f97316',
                              '#06b6d4', '#eab308', '#8b5cf6', '#10b981', '#d946ef'];

/**
 * Las marcas que se reparten una zona, en orden de columna, ya con su etiqueta y su color.
 *
 * DEVUELVE VACÍO CUANDO LA ZONA ES DE UNA SOLA MARCA. Bata tiene el selectivo entero y North
 * Star el mezzanine 2: ahí `columnas` está vacío —quiere decir "toda la zona"— y no hay nada
 * que repartir ni que pintar. Por eso el mapa solo dibuja la barra de marcas en las zonas
 * compartidas, que hoy son MZN01 y MZN03. Si mañana entra otra marca al 2, aparece sola.
 */
export const marcasDeZona = (zona) => {
    const cfg = zonasActual();
    return Object.keys(cfg.marcas)
        .filter(m => cfg.marcas[m] && cfg.marcas[m].zona === zona)
        .map(m => ({ marca: m, columnas: columnasDeMarca(m) }))
        .filter(x => x.columnas.length)
        .sort((a, b) => a.columnas[0] - b.columnas[0])
        .map((x, i) => ({ ...x, etiqueta: etiquetaDeMarca(x.marca), sigla: siglaDeMarca(x.marca),
                          color: PALETA_MARCAS[i % PALETA_MARCAS.length] }));
};

/** De quién es esta columna: la marca, o la franja especial si no tiene dueño. */
export const duenoDeColumna = (zona, columna) => {
    const m = marcasDeZona(zona).find(x => x.columnas.includes(Number(columna)));
    if (m) return m;
    // La 8 del mezzanine 3 no es de nadie: es el catálogo del buffer D. Su color sale de la
    // franja, que es donde ya estaba definido, y por eso PALETA_MARCAS no lo incluye.
    if (franjaDeColumna(zona, columna) === SIN_FILTRO_DE_MARCA) {
        return { marca: 'CATÁLOGO', etiqueta: 'CATÁLOGO', sigla: 'CAT',
                 color: FRANJAS[SIN_FILTRO_DE_MARCA].color, columnas: [Number(columna)] };
    }
    return null;
};

/**
 * "1-11" · "1,2,3" · "1-5, 8, 12 al 14"  ->  [1,2,3,...]
 *
 * Lo que no se entienda se ignora en vez de rechazar toda la línea: quien escribe esto está
 * apurado y con una coma de más no puede perder lo que ya cargó.
 */
export const leerColumnas = (txt) => {
    const out = new Set();
    String(txt || '').split(/[,;]+/).forEach(p => {
        const t = p.trim();
        if (!t) return;
        const m = t.match(/^(\d+)\s*(?:-|a|al)\s*(\d+)$/i);
        if (m) {
            const a = Math.min(+m[1], +m[2]), b = Math.max(+m[1], +m[2]);
            for (let i = a; i <= b; i++) out.add(i);
        } else if (/^\d+$/.test(t)) out.add(+t);
    });
    return [...out].sort((a, b) => a - b);
};

/** [1,2,3,7,8] -> "1-3, 7-8". Al revés de leerColumnas, para mostrarlo corto. */
export const escribirColumnas = (cols) => {
    const c = [...new Set((cols || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
    if (!c.length) return '';
    const tramos = [];
    let ini = c[0], prev = c[0];
    c.slice(1).forEach(n => {
        if (n === prev + 1) { prev = n; return; }
        tramos.push(ini === prev ? String(ini) : `${ini}-${prev}`);
        ini = prev = n;
    });
    tramos.push(ini === prev ? String(ini) : `${ini}-${prev}`);
    return tramos.join(', ');
};

/**
 * La zona de una ojota, por su subcategoría. Gana la regla MÁS LARGA que le calce, para que
 * 'F46_75_KIDS WINTER' no la resuelva un 'F46' genérico que alguien agregue después.
 */
export const zonaDeOthers = (subcategoria) => {
    const s = String(subcategoria || '').trim().toUpperCase();
    if (!s) return null;
    const calzan = zonasActual().others
        .filter(o => s.startsWith(o.subcategoria))
        .sort((a, b) => b.subcategoria.length - a.subcategoria.length);
    return calzan.length ? calzan[0].zona : null;
};

/** ¿Esta categoría es la que no sigue a su marca? */
export const esOthers = (genderRims) =>
    String(genderRims || '').trim().toUpperCase().includes('OTHERS');

/**
 * LO QUE NO ES CALZADO VA AL MEZZANINE 4.
 *
 * El corte lo da la columna 'G. Gender' del Maestro —OJO, no 'Gender RIMS', que es la de al
 * lado—. Tiene cuatro valores y solo uno es calzado:
 *
 *   Footwear ........ sigue a su marca, como siempre
 *   Non Footwear .... accesorios y ropa      -> MZN04
 *   Non Commercial .. papelería y cajas      -> MZN04
 *   Promotions ...... promociones            -> MZN04
 *
 * El dato ya venía en el Maestro y el código ya lo leía: se usaba SOLO para la meta de
 * productividad. Por eso las carteras Bata salían al selectivo y los bolsos North Star al
 * mezzanine 2 — para el sistema eran "Bata" y "North Star" y nada más.
 *
 * El almacén ya venía aplicando esta regla solo, sin que estuviera escrita: el 100% de los
 * pares de Non Footwear, Non Commercial y Promotions que hay en el piso está en MZN04, y
 * sacando las ojotas, del calzado común solo el 0,2% aparece ahí.
 *
 * LAS OJOTAS SE PREGUNTAN ANTES y no pasan por acá: los 1.727 códigos de '06 OTHERS' están
 * marcados como Footwear, así que las dos reglas no se pisan. La pantufla en caja tiene que
 * poder seguir yendo al selectivo.
 *
 * SIN DATO NO SE INVENTA: 56 códigos del Maestro tienen 'G. Gender' vacío. Esos siguen por
 * su marca, exactamente como venían — cambiarles el destino con el campo en blanco sería
 * adivinar.
 */
export const ZONA_NO_CALZADO = 'MZN04';

export const esCalzado = (gGender) =>
    String(gGender || '').trim().toUpperCase() === 'FOOTWEAR';

/**
 * LAS ZONAS QUE SE ENTREGAN SIN UBICACIÓN.
 *
 * El mezzanine 4 no se parece a ninguna otra zona: un cuerpo lleva VARIOS artículos, los
 * niveles A, B y C son activo y el D es reserva interna, y está al 95% de su capacidad.
 * Daniel lo tiene analizado pero decidió no cargarlo todavía: primero hay que consolidar las
 * zonas de calzado.
 *
 * Mientras tanto la tarea igual tiene que salir. Si recepción deja accesorios en el buffer,
 * el operario tiene que saber que van al mezzanine 4 — pero NO se le puede dar una ubicación
 * exacta, porque esas ubicaciones no están analizadas y cualquier cuerpo que le indiquemos
 * sería inventado. Así que se le da la zona y nada más.
 *
 * Y todo lo que va ahí SE ALMACENA ENTERO: nada sube a reserva. Es regla de Daniel.
 */
export const esZonaSinUbicacion = (zona) => zona === ZONA_NO_CALZADO;

/** La serie es el PRIMER DÍGITO del código de artículo. La 0 es la más chica. */
export const serieDe = (codigo) => {
    const s = String(codigo || '').trim();
    return /^\d/.test(s) ? s[0] : null;
};

/** Pares que entran en un cuerpo de esa zona para esa serie. */
export const densidadDe = (zona, serie, marcaStd, columna) => {
    const cfg = zonasActual();
    // LA COLUMNA MANDA SOBRE TODO: es la medida del mueble. Si esa columna tiene su propia
    // capacidad, ahí entra eso y no hay serie ni sub-marca que valga. Ver `densidadColumna`.
    const col = Number(columna);
    if (col && cfg.densidadColumna && cfg.densidadColumna[zona] && cfg.densidadColumna[zona][col]) {
        return cfg.densidadColumna[zona][col];
    }
    // LA SUB-MARCA MANDA SOBRE LA SERIE. Un Bata Comfit entra 600 en un cuerpo donde su serie
    // diría 450: lo que decide cuánto entra es el grosor del zapato, y eso la serie no lo sabe.
    const ms = String(marcaStd || '').trim();
    if (ms && cfg.densidadMarcaStd && cfg.densidadMarcaStd[ms]) return cfg.densidadMarcaStd[ms];
    const d = cfg.densidad[zona] || {};
    const v = d[String(serie)];
    return v || cfg.densidadRespaldo[zona] || 330;
};

/**
 * LA CAPACIDAD QUE LE TOCA A UN ARTÍCULO ANTES DE SABER EN QUÉ CUERPO VA.
 *
 * El objetivo del piso se calcula antes de elegir los cuerpos —primero CUÁNTO, después
 * DÓNDE—, así que ahí todavía no hay columna que consultar. Pero sí se sabe cuáles son sus
 * columnas candidatas: las de su franja, y dentro de esas las de su marca.
 *
 * Si TODAS esas columnas tienen la misma capacidad propia, esa es la del artículo — es el
 * caso de B.G Licenses, que en temporada actual tiene una sola columna, la 24 del MZN01, con
 * sus 800. Si las candidatas no coinciden entre sí, no se puede decidir de antemano y manda
 * la de siempre: la sub-marca o la serie.
 */
export const capacidadDeArticulo = (art, zona) => {
    const cfg = zonasActual();
    const porCol = (cfg.densidadColumna || {})[zona];
    const normal = densidadDe(zona, serieDe(art && art.sku7), art && art.marcaStd);
    if (!porCol) return normal;

    const franja = franjaDeArticulo(art, zona);
    if (!franja) return normal;
    let columnas = columnasDeFranja(zona, franja);
    const suyas = columnasDeMarcaEnFranja(art && art.marca, franja);
    if (suyas.length) {
        const propias = columnas.filter(c => suyas.includes(c));
        if (propias.length) columnas = propias;
    }
    if (!columnas.length) return normal;

    const caps = columnas.map(c => porCol[Number(c)]).filter(Boolean);
    if (caps.length !== columnas.length) return normal;      // alguna no tiene capacidad propia
    return caps.every(v => v === caps[0]) ? caps[0] : normal; // o no se ponen de acuerdo
};

/**
 * LA FRANJA QUE LE TOCA A UN ARTÍCULO. El orden lo dictó Daniel y no es negociable:
 *
 *   1. el gender escolar manda sobre todo lo demás. Si dice SCHOOL va a su columna, no
 *      importa la temporada ni que sean tres pares
 *   2. después los de pocos pares —hasta el corte de la zona, hoy 20 en el selectivo—, que
 *      van a saldos vengan de la temporada que vengan
 *   3. recién ahí la temporada: actual o anterior
 *
 * Vive acá afuera porque la usan dos: planificarAlmacenaje para elegir la columna, y la
 * sugerencia para saber si el artículo ya está establecido en la franja que le toca.
 */
export const franjaDeArticulo = (art, zona) => {
    const z = zonasActual().zonas[zona];
    if (!z) return null;
    // EL BUFFER D MANDA SOBRE TODO LO DEMÁS. Lo que se matricula ahí va a la columna de
    // catálogo entero, no importa la marca ni la temporada ni cuántos pares sean.
    if (art.origen === 'D' && columnasDeFranja(zona, 'catalogo').length) return 'catalogo';
    const esEscolar = String(art.genderRims || '').toUpperCase().includes('SCHOOL');
    if (esEscolar && columnasDeFranja(zona, 'escolar').length) return 'escolar';
    /* EL CORTE DE SALDO ES 20 EN TODAS LAS ZONAS. Daniel, 14-ago-2026: *"el saldo es para el
     * uno, el dos y parte del tres. Menos de veinte es un saldo; igual o mayor a veinte ya no"*.
     * Los mezzanines tenían 80 y era un número inventado: con ese corte, un artículo con 60
     * pares de temporada actual se iba a la columna de saldos. Es el MISMO 20 con el que se
     * decide si un código es nuevo o reposición, y eso no es casualidad — las dos preguntas
     * miran lo mismo: si al artículo le queda algo de verdad en el almacén. */
    if (Number(art.pares) < z.saldoMenorA && columnasDeFranja(zona, 'saldos').length) return 'saldos';
    /* EL SALDO GRANDE: de 20 a 199 pares Y de temporada actual. Daniel, 14-ago-2026: *"los
     * saldos que son mayores o igual a veinte se enviarán al SEL cuatro. Todo ese selectivo
     * puede tener más de un artículo en un cuerpo. Siempre y cuando el saldo sea T. Actual"*.
     *
     * LAS TRES CONDICIONES SON OBLIGATORIAS. La de temporada es la que más se olvida: un
     * artículo de temporada anterior con 100 pares NO es saldo grande, tiene su propia
     * columna y ahí va. Por eso la pregunta se hace después de descartar la anterior y no
     * antes.
     *
     * El piso de la banda es el mismo `saldoMenorA` que decide la columna de saldos: lo que
     * no llegó a ser saldo chico empieza a ser saldo grande, sin huecos entre las dos. */
    const hasta = Number(z.saldoGrandeHasta) || 0;
    if (hasta > 0 && art.esTemporadaActual
        && Number(art.pares) <= hasta
        && columnasDeFranja(zona, 'saldoGrande').length) return 'saldoGrande';
    return art.esTemporadaActual ? 'actual' : 'anterior';
};

/** La temporada que le toca a una columna: 'actual', 'anterior', 'saldos', 'escolar'... */
export const franjaDeColumna = (zona, columna) => {
    const z = zonasActual().zonas[zona];
    return (z && z.franjas[Number(columna)]) || 'ninguna';
};

/**
 * Hasta qué cuerpo llega esa columna. No todas terminan igual: en MZN01 la mayoría llega al
 * 20 y cuatro se quedan en 17. Sin esto la sugerencia ofrece cuerpos que no existen, que fue
 * lo que pasó el 02-ago con MZN01-04-21 y -22.
 */
export const cuerposDeColumna = (zona, columna) => {
    const z = zonasActual().zonas[zona];
    if (!z) return 0;
    return (z.cuerposPorColumna && z.cuerposPorColumna[Number(columna)]) || z.cuerpos;
};

/**
 * COLUMNAS BLOQUEADAS: las que no se pueden usar, por más que tengan franja y cuerpos.
 *
 * Daniel las sacó de circulación el 05-ago-2026 — MZN01 la 5, 6 y 9; MZN02 la 5, 6, 9, 10,
 * 13, 14, 17, 18, 21 y 22— y están vacías de punta a punta, con todos sus cuerpos. El stock
 * lo confirma: cero pares en todas ellas.
 *
 * No es lo mismo que un pasillo. El pasillo saca CUERPOS sueltos de un tramo de columnas
 * —los del elevador del selectivo—; esto saca la columna ENTERA.
 */
export const esColumnaBloqueada = (zona, columna) => {
    const z = zonasActual().zonas[zona];
    return !!(z && (z.columnasBloqueadas || []).includes(Number(columna)));
};

/** Las columnas bloqueadas de una zona. */
export const columnasBloqueadasDe = (zona) => {
    const z = zonasActual().zonas[zona];
    return (z && z.columnasBloqueadas) ? [...z.columnasBloqueadas] : [];
};

/** Las columnas de una zona que llevan esa temporada, en orden. Sin las bloqueadas. */
export const columnasDeFranja = (zona, franja) => {
    const z = zonasActual().zonas[zona];
    if (!z) return [];
    const bloq = z.columnasBloqueadas || [];
    const extra = z.franjasExtra || {};
    // Las que SON de esa franja, más las que ADEMÁS la admiten (ver franjasExtra)
    const cols = new Set();
    Object.keys(z.franjas).forEach(c => { if (z.franjas[c] === franja) cols.add(Number(c)); });
    Object.keys(extra).forEach(c => { if (extra[c] === franja) cols.add(Number(c)); });
    return [...cols].filter(c => !bloq.includes(c)).sort((a, b) => a - b);
};

/**
 * ¿Esta columna sirve para esa franja? Mira lo que la columna ES y lo que ADMITE ADEMÁS.
 *
 * Hace falta aparte de `franjaDeColumna` porque esa devuelve un solo valor —el principal— y
 * lo usan los mapas de calor, donde una columna tiene que pintarse de un color y no de dos.
 */
export const columnaSirveParaFranja = (zona, columna, franja) => {
    const z = zonasActual().zonas[zona];
    if (!z) return false;
    const col = Number(columna);
    return z.franjas[col] === franja || (z.franjasExtra || {})[col] === franja;
};

/* ══════════════════════════════════════════════════════════════════════════════
 * UN CUERPO, UN ARTÍCULO — Y DÓNDE SÍ SE PUEDE COMPARTIR
 *
 * Regla de Daniel del 14-ago-2026, cuando vio que el sistema mandaba mercadería a cuerpos que
 * ya tenían hasta veinte artículos distintos adentro: *"hay que ser bien estricto con eso, y
 * para no llegar a eso debe respetarse cuerpo-artículo. Todos los cuerpos deberían ser cuerpo-
 * artículo, salvo los mixtos o las temporadas anteriores o escolar"*.
 *
 * Así que la exigencia va por FRANJA, no por zona:
 *
 *   actual     ESTRICTA. Es la zona viva de cada marca y es donde se pica todo el día; dos
 *              artículos en un cuerpo le cuestan tiempo al picker en cada pedido.
 *   anterior   comparte. Son saldos que envejecen juntos y no vale la pena darles un cuerpo
 *   saldos     comparte. Ya lo hacía: cientos de artículos de diez pares
 *   escolar    comparte. Curvas cortas y poco volumen por código
 *   catalogo   comparte. La columna 8 del MZN03 mezcla las tres marcas por definición
 *
 * Medido el 14-ago sobre el almacén: la franja actual tiene 661 cuerpos con un solo artículo y
 * 284 compartidos —el 30%—; las otras cuatro van del 74% al 100% de compartido, que es
 * exactamente lo que dice la regla.
 * ══════════════════════════════════════════════════════════════════════════════ */
const FRANJAS_QUE_COMPARTEN = ['anterior', 'saldos', 'saldoGrande', 'escolar', 'catalogo'];

/** ¿En esta columna se puede poner más de un artículo por cuerpo? */
export const columnaAdmiteVariosArticulos = (zona, columna) => {
    const z = zonasActual().zonas[zona];
    if (!z) return true;                       // sin reglas no se bloquea nada
    const col = Number(columna);
    const propia = z.franjas[col];
    const extra = (z.franjasExtra || {})[col];
    // Alcanza con que UNA de sus franjas permita compartir: una columna que lleva temporada
    // anterior y escolar comparte por las dos.
    return FRANJAS_QUE_COMPARTEN.includes(propia) || FRANJAS_QUE_COMPARTEN.includes(extra);
};

/** ¿Ese cuerpo es paso del elevador? Entonces no existe como ubicación de almacenaje. */
export const esPasillo = (zona, columna, cuerpo) => {
    const z = zonasActual().zonas[zona];
    if (!z) return false;
    const col = Number(columna), cue = Number(cuerpo);
    return (z.pasillos || []).some(p =>
        col >= Number(p.desdeCol) && col <= Number(p.hastaCol) && p.cuerpos.map(Number).includes(cue));
};

/** Todos los cuerpos que existen en una zona, salteando los pasillos. */
export const cuerposDe = (zona) => {
    const z = zonasActual().zonas[zona];
    if (!z) return [];
    const salida = [];
    for (let c = 1; c <= z.columnas; c++) {
        if (esColumnaBloqueada(zona, c)) continue;
        // Cada columna termina donde termina: los macizos de MZN01 y MZN02 llegan a 17.
        const tope = (z.cuerposPorColumna && z.cuerposPorColumna[c]) || z.cuerpos;
        for (let cu = 1; cu <= tope; cu++) {
            if (!esPasillo(zona, c, cu)) salida.push({ columna: c, cuerpo: cu });
        }
    }
    return salida;
};

/** Las zonas que ya tienen reglas cargadas y pueden sugerir. */
export const zonasActivas = () => {
    const z = zonasActual().zonas;
    return Object.keys(z).filter(k => z[k].activa);
};

// ── LA SUGERENCIA ────────────────────────────────────────────────────────────

/**
 * Los cuerpos libres MÁS SEGUIDOS que se pueda, dentro de las columnas que correspondan.
 *
 * Daniel lo hace así: empieza por el primero libre y camina hacia adelante; si el que sigue
 * está ocupado, salta al próximo. De todas las tandas posibles se elige la que ocupa el
 * tramo más corto, que es lo mismo pero sin quedarse con la primera que aparece: cinco
 * cuerpos desparramados por una columna entera es peor que cinco seguidos en otra.
 *
 * ocupados: Set con claves 'columna-cuerpo' (números sin ceros, ej. '5-14').
 */
/**
 * UN CUERPO QUE LE HAGA LUGAR, compartiendo.
 *
 * Para lo que no justifica un cuerpo propio: los saldos, que son cientos de artículos con
 * diez pares cada uno. Dándole un cuerpo entero a cada uno harían falta 748 cuerpos y el
 * selectivo tiene 284. Compartiendo entran en 26.
 *
 * Busca el que MEJOR lo reciba, no el que más lugar tenga: entre los que ya tienen algo se
 * queda con el más lleno de los que todavía le dan. Así se consolida en pocos cuerpos en vez
 * de dejar veinte a medio llenar, que es lo que después frena al picker.
 *
 * Un cuerpo vacío es el último recurso: gastarlo en diez pares es tirar un cuerpo entero.
 *
 * `libres` es un Map de 'columna-cuerpo' a los pares que le quedan. Sin él no hay nada que
 * compartir y devuelve null, y quien llama sigue por el camino de siempre.
 */
export const cuerpoQueRecibe = (zona, columnas, pares, ocupados, libres) => {
    if (!libres || !(pares > 0)) return null;
    const z = zonasActual().zonas[zona];
    if (!z) return null;

    let mejor = null, vacio = null;
    columnas.forEach(col => {
        if (esColumnaBloqueada(zona, col)) return;   // última red: nunca se usa una bloqueada
        const tope = (z.cuerposPorColumna && z.cuerposPorColumna[Number(col)]) || z.cuerpos;
        for (let cu = 1; cu <= tope; cu++) {
            if (esPasillo(zona, col, cu)) continue;
            const clave = `${col}-${cu}`;
            if (!ocupados.has(clave)) {
                if (!vacio) vacio = { columna: col, cuerpo: cu };
                continue;
            }
            const queda = libres.get(clave);
            if (!(queda >= pares)) continue;
            // el más lleno de los que le dan: el que menos lugar deja sobrando
            if (!mejor || queda < mejor.queda) mejor = { columna: col, cuerpo: cu, queda };
        }
    });

    if (mejor) return { cuerpos: [{ columna: mejor.columna, cuerpo: mejor.cuerpo }],
                        completo: true, compartido: true, libreQueTenia: mejor.queda };
    if (vacio) return { cuerpos: [vacio], completo: true, compartido: false };
    return null;
};

export const elegirCuerpos = (zona, columnasPedidas, cuantos, ocupados) => {
    const z = zonasActual().zonas[zona];
    if (!z || cuantos < 1) return { cuerpos: [], completo: false, libresEnLaFranja: 0 };

    // Última red: una columna bloqueada no se usa aunque quien llame la haya pedido.
    const columnas = (columnasPedidas || []).filter(c => !esColumnaBloqueada(zona, c));

    const libresDe = (col) => {
        const salida = [];
        // Cada columna termina donde termina: no todas llegan al tope de la zona
        const tope = (z.cuerposPorColumna && z.cuerposPorColumna[Number(col)]) || z.cuerpos;
        for (let cu = 1; cu <= tope; cu++) {
            if (esPasillo(zona, col, cu)) continue;
            if (!ocupados.has(`${col}-${cu}`)) salida.push(cu);
        }
        return salida;
    };

    let total = 0, mejor = null;
    const porColumna = [];
    columnas.forEach(col => {
        const L = libresDe(col);
        total += L.length;
        porColumna.push({ col, L });
        for (let i = 0; i + cuantos <= L.length; i++) {
            const tramo = L[i + cuantos - 1] - L[i];
            if (!mejor || tramo < mejor.tramo) {
                mejor = { tramo, columna: col, cuerpos: L.slice(i, i + cuantos) };
            }
        }
    });

    if (mejor) {
        return {
            cuerpos: mejor.cuerpos.map(cu => ({ columna: mejor.columna, cuerpo: cu })),
            completo: true,
            seguidos: mejor.tramo === cuantos - 1,
            libresEnLaFranja: total
        };
    }

    // NINGUNA COLUMNA SOLA ALCANZA, PERO ENTRE VARIAS SÍ.
    //
    // Antes se cortaba acá y la mercadería salía a Slotting con un "hacen falta 3 cuerpos y
    // solo hay 3 libres" que además era falso: contaba los de una columna, no los de la
    // franja. Con un mezzanine cargado —que es cuando más falta hace— los libres quedan
    // repartidos de a uno o dos por columna y así no se podía usar ninguno.
    //
    // Se juntan de a columnas, empezando por la que más aporta, para partir el artículo en la
    // menor cantidad de columnas posible. Va marcado como NO seguidos: el papel tiene que
    // decir la verdad de que quedó repartido.
    if (total >= cuantos) {
        const juntados = [];
        [...porColumna].sort((a, b) => b.L.length - a.L.length).forEach(({ col, L }) => {
            for (let i = 0; i < L.length && juntados.length < cuantos; i++) {
                juntados.push({ columna: col, cuerpo: L[i] });
            }
        });
        return { cuerpos: juntados, completo: true, seguidos: false, libresEnLaFranja: total };
    }

    // No alcanza para todos: se devuelve lo que hay, para poder decir cuánto falta
    const sueltos = [];
    porColumna.forEach(({ col, L }) => L.forEach(cu => sueltos.push({ columna: col, cuerpo: cu })));
    return { cuerpos: sueltos.slice(0, cuantos), completo: false, seguidos: false, libresEnLaFranja: total };
};

/**
 * Dónde almacenar un artículo que está en el buffer. Los cinco pasos, en orden:
 *
 *   0. ¿Es OTHERS? Entonces manda la subcategoría, no la marca.
 *   1. La zona sale de la marca.
 *   2. Las columnas salen de la temporada (o de que sea saldo, o escolar).
 *   3. Cuántos cuerpos: los pares divididos por lo que entra en un cuerpo de esa serie.
 *   4. Cuáles: los libres más seguidos.
 *   5. Si no hay, no se improvisa: va a Slotting.
 *
 * `yaTiene` son los cuerpos donde el artículo ya vive. Si tiene, es reposición y se
 * devuelven esos: no se manda a un cuerpo nuevo lo que ya tiene su lugar.
 */
/**
 * La zona de un artículo, sin calcular nada más. Hace falta antes que el resto, porque de
 * la zona sale la densidad del cuerpo, y de la densidad sale cuántos pares bajan al piso.
 * Devuelve { zona, porOthers } o { zona: null, motivo }.
 */
export const resolverZona = (art) => {
    if (esOthers(art.genderRims)) {
        const z = zonaDeOthers(art.subcategoria);
        return z ? { zona: z, porOthers: true }
                 : { zona: null, motivo: `Es ${zonasActual().categoriaOthers} y su subcategoría "${art.subcategoria || '(vacía)'}" no está configurada.` };
    }
    // Después de las ojotas y ANTES de la marca: lo que no es calzado no la sigue.
    // Con el campo vacío no se decide nada y sigue de largo, que es lo que venía haciendo.
    if (art.gGender && !esCalzado(art.gGender)) {
        return { zona: ZONA_NO_CALZADO, porOthers: false, porNoCalzado: true };
    }
    const z = zonaDeMarca(art.marca);
    return z ? { zona: z, porOthers: false }
             : { zona: null, motivo: `La marca "${art.marca || '(vacía)'}" no tiene zona configurada.` };
};

/**
 * Cuánto se tolera pasarse antes de abrir otro cuerpo. Redondeando siempre para arriba, 690
 * pares con cuerpos de 683 abrían un segundo cuerpo para 7 pares — justo lo que el candado
 * del "cuánto" viene a evitar. Y la capacidad no es un límite físico exacto: es el percentil
 * 75 de lo que hay guardado, así que un poco más entra.
 *
 * Vive acá afuera porque la usan las dos ramas: la del código nuevo y la de la reposición,
 * que tiene que medir con la misma vara.
 */
const HOLGURA = 0.10;

export const planificarAlmacenaje = (art, ocupadosPorZona, libresPorZona = {}, ocupantesPorZona = {}) => {
    const cfg = zonasActual();
    const paso = (estado, motivo, extra) => ({ estado, motivo, ...extra });

    // LA ZONA SE RESUELVE PRIMERO, PORQUE HAY UNA QUE LE GANA A LA REPOSICIÓN.
    // Acá arrancaba el atajo de reposición, pero el mezzanine 4 tiene que pasar antes: si un
    // accesorio ya tiene un cuerpo ahí, tampoco se lo podemos nombrar.
    const zr = resolverZona(art);

    // EL MEZZANINE 4 SE ENTREGA SIN UBICACIÓN.
    // La tarea sale igual y con todo para almacenar —el operario tiene que saber que eso va
    // al mezzanine 4— pero sin columna, sin cuerpo y sin nivel. Ver esZonaSinUbicacion.
    if (esZonaSinUbicacion(zr.zona)) {
        return paso('solo-zona', null, {
            zona: zr.zona, cuerpos: [], cuantos: 0, sinUbicacion: true,
            porOthers: !!zr.porOthers, porNoCalzado: !!zr.porNoCalzado
        });
    }

    // REPOSICIÓN antes que el resto: si el artículo ya vive en el almacén, va a sus
    // mismos cuerpos y no hace falta preguntarle nada a la configuración. Vale incluso en
    // las zonas que todavía no tienen reglas cargadas —ahí está la mayor parte del volumen—,
    // porque devolver algo a su lugar no depende de saber qué temporada lleva cada columna.
    // EL BUFFER D SE SALTEA ESTE ATAJO. Lo que llega ahí va a la columna de catálogo aunque
    // el artículo ya viva en el almacén: un Puma que tiene su cuerpo en la 16 y llega por el
    // D no vuelve a la 16, va al catálogo. Es la regla de Daniel y no admite excepción.
    if (art.origen !== 'D' && art.yaTiene && art.yaTiene.length) {
        // Un calzado mal ubicado puede tener su cuerpo EN el mezzanine 4. Ahí tampoco se
        // nombra la ubicación: se devuelve la zona y nada más.
        if (esZonaSinUbicacion(art.yaTiene[0].zona)) {
            return paso('solo-zona', null, {
                zona: art.yaTiene[0].zona, cuerpos: [], cuantos: 0, sinUbicacion: true
            });
        }

        // ¿ENTRA? Antes esta pregunta no se hacía: se devolvían sus cuerpos y listo, sin
        // mirar cuánto les quedaba adentro. El operario llegaba con 500 pares a un cuerpo que
        // ya tenía 300 de los suyos y no le entraban. Un cuerpo lleva UN artículo con todas
        // sus tallas, así que no hay dónde meterlos: hay que abrirle otro.
        const zonaRep = art.yaTiene[0].zona;
        // La columna de su propio cuerpo, por si esa columna tiene capacidad propia — el
        // MZN01-24 entra 800 y su serie diría 570.
        const porCuerpoRep = densidadDe(zonaRep, serieDe(art.sku7), art.marcaStd,
                                        art.yaTiene[0].columna);
        const libresRep = libresPorZona[zonaRep];

        /* UN CUERPO, UN ARTÍCULO: SUS CUERPOS COMPARTIDOS NO CUENTAN COMO SUYOS.
         *
         * Antes alcanzaba con que entrara. El 14-ago-2026 Daniel vio el resultado —el 2816305
         * mandado a un cuerpo con VEINTE artículos adentro— y cortó por lo sano: *"hay que ser
         * bien estricto con eso"*. En la franja actual un cuerpo lleva un artículo y punto; en
         * anterior, saldos, escolar y catálogo se sigue compartiendo, que es como se trabaja.
         *
         * El cuerpo compartido no se descarta en silencio: sale en `mezclados` para que quien
         * llame lo mande a Slotting. Ver `hallazgosDeMezcla` en dashboard_v28.js. */
        const quienVive = ocupantesPorZona[zonaRep];
        const mezclados = [];
        const suyosLimpios = !quienVive ? art.yaTiene : art.yaTiene.filter(c => {
            if (columnaAdmiteVariosArticulos(zonaRep, c.columna)) return true;
            const dentro = quienVive.get(`${c.columna}-${c.cuerpo}`);
            const otros = dentro ? [...dentro].filter(s => s !== art.sku7) : [];
            if (!otros.length) return true;
            mezclados.push({ zona: zonaRep, columna: c.columna, cuerpo: c.cuerpo, otros });
            return false;
        });

        /* SI NINGUNO DE SUS CUERPOS QUEDÓ LIMPIO, LA TAREA SE BLOQUEA. No se le busca otro
         * cuerpo.
         *
         * Daniel, 14-ago-2026: *"lo que tienes que hacer es bloquear la tarea, y ahí tiene que
         * entrar — para eso están las tareas de slotting. El slotting va, entra, soluciona, y
         * ahí entra el almacenaje. Así de simple"*.
         *
         * Es el orden correcto y además el barato. El artículo YA TIENE su cuerpo; lo que está
         * mal es que hay un intruso adentro. Mudarlo a otro lado sería gastar un cuerpo vacío
         * —en el MZN01 quedan cinco— para tapar un problema que se arregla sacando veinte
         * pares. Slotting limpia, y a la noche siguiente la tarea sale sola y va a su lugar de
         * siempre.
         *
         * El operario no almacena esto: el papel lo imprime con el aviso, igual que cualquier
         * otro caso de Slotting. */
        if (!suyosLimpios.length) {
            const conQuien = mezclados.flatMap(m => m.otros);
            return paso('slotting',
                `Su cuerpo tiene ${conQuien.length > 1 ? 'otros artículos' : 'otro artículo'} adentro `
                + `(${conQuien.join(', ')}). Slotting lo tiene que limpiar antes.`,
                { zona: zonaRep, cuerpos: [], cuantos: 0, porCuerpo: porCuerpoRep,
                  mezclados, bloqueadoPorMezcla: true });
        }

        // Lo que le queda a cada cuerpo suyo. Si no figura en el mapa es porque está vacío
        // —el mapa solo trae los cuerpos con stock—, así que entra uno entero.
        const capsSuyos = suyosLimpios.map(c => {
            const v = libresRep && libresRep.get(`${c.columna}-${c.cuerpo}`);
            return v === undefined ? porCuerpoRep : Math.max(0, v);
        });
        const leQueda = capsSuyos.reduce((a, b) => a + b, 0);

        const paresRep = Number(art.pares) || 0;
        const sobran = paresRep - leQueda;

        if (sobran <= porCuerpoRep * HOLGURA) {
            return paso('reposicion', 'El artículo ya está en el almacén: va a sus mismos cuerpos.',
                { zona: zonaRep, cuerpos: art.yaTiene, cuantos: art.yaTiene.length,
                  porCuerpo: porCuerpoRep, leQueda, capacidades: capsSuyos });
        }

        // No entra. Se le abren los cuerpos que falten, empezando por las columnas donde ya
        // vive: si el suyo está lleno, lo natural es seguir en el de al lado.
        const faltan = Math.max(1, Math.ceil((sobran - porCuerpoRep * HOLGURA) / porCuerpoRep));
        // Si el artículo quedó viviendo en una columna bloqueada, sus cuerpos siguen siendo
        // suyos —no se lo mueve— pero los NUEVOS no se abren ahí.
        const susColumnas = [...new Set(art.yaTiene.map(c => c.columna))]
            .filter(c => !esColumnaBloqueada(zonaRep, c));
        const ocupRep = ocupadosPorZona[zonaRep] || new Set();
        let extra = elegirCuerpos(zonaRep, susColumnas, faltan, ocupRep);

        // Si en sus columnas no hay lugar, se busca en el resto de la franja que le toca.
        if (!extra.completo) {
            const franjaRep = franjaDeArticulo(art, zonaRep);
            const otras = columnasDeFranja(zonaRep, franjaRep).filter(c => !susColumnas.includes(c));
            if (otras.length) {
                const alt = elegirCuerpos(zonaRep, [...susColumnas, ...otras], faltan, ocupRep);
                if (alt.completo) extra = alt;
            }
        }

        const base = { zona: zonaRep, porCuerpo: porCuerpoRep, leQueda, ampliado: true,
                       abiertos: faltan, cuerpos: [...art.yaTiene, ...extra.cuerpos],
                       cuantos: art.yaTiene.length + extra.cuerpos.length,
                       // Los suyos admiten solo lo que les queda; los nuevos, un cuerpo entero.
                       capacidades: [...capsSuyos, ...extra.cuerpos.map(() => porCuerpoRep)],
                       libresEnLaFranja: extra.libresEnLaFranja };

        if (!extra.completo) {
            return paso('slotting',
                `Su cuerpo solo admite ${leQueda} de los ${paresRep} pares y hacen falta ${faltan} cuerpos más, pero hay ${extra.cuerpos.length} libres.`,
                base);
        }
        return paso('reposicion',
            `Su cuerpo solo admite ${leQueda} de los ${paresRep} pares: se le abren ${faltan} cuerpo${faltan > 1 ? 's' : ''} más.`,
            base);
    }

    // Paso 0 y 1: la zona (ya resuelta arriba)
    if (!zr.zona) return paso('sin-regla', zr.motivo);
    const zona = zr.zona, porOthers = !!zr.porOthers;

    const z = cfg.zonas[zona];
    if (!z || !z.activa) return paso('sin-reglas-zona', `${z ? z.etiqueta : zona} todavía no tiene reglas cargadas.`, { zona });

    // Paso 2: la franja
    const franja = franjaDeArticulo(art, zona);

    let columnas = columnasDeFranja(zona, franja);
    if (!columnas.length) return paso('sin-regla', `En ${z.etiqueta} no hay columnas de "${franja}".`, { zona, franja });

    // Y DENTRO DE LA FRANJA, SOLO LAS COLUMNAS DE SU MARCA. MZN01 lo comparten Power,
    // Bubblegummers y B.G Licenses, cada una con su bloque; sin este filtro la sugerencia
    // mandaba Bubblegummers a la columna 4, que es de Power. Las ojotas no filtran: llegaron
    // acá por su subcategoría, no por su marca, y la marca no manda en su zona.
    const suyas = (porOthers || franja === SIN_FILTRO_DE_MARCA) ? [] : columnasDeMarcaEnFranja(art.marca, franja);
    if (suyas.length) {
        const deSuFranja = columnas.filter(c => suyas.includes(c));
        if (deSuFranja.length) {
            columnas = deSuFranja;
        } else {
            // LA FRANJA SOLO MANDA SI LA MARCA PARTIÓ SUS COLUMNAS POR TEMPORADA.
            //
            // Bata sí lo hace: tiene saldos, anterior, actual y escolar. Pero a Puma, Adidas
            // y Skechers la temporada no les importa —"todo lo del buffer se almacena", dijo
            // Daniel— y sus columnas son todas de lo mismo. Antes eso salía por Slotting con
            // un "ninguna lleva anterior" que no era un problema real: era la marca diciendo
            // que no separa por temporada.
            const todasSuyas = suyas.filter(c =>
                franjaDeColumna(zona, c) !== 'ninguna' && !esColumnaBloqueada(zona, c));
            if (!todasSuyas.length) {
                return paso('sin-regla',
                    `A ${art.marca} le tocan las columnas ${suyas.join(', ')} de ${z.etiqueta}, y ninguna está en uso.`,
                    { zona, franja });
            }
            columnas = todasSuyas;
        }
    }

    // LOS SALDOS COMPARTEN CUERPO. Son cientos de artículos con diez pares cada uno: darle
    // un cuerpo propio a cada uno pediría 748 cuerpos y el selectivo tiene 284. Se busca el
    // que mejor lo reciba entre los que ya tienen algo, y recién si ninguno da, uno vacío.
    //
    // Solo acá. Un código nuevo de temporada actual va siempre a cuerpos vacíos, que fue la
    // decisión de Daniel: llega mercadería de verdad y tiene que entrar entera.
    if (franja === 'saldos') {
        const r = cuerpoQueRecibe(zona, columnas, Number(art.pares) || 0,
                                  ocupadosPorZona[zona] || new Set(), libresPorZona[zona]);
        if (r) {
            return paso('ok', null, {
                zona, franja, cuantos: 1, porCuerpo: capacidadDeArticulo(art, zona),
                cuerpos: r.cuerpos, seguidos: true, compartido: !!r.compartido,
                libreQueTenia: r.libreQueTenia, porOthers,
                capacidades: [r.libreQueTenia !== undefined
                    ? r.libreQueTenia : capacidadDeArticulo(art, zona)]
            });
        }
    }

    // Paso 3: cuántos cuerpos
    const porCuerpo = capacidadDeArticulo(art, zona);
    const cuantos = Math.max(1, Math.ceil((Number(art.pares) - porCuerpo * HOLGURA) / porCuerpo));

    // Paso 4 y 5
    const r = elegirCuerpos(zona, columnas, cuantos, ocupadosPorZona[zona] || new Set());
    const base = { zona, franja, cuantos, porCuerpo, cuerpos: r.cuerpos, seguidos: r.seguidos,
                   libresEnLaFranja: r.libresEnLaFranja, porOthers,
                   capacidades: r.cuerpos.map(() => porCuerpo) };

    if (!r.completo) {
        return paso('slotting',
            r.cuerpos.length
                ? `Hacen falta ${cuantos} cuerpos y solo hay ${r.cuerpos.length} libres en la franja.`
                : `No hay ningún cuerpo libre en la franja de "${franja}".`,
            base);
    }
    return paso('ok', null, base);
};

/** 'SEL-08-15', para mostrar. */
export const nombreCuerpo = (zona, columna, cuerpo) =>
    `${zona}-${String(columna).padStart(2, '0')}-${String(cuerpo).padStart(2, '0')}`;
