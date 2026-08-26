# Los temas de la plataforma

La plataforma se puede ver de cuatro maneras. Se elige en **Configuración →
🎨 TEMA** y el cambio es solo visual: los números, los permisos y los reportes
son exactamente los mismos en todos.

| id | Nombre | Qué es |
|---|---|---|
| `indigo` | Índigo Noche | El de siempre. Azul noche con paneles translúcidos. **No cambió nada.** |
| `pbi` | Gerencial · Power BI | La paleta oficial de Power BI Desktop y su tipografía, Segoe UI. |
| `pbi-classic` | Gerencial · Power BI Classic | La paleta clásica de Power BI, la del teal `#01B8AA`. |
| `negro` | Negro | Negro puro, sin colores. Solo el semáforo pinta. |

Cada usuario tiene el suyo. El tema del jefe no cambia el del operario.

---

## Cómo funciona

Un tema **no es una hoja de estilos aparte**. Es un juego de valores para las
mismas variables. Toda la plataforma pinta con `var(--loquesea)` y `css/temas.css`
decide cuánto vale cada una según el tema puesto.

    <html data-tema="pbi">   ->   --bg-dark: #F3F2F1  (en vez de #0f172a)

Eso significa que **agregar un tema nuevo es agregar un bloque de valores**. No
hay que tocar ni una pantalla.

### Las piezas

    css/temas.css                    los cuatro juegos de valores
    js/services_v245/temaService.js  elegir, guardar y aplicar
    index.html  (<script> de arranque)  lo aplica antes del primer pixel
    js/app.js                        al entrar, aplica el del usuario
    dashboard_v28.js  (renderConfigTab)  la pantalla para elegirlo

`temas.css` se carga **después** de `main.css` a propósito: redefine las mismas
variables y con la misma especificidad gana la última hoja.

### Por qué el arranque va en línea en index.html

Si el tema se aplicara desde un módulo, la pantalla arrancaría en índigo y
saltaría al tema elegido a la vista del usuario. El `<script>` del `<head>` lee
la preferencia y la escribe en el `<html>` antes de que se dibuje nada.

Corre **antes** del login, así que adivina con la sesión que hubiera guardada.
Cuando ya se sabe quién entró, `app.js` vuelve a aplicar el que corresponde.

---

## El truco de los tríos `-rgb`

El código tenía 2.685 transparencias tipo `rgba(255,255,255,0.05)`. Son 435
valores distintos, pero solo **51 tríos RGB**: lo único que cambia es la
transparencia. Así que se tokeniza el trío y se deja la transparencia:

    rgba(255,255,255,0.05)  ->  rgba(var(--ink-rgb), 0.05)

Y sale bien en los dos mundos, porque el blanco sobre fondo oscuro significa
siempre *«la tinta que contrasta con el fondo»*:

| | tema oscuro | tema claro |
|---|---|---|
| `rgba(var(--ink-rgb), 0.05)` | velo claro sobre negro | velo oscuro sobre blanco |
| `rgba(var(--ink-rgb), 0.90)` | texto casi blanco | texto casi negro |

La transparencia lleva el énfasis y el trío lleva el tema. **Un solo token
resuelve los 1.382 usos del blanco.**

---

## Lo que NO se toca, y por qué

Cuatro sitios siguen con el color escrito a mano, a propósito. En todos ellos
`var(--x)` no vale nada porque no es CSS:

| Dónde | Por qué |
|---|---|
| **ExcelJS** (`argb`) | El color va dentro del `.xlsx`. Un Excel descargado no tiene tema. |
| **canvas** (`fillStyle`, `strokeStyle`) | Se dibuja a mano en el lienzo, no con CSS. |
| **SVG en `data:` URI** | La imagen se serializa; `var()` no resuelve ahí. |
| **Paletas categóricas** | `PALETA_MARCAS` y compañía distinguen marcas. Si se aplastaran a un token quedarían indistinguibles. |

**Chart.js es el caso especial.** También necesita un color de verdad, pero ahí
sí queríamos que siguiera el tema. Se resuelve al dibujar:

```js
ticks: { color: colorTema('--text-muted') }   // devuelve "#605E5C" en pbi
grid:  { color: veloTema(0.05) }              // devuelve "rgba(32, 31, 30, 0.05)"
```

Los gráficos toman los colores nuevos en cuanto la pantalla se vuelve a dibujar.

### Fuera de alcance

Los **reportes públicos** (`reportes.html`, `reportes_publicos.js`,
`public_layout_activo.js`, `marcas.js`) no tienen tema. Se abren sin sesión, ni
siquiera cargan `main.css` y ya son claros: son un producto aparte.

---

## Agregar o cambiar un tema

1. Copiar un bloque `html[data-tema="..."]` entero en `css/temas.css` y cambiarle
   los valores. **Tienen que estar todas las variables**: si falta una, esa
   propiedad se queda sin valor y el elemento sale sin pintar.
2. Agregar la entrada en `TEMAS`, en `temaService.js` (id, nombre, descripción y
   los cinco cuadraditos de muestra).
3. Agregar el id a la lista del `<script>` de arranque de `index.html`.

Para comprobar que no falta ninguna:

```bash
python -c "
import re,io,os
d=set(re.findall(r'(--[a-z0-9-]+)\s*:', io.open('css/temas.css',encoding='utf-8').read()))
u=set()
for r,_,fs in os.walk('.'):
    if any(x in r for x in ('backup','.git')): continue
    for f in fs:
        if f.endswith(('.js','.css','.html')) and 'publico' not in f and 'public_' not in f:
            u|=set(re.findall(r'var\((--[a-z0-9-]+)', io.open(os.path.join(r,f),encoding='utf-8',errors='ignore').read()))
print('sin definir:', sorted(u-d) or 'ninguna')"
```

---

## Reglas de color al elegir valores

**El color vive en los rellenos, no en el texto.** Es la regla que copiamos de
Power BI y la razón de que cada color del catálogo tenga dos versiones:

- la **viva**, para puntos, insignias y fondos — `--sem-ok`, `--sem-warn`, `--sem-bad`
- la **legible**, para texto chico — `--success`, `--warning`, `--danger`

El amarillo `#D9B300` de Power BI da 2,0:1 sobre blanco y el mínimo legible es
4,5:1. De ahí el `#8A7200` para texto.

**`--on-accent` y `--on-primary`** son el texto que va *encima* de un relleno de
color. En los temas oscuros el acento es brillante y va texto negro; en los
claros el acento es oscuro y va texto blanco.

Todos los valores de los cuatro temas están comprobados con la medida de
contraste (WCAG) para texto chico sobre su propio panel.
