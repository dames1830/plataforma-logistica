/**
 * App Entry Point v24.0.0
 */
import { initApp, navigateTo, currentTab } from './views/dashboard_v24.js?v=24.0.0';
import * as adminService from './services/adminService.js?v=24.0.0';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [APP v24] Arrancando Sistema de Logística...");
    
    // 1. Inicialización de datos con Pull de la Nube (Truth-First)
    try {
        await adminService.initializeAdminData();
        console.log("✅ [APP v24] Datos sincronizados con la nube.");
    } catch (e) {
        console.error("⚠️ [APP v24] Error en sincronización inicial:", e);
    }

    // 2. Montaje de la aplicación
    initApp(document.getElementById('app'));
    
    // 3. Navegación inicial
    const lastTab = localStorage.getItem('logistics_last_tab') || 'inicio';
    navigateTo(lastTab);
});

// Manejo de eventos globales para la UI
window.navigateTo = navigateTo;
