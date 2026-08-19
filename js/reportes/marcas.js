/**
 * REPORTE ALMACENAJE — MARCAS
 *
 * Escrito UNA sola vez. Lo usan el dashboard (oscuro) y el portal público
 * (claro, pensado para imprimir). Lo único que cambia entre los dos es el tema
 * que se le pasa: los datos, las columnas y los totales son los mismos.
 *
 * Antes estaba escrito dos veces y se separaron: el arreglo que junta
 * 'B.G Licenses' con 'Bubblegummers Licenses' solo llegó al dashboard, así que
 * para julio 2026 una pantalla mostraba una fila de 5.708 y la otra dos, de
 * 4.700 y 1.008. Los dos "bien", pero distintos.
 *
 * Para agregar una columna se toca acá y aparece en los dos.
 */
import { marcaNormalizada, marcaCorta, jornadaDelTrabajo } from '../services_v245/reportesComunes.js?v=29.0265';
import * as jornadaService from '../services_v245/jornadaService.js?v=29.0265';

/** Las columnas del reporte. Agregar una acá la agrega en las dos pantallas. */
export const COLUMNAS = [
    { titulo: 'AREA',      alinea: 'left',   estilo: 'width: 100px;' },
    { titulo: 'MARCAS',    alinea: 'left',   estilo: 'max-width:130px; width:130px;' },
    { titulo: 'BUFFER',    alinea: 'center', estilo: 'width: 85px;' },
    { titulo: 'DÍA',       alinea: 'center', estilo: 'width: 75px;', color: 'dia' },
    { titulo: 'NOCHE',     alinea: 'center', estilo: 'width: 75px;', color: 'noche' },
    { titulo: 'TOTAL',     alinea: 'center', estilo: 'width: 75px;' },
    { titulo: '%',         alinea: 'center', estilo: 'width: 70px;' },
    { titulo: 'PENDIENTE', alinea: 'center', estilo: 'width: 90px;' },
];

/* ── LOS DATOS ────────────────────────────────────────────────────────────
   Nada de esto sabe de colores: solo cuenta.
*/

/**
 * Arma el reporte a partir de las tareas.
 *
 * QUÉ ENTRA EN EL CUADRO — cambiado el 06-ago-2026, y es el corazón del reporte.
 *
 * Antes entraba lo que hubiera NACIDO en el rango: `t.fecha >= desde && <= hasta`. Pero la
 * fecha de una tarea es el día en que se generó la ola, no el día en que hay que trabajarla
 * ni el día en que se trabajó. Como una tarea vive 48 horas, eso dejaba fuera casi todo:
 * el 06-ago el cuadro decía 3.062 pares por almacenar cuando en el buffer había 29.312, y
 * decía 0 de avance el mismo día que el turno día almacenó 3.072 pares. Daniel lo mandaba
 * así al grupo de supervisores.
 *
 * Una tarea entra si cumple una de dos cosas, y son independientes:
 *
 *   1. ES DE LA OLA DE ESE RANGO — nació dentro de él. Se haya trabajado o no, y sin
 *      importar en qué estado esté HOY. Suma a BUFFER.
 *   2. SE TRABAJÓ EN EL RANGO — se cerró en una jornada de este rango, aunque venga de
 *      una ola anterior. Suma a BUFFER y además a DÍA o a NOCHE.
 *
 * El punto 1 decía antes "sigue viva y nació antes del cierre", y ese "sigue viva" se
 * miraba HOY. Al abrir un día pasado, lo no trabajado ya había vencido y desaparecía
 * del cuadro: BUFFER se achicaba hasta igualar al avance y todos los días salían al
 * 100% con PENDIENTE 0. Ver el detalle en el cuerpo de la función.
 *
 * Con esto el cuadro cierra solo: BUFFER − DÍA − NOCHE = PENDIENTE, y PENDIENTE es lo
 * que quedó sin hacer de esa ola.
 *
 * EL TURNO LO DICE LA MATRIZ DEL TRABAJADOR, no el reloj. Regla de Daniel: "si lsanchez
 * termina una tarea a las ocho de la noche, él pertenece al turno día, así de simple".
 * Un trabajador no puede estar en dos turnos.
 *
 * @param tasks     todas las tareas
 * @param desde     'YYYY-MM-DD'
 * @param hasta     'YYYY-MM-DD'
 * @param turnoDe   (usuario) => 'DIA' | 'NOCHE' | null — de qué turno es un operario
 */
