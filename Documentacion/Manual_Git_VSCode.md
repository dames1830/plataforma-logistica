# Manual de Actualización y Subida a Producción (GitHub)

Este documento es una guía paso a paso para actualizar el código, cambiar la versión del sistema y publicar los cambios en vivo en `deam1830.com` usando Visual Studio Code.

---

## FASE 1: Cambiar la Versión del Sistema
*¿Por qué hacer esto?* Para asegurar que los navegadores de los usuarios descarguen el código nuevo y no usen una versión antigua guardada en su caché.

Debes actualizar la versión en **3 archivos clave**. (Ejemplo: pasar de `26.5.284` a `26.5.285`).

### 1. En `index.html` (Línea ~101)
- Ve al Explorador de VS Code y abre `index.html`.
- Busca la línea donde se carga el script principal:
  ```html
  <script src="js/app.js?v=26.5.284" type="module">
  ```
- Cambia los números del final por tu nueva versión.
- Presiona **`Ctrl + S`** para guardar.

### 2. En `js/app.js` (Líneas 4 y 5)
- Abre la carpeta amarilla **`js`** y haz clic en `app.js`.
- Busca las importaciones en la parte superior:
  ```javascript
  import { getSession, logout } from './services_v245/auth.js?v=26.5.284';
  import * as adminService from './services_v245/adminService.js?v=26.5.284';
  ```
- Actualiza la versión en ambas líneas.
- Presiona **`Ctrl + S`** para guardar.

### 3. En `js/views/dashboard_v24.js` (Línea 1)
- Abre la carpeta `js`, luego `views`, y haz clic en `dashboard_v24.js`.
- En la primera línea verás la constante:
  ```javascript
  const VERSION = '26.5.284';
  ```
- Actualiza el número de versión entre las comillas.
- Presiona **`Ctrl + S`** para guardar.

---

## FASE 2: Preparar y Subir los Cambios (Commit & Push)

Ahora que los archivos están guardados, vamos a enviarlos a GitHub.

### 1. Ir a Control de Código Fuente
- En la barra lateral izquierda de VS Code, haz clic en el ícono de **Control de código fuente** (es el tercero de arriba a abajo, parece un nodo con 3 bolitas).

### 2. Preparar los archivos ("Stage")
- En la lista que dice **Cambios**, verás los archivos que modificaste (tendrán una "M" a la derecha).
- Pasa el mouse sobre `index.html`, `app.js` y `dashboard_v24.js`.
- A cada uno, hazle clic en el ícono de **`+`** que aparece al lado de la "M".
- Verás que los archivos se mueven arriba, a una nueva sección llamada **Cambios "staged"**. *(Asegúrate de que estén los 3 archivos ahí).*

### 3. Crear el Mensaje (Commit)
- En la parte superior de ese panel, hay una caja de texto que dice `Mensaje (Ctrl+Enter para confirmar...`.
- Haz clic ahí y escribe qué cambiaste. Ejemplo: `Actualizando a version 285 por cambios en analisis`.
- Haz clic en el botón azul grande que dice **Confirmación**.
- *Nota: En este punto, los archivos están empaquetados en tu PC, pero aún no en internet.*

### 4. Empujar a Internet (Push)
Tienes dos formas sencillas de hacerlo:
- **Opción A (Botón de Sincronizar):** Si el botón azul grande cambió y ahora dice **Sincronizar cambios**, simplemente hazle clic.
- **Opción B (Usando el panel GRAPH):** Mira abajo a la izquierda en tu pantalla, en la sección llamada **GRAPH**. Verás tu mensaje de cambio, y a la derecha de un óvalo azul que dice `main`, verás un ícono de una **Nube Morada con una flecha hacia arriba**. Haz clic en esa nube.

Verás una barrita azul moviéndose en la parte superior del panel izquierdo. Cuando desaparezca, ¡tus cambios ya están en GitHub!

---

## FASE 3: Ver en Producción

1. Una vez hecho el Push, el sistema automatizado de GitHub (Actions) se encenderá.
2. Espera exactamente **2 a 3 minutos**.
3. Abre tu página web (`deam1830.com`).
4. Presiona **`Ctrl + Shift + R`** en tu teclado. Esto forzará al navegador a limpiar la basura y descargar la versión nueva que acabas de subir.

¡Listo! Tu código ha sido desplegado exitosamente.
