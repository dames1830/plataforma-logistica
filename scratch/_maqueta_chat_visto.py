# -*- coding: utf-8 -*-
"""Arma la maqueta de las marcas de entregado/leido del chat.

El CSS y la forma de la burbuja se RECORTAN de js/chat.js y css/temas.css: la
maqueta tiene que verse como la pantalla de verdad, no parecida.
"""
import io
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
css_chat = io.open(os.path.join(AQUI, '_css_chat.txt'), encoding='utf-8').read()
css_temas = io.open(os.path.join(AQUI, '_css_temas.txt'), encoding='utf-8').read()

# ── LO NUEVO: las marcas ──────────────────────────────────────────────────
CSS_NUEVO = """
/* ══ LAS MARCAS DE ENTREGADO Y LEIDO ══════════════════════════════════════
   Daniel, 15-sep-2026: *"al yo escribirle a alguien, que me muestre en el mismo
   mensaje, en la misma ventanita, si lo leyo o no lo leyo... mensaje entregado,
   mensaje leido, algo asi"*. Y al elegir: *"como WhatsApp, azul cuando todos lo
   leyeron"*, y en grupo *"leido por tres de cinco y asi"*.

   Van en el pie de la burbuja, despues de la hora, como en WhatsApp. Solo en los
   mensajes MIOS: en los del otro no significan nada. */
.chat-msg .visto { margin-left: 3px; letter-spacing: -2px; font-weight: 900; }
.chat-msg .visto.leido { color: var(--chat-leido); letter-spacing: -2px; }

/* EL AZUL DEL LEIDO VA POR TEMA, y hace falta: sobre el fondo oscuro un cian vivo
   da 8,2 de contraste y sobre la burbuja clara da 1,1 -invisible-. Es la misma
   regla que ya sigue el sello de los reportes: vivo sobre oscuro, oscurecido
   sobre claro. Medido sobre la burbuja de verdad, no sobre el fondo de la
   pantalla: la burbuja es translucida y aclara lo que tiene debajo.

       indigo 8,20   ·   negro 9,08   ·   pbi 5,53   ·   pbi-classic 6,00
       (el minimo legible es 4,5) */
:root, html[data-tema="indigo"] { --chat-leido: #00e5ff; }
html[data-tema="negro"]         { --chat-leido: #00e5ff; }
html[data-tema="pbi"]           { --chat-leido: #0c4a6e; }
html[data-tema="pbi-classic"]   { --chat-leido: #0c4a6e; }
/* El "3 de 5" del grupo va pegado a la marca y mas apagado: el dato principal es
   la marca; el numero es el detalle. */
.chat-msg .cuantos { margin-left: 5px; opacity: .8; }
"""


def msg(texto, hora, estado=None, cuantos='', de=None, mio=True):
    """Una burbuja igual que la que dibuja chat.js, con la marca al final."""
    marca = ''
    if estado == 'enviado':
        marca = '<span class="visto" title="Enviado">&#10003;</span>'
    elif estado == 'entregado':
        marca = '<span class="visto" title="Entregado">&#10003;&#10003;</span>'
    elif estado == 'leido':
        marca = '<span class="visto leido" title="Leído">&#10003;&#10003;</span>'
    elif estado == 'sinenviar':
        marca = ''
    extra = ' · sin enviar' if estado == 'sinenviar' else ''
    num = ('<span class="cuantos">%s</span>' % cuantos) if cuantos else ''
    quien = ('<div class="de">%s</div>' % de) if de else ''
    return ('<div class="chat-msg %s">%s%s\n'
            '  <div class="pie">%s%s%s%s</div></div>'
            % ('mio' if mio else '', quien, texto, hora, extra, marca, num))


VENTANA_DIRECTA = """
<section class="chat-ventana abierta">
  <header class="vcab">
    <span class="luz si" title="En l&iacute;nea"></span>
    <span class="n">Miguel Sosa</span>
    <span class="acciones"><button type="button">&ndash;</button><button type="button">&times;</button></span>
  </header>
  <div class="cuerpo">
    <div class="chat-dia">Hoy</div>
    {MSG}
  </div>
  <div class="pie">
    <div class="caja">
      <button type="button" class="clip">&#128206;</button>
      <input type="text" placeholder="Escribe&hellip;">
      <button type="button">Enviar</button>
    </div>
  </div>
</section>
"""

VENTANA_GRUPO = """
<section class="chat-ventana abierta">
  <header class="vcab">
    <span class="n">Turno noche</span>
    <span class="acciones"><button type="button">&ndash;</button><button type="button">&times;</button></span>
  </header>
  <div class="cuerpo">
    <div class="chat-dia">Hoy</div>
    {MSG}
  </div>
  <div class="pie">
    <div class="caja">
      <button type="button" class="clip">&#128206;</button>
      <input type="text" placeholder="Escribe&hellip;">
      <button type="button">Enviar</button>
    </div>
  </div>
</section>
"""

directa = '\n'.join([
    msg('ya bajaron las paletas de Tumbes?', '19:02', 'leido'),
    msg('si, terminamos hace un rato', '19:04', mio=False),
    msg('perfecto. manda la foto cuando puedas', '19:05', 'entregado'),
    msg('la guía 7991491 la libero comercial hoy', '19:20', 'enviado'),
    msg('avisame si entra a la ola de la noche', '19:21', 'sinenviar'),
])

grupo = '\n'.join([
    msg('mañana entra la programación a las 08:20', '18:40', 'leido',
        cuantos='4 de 4'),
    msg('entendido', '18:41', de='Ricardo Lunazco', mio=False),
    msg('ojo que ADIDAS trae 3.866 pares', '18:45', 'entregado', cuantos='2 de 4'),
    msg('el de PAPERMAX es de cont&oacute;metros, no de calzado', '18:47', 'enviado'),
])