export const datosMarcas = (tasks, desde, hasta, turnoDe) => {
    const porArea = {};
    const fechaLogicaDe = (m) => jornadaService.fechaLogicaDe(m);

    // UNA TAREA SE CUENTA UNA SOLA VEZ.
    // El 06-ago-2026 había 6 números repetidos en el servidor y dos de ellos con las dos
    // copias finalizadas, así que su avance se sumaba dos veces: 4.664 pares que nadie hizo.
    // El origen se arregla aparte; acá se blinda el número, que es lo que se manda al grupo.
    const yaContadas = new Set();

    (tasks || []).forEach(t => {
        if (!t) return;

        const trabajadaEn = jornadaDelTrabajo(t, fechaLogicaDe);
        const seTrabajo = t.status === 'Finalizado' && trabajadaEn
                       && trabajadaEn >= desde && trabajadaEn <= hasta;

        /* LO QUE NO SE TRABAJÓ TAMBIÉN CUENTA — corregido el 12-ago-2026.
         *
         * Acá decía `tareaSigueViva(t) && t.fecha <= hasta`, y ese "sigue viva" se
         * evalúa HOY, no en la jornada que se está mirando. Consecuencia: al abrir un
         * día pasado, todo lo que no se trabajó ya había vencido, no entraba ni al
         * BUFFER, y el denominador se achicaba hasta igualar al avance. **El cuadro
         * decía 100% y PENDIENTE 0 todos los días.**
         *
         * Lo cazó Daniel mandándolo al grupo: *"se va a pensar que almacené el cien
         * por ciento, y eso no es cierto"*. El 11-ago decía 11.858 de 11.858; lo real
         * era 11.858 de 25.024, porque 12 tareas con 13.166 pares nunca se tocaron.
         *
         * LA REGLA ES LA OLA DE ESA NOCHE: entra lo que se generó para esa jornada,
         * se haya trabajado o no, más lo que se trabajó en ella aunque venga de una
         * ola anterior. Así BUFFER − DÍA − NOCHE = PENDIENTE sigue cerrando, y
         * PENDIENTE es lo que quedó sin hacer.
         *
         * Se probó arrastrar además las pendientes de días anteriores —"todo lo que
         * estaba para trabajarse esa noche"— y da disparates: 564.663 pares el
         * 02-ago, porque cada tarea vieja sin fecha de vencimiento se suma a todas
         * las jornadas siguientes. */
        const nacioEnElRango = String(t.fecha || '') >= desde && String(t.fecha || '') <= hasta;
        if (!seTrabajo && !nacioEnElRango) return;

        const huella = `${t.id}|${t.status}|${t.termino || ''}`;
        if (yaContadas.has(huella)) return;
        yaContadas.add(huella);

        // El turno sale del operario, no de la hora: es el turno al que se le imputa
        const turno = turnoDe(t.u1) || (t.u2 ? turnoDe(t.u2) : null) || 'DIA';

        (t.items || []).forEach(art => {
            const marca = marcaNormalizada(art.marca) || 'S/M';
            (art.items || []).forEach(i => {
                const ubi = String(i.ubi || '').toUpperCase().trim();
                // CDBUFFER-C queda fuera a propósito: no es zona de almacenaje
                if (!ubi.startsWith('CDBUFFER') || ubi.startsWith('CDBUFFER-C')) return;

                let area = 'CDBUFFER-A';
                if (ubi.startsWith('CDBUFFER-B')) area = 'CDBUFFER-B';
                else if (ubi.startsWith('CDBUFFER-A')) area = 'CDBUFFER-A';
                else { const p = ubi.split('-'); area = p.length > 1 ? `${p[0]}-${p[1]}` : p[0]; }

                const qty = parseFloat(i.qty) || 0;
                if (!porArea[area]) porArea[area] = {};
                if (!porArea[area][marca]) porArea[area][marca] = { buffer: 0, dia: 0, noche: 0 };
                porArea[area][marca].buffer += qty;

                // Solo lo trabajado EN ESTE RANGO suma al avance. Una tarea que sigue
                // pendiente aporta su carga al BUFFER y nada más.
                if (seTrabajo) {
                    const avance = (i.avance !== undefined && i.avance !== null) ? (parseFloat(i.avance) || 0) : qty;
                    if (turno === 'NOCHE') porArea[area][marca].noche += avance;
                    else porArea[area][marca].dia += avance;
                }
            });
        });
    });

    const conTotales = (d) => {
        const total = d.dia + d.noche;
        return { ...d, total, pendiente: d.buffer - total, pct: d.buffer > 0 ? Math.round((total / d.buffer) * 100) : 0 };
    };

    const areas = Object.keys(porArea).sort((a, b) => b.localeCompare(a)).map(area => {
        const marcas = Object.keys(porArea[area]).sort((a, b) => a.localeCompare(b))
            .map(marca => ({ marca, ...conTotales(porArea[area][marca]) }));
        const suma = marcas.reduce((s, m) => ({ buffer: s.buffer + m.buffer, dia: s.dia + m.dia, noche: s.noche + m.noche }),
                                   { buffer: 0, dia: 0, noche: 0 });
        return { area, marcas, totales: conTotales(suma) };
    });

    const suma = areas.reduce((s, a) => ({ buffer: s.buffer + a.totales.buffer, dia: s.dia + a.totales.dia, noche: s.noche + a.totales.noche }),
                              { buffer: 0, dia: 0, noche: 0 });
    return { areas, granTotal: conTotales(suma), vacio: areas.length === 0 };
};

