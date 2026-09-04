/**
 * SLOTTING → EL BARRIDO QUE ARMA LAS TAREAS
 *
 * Vivia adentro de `renderDashboard`, en `dashboard_v28.js`. Se saco el
 * 02-sep-2026 porque ese archivo son 40.700 lineas que el navegador baja y
 * compila ENTERAS aunque solo se abra Inicio. Ahora esto se carga con
 * `await import(...)` recien cuando alguien aprieta Procesar.
 *
 * ACA NO SE DIBUJA NADA. Es la unica de las cinco pantallas que se saco que no
 * toca el DOM: entra el almacen, salen las tareas. Por eso fue la primera —se
 * comprueba comparando numeros, sin abrir la pantalla— y por eso se puede correr
 * de prueba sin sesion.
 *
 * LO QUE ANTES LE LLEGABA GRATIS AHORA VA POR PARAMETRO, en `ENT`:
 *
 *   tareasDeAlmacenaje()  las tareas guardadas. Va como FUNCION y no como lista
 *                         porque `almacenajeTasksCache` se reemplaza entero cada
 *                         vez que entran tareas nuevas -quince sitios lo hacen-,
 *                         y una copia tomada al importar se quedaria vieja.
 *   rescatarMaestro()     baja el Maestro de articulos si hace falta
 *   normalizarTalla(t)    'S/TALLA' y 'SIN TALLA' se guardan como 'S/T'
 *   sugActuales(fecha)    que temporadas cuentan como actuales ese dia
 *
 * Los cuatro se quedaron en `dashboard_v28.js` porque los usa mas gente:
 * `sugActuales` tambien lo llama el analisis de SKU, y `almacenajeTasksCache` lo
 * tocan setenta y ocho sitios. Traerlos aca hubiera sido mover medio tablero.
 *
 * `getLogicalDate` no viene por parametro: era una linea sobre `jornadaService`
 * y se rehace igual aca. Ojo que NO es `toISOString()` -esa devuelve UTC y
 * adelanta el dia a las 19:00, justo cuando entra el turno noche-.
 */

import * as slottingService from '../services_v245/slottingService.js?v=29.0594';
import * as zonasService from '../services_v245/zonasService.js?v=29.0594';
import * as jornadaService from '../services_v245/jornadaService.js?v=29.0594';
import { dataStore, getAreaData, tallaDeSku } from '../services_v245/csvHub_v6.js?v=29.0594';

/* La fecha de la jornada, no la del reloj. Misma linea que en el tablero. */
const getLogicalDate = () => jornadaService.fechaLogicaDe();

/* ══════════════════════════════════════════════════════════════════════════════
 * EL BARRIDO QUE ARMA LAS TAREAS DE SLOTTING
 *
 * Daniel, 14-ago-2026: *"el cuerpo veinte está con dos artículos: quien tenga más cantidad,
 * le pertenece a ese artículo. El B hay que sacarlo, entonces ahí tiene veinte ya por sacar,
 * y así que vaya acumulando"*.
 *
 * ── QUIÉN SE QUEDA CON EL CUERPO ─────────────────────────────────────────────
 *
 * Primero se le pregunta a las TAREAS, no al stock. Daniel: *"si el procesar tareas te dijo
 * almacena en el cuerpo uno el artículo A, y mañana aparece en el cuerpo uno otro artículo
 * adicional, quiere decir que el operario agarró veinte pares y puso el artículo B ahí. El
 * slotting tendría que ver de dónde vino: el A vino de una tarea, el B no vino de ninguna,
 * entonces por error o porque su cuerpo ya estaba lleno lo puso ahí"*.
 *
 *   1. Si UNO de los artículos llegó ahí por una tarea de almacenaje, ese se queda. El
 *      sistema lo mandó a ese cuerpo y el módulo anterior no se contradice.
 *   2. Si llegaron VARIOS por tarea, o NINGUNO, manda el que más pares tiene. Mover al que
 *      menos hay es el trabajo más barato y el que menos molesta al piso.
 *
 * Cada línea sale diciendo si el artículo vino por tarea o apareció solo, que es la
 * diferencia entre "estaba previsto y hay que reacomodar" y "alguien lo puso donde no iba".
 *
 * ── EL ALCANCE ───────────────────────────────────────────────────────────────
 *
 * SOLO EL SELECTIVO POR AHORA: *"hagamos un ejemplo solo con selectivo primero, después
 * metemos lo de los mezzanines"*. La zona sale por parámetro para que sumar MZN01 y MZN02
 * sea cambiar una lista.
 *
 * SOLO DONDE LA FRANJA EXIGE UN CUERPO POR ARTÍCULO —la actual—. En anterior, saldos,
 * escolar y catálogo se comparte a propósito. El MZN04 no entra nunca.
 * ══════════════════════════════════════════════════════════════════════════════ */
const ZONAS_SLOTTING = ['SEL'];

/** Qué artículos mandó el sistema a cada cuerpo, según las tareas de almacenaje. */
/**
 * LOS CUERPOS QUE LAS TAREAS DE ALMACENAJE YA APARTARON ESTA NOCHE.
 *
 * Devuelve `skus` —cuerpo → quiénes tienen tarea hacia él— y `pares` —cuerpo → cuántos
 * pares van a llegar—. Las dos cosas hacen falta y por motivos distintos: con la primera
 * se sabe si el cuerpo ya tiene dueño, con la segunda cuánto espacio le queda.
 *
 * **LA FOTO DE STOCK NO ALCANZA, Y ESTE ES EL DATO QUE LA COMPLETA.** El cuerpo apartado
 * a las 20:00 sigue vacío en la foto de las 19:00, así que sin esto Slotting lo ve libre
 * y lo entrega otra vez. Daniel, 17-ago-2026, con la Tarea 1 de Slotting y la Tarea 16 de
 * almacenaje mandando las dos al `SEL-10-21`: *"estás mandando una tarea de slotting y de
 * almacenaje hacia el mismo cuerpo, y los operarios están confundiendo"*.
 *
 * SE CUENTA `almacenar`, NO `qty`: lo que baja al piso es lo que ocupa el cuerpo; el resto
 * de la línea sube a reserva. Y si la talla se repartió entre dos cuerpos (v29.0228), cada
 * parte suma en el suyo.
 */
const destinosDeLasTareas = (ENT) => {
  const skus = new Map();
  const pares = new Map();
  const anotar = (d, s7, q) => {
    const c = String(d || '').trim().toUpperCase();
    if (!/^[A-Z0-9]+-\d{2}-\d{2}$/.test(c)) return;
    if (!skus.has(c)) skus.set(c, new Set());
    skus.get(c).add(s7);
    pares.set(c, (pares.get(c) || 0) + (Number(q) || 0));
  };
  (ENT.tareasDeAlmacenaje() || []).forEach(t => (t.items || []).forEach(art => {
    const s7 = String(art.sku7 || '').trim();
    if (!s7) return;
    (art.items || []).forEach(i => {
      if (Array.isArray(i.reparto) && i.reparto.length > 1) {
        i.reparto.forEach(r => anotar(r && r.d, s7, r && r.q));
        return;
      }
      anotar(i.destino, s7, (i.almacenar !== undefined ? i.almacenar : i.qty));
    });
  }));
  return { skus, pares };
};

