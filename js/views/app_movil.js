/* ═══════════════════════════════════════════════════════════════════════════════════════
 *  LA APP DEL CELULAR  ·  su propia cara, no la web metida en un telefono
 *  ───────────────────────────────────────────────────────────────────────────────────────
 *  Daniel lo corrigio dos veces el 15-ago-2026: *"no quiero la web en un telefono, quiero
 *  una app aparte con su propia cara, mas limpia que la web"*. Y el 12-sep, al instalar la
 *  plataforma en su PC y ver la misma web adentro de una ventana: *"NO ENTIENDO, que es
 *  esto? yo quiero un APP para celular"*. Tenia razon: el manifiesto y el ayudante son el
 *  envase; ESTA es la app.
 *
 *  LAS SEIS REGLAS DE LA MAQUETA APROBADA, que no se negocian:
 *    1. UN numero grande por pantalla, no doce.
 *    2. Nada de tablas: filas de dos lineas, lo que importa arriba y el resto en gris.
 *    3. El estado se ve por color y por forma, no solo por texto.
 *    4. FONDO CLARO. La web es azul oscuro y en el almacen va bien, pero un chofer en la
 *       calle a mediodia no ve una pantalla oscura. Por eso la app NO sigue los temas.
 *    5. Botones grandes: se tocan de pie, con una mano y a veces con guantes.
 *    6. Cinco secciones abajo como maximo. Nada de menus dentro de menus.
 *
 *  DOS PERFILES, UN SOLO LOGIN. Oficina -jefe, supervisor, encargado- con cinco secciones,
 *  y transportista con dos. Lo decide el rol que ya tiene la persona en la plataforma.
 *  Por ahora se dibuja el de oficina; el del chofer llega con Despacho unificado.
 *
 *  DE DONDE SALEN LOS NUMEROS. De las MISMAS areas que ya baja la plataforma
 *  (`almacenaje_tasks`, `attendance`, `workers`): no se inventa ningun calculo nuevo ni se
 *  pide nada aparte al servidor.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

import * as adminService from '../services_v245/adminService.js?v=29.0764';
import * as jornadaService from '../services_v245/jornadaService.js?v=29.0764';
const BASE_API = (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com') + '/api/logistics';

import { armarLista, nombreCorto, nombreCompleto, claveDeOrden, iniciales } from '../services_v245/asistencia_comunes.js?v=29.0764';
import * as tareasComunes from '../services_v245/tareas_comunes.js?v=29.0764';
import * as metasService from '../services_v245/metasService.js?v=29.0764';
/* EL TEMA ES EL MISMO DE LA PLATAFORMA, no uno aparte del celular: se guarda por usuario
   y se comparte con la web. Si tuviera el suyo, alguien lo cambiaria en un sitio y
   seguiria viendo el otro en el otro. */
import * as temaService from '../services_v245/temaService.js?v=29.0764';
/* EL REPORTE QUE SE COMPARTE DESDE TAREAS. Las cuentas salen de aqui, el mismo modulo que
   usan el tablero y el portal publico: no hay una tercera version del calculo. */
import { datosMarcas, armarTurnoDe } from '../reportes/marcas.js?v=29.0764';
import { marcaCorta } from '../services_v245/reportesComunes.js?v=29.0764';
/* EL CHAT ES EL MISMO DE LA WEB. De aqui salen las salas, los mensajes, los leidos y la
   presencia: leer algo en el celular lo deja leido en la PC. La app solo dibuja. */
import { arrancarDatosDelChat, alCambiarElChat, estadoDelChat, mandar, mandarConAdjunto,
         bajarSala, marcarLeida, sinLeer, sinLeerTotal, enLinea, nombreDe, crearDirecta,
         iniciales as inicialesChat, nombreDeSala, salaDe, activos, horaCorta, diaDe,
         traerAdjunto, pesoLegible } from '../chat.js?v=29.0764';

/* ── LA PALETA DE LA APP ─────────────────────────────────────────────────────────────────
   Es la de la maqueta aprobada y a proposito NO son las variables de los temas: la app va
   clara siempre, tambien cuando la web esta en el tema Negro. */
/* OJO AL EDITAR: todo esto vive dentro de un TEMPLATE LITERAL, asi que un backtick
   en un comentario lo CORTA y la app deja de cargar entera. Paso tres veces el
   12-sep-2026. Para citar una propiedad o un valor, comillas simples. */