/* ── LOS TEMAS ────────────────────────────────────────────────────────────
   Lo único que separa a las dos pantallas.
*/

const semaforo = (cero, parcial, ok) => (pct, alcanzado, meta) =>
    pct === 0 ? cero : (alcanzado < meta ? parcial : ok);

export const TEMA_OSCURO = {
    cabeceraColorea: true,
    cabecera: 'color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;',
    fila: 'border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;',
    area: '#a1a1aa', marca: '#ffffff', marcaPeso: '800',
    valor: '#ffffff', dia: '#facc15', noche: '#818cf8', pend: '#00E5FF', pendPeso: '800',
    vacio: 'padding:4rem; text-align:center; color:rgba(0, 229, 255, 0.3); font-weight:700;',
    pct: semaforo('#ef4444', '#fbbf24', '#22c55e'),
    totalArea: {
        fila: 'background: linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(15, 23, 42, 0.5) 100%); border-top: 1.5px solid rgba(0, 229, 255, 0.6); border-bottom: 1.5px solid rgba(0, 229, 255, 0.6); font-weight: 900;',
        etiquetaEstilo: "padding:7px 8px; color:#00E5FF; font-weight:900; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif; border-left: 4px solid #00E5FF;",
        tam: '0.82rem', peso: '800',
        valor: '#ffffff', dia: '#facc15', noche: '#818cf8', pend: '#00E5FF', pendPeso: '900',
        pct: semaforo('#ef4444', '#fbbf24', '#22c55e')
    },
    granTotal: {
        fila: 'background: linear-gradient(90deg, rgba(0, 229, 255, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%); border-top: 2px solid #00E5FF; border-bottom: 2px solid #00E5FF; font-weight: 900;',
        etiquetaEstilo: "padding:9px 8px; color:#ffffff; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; font-family:'Outfit', sans-serif; font-weight:900; border-left: 6px solid #00E5FF;",
        tam: '0.85rem', peso: '900',
        valor: '#00E5FF', dia: '#facc15', noche: '#818cf8', pend: '#00E5FF', pendPeso: '900',
        pendExtra: 'text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);',
        pct: semaforo('#ef4444', '#fbbf24', '#22c55e')
    }
};