/**
 * ¿ESTE ARTÍCULO RECIBIÓ MERCADERÍA HACE POCO?
 *
 * Hace falta para NO consolidar un artículo que acaba de llegar. Un código nuevo con tres
 * días ocupa tres cuerpos con todo derecho: es el 60% de su lote y su colchón de dos semanas
 * — Daniel, 16-ago-2026: *"no me vayas a subir artículos que tienen tres o cuatro días en el
 * almacén y me vayas a dejar un cuerpo nada más"*.
 *
 * SE MIDE DESDE LA ÚLTIMA ENTRADA, NO DESDE QUE EL CÓDIGO PISÓ EL ALMACÉN. Si a un artículo
 * de seis meses le llegó un lote hace tres días, está igual de en su ventana que uno nuevo.
 *
 * DOS FUENTES, Y LA PRIMERA ES LA BUENA:
 *
 *   1. LAS TAREAS DE ALMACENAJE. Es la señal directa y con fecha: si hubo tarea, entró
 *      mercadería ese día. No hay que inferir nada.
 *   2. La curva del robot, como respaldo: una foto con más pares que la anterior es una
 *      entrada. Cubre lo que llegó antes de que existieran las tareas.
 *
 * SIN NINGUNA SEÑAL, EL ARTÍCULO ES VIEJO Y SE CONSOLIDA. Al revés —proteger lo que no se
 * conoce— dejaba fuera 41 artículos que llevaban meses quietos.
 *
 * Devuelve un Set con los sku7 que NO se pueden tocar.
 */
const conEntradaReciente = async (semanas, ENT) => {
  const corte = new Date(getLogicalDate() + 'T12:00:00').getTime() - semanas * 604800000;
  const fresco = new Set();
  const marcar = (s7, f) => {
    const d = new Date(String(f) + 'T12:00:00').getTime();
    if (Number.isFinite(d) && d >= corte) fresco.add(s7);
  };

  // 1. Las tareas de almacenaje: entrada directa y fechada
  (ENT.tareasDeAlmacenaje() || []).forEach(t => {
    if (!t || !t.fecha) return;
    (t.items || []).forEach(a => {
      const s7 = String(a && a.sku7 || '').trim().substring(0, 7);
      if (s7) marcar(s7, t.fecha);
    });
  });

  // 2. La curva del robot, para lo anterior a las tareas
  try {
    const base = window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com';
    const res = await fetch(`${base}/api/logistics/evolucion_articulo?t=${Date.now()}`);
    if (res.ok) {
      const cuerpo = await res.json();
      const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
      (datos && datos.articulos || []).forEach(a => {
        const s7 = String(a.cod || '').trim().substring(0, 7);
        if (!s7 || fresco.has(s7)) return;
        let ult = a.llegada || null;
        const c = a.curva || [];
        // Un 5% de margen para no confundir un redondeo con una llegada de verdad
        for (let i = 1; i < c.length; i++) if (c[i][1] > c[i - 1][1] * 1.05) ult = c[i][3];
        if (ult) marcar(s7, ult);
      });
    }
  } catch (e) { console.warn('[Slotting] no se pudo leer la evolución del artículo:', e && e.message); }
  return fresco;
};

const SEMANAS_PARA_CONSOLIDAR = 2;

/* ══════════════════════════════════════════════════════════════════════════════
 * DOS COSAS DISTINTAS QUE HASTA ACÁ ERAN UNA SOLA
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Daniel, 28-ago-2026: *"dame la opción de procesar tareas según las zonas [...] porque
 * si yo corro de todas, me van a salir como quinientas tareas. Pero por más que yo corra
 * el mezzanine uno, si hay tareas bloqueadas en el selectivo o en el mezzanine dos, me
 * tienen que aparecer sí o sí como tareas principales, en rojo, prioridad"*.
 *
 *   `zonas`  — las que se ORDENAN en esta corrida. Es la elección de la noche, y sirve
 *              para no sacar 176 tareas de una: se limpia una zona por vez.
 *   TODAS    — de donde se LEE el almacén. Siempre las cuatro, pase lo que pase.
 *
 * Lo que traba una tarea de almacenaje NO se filtra por zona: es la posta del módulo
 * anterior y entra siempre, venga de donde venga. Hasta acá se descartaba —`if (tr.zona
 * && !zonasOk.has(tr.zona)) return`— y por eso el 15-ago, de 18 artículos trabados,
 * entraban 2: los otros 16 eran de los mezzanines y Slotting no se enteraba.
 *
 * Por eso el almacén se lee ENTERO aunque se ordene una sola zona: sin el cuerpo del
 * otro lado no se puede saber qué intruso sacar para destrabar la tarea. */