HTML = """<!DOCTYPE html>
<html lang="es" data-tema="indigo">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maqueta - Entregado y le&iacute;do en el chat</title>
<!--
  MAQUETA de las marcas de ENTREGADO y LEIDO en el chat.

  Daniel, 15-sep-2026: *"al yo escribirle a alguien, que me muestre en el mismo
  mensaje, en la misma ventanita, si lo leyo o no lo leyo"*. Y al elegir como:
  *"como WhatsApp, azul cuando todos lo leyeron"*, con *"leido por tres de cinco"*
  en los grupos.

  El CSS y la forma de la burbuja estan RECORTADOS de `js/chat.js` y de
  `css/temas.css`. Lo unico nuevo son las tres reglas de `.visto` y `.cuantos`,
  marcadas abajo.
-->
<style>
/* ── LOS CUATRO TEMAS, tal cual de css/temas.css ──────────────────────── */
{TEMAS}

/* ── EL CHAT, tal cual de js/chat.js ──────────────────────────────────── */
{CHAT}

{NUEVO}

/* Solo el envase de la maqueta. */
body { margin: 0; background: var(--bg-dark); color: var(--text-main);
  font-family: var(--font-ui); padding: 0 0 40px; }
.mq-barra { display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  padding: 12px 20px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.mq-barra b { font-size: 12px; letter-spacing: .6px; color: var(--text-muted); margin-right: 6px; }
.mq-barra button { background: rgba(var(--ink-rgb), .06); border: 1px solid var(--border);
  color: var(--text-strong); border-radius: 8px; padding: 6px 12px; font-size: 12px;
  font-weight: 700; cursor: pointer; font-family: inherit; }
.mq-barra button:hover { border-color: var(--primary); }
.mq-lienzo { max-width: 1100px; margin: 0 auto; padding: 0 20px;
  display: flex; gap: 26px; flex-wrap: wrap; align-items: flex-start; }
.mq-col h2 { font-size: var(--t-md); color: var(--text-strong); margin: 0 0 4px; }
.mq-col p { font-size: var(--t-xs); color: var(--text-muted); margin: 0 0 12px; max-width: 320px; }
/* En la maqueta las ventanas van quietas, no flotando en la esquina. */
.mq-col .chat-ventana { position: static; width: 320px; }
.mq-ley { max-width: 340px; font-size: var(--t-xs); color: var(--text-soft);
  border: 1px dashed var(--border); border-radius: 12px; padding: 14px 16px; line-height: 1.7; }
.mq-ley b { color: var(--text-strong); }
.mq-ley .visto { font-size: var(--t-sm); }
</style>
</head>
<body>

<div class="mq-barra">
  <b>MAQUETA &middot; LOS CUATRO TEMAS</b>
  <button type="button" data-t="indigo">Indigo</button>
  <button type="button" data-t="pbi">PBI</button>
  <button type="button" data-t="pbi-classic">PBI Classic</button>
  <button type="button" data-t="negro">Negro</button>
</div>

<div class="mq-lienzo">
  <div class="mq-col">
    <h2>Conversaci&oacute;n de dos</h2>
    <p>La marca solo sale en <b>tus</b> mensajes. En los del otro no significa nada.</p>
    {DIRECTA}
  </div>

  <div class="mq-col">
    <h2>Grupo de 5</h2>
    <p>Se pone azul <b>cuando lo leyeron todos</b>. Mientras tanto, el conteo.</p>
    {GRUPO}
  </div>

  <div class="mq-ley">
    <p style="margin:0 0 10px"><b>QU&Eacute; SIGNIFICA CADA MARCA</b></p>
    <div><span class="visto">&#10003;</span> &nbsp;<b>Enviado</b> &mdash; se guard&oacute; en el servidor.</div>
    <div><span class="visto">&#10003;&#10003;</span> &nbsp;<b>Entregado</b> &mdash; el otro se conect&oacute; despu&eacute;s,
      o sea su pantalla ya lo baj&oacute;.</div>
    <div><span class="visto leido">&#10003;&#10003;</span> &nbsp;<b>Le&iacute;do</b> &mdash; abri&oacute; la conversaci&oacute;n.</div>
    <div style="margin-top:10px"><b>&middot; sin enviar</b> &mdash; ya exist&iacute;a: no hubo internet
      y el mensaje no sali&oacute;.</div>
    <p style="margin:14px 0 0; color: var(--text-muted)">No se inventa un &laquo;entregado&raquo;
      que no se pueda comprobar: si el otro no se ha conectado desde que escribiste,
      se queda en una sola marca.</p>
  </div>
</div>

<script>
var botones = document.querySelectorAll('.mq-barra button');
botones.forEach(function (b) {
  b.addEventListener('click', function () {
    document.documentElement.dataset.tema = b.dataset.t;
  });
});
</script>
</body>
</html>
"""

salida = (HTML.replace('{TEMAS}', css_temas)
              .replace('{CHAT}', css_chat)
              .replace('{NUEVO}', CSS_NUEVO)
              .replace('{DIRECTA}', VENTANA_DIRECTA.replace('{MSG}', directa))
              .replace('{GRUPO}', VENTANA_GRUPO.replace('{MSG}', grupo)))
p = os.path.join(AQUI, 'maqueta_chat_visto.html')
io.open(p, 'w', encoding='utf-8', newline='').write(salida)
print('maqueta escrita: %d lineas' % (salida.count('\n') + 1))
