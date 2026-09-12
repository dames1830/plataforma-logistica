/* ═══════════════════════════════════════════════════════════════════════════════════════
 *  QUIEN ENTRA A LA LISTA DE ASISTENCIA  ·  una sola regla, dos pantallas
 *  ───────────────────────────────────────────────────────────────────────────────────────
 *  La misma gente tiene que salir en la lista de la web y en la del celular. Si la regla
 *  viviera en los dos archivos, el dia que se agregue un puesto nuevo uno quedaria distinto
 *  del otro y nadie se daria cuenta hasta que a alguien no le tomen asistencia.
 *
 *  Daniel, 28-ago-2026: *"no quiero tener doble cosas porque amontonan data y confunde"*.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

/* LOS PUESTOS QUE PASAN LISTA.
 *
 * AYUDANTE DE ALMACEN se partio en tres y el OPERADOR paso a MONTACARGUISTA.
 * OPERADOR DE SISTEMA se sumo el 03-sep-2026, para Vicente Moron, que estaba cargado como
 * SLOTTING porque no existia su puesto. Nacio llamandose ASISTENTE y Daniel lo corrigio el
 * mismo dia: *"me equivoque en ese asistente, es operador de sistema"*.
 *
 * VA TAMBIEN EN `CARGOS` de la pantalla de Trabajadores, para que aparezca en el combo.
 * Con una sola lista no alcanza. */
export const CARGOS_ASISTENCIA = ['ALMACENAJE', 'BUFFER', 'SLOTTING', 'MONTACARGUISTA',
                                  'OPERADOR DE SISTEMA'];

/** El turno noche activo con puesto de los que pasan lista. */
export const gentePorLista = (trabajadores) => (trabajadores || []).filter(w =>
    w && w.active !== false
    && (w.turno === 'NOCHE' || w.Turno === 'NOCHE')
    && CARGOS_ASISTENCIA.indexOf(String(w.puesto || w.Puesto || '').trim().toUpperCase()) >= 0);

/** La ficha en blanco de una persona. TODOS ARRANCAN PRESENTES: el supervisor marca a los
 *  que faltaron, que son los pocos, y no a los que vinieron, que son casi todos. */
export const fichaEnBlanco = (w) => ({
    dni: String(w.dni || w.Dni || ''),
    nombre: (w.nombre || w.Nombre),
    apellidos: (w.apellidos || w.Apellidos),
    present: true,
    onTime: true,
    justification: ''
});

/** Junta lo que ya estaba guardado con la gente de hoy, sin repetir a nadie por DNI y sin
 *  perder a quien se dio de alta despues de que se abriera la lista. */
export const armarLista = (trabajadores, guardado) => {
    const gente = gentePorLista(trabajadores);
    const porDni = new Map();
    ((guardado && guardado.data) || []).forEach(d => {
        if (d && !porDni.has(String(d.dni))) porDni.set(String(d.dni), Object.assign({}, d));
    });
    gente.forEach(w => {
        const dni = String(w.dni || w.Dni || '');
        if (!porDni.has(dni)) porDni.set(dni, fichaEnBlanco(w));
    });
    return Array.from(porDni.values());
};

/** El nombre como se lee: "Jorge Quispe", no "QUISPE ROJAS, JORGE LUIS". */
export const nombreCorto = (ficha) => {
    const parejo = (t) => String(t || '').trim().toLocaleLowerCase('es')
        .replace(/(^|[\s\-'])(\S)/g, (m, antes, letra) => antes + letra.toLocaleUpperCase('es'));
    const nombres = parejo(ficha.nombre).split(' ').filter(Boolean);
    const apellidos = parejo(ficha.apellidos).split(' ').filter(Boolean);
    const n = nombres[0] || '';
    const a = apellidos[0] || '';
    return (n + ' ' + a).trim() || parejo(ficha.nombre) || String(ficha.dni || '');
};

export const iniciales = (ficha) => {
    const n = String(ficha.nombre || '').trim();
    const a = String(ficha.apellidos || '').trim();
    return ((n[0] || '') + (a[0] || '')).toUpperCase() || String(ficha.dni || '?').slice(0, 2);
};