const CSS = `
#app-movil {
  --am-papel: #EEF2F1; --am-carta: #FFFFFF; --am-linea: #DCE4E2;
  --am-tinta: #131C1F; --am-suave: #4A5D63; --am-tenue: #6C7B80;
  --am-va: #0B5F52;  --am-va-agua: #E0EFEC;
  --am-curso: #B26A00; --am-curso-agua: #F8EEDC;
  --am-tarde: #98302E; --am-tarde-agua: #F7E6E5;
  --am-quieto: #6C7B80; --am-quieto-agua: #ECF0F0;
  --am-ui: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --am-num: "Cascadia Mono", ui-monospace, "SF Mono", Consolas, monospace;

  position: fixed; inset: 0; z-index: 10;
  background: var(--am-papel); color: var(--am-tinta);
  font-family: var(--am-ui); font-size: 14px; line-height: 1.45;
  display: grid; grid-template-rows: auto 1fr auto auto; grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
}
/* CADA UNO ANCLADO A SU FILA. Sin esto, esconder la cabecera dentro de una conversacion
   corre todo hacia arriba -un 'display:none' no ocupa su fila- y la barra de abajo cae en
   la fila elastica: media pantalla de barra. Lo vio Daniel en beta. */
#app-movil > .am-cab { grid-row: 1; }
#app-movil > .am-cuerpo { grid-row: 2; }
#app-movil > .am-barra { grid-row: 3; }
#app-movil > .am-capa-menu { grid-row: 4; }
#app-movil * { box-sizing: border-box; }

#app-movil .am-cab > * { display: block; width: min(100%, 560px); margin-inline: auto; }
#app-movil .am-cab-fila { display: flex; align-items: center; justify-content: space-between;
  gap: .6rem; }
#app-movil .am-cab { padding: calc(0.7rem + env(safe-area-inset-top)) 1.1rem 0.8rem;
  background: var(--am-papel); border-bottom: 1px solid var(--am-linea); }
#app-movil .am-cab .sub { font-family: var(--am-num); font-size: 0.7rem; letter-spacing: .04em;
  text-transform: uppercase; color: var(--am-tenue); }
#app-movil .am-cab .ttl { font-size: 1.12rem; font-weight: 750; letter-spacing: -0.015em; }

/* AUNQUE LA VENTANA SEA ANCHA, LA APP SE QUEDA DEL ANCHO DE UN TELEFONO. Estirada, las
   tres columnas se separaban: el nombre solo a la izquierda y los botones y el motivo
   pegados a la derecha. Es una app de celular; se centra y se queda en su ancho. */
#app-movil .am-cuerpo { overflow-y: auto; -webkit-overflow-scrolling: touch;
  width: min(100%, 560px); margin-inline: auto;
  padding: 0.9rem 0.8rem 1.4rem; display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }

#app-movil .am-tarjeta { background: var(--am-carta); border: 1px solid var(--am-linea);
  border-radius: 12px; padding: 0.85rem 0.95rem; display: flex; flex-direction: column; gap: 0.35rem; }
#app-movil .am-grande { font-family: var(--am-num); font-variant-numeric: tabular-nums;
  font-size: 2.5rem; font-weight: 700; line-height: 1; letter-spacing: -0.03em; color: var(--am-va); }
#app-movil .am-rotulo { font-size: 0.7rem; font-family: var(--am-num); letter-spacing: .1em;
  text-transform: uppercase; color: var(--am-tenue); }
#app-movil .am-barrita { height: 7px; background: #E2EAE8; border-radius: 4px; overflow: hidden; margin-top: .35rem; }
#app-movil .am-barrita > i { display: block; height: 100%; background: var(--am-va); border-radius: 4px; }
#app-movil .am-pie { font-size: .72rem; color: var(--am-tenue); }

#app-movil .am-tres { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.55rem; }
#app-movil .am-tres .am-tarjeta { padding: 0.7rem 0.6rem; gap: 0.15rem; }
#app-movil .am-tres .n { font-family: var(--am-num); font-variant-numeric: tabular-nums;
  font-size: 1.32rem; font-weight: 700; line-height: 1.1; }
#app-movil .am-tres .l { font-size: 0.62rem; color: var(--am-tenue); line-height: 1.25; }

#app-movil .am-seccion { font-family: var(--am-num); font-size: 0.63rem; letter-spacing: .12em;
  text-transform: uppercase; color: var(--am-tenue); font-weight: 700; margin-top: 0.3rem; }

#app-movil .am-fila { background: var(--am-carta); border: 1px solid var(--am-linea); border-radius: 11px;
  padding: 0.7rem 0.85rem; display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
#app-movil .am-fila .cinta { width: 3px; align-self: stretch; border-radius: 2px; flex-shrink: 0; }
#app-movil .am-fila .medio { flex: 1; min-width: 0; }
/* display:block en los dos: como spans sueltos, el titulo y el detalle salian pegados en la
   misma linea -"Cada robot que correComo le fue..."-. */
#app-movil .am-fila .t { display: block; font-weight: 640; font-size: 0.87rem; letter-spacing: -0.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-fila .d { display: block; font-size: 0.72rem; color: var(--am-tenue); line-height: 1.35; }
/* LA LETRA DE LA ETIQUETA ES LA DEL TEMA. El color va en el tinte y en el borde: si la
   letra tambien lleva el color, texto y fondo son el mismo tono y no se lee -1.64 : 1 en
   Indigo, medido-. Asi las cuatro etiquetas se leen en los cuatro temas sin afinar nada. */
#app-movil .am-chapa { color: var(--am-tinta); border: 1px solid transparent;
  font-family: var(--am-num); font-size: 0.58rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; padding: 0.2rem 0.45rem; border-radius: 3px; white-space: nowrap; }
#app-movil .ch-va { background: var(--am-va-agua); border-color: var(--am-va); }
#app-movil .ch-curso { background: var(--am-curso-agua); border-color: var(--am-curso); }
#app-movil .ch-tarde { background: var(--am-tarde-agua); border-color: var(--am-tarde); }
#app-movil .ch-quieto { background: var(--am-quieto-agua); border-color: var(--am-quieto); }

#app-movil .am-vacio { text-align: center; color: var(--am-tenue); font-size: .85rem; padding: 1.4rem 0.5rem; }
#app-movil .am-pronto { background: var(--am-carta); border: 1px dashed #C2CFCC; border-radius: 12px;
  padding: 1.6rem 1.1rem; text-align: center; display: flex; flex-direction: column; gap: .5rem; }
#app-movil .am-pronto .ic { font-size: 1.6rem; }
#app-movil .am-pronto .q { font-weight: 700; }
#app-movil .am-pronto .p { font-size: .82rem; color: var(--am-tenue); }

#app-movil .am-salida { background: none; border: 0; color: var(--am-tenue); font-family: var(--am-ui);
  font-size: .78rem; text-decoration: underline; cursor: pointer; padding: .6rem; align-self: center; }

/* ── TAREAS ───────────────────────────────────────────────────────────────────────────
   Maqueta aprobada el 12-sep-2026. La lista se queda LIMPIA -numero, marca, etiqueta y
   cantidad- y todo lo demas aparece al tocar el registro. Daniel: *"que no se acumulen
   tantas cosas en la pantalla, pero que lleve el corazon del modulo"*. */

/* EL RANGO DE FECHAS EN DOS COLUMNAS. En la web "Desde … hasta …" entra en una linea; en
   un telefono de 360 px no, y Daniel lo dijo: *"la fila esta muy larga"*. Mismo texto y
   mismo icono de trazo que 'selectorRango()', otra disposicion. */
#app-movil .am-rango { display: grid; grid-template-columns: auto 1fr 1fr; align-items: center;
  gap: 0.2rem 0.7rem; background: var(--am-carta); border: 1px solid var(--am-linea);
  border-radius: 10px; padding: 0.45rem 0.7rem; }
#app-movil .am-rango > svg { grid-row: 1 / 3; width: 16px; height: 16px; color: var(--am-va); }
#app-movil .am-rango .eti { font-size: 0.6rem; font-weight: 800; letter-spacing: .05em;
  text-transform: uppercase; color: var(--am-tenue); }
#app-movil .am-rango input { background: transparent; border: 0; padding: 0; width: 100%;
  font-family: var(--am-num); font-size: 0.82rem; font-weight: 700; color: var(--am-tinta);
  outline: none; color-scheme: light; }

#app-movil .am-tira { display: flex; gap: .4rem; align-items: center; }
#app-movil .am-compartir { margin-left: auto; width: 34px; height: 34px; border-radius: 9px;
  flex: none; border: 1px solid var(--am-va); background: var(--am-va-agua); color: var(--am-va);
  display: grid; place-items: center; cursor: pointer; }
#app-movil .am-compartir svg { width: 17px; height: 17px; display: block; }
#app-movil .am-filtro { font-family: var(--am-num); font-size: 0.63rem; letter-spacing: .05em;
  text-transform: uppercase; padding: .32rem .6rem; border-radius: 20px;
  border: 1px solid var(--am-linea); background: var(--am-carta); color: var(--am-tenue);
  font-weight: 700; cursor: pointer; }
#app-movil .am-filtro[aria-pressed="true"] { background: var(--am-relleno);
  border-color: var(--am-relleno); color: var(--am-sobre); }

/* LA FILA. El borde izquierdo repite el estado en FORMA, no solo en color: es la regla 3
   de la maqueta y lo que salva a quien no distingue verde de rojo. */
#app-movil .am-tarea { display: grid; grid-template-columns: auto 1fr auto auto;
  align-items: center; gap: .7rem; background: var(--am-carta);
  border: 1px solid var(--am-linea); border-left: 3px solid #B6C2C0; border-radius: 10px;
  padding: .62rem .7rem; width: 100%; text-align: left; font-family: var(--am-ui);
  color: inherit; cursor: pointer; }
#app-movil .am-tarea.curso { border-left-color: var(--am-curso); }
#app-movil .am-tarea.fin { border-left-color: var(--am-va); }
#app-movil .am-tarea.malo { border-left-color: var(--am-tarde); }
#app-movil .am-tarea .n { font-family: var(--am-num); font-size: .78rem; font-weight: 700;
  color: var(--am-tenue); min-width: 2.4ch; }
/* La marca se recorta si hace falta; la etiqueta NUNCA, que es la que dice como va. */
#app-movil .am-tarea .m { display: flex; align-items: center; gap: .4rem; min-width: 0; }
#app-movil .am-tarea .m > .txt { font-size: .9rem; font-weight: 600; color: var(--am-tinta);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-tarea .m > .am-chapa { flex: none; }
#app-movil .am-tarea .q { font-family: var(--am-num); font-variant-numeric: tabular-nums;
  font-size: .95rem; font-weight: 700; color: var(--am-tinta); }
#app-movil .am-tarea .q i { font-style: normal; font-size: .62rem; color: var(--am-tenue);
  margin-left: .15rem; }
#app-movil .am-tarea .v { color: var(--am-linea); font-size: 1rem; line-height: 1; }
#app-movil .am-tarea .quien { grid-column: 2 / 5; font-family: var(--am-num);
  font-size: .62rem; margin-top: -.15rem; color: var(--am-curso); }
#app-movil .am-tarea.fin .quien { color: var(--am-va); }
#app-movil .am-tarea.malo .quien { color: var(--am-tarde); }
#app-movil .am-chapa.ch-mal { background: var(--am-tarde-agua); border-color: var(--am-tarde); }

/* ── LA HOJA DEL REGISTRO ────────────────────────────────────────────────────────────── */
#app-movil .am-velo { position: fixed; inset: 0; background: rgba(19,28,31,.45);
  display: flex; align-items: flex-end; z-index: 40; }
#app-movil .am-hoja { background: var(--am-carta); border-radius: 16px 16px 0 0; width: 100%;
  max-width: 560px; margin-inline: auto; padding: .5rem .9rem 1.2rem; max-height: 92vh;
  overflow-y: auto; }
#app-movil .am-asa { width: 34px; height: 4px; background: var(--am-linea); border-radius: 2px;
  margin: .1rem auto .7rem; }
#app-movil .am-quees { display: flex; align-items: center; justify-content: space-between;
  gap: .5rem; border-bottom: 1px solid var(--am-linea); padding-bottom: .6rem;
  margin-bottom: .7rem; }
#app-movil .am-quees b { font-size: 1.05rem; color: var(--am-tinta); }
#app-movil .am-quees .dia { font-family: var(--am-num); font-size: .66rem;
  color: var(--am-tenue); margin-left: auto; }

#app-movil .am-tres3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .42rem;
  margin-bottom: .8rem; }
#app-movil .am-tres3 > div { background: var(--am-papel); border-radius: 9px;
  padding: .42rem .5rem; min-width: 0; }
#app-movil .am-tres3 .l { font-family: var(--am-num); font-size: .53rem; letter-spacing: .1em;
  text-transform: uppercase; color: var(--am-tenue); }
#app-movil .am-tres3 .v { font-family: var(--am-num); font-size: .9rem; font-weight: 700;
  color: var(--am-tinta); font-variant-numeric: tabular-nums; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-tres3 .v.chico { font-size: .72rem; }

/* EL OBJETIVO va aparte y con color porque es la unica linea que JUZGA el trabajo;
   mezclarla con marca y cantidad -que son datos- la esconderia. */
#app-movil .am-objetivo { display: grid; grid-template-columns: auto 1fr; gap: 0 .55rem;
  align-items: baseline; border-radius: 9px; padding: .45rem .6rem; margin-bottom: .8rem; }
#app-movil .am-objetivo .l { font-family: var(--am-num); font-size: .53rem; letter-spacing: .1em;
  text-transform: uppercase; opacity: .75; }
#app-movil .am-objetivo .v { font-family: var(--am-num); font-size: .88rem; font-weight: 700; }
#app-movil .am-objetivo .d { grid-column: 1 / 3; font-family: var(--am-num); font-size: .62rem;
  opacity: .75; margin-top: .1rem; }
#app-movil .am-objetivo.si { background: var(--am-va-agua); color: var(--am-va); }
#app-movil .am-objetivo.no { background: var(--am-tarde-agua); color: var(--am-tarde); }
#app-movil .am-objetivo.sin { background: var(--am-papel); color: var(--am-tenue); }

#app-movil .am-campo { margin-bottom: .6rem; }
#app-movil .am-campo label { display: block; font-family: var(--am-num); font-size: .58rem;
  letter-spacing: .1em; text-transform: uppercase; color: var(--am-tenue);
  margin-bottom: .25rem; }
#app-movil .am-campo select, #app-movil .am-campo input[type="time"] { width: 100%;
  font-family: var(--am-ui); font-size: .9rem; font-weight: 600; padding: .55rem;
  border: 1px solid var(--am-linea); border-radius: 9px; background: var(--am-carta);
  color: var(--am-tinta); color-scheme: light; }
#app-movil .am-campo input[type="time"] { font-family: var(--am-num); font-weight: 700; }
#app-movil .am-par { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }

#app-movil .am-botones { display: flex; gap: .45rem; margin-top: .8rem; }
#app-movil .am-btn { flex: 1; padding: .72rem .5rem; border-radius: 10px; border: 0;
  font-family: var(--am-ui); font-size: .86rem; font-weight: 700; cursor: pointer; }
#app-movil .am-btn.va { background: var(--am-relleno); color: var(--am-sobre); }
#app-movil .am-btn.linea { background: none; border: 1px solid var(--am-va); color: var(--am-va); }
#app-movil .am-btn.mala { background: var(--am-tarde); color: #fff; }
#app-movil .am-btn.avisa { background: var(--am-curso); color: #fff; }
#app-movil .am-btn.gris { background: none; border: 1px solid var(--am-linea); color: var(--am-suave); }
#app-movil .am-btn[disabled] { opacity: .5; cursor: default; }

/* DONDE VA CADA COSA, Y POR QUE. El pulgar cae en el CENTRO de la pantalla: ahi va SALIR,
   que es lo que se aprieta cien veces al dia. Reiniciar y Eliminar se van a la esquina
   derecha, lejos del recorrido del dedo. Daniel, 12-sep: *"por error su dedo no vaya a
   apretarlo y vayan a malograr la tarea"*. Las tres columnas dejan a Salir centrado de
   verdad, no centrado "entre los otros dos". */
#app-movil .am-acciones { display: grid; gap: .35rem; margin-top: .85rem; padding-top: .55rem;
  border-top: 1px solid var(--am-linea); }
#app-movil .am-acciones .der { display: flex; gap: .9rem; justify-content: flex-end; }
#app-movil .am-acc { background: none; border: 0; cursor: pointer; font-family: var(--am-ui);
  font-size: .76rem; font-weight: 650; color: var(--am-tenue); display: flex;
  align-items: center; gap: .3rem; padding: .3rem; }
#app-movil .am-acc[disabled] { opacity: .35; cursor: default; }
#app-movil .am-salir { background: none; border: 0; cursor: pointer; justify-self: center;
  font-family: var(--am-ui); font-size: .9rem; font-weight: 700; color: var(--am-tinta);
  padding: .45rem 1.6rem; display: flex; align-items: center; gap: .35rem; }

/* LA SEGUNDA PREGUNTA. Encima de la hoja, no en su lugar: al cancelar se vuelve exactamente
   a donde estaba, con lo que se hubiera escrito todavia puesto. */
#app-movil .am-confirma { position: fixed; inset: 0; background: rgba(19,28,31,.55);
  display: flex; align-items: center; justify-content: center; padding: 1.1rem; z-index: 50; }
#app-movil .am-tarjeta { background: var(--am-carta); border-radius: 14px;
  padding: 1.1rem 1rem .9rem; width: 100%; max-width: 340px;
  box-shadow: 0 10px 30px rgba(19,28,31,.25); }
#app-movil .am-tarjeta h5 { margin: 0 0 .5rem; font-family: var(--am-num); font-size: .66rem;
  letter-spacing: .12em; text-transform: uppercase; font-weight: 700; }
#app-movil .am-tarjeta h5.aviso { color: var(--am-curso); }
#app-movil .am-tarjeta h5.malo { color: var(--am-tarde); }
#app-movil .am-tarjeta p { margin: 0 0 .3rem; font-size: .9rem; color: var(--am-tinta);
  line-height: 1.45; }
#app-movil .am-tarjeta p.menor { font-size: .8rem; color: var(--am-suave); }

/* -- EL CHAT -----------------------------------------------------------------------------
   Maqueta aprobada el 13-sep-2026. Ni un color escrito a mano: todos salen de los tokens,
   que es lo unico que hace que se lea en los cuatro temas. */
#app-movil .am-buscar { display: flex; align-items: center; gap: .5rem; background: var(--am-carta);
  border: 1px solid var(--am-linea); border-radius: 10px; padding: .48rem .65rem; flex: none; }
#app-movil .am-buscar svg { width: 15px; height: 15px; color: var(--am-tenue); flex: none; }
#app-movil .am-buscar input { border: 0; background: transparent; outline: none; width: 100%;
  font-family: var(--am-ui); font-size: .88rem; color: var(--am-tinta); }

/* LA INICIAL, con la bolita de quien esta ahora. Es la misma presencia de la web. */
#app-movil .am-ini { width: 38px; height: 38px; border-radius: 50%; display: grid;
  place-items: center; background: var(--am-va-agua); color: var(--am-va);
  font-family: var(--am-num); font-size: .76rem; font-weight: 700; position: relative; flex: none; }
#app-movil .am-ini.grupo { background: var(--am-curso-agua); color: var(--am-curso); }
#app-movil .am-ini.en-linea::after { content: ''; position: absolute; right: -1px; bottom: -1px;
  width: 11px; height: 11px; border-radius: 50%; background: #22A06B;
  border: 2px solid var(--am-carta); }

#app-movil .am-conv, #app-movil .am-persona-chat { display: grid;
  grid-template-columns: auto 1fr auto; gap: .65rem; align-items: center;
  background: var(--am-carta); border: 1px solid var(--am-linea); border-radius: 12px;
  padding: .55rem .65rem; width: 100%; text-align: left; font-family: var(--am-ui);
  color: var(--am-tinta); cursor: pointer; }
#app-movil .am-conv .medio, #app-movil .am-persona-chat > span:nth-child(2) { min-width: 0; }
#app-movil .am-conv .nm, #app-movil .am-persona-chat .nm { display: block; font-size: .92rem;
  font-weight: 650; color: var(--am-tinta); overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
#app-movil .am-conv .ult { display: block; font-size: .78rem; color: var(--am-tenue);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-persona-chat .rol { display: block; font-family: var(--am-num); font-size: .6rem;
  color: var(--am-tenue); text-transform: uppercase; letter-spacing: .05em; }
#app-movil .am-persona-chat .est { font-family: var(--am-num); font-size: .58rem; color: var(--am-va); }
#app-movil .am-conv .der { display: flex; flex-direction: column; align-items: flex-end;
  gap: .2rem; flex: none; }
#app-movil .am-conv .hora { font-family: var(--am-num); font-size: .62rem; color: var(--am-tenue); }
#app-movil .am-globo { min-width: 19px; height: 19px; padding: 0 .32rem; border-radius: 10px;
  background: var(--am-relleno); color: var(--am-sobre); font-family: var(--am-num);
  font-size: .62rem; font-weight: 700; display: grid; place-items: center; }

/* -- ADENTRO DE UNA CONVERSACION ---------------------------------------------------------
   Ocupa la pantalla: sin cabecera de la app y sin relleno del cuerpo. En un telefono, un
   chat con marco alrededor desperdicia media pantalla. */
#app-movil.en-conversacion .am-cab { display: none; }
#app-movil.en-conversacion .am-cuerpo { padding: 0; gap: 0; }
#app-movil .am-cab-conv { display: flex; align-items: center; gap: .55rem; padding: .55rem .7rem;
  background: var(--am-papel); border-bottom: 1px solid var(--am-linea); flex: none; }
#app-movil .am-volver { background: none; border: 0; cursor: pointer; color: var(--am-suave);
  display: grid; place-items: center; padding: .2rem; }
#app-movil .am-volver svg { width: 20px; height: 20px; }
#app-movil .am-cab-conv .quien { min-width: 0; }
#app-movil .am-cab-conv .quien b { display: block; font-size: .95rem; color: var(--am-tinta);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-cab-conv .quien span { display: block; font-family: var(--am-num);
  font-size: .62rem; color: var(--am-va); }
#app-movil .am-cab-conv .quien span.off { color: var(--am-tenue); }

#app-movil .am-charla { flex: 1; overflow-y: auto; padding: .7rem .65rem; display: flex;
  flex-direction: column; gap: .3rem; }
#app-movil .am-charla::-webkit-scrollbar { width: 0 }
#app-movil .am-dia { align-self: center; font-family: var(--am-num); font-size: .58rem;
  letter-spacing: .08em; text-transform: uppercase; color: var(--am-tenue);
  background: var(--am-papel); padding: .2rem .6rem; border-radius: 10px; margin: .35rem 0; }
#app-movil .am-msg { max-width: 82%; padding: .45rem .65rem .3rem; border-radius: 12px;
  background: var(--am-carta); border: 1px solid var(--am-linea); align-self: flex-start; }
#app-movil .am-msg.mio { align-self: flex-end; background: var(--am-relleno);
  border-color: var(--am-relleno); }
#app-movil .am-msg .de { display: block; font-family: var(--am-num); font-size: .62rem;
  font-weight: 700; color: var(--am-va); margin-bottom: .1rem; }
#app-movil .am-msg .tx { font-size: .88rem; line-height: 1.35; color: var(--am-tinta);
  white-space: pre-wrap; word-break: break-word; }
#app-movil .am-msg.mio .tx { color: var(--am-sobre); }
#app-movil .am-msg.borrado .tx { color: var(--am-tenue); font-style: italic; }
#app-movil .am-msg .hr { display: block; text-align: right; font-family: var(--am-num);
  font-size: .56rem; color: var(--am-tenue); margin-top: .1rem; }
#app-movil .am-msg.mio .hr { color: var(--am-sobre); opacity: .7; }
#app-movil .am-msg .am-adj { display: flex; align-items: center; gap: .45rem; width: 100%;
  background: var(--am-papel); border: 0; border-radius: 8px; padding: .35rem .5rem;
  margin-bottom: .25rem; cursor: pointer; font-family: var(--am-ui); }
#app-movil .am-msg .am-adj svg { width: 16px; height: 16px; color: var(--am-suave); flex: none; }
#app-movil .am-msg .am-adj .nm { font-size: .76rem; color: var(--am-tinta); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-msg .am-adj .pz { font-family: var(--am-num); font-size: .58rem;
  color: var(--am-tenue); margin-left: auto; flex: none; }
#app-movil .am-foto-msg { display: block; width: 100%; border-radius: 8px;
  margin-bottom: .25rem; background: var(--am-papel); min-height: 40px; cursor: pointer; }

#app-movil .am-caja { display: flex; align-items: center; gap: .4rem; padding: .5rem .6rem;
  background: var(--am-carta); border-top: 1px solid var(--am-linea); flex: none; }
#app-movil .am-clip { width: 36px; height: 36px; border-radius: 10px; flex: none;
  border: 1px solid var(--am-linea); background: var(--am-papel); color: var(--am-suave);
  display: grid; place-items: center; cursor: pointer; }
#app-movil .am-clip svg { width: 18px; height: 18px; }
#app-movil .am-caja input { flex: 1; min-width: 0; border: 1px solid var(--am-linea);
  border-radius: 18px; padding: .5rem .8rem; font-family: var(--am-ui); font-size: .88rem;
  background: var(--am-papel); color: var(--am-tinta); outline: none; }
#app-movil .am-enviar { width: 36px; height: 36px; border-radius: 50%; border: 0; flex: none;
  background: var(--am-relleno); color: var(--am-sobre); display: grid; place-items: center;
  cursor: pointer; }
#app-movil .am-enviar svg { width: 17px; height: 17px; }

/* ── PASAR LISTA ─────────────────────────────────────────────────────────────────────── */
/* TRES COLUMNAS DE VERDAD, no una fila y otra debajo: quien | asistio o falto | motivo.
   La del motivo existe siempre -vacia en quien asistio- para que quede alineada de arriba
   abajo, que es lo que hace que se lea como columna y no como un remiendo. */
#app-movil .am-persona { background: var(--am-carta); border: 1px solid var(--am-linea);
  border-radius: 11px; padding: 0.5rem 0.5rem; display: grid;
  /* LAS TRES COLUMNAS, EXPLICITAS Y IGUALES A LAS DEL ENCABEZADO. Antes la del medio era
     'auto' -o sea, lo que midieran los botones- y la del nombre se quedaba con las sobras:
     salia "Barazorda, Jua…". Ahora el nombre se lleva todo lo que no esta reservado. */
  grid-template-columns: minmax(0, 1fr) 88px 68px; align-items: center;
  gap: 0.45rem; min-width: 0;
  /* La transicion va SOLO en el borde. Sobre 'background' no sirve: cuando el color sale
     de una variable y la variable cambia -al cambiar de tema-, el elemento se queda con
     el color viejo hasta que lo vuelvan a crear. */
  transition: border-color .15s ease; }
/* El tinte de quien falto, tambien por tema: #FDF7F7 es un rosa de papel blanco y sobre
   un fondo oscuro se veria como un parche. */
#app-movil .am-persona.falto { border-color: var(--am-tarde); background: var(--am-tarde-agua); }
#app-movil .am-persona .quien { min-width: 0; }
/* display:block en los dos: como span sueltos, el nombre y el DNI salian pegados en la
   misma linea -"Gian AlataDNI 74821779"- y el recorte con puntos suspensivos no aplicaba. */
#app-movil .am-persona .nm { display: block; font-weight: 650; font-size: 0.83rem; letter-spacing: -.008em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-persona .dni { display: block; font-family: var(--am-num); font-size: 0.64rem;
  color: var(--am-tenue); line-height: 1.3; }
#app-movil .am-persona .marcas { display: flex; gap: 0.22rem; min-width: 0; }
#app-movil .am-persona .marcas button { font-family: var(--am-ui); font-size: 0.66rem; font-weight: 700;
  padding: 0.42rem 0.15rem; border-radius: 8px; border: 1.5px solid var(--am-linea);
  background: var(--am-carta); color: var(--am-tenue); cursor: pointer;
  flex: 1; min-width: 0; }
#app-movil .am-persona .motivo { min-width: 0; }
#app-movil .am-persona .motivo select { width: 100%; font-family: var(--am-ui); font-size: 0.66rem;
  padding: 0.4rem 0.15rem; border-radius: 8px; border: 1px solid var(--am-tarde); background: var(--am-carta);
  color: var(--am-tinta); }
#app-movil .am-persona .motivo .nada { display: block; text-align: center; color: var(--am-linea); font-size: 0.8rem; }
#app-movil .am-persona .marcas button.si-vino { background: var(--am-relleno); border-color: var(--am-relleno); color: var(--am-sobre); }
#app-movil .am-persona .marcas button.si-falto { background: var(--am-tarde); border-color: var(--am-tarde); color: var(--am-papel); }
#app-movil .am-persona .marcas button:disabled { opacity: .55; cursor: default; }

/* La cabecera de la lista, con el nombre de cada columna: sin esto, dos botones y un
   desplegable sueltos no se leen como una tabla. */
/* EL BORDE TRANSPARENTE NO ES ADORNO: las filas llevan uno de 1px, y sin el aqui la
   columna elastica del encabezado mide 2px mas y los titulos quedan corridos. */
#app-movil .am-encabezado { display: grid; grid-template-columns: minmax(0, 1fr) 88px 68px;
  gap: 0.45rem; padding: 0 0.5rem; border: 1px solid transparent; font-family: var(--am-num); font-size: 0.56rem;
  letter-spacing: .08em; text-transform: uppercase; color: var(--am-tenue); font-weight: 700; }
#app-movil .am-encabezado .c2 { text-align: center; }
#app-movil .am-encabezado .c3 { text-align: center; }

/* EL RESUMEN: la cifra manda, el boton acompaña. */
#app-movil .am-resumen { display: grid; grid-template-columns: minmax(0, 1fr) auto;
  align-items: center; gap: 0.15rem 0.7rem; }
#app-movil .am-resumen .am-rotulo,
#app-movil .am-resumen .am-grande,
#app-movil .am-resumen .am-pie { grid-column: 1; }
#app-movil .am-resumen .acciones { grid-column: 2; grid-row: 1 / span 3;
  display: flex; align-items: center; gap: 0.4rem; }
#app-movil .am-chico { font-family: var(--am-ui); font-size: 0.82rem; font-weight: 680;
  padding: 0.5rem 0.85rem; border-radius: 9px; border: 1px solid var(--am-va);
  background: var(--am-carta); color: var(--am-va); cursor: pointer; white-space: nowrap; }
#app-movil .am-chico:disabled { border-color: var(--am-linea); color: var(--am-tenue); cursor: default; }
/* Los dos iconos miden lo mismo y se ven: antes la camara quedaba mas chica que el
   refrescar y Daniel la veia perdida. */
#app-movil .am-chico.solo-icono { width: 44px; height: 40px; padding: 0; display: grid;
  place-items: center; border-color: var(--am-linea); color: var(--am-suave); font-size: 1.25rem;
  line-height: 1; }
#app-movil .am-nota { font-size: .72rem; color: var(--am-tenue); text-align: center; margin: 0; padding: 0 .6rem; }
#app-movil .am-cerrada { background: var(--am-va-agua); border: 1px solid var(--am-va);
  color: var(--am-va); border-radius: 11px; padding: 0.85rem; text-align: center; font-weight: 700; }

#app-movil .am-boton { display: block; width: 100%; padding: 0.95rem; border-radius: 11px;
  border: 1px solid var(--am-relleno); background: var(--am-relleno); color: var(--am-sobre); font-family: var(--am-ui);
  font-size: 0.98rem; font-weight: 700; cursor: pointer; }
#app-movil .am-boton:disabled { background: #C9D4D2; border-color: #C9D4D2; color: #55666B; cursor: default; }
#app-movil .am-boton.fino { background: none; color: var(--am-va); font-size: .86rem; padding: .7rem;
  border-style: dashed; }

#app-movil .am-barra { display: flex; background: var(--am-carta); border-top: 1px solid var(--am-linea);
  padding: 0.4rem 0.25rem calc(0.55rem + env(safe-area-inset-bottom));
  width: min(100%, 560px); margin-inline: auto; }
#app-movil .am-barra button { flex: 1; min-width: 0; background: none; border: 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0.25rem 0.1rem;
  font-family: var(--am-ui); font-size: 0.58rem; font-weight: 650; color: var(--am-tenue);
  position: relative; }
#app-movil .am-barra button .gl { width: 22px; height: 22px; display: block; }
#app-movil .am-barra button .gl svg { width: 100%; height: 100%; display: block; }
#app-movil .am-barra button[aria-selected="true"] { color: var(--am-va); }
#app-movil .am-barra .punto { position: absolute; top: 2px; right: 50%; margin-right: -14px;
  width: 6px; height: 6px; border-radius: 50%; background: var(--am-tarde); }
/* ── LA BARRA DE ARRIBA Y SU MENU ────────────────────────────────────────────────────────
   Va en TODAS las pantallas, no solo en Inicio: ahi vive lo que no es un modulo. */
#app-movil .am-menu-btn { width: 38px; height: 38px; border-radius: 10px; flex: none;
  border: 1px solid var(--am-linea); background: var(--am-carta); color: var(--am-suave);
  display: grid; place-items: center; cursor: pointer; }
#app-movil .am-menu-btn svg { width: 19px; height: 19px; display: block; }
#app-movil .am-velo-menu { position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display: flex; align-items: flex-start; justify-content: flex-end; padding: .6rem;
  z-index: 60; }
#app-movil .am-panel { background: var(--am-carta); border: 1px solid var(--am-linea);
  border-radius: 14px; width: min(86%, 280px); overflow: hidden;
  box-shadow: 0 12px 34px rgba(0,0,0,.35); max-height: 88vh; overflow-y: auto; }
#app-movil .am-panel .gr { font-family: var(--am-num); font-size: .55rem; letter-spacing: .12em;
  text-transform: uppercase; color: var(--am-tenue); padding: .7rem .85rem .25rem; }
#app-movil .am-panel button { display: flex; align-items: center; gap: .6rem; width: 100%;
  padding: .68rem .85rem; font-family: var(--am-ui); font-size: .9rem; text-align: left;
  color: var(--am-tinta); background: none; border: 0; border-top: 1px solid var(--am-linea);
  cursor: pointer; }
#app-movil .am-panel button .ch { margin-left: auto; font-family: var(--am-num);
  font-size: .62rem; color: var(--am-tenue); }
#app-movil .am-panel button.sel { color: var(--am-va); font-weight: 700; }
#app-movil .am-panel button.sel .ch { color: var(--am-va); }
#app-movil .am-panel button svg { width: 16px; height: 16px; flex: none; }
#app-movil .am-muestra { width: 16px; height: 16px; border-radius: 5px; flex: none;
  border: 1px solid rgba(128,128,128,.4); }
#app-movil .am-panel .desc { display: block; font-size: .72rem; color: var(--am-tenue);
  font-weight: 400; margin-top: .1rem; }

/* ── LA APP SIGUE EL TEMA DE LA PLATAFORMA ───────────────────────────────────────────────
   Daniel, 12-sep-2026: *"la app tiene que adaptarse al tema"*. Cambia la regla 4 de la
   maqueta -fondo claro siempre-, que el mismo habia puesto pensando en el chofer al sol;
   queda dicho por si alguna vez hay que volver sobre eso.

   Los valores NO se eligen a ojo: son los de 'css/temas.css', tema por tema. Y el acento va
   partido en dos papeles porque en NEGRO '--primary' es blanco puro: '--am-va' es color de
   letra -tiene que leerse sobre la tarjeta- y '--am-relleno' es fondo de boton, con
   '--am-sobre' encima. Juntarlos da blanco sobre blanco, que ya paso en el chat.
   ────────────────────────────────────────────────────────────────────────────────────── */

/* ÍNDIGO — el de siempre, azul noche. Es tambien el que vale si no hay tema puesto. */
html[data-tema="indigo"] #app-movil, #app-movil {
  --am-papel: #0f172a; --am-carta: #1e293b; --am-linea: rgba(255,255,255,0.10);
  --am-tinta: #ffffff; --am-suave: #e2e8f0; --am-tenue: #94a3b8;
  --am-va: #818cf8;   --am-va-agua: rgba(129,140,248,0.16);
  --am-curso: #fbbf24; --am-curso-agua: rgba(251,191,36,0.15);
  --am-tarde: #f87171; --am-tarde-agua: rgba(248,113,113,0.15);
  --am-quieto: #94a3b8; --am-quieto-agua: rgba(148,163,184,0.14);
  --am-relleno: #4f46e5; --am-sobre: #ffffff;
}

/* GERENCIAL · POWER BI — claro, azul. */
html[data-tema="pbi"] #app-movil {
  --am-papel: #F3F2F1; --am-carta: #FFFFFF; --am-linea: #E1DFDD;
  --am-tinta: #201F1E; --am-suave: #323130; --am-tenue: #605E5C;
  --am-va: #0E76D6;   --am-va-agua: #DEECF9;
  --am-curso: #6E5B00; --am-curso-agua: #FFF4CE;
  --am-tarde: #A4262C; --am-tarde-agua: #FDE7E9;
  --am-quieto: #605E5C; --am-quieto-agua: #F3F2F1;
  --am-relleno: #0E76D6; --am-sobre: #FFFFFF;
}

/* POWER BI CLÁSICO — claro, verde azulado. */
html[data-tema="pbi-classic"] #app-movil {
  --am-papel: #F5F5F5; --am-carta: #FFFFFF; --am-linea: #E0E0E0;
  --am-tinta: #263133; --am-suave: #415255; --am-tenue: #5F6B6D;
  --am-va: #00847A;   --am-va-agua: #DDF0EE;
  --am-curso: #7F6907; --am-curso-agua: #FBF3D5;
  --am-tarde: #C54C49; --am-tarde-agua: #FBE6E5;
  --am-quieto: #5F6B6D; --am-quieto-agua: #EFEFEF;
  --am-relleno: #00847A; --am-sobre: #FFFFFF;
}

/* NEGRO — sin color. El acento es el blanco, y por eso el relleno NO puede serlo:
   '--btn-fill' del tema es #2A2A2A, que es lo que se usa de fondo. */
html[data-tema="negro"] #app-movil {
  --am-papel: #000000; --am-carta: #121212; --am-linea: #2A2A2A;
  --am-tinta: #FFFFFF; --am-suave: #C8C8C8; --am-tenue: #9A9A9A;
  --am-va: #FFFFFF;   --am-va-agua: #262626;
  --am-curso: #C39B45; --am-curso-agua: #2B2214;
  --am-tarde: #C7554D; --am-tarde-agua: #2B1917;
  --am-quieto: #9A9A9A; --am-quieto-agua: #1C1C1C;
  --am-relleno: #2A2A2A; --am-sobre: #FFFFFF;
}

/* El fondo de la app, que antes estaba clavado en el bloque de arriba. */
#app-movil { background: var(--am-papel); color: var(--am-tinta); }

`;

