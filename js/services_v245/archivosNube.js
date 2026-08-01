/* ============================================================================
   ARCHIVOS NUBE
   ----------------------------------------------------------------------------
   Los archivos que el robot deja en el servidor cada noche y que los asistentes
   descargan desde Inventario > Descargas.

   Acá NO se procesan datos: el archivo baja tal cual se subió. El Slotting es
   un .xlsx con tabla dinámica adentro, y la dinámica solo sobrevive si el
   archivo viaja entero. Si se rearmara desde las filas, bajaría tabla plana.

   El sello de entorno ("X-Environment: beta") lo pone env.js envolviendo el
   fetch; acá no hay que agregarlo. Por eso mismo la descarga va por fetch y no
   por un enlace directo: un <a href> se saltea ese envoltorio y en pruebas te
   bajarías el archivo de PRODUCCIÓN sin enterarte.
   ============================================================================ */

const getApiBase = (porDefecto) => {
  try {
    if (localStorage.getItem('PULSE_USE_LOCAL') === 'true') return 'http://localhost:8000/api';
  } catch (e) { /* sin localStorage (modo privado): se usa el de siempre */ }
  return window.API_BASE_URL ? (window.API_BASE_URL + '/api') : porDefecto;
};

const API = getApiBase('https://logistics-backend-wv0x.onrender.com/api') + '/archivos';

/** La ficha de cada archivo (nombre, fecha, peso). No trae el contenido. */
export async function listarArchivos(modulo) {
  try {
    const res = await fetch(`${API}/${modulo}?z=${Date.now()}`);
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'No se pudo leer la lista');
    return { archivos: data.archivos || [], maximo: data.maximo || 0 };
  } catch (e) {
    console.error('[ARCHIVOS NUBE] No se pudo listar:', e);
    throw e;
  }
}

/** Baja el archivo y se lo entrega al navegador con su nombre original. */
export async function descargarArchivo(modulo, archivo) {
  const res = await fetch(`${API}/${modulo}/${archivo.id}`);
  if (!res.ok) {
    // El backend contesta 404 cuando el archivo ya rotó y salió de los últimos 6.
    if (res.status === 404) throw new Error('Ese archivo ya no está en el servidor');
    throw new Error('El servidor respondió ' + res.status);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.nombre || 'archivo.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Sin esto el archivo queda ocupando memoria del navegador hasta recargar.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return blob.size;
}

export async function borrarArchivo(modulo, id) {
  const res = await fetch(`${API}/${modulo}/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'No se pudo borrar');
  return true;
}