export const TEMA_CLARO = {
    cabeceraColorea: false,
    cabecera: 'background:#1C2B3A; color:#fff; text-transform:uppercase; font-size:0.67rem; font-weight:700; letter-spacing:0.04em;',
    fila: 'border-bottom:1px solid #EEE9E3; background:#fff;',
    area: '#9C9590', marca: '#1C2B3A', marcaPeso: '700',
    valor: '#1C2B3A', dia: '#B45309', noche: '#4A4540', pend: '#B45309', pendPeso: '700',
    vacio: 'padding:4rem; text-align:center; color:#9C9590; font-weight:700;',
    pct: semaforo('#ef4444', '#fbbf24', '#22c55e'),
    totalArea: {
        fila: 'background:#F4F1EC; border-top:1px solid #DDD8CF; border-bottom:1px solid #DDD8CF; font-weight:700;',
        etiquetaEstilo: "padding:7px 8px; color:#1C2B3A; font-weight:700; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif; border-left: 3px solid #B45309;",
        tam: '0.78rem', peso: '700',
        valor: '#1C2B3A', dia: '#B45309', noche: '#4A4540', pend: '#B45309', pendPeso: '700',
        pct: semaforo('#991B1B', '#B45309', '#1A6336')
    },
    granTotal: {
        fila: 'background:#1C2B3A; font-weight:700;',
        etiquetaEstilo: "padding:9px 8px; color:#fff; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.8px; font-family:'Outfit', sans-serif; font-weight:700; border-left: 4px solid #B45309;",
        tam: '0.8rem', peso: '700',
        valor: '#fff', dia: '#F5C97A', noche: '#A8B8C8', pend: '#F5C97A', pendPeso: '700',
        pendExtra: '',
        pct: semaforo('#FCA5A5', '#FCD34D', '#6EE7B7')
    }
};

/* ── LA PINTURA ───────────────────────────────────────────────────────────*/

const num = (v) => Math.round(v).toLocaleString();

/**
 * Cabecera de la tabla.
 * El tema oscuro pinta DÍA y NOCHE del mismo color que sus números; el gerencial
 * no, porque sobre fondo azul oscuro esos amarillos no se leen.
 */
export const cabeceraMarcas = (tema) => `
    <tr style="${tema.cabecera}">
        ${COLUMNAS.map(c => {
            const col = (c.color && tema.cabeceraColorea) ? ` color:${tema[c.color]};` : '';
            return `<th style="padding:6px 8px; text-align:${c.alinea}; ${c.estilo}${col}">${c.titulo}</th>`;
        }).join('')}
    </tr>`;