const ICONOS = {
    rayitas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>',
    volver: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    paleta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>',
    escritorio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/></svg>',
    puerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9.2 21v-6.4h5.6V21"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-5A8.3 8.3 0 0 1 4 11.5a8.4 8.4 0 0 1 8.5-8.4h.5A8.4 8.4 0 0 1 21 11z"/></svg>',
    reportes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9"/><path d="M9.3 20V4.5"/><path d="M14.7 20v-7.5"/><path d="M20 20V7"/></svg>',
    tareas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.4 12.2l2.4 2.4 4.8-5"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.6 20c0-3.2 2.4-5.2 5.4-5.2s5.4 2 5.4 5.2"/><path d="M17 11.5l1.7 1.7 3.1-3.3"/></svg>',
    avisos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.8a6 6 0 1 0-12 0c0 5.4-2 7-2 7h16s-2-1.6-2-7"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>'
};

/* El icono de compartir de siempre -tres puntos unidos-, dibujado y no puesto como emoji:
   asi se ve igual en todos los telefonos y a tono con los de la barra de abajo. Daniel:
   "ya no tiene sentido el icono de la camara, deberia estar un icono de compartir". */
const ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block"><circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="M8.3 10.8 15.7 6.8"/><path d="M8.3 13.2l7.4 4"/></svg>';

/* LA LLAVE PUBLICA DE LOS AVISOS. Es publica a proposito: identifica al servidor que manda
   y no sirve para mandar nada. La privada vive SOLO en el servidor del almacen, como
   variable de maquina (`VAPID_PRIVADA`), nunca en el repositorio. */
const LLAVE_AVISOS = 'BE2dQmsJ0AvtY2ZSq9C3CqEvfv9zRkpyuJCz40uiUxkbemrIWHrF4JAopR0z4ZYw28zRpe-HW0goOTh1yIxbGQk';
const AREA_AVISOS = 'push_suscripciones';

const SECCIONES = [
    { id: 'inicio', rotulo: 'Inicio', icono: 'inicio' },
    /* EL CHAT VA ABAJO Y NO EN EL MENU: es lo que mas se toca en el dia y tiene que estar a
       un dedo. Ademas el globo de los no leidos solo sirve si se ve sin entrar. */
    { id: 'chat', rotulo: 'Chat', icono: 'chat' },
    { id: 'tareas', rotulo: 'Tareas', icono: 'tareas' },
    /* ABAJO, SOLO LOS MODULOS. Avisos y Temas se fueron al menu de arriba, y Reportes
       desaparecio: Daniel, 12-sep, *"ya estaria de mas el modulo de reportes"* — cada
       pantalla comparte lo suyo, asi que no hacia falta un sitio aparte para los cuadros. */
    { id: 'lista', rotulo: 'Asistencia', icono: 'lista' }
];

/* Lo que todavia no tiene pantalla. Se dice lo que va a haber, con nombre y todo: una
   seccion en blanco parece rota; una que avisa que esta en camino, no. */
const EN_CAMINO = {
    lista: ['Pasar lista del turno', 'Marcar P, T o F por cada persona con el pulgar. Se guarda en el mismo sitio que la lista de la web.'],
    avisos: ['Los avisos', 'Robot caído, tarea vencida, ruta demorada. Es lo único que empieza de cero: hace falta el envío desde el servidor y el permiso del teléfono.']
};

let raiz = null;
let seccion = 'inicio';
/* El menu de arriba: null cerrado, 'raiz' el primer nivel, 'temas' o 'avisos' ya dentro. */
let menu = null;
/* La ultima pantalla dibujada, para saber si hay que volver el scroll arriba o no. */
let _ultimaPintada = null;
let YO = null;
let alSalir = null;
let reloj = null;

const esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const numero = (n) => Math.round(Number(n) || 0).toLocaleString('es-PE');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La fecha del turno, escrita como la lee Daniel: "vie 12 sep". */
const diaEnLetras = () => {
    const f = jornadaService.fechaLogicaDe();          // nunca toISOString: es la fecha del turno
    const [a, m, d] = String(f).split('-').map(Number);
    const fecha = new Date(a, m - 1, d);
    return `${DIAS[fecha.getDay()].slice(0, 3)} ${d} ${MESES[m - 1]}`;
};

const saludo = () => {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 13) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
};

/* ── LOS NUMEROS DEL TURNO ───────────────────────────────────────────────────────────────
   Salen de las mismas areas que ya baja la plataforma. Nada nuevo que pedirle al servidor. */
const datosDelTurno = () => {
    const hoy = jornadaService.fechaLogicaDe();
    const tareas = (adminService.getAlmacenajeTasks() || []).filter(t => t && String(t.fecha) === String(hoy));

    const estado = (t) => String(t.status || t.estado || '').toLowerCase();
    const finalizadas = tareas.filter(t => estado(t).indexOf('finaliz') === 0).length;
    const vencidas = tareas.filter(t => estado(t).indexOf('vencid') === 0);
    const sinAsignar = tareas.filter(t => estado(t).indexOf('creada') === 0);
    const enCurso = tareas.filter(t => estado(t).indexOf('asignad') === 0);
    const abiertas = sinAsignar.length + enCurso.length;

    const lista = adminService.getAttendance(hoy);
    const marcados = Array.isArray(lista) ? lista.filter(x => x && (x.estado || x.status)).length : 0;
    const deTurno = Array.isArray(lista) ? lista.length : 0;

    return { tareas, finalizadas, vencidas, sinAsignar, enCurso, abiertas, marcados, deTurno };
};

const fila = (cinta, titulo, detalle, chapa) => `
    <div class="am-fila">
        <span class="cinta" style="background:${cinta}"></span>
        <span class="medio"><span class="t">${esc(titulo)}</span><span class="d">${esc(detalle)}</span></span>
        ${chapa ? `<span class="am-chapa ${chapa[1]}">${esc(chapa[0])}</span>` : ''}
    </div>`;

const pantallaInicio = () => {
    const d = datosDelTurno();
    const total = d.tareas.length;
    const pct = total ? Math.round((d.finalizadas / total) * 100) : 0;

    /* LO QUE NECESITA ATENCION, y en ese orden: primero lo vencido, que es lo que come
       stock, y despues lo que espera operario. */
    const atencion = []
        .concat(d.vencidas.slice(0, 4).map(t => fila('#98302E',
            `${t.id || 'Tarea'} · ${t.zona || t.destino || 'sin zona'}`,
            `${numero(t.cuerpos || t.cantidad || 0)} cuerpos · no se trabajó`, ['Vencida', 'ch-tarde'])))
        .concat(d.sinAsignar.slice(0, 4).map(t => fila('#B26A00',
            `${t.id || 'Tarea'} · ${t.zona || t.destino || 'sin zona'}`,
            `${numero(t.cuerpos || t.cantidad || 0)} cuerpos · espera operario`, ['Abierta', 'ch-curso'])));

    return `
        <div class="am-tarjeta">
            <span class="am-rotulo">Tareas cerradas del turno</span>
            <span class="am-grande">${pct}<span style="font-size:1.3rem">%</span></span>
            <div class="am-barrita"><i style="width:${pct}%"></i></div>
            <span class="am-pie">${numero(d.finalizadas)} de ${numero(total)} tareas${total ? '' : ' · todavía no se creó ninguna'}</span>
        </div>

        <div class="am-tres">
            <div class="am-tarjeta"><span class="n" style="color:#B26A00">${numero(d.abiertas)}</span><span class="l">Tareas abiertas</span></div>
            <div class="am-tarjeta"><span class="n" style="color:#0B5F52">${numero(d.marcados)}<span style="font-size:.8rem;color:#8B9B9F">/${numero(d.deTurno)}</span></span><span class="l">Asistencia</span></div>
            <div class="am-tarjeta"><span class="n" style="color:${d.vencidas.length ? '#98302E' : '#0B5F52'}">${numero(d.vencidas.length)}</span><span class="l">Vencidas</span></div>
        </div>

        <div class="am-seccion">Necesita tu atención</div>
        ${atencion.length ? atencion.join('') : '<div class="am-vacio">Nada pendiente ahora mismo.</div>'}

        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

const pantallaEnCamino = (id) => {
    const [que, detalle] = EN_CAMINO[id] || ['En camino', ''];
    return `
        <div class="am-pronto">
            <span class="ic">🚧</span>
            <span class="q">${esc(que)}</span>
            <span class="p">${esc(detalle)}</span>
        </div>
        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

/* ── TAREAS ──────────────────────────────────────────────────────────────────────────────
 *  Maqueta aprobada el 12-sep-2026, despues de tres vueltas suyas.
 *
 *  LA LISTA SE QUEDA LIMPIA: numero, marca con su etiqueta de estado, y cantidad. Todo lo
 *  demas -los operarios, las dos horas, el objetivo y las acciones- aparece AL TOCAR el
 *  registro. Daniel: *"en la pestaña de tareas debe estar limpia, sino que al apretar el
 *  registro me tiene que dar todos esos detalles"*.
 *
 *  NADA SE QUEDA EN EL CELULAR. Se escribe la MISMA tarea del area `almacenaje_tasks` que
 *  lee la web, con su mismo id, y por `saveAlmacenajeTasks(tarea)` -que viaja sola, por
 *  PATCH, sin pisar las demas-. Por eso al asignar desde el telefono se llenan solas, en la
 *  web, las columnas de usuarios, horas, productividad y objetivo. Es un registro visto
 *  desde dos pantallas, no dos sistemas que sincronizar.
 * ─────────────────────────────────────────────────────────────────────────────────────── */

/* EL RANGO ARRANCA EN HOY, SIEMPRE. Daniel: *"siempre que actualice la aplicacion tiene que
   estar con la fecha actual"*. Y si ese dia no hubo tareas, la pantalla dice "Sin tareas" y
   se queda vacia: *"no inventes nada"*. */
let tareasDesde = null;
let tareasHasta = null;
let tareasFiltro = 'sin';          // sin | curso | todas
let tareaAbierta = null;           // el id de la que tiene la hoja abierta
let tareaPregunta = null;          // 'reiniciar' | 'eliminar' mientras se confirma
let tareasGuardando = false;
let tareasBorrador = null;         // lo tecleado en la hoja, para no perderlo al repintar

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/* NUNCA `toISOString()`: devuelve UTC y a las 19:00 de Lima ya es el dia siguiente, justo
   cuando entra el turno noche. Es la regla de toda la plataforma. */
const hoyISO = () => jornadaService.fechaLogicaDe();

const fechaCorta = (iso) => {
    const p = String(iso || '').split('-').map(Number);
    if (p.length !== 3) return '';
    const d = new Date(p[0], p[1] - 1, p[2]);
    return `${DIA_CORTO[d.getDay()]} ${p[2]} ${MES_CORTO[p[1] - 1]}`;
};

const arrancarTareas = () => {
    if (!tareasDesde) { tareasDesde = hoyISO(); tareasHasta = hoyISO(); }
};

/** La meta que le toca a esta tarea. La resuelve el servicio, no esta pantalla. */
const metaDe = (t) => {
    const { familia, detalle } = tareasComunes.categoriaDeTarea(t);
    return metasService.resolverMeta(detalle, familia, t && t.fecha);
};

/** Como se ve el estado: etiqueta, color y el borde de la fila. */
const pintaEstado = (t) => {
    const st = String(t.status || '');
    if (st === 'Asignado') return { chapa: 'ch-curso', texto: 'ASIGNADO', clase: 'curso' };
    if (st === 'Finalizado') {
        /* FINALIZADO EN VERDE SI CUMPLIO, EN ROJO SI NO. La palabra es la misma; lo que
           cambia es el color. Y `null` -todavia no se sabe- nunca se pinta de rojo: una
           tarea sin terminar no fallo nada. */
        const obj = tareasComunes.objetivoDe(t, metaDe(t));
        return obj === 'NO_CUMPLIO'
            ? { chapa: 'ch-mal', texto: 'FINALIZADO', clase: 'malo' }
            : { chapa: 'ch-va', texto: 'FINALIZADO', clase: 'fin' };
    }
    if (st === 'Vencida') return { chapa: 'ch-tarde', texto: 'NO TRABAJADA', clase: 'malo' };
    return { chapa: 'ch-quieto', texto: 'CREADA', clase: '' };
};

const tareasEnRango = () => {
    arrancarTareas();
    return (adminService.getAlmacenajeTasks() || [])
        .filter(t => t && String(t.fecha) >= tareasDesde && String(t.fecha) <= tareasHasta)
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))
            || (numeroDe(a.id) - numeroDe(b.id)));
};

