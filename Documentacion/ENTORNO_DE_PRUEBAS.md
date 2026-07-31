# Entorno de pruebas (beta) — Web Logistica Deam1830

Guía para Daniel. Desde ahora hay **dos mundos separados** que nunca se mezclan.

---

## Los dos mundos

|  | 🟢 PRODUCCIÓN | 🧪 PRUEBAS (beta) |
|---|---|---|
| **Qué es** | La web real, la que usa la gente | Tu campo de juego |
| **Dirección** | `deam1830.com` | `127.0.0.1:5599` (tu PC) y la URL de Render |
| **Datos** | `database.db` — los de verdad | `database_beta.db` — desechables |
| **Rama de código** | `main` | `beta` |
| **Cómo se ve** | Normal | **Marco naranja** + cartel "MODO PRUEBAS" |
| **Quién la cambia** | Solo cuando tú lo pides | Todos los días |

**La regla:** todo el trabajo nuevo va a `beta`. `main` solo se toca el día que dices "lánzalo".

---

## Cómo saber en cuál estás (mira esto SIEMPRE)

- **Marco naranja alrededor de la pantalla + cartel "🧪 MODO PRUEBAS"** → estás en pruebas. Puedes romper lo que quieras.
- **Sin marco, todo normal** → estás en producción. Aquí sí cuenta.
- **Marco ROJO + "⚠️ CUIDADO: DATOS REALES"** → estás en un sitio de pruebas pero conectado a los datos reales. Esto solo pasa si lo fuerzas a propósito. Sal de ahí.

La pestaña del navegador también lo dice: el título empieza con `🧪 BETA ·`.

---

## 1. Probar en tu computadora (lo más rápido)

Doble clic en **`abrir_pruebas.bat`**, dentro de la carpeta del proyecto.

Se abre solo el navegador con la web en modo pruebas. Cuando termines, cierra la ventana minimizada que dice *"Servidor de pruebas - NO CERRAR"*.

> Ojo: esto muestra los archivos **tal como están en tu PC**, sin necesidad de subir nada. Ideal para ver un cambio al instante.

---

## 2. Probar desde internet o el celular (sitio beta en Render)

Esto se configura **una sola vez**:

1. Entra a [dashboard.render.com](https://dashboard.render.com) con tu cuenta.
2. Arriba a la derecha: **New +** → **Static Site**.
3. Elige el repositorio **`dames1830/plataforma-logistica`**.
4. Llena así:
   - **Name:** `logistica-beta`
   - **Branch:** `beta` ← **esto es lo importante, NO pongas main**
   - **Build Command:** *(déjalo vacío)*
   - **Publish Directory:** `.` (solo un punto)
5. Botón **Create Static Site**.

Render te da una dirección tipo `https://logistica-beta.onrender.com`. Ábrela: debe salir el marco naranja.

Desde ese momento, **cada vez que yo suba un cambio a la rama `beta`, ese sitio se actualiza solo** en un par de minutos. Producción no se entera.

---

## 3. Llenar las pruebas con datos reales

Cuando quieras que el entorno de pruebas tenga una copia fresca de la información de verdad, pídemelo y lo ejecuto: **"cópiame los datos a beta"**.

- La copia va en **una sola dirección**: real → pruebas. **Nunca al revés.**
- Lo que tengas en pruebas se pierde (es la idea: empezar de una foto limpia).
- Antes de copiar se revisa que haya espacio en el disco; si no hay, no copia nada.

### Por qué la copia es "ligera"

El disco del servidor es de **1 GB** y tu base real ya pesa **389 MB**. Copiarla entera dejaría el disco al 82%, y con tan poco espacio libre la base real deja de poder "encogerse" cuando se limpia.

Por eso la copia normal se lleva **la versión más reciente de cada área**, saltando las que pesan más de 8 MB. Resultado real de la primera copia (30-jul-2026):

- **44 MB** en lugar de 389 MB
- **41 de 47 áreas** copiadas, con los 5 usuarios reales
- 757 tareas de almacenaje, 28.925 artículos — datos de verdad para probar
- El disco libre casi no se movió: de 568 MB a 524 MB

Las 6 áreas que quedaron fuera por tamaño son las más pesadas:

| Área | Peso |
|---|---|
| buffer | 61 MB |
| layout_activo | 41 MB |
| inventario | 36 MB |
| almacenaje_activo | 36 MB |
| analisis_sku_activo | 20 MB |
| buffer_activo | 20 MB |

Si necesitas probar algo que dependa de esas seis, pídemelo: se puede subir el límite y traerlas (el beta pasaría a ~258 MB y el disco quedaría al 69%). Y si algún día el disco se pone crítico, el sistema borra **primero** la base de pruebas, nunca la real.

---

## 4. Lanzar a producción

Cuando revises algo en beta y estés conforme, me dices:

> **"lánzalo a producción"**

Y yo llevo esos cambios de `beta` a `main`. Recién ahí la web real cambia.

Si algo no te gustó, simplemente no se lanza. Se queda en beta hasta que lo arreglemos.

---

## Preguntas rápidas

**¿Puedo crear usuarios de prueba?**
Sí. En beta los usuarios viven en su propia base. Crea los que quieras: no aparecen en la web real.

**¿Y si borro todo en pruebas?**
No pasa nada. Se vuelve a llenar con una copia de producción cuando quieras.

**¿Los reportes públicos también tienen beta?**
Sí, `reportes.html` funciona igual: en el sitio beta lee datos de prueba, en el real lee los reales.

**¿Esto le hace algo lento a la web real?**
No. En producción el detector de entorno no hace nada: no agrega llamadas, no agrega cabeceras, no pinta nada.

**¿Y si el disco del servidor se llena?**
El sistema borra primero la base de **pruebas** para hacer espacio. La de producción es lo último que toca. Antes era al revés.