/** Cuerpo de la tabla: las filas por marca, el total por área y el total general. */
export const filasMarcas = (datos, tema) => {
    if (datos.vacio) {
        return `<tr><td colspan="${COLUMNAS.length}" style="${tema.vacio}">No hay datos de almacén para mostrar en esta selección.</td></tr>`;
    }

    // Celda de una fila de marca
    const celda = (v, color, peso, tam) =>
        `<td style="padding:5px 6px; text-align:center; font-weight:${peso}; color:${color}; font-size:${tam};">${num(v)}</td>`;

    // Celda de una fila de total. El orden de las propiedades es distinto al de arriba
    // porque así estaba escrito, y conviene que el HTML salga igual byte a byte: cualquier
    // diferencia que aparezca en una comparación futura es entonces una diferencia de verdad.
    const celdaTotal = (v, color, peso, tam, pad, extra = '') =>
        `<td style="padding:${pad}; text-align:center; color:${color}; font-size:${tam}; font-weight:${peso};${extra ? ' ' + extra : ''}">${num(v)}</td>`;

    const pctMarca = (d, color) => {
        const col = color(d.pct, d.total, d.buffer);
        return `<td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem; white-space:nowrap;"><span style="color:${col}; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:3px;"><span>${d.pct === 0 ? '●' : '▲'}</span><span>${d.pct}%</span></span></td>`;
    };

    const pctTotal = (d, t, pad) => {
        const col = t.pct(d.pct, d.total, d.buffer);
        return `<td style="padding:${pad}; text-align:center; font-size:${t.tam}; font-weight:${t.peso}; white-space:nowrap;"><span style="color:${col}; font-weight:${t.peso}; font-size:${t.tam};">${d.pct}%</span></td>`;
    };

    const filaTotal = (etiqueta, d, t, pad) => `
        <tr style="${t.fila}">
            <td colspan="2" style="${t.etiquetaEstilo}">${etiqueta}</td>
            ${celdaTotal(d.buffer, t.valor, t.peso, t.tam, pad)}
            ${celdaTotal(d.dia, t.dia, t.peso, t.tam, pad)}
            ${celdaTotal(d.noche, t.noche, t.peso, t.tam, pad)}
            ${celdaTotal(d.total, t.valor, t.peso, t.tam, pad)}
            ${pctTotal(d, t, pad)}
            ${celdaTotal(d.pendiente, t.pend, t.pendPeso, t.tam, pad, t.pendExtra || '')}
        </tr>`;

    let html = '';
    datos.areas.forEach(({ area, marcas, totales }) => {
        marcas.forEach(m => {
            html += `
            <tr style="${tema.fila}">
                <td style="padding:5px 6px; color:${tema.area}; font-size:0.78rem; font-weight:600;">${area}</td>
                <td style="padding:5px 6px;"><b title="${m.marca}" style="color:${tema.marca}; font-weight:${tema.marcaPeso}; font-size:0.8rem; font-family:'Outfit', sans-serif; white-space:nowrap;">${marcaCorta(m.marca)}</b></td>
                ${celda(m.buffer, tema.valor, '700', '0.8rem')}
                ${celda(m.dia, tema.dia, '700', '0.8rem')}
                ${celda(m.noche, tema.noche, '700', '0.8rem')}
                ${celda(m.total, tema.valor, '700', '0.8rem')}
                ${pctMarca(m, tema.pct)}
                ${celda(m.pendiente, tema.pend, tema.pendPeso, '0.8rem')}
            </tr>`;
        });
        html += filaTotal(`Total ${area}`, totales, tema.totalArea, '7px 8px');
    });
    html += filaTotal('TOTAL GENERAL CDBUFFER', datos.granTotal, tema.granTotal, '9px 8px');
    return html;
};

/**
 * Averigua de qué turno es un operario a partir de la lista de trabajadores.
 * El usuario es la inicial del nombre + el primer apellido ('jperez').
 */
export const armarTurnoDe = (trabajadores) => (username) => {
    if (!username || username === '---' || username === '') return null;
    const buscado = String(username).trim().toLowerCase();
    const w = (trabajadores || []).find(w => {
        const nom = (w.nombre || w.Nombre || '').trim().toLowerCase();
        const ape = (w.apellidos || w.Apellidos || '').trim().split(' ')[0].toLowerCase();
        return nom ? (`${nom[0]}${ape}` === buscado) : false;
    });
    if (!w) return null;
    return String(w.turno || w.Turno || '').trim().toUpperCase() === 'NOCHE' ? 'NOCHE' : 'DIA';
};