/** `2026-09-12_Tarea21` -> 21, para ordenar por numero y no alfabeticamente (Tarea10 < Tarea2). */
const numeroDe = (id) => {
    const m = String(id || '').match(/(\d+)\s*$/);
    return m ? Number(m[1]) : 0;
};

const CALENDARIO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
const ICO_REINICIAR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
const ICO_BORRAR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>';
const ICO_SALIR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

const pantallaTareas = () => {
    const todas = tareasEnRango();
    const grupos = {
        sin: todas.filter(t => String(t.status) === 'Creada'),
        curso: todas.filter(t => String(t.status) === 'Asignado'),
        todas
    };
    const lista = grupos[tareasFiltro] || todas;
    const rotulo = { sin: 'Sin asignar', curso: 'En curso', todas: 'Todas' }[tareasFiltro];
    const pares = lista.reduce((a, t) => a + (parseFloat(t.qty) || 0), 0);

    const filas = lista.map(t => {
        const E = pintaEstado(t);
        const ini = tareasComunes.horaCorta(t.inicio);
        const fin = tareasComunes.horaCorta(t.termino);
        const pie = t.u1 ? `${esc(t.u1)} + ${esc(t.u2 || '—')}`
            + (ini ? ` · ${ini}` : '') + (fin ? ` → ${fin}` : '') : '';
        return `
        <button type="button" class="am-tarea ${E.clase}" data-tarea="${esc(t.id)}">
            <span class="n">${numeroDe(t.id)}</span>
            <span class="m"><span class="txt">${esc(t.marca || 'Sin marca')}</span>
                <span class="am-chapa ${E.chapa}">${E.texto}</span></span>
            <span class="q">${numero(t.qty)}<i>prs</i></span>
            <span class="v">›</span>
            ${pie ? `<span class="quien">${pie}</span>` : ''}
        </button>`;
    }).join('');

    const capsula = (k, txt) => `
        <button type="button" class="am-filtro" data-filtro="${k}"
            aria-pressed="${k === tareasFiltro}">${txt} ${grupos[k].length}</button>`;

    return `
        <div class="am-rango">${CALENDARIO_SVG}
            <span class="eti">Desde</span><span class="eti">hasta</span>
            <input type="date" data-desde value="${tareasDesde}">
            <input type="date" data-hasta value="${tareasHasta}">
        </div>
        <div class="am-tira">
            ${capsula('sin', 'Sin asignar')}${capsula('curso', 'En curso')}${capsula('todas', 'Todas')}
            <!-- COMPARTIR: la pantalla va recortada porque es un telefono, pero lo que sale
                 es el reporte COMPLETO de la web, con el tema puesto. -->
            <button type="button" class="am-compartir" data-compartir-tareas
                aria-label="Compartir el reporte">${ICONO_COMPARTIR}</button>
        </div>
        ${lista.length ? `<div class="am-seccion">${rotulo}
            <span style="float:right; font-weight:400; letter-spacing:0; text-transform:none">${numero(pares)} pares</span></div>`
        : ''}
        ${lista.length ? filas : '<div class="am-vacio" style="font-weight:700; padding:3rem 1rem">Sin tareas</div>'}
    `;
};

/* ── LA HOJA DEL REGISTRO ───────────────────────────────────────────────────────────── */

