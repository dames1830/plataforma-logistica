export const renderDashboard = async (root, user, logout) => {
    root.innerHTML = `<div style="color:white; padding:2rem;">
        <h1>MODO DE PRUEBA ACTIVO</h1>
        <p>Si ves esto, el sistema de importación funciona. El problema está en el contenido de dashboard_v6.js</p>
        <button onclick="location.reload()">REINTENTAR CARGA REAL</button>
    </div>`;
};