export const barrerParaSlotting = async (zonas = ZONAS_SLOTTING, ENT = {}) => {
  const TODAS = slottingService.ZONAS_POSIBLES;
  const zonasQueSeOrdenan = new Set(zonas && zonas.length ? zonas : ZONAS_SLOTTING);
  await zonasService.cargarZonas();
  await ENT.rescatarMaestro();

  let stock = await getAreaData('almacenaje_activo');
  if (!stock || !stock.length) {
    const base = window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com';
    const res = await fetch(`${base}/api/logistics/almacenaje_activo?t=${Date.now()}`);
    if (res.ok) {
      const cuerpo = await res.json();
      const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
      if (Array.isArray(datos)) stock = datos;
    }
  }
  if (!stock || !stock.length) throw new Error('No se pudo leer el Stock Activo.');

  // El Maestro, para que la tarea salga con marca y temporada y el equipo vaya derecho
  const ficha = new Map();
  (dataStore.articulos || []).forEach(row => {
    const raw = Array.isArray(row) ? row : Object.values(row);
    const s7 = String(raw[1] || '').trim().substring(0, 7);
    if (s7 && !ficha.has(s7)) ficha.set(s7, {
      marca: String(raw[13] || '').trim(),
      marcaStd: String(raw[8] || '').trim(),
      // LA SUBCATEGORIA DICE SI ES BOTA, y de ahi sale cuanto entra en el cuerpo. Es la
      // columna 6 del Maestro; la 5 es la categoria y sirve de respaldo. Ver tipoDeCalzado.
      subcategoria: String(raw[5] || '').trim().toUpperCase(),
      categoria: String(raw[4] || '').trim().toUpperCase(),
      // EL GENDER, que dentro de una misma marca separa el de chico del de adulto: un
      // Weinbrenner deportivo entra 339 de adulto y 510 de kids. Ver densidadMarcaTipo.
      genderRims: String(raw[3] || '').trim(),
      temporada: String(raw[14] || raw[9] || '').trim()
    });
  });

  /** La talla media ponderada de un articulo, o null si no se le pudo leer ninguna. */
  const tallaMediaDe = (s7) => {
    const a = tallaDeArt.get(s7);
    return (a && a.pares) ? (a.suma / a.pares) : null;
  };

  const mandados = destinosDeLasTareas(ENT);

  // Quién vive en cada cuerpo, y con cuántos pares
  const cuerpos = new Map();
  const detallePorArt = new Map();     // 'cuerpo|sku7' -> [{ ubi, skuFull, talla, pares }]
  const paresEnElPiso = new Map();     // sku7 -> pares en todo el piso, para elegir su franja
  /* LA TALLA MEDIA DE CADA ARTICULO, que es lo que decide cuanto entra en un cuerpo. Se
     saca del MISMO stock que se esta barriendo, no del Maestro: el Maestro no la trae, y
     ademas se equivoca de gender —el Power 2816964 es talla 28 y figura como 04 SPORT—.
     Ponderada por pares: la talla que mas hay es la que llena el cuerpo. */
  const tallaDeArt = new Map();        // sku7 -> { suma, pares }
  stock.forEach(row => {
    const ubi = String(row['Ubicación actual'] || row['Ubicacion'] || row['Ubicación'] || '').trim().toUpperCase();
    if (!ubi || ubi.startsWith('CDBUFFER')) return;
    const p = ubi.split('-');
    const zona = p[0];
    /* Se lee el almacen ENTERO aunque se ordene una sola zona: sin el cuerpo del otro
       lado no se puede saber que intruso sacar para destrabar una tarea de alla. */
    if (!TODAS.includes(zona)) return;
    if (zonasService.esZonaSinUbicacion(zona)) return;
    const col = parseInt(p[1], 10), cue = parseInt(p[2], 10);
    if (!col || !cue) return;
    const raw = Array.isArray(row) ? row : Object.values(row);
    const s7 = String(raw[1] || '').trim().substring(0, 7);
    const qty = parseFloat(String(row['Cantidad actual'] || row['Cantidad'] || 0).replace(/,/g, '')) || 0;
    if (!s7 || qty <= 0) return;
    const k = `${zona}-${String(col).padStart(2, '0')}-${String(cue).padStart(2, '0')}`;
    if (!cuerpos.has(k)) cuerpos.set(k, { zona, col, m: new Map() });
    cuerpos.get(k).m.set(s7, (cuerpos.get(k).m.get(s7) || 0) + qty);

    /* EL DETALLE POR SKU Y TALLA, que es lo que se imprime.
     *
     * Daniel, 14-ago-2026: *"debería ponerme el SKU en vez del artículo y también la columna
     * talla, así podré saber qué tallas voy a sacar"*. Y el ORIGEN va con la ubicación
     * COMPLETA, nivel incluido: para SACAR hay que saber exactamente dónde está. (El destino
     * sigue siendo el cuerpo, porque al GUARDAR el nivel no importa — esa regla no cambió.)
     *
     * No es un lujo: el 8517900 tiene la talla 43 partida entre el nivel B y el C del mismo
     * cuerpo, 35 pares y 10. Sin el nivel el operario la busca a ciegas. */
    const dk = `${k}|${s7}`;
    if (!detallePorArt.has(dk)) detallePorArt.set(dk, []);
    detallePorArt.get(dk).push({
      ubi, skuFull: String(raw[1] || '').trim(),
      talla: ENT.normalizarTalla(tallaDeSku(String(raw[1] || '').trim(), String(raw[2] || '').trim())),
      pares: Math.round(qty)
    });
    paresEnElPiso.set(s7, (paresEnElPiso.get(s7) || 0) + qty);
    const _ta = parseFloat(ENT.normalizarTalla(tallaDeSku(String(raw[1] || '').trim(),
                                                      String(raw[2] || '').trim())));
    if (isFinite(_ta) && _ta > 0) {
      const acc = tallaDeArt.get(s7) || { suma: 0, pares: 0 };
      acc.suma += _ta * qty; acc.pares += qty;
      tallaDeArt.set(s7, acc);
    }
  });

  /* ══════════════════════════════════════════════════════════════════════════════
   * A DÓNDE VA CADA LÍNEA. NADA QUEDA A CRITERIO DEL OPERARIO.
   *
   * Daniel, 14-ago-2026: *"nada debe quedar a criterio del operario, el sistema lo debe
   * controlar todo"*. Antes la línea decía qué sacar y ahí terminaba; el operario resolvía
   * dónde ponerlo, que es exactamente la decisión que la cadena no le puede pasar.
   *
   * Se resuelve con las MISMAS reglas del almacenaje, sin copiar ninguna:
   *
   *   1. ¿Tiene otro cuerpo suyo? Va ahí — juntar la familia. Un cuerpo cuenta como suyo
   *      desde 20 pares, el mismo `MINIMO_PARA_SER_CASA` de la reposición.
   *   2. Si no, se le calcula la franja que le toca —saldos, saldo grande, anterior o
   *      actual— con `franjaDeArticulo`, mirando lo que tiene en TODO el piso.
   *   3. En las franjas que comparten cuerpo va al que mejor lo reciba; en la actual, a un
   *      cuerpo libre.
   *   4. Si no hay lugar, la línea queda RETENIDA y no sale en el papel. Una línea sin
   *      destino le devuelve la decisión al operario, y eso es lo que no se puede.
   *
   * SE VA RESERVANDO A MEDIDA QUE SE ASIGNA. Sin eso, veinte líneas de saldo apuntaban al
   * mismo cuerpo compartido y lo reventaban.
   *
   * Medido sobre el selectivo con el stock del 14-ago-2026: las 51 líneas encuentran destino
   * —23 a su propio cuerpo, 25 a la columna de saldo grande y 3 a la de saldos— y ninguna
   * queda retenida. La banda del `SEL-04` es la que lo hace posible: sin ella, los 25 del
   * medio pedían un cuerpo entero de la franja actual, y ahí no hay ninguno libre.
   * ══════════════════════════════════════════════════════════════════════════════ */
  const MINIMO_PARA_SER_CASA = 20;
  const ocupadosPorZona = {}, libresPorZona = {};
  cuerpos.forEach((c, k) => {
    const [, col, cue] = k.split('-');
    const clave = `${Number(col)}-${Number(cue)}`;
    (ocupadosPorZona[c.zona] = ocupadosPorZona[c.zona] || new Set()).add(clave);
    const dentro = [...c.m.values()].reduce((a, b) => a + b, 0);
    /* LA CAPACIDAD, CON TODO LO QUE LA DECIDE: la columna, la sub-marca del que más pesa
       adentro y su serie. Midiendo solo por serie, el `SEL-06-13` figuraba con 450 cuando
       es un cuerpo de Bata Comfit y entran 700 — y el que decide es el ocupante, no el que
       llega. */
    const mayor = [...c.m.entries()].sort((a, b) => b[1] - a[1])[0];
    const s7Mayor = mayor ? mayor[0] : '';
    const fMayor = ficha.get(s7Mayor) || {};
    /* EL TIPO DE CALZADO DEL QUE MAS PESA ADENTRO. Igual que con la sub-marca: el que decide
       cuanto entra es el ocupante, no el que llega. Un cuerpo con botas entra 270 aunque el
       que viene sea un zapato — no van a caber mas por cambiar de dueño. */
    const cap = zonasService.densidadDe(c.zona, zonasService.serieDe(s7Mayor),
                                        fMayor.marcaStd, c.col,
                                        zonasService.tipoDeCalzado(fMayor.subcategoria,
                                                                   fMayor.categoria),
                                        { sku7: s7Mayor, marca: fMayor.marca,
                                          talla: tallaMediaDe(s7Mayor) });
    (libresPorZona[c.zona] = libresPorZona[c.zona] || new Map())
      .set(clave, Math.max(0, cap - dentro));
  });

  /* ══════════════════════════════════════════════════════════════════════════════
   * LO QUE ALMACENAJE YA APARTÓ ESTA NOCHE TAMBIÉN OCUPA.
   *
   * Regla de la cadena: un módulo recibe una decisión tomada y no la contradice.
   * Procesar Tareas eligió los cuerpos primero; Slotting los respeta.
   *
   * Sin esto el cuerpo apartado sigue vacío en la foto de las 19:00 y Slotting lo
   * entrega de nuevo. El 17-ago-2026 pasó con el `SEL-10-21` —vacío en la foto,
   * prometido a la Tarea 16 para el 6546876 y elegido por la Tarea 1 de Slotting
   * para el 5415302—, y era el ÚNICO cuerpo libre de toda la columna 10.
   *
   * DOS TRATOS DISTINTOS, PORQUE SON DOS PROBLEMAS DISTINTOS:
   *
   *   · En la franja actual, un cuerpo es de un solo artículo: si la tarea lo apartó
   *     para OTRO, queda ocupado y Slotting busca en otro lado.
   *   · En las columnas que comparten cuerpo a propósito —el saldo grande, los
   *     saldos— no se bloquea: se le DESCUENTA lo que va a llegar, para que
   *     `cuerpoQueRecibe` no lo llene por encima de su capacidad. Ahí el problema
   *     nunca fue el dueño, fue el espacio.
   *
   * Y si la tarea apartó el cuerpo PARA EL MISMO ARTÍCULO, no se toca nada: eso es
   * juntar la familia, que es exactamente lo que las dos partes quieren.
   * ══════════════════════════════════════════════════════════════════════════════ */
  const apartadoPara = new Map();   // 'ZONA|col-cue' -> Set de sku7 con tarea hacia ahí
  mandados.skus.forEach((skus, nombre) => {
    const p = String(nombre).split('-');
    const zona = p[0];
    if (!zonas.includes(zona)) return;
    const clave = `${Number(p[1])}-${Number(p[2])}`;
    apartadoPara.set(`${zona}|${clave}`, skus);

    const compartido = zonasService.columnaAdmiteVariosArticulos(zona, Number(p[1]));
    const libres = (libresPorZona[zona] = libresPorZona[zona] || new Map());
    if (compartido) {
      /* El que ya estaba adentro fija la capacidad; si el cuerpo está vacío en la
         foto se toma la del artículo que la tarea manda, que es quien lo va a llenar. */
      const primero = [...skus][0] || '';
      const fp = ficha.get(String(primero).substring(0, 7)) || {};
      const cap = libres.has(clave)
        ? libres.get(clave)
        : zonasService.densidadDe(zona, zonasService.serieDe(primero), fp.marcaStd, null,
                                  zonasService.tipoDeCalzado(fp.subcategoria, fp.categoria),
                                  { sku7: primero, marca: fp.marca,
                                    talla: tallaMediaDe(String(primero).substring(0, 7)) });
      libres.set(clave, Math.max(0, cap - (mandados.pares.get(nombre) || 0)));
    } else {
      (ocupadosPorZona[zona] = ocupadosPorZona[zona] || new Set()).add(clave);
    }
  });

  const nombreDe = (zona, clave) => {
    const [col, cue] = clave.split('-');
    return zonasService.nombreCuerpo(zona, Number(col), Number(cue));
  };

  const destinoDe = (s7, desdeCuerpo, pares) => {
    const f = ficha.get(s7) || {};
    /* 1. JUNTAR LA FAMILIA: otro cuerpo suyo, con 20 pares o más, Y QUE LE ENTRE.
     *
     * LA COMPROBACIÓN DE ESPACIO FALTABA, y la trajo Daniel el 18-ago-2026 leyendo la
     * tarea 2: *"igual estás sacando ciento y tantos pares de un cuerpo para pasar a otro
     * cuerpo, igual no te va a alcanzar. Hay un mal análisis ahí"*. Tenía razón — este era
     * el ÚNICO de los cuatro caminos de destino que no miraba cuánto quedaba libre:
     * devolvía el primer cuerpo suyo que encontrara y ahí terminaba.
     *
     * El caso: el `5553848` tiene 687 pares en el `SEL-06-13` —un cuerpo de Bata Comfit,
     * que entra 700— y se le mandaban 108 más desde el `SEL-06-15`. Habrían quedado 795 en
     * un cuerpo con 13 de sitio.
     *
     * Y ya que se mide, se elige EL QUE MÁS LUGAR TENGA en vez del primero: si el artículo
     * vive en varios cuerpos, el resto va donde de verdad cabe.
     *
     * Salvo que la tarea de almacenaje lo haya apartado para OTRO artículo: ahí ya tiene
     * dueño esta noche y meterle un tercero es el choque que se está evitando. */
    let suyo = null, masLibre = -1;
    cuerpos.forEach((c, k) => {
      if (k === desdeCuerpo) return;
      if ((c.m.get(s7) || 0) < MINIMO_PARA_SER_CASA) return;
      const p = String(k).split('-');
      const clave = `${Number(p[1])}-${Number(p[2])}`;
      const otros = apartadoPara.get(`${p[0]}|${clave}`);
      if (otros && !otros.has(s7) && !zonasService.columnaAdmiteVariosArticulos(p[0], Number(p[1]))) return;
      const libre = (libresPorZona[c.zona] && libresPorZona[c.zona].get(clave)) || 0;
      if (libre < pares) return;                 // no le entra: no es destino
      if (libre > masLibre) { masLibre = libre; suyo = k; }
    });
    if (suyo) {
      // Se reserva el lugar, igual que en los otros caminos: dos restos del mismo turno no
      // pueden contar con el mismo hueco.
      const p = String(suyo).split('-');
      const libres = libresPorZona[p[0]];
      const clave = `${Number(p[1])}-${Number(p[2])}`;
      if (libres) libres.set(clave, Math.max(0, (libres.get(clave) || 0) - pares));
      return { destino: suyo, motivo: 'junta la familia' };
    }

    // 2. LA FRANJA QUE LE TOCA, con las reglas de siempre
    const art = {
      marca: f.marca, genderRims: f.genderRims, gGender: f.gGender,
      subcategoria: f.subcategoria, sku7: s7,
      pares: Math.round(paresEnElPiso.get(s7) || 0),
      esTemporadaActual: ENT.sugActuales(getLogicalDate())
        .some(t => String(f.temporada || '').toUpperCase().includes(t))
    };
    const zr = zonasService.resolverZona(art);
    if (!zr.zona || zonasService.esZonaSinUbicacion(zr.zona)) return null;
    const franja = zonasService.franjaDeArticulo(art, zr.zona);
    let columnas = zonasService.columnasDeFranja(zr.zona, franja);
    const suyas = zonasService.columnasDeMarcaEnFranja(f.marca, franja);
    if (suyas.length) {
      const propias = columnas.filter(c => suyas.includes(c));
      if (propias.length) columnas = propias;
    }
    if (!columnas.length) return null;

    const ocup = ocupadosPorZona[zr.zona] || new Set();
    const libres = libresPorZona[zr.zona];

    // 3a. Las franjas que comparten: el cuerpo que mejor lo reciba
    if (zonasService.columnaAdmiteVariosArticulos(zr.zona, columnas[0])) {
      const r = zonasService.cuerpoQueRecibe(zr.zona, columnas, pares, ocup, libres);
      if (r && r.cuerpos && r.cuerpos.length) {
        const c = r.cuerpos[0];
        const clave = `${c.columna}-${c.cuerpo}`;
        if (libres) libres.set(clave, Math.max(0, (libres.get(clave) || 0) - pares));
        return { destino: nombreDe(zr.zona, clave), motivo: `es ${franja}` };
      }
    }
    // 3b. La franja actual: un cuerpo libre, y queda tomado
    const r = zonasService.elegirCuerpos(zr.zona, columnas, 1, ocup);
    if (r.completo && r.cuerpos.length) {
      const c = r.cuerpos[0];
      const clave = `${c.columna}-${c.cuerpo}`;
      ocup.add(clave);
      return { destino: nombreDe(zr.zona, clave), motivo: `su franja ${franja}` };
    }
    return null;   // 4. sin lugar: la línea queda retenida
  };

  // Y de cada cuerpo mezclado salen las líneas por sacar
  const lineas = [];
  let mezclados = 0, porTarea = 0, retenidas = 0;
  cuerpos.forEach((c, k) => {
    if (!zonasQueSeOrdenan.has(c.zona)) return;
    if (c.m.size <= 1) return;
    if (zonasService.columnaAdmiteVariosArticulos(c.zona, c.col)) return;
    mezclados++;

    const orden = [...c.m.entries()].sort((a, b) => b[1] - a[1]);
    const conTarea = (mandados.skus.get(k) || new Set());
    const mandadosAca = orden.filter(([s7]) => conTarea.has(s7));

    // Manda la tarea si hay UNO solo; si hay varios o ninguno, el que más pares tiene
    const elegido = (mandadosAca.length === 1) ? mandadosAca[0] : orden[0];
    if (mandadosAca.length === 1) porTarea++;

    orden.forEach(([s7, pares]) => {
      if (s7 === elegido[0]) return;
      const f = ficha.get(s7) || {};
      // SIN DESTINO NO SALE. Ver el bloque de arriba: una línea que no dice a dónde va le
      // devuelve la decisión al operario. Se cuenta para poder avisarlo, y se deja para la
      // corrida siguiente —cuando Slotting haya hecho lugar, va a tener dónde ir—.
      const d = destinoDe(s7, k, Math.round(pares));
      if (!d) { retenidas++; return; }
      lineas.push({
        ubi: k, sku7: s7, pares: Math.round(pares),
        marca: f.marca || '', temporada: f.temporada || '',
        dueno: elegido[0], duenoPares: Math.round(elegido[1]),
        llevarA: d.destino, motivo: d.motivo,
        // El detalle que se imprime: una fila por SKU y talla, con la ubicación completa
        detalle: (detallePorArt.get(`${k}|${s7}`) || [])
          .slice().sort((a, b) => String(a.ubi).localeCompare(String(b.ubi))
                               || (parseFloat(a.talla) || 0) - (parseFloat(b.talla) || 0)),
        // De dónde salió el que hay que sacar: previsto o puesto a mano
        vinoPorTarea: conTarea.has(s7),
        duenoPorTarea: mandadosAca.length === 1
      });
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════════
   * EL SEGUNDO HALLAZGO: ARRASTRAR EL RESTO. Y este viene CON DESTINO.
   *
   * Regla de Daniel del 14-ago-2026, y es la otra mitad del corte de los 20 pares: el mismo
   * corte que convierte un código en nuevo es el que deja un resto huérfano en el piso.
   *
   *   *"Lo ideal es que esos diecinueve deberían estar en zonas de saldos. Pero a veces
   *   Slotting no se da abasto y quedan en una zona de actual. Y tú le has dado una
   *   ubicación a esos seiscientos pares en otro selectivo: entonces esa tiene que ser una
   *   tarea para Slotting, mover esos diecinueve pares a la ubicación nueva."*
   *
   * LA FRANJA DE DONDE SALE NO IMPORTA. Acá hubo una versión que dejaba quieto lo que
   * estaba en la columna de saldos, y Daniel la corrigió el mismo día: *"por más que esté
   * en temporada antigua, temporada actual o en saldos, deberían moverse a donde están los
   * seiscientos pares, para que esté toda la familia en un solo cuerpo o en dos. No puede
   * estar en dos zonas diferentes"*.
   *
   * ES LA ÚNICA LÍNEA CON DESTINO, y por eso no se mezcla con las de arriba: las del cuerpo
   * mezclado dicen qué sacar y el equipo decide adónde; esta dice las dos cosas, porque la
   * tarea de almacenaje ya eligió el cuerpo esta misma noche.
   *
   * POR ESO EL BARRIDO CORRE DESPUÉS DE ARMAR LAS TAREAS y no antes: el destino no existe
   * hasta que `calcularSugerenciaDeItem` eligió los cuerpos.
   * ══════════════════════════════════════════════════════════════════════════════ */
  const casaNueva = new Map();          // sku7 -> Set de cuerpos que le dio la tarea
  mandados.skus.forEach((skus, k) => skus.forEach(s7 => {
    if (!casaNueva.has(s7)) casaNueva.set(s7, new Set());
    casaNueva.get(s7).add(k);
  }));

  /* SOLO SE ARRASTRA UN RESTO, NO UNA MUDANZA. Este candado apareció al correr el barrido
   * contra los datos de verdad: sin él salían líneas de 612, 573 y 553 pares — un artículo
   * que vive en tres cuerpos del MZN02 y al que la tarea le nombró otro. Eso no es lo que
   * dijo Daniel; eso es mover el artículo entero, y además a un cuerpo donde no entra.
   *
   * La regla nace del corte de los 20: un artículo pasa a CÓDIGO NUEVO cuando tiene 19 pares
   * o menos en todo el almacén, y el resto que deja atrás es justamente eso. Así que si lo
   * que tiene fuera de sus cuerpos nuevos llega a 20, no es un resto y no se toca.
   *
   * Lo que queda afuera por este candado —los artículos de reposición repartidos en varios
   * cuerpos, 233 medidos el 14-ago— cae bajo el mismo principio de "toda la familia junta",
   * pero por otro camino: no están esperando una llegada que los consolide. Falta que Daniel
   * decida si quieren tarea propia. */
  const CORTE_CODIGO_NUEVO = 20;
  const fueraDeSuCasa = new Map();
  casaNueva.forEach((suyos, s7) => {
    let n = 0;
    cuerpos.forEach((c, k) => { if (!suyos.has(k)) n += (c.m.get(s7) || 0); });
    fueraDeSuCasa.set(s7, n);
  });

  /* NO SE DUPLICA CON LAS DE ARRIBA. Un resto que está en un cuerpo mezclado YA salió como
   * línea del barrido, sin destino. Si además hay que arrastrarlo, no se agrega otra línea:
   * se le completa el destino a la que ya está. Sin esto el operario recibía la misma
   * mercadería dos veces, una con destino y otra sin él. */
  const yaEstan = new Map();
  lineas.forEach(l => yaEstan.set(`${l.ubi}|${l.sku7}`, l));

  let arrastres = 0;
  casaNueva.forEach((suyos, s7) => {
    if ((fueraDeSuCasa.get(s7) || 0) >= CORTE_CODIGO_NUEVO) return;   // es mudanza, no resto
    // A dónde se lo lleva: si la tarea le dio más de un cuerpo, al primero. El equipo
    // termina de acomodar adentro, que para eso son 300 pares como mucho.
    const aDonde = [...suyos].sort()[0];
    cuerpos.forEach((c, k) => {
      /* SOLO DE LAS ZONAS QUE SE ORDENAN ESTA NOCHE. El almacén se lee entero para no
         perder las trabas de las otras zonas, pero el arrastre NO es una urgencia: es
         trabajo de orden común y tiene que respetar la elección.
         Daniel, 28-ago-2026, corriendo solo el MZN02: *"¿por qué me sale B.G Licencias?"*.
         Salía por acá: un resto suyo en el MZN01 se colaba en la corrida del MZN02. */
      if (!zonasQueSeOrdenan.has(c.zona)) return;
      if (suyos.has(k)) return;                 // ya está donde tiene que estar
      const pares = c.m.get(s7);
      if (!pares || pares <= 0) return;
      arrastres++;
      const previa = yaEstan.get(`${k}|${s7}`);
      if (previa) { previa.llevarA = aDonde; previa.motivo = 'arrastre'; return; }
      const f = ficha.get(s7) || {};
      lineas.push({
        ubi: k, sku7: s7, pares: Math.round(pares),
        marca: f.marca || '', temporada: f.temporada || '',
        // El destino es lo que distingue a esta línea, y va explícito para que la pantalla
        // y el papel no tengan que deducirlo.
        llevarA: aDonde, motivo: 'arrastre',
        detalle: (detallePorArt.get(`${k}|${s7}`) || [])
          .slice().sort((a, b) => String(a.ubi).localeCompare(String(b.ubi))
                               || (parseFloat(a.talla) || 0) - (parseFloat(b.talla) || 0)),
        dueno: s7, duenoPares: Math.round(pares), vinoPorTarea: true, duenoPorTarea: true
      });
    });
  });

  console.log(`[Slotting] ${zonas.join('+')}: ${cuerpos.size} cuerpos con stock, ${mezclados} mezclados `
            + `(${porTarea} con dueño decidido por la tarea), ${arrastres} restos por arrastrar, `
            + `${retenidas} líneas retenidas sin destino, ${lineas.length} líneas y `
            + `${lineas.reduce((a, l) => a + l.pares, 0)} pares por sacar.`);

  /* ── UN ARTÍCULO, UN CUERPO: CONSOLIDAR LA REPOSICIÓN ──────────────────────────
   *
   * Regla de Daniel, 16-ago-2026, y es la consecuencia directa de bajar la reposición a un
   * cuerpo: *"quiero que la reposición de un artículo quede con un cuerpo nada más"*, *"no
   * importa que les hagan cincuenta, ochenta tareas de slotting, con tal que el selectivo
   * esté impecable"*.
   *
   * EL PRINCIPIO QUE LO ORDENA: almacenaje solo almacena; SLOTTING deja el almacén como
   * dicen las reglas. Toda discrepancia contra la regla es tarea de Slotting.
   *
   * Se queda el cuerpo MÁS CARGADO y los demás se vacían. Lo que entra en el que se queda se
   * mueve ahí; lo que no entra SUBE A RESERVA —*"y el resto lo subes, no hay de otra"*—.
   *
   * UN CUERPO DE ORIGEN VA ENTERO A UN SOLO DESTINO. Sin partirlo: el operario vacía un
   * cuerpo y lo lleva a un lugar, no a dos. Si no entra completo en el que se queda, va todo
   * a reserva.
   *
   * NO SE TOCA LO QUE ACABA DE LLEGAR — ver `conEntradaReciente`. Y esto pesa mucho más de
   * lo que parecía: medido el 16-ago-2026, de los 61 artículos con varios cuerpos en el
   * selectivo, **48 recibieron mercadería en las últimas dos semanas** y quedan protegidos.
   * Tiene sentido: si la franja está llena es porque acaba de entrar mercadería, no porque
   * esté mal ordenada.
   *
   * SOLO DONDE LA FRANJA EXIGE UN CUERPO UN ARTÍCULO. En saldos, anterior, escolar y catálogo
   * se comparte por diseño y no hay nada que consolidar.
   *
   * LO QUE DE VERDAD SALE, medido ese día: **13 artículos, 16 cuerpos liberados**, 267 pares
   * que se mueven y 2.873 que suben a reserva —15 paletas—, unas 11 tareas. La franja pasa de
   * 8 cuerpos vacíos a 24. Sin el filtro de recencia daban 82 cuerpos, y ese número era
   * mentira: consolidaba artículos en plena ventana de venta. */
  /* APAGADA POR DECISIÓN DE DANIEL (28-ago-2026). El porqué, con los números medidos, está
  /* ══════════════════════════════════════════════════════════════════════════════
   * LO QUE ESTÁ EN UNA COLUMNA BLOQUEADA, SALE
   * ══════════════════════════════════════════════════════════════════════════════
   *
   * Daniel, 28-ago-2026: *"si es que hay algo en las franjas bloqueadas, en cualquier
   * mezzanine, tienes que hacerle una tarea de Slotting para que lo saque de ahí. Por
   * error un usuario puede matricularlo en una franja bloqueada y el Slotting lo tiene
   * que mandar a una zona buena"*.
   *
   * Una columna bloqueada está fuera de circulación: nadie debería almacenar ahí, y el
   * cálculo de almacenaje ya no le ofrece cuerpos. Pero la matrícula la hace una persona
   * con un lector, y una persona se puede equivocar.
   *
   * EL BARRIDO DE MEZCLAS NO LO VE, y por eso hace falta esto aparte: aquel solo mira
   * cuerpos con más de un artículo, y un cuerpo bloqueado con UN solo artículo adentro
   * le pasa desapercibido. Comprobado el 28-ago con la columna 9 del MZN01: 4.954 pares
   * en 14 cuerpos, ninguno mezclado, y el barrido no generaba ni una línea.
   *
   * Sale TODO lo que haya adentro, sea uno o sean cinco artículos. */
  const bloqueadas = {};
  zonas.forEach(z => { bloqueadas[z] = new Set(zonasService.columnasBloqueadasDe(z).map(Number)); });
  let enBloqueada = 0, paresBloqueada = 0;
  cuerpos.forEach((c, k) => {
    if (!zonasQueSeOrdenan.has(c.zona)) return;
    if (!bloqueadas[c.zona] || !bloqueadas[c.zona].has(Number(c.col))) return;
    c.m.forEach((pares, s7) => {
      const p = Math.round(pares);
      if (p <= 0) return;
      const d = destinoDe(s7, k, p);
      if (!d) return;              // sin destino no sale: no se le devuelve la decisión
      const f = ficha.get(s7) || {};
      enBloqueada++; paresBloqueada += p;
      lineas.push({
        ubi: k, sku7: s7, pares: p,
        marca: f.marca || '', temporada: f.temporada || '',
        llevarA: d.destino, motivo: `columna bloqueada · ${d.motivo}`,
        detalle: (detallePorArt.get(`${k}|${s7}`) || [])
          .slice().sort((a, b) => String(a.ubi).localeCompare(String(b.ubi))
                               || (parseFloat(a.talla) || 0) - (parseFloat(b.talla) || 0)),
        vinoPorTarea: false, duenoPorTarea: false, prioridad: true
      });
    });
  });
  if (enBloqueada) {
    console.log(`[Slotting] ${enBloqueada} línea(s) en columnas bloqueadas, `
              + `${paresBloqueada} pares que hay que sacar de ahí.`);
  }

  /* ══════════════════════════════════════════════════════════════════════════════
   * CADA COSA EN SU FRANJA
   * ══════════════════════════════════════════════════════════════════════════════
   *
   * Es el punto 3 del orden que dictó Daniel el 28-ago-2026: después de destrabar y de
   * consolidar, *"mandar las temporadas antiguas a sus zonas, de ahí los saldos a la zona
   * de saldos"*. Hasta acá NADIE revisaba esto sobre lo que YA está en el piso: almacenaje
   * decide la franja cuando la mercadería LLEGA, y después nadie vuelve a mirarla.
   *
   * Por eso un saldo envejece en la franja actual ocupando un cuerpo entero, y la
   * temporada anterior se queda entre la mercadería que se pica todos los días.
   *
   * LA COLUMNA QUE COMPARTE NO SE REVISA. En saldos, anterior, escolar, catálogo y en las
   * marcas que van todo junto —Puma, Adidas, Skechers, Marie Claire— conviven a propósito
   * varias cosas: preguntar ahí sacaría mercadería que está bien puesta.
   *
   * Y NO SE DUPLICA con el barrido de mezclas: si esa línea ya salió por estar en un
   * cuerpo sucio, se le completa el destino en vez de agregar otra. El operario no puede
   * recibir dos veces la misma mercadería. */
  let fueraDeFranja = 0, paresFuera = 0;
  /* Lo que ya salió por el barrido de mezclas o por columna bloqueada, indexado por
     cuerpo y artículo, para no mandar dos veces la misma mercadería. */
  const yaEnLineaPorClave = new Map(lineas.map(l => [String(l.ubi) + '|' + String(l.sku7), l]));
  cuerpos.forEach((c, k) => {
    if (!zonasQueSeOrdenan.has(c.zona)) return;
    if (bloqueadas[c.zona] && bloqueadas[c.zona].has(Number(c.col))) return;   // ya salió arriba
    if (zonasService.columnaAdmiteVariosArticulos(c.zona, c.col)) return;
    const suya = zonasService.franjaDeColumna(c.zona, c.col);
    c.m.forEach((pares, s7) => {
      const p = Math.round(pares);
      if (p <= 0) return;
      const f = ficha.get(s7) || {};
      const art = {
        marca: f.marca, genderRims: f.genderRims, gGender: f.gGender,
        subcategoria: f.subcategoria, sku7: s7,
        pares: Math.round(paresEnElPiso.get(s7) || 0),
        esTemporadaActual: ENT.sugActuales(getLogicalDate())
          .some(t => String(f.temporada || '').toUpperCase().includes(t))
      };
      const zr = zonasService.resolverZona(art);
      if (!zr.zona || zonasService.esZonaSinUbicacion(zr.zona)) return;
      const leToca = zonasService.franjaDeArticulo(art, zr.zona);
      if (zr.zona === c.zona && zonasService.columnaSirveParaFranja(c.zona, c.col, leToca)) return;
      if (leToca === suya && zr.zona === c.zona) return;
      const previa = yaEnLineaPorClave.get(k + '|' + s7);
      if (previa) { if (!previa.llevarA) { const d = destinoDe(s7, k, p); if (d) { previa.llevarA = d.destino; previa.motivo = d.motivo; } } return; }
      const d = destinoDe(s7, k, p);
      if (!d) return;
      fueraDeFranja++; paresFuera += p;
      lineas.push({
        ubi: k, sku7: s7, pares: p,
        marca: f.marca || '', temporada: f.temporada || '',
        llevarA: d.destino, motivo: `le toca ${leToca} · ${d.motivo}`,
        detalle: (detallePorArt.get(`${k}|${s7}`) || [])
          .slice().sort((a, b) => String(a.ubi).localeCompare(String(b.ubi))
                               || (parseFloat(a.talla) || 0) - (parseFloat(b.talla) || 0)),
        vinoPorTarea: false, duenoPorTarea: false
      });
    });
  });
  if (fueraDeFranja) {
    console.log(`[Slotting] ${fueraDeFranja} línea(s) fuera de su franja, ${paresFuera} pares.`);
  }

  /* APAGADA POR DECISIÓN DE DANIEL (28-ago-2026). El porqué, con los números medidos, está
     en el comentario de `consolidarUnCuerpo` en slottingService.js. Se prende desde
     Config. Slotting; mientras esté apagada, Slotting no manda nada a reserva. */
  const consolidarOn = slottingService.configActual().consolidarUnCuerpo === true;
  const recienLlegados = consolidarOn
    ? await conEntradaReciente(SEMANAS_PARA_CONSOLIDAR, ENT)
    : new Set();
  const porArticulo = new Map();
  if (consolidarOn) cuerpos.forEach((c, k) => {
    if (!zonasQueSeOrdenan.has(c.zona)) return;
    if (zonasService.columnaAdmiteVariosArticulos(c.zona, c.col)) return;
    const cue = parseInt(String(k).split('-')[2], 10);
    c.m.forEach((pares, s7) => {
      if (!porArticulo.has(s7)) porArticulo.set(s7, []);
      porArticulo.get(s7).push({ k, zona: c.zona, col: c.col, cue, pares });
    });
  });

  /* ── CONSOLIDAR SIN SUBIR NADA A RESERVA — reescrita el 28-ago-2026 ────────────
   *
   * Daniel: *"no vaya a ser que el buffer baje mercadería, las tareas la almacenen, y
   * Slotting diga: acá no entra, la voy a volver a subir"*. Es la regla de la cadena
   * —un módulo no contradice al anterior— aplicada un eslabón más adelante.
   *
   * LO QUE HACÍA MAL LA VERSIÓN ANTERIOR. Se quedaba con el cuerpo más cargado y mandaba
   * A RESERVA todo lo que no entrara ahí. Medido sobre el selectivo con el stock del
   * 28-ago: ordenaba 534 pares en el piso y subía 16.584 — 31 arriba por cada uno
   * ordenado abajo. Y el fondo: 48 de los 55 artículos con varios cuerpos NO ENTRAN en
   * uno solo ni aunque se vacíe entero, así que para el 87% la regla era imposible de
   * cumplir y el código respondía mandando el resto arriba.
   *
   * LO QUE HACE AHORA. Al artículo se le dejan los cuerpos que de verdad necesita
   * —`ceil(total ÷ capacidad)`— y se vacían los que sobran hacia los que se quedan.
   * Estar en dos o tres cuerpos NO es una discrepancia: es lo que su volumen pide.
   *
   * TODO O NADA POR CUERPO DE ORIGEN, la regla de Daniel del 18-ago: si el cuerpo no
   * entra completo en ninguno de los que se quedan, no se mueve y ESPERA a que haya
   * lugar. Mandar la mitad deja al artículo partido igual, gasta el viaje y encima llena
   * el destino.
   *
   * Se vacían los MÁS FLACOS primero: son los que más barato liberan un cuerpo. */
  let consolidados = 0, cuerposQueLibera = 0, esperan = 0, recientes = 0;
  porArticulo.forEach((suyos, s7) => {
    if (suyos.length <= 1) return;
    if (recienLlegados.has(s7)) { recientes++; return; }

    const f = ficha.get(s7) || {};
    const capDe = (zona) => zonasService.densidadDe(zona, zonasService.serieDe(s7), f.marcaStd,
                                        null, zonasService.tipoDeCalzado(f.subcategoria,
                                                                         f.categoria),
                                        { sku7: s7, marca: f.marca,
                                          talla: tallaMediaDe(s7) });
    const orden = [...suyos].sort((a, b) => b.pares - a.pares);
    const total = orden.reduce((a, b) => a + b.pares, 0);
    const capacidad = capDe(orden[0].zona);
    const hacenFalta = Math.max(1, Math.ceil(total / capacidad));
    if (orden.length <= hacenFalta) return;      // no sobra ninguno: está bien repartido

    /* Los que se quedan son los más cargados; el hueco de cada uno se lleva la cuenta
       aparte para que dos restos de la misma noche no cuenten con el mismo espacio. */
    const sequedan = orden.slice(0, hacenFalta)
      .map(c => ({ ...c, hueco: Math.max(0, capDe(c.zona) - c.pares) }));
    let movio = false;

    orden.slice(hacenFalta).forEach(o => {
      const destino = sequedan
        .filter(d => d.hueco >= o.pares)                 // entra ENTERO o no va
        .sort((a, b) => b.hueco - a.hueco)[0];           // al que más lugar tenga
      if (!destino) { esperan++; return; }               // espera. NUNCA sube a reserva
      destino.hueco -= o.pares;
      movio = true;
      cuerposQueLibera++;
      lineas.push({
        ubi: o.k, sku7: s7, pares: Math.round(o.pares),
        marca: f.marca || '', temporada: f.temporada || '',
        dueno: s7, duenoPares: Math.round(destino.pares),
        llevarA: destino.k,
        motivo: `junta la familia · le bastan ${hacenFalta} cuerpo${hacenFalta === 1 ? '' : 's'}`,
        detalle: (detallePorArt.get(`${o.k}|${s7}`) || [])
          .slice().sort((a, b) => String(a.ubi).localeCompare(String(b.ubi))
                               || (parseFloat(a.talla) || 0) - (parseFloat(b.talla) || 0)),
        vinoPorTarea: false, duenoPorTarea: false
      });
    });
    if (movio) consolidados++;
  });
  if (consolidados || esperan) {
    console.log(`[Slotting] ${consolidados} artículos se consolidan y liberan `
              + `${cuerposQueLibera} cuerpo(s). ${esperan} cuerpo(s) esperan lugar `
              + `—no entran completos y NO se suben a reserva—. `
              + `${recientes} se protegieron por recibir mercadería hace menos de ${SEMANAS_PARA_CONSOLIDAR} semanas.`);
  }

  /* ── LO QUE ALMACENAJE NO PUDO GUARDAR ─────────────────────────────────────────
   *
   * Regla de Daniel, 15-ago-2026. Hasta acá el papel de almacenaje decía "Revisar Slotting"
   * y ahí moría: Slotting armaba su corrida barriendo cuerpos mezclados y nunca se enteraba
   * de que había mercadería parada esperándolo. Medido sobre la corrida del 15-ago: 18
   * artículos y 9.241 pares parados, contra 9 tareas de Slotting que no tenían relación con
   * ninguno de ellos.
   *
   * ES LA POSTA QUE FALTABA, y llega con el número que la ordena: los PARES PARADOS. Mover
   * 269 pares para destrabar 2.982 no es lo mismo que una mezcla común de 40 que no destraba
   * nada, y en la lista las dos se veían igual.
   *
   * SOLO EL CUERPO SUCIO GENERA TAREA. Ahí Slotting sabe exactamente qué sacar. La otra traba
   * se llama SIN CUERPO LIBRE y no "sin lugar": el lugar lo tiene siempre —su zona sale de la
   * marca y su columna de la temporada—, lo que falta es un cuerpo VACÍO adentro de esa
   * columna. Como no hay un intruso puntual que sacar, sale como aviso y no como línea.
   *
   * LAS TRABAS NO MIRAN LA ZONA ELEGIDA, desde el 28-ago-2026. Antes sí: si Slotting corría
   * solo el selectivo, un trabado del mezzanine no entraba —el 15-ago, de 18 artículos
   * parados entraban 2—. Ahora la elección de zonas dice qué se ORDENA esta noche, no qué
   * se atiende: lo que traba una tarea de almacenaje entra siempre y sale con prioridad. */
  const avisos = [];
  const yaEnLinea = new Map(lineas.map(l => [String(l.ubi) + '|' + String(l.sku7), l]));

  /* SOLO LAS TRABAS DE ESTA JORNADA. Daniel, 28-ago-2026: *"arregla el tema de las fechas"*.
   *
   * Hasta acá se recorría `almacenajeTasksCache` entero, que son TODAS las tareas guardadas
   * en la PC sin ningún filtro de fecha. Medido ese día contra el servidor: 10 jornadas de
   * arrastre —del 18 al 27 de agosto—, 119.024 pares de trabas, y **las 187 líneas
   * pertenecían a tareas ya Finalizadas o Vencidas**. Una traba del 18 volvía a imprimirse
   * en el papel de hoy como si fuera nueva, y el equipo no tenía forma de distinguirlas.
   *
   * La jornada alcanza porque la traba se vuelve a estampar: si la mercadería sigue parada
   * en el buffer, la corrida de almacenaje de esta noche la detecta otra vez. Lo que ya se
   * guardó no vuelve a aparecer, que es justamente lo que se busca. */
  const jornadaHoy = getLogicalDate();
  let trabasViejas = 0;
  (ENT.tareasDeAlmacenaje() || []).forEach(t => (t.items || []).forEach(art => {
    const tr = art && art.traba;
    if (!tr || !tr.pares) return;
    if (String(t.fecha || '') !== jornadaHoy) { trabasViejas++; return; }
    /* SIN FILTRO DE ZONA, a proposito. Lo que traba una tarea de almacenaje entra
       siempre, se este ordenando esa zona o no: es la posta del modulo anterior.
       Daniel, 28-ago-2026: *"por mas que yo corra el mezzanine uno, si hay tareas
       bloqueadas en el selectivo me tienen que aparecer si o si"*. */
    const s7 = String(art.sku7 || '').trim();
    avisos.push({ sku7: s7, marca: art.marca || '', pares: tr.pares,
                  tipo: tr.tipo || 'sin-cuerpo-libre', motivo: tr.motivo || '',
                  zona: tr.zona || '', faltan: tr.faltan || 0 });
    if (tr.tipo !== 'cuerpo-sucio') return;

    (tr.mezclados || []).forEach(m => {
      const k = zonasService.nombreCuerpo(m.zona, m.columna, m.cuerpo);
      (m.otros || []).forEach(intruso => {
        const clave = k + '|' + intruso;
        // Si el barrido ya la encontró, se le agrega la prioridad en vez de duplicarla:
        // el operario no puede recibir dos veces la misma mercadería.
        const previa = yaEnLinea.get(clave);
        if (previa) {
          previa.prioridad = true;
          previa.destraba = [...(previa.destraba || []), { sku7: s7, pares: tr.pares }];
          return;
        }
        const enElCuerpo = cuerpos.get(k);
        const pares = Math.round((enElCuerpo && enElCuerpo.m.get(intruso)) || 0);
        if (!pares) return;
        const d = destinoDe(intruso, k, pares);
        if (!d) return;   // sin destino no sale: se le devolvería la decisión al operario
        const f = ficha.get(intruso) || {};
        const nueva = {
          ubi: k, sku7: intruso, pares,
          marca: f.marca || '', temporada: f.temporada || '',
          dueno: s7, duenoPares: tr.pares,
          llevarA: d.destino, motivo: d.motivo,
          detalle: (detallePorArt.get(`${k}|${intruso}`) || [])
            .slice().sort((a, b) => String(a.ubi).localeCompare(String(b.ubi))
                                 || (parseFloat(a.talla) || 0) - (parseFloat(b.talla) || 0)),
          vinoPorTarea: false, duenoPorTarea: true,
          prioridad: true, destraba: [{ sku7: s7, pares: tr.pares }]
        };
        lineas.push(nueva);
        yaEnLinea.set(clave, nueva);
      });
    });
  }));

  if (avisos.length) {
    console.log(`[Slotting] ${avisos.length} artículo(s) de almacenaje trabados, `
              + `${avisos.reduce((a, x) => a + x.pares, 0)} pares parados en el buffer.`);
  }
  if (trabasViejas) {
    console.log(`[Slotting] ${trabasViejas} traba(s) de jornadas anteriores no se tuvieron `
              + `en cuenta: solo entra lo de ${jornadaHoy}.`);
  }

  const corrida = await slottingService.publicarCorrida(getLogicalDate(), lineas, zonas.join('+'), avisos);
  return { ...corrida, retenidas };
};