const operarios = () => (adminService.getWorkers() || [])
    .filter(w => w && w.active)
    .map(w => ({ clave: tareasComunes.usuarioCorto(w), nombre: w.nombre || w.Nombre || '' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

const opcionesDe = (sel) => `<option value="">Elegir operario…</option>`
    + operarios().map(o => `<option value="${esc(o.clave)}" ${o.clave === sel ? 'selected' : ''}>${esc(o.clave)} (${esc(o.nombre)})</option>`).join('');

const hojaDeTarea = () => {
    const t = (adminService.getAlmacenajeTasks() || []).find(x => x && x.id === tareaAbierta);
    if (!t) return '';
    const E = pintaEstado(t);
    const meta = metaDe(t);
    const obj = tareasComunes.objetivoDe(t, meta);
    const esFin = String(t.status) === 'Finalizado';
    const b = tareasBorrador || {};
    const u1 = b.u1 !== undefined ? b.u1 : (t.u1 || '');
    const u2 = b.u2 !== undefined ? b.u2 : (t.u2 || '');
    const hi = b.hi !== undefined ? b.hi : tareasComunes.horaCorta(t.inicio);
    const hf = b.hf !== undefined ? b.hf : tareasComunes.horaCorta(t.termino);

    const permitido = Math.round(tareasComunes.minutosPermitidos(
        tareasComunes.avanceDeTarea(t) || (parseFloat(t.qty) || 0), meta));
    const principal = String(t.status) === 'Creada' ? 'Asignar e iniciar'
        : (String(t.status) === 'Asignado' ? 'Finalizar' : 'Guardar cambios');

    const pregunta = tareaPregunta ? tarjetaPregunta(t) : '';

    return `
    <div class="am-velo" data-velo>
      <div class="am-hoja">
        <div class="am-asa"></div>
        <div class="am-quees">
            <b>${esc(tareasComunes.numeroDeTarea(t.id))}</b>
            <span class="am-chapa ${E.chapa}">${E.texto}</span>
            <span class="dia">${fechaCorta(t.fecha)}</span>
        </div>

        <div class="am-tres3">
            <div><div class="l">Marca</div><div class="v chico">${esc(t.marca || '—')}</div></div>
            <div><div class="l">Cantidad</div><div class="v">${numero(t.qty)}</div></div>
            <div><div class="l">Tiempo</div><div class="v">${tareasComunes.tiempoHHMM(t) || '—'}</div></div>
        </div>

        <div class="am-objetivo ${obj === 'CUMPLIO' ? 'si' : (obj === 'NO_CUMPLIO' ? 'no' : 'sin')}">
            <span class="l">Objetivo</span>
            <span class="v">${obj === 'CUMPLIO' ? 'CUMPLIÓ' : (obj === 'NO_CUMPLIO' ? 'NO CUMPLIÓ' : '—')}</span>
            <span class="d">${obj ? `${numero(t.qty)} pares · permitido ${permitido} min`
                                  : 'se calcula al terminar'}</span>
        </div>

        <div class="am-campo"><label>Usuario 1 · obligatorio</label>
            <select data-u1>${opcionesDe(u1)}</select></div>
        <div class="am-campo"><label>Usuario 2 · obligatorio</label>
            <select data-u2>${opcionesDe(u2)}</select></div>

        <div class="am-par">
            <div class="am-campo"><label>Hora inicio</label>
                <input type="time" data-hi value="${hi}"></div>
            <div class="am-campo"><label>Hora término</label>
                <input type="time" data-hf value="${hf}"></div>
        </div>

        <div class="am-botones">
            <button type="button" class="am-btn va" data-principal ${tareasGuardando ? 'disabled' : ''}>
                ${tareasGuardando ? 'Guardando…' : principal}</button>
            ${String(t.status) === 'Asignado' ?
              `<button type="button" class="am-btn linea" data-guardar-tarea ${tareasGuardando ? 'disabled' : ''}>Guardar</button>` : ''}
        </div>

        <div class="am-acciones">
            <div class="der">
                <button type="button" class="am-acc" data-pide="reiniciar">${ICO_REINICIAR} Reiniciar</button>
                <button type="button" class="am-acc" data-pide="eliminar"
                    ${esFin && !esElAdministrador() ? 'disabled title="Solo dames puede eliminar una finalizada"' : ''}>
                    ${ICO_BORRAR} Eliminar</button>
            </div>
            <button type="button" class="am-salir" data-cerrar-hoja>${ICO_SALIR} Salir</button>
        </div>
      </div>
    </div>${pregunta}`;
};

/* LA SEGUNDA PREGUNTA. Los textos salen de `resetTask` y `deleteTask` del tablero; no son
   unos parecidos escritos de nuevo. Alla van en mayusculas de corrido: en un telefono eso
   se lee peor, asi que el titulo lleva la mayuscula y el cuerpo se lee como una frase. */
const tarjetaPregunta = (t) => {
    const n = tareasComunes.numeroDeTarea(t.id);
    const P = tareaPregunta === 'reiniciar'
        ? { clase: 'aviso', btn: 'avisa', titulo: 'Reiniciar tarea', si: 'Reiniciar',
            cuerpo: `¿Reiniciar la ${n}?`,
            menor: 'Se borrarán los usuarios y las horas asignadas.' }
        : { clase: 'malo', btn: 'mala', titulo: 'Eliminar tarea', si: 'Eliminar',
            cuerpo: `¿Estás seguro de eliminar la ${n}?`,
            menor: 'Esta acción es permanente y se borrará de todos los terminales.' };
    return `
    <div class="am-confirma" data-confirma>
      <div class="am-tarjeta">
        <h5 class="${P.clase}">${P.titulo}</h5>
        <p>${P.cuerpo}</p>
        <p class="menor">${P.menor}</p>
        <div class="am-botones">
            <button type="button" class="am-btn gris" data-no>Cancelar</button>
            <button type="button" class="am-btn ${P.btn}" data-si>${P.si}</button>
        </div>
      </div>
    </div>`;
};

/* ── GUARDAR ────────────────────────────────────────────────────────────────────────────
   LAS MISMAS VALIDACIONES DE LA WEB, no unas nuevas: dos operarios siempre -"toda tarea de
   almacenaje se trabaja en grupo de 2"-, nunca la misma persona dos veces, y si hay hora de
   termino tiene que haber hora de inicio. */
const leerBorrador = () => {
    if (!raiz) return;
    const q = (sel) => raiz.querySelector(sel);
    if (!q('[data-u1]')) return;
    tareasBorrador = {
        u1: q('[data-u1]').value, u2: q('[data-u2]').value,
        hi: q('[data-hi]').value, hf: q('[data-hf]').value
    };
};

const guardarTarea = async (accion) => {
    const t = (adminService.getAlmacenajeTasks() || []).find(x => x && x.id === tareaAbierta);
    if (!t || tareasGuardando) return;
    leerBorrador();
    const b = tareasBorrador || {};

    if (!b.u1 || !b.u2) {
        alert('Grupo incompleto.\n\nToda tarea de almacenaje se trabaja en grupo de 2: asigna Usuario 1 y Usuario 2.');
        return;
    }
    if (b.u1 === b.u2) { alert('Usuario 1 y Usuario 2 no pueden ser la misma persona.'); return; }
    if (b.hf && !b.hi) { alert('Si pones la hora de término, también tiene que ir la de inicio.'); return; }

    /* LA FECHA DE LAS HORAS ES LA DEL TRABAJO, no la del nacimiento de la tarea. Una tarea
       vive hasta 48 horas: con la suya, el turno de hoy trabajando una de ayer quedaria
       registrado como trabajo de ayer y el reporte del dia mostraria cero. */
    const jornada = hoyISO();
    const previo = { u1: t.u1, u2: t.u2, inicio: t.inicio, termino: t.termino, status: t.status };

    t.u1 = b.u1;
    t.u2 = b.u2;
    if (b.hi) t.inicio = tareasComunes.selloDeHora(b.hi, jornada);
    if (b.hf) t.termino = tareasComunes.selloDeHora(b.hf, jornada);
    if (accion === 'asignar') {
        t.status = 'Asignado';
        if (!t.inicio) t.inicio = tareasComunes.selloDeHora(horaDeAhora(), jornada);
    } else if (accion === 'finalizar') {
        if (!t.termino) t.termino = tareasComunes.selloDeHora(horaDeAhora(), jornada);
        t.status = 'Finalizado';
    }
    t._dirty = true;

    tareasGuardando = true;
    pintar();
    let ok = false;
    try { ok = await adminService.saveAlmacenajeTasks(t); } catch (e) { ok = false; }
    tareasGuardando = false;

    if (ok === false) {
        /* NO LLEGO: se deshace y se dice. Igual que en la web — dar por guardado lo que no
           llego es peor que fallar, porque nadie lo vuelve a mirar. */
        Object.assign(t, previo);
        pintar();
        alert('No se pudo guardar: el servidor no confirmó.\n\nRevisa la conexión y vuelve a intentarlo. La tarea sigue como estaba.');
        return;
    }
    tareasBorrador = null;
    tareaAbierta = null;
    pintar();
};

const horaDeAhora = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const reiniciarTarea = async () => {
    const t = (adminService.getAlmacenajeTasks() || []).find(x => x && x.id === tareaAbierta);
    if (!t) return;
    const previo = { u1: t.u1, u2: t.u2, inicio: t.inicio, termino: t.termino, status: t.status };
    t.u1 = null; t.u2 = null; t.inicio = null; t.termino = null; t.status = 'Creada';
    t.audited = false;
    t._dirty = true;
    tareasGuardando = true; pintar();
    let ok = false;
    try { ok = await adminService.saveAlmacenajeTasks(t); } catch (e) { ok = false; }
    tareasGuardando = false;
    if (ok === false) { Object.assign(t, previo); alert('No se pudo reiniciar: el servidor no confirmó.'); }
    tareasBorrador = null;
    tareaAbierta = null;
    pintar();
};

/* ELIMINAR SE HACE SOBRE LA LISTA DEL SERVIDOR, no sobre la de este telefono: si se subiera
   la copia local se irian con ella los cambios que otra pantalla haya hecho mientras tanto. */
const eliminarTarea = async () => {
    const id = tareaAbierta;
    if (!id) return;
    tareasGuardando = true; pintar();
    let ok = false;
    try {
        const frescas = await adminService.traerTareasFrescas();
        const quedan = (Array.isArray(frescas) ? frescas : adminService.getAlmacenajeTasks())
            .filter(x => x && x.id !== id);
        ok = await adminService.saveAlmacenajeTasks(quedan);
        if (ok !== false) adminService.adminStore.almacenaje_tasks = quedan;
    } catch (e) { ok = false; }
    tareasGuardando = false;
    if (ok === false) alert('No se pudo eliminar: el servidor no confirmó. La tarea sigue ahí.');
    tareasBorrador = null;
    tareaAbierta = null;
    pintar();
};

/* ── EL CHAT ─────────────────────────────────────────────────────────────────────────────
 *  Maqueta aprobada el 13-sep-2026. Daniel: *"la misma funcionalidad del chat en el app"*.
 *
 *  ES EL MISMO CHAT, NO OTRO. Las salas, los mensajes, los leidos y la presencia salen de
 *  `chat.js`, que sigue siendo el unico dueño de esas reglas: leer algo aca lo deja leido en
 *  su PC. Escribir un segundo chat para el telefono habria sido repetir el error que ya se
 *  pago con el reporte de marcas —dos copias de la misma cuenta que se separan—.
 *
 *  LO QUE SI CAMBIA ES LA FORMA. En la web el chat vive en burbujas flotando sobre el
 *  tablero, porque ahi se esta trabajando en otra cosa. En un telefono no hay sitio para
 *  ventanas: la conversacion ocupa la pantalla y se escribe con una mano.
 * ─────────────────────────────────────────────────────────────────────────────────────── */

let chatListo = false;        // ya se trajeron los datos en esta sesion
let chatSala = null;          // la conversacion abierta, o null en la lista
let chatBuscar = '';
let chatMandando = false;

/* Se pide UNA vez. `arrancarDatosDelChat` deja el latido andando y avisa por
   `alCambiarElChat` cada vez que llega algo, asi que la pantalla se refresca sola. */
const prepararChat = async () => {
    if (chatListo || !YO) return;
    chatListo = true;
    alCambiarElChat(() => { if (seccion === 'chat' || raiz) pintar(); });
    try { await arrancarDatosDelChat(YO); } catch (e) { console.warn('[APP] chat:', e && e.message); }
    pintar();
};

const ICO_LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ICO_VOLVER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const ICO_CLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7L10 17.8a1.7 1.7 0 0 1-2.4-2.4l7.8-7.9"/></svg>';
const ICO_ENVIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 16-8-6 8 6 8z"/></svg>';
const ICO_PAPEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';

/* El ultimo mensaje de una sala, para la vista previa de la lista. */
const ultimoDe = (id, mensajes) => ((mensajes[id] || []).slice(-1)[0]) || null;

const vistaPrevia = (m) => {
    if (!m) return 'Sin mensajes todavía';
    const mio = m.de === YO.username;
    const cuerpo = m.borrado ? 'Mensaje borrado'
        : (m.adjunto ? (m.adjunto.tipo === 'imagen' ? 'Foto' : (m.adjunto.nombre || 'Archivo'))
                     : String(m.texto || ''));
    return (mio ? 'Tú: ' : '') + cuerpo;
};

const pantallaChat = () => {
    const E = estadoDelChat();
    const q = chatBuscar.trim().toLowerCase();

    /* Las conversaciones, la del ultimo mensaje primero: es el orden de cualquier chat y
       el mismo que usa la web. */
    const salas = (E.salas || []).slice().sort((a, b) => {
        const ua = ultimoDe(a.id, E.mensajes), ub = ultimoDe(b.id, E.mensajes);
        return String((ub && ub.cuando) || '').localeCompare(String((ua && ua.cuando) || ''));
    }).filter(s => !q || nombreDeSala(s).toLowerCase().includes(q));

    const fila = (s) => {
        const otro = s.tipo === 'grupo' ? null
            : (s.miembros || []).filter(u => u !== YO.username)[0];
        const nombre = nombreDeSala(s);
        const m = ultimoDe(s.id, E.mensajes);
        const n = sinLeer(s.id);
        return `
        <button type="button" class="am-conv" data-sala="${esc(s.id)}">
            <span class="am-ini ${s.tipo === 'grupo' ? 'grupo' : ''} ${otro && enLinea(otro) ? 'en-linea' : ''}">${esc(inicialesChat(nombre))}</span>
            <span class="medio"><span class="nm">${esc(nombre)}</span>
                <span class="ult">${esc(vistaPrevia(m))}</span></span>
            <span class="der">
                <span class="hora">${m ? esc(horaCorta(m.cuando)) : ''}</span>
                ${n ? `<span class="am-globo">${n > 99 ? '99+' : n}</span>` : ''}</span>
        </button>`;
    };

    /* Con quien todavia no hay conversacion. `activos()` decide a quien se le puede
       escribir hoy; los dados de baja siguen teniendo nombre en los mensajes viejos. */
    const yaHablo = new Set((E.salas || []).flatMap(s => s.miembros || []));
    const nuevos = activos()
        .filter(p => p.username !== YO.username && !yaHablo.has(p.username))
        .filter(p => !q || nombreDe(p.username).toLowerCase().includes(q))
        .sort((a, b) => nombreDe(a.username).localeCompare(nombreDe(b.username), 'es'));

    return `
        <div class="am-buscar">${ICO_LUPA}
            <input type="search" data-chat-buscar value="${esc(chatBuscar)}"
                placeholder="Buscar una conversación…"></div>
        ${salas.length ? salas.map(fila).join('')
            : `<div class="am-vacio">${q ? 'Nada con ese nombre' : 'Todavía no tienes conversaciones'}</div>`}
        ${nuevos.length ? `<div class="am-seccion" style="margin-top:.7rem">Empezar una nueva</div>` : ''}
        ${nuevos.map(p => `
            <button type="button" class="am-persona-chat" data-nueva-con="${esc(p.username)}">
                <span class="am-ini ${enLinea(p.username) ? 'en-linea' : ''}">${esc(inicialesChat(nombreDe(p.username)))}</span>
                <span><span class="nm">${esc(nombreDe(p.username))}</span>
                    <span class="rol">${esc(p.role || '')}</span></span>
                <span class="est">${enLinea(p.username) ? 'en línea' : ''}</span>
            </button>`).join('')}
    `;
};

/* ── ADENTRO DE UNA CONVERSACION ─────────────────────────────────────────────────────── */
const pantallaConversacion = () => {
    const E = estadoDelChat();
    const s = salaDe(chatSala);
    if (!s) { chatSala = null; return pantallaChat(); }
    const otro = s.tipo === 'grupo' ? null : (s.miembros || []).filter(u => u !== YO.username)[0];
    const msgs = E.mensajes[s.id] || [];

    let diaAnterior = '';
    const burbujas = msgs.map(m => {
        const d = diaDe(m.cuando);
        const cambia = d !== diaAnterior;
        diaAnterior = d;
        const mio = m.de === YO.username;
        const a = m.adjunto;
        return (cambia ? `<span class="am-dia">${esc(comoSeLee(d))}</span>` : '')
            + `<div class="am-msg ${mio ? 'mio' : ''} ${m.borrado ? 'borrado' : ''}">
                ${!mio && s.tipo === 'grupo' ? `<span class="de">${esc(nombreDe(m.de))}</span>` : ''}
                ${a ? (a.tipo === 'imagen'
                    ? `<img class="am-foto-msg" data-ver-adjunto="${esc(a.id)}" alt="${esc(a.nombre || 'Foto')}">`
                    : `<button type="button" class="am-adj" data-bajar-adjunto="${esc(a.id)}">
                          ${ICO_PAPEL}<span class="nm">${esc(a.nombre || 'Archivo')}</span>
                          <span class="pz">${esc(pesoLegible(a.tamano || 0))}</span></button>`) : ''}
                ${m.texto ? `<span class="tx">${esc(m.texto)}</span>` : ''}
                <span class="hr">${esc(horaCorta(m.cuando))}</span>
               </div>`;
    }).join('');

    const estado = s.tipo === 'grupo'
        ? `${(s.miembros || []).length} personas`
        : (otro && enLinea(otro) ? 'en línea' : 'desconectado');

    return `
        <div class="am-cab-conv">
            <button type="button" class="am-volver" data-chat-volver aria-label="Volver">${ICO_VOLVER}</button>
            <span class="am-ini ${s.tipo === 'grupo' ? 'grupo' : ''} ${otro && enLinea(otro) ? 'en-linea' : ''}">${esc(inicialesChat(nombreDeSala(s)))}</span>
            <span class="quien"><b>${esc(nombreDeSala(s))}</b>
                <span class="${otro && enLinea(otro) ? '' : 'off'}">${esc(estado)}</span></span>
        </div>
        <div class="am-charla" data-charla>
            ${burbujas || '<div class="am-vacio">Escribe el primer mensaje</div>'}
        </div>
        <div class="am-caja">
            <button type="button" class="am-clip" data-chat-clip aria-label="Adjuntar">${ICO_CLIP}</button>
            <input type="text" data-chat-texto placeholder="Escribe un mensaje…">
            <button type="button" class="am-enviar" data-chat-enviar aria-label="Enviar">${ICO_ENVIAR}</button>
        </div>
        <input type="file" data-chat-archivo hidden
            accept="image/*,video/*,.pdf,.xlsx,.xls,.csv,.doc,.docx,.txt">
    `;
};

/* ── LO QUE HACE LA PERSONA ──────────────────────────────────────────────────────────── */
const abrirConversacion = async (id) => {
    chatSala = id;
    marcarLeida(id);
    pintar();
    try { await bajarSala(id); } catch (e) { /* se reintenta en el latido */ }
    marcarLeida(id);
    pintar();
    alFinalDeLaCharla();
};

/* La charla arranca abajo, en lo ultimo: es lo que uno quiere ver al abrir. */
const alFinalDeLaCharla = () => {
    const c = raiz && raiz.querySelector('[data-charla]');
    if (c) c.scrollTop = c.scrollHeight;
};

const escribirEnElChat = async () => {
    const campo = raiz && raiz.querySelector('[data-chat-texto]');
    const texto = campo ? String(campo.value || '').trim() : '';
    if (!texto || !chatSala || chatMandando) return;
    /* NO SE DESHABILITA EL CAMPO MIENTRAS VIAJA. Un campo deshabilitado pierde el foco, y
       entonces hay que volver a tocarlo para escribir el mensaje siguiente — que es
       justamente lo que molestaba. Se vacia y se sigue pudiendo escribir. */
    chatMandando = true;
    if (campo) campo.value = '';
    try { await mandar(chatSala, texto); } catch (e) { alert('No se pudo enviar. Revisa la conexión.'); }
    chatMandando = false;
    marcarLeida(chatSala);
    pintar();
    alFinalDeLaCharla();
    const otra = raiz && raiz.querySelector('[data-chat-texto]');
    if (otra) otra.focus();
};

const adjuntarEnElChat = async (archivo) => {
    if (!archivo || !chatSala) return;
    chatMandando = true;
    pintar();
    try { await mandarConAdjunto(chatSala, archivo); }
    catch (e) { alert('No se pudo enviar el archivo: ' + (e && e.message ? e.message : 'error')); }
    chatMandando = false;
    pintar();
    alFinalDeLaCharla();
};

/* Las fotos de los mensajes se bajan una vez y se pintan cuando llegan: si viajaran dentro
   del HTML, cada repintado las volveria a pedir. */
const pintarFotosDelChat = () => {
    if (!raiz) return;
    raiz.querySelectorAll('img[data-ver-adjunto]').forEach(async (img) => {
        if (img.dataset.puesta) return;
        img.dataset.puesta = '1';
        try { img.src = await traerAdjunto(img.getAttribute('data-ver-adjunto')); }
        catch (e) { img.remove(); }
    });
};

const bajarAdjuntoDelChat = async (id, nombre) => {
    try {
        const datos = await traerAdjunto(id);
        const a = document.createElement('a');
        a.href = datos; a.download = nombre || 'archivo';
        document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { alert('No se pudo abrir el archivo.'); }
};

/* ── PASAR LISTA ─────────────────────────────────────────────────────────────────────────
   Todos arrancan presentes y se toca SOLO a quien falto. La puntualidad y la justificacion
   se afinan en la web: aca va lo que se necesita de pie y con una mano. */
/* LAS MISMAS CUATRO DE LA WEB, con el mismo valor guardado: si aca dijera "Descanso medico"
   sin tilde, el mismo dia quedarian dos motivos distintos para lo mismo. */
const JUSTIFICACIONES = [
    ['', '— sin motivo —'],
    ['Descanso Médico', 'Descanso médico'],
    ['Vacaciones', 'Vacaciones'],
    ['Cumpleaños', 'Cumpleaños'],
    ['Otros', 'Otros']
];

let listaTocada = false;     // se marco algo y todavia no se guardo: no se pisa con lo del servidor
let listaLocal = null;       // la lista de hoy, mientras se edita
let listaCerrada = false;    // ya la cerraron: se ve, no se toca
let listaGuardando = false;

/* EL BORRADOR VIVE EN EL TELEFONO, no solo en memoria. Pasar lista a treinta personas de
   pie en el almacen lleva rato, y en ese rato el telefono se bloquea, se cambia de pestana
   o se recarga la pagina. Cualquiera de esas tres borraba todo. Daniel: *"no seria mejor
   que se quede lo que estoy digitando... asi no haya grabado"*.

   SE ANOTA A QUIEN SE TOCO, no la lista completa: asi lo que alguien guarde desde la web
   para los demas sigue llegando, y lo marcado aca solo le gana en esas personas. Guardar
   la lista entera convertiria al celular en una foto vieja que tapa al servidor. */
const LLAVE_BORRADOR = 'deam_lista_borrador';
let listaBorrador = {};      // dni -> { present, onTime, justification }

const leerBorradorLista = (fecha) => {
    try {
        const crudo = JSON.parse(localStorage.getItem(LLAVE_BORRADOR) || 'null');
        /* Con la fecha adentro, el borrador de ayer no reaparece manana. */
        return (crudo && crudo.fecha === fecha && crudo.marcas) ? crudo.marcas : {};
    } catch (e) { return {}; }
};

const guardarBorradorLista = () => {
    try {
        if (!Object.keys(listaBorrador).length) localStorage.removeItem(LLAVE_BORRADOR);
        else localStorage.setItem(LLAVE_BORRADOR,
            JSON.stringify({ fecha: fechaDeLaLista(), marcas: listaBorrador }));
    } catch (e) { /* sin sitio en el telefono: se sigue, en memoria igual esta */ }
};

const olvidarBorradorLista = () => {
    listaBorrador = {};
    try { localStorage.removeItem(LLAVE_BORRADOR); } catch (e) { /* da igual */ }
};

/* Se llama despues de cada toque. Guarda el estado completo de esa persona -no solo lo que
   cambio- para que al volver quede exactamente como se la dejo. */
const anotarEnElBorrador = (p) => {
    listaBorrador[String(p.dni)] = {
        present: p.present,
        onTime: p.onTime,
        justification: p.justification || ''
    };
    guardarBorradorLista();
};

const fechaDeLaLista = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

const cargarLista = () => {
    const fecha = fechaDeLaLista();
    const guardado = adminService.getAttendance(fecha);
    listaCerrada = !!(guardado && guardado.finalized);
    listaLocal = armarLista(adminService.getWorkers() || [], guardado);

    /* LO DEL SERVIDOR ES LA BASE; LO MARCADO Y SIN GUARDAR VA ENCIMA. En ese orden: asi se
       ve lo que cambio otro y no se pierde lo que se acaba de marcar aca.

       Si la lista ya esta cerrada no hay nada que seguir editando, y un borrador viejo
       tapando una lista cerrada mostraria numeros que ya no son los que fueron al
       historial. Se descarta. */
    if (listaCerrada) {
        olvidarBorradorLista();
    } else {
        listaBorrador = leerBorradorLista(fecha);
        listaLocal.forEach(p => {
            const m = listaBorrador[String(p.dni)];
            if (!m) return;
            p.present = m.present;
            p.onTime = m.onTime;
            p.justification = m.justification || '';
        });
    }
    listaTocada = Object.keys(listaBorrador).length > 0;
};

const pantallaLista = () => {
    if (!listaLocal) cargarLista();
    /* CUANTAS MARCAS HAY SIN GUARDAR. Se dice en la tarjeta: si se conserva el borrador hay
       que avisar que es un borrador, o parece guardado y nadie aprieta Guardar. */
    const sinGuardar = listaCerrada ? 0 : Object.keys(listaBorrador).length;
    const total = listaLocal.length;
    const faltaron = listaLocal.filter(p => p.present === false).length;
    const vinieron = total - faltaron;

    if (!total) {
        return `<div class="am-vacio">No hay gente del turno noche cargada para pasar lista.</div>
                <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>`;
    }

    const gente = listaLocal.map(p => {
        const falto = p.present === false;
        const bloq = listaCerrada ? 'disabled' : '';
        /* El motivo SOLO se puede elegir en quien falto, pero la columna esta siempre: en
           quien asistio va una raya, para que las tres columnas queden alineadas. */
        const motivo = falto
            ? `<select ${bloq} data-justif="${esc(p.dni)}" aria-label="Motivo de la falta">
                   ${JUSTIFICACIONES.map(([valor, rotulo]) =>
                       `<option value="${esc(valor)}" ${String(p.justification || '') === valor ? 'selected' : ''}>${esc(rotulo)}</option>`).join('')}
               </select>`
            : '<span class="nada">–</span>';
        return `
        <div class="am-persona ${falto ? 'falto' : ''}">
            <span class="quien"><span class="nm">${esc(nombreCorto(p))}</span><span class="dni">DNI ${esc(p.dni)}</span></span>
            <span class="marcas">
                <button type="button" ${bloq} class="${falto ? '' : 'si-vino'}" data-vino="${esc(p.dni)}">Asistió</button>
                <button type="button" ${bloq} class="${falto ? 'si-falto' : ''}" data-falto="${esc(p.dni)}">Faltó</button>
            </span>
            <span class="motivo">${motivo}</span>
        </div>`;
    }).join('');

    return `
        <div class="am-tarjeta am-resumen">
            <span class="am-rotulo">Asistieron</span>
            <span class="am-grande">${numero(vinieron)}<span style="font-size:1.3rem;color:#8B9B9F">/${numero(total)}</span></span>
            <span class="am-pie">${faltaron ? `${numero(faltaron)} ${faltaron === 1 ? 'falta' : 'faltas'}` : 'nadie faltó'}${listaCerrada ? ' · lista cerrada' : ' · toca solo a quien faltó'}</span>
            <span class="acciones">
                <button type="button" class="am-chico solo-icono" data-foto title="Compartir la lista con Recursos Humanos">${ICONO_COMPARTIR}</button>
                ${listaCerrada ? '' : `
                <button type="button" class="am-chico" data-guardar ${listaGuardando ? 'disabled' : ''}>${listaGuardando ? 'Guardando…' : sinGuardar ? `Guardar (${numero(sinGuardar)})` : 'Guardar'}</button>`}
            </span>
        </div>

        ${listaCerrada
            ? `<div class="am-cerrada">✅ Asistencia cerrada</div>
               ${esElAdministrador() ? '<button type="button" class="am-boton fino" data-reabrir>Reabrir la lista</button>' : ''}`
            : ''}

        <div class="am-seccion">${listaCerrada ? 'Lista cerrada del turno' : 'Turno noche'}</div>
        <div class="am-encabezado"><span>Persona</span><span class="c2">Asistencia</span><span class="c3">Motivo</span></div>
        ${gente}

        ${listaCerrada ? '' : '<p class="am-nota">Al guardar, la lista queda cerrada y pasa al historial. Solo el administrador puede reabrirla.</p>'}
        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

const esElAdministrador = () => String((YO && YO.username) || '') === 'dames';

const marcar = (dni, vino) => {
    if (listaCerrada || !listaLocal) return;
    const p = listaLocal.filter(x => String(x.dni) === String(dni))[0];
    if (!p) return;
    p.present = !!vino;
    listaTocada = true;
    if (!vino) p.onTime = false;      // quien no vino no puede haber llegado a tiempo
    if (vino) p.justification = '';   // si al final vino, el motivo que se puso ya no aplica
    anotarEnElBorrador(p);
    pintar();
};

const anotarMotivo = (dni, motivo) => {
    if (listaCerrada || !listaLocal) return;
    const p = listaLocal.filter(x => String(x.dni) === String(dni))[0];
    if (p) { p.justification = motivo || ''; listaTocada = true; anotarEnElBorrador(p); }
    /* NO se repinta: se perderia el desplegable recien abierto y el sitio de la lista. */
};

/* SIN BOTON DE REFRESCAR: la lista se trae sola al entrar a la seccion. Daniel lo pidio y
   tiene razon, pero ojo con el por que: la app NO se refresca cada 20 segundos -eso es el
   radar de la web-. Aca las demas pantallas se rehacen cada minuto y LA LISTA NO SE TOCA
   sola a proposito, porque estaria pisando lo que se acaba de marcar. Por eso el traido va
   al entrar, y solo se aplica si todavia no se marco nada. */
const refrescarLista = async () => {
    try { await adminService.initializeAdminData(true); } catch (e) { console.warn('[APP] traer la lista:', e && e.message); }
    /* ANTES ACA SE VOLVIA SIN HACER NADA si ya se habia marcado algo, porque `cargarLista`
       borraba lo marcado. Ahora lo respeta -lo vuelve a poner encima-, asi que se puede
       aplicar siempre: entra lo que cambio otro y se conserva lo de aca. */
    cargarLista();
    if (seccion === 'lista') pintar();
};

const reabrirLista = async () => {
    if (!esElAdministrador()) return;
    if (!confirm('¿Reabrir la lista del turno? Se va a poder editar de nuevo.')) return;
    try { await adminService.reopenAttendance(fechaDeLaLista()); } catch (e) { alert('No se pudo reabrir.'); return; }
    cargarLista();
    pintar();
};

/* GUARDAR ES GUARDAR Y CERRAR. Daniel, 12-sep: *"al guardar deberias bloquear... y el unico
   que puede desbloquear soy yo, como dames"*. Cerrar no es un detalle: es lo que manda la
   lista al historial de performance con su puntaje, asi que se pregunta antes. */
const guardarLista = async (cerrando) => {
    if (!listaLocal || listaGuardando) return;
    if (cerrando && !confirm('Al guardar, la lista queda CERRADA y pasa al historial.\n\n¿Guardar y cerrar?')) return;
    listaGuardando = true;
    pintar();
    try {
        await adminService.saveAttendance(fechaDeLaLista(), { data: listaLocal, finalized: !!cerrando });
        /* Guardado de verdad: el borrador ya no hace falta y dejarlo solo puede estorbar. */
        olvidarBorradorLista();
        listaTocada = false;
        if (cerrando) listaCerrada = true;
    } catch (e) {
        console.warn('[APP] no se pudo guardar la lista:', e && e.message);
        alert('No se pudo guardar la lista. Vuelve a intentar.');
    }
    listaGuardando = false;
    pintar();
};

/* ── LA FOTO PARA RECURSOS HUMANOS ─────────────────────────────────────────────────────── */

const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                   'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fechaLarga = (iso) => {
    const [a, m, d] = String(iso).split('-').map(Number);
    const f = new Date(a, m - 1, d);
    return `${DIAS[f.getDay()]} ${d} de ${MES_LARGO[m - 1]} de ${a}`;
};

/* LA SEMANA QUE SE MUESTRA: de lunes a domingo, la del dia de hoy. Es la misma ventana que
   usa el cuadro de la web, para que los dos digan lo mismo. */
const semanaDeHoy = () => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const dias = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + i);
        dias.push(d);
    }
    return dias;
};

const claveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** El numero de semana, contado por su jueves, igual que en la web. */
const numeroDeSemana = (lunes) => {
    const jue = new Date(lunes); jue.setDate(lunes.getDate() + 3);
    const eneUno = new Date(jue.getFullYear(), 0, 1);
    return Math.ceil(((jue - eneUno) / 86400000 + 1) / 7);
};

/** La inicial del motivo, la misma de la web: en una foto no hay cursor que pasar, asi que
 *  la celda tiene que decir POR QUE sola. */
const letraDelMotivo = (obs) => {
    const t = String(obs || '').trim().toUpperCase();
    if (t.indexOf('VAC') === 0) return 'V';
    if (t.indexOf('DESC') === 0) return 'M';
    if (t.indexOf('CUMPLE') === 0) return 'C';
    if (t.indexOf('OTRO') === 0) return 'O';
    return '!';
};

/* EL CARGO Y EL SEXO SALEN DEL MAESTRO DE TRABAJADORES, cruzados por DNI. El sexo NO se
   deduce del nombre: seria inventar un dato sobre una persona de verdad; quien no este
   marcado no suma a ninguno de los dos. */
const ABREVIA = { 'AYUDANTE DE ALMACEN': 'A. ALMACEN', 'MONTACARGUISTA': 'MONTACARG.',
                  'OPERADOR DE SISTEMA': 'OP. SISTEMA', 'RECEPCION': 'RECEPCIÓN' };

const fichaMaestro = (dni) => {
    const w = (adminService.getWorkers() || []).filter(x =>
        String(x.dni || x.Dni || '').trim() === String(dni).trim())[0];
    if (!w) return { cargo: '', sexo: '' };
    const cargo = String(w.puesto || w.Puesto || '').trim().toUpperCase();
    return { cargo: ABREVIA[cargo] || cargo, sexo: String(w.sexo || w.Sexo || '').trim().toUpperCase() };
};

/* SOLO LOS DIAS GUARDADOS. Daniel, 12-sep: *"solo debe mostrar asistencia los dias
   guardados o asistencia cerrada; esta mostrando el sabado cuando ni siquiera he tomado
   asistencia"*. Una foto que se manda a Recursos Humanos no puede decir que la gente
   asistio cuando todavia no se paso lista. Una lista sin cerrar es como si no estuviera,
   igual que en el cuadro de la web. */
const marcasDeLaSemana = (dias) => {
    const por = {};
    const cerrados = [];
    dias.forEach(d => {
        const k = claveDia(d);
        const reg = adminService.getAttendance(k);
        if (!reg || !Array.isArray(reg.data) || reg.finalized !== true) return;
        cerrados.push(k);
        reg.data.forEach(p => {
            const dni = String(p.dni || '').trim();
            if (!dni) return;
            if (!por[dni]) por[dni] = {};
            por[dni][k] = { vino: p.present === true, obs: String(p.justification || '').trim() };
        });
    });
    return { por, cerrados };
};

/* LOS COLORES DE LA FOTO SALEN DE LA PANTALLA, no de una lista escrita a mano.
   Un `canvas` no entiende `var(--am-va)`: hay que darle el color ya resuelto. Se lee del
   propio `#app-movil`, que lleva la paleta del tema puesto, y asi la foto que se manda al
   grupo y lo que se ve en el telefono no pueden decir cosas distintas. */
const paletaDeLaFoto = () => {
    const el = raiz || document.getElementById('app-movil') || document.body;
    const cs = getComputedStyle(el);
    const t = (n, sinEl) => (cs.getPropertyValue(n) || '').trim() || sinEl;
    return {
        hoja:   t('--am-carta', '#FFFFFF'),     /* el papel de la lamina */
        banda:  t('--am-papel', '#EEF2F1'),     /* encabezados, tarjetas y filas alternas */
        tinta:  t('--am-tinta', '#131C1F'),
        tenue:  t('--am-tenue', '#6C7B80'),
        linea:  t('--am-linea', '#DCE4E2'),
        va:     t('--am-va', '#0B5F52'),
        curso:  t('--am-curso', '#B26A00'),
        tarde:  t('--am-tarde', '#98302E'),
        /* La franja del titulo va llena: fondo `relleno` y letra `sobre`. NUNCA el acento
           a secas — en el tema Negro el acento es blanco puro y quedaria blanco sobre
           blanco, que es el error que ya se pago en el chat. */
        franja: t('--am-relleno', '#0B5F52'),
        sobre:  t('--am-sobre', '#FFFFFF')
    };
};

/* Un color con transparencia, para los tonos intermedios de la franja. Acepta #RGB y
   #RRGGBB; si le llega otra cosa, lo devuelve tal cual y no rompe el dibujo. */
const conAlfa = (color, a) => {
    const c = String(color || '').trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (!m) return c;
    const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const dibujarLaFoto = (deEsteBloque, nBloque, deCuantos) => {
    const P = paletaDeLaFoto();
    const ESCALA = 2;               // se dibuja al doble: en un celular, a 1x sale borroso
    const MARGEN = 18;
    const ANCHO_NUM = 20, ANCHO_NOMBRE = 168, ANCHO_DNI = 64, ANCHO_CARGO = 84, ANCHO_DIA = 29;
    const ANCHO = MARGEN * 2 + ANCHO_NUM + ANCHO_NOMBRE + ANCHO_DNI + ANCHO_CARGO + 7 * ANCHO_DIA;
    const ALTO_FILA = 20;
    const ALTO_TITULO = 66;
    const ALTO_TARJETAS = 62;
    const ALTO_ENCABEZADO = 26;
    const ALTO_PIE = 30;      // solo la leyenda: debajo ya no va nada

    const dias = semanaDeHoy();
    const { por: marcas, cerrados } = marcasDeLaSemana(dias);
    /* LAS TARJETAS CUENTAN EL ULTIMO DIA CERRADO, no el de hoy sin guardar: un resumen de
       algo que nadie ha pasado todavia no dice nada. Es lo mismo que hace la web. */
    const ultimoCerrado = cerrados.length ? cerrados[cerrados.length - 1] : null;
    const deEseDia = ultimoCerrado
        ? (adminService.getAttendance(ultimoCerrado).data || []) : [];

    const total = deEseDia.length;
    const faltaron = deEseDia.filter(p => p.present === false && !String(p.justification || '').trim()).length;
    const conObs = deEseDia.filter(p => p.present === false && String(p.justification || '').trim()).length;
    const asistieron = deEseDia.filter(p => p.present !== false).length;
    let hombres = 0, mujeres = 0;
    deEseDia.forEach(p => {
        const sx = fichaMaestro(p.dni).sexo;
        if (sx === 'H') hombres++; else if (sx === 'M') mujeres++;
    });

    const alto = ALTO_TITULO + ALTO_TARJETAS + ALTO_ENCABEZADO + deEsteBloque.length * ALTO_FILA + ALTO_PIE;

    const lienzo = document.createElement('canvas');
    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    const g = lienzo.getContext('2d');
    g.scale(ESCALA, ESCALA);
    g.textBaseline = 'middle';

    const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const VA = P.va, TARDE = P.tarde, CURSO = P.curso, TENUE = P.tenue,
          TINTA = P.tinta, AZUL = P.va;

    g.fillStyle = P.hoja;
    g.fillRect(0, 0, ANCHO, alto);

    /* ── EL TITULO, como el de la web ────────────────────────────────────────────────── */
    g.fillStyle = P.franja;
    g.fillRect(0, 0, ANCHO, ALTO_TITULO);
    g.fillStyle = P.sobre;
    g.font = `800 16px ${UI}`;
    g.fillText('CONTROL DE ASISTENCIA TURNO NOCHE', MARGEN, 24);
    const a = dias[0], b = dias[6];
    g.font = `400 11px ${UI}`;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(`Semana ${numeroDeSemana(a)}  ·  ${a.getDate()} de ${MES_LARGO[a.getMonth()]} al `
               + `${b.getDate()} de ${MES_LARGO[b.getMonth()]} de ${b.getFullYear()}`, MARGEN, 44);
    g.textAlign = 'right';
    g.font = `400 9px ${UI}`;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('LOGÍSTICA', ANCHO - MARGEN, 18);
    g.font = `800 13px ${UI}`;
    g.fillStyle = conAlfa(P.sobre, 0.75);
    g.fillText('DEAM1830', ANCHO - MARGEN, 33);
    g.font = `700 9px ${UI}`;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    if (ultimoCerrado) {
        const f = new Date(ultimoCerrado + 'T12:00:00');
        g.fillText(`RESUMEN DEL ${DIAS[f.getDay()].slice(0, 3).toUpperCase()} ${f.getDate()}`, ANCHO - MARGEN, 50);
    } else {
        g.fillText('SIN DÍAS CERRADOS', ANCHO - MARGEN, 50);
    }
    g.textAlign = 'left';

    /* ── LAS CINCO TARJETAS ──────────────────────────────────────────────────────────── */
    /* LAS DOS SILUETAS de la tarjeta de hombres y mujeres: cabeza y cuerpo, en relleno.
       Se dibujan a mano porque un canvas no entiende los iconos SVG de la plataforma. Son
       las mismas de la lamina de la web, que las pidio Daniel: "iconos de hombre y mujer
       (como sombras)". La cabeza es igual en las dos; lo que cambia es el cuerpo: en el
       hombre baja casi recto desde los hombros y en la mujer se abre hacia abajo. */
    const silueta = (cx, cy, alto, esHombre, color) => {
        const r = alto * 0.19;
        const yCab = cy - alto / 2 + r;
        const yHom = yCab + r + alto * 0.05;
        const yPie = cy + alto / 2;
        const hom = alto * 0.29;
        const pie = esHombre ? alto * 0.24 : alto * 0.42;
        g.fillStyle = color;
        g.beginPath(); g.arc(cx, yCab, r, 0, Math.PI * 2); g.fill();
        g.beginPath();
        g.moveTo(cx - hom, yHom + alto * 0.10);
        g.quadraticCurveTo(cx - hom, yHom, cx - hom * 0.5, yHom);
        g.lineTo(cx + hom * 0.5, yHom);
        g.quadraticCurveTo(cx + hom, yHom, cx + hom, yHom + alto * 0.10);
        g.lineTo(cx + pie, yPie);
        g.lineTo(cx - pie, yPie);
        g.closePath(); g.fill();
    };

    const TARJETAS = [
        [String(total), 'OPERARIOS', TINTA],
        [String(asistieron), 'ASISTENCIAS', VA],
        [String(faltaron), faltaron === 1 ? 'FALTA' : 'FALTAS', TARDE],
        [String(conObs), 'OBSERVACIONES', CURSO],
        [`${hombres} · ${mujeres}`, 'HOMBRES · MUJERES', AZUL]
    ];
    const anchoT = (ANCHO - 2 * MARGEN - 4 * 6) / 5;
    TARJETAS.forEach(([valor, rotulo, color], i) => {
        const x = MARGEN + i * (anchoT + 6);
        g.fillStyle = P.banda;
        g.fillRect(x, ALTO_TITULO + 10, anchoT, ALTO_TARJETAS - 20);
        g.textAlign = 'center';
        g.fillStyle = color;
        g.font = `800 16px ${UI}`;
        if (i === 4) {
            /* La ultima lleva las dos siluetas, cada una delante de su numero. */
            /* Hombres y mujeres se distinguen con dos acentos DEL TEMA. El azul y el
               naranja del diseño claro no se leen sobre un fondo oscuro. */
            const AZUL_H = P.va, NARANJA_M = P.curso;
            const anchoH = g.measureText(String(hombres)).width;
            const anchoM = g.measureText(String(mujeres)).width;
            const sep = 9, icono = 9;
            const todo = icono + 3 + anchoH + sep + icono + 3 + anchoM;
            let cx = x + anchoT / 2 - todo / 2;
            silueta(cx + icono / 2, ALTO_TITULO + 27, 16, true, AZUL_H);
            cx += icono + 3;
            g.textAlign = 'left'; g.fillStyle = AZUL_H;
            g.fillText(String(hombres), cx, ALTO_TITULO + 28);
            cx += anchoH + sep;
            silueta(cx + icono / 2, ALTO_TITULO + 27, 16, false, NARANJA_M);
            cx += icono + 3;
            g.fillStyle = NARANJA_M;
            g.fillText(String(mujeres), cx, ALTO_TITULO + 28);
            g.textAlign = 'center';
        } else {
            g.fillText(valor, x + anchoT / 2, ALTO_TITULO + 28);
        }
        g.fillStyle = TENUE;
        g.font = `700 7.5px ${UI}`;
        let r = rotulo;
        while (g.measureText(r).width > anchoT - 6 && r.length > 4) r = r.slice(0, -1);
        g.fillText(r, x + anchoT / 2, ALTO_TITULO + 42);
    });
    g.textAlign = 'left';

    /* ── LOS ENCABEZADOS DE COLUMNA ──────────────────────────────────────────────────── */
    const xNum = MARGEN;
    const xNombre = xNum + ANCHO_NUM;
    const xDni = xNombre + ANCHO_NOMBRE;
    const xCargo = xDni + ANCHO_DNI;
    const xDia = (i) => xCargo + ANCHO_CARGO + i * ANCHO_DIA + ANCHO_DIA / 2;
    const yEnc = ALTO_TITULO + ALTO_TARJETAS + 4;

    g.fillStyle = P.banda;
    g.fillRect(MARGEN - 6, yEnc - 12, ANCHO - 2 * MARGEN + 12, ALTO_ENCABEZADO - 2);
    g.fillStyle = TENUE;
    g.font = `700 8.5px ${UI}`;
    g.fillText('#', xNum, yEnc);
    g.fillText('NOMBRES Y APELLIDOS', xNombre, yEnc);
    g.fillText('DNI', xDni, yEnc);
    g.fillText('CARGO', xCargo, yEnc);
    const ROTULO = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
    g.textAlign = 'center';
    dias.forEach((d, i) => {
        const esHoy = claveDia(d) === ultimoCerrado;
        g.fillStyle = esHoy ? VA : TENUE;
        g.font = `${esHoy ? 800 : 700} 8.5px ${UI}`;
        g.fillText(ROTULO[i], xDia(i), yEnc - 4);
        g.font = `400 8px ${UI}`;
        g.fillText(String(d.getDate()), xDia(i), yEnc + 6);
    });
    g.textAlign = 'left';

    let y = yEnc + ALTO_ENCABEZADO;
    deEsteBloque.forEach((p, i) => {
        /* Se resalta por lo que dice el ULTIMO DIA CERRADO, no por lo que hay en pantalla:
           la foto habla de lo guardado. */
        const delDia = ultimoCerrado ? (marcas[String(p.dni)] || {})[ultimoCerrado] : null;
        const falto = !!delDia && delDia.vino === false;
        if (i % 2 === 1) { g.fillStyle = P.banda; g.fillRect(MARGEN - 6, y - 10, ANCHO - 2 * MARGEN + 12, ALTO_FILA); }
        g.textAlign = 'left';
        g.fillStyle = TENUE;
        g.font = `400 9px ${UI}`;
        g.fillText(String(p.__n), xNum, y);
        g.fillStyle = TINTA;
        g.font = `${falto ? 700 : 400} 11px ${UI}`;
        let nombre = nombreCompleto(p);
        while (g.measureText(nombre).width > ANCHO_NOMBRE - 8 && nombre.length > 4) nombre = nombre.slice(0, -2);
        g.fillText(nombre, xNombre, y);
        g.fillStyle = TENUE;
        g.font = `400 9.5px ${UI}`;
        g.fillText(String(p.dni || ''), xDni, y);
        let cargo = fichaMaestro(p.dni).cargo;
        while (g.measureText(cargo).width > ANCHO_CARGO - 6 && cargo.length > 3) cargo = cargo.slice(0, -2);
        g.fillText(cargo, xCargo, y);

        /* La semana, con el mismo codigo de simbolos de la web. */
        g.textAlign = 'center';
        dias.forEach((d, j) => {
            const m = (marcas[String(p.dni)] || {})[claveDia(d)];
            if (!m) { g.fillStyle = P.linea; g.font = `400 11px ${UI}`; g.fillText('–', xDia(j), y); return; }
            if (m.obs) { g.fillStyle = CURSO; g.font = `800 11px ${UI}`; g.fillText(letraDelMotivo(m.obs), xDia(j), y); return; }
            g.fillStyle = m.vino ? VA : TARDE;
            g.font = `700 11.5px ${UI}`;
            g.fillText(m.vino ? '✓' : '✗', xDia(j), y);
        });
        g.textAlign = 'left';
        y += ALTO_FILA;
    });

    /* ── LA LEYENDA: es lo que hace que el cuadro se entienda sin preguntar ───────────── */
    g.strokeStyle = P.linea;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(MARGEN, y + 2); g.lineTo(ANCHO - MARGEN, y + 2); g.stroke();

    const leyenda = [['✓', 'asistió', VA], ['V', 'vacaciones', CURSO], ['M', 'descanso médico', CURSO],
                     ['C', 'cumpleaños', CURSO], ['O', 'otros (justificada)', CURSO],
                     ['✗', 'falta injustificada', TARDE]];
    let lx = MARGEN;
    leyenda.forEach(([simbolo, texto, color]) => {
        g.fillStyle = color;
        g.font = `800 10px ${UI}`;
        g.fillText(simbolo, lx, y + 18);
        lx += g.measureText(simbolo).width + 4;
        g.fillStyle = TENUE;
        g.font = `400 9.5px ${UI}`;
        g.fillText(texto, lx, y + 18);
        lx += g.measureText(texto).width + 12;
    });

    /* DEBAJO DE LA LEYENDA NO VA NADA. Estaba el sello con la hora y el "sin cerrar", y
       Daniel lo saco: la foto se manda al toque, asi que la hora la pone el propio WhatsApp,
       y lo de "sin cerrar" es cosa de la web, no de Recursos Humanos. */

    return lienzo;
};

/** Muestra las fotos a pantalla completa, para guardarlas o compartirlas a mano. */
const verLaFoto = (lista, comoSeLlama) => {
    const datos = Array.isArray(lista) ? lista : [lista];
    const capa = document.createElement('div');
    capa.style.cssText = 'position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.9);'
        + 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:16px;';
    capa.style.overflowY = 'auto';
    capa.style.justifyContent = 'flex-start';
    datos.forEach((d, i) => {
        const img = document.createElement('img');
        img.src = d;
        img.style.cssText = 'max-width:100%; border-radius:10px; background:#fff;';
        const bajar = document.createElement('a');
        bajar.href = d;
        bajar.download = comoSeLlama ? comoSeLlama
            : (datos.length > 1
                ? 'Asistencia ' + fechaDeLaLista() + ' (' + (i + 1) + ' de ' + datos.length + ').png'
                : 'Asistencia ' + fechaDeLaLista() + '.png');
        bajar.textContent = datos.length > 1 ? 'Guardar el bloque ' + (i + 1) : 'Guardar la foto';
        /* Los colores del visor tambien del tema: era verde pino fijo. */
        bajar.style.cssText = 'background:' + paletaDeLaFoto().franja + '; color:' + paletaDeLaFoto().sobre
            + '; padding:.8rem 1.4rem; border-radius:10px;'
            + 'font-family:system-ui,sans-serif; font-weight:700; text-decoration:none;';
        capa.appendChild(img); capa.appendChild(bajar);
    });
    const nota = document.createElement('span');
    nota.textContent = 'Mantén el dedo sobre la foto para compartirla';
    nota.style.cssText = 'color:#C8D2D0; font-family:system-ui,sans-serif; font-size:.8rem;';
    capa.appendChild(nota);
    capa.addEventListener('click', (e) => { if (e.target === capa) capa.remove(); });
    document.body.appendChild(capa);
};

/* UNA SOLA IMAGEN. Daniel, viendola: *"en una sola imagen nada mas, dejalo, esta bien"*.
   Se probo partirla en dos porque el tope de WhatsApp cae sobre el lado mas largo, pero con
   la gente de hoy entra de sobra y prefiere mandar una. Si algun dia crece la lista y llega
   borrosa, partirla es volver a repartir `orden` en dos mitades y llamar dos veces a
   `dibujarLaFoto`, que ya sabe decir "bloque 1 de 2". */
const laminasDeLaLista = () => {
    /* POR APELLIDO, como la web. Antes iban primero los que faltaron: quien cruza la foto
       contra el cuadro de la web tenia que buscar a cada persona dos veces. */
    const orden = listaLocal.slice()
        .sort((x, y) => claveDeOrden(x).localeCompare(claveDeOrden(y), 'es'))
        .map((p, i) => Object.assign({ __n: i + 1 }, p));

    return [dibujarLaFoto(orden, 1, 1)];
};

/** Arma los bloques y los manda por donde el telefono deje: WhatsApp, correo, lo que sea. */

/* ── EL REPORTE DE ALMACENAJE POR MARCAS, PARA MANDAR ────────────────────────────────────
 *  Daniel, 12-sep-2026: *"al momento de compartir quiero exactamente ese reporte"*, el de
 *  la web. La pantalla del telefono va recortada a proposito —numero, marca, cantidad— pero
 *  lo que sale por WhatsApp lleva las OCHO columnas, los buffers separados con su subtotal
 *  y el total general, igual que el cuadro que el manda todos los dias.
 *
 *  SE DIBUJA, NO SE CAPTURA: una foto de la pantalla saldria recortada y borrosa. Y los
 *  colores salen del tema puesto, como la foto de la asistencia.
 * ─────────────────────────────────────────────────────────────────────────────────────── */
const dibujarLaminaMarcas = (datos, desde, hasta) => {
    const P = paletaDeLaFoto();
    const ESCALA = 2;                 // a 1x, en un telefono, sale borroso
    const M = 16;                     // margen
    /* Los anchos salen de lo que tiene que entrar: PENDIENTE lleva cinco cifras con puntos
       y MARCAS el nombre mas largo del maestro. */
    const COL = [96, 150, 88, 66, 76, 76, 74, 96];
    const ANCHO = M * 2 + COL.reduce((a, b) => a + b, 0);
    const H_TITULO = 54, H_CAB = 28, H_FILA = 25, H_SUB = 29, H_GRAN = 34;

    const areas = datos.areas || [];
    const nFilas = areas.reduce((a, x) => a + x.marcas.length, 0);
    const alto = H_TITULO + H_CAB + nFilas * H_FILA + areas.length * H_SUB + H_GRAN + M;

    const lienzo = document.createElement('canvas');
    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    const g = lienzo.getContext('2d');
    g.scale(ESCALA, ESCALA);
    g.textBaseline = 'middle';
    const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const NUM = '"Cascadia Mono", ui-monospace, "SF Mono", Consolas, monospace';
    const mil = (n) => Math.round(Number(n) || 0).toLocaleString('es-PE');

    /* El borde de cada columna, para no recalcularlo en cada fila. */
    const x0 = [];
    COL.reduce((acc, w, i) => { x0[i] = acc; return acc + w; }, M);
    const der = (i) => x0[i] + COL[i] - 8;        // las cifras van pegadas a la derecha

    g.fillStyle = P.hoja;
    g.fillRect(0, 0, ANCHO, alto);

    /* ── La franja del titulo ────────────────────────────────────────────────── */
    g.fillStyle = P.franja;
    g.fillRect(0, 0, ANCHO, H_TITULO);
    g.textAlign = 'left';
    g.fillStyle = P.sobre;
    g.font = `900 17px ${UI}`;
    g.fillText('REPORTE ALMACENAJE - MARCAS', M, 22);
    g.font = `700 10px ${NUM}`;
    g.fillStyle = conAlfa(P.sobre, 0.75);
    g.fillText('SYNC_ID: ' + new Date().toLocaleString('es-PE',
        { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), M, 40);
    g.textAlign = 'right';
    g.fillText('Desde ' + comoSeLee(desde) + '   hasta ' + comoSeLee(hasta), ANCHO - M, 31);

    /* ── Los titulos de las columnas ─────────────────────────────────────────── */
    let y = H_TITULO;
    g.fillStyle = P.banda;
    g.fillRect(0, y, ANCHO, H_CAB);
    const TITULOS = ['AREA', 'MARCAS', 'BUFFER', 'DÍA', 'NOCHE', 'TOTAL', '%', 'PENDIENTE'];
    const COLOR_CAB = [P.tenue, P.tenue, P.va, P.curso, P.va, P.va, P.va, P.va];
    g.font = `800 9.5px ${UI}`;
    TITULOS.forEach((t, i) => {
        g.fillStyle = COLOR_CAB[i];
        if (i < 2) { g.textAlign = 'left'; g.fillText(t, x0[i] + 8, y + H_CAB / 2); }
        else { g.textAlign = 'right'; g.fillText(t, der(i), y + H_CAB / 2); }
    });
    g.strokeStyle = P.va;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, y + H_CAB); g.lineTo(ANCHO, y + H_CAB); g.stroke();
    y += H_CAB;

    /* El semaforo del porcentaje: rojo si no se toco, ambar si va a medias, verde si llego.
       Es el mismo criterio del reporte de la web. */
    const colorPct = (pct, hecho, meta) => pct === 0 ? P.tarde : (hecho < meta ? P.curso : P.va);
    const cifra = (txt, i, yy, color, peso) => {
        g.textAlign = 'right';
        g.fillStyle = color;
        g.font = `${peso || 700} 11.5px ${NUM}`;
        g.fillText(txt, der(i), yy);
    };

    areas.forEach(a => {
        a.marcas.forEach((m, k) => {
            const yc = y + H_FILA / 2;
            if (k % 2 === 1) { g.fillStyle = P.banda; g.fillRect(0, y, ANCHO, H_FILA); }
            g.textAlign = 'left';
            g.fillStyle = P.tenue;
            g.font = `600 10.5px ${UI}`;
            g.fillText(a.area, x0[0] + 8, yc);
            g.fillStyle = P.tinta;
            g.font = `800 11.5px ${UI}`;
            g.fillText(recortar(g, marcaCorta(m.marca), COL[1] - 14), x0[1] + 8, yc);
            cifra(mil(m.buffer), 2, yc, P.tinta);
            cifra(mil(m.dia), 3, yc, P.curso);
            cifra(mil(m.noche), 4, yc, P.va);
            cifra(mil(m.total), 5, yc, P.tinta);
            cifra(m.pct + '%', 6, yc, colorPct(m.pct, m.total, m.buffer), 800);
            cifra(mil(m.pendiente), 7, yc, P.tinta, 800);
            y += H_FILA;
        });

        /* El subtotal del buffer. */
        const yc = y + H_SUB / 2;
        g.fillStyle = conAlfa(P.va, 0.14);
        g.fillRect(0, y, ANCHO, H_SUB);
        g.fillStyle = P.va;
        g.fillRect(0, y, 4, H_SUB);
        g.textAlign = 'left';
        g.font = `900 11px ${UI}`;
        g.fillText('TOTAL ' + a.area, x0[0] + 10, yc);
        const T = a.totales;
        cifra(mil(T.buffer), 2, yc, P.tinta, 900);
        cifra(mil(T.dia), 3, yc, P.curso, 900);
        cifra(mil(T.noche), 4, yc, P.va, 900);
        cifra(mil(T.total), 5, yc, P.tinta, 900);
        cifra(T.pct + '%', 6, yc, colorPct(T.pct, T.total, T.buffer), 900);
        cifra(mil(T.pendiente), 7, yc, P.tinta, 900);
        y += H_SUB;
    });

    /* ── El total general ────────────────────────────────────────────────────── */
    const G = datos.granTotal || { buffer: 0, dia: 0, noche: 0, total: 0, pct: 0, pendiente: 0 };
    const yg = y + H_GRAN / 2;
    g.fillStyle = P.franja;
    g.fillRect(0, y, ANCHO, H_GRAN);
    g.textAlign = 'left';
    g.fillStyle = P.sobre;
    g.font = `900 12.5px ${UI}`;
    g.fillText('TOTAL GENERAL CDBUFFER', x0[0] + 10, yg);
    const claro = (txt, i, peso) => {
        g.textAlign = 'right'; g.fillStyle = P.sobre;
        g.font = `${peso || 900} 12px ${NUM}`; g.fillText(txt, der(i), yg);
    };
    claro(mil(G.buffer), 2); claro(mil(G.dia), 3); claro(mil(G.noche), 4);
    claro(mil(G.total), 5); claro(G.pct + '%', 6); claro(mil(G.pendiente), 7);

    return lienzo;
};

/* Corta un texto con puntos suspensivos si no entra: un nombre que se sale pisa la columna
   siguiente y el cuadro deja de leerse como cuadro. */
const recortar = (g, txt, ancho) => {
    let t = String(txt || '');
    if (g.measureText(t).width <= ancho) return t;
    while (t.length > 1 && g.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
};

const comoSeLee = (iso) => {
    const p = String(iso || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso || '');
};

/* Arma el reporte del rango que se este viendo y lo manda. */
const mandarReporteTareas = async () => {
    const tareas = adminService.getAlmacenajeTasks() || [];
    const datos = datosMarcas(tareas, tareasDesde, tareasHasta,
                              armarTurnoDe(adminService.getWorkers() || []));
    if (!datos || datos.vacio) { alert('No hay nada que compartir en estas fechas.'); return; }
    const lienzo = dibujarLaminaMarcas(datos, tareasDesde, tareasHasta);
    const nombre = 'Almacenaje por marcas ' + comoSeLee(tareasDesde).replace(/\//g, '-') + '.png';
    const blob = await new Promise(r => lienzo.toBlob(r, 'image/png'));
    const archivo = new File([blob], nombre, { type: 'image/png' });
    try {
        if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
            await navigator.share({ files: [archivo], title: 'Almacenaje por marcas' });
            return;
        }
    } catch (e) { return; }        // si cancela el menu del telefono, no pasa nada
    verLaFoto([lienzo.toDataURL('image/png')], nombre);
};

const mandarFoto = async () => {
    if (!listaLocal) cargarLista();
    if (!listaLocal.length) return;
    const lienzos = laminasDeLaLista();
    const archivos = [];
    for (let i = 0; i < lienzos.length; i++) {
        const blob = await new Promise(r => lienzos[i].toBlob(r, 'image/png'));
        const nombre = lienzos.length > 1
            ? 'Asistencia ' + fechaDeLaLista() + ' (' + (i + 1) + ' de ' + lienzos.length + ').png'
            : 'Asistencia ' + fechaDeLaLista() + '.png';
        archivos.push(new File([blob], nombre, { type: 'image/png' }));
    }
    /* El menu de compartir del telefono, con los dos bloques de una vez. Si el navegador no
       lo tiene -o es una PC- se muestran para guardarlos, que es la salida de siempre. */
    try {
        if (navigator.canShare && navigator.canShare({ files: archivos })) {
            await navigator.share({ files: archivos, title: 'Asistencia del turno' });
            return;
        }
    } catch (e) { /* si la persona cancela el menu, no pasa nada */ return; }
    verLaFoto(lienzos.map(l => l.toDataURL('image/png')));
};

/* ── LOS AVISOS DEL CELULAR ───────────────────────────────────────────────────────────── */

let avisosEstado = 'mirando';    // mirando | apagados | prendidos | sin-soporte | bloqueados
let avisosTrabajando = false;

/** El identificador de ESTE telefono. Una persona puede tener el celular y la tablet, y cada
 *  uno necesita su propia suscripcion: si se pisaran, el aviso llegaria a uno solo. */
const idDeEsteTelefono = () => {
    try {
        let id = localStorage.getItem('deam_id_telefono');
        if (!id) {
            id = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            localStorage.setItem('deam_id_telefono', id);
        }
        return id;
    } catch (e) { return 'sin-memoria'; }
};

const puedeAvisos = () => ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);

const mirarAvisos = async () => {
    if (!puedeAvisos()) { avisosEstado = 'sin-soporte'; return; }
    if (Notification.permission === 'denied') { avisosEstado = 'bloqueados'; return; }
    try {
        const reg = await navigator.serviceWorker.ready;
        const sus = await reg.pushManager.getSubscription();
        avisosEstado = sus ? 'prendidos' : 'apagados';
    } catch (e) { avisosEstado = 'apagados'; }
};

/** La llave viaja en base64 de URL y el navegador la quiere en bytes. */
const llaveEnBytes = (base64) => {
    const relleno = '='.repeat((4 - base64.length % 4) % 4);
    const limpia = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const crudo = atob(limpia);
    const bytes = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
    return bytes;
};

const prenderAvisos = async () => {
    if (avisosTrabajando) return;
    avisosTrabajando = true; pintar();
    try {
        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') {
            avisosEstado = permiso === 'denied' ? 'bloqueados' : 'apagados';
            return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sus = await reg.pushManager.subscribe({
            userVisibleOnly: true,                       // sin esto el navegador no suscribe
            applicationServerKey: llaveEnBytes(LLAVE_AVISOS)
        });
        const s = sus.toJSON();
        await fetch(`${BASE_API}/${AREA_AVISOS}?date=MASTER`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(YO.token ? { 'X-Auth-Token': YO.token } : {}) },
            body: JSON.stringify({
                id: YO.username + '|' + idDeEsteTelefono(),
                usuario: YO.username,
                rol: YO.role || '',
                endpoint: s.endpoint,
                claves: s.keys,
                telefono: navigator.userAgent.slice(0, 90),
                cuando: new Date().toISOString()
            })
        });
        avisosEstado = 'prendidos';
    } catch (e) {
        console.warn('[APP] no se pudieron prender los avisos:', e && e.message);
        alert('No se pudieron activar los avisos. Vuelve a intentar.');
        await mirarAvisos();
    }
    avisosTrabajando = false;
    pintar();
};

const apagarAvisos = async () => {
    if (avisosTrabajando) return;
    avisosTrabajando = true; pintar();
    try {
        const reg = await navigator.serviceWorker.ready;
        const sus = await reg.pushManager.getSubscription();
        if (sus) await sus.unsubscribe();
        /* Se borra tambien del servidor: si quedara, el robot seguiria mandando avisos a un
           telefono que ya no los quiere y el servicio terminaria rechazandolos. */
        await fetch(`${BASE_API}/${AREA_AVISOS}?date=MASTER`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(YO.token ? { 'X-Auth-Token': YO.token } : {}) },
            body: JSON.stringify({ id: YO.username + '|' + idDeEsteTelefono(), usuario: YO.username, baja: true })
        });
        avisosEstado = 'apagados';
    } catch (e) { console.warn('[APP] apagar avisos:', e && e.message); }
    avisosTrabajando = false;
    pintar();
};

const pantallaAvisos = () => {
    const esAdmin = esElAdministrador();
    const loQueLlega = esAdmin
        ? [['🤖', 'Cada robot que corre', 'Cómo le fue a cada corrida, apenas termina.'],
           ['📦', 'Los cortes de stock', 'El de las 07:00 y el de las 19:00.'],
           ['💬', 'Los mensajes del chat', 'Cuando alguien te escribe.']]
        : [['📦', 'Los cortes de stock', 'El de las 07:00 y el de las 19:00.'],
           ['💬', 'Los mensajes del chat', 'Cuando alguien te escribe.']];

    const lista = loQueLlega.map(([ic, que, detalle]) => `
        <div class="am-fila">
            <span class="cinta" style="background:var(--am-va)"></span>
            <span class="medio"><span class="t">${ic} ${esc(que)}</span><span class="d">${esc(detalle)}</span></span>
        </div>`).join('');

    let caja = '';
    if (avisosEstado === 'sin-soporte') {
        caja = `<div class="am-pronto"><span class="ic">📵</span><span class="q">Este teléfono no admite avisos</span>
                <span class="p">Hace falta Android con Chrome, o un iPhone con la app agregada a la pantalla de inicio.</span></div>`;
    } else if (avisosEstado === 'bloqueados') {
        caja = `<div class="am-pronto"><span class="ic">🔕</span><span class="q">Los avisos están bloqueados</span>
                <span class="p">Se dijo que no una vez. Para volver a permitirlos hay que entrar a los ajustes del navegador, en los permisos de este sitio.</span></div>`;
    } else if (avisosEstado === 'prendidos') {
        caja = `<div class="am-cerrada">🔔 Avisos activados en este teléfono</div>
                <button type="button" class="am-boton fino" data-apagar-avisos ${avisosTrabajando ? 'disabled' : ''}>Apagar los avisos aquí</button>`;
    } else {
        caja = `<div class="am-tarjeta">
                    <span class="am-rotulo">Avisos</span>
                    <span class="am-pie">Con esto el teléfono avisa <b>aunque esté guardado y con la pantalla apagada</b>. Sin esto, solo te enteras al abrir la app.</span>
                </div>
                <button type="button" class="am-boton" data-prender-avisos ${avisosTrabajando ? 'disabled' : ''}>${avisosTrabajando ? 'Activando…' : '🔔 Activar los avisos'}</button>`;
    }

    return `
        ${caja}
        <div class="am-seccion">Qué te va a llegar</div>
        ${lista}
        <p class="am-nota">Los avisos los manda el servidor del almacén. No pasan por ninguna tienda ni cuestan nada.</p>
        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

/* ── EL MENU ─────────────────────────────────────────────────────────────────────────────
   Dos niveles, como lo pidio: se entra a Temas y ahi se elige, no se elige desde el primer
   nivel. Avisos vive aca y ya no ocupa una pestaña abajo. */
const panelMenu = () => {
    if (menu === 'temas') {
        const puesto = temaService.temaActual();
        return `<div class="am-panel">
            <button type="button" data-menu-volver>${ICONOS.volver}Configuración · Temas</button>
            ${temaService.TEMAS.map(t => `
                <button type="button" data-poner-tema="${esc(t.id)}" class="${t.id === puesto ? 'sel' : ''}">
                    <span class="am-muestra" style="background:${esc(t.muestras[0])}"></span>
                    <span>${esc(t.nombre)}<span class="desc">${esc(t.descripcion)}</span></span>
                    ${t.id === puesto ? '<span class="ch">✓</span>' : ''}
                </button>`).join('')}
        </div>`;
    }
    if (menu === 'avisos') {
        return `<div class="am-panel">
            <button type="button" data-menu-volver>${ICONOS.volver}Configuración · Avisos</button>
            <div style="padding:.2rem .2rem .6rem">${pantallaAvisos()}</div>
        </div>`;
    }
    const t = temaService.TEMAS.find(x => x.id === temaService.temaActual());
    const avisos = avisosEstado === 'prendidos' ? 'activados'
        : (avisosEstado === 'bloqueados' ? 'bloqueados' : 'apagados');
    return `<div class="am-panel">
        <div class="gr">Configuración</div>
        <button type="button" data-menu-ir="temas">${ICONOS.paleta}Temas
            <span class="ch">${esc((t && t.nombre) || '—')} ›</span></button>
        <button type="button" data-menu-ir="avisos">${ICONOS.avisos}Avisos
            <span class="ch">${avisos} ›</span></button>
        <div class="gr">Sesión</div>
        <button type="button" data-escritorio>${ICONOS.escritorio}Ver en escritorio</button>
        <button type="button" data-salir-app>${ICONOS.puerta}Salir</button>
    </div>`;
};

const CABECERAS = {
    inicio: () => ({ sub: `Turno · ${diaEnLetras()}`, ttl: `${saludo()}, ${String(YO.name || YO.username).split(' ')[0]}` }),
    tareas: () => ({ sub: `Turno · ${diaEnLetras()}`, ttl: 'Tareas' }),
    chat: () => {
        const n = sinLeerTotal();
        const enPie = activos().filter(p => p.username !== (YO && YO.username) && enLinea(p.username)).length;
        return { sub: (n ? `${n} sin leer` : 'Todo leído') + ` · ${enPie} en línea`, ttl: 'Chat' };
    },
    lista: () => ({ sub: `Turno noche · ${diaEnLetras()}`, ttl: 'Pasar lista' }),
    avisos: () => ({ sub: avisosEstado === 'prendidos' ? 'Activados en este teléfono' : 'Apagados', ttl: 'Avisos' })
};

const pintar = () => {
    if (!raiz) return;
    const cab = (CABECERAS[seccion] || CABECERAS.inicio)();
    raiz.querySelector('.am-cab .sub').textContent = cab.sub;
    raiz.querySelector('.am-cab .ttl').textContent = cab.ttl;

    /* LA CONVERSACION OCUPA LA PANTALLA. Se le quita el relleno al cuerpo y se esconde la
       cabecera: en un telefono, un chat con marco alrededor desperdicia media pantalla. */
    raiz.classList.toggle('en-conversacion', seccion === 'chat' && !!chatSala);

    /* DONDE ESTABA EL CURSOR. El repintado reemplaza la caja de texto por otra nueva, y sin
       esto hay que volver a tocarla para seguir escribiendo. Daniel: *"yo quiero escribir,
       apretar enter y que el foco siga en el cuadro de texto"*. */
    const escribiendo = document.activeElement
        && document.activeElement.hasAttribute
        && document.activeElement.hasAttribute('data-chat-texto');
    const dondeIbaElCursor = escribiendo ? document.activeElement.selectionStart : 0;
    const loQueLlevaba = escribiendo ? document.activeElement.value : '';

    const cuerpo = raiz.querySelector('.am-cuerpo');
    cuerpo.innerHTML = seccion === 'inicio' ? pantallaInicio()
        : seccion === 'lista' ? pantallaLista()
        /* La hoja va DENTRO del cuerpo pero es `position: fixed`, asi que no la recorta el
           scroll ni la encierra la rejilla de tres filas de la app. */
        : seccion === 'chat' ? (chatSala ? pantallaConversacion() : pantallaChat())
        : seccion === 'tareas' ? (pantallaTareas() + hojaDeTarea())
        : seccion === 'avisos' ? pantallaAvisos()
        : pantallaEnCamino(seccion);
    /* EL SCROLL SOLO SE REINICIA AL CAMBIAR DE PANTALLA. Antes se reiniciaba en CADA
       repintado, y marcar a alguien repinta: con 38 personas, tocar "Faltó" en el ultimo
       devolvia la lista al principio y habia que volver a bajar. Lo vio Daniel en
       produccion pasando lista. */
    if (seccion !== _ultimaPintada) { cuerpo.scrollTop = 0; _ultimaPintada = seccion; }

    const capa = raiz.querySelector('.am-capa-menu');
    capa.innerHTML = menu ? `<div class="am-velo-menu" data-velo-menu>${panelMenu()}</div>` : '';

    raiz.querySelector('.am-barra').innerHTML = SECCIONES.map(s => {
        /* EL GLOBO SE VE SIN ENTRAR, que es para lo que sirve. */
        const n = s.id === 'chat' && chatListo ? sinLeerTotal() : 0;
        return `
        <button type="button" role="tab" data-seccion="${s.id}" aria-selected="${s.id === seccion}">
            <span class="gl">${ICONOS[s.icono]}</span>${esc(s.rotulo)}
            ${n ? `<span class="punto">${n > 99 ? '99+' : n}</span>` : ''}
        </button>`;
    }).join('');

    if (seccion === 'chat' && chatSala) { pintarFotosDelChat(); alFinalDeLaCharla(); }

    /* Y se le devuelve el cursor donde estaba, con lo que llevara escrito. */
    if (escribiendo) {
        const campo = raiz.querySelector('[data-chat-texto]');
        if (campo && !campo.disabled) {
            if (loQueLlevaba && !campo.value) campo.value = loQueLlevaba;
            campo.focus();
            try { campo.setSelectionRange(dondeIbaElCursor, dondeIbaElCursor); } catch (e) { /* da igual */ }
        }
    }
};

/** Vuelve a la web de siempre y se acuerda de la decisión. */
const irAEscritorio = () => {
    try { localStorage.setItem('deam_prefiere_escritorio', '1'); } catch (e) { /* da igual */ }
    location.reload();
};

export const prefiereEscritorio = () => {
    try { return localStorage.getItem('deam_prefiere_escritorio') === '1'; } catch (e) { return false; }
};

export const renderAppMovil = async (contenedor, user, onLogout) => {
    YO = user;
    alSalir = onLogout;
    seccion = 'inicio';

    /* Los mismos datos de siempre. Si el servidor tarda, la app dibuja igual y se completa
       en la siguiente vuelta: mas vale una pantalla con ceros que una en blanco. */
    try { await adminService.initializeAdminData(); } catch (e) { console.warn('[APP] datos:', e && e.message); }

    if (!document.getElementById('app-movil-estilos')) {
        const est = document.createElement('style');
        est.id = 'app-movil-estilos';
        est.textContent = CSS;
        document.head.appendChild(est);
    }

    contenedor.innerHTML = '';
    raiz = document.createElement('div');
    raiz.id = 'app-movil';
    raiz.innerHTML = `
        <header class="am-cab">
            <div class="am-cab-fila">
                <div><div class="sub"></div><div class="ttl"></div></div>
                <button type="button" class="am-menu-btn" data-menu aria-label="Menú">
                    ${ICONOS.rayitas}</button>
            </div>
        </header>
        <main class="am-cuerpo"></main>
        <nav class="am-barra" role="tablist"></nav>
        <div class="am-capa-menu"></div>`;
    document.body.appendChild(raiz);

    /* LA CINTA DE PRUEBAS NO PUEDE TAPAR LA BARRA DE ABAJO. En beta, env.js pega un cartel
       fijo en el borde inferior y se comia las cinco secciones. En produccion no existe y
       la app llega hasta el borde, como debe ser. */
    const capaCinta = document.getElementById(String.fromCharCode(112) + 'ulse-env-aviso');
    if (capaCinta) {
        /* Se mide el CARTEL, no la capa: la capa cubre la pantalla entera y su alto es el
           alto de la ventana. Medir la capa dejaba la app fuera de la pantalla. */
        const cartel = capaCinta.firstElementChild;
        /* Lo que hay que dejar libre NO es el alto del cartel sino CUANTO OCUPA DESDE EL
           BORDE DE ABAJO: el cartel no esta pegado al borde, y por esos pocos pixeles la
           barra le quedaba encima igual. */
        const caja = cartel && cartel.getBoundingClientRect();
        const ocupa = caja ? Math.ceil(window.innerHeight - caja.top) : 0;
        raiz.style.bottom = (ocupa > 6 && ocupa < 90 ? ocupa : 30) + 'px';
    }

    raiz.addEventListener('click', (e) => {
        const s = e.target.closest('[data-seccion]');
        if (s) {
            seccion = s.getAttribute('data-seccion');
            menu = null;
            /* SE TRAE AL ENTRAR, PERO SIN BORRAR LO MARCADO. Antes aca iba un `cargarLista()`
               suelto antes del refresco, y eso rehacia la lista desde el servidor y ponia
               `listaTocada` en falso: el seguro que tiene `refrescarLista` para no pisar lo
               marcado quedaba esquivado por este camino. Ir a Tareas y volver borraba
               treinta marcas. */
            if (seccion === 'lista') refrescarLista();
            if (seccion === 'tareas') {
                /* Se traen frescas al entrar: en el almacen hay otras pantallas asignando
                   al mismo tiempo, y ver una tarea libre que ya tiene dueño hace que dos
                   grupos salgan a buscar la misma mercaderia. */
                tareaAbierta = null; tareaPregunta = null; tareasBorrador = null;
                adminService.loadAlmacenajeTasks(true).then(pintar).catch(() => {});
                /* SE REPINTA CUANDO LLEGAN LAS METAS. Sin esto, el primer dibujo usa el
                   valor de respaldo -300 u/h- en vez del de la categoria, y el objetivo
                   puede salir al reves: una tarea que no cumplio aparece en verde y un
                   segundo despues se pone roja. Lo cazo la prueba de la pantalla. */
                metasService.cargarReglas().then(pintar).catch(() => {});
            }
            if (seccion === 'chat') { chatSala = null; prepararChat(); }
            if (seccion === 'avisos') mirarAvisos().then(pintar);
            pintar();
            return;
        }
        const vino = e.target.closest('[data-vino]');
        if (vino) { marcar(vino.getAttribute('data-vino'), true); return; }
        const falto = e.target.closest('[data-falto]');
        if (falto) { marcar(falto.getAttribute('data-falto'), false); return; }
        if (e.target.closest('[data-guardar]')) { guardarLista(true); return; }
        if (e.target.closest('[data-foto]')) { mandarFoto(); return; }
        if (e.target.closest('[data-prender-avisos]')) { prenderAvisos(); return; }
        if (e.target.closest('[data-apagar-avisos]')) { apagarAvisos(); return; }
        if (e.target.closest('[data-reabrir]')) { reabrirLista(); return; }
        if (e.target.closest('[data-cerrar]')) { guardarLista(true); return; }
        /* ── EL MENU ───────────────────────────────────────────────────────────── */
        if (e.target.closest('[data-menu]')) { menu = menu ? null : 'raiz'; pintar(); return; }
        if (e.target.closest('[data-menu-volver]')) { menu = 'raiz'; pintar(); return; }
        const ir = e.target.closest('[data-menu-ir]');
        if (ir) {
            menu = ir.getAttribute('data-menu-ir');
            if (menu === 'avisos') mirarAvisos().then(pintar);
            pintar();
            return;
        }
        /* OJO AL NOMBRE: no puede ser `data-tema`, porque <html> lo lleva y `closest`
           sube hasta ahi. Con ese nombre, este renglon atrapaba TODOS los clics de la app
           y cortaba la cadena; la pantalla dejaba de responder sin dar ningun error. */
        const elTema = e.target.closest('[data-poner-tema]');
        if (elTema) {
            /* Se guarda en el MISMO sitio que la web: el tema es de la persona, no del
               aparato. Elegirlo en el celular lo cambia tambien en su PC. */
            temaService.setTema(elTema.getAttribute('data-poner-tema'), YO && YO.username);
            pintar();
            return;
        }
        if (e.target.closest('[data-salir-app]')) { menu = null; if (alSalir) alSalir(); return; }
        if (e.target.hasAttribute && e.target.hasAttribute('data-velo-menu')) {
            menu = null; pintar(); return;
        }

        if (e.target.closest('[data-escritorio]')) { irAEscritorio(); return; }

        /* ── TAREAS ──────────────────────────────────────────────────────────────────
           LA SEGUNDA PREGUNTA MANDA mientras esta abierta: nada mas responde hasta que se
           conteste, para que no se pueda esquivar tocando al costado. */
        if (tareaPregunta) {
            if (e.target.closest('[data-no]')) { tareaPregunta = null; pintar(); return; }
            if (e.target.closest('[data-si]')) {
                const que = tareaPregunta;
                tareaPregunta = null;
                if (que === 'reiniciar') reiniciarTarea(); else eliminarTarea();
                return;
            }
            return;
        }
        /* ── EL CHAT ─────────────────────────────────────────────────────────────── */
        const laSala = e.target.closest('[data-sala]');
        if (laSala) { abrirConversacion(laSala.getAttribute('data-sala')); return; }
        if (e.target.closest('[data-chat-volver]')) { chatSala = null; pintar(); return; }
        const conQuien = e.target.closest('[data-nueva-con]');
        if (conQuien) {
            crearDirecta(conQuien.getAttribute('data-nueva-con'))
                .then(id => abrirConversacion(id)).catch(() => alert('No se pudo abrir la conversación.'));
            return;
        }
        if (e.target.closest('[data-chat-enviar]')) { escribirEnElChat(); return; }
        if (e.target.closest('[data-chat-clip]')) {
            const f = raiz.querySelector('[data-chat-archivo]');
            if (f) { f.value = ''; f.click(); }
            return;
        }
        const bajar = e.target.closest('[data-bajar-adjunto]');
        if (bajar) {
            bajarAdjuntoDelChat(bajar.getAttribute('data-bajar-adjunto'),
                                (bajar.querySelector('.nm') || {}).textContent);
            return;
        }

        if (e.target.closest('[data-compartir-tareas]')) { mandarReporteTareas(); return; }
        const cap = e.target.closest('[data-filtro]');
        if (cap) { tareasFiltro = cap.getAttribute('data-filtro'); pintar(); return; }
        const reg = e.target.closest('[data-tarea]');
        if (reg) { tareaAbierta = reg.getAttribute('data-tarea'); tareasBorrador = null; pintar(); return; }
        if (e.target.closest('[data-cerrar-hoja]')) {
            tareaAbierta = null; tareasBorrador = null; pintar(); return;
        }
        const pide = e.target.closest('[data-pide]');
        if (pide && !pide.disabled) { leerBorrador(); tareaPregunta = pide.getAttribute('data-pide'); pintar(); return; }
        if (e.target.closest('[data-principal]')) {
            const t = (adminService.getAlmacenajeTasks() || []).find(x => x && x.id === tareaAbierta);
            const st = String((t && t.status) || '');
            guardarTarea(st === 'Creada' ? 'asignar' : (st === 'Asignado' ? 'finalizar' : 'guardar'));
            return;
        }
        if (e.target.closest('[data-guardar-tarea]')) { guardarTarea('guardar'); return; }
        /* Tocar el velo, fuera de la hoja, tambien cierra. */
        if (e.target.hasAttribute && e.target.hasAttribute('data-velo')) {
            tareaAbierta = null; tareasBorrador = null; pintar(); return;
        }
    });

    raiz.addEventListener('change', (e) => {
        const j = e.target.closest('[data-justif]');
        if (j) { anotarMotivo(j.getAttribute('data-justif'), j.value); return; }

        /* EL RANGO. Cambiar una fecha cierra la hoja: la tarea que se estaba mirando puede
           quedar fuera del rango nuevo, y dejar abierta una que ya no esta en la lista
           confunde mas de lo que ayuda. */
        if (e.target.hasAttribute('data-desde') || e.target.hasAttribute('data-hasta')) {
            const v = e.target.value;
            if (!v) return;
            if (e.target.hasAttribute('data-desde')) tareasDesde = v; else tareasHasta = v;
            /* NO se le corrige la fecha a nadie. Tuve puesto que un `hasta` anterior al
               `desde` se moviera solo, y esta mal por dos motivos: la web no lo hace, y
               cambiarle en silencio lo que acaba de elegir es peor que mostrarle una lista
               vacia. Un rango al reves no trae nada y la pantalla lo dice. */
            tareaAbierta = null; tareasBorrador = null;
            pintar();
            return;
        }
        /* Lo tecleado en la hoja se guarda en memoria: el reloj de un minuto repinta, y sin
           esto se perderia lo que la persona acaba de elegir. */
        if (e.target.closest('[data-u1],[data-u2],[data-hi],[data-hf]')) leerBorrador();

        if (e.target.hasAttribute('data-chat-buscar')) { chatBuscar = e.target.value; pintar(); return; }
        if (e.target.hasAttribute('data-chat-archivo') && e.target.files && e.target.files[0]) {
            adjuntarEnElChat(e.target.files[0]);
        }
    });

    /* ENTER MANDA. En un telefono el teclado trae su propia tecla de enviar y es lo que la
       gente aprieta; sin esto habria que apuntar al boton cada vez. */
    raiz.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-chat-texto')) {
            e.preventDefault();
            escribirEnElChat();
        }
    });

    /* El buscador filtra mientras se escribe, sin esperar a que salga del campo. */
    raiz.addEventListener('input', (e) => {
        if (e.target.hasAttribute && e.target.hasAttribute('data-chat-buscar')) {
            chatBuscar = e.target.value;
            pintar();
            const c = raiz.querySelector('[data-chat-buscar]');
            if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
        }
    });

    pintar();

    /* Se refresca solo, pero despacio: un celular en el bolsillo no tiene por que preguntar
       cada veinte segundos. Con un minuto alcanza, y cuando vuelve a la mano se refresca. */
    if (reloj) clearInterval(reloj);
    reloj = setInterval(() => {
        /* NO SE REPINTA LA LISTA SOLA: se estaria pisando lo que la persona acaba de marcar
           y todavia no guardo. Las demas pantallas si se refrescan. */
        if (document.visibilityState === 'visible' && seccion !== 'lista') pintar();
    }, 60000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') pintar();
    });

    console.log(`📲 [APP] la app del celular, lista para ${user.username}`);
};

export const desmontarAppMovil = () => {
    if (reloj) { clearInterval(reloj); reloj = null; }
    if (raiz && raiz.parentNode) raiz.parentNode.removeChild(raiz);
    raiz = null;
};
