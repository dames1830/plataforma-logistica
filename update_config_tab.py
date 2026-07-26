# -*- coding: utf-8 -*-
with open("js/views/dashboard_v28.js", "r", encoding="utf-8") as f:
    text = f.read()

OLD_CONFIG = """  const renderConfigTab = async () => {
    contentSubtitle.textContent = "Panel de Control Técnico";
    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeConfigSub==='parametros'?'active':''}" data-s="parametros" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">⚙️ PARÁMETROS</a>
          <a class="sub-nav-item ${activeConfigSub==='conexion'?'active':''}" data-s="conexion" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🌐 CONEXIÓN</a>
          <a class="sub-nav-item ${activeConfigSub==='mantenimiento'?'active':''}" data-s="mantenimiento" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🛠️ MANTENIMIENTO</a>
        </nav><div id="configContent"></div>`;
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { activeConfigSub = e.target.dataset.s; renderConfigTab(); }));
    
    if (activeConfigSub === 'parametros') {
        document.getElementById('configContent').innerHTML = `<div class="glass-panel" style="max-width:450px; padding:1.5rem;"><h4 style="font-size:0.95rem; margin-top:0;">Configuración de Motor</h4>${['include_reserva', 'include_alto'].map(k => `<label style="display:flex; justify-content:space-between; margin:0.8rem 0; font-size:0.85rem;">${k.toUpperCase().replace('_', ' ')} <input type="checkbox" checked></label>`).join('')}<button class="btn" style="font-size:0.85rem; padding:0.6rem;">GUARDAR CAMBIOS</button></div>`;
    } else if (activeConfigSub === 'mantenimiento') {
        document.getElementById('configContent').innerHTML = `
            <div class="glass-panel" style="max-width:450px; padding:1.5rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                <h4 style="color:#f87171; font-size:0.95rem; margin-top:0;">Zona de Peligro</h4>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem;">Utiliza estas opciones para limpiar la base de datos de pruebas. Esta acción no se puede deshacer.</p>
                <button id="resetDataBtn" class="btn" style="background:#ef4444; font-size:0.85rem; padding:0.7rem; font-weight:700;">⚠️ REINICIAR ASISTENCIA Y PERFORMANCE</button>
            </div>
        `;
        document.getElementById('resetDataBtn').onclick = async () => {
            if (await showPremiumConfirm("ZONA DE PELIGRO - REINICIAR DATOS", "¿ESTÁS SEGURO? Se borrará TODO el historial de asistencia y performance de forma permanente. Los trabajadores NO se borrarán.", "danger")) {
                await adminService.resetProductionData();
                alert("✅ Se han reiniciado los datos. La aplicación se recargará.");
                window.location.reload();
            }
        };
    } else {
        document.getElementById('configContent').innerHTML = `<div style="padding:1.5rem; font-size:0.85rem;">Estado de API: <span style="color:var(--success); font-weight:bold;">CONECTADO</span></div>`;
    }
  };"""

NEW_CONFIG = """  const renderConfigTab = async () => {
    contentSubtitle.textContent = "Panel de Control Técnico";
    if (!activeConfigSub || activeConfigSub === 'parametros') activeConfigSub = 'reportes';
    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeConfigSub==='reportes'?'active':''}" data-s="reportes" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">📊 REPORTES</a>
          <a class="sub-nav-item ${activeConfigSub==='parametros'?'active':''}" data-s="parametros" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">⚙️ PARÁMETROS</a>
          <a class="sub-nav-item ${activeConfigSub==='conexion'?'active':''}" data-s="conexion" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🌐 CONEXIÓN</a>
          <a class="sub-nav-item ${activeConfigSub==='mantenimiento'?'active':''}" data-s="mantenimiento" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🛠️ MANTENIMIENTO</a>
        </nav><div id="configContent"></div>`;
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { activeConfigSub = e.target.dataset.s; renderConfigTab(); }));
    
    if (activeConfigSub === 'reportes') {
        const configData = adminService.getPublicReportsConfig();
        const availableModules = [
            { id: 'inventario', label: 'Inventario' },
            { id: 'picking', label: 'Picking' },
            { id: 'packing', label: 'Packing' },
            { id: 'despacho', label: 'Despacho' },
            { id: 'no_retail', label: 'NO RETAIL' },
            { id: 'recepcion', label: 'Recepción' },
            { id: 'almacenaje', label: 'Almacenaje (Todos)' },
            { id: 'buffer', label: 'Zona Buffer (Todos)' },
            { id: 'analisis_sku', label: 'Análisis SKU' }
        ];

        const availableSubAlmacenaje = [
            { id: 'reporte_marcas', label: 'Marcas (Día/Noche)' },
            { id: 'rendimiento_ops', label: 'Rendimiento Operarios' },
            { id: 'produccion_hora', label: 'Producción por Hora' },
            { id: 'almacenado_semana', label: 'Almacenado Semana/Marca' },
            { id: 'grafico_rendimiento', label: 'Gráfico Rendimiento' }
        ];

        const availableSubBuffer = [
            { id: 'historial_buffer', label: 'Historial Buffer' },
            { id: 'analisis_buffer', label: 'Análisis Buffer' }
        ];

        const generateSecureToken = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = 'tok_sec_';
            for (let i = 0; i < 16; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };

        const renderPublicReportsTable = () => {
            const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/reportes.html');
            const rowsHtml = configData.map((g, idx) => {
                const fullLink = `${baseUrl}?token=${g.token}`;
                return `
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:0.8rem; font-weight:800; color:#fff;">${g.nombre}</td>
                        <td style="padding:0.8rem;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <input type="text" readonly value="${fullLink}" style="background:#0a0f1e; border:1px solid var(--border); color:#818cf8; padding:4px 8px; border-radius:6px; font-size:0.75rem; width:260px;" id="link_input_${idx}">
                                <button class="btn btn-copy-link" data-link="${fullLink}" style="font-size:0.7rem; padding:4px 8px; background:rgba(129,140,248,0.2); color:#818cf8;">📋 Copiar</button>
                            </div>
                        </td>
                        <td style="padding:0.8rem;">
                            <button class="btn btn-edit-perm" data-idx="${idx}" style="font-size:0.75rem; padding:4px 10px; background:rgba(0,229,255,0.15); color:#00E5FF; border:1px solid #00E5FF;">✏️ Configurar Permisos (${(g.modulos||[]).length} Módulos)</button>
                        </td>
                        <td style="padding:0.8rem;">
                            <div style="display:flex; gap:6px;">
                                <button class="btn btn-regen-tok" data-idx="${idx}" title="Regenerar Token Seguro" style="font-size:0.7rem; padding:4px 8px; background:rgba(251,191,36,0.2); color:#fbbf24;">🔄 Nuevo Token</button>
                                <button class="btn btn-del-grp" data-idx="${idx}" title="Eliminar Grupo" style="font-size:0.7rem; padding:4px 8px; background:rgba(239,68,68,0.2); color:#f87171;">🗑️ Eliminar</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="glass-panel" style="padding:1.5rem; border:1px solid rgba(0,229,255,0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
                        <div>
                            <h4 style="color:#00E5FF; font-size:1rem; margin:0; font-family:'Outfit', sans-serif; font-weight:900;">ADMINISTRACIÓN DINÁMICA DE REPORTES PÚBLICOS</h4>
                            <p style="margin:4px 0 0; font-size:0.78rem; color:var(--text-muted);">Crea grupos, genera links seguros y configura permisos de visualización en tiempo real sin desplegar código.</p>
                        </div>
                        <button id="btnNewReportGroup" class="btn" style="font-size:0.8rem; padding:0.6rem 1.2rem; background:linear-gradient(135deg,#00E5FF,#3b82f6); color:#000; font-weight:900;">➕ CREAR NUEVO GRUPO</button>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                            <thead>
                                <tr style="color:var(--text-muted); text-transform:uppercase; font-size:0.7rem; border-bottom:1px solid var(--border); text-align:left;">
                                    <th style="padding:0.6rem 0.8rem;">GRUPO</th>
                                    <th style="padding:0.6rem 0.8rem;">LINK SEGURO GENERADO</th>
                                    <th style="padding:0.6rem 0.8rem;">MATRIZ DE PERMISOS</th>
                                    <th style="padding:0.6rem 0.8rem;">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>
                </div>
            `;
        };

        const configContainer = document.getElementById('configContent');
        configContainer.innerHTML = renderPublicReportsTable();

        const openPermissionsModal = (idx) => {
            const g = configData[idx];
            const modal = document.createElement('div');
            modal.style.position = 'fixed'; modal.style.top = '0'; modal.style.left = '0';
            modal.style.width = '100vw'; modal.style.height = '100vh';
            modal.style.backgroundColor = 'rgba(15, 23, 42, 0.85)'; modal.style.backdropFilter = 'blur(10px)';
            modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
            modal.style.zIndex = '99999';

            const modulosChecked = new Set(g.modulos || []);
            const almChecked = new Set(g.reportesAlmacenaje || []);
            const bufChecked = new Set(g.reportesBuffer || []);

            modal.innerHTML = `
                <div class="glass-panel" style="width:90%; max-width:650px; max-height:85vh; overflow-y:auto; padding:1.8rem; border:1px solid #00E5FF; box-shadow:0 0 30px rgba(0,229,255,0.2);">
                    <h3 style="color:#00E5FF; margin-top:0; font-family:'Outfit', sans-serif; font-weight:900;">⚙️ PERMISOS DE VISUALIZACIÓN: ${g.nombre}</h3>
                    <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1rem;">Selecciona los módulos y sub-reportes autorizados para este link público.</p>

                    <h4 style="color:#fff; font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:4px; margin-top:1rem;">MÓDULOS PRINCIPALES</h4>
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:1rem;">
                        ${availableModules.map(m => `
                            <label style="font-size:0.8rem; color:#cbd5e1; display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" class="chk-mod" value="${m.id}" ${modulosChecked.has(m.id)?'checked':''}> ${m.label}
                            </label>
                        `).join('')}
                    </div>

                    <h4 style="color:#fff; font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:4px; margin-top:1rem;">SUB-REPORTES DE ALMACENAJE</h4>
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:1rem;">
                        ${availableSubAlmacenaje.map(s => `
                            <label style="font-size:0.8rem; color:#cbd5e1; display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" class="chk-alm" value="${s.id}" ${almChecked.has(s.id)?'checked':''}> ${s.label}
                            </label>
                        `).join('')}
                    </div>

                    <h4 style="color:#fff; font-size:0.85rem; border-bottom:1px solid var(--border); padding-bottom:4px; margin-top:1rem;">SUB-REPORTES DE ZONA BUFFER</h4>
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:1.5rem;">
                        ${availableSubBuffer.map(b => `
                            <label style="font-size:0.8rem; color:#cbd5e1; display:flex; align-items:center; gap:8px; cursor:pointer;">
                                <input type="checkbox" class="chk-buf" value="${b.id}" ${bufChecked.has(b.id)?'checked':''}> ${b.label}
                            </label>
                        `).join('')}
                    </div>

                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button id="btnCloseModal" class="btn" style="background:none; border:1px solid var(--border); color:var(--text-muted); padding:0.6rem 1.2rem;">Cancelar</button>
                        <button id="btnSavePerms" class="btn" style="background:#00E5FF; color:#000; font-weight:900; padding:0.6rem 1.4rem;">💾 GUARDAR PERMISOS</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#btnCloseModal').onclick = () => document.body.removeChild(modal);
            modal.querySelector('#btnSavePerms').onclick = async () => {
                const newModulos = Array.from(modal.querySelectorAll('.chk-mod:checked')).map(c => c.value);
                const newAlm = Array.from(modal.querySelectorAll('.chk-alm:checked')).map(c => c.value);
                const newBuf = Array.from(modal.querySelectorAll('.chk-buf:checked')).map(c => c.value);

                g.modulos = newModulos;
                g.reportesAlmacenaje = newAlm;
                g.reportesBuffer = newBuf;

                await adminService.savePublicReportsConfig(configData);
                document.body.removeChild(modal);
                configContainer.innerHTML = renderPublicReportsTable();
                bindTableEvents();
                showPremiumAlert("PERMISOS GUARDADOS", `Los permisos para el grupo ${g.nombre} han sido actualizados en tiempo real.`, "success");
            };
        };

        const bindTableEvents = () => {
            configContainer.querySelectorAll('.btn-copy-link').forEach(btn => {
                btn.onclick = () => {
                    const link = btn.dataset.link;
                    navigator.clipboard.writeText(link);
                    btn.textContent = "✅ ¡Copiado!";
                    setTimeout(() => btn.textContent = "📋 Copiar", 2000);
                };
            });

            configContainer.querySelectorAll('.btn-edit-perm').forEach(btn => {
                btn.onclick = () => openPermissionsModal(parseInt(btn.dataset.idx));
            });

            configContainer.querySelectorAll('.btn-regen-tok').forEach(btn => {
                btn.onclick = async () => {
                    const idx = parseInt(btn.dataset.idx);
                    if (await showPremiumConfirm("REGENERAR TOKEN SEGURO", `¿Estás seguro de regenerar el token de ${configData[idx].nombre}? El enlace actual dejará de funcionar inmediatamente.`, "warning")) {
                        configData[idx].token = generateSecureToken();
                        await adminService.savePublicReportsConfig(configData);
                        configContainer.innerHTML = renderPublicReportsTable();
                        bindTableEvents();
                        showPremiumAlert("TOKEN ACTUALIZADO", "Se generó un nuevo token seguro para el grupo.", "success");
                    }
                };
            });

            configContainer.querySelectorAll('.btn-del-grp').forEach(btn => {
                btn.onclick = async () => {
                    const idx = parseInt(btn.dataset.idx);
                    if (await showPremiumConfirm("ELIMINAR GRUPO", `¿Deseas eliminar el grupo ${configData[idx].nombre}? Su enlace público será revocado de inmediato.`, "danger")) {
                        configData.splice(idx, 1);
                        await adminService.savePublicReportsConfig(configData);
                        configContainer.innerHTML = renderPublicReportsTable();
                        bindTableEvents();
                        showPremiumAlert("GRUPO ELIMINADO", "El grupo y su enlace han sido revocados.", "success");
                    }
                };
            });

            const newGroupBtn = configContainer.querySelector('#btnNewReportGroup');
            if (newGroupBtn) {
                newGroupBtn.onclick = async () => {
                    const nombre = prompt("Ingresa el nombre del nuevo grupo de reportes (Ej: AUDITORES, CLIENTES_VIP):");
                    if (nombre && nombre.trim()) {
                        const cleanName = nombre.trim().toUpperCase();
                        configData.push({
                            id: 'grp_' + Date.now(),
                            nombre: cleanName,
                            token: generateSecureToken(),
                            modulos: ['inventario', 'picking', 'packing', 'despacho', 'no_retail', 'recepcion'],
                            reportesAlmacenaje: [],
                            reportesBuffer: []
                        });
                        await adminService.savePublicReportsConfig(configData);
                        configContainer.innerHTML = renderPublicReportsTable();
                        bindTableEvents();
                        showPremiumAlert("GRUPO CREADO", `Se creó el grupo ${cleanName} con su token seguro automático.`, "success");
                    }
                };
            }
        };

        bindTableEvents();
    } else if (activeConfigSub === 'parametros') {
        document.getElementById('configContent').innerHTML = `<div class="glass-panel" style="max-width:450px; padding:1.5rem;"><h4 style="font-size:0.95rem; margin-top:0;">Configuración de Motor</h4>${['include_reserva', 'include_alto'].map(k => `<label style="display:flex; justify-content:space-between; margin:0.8rem 0; font-size:0.85rem;">${k.toUpperCase().replace('_', ' ')} <input type="checkbox" checked></label>`).join('')}<button class="btn" style="font-size:0.85rem; padding:0.6rem;">GUARDAR CAMBIOS</button></div>`;
    } else if (activeConfigSub === 'mantenimiento') {
        document.getElementById('configContent').innerHTML = `
            <div class="glass-panel" style="max-width:450px; padding:1.5rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                <h4 style="color:#f87171; font-size:0.95rem; margin-top:0;">Zona de Peligro</h4>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem;">Utiliza estas opciones para limpiar la base de datos de pruebas. Esta acción no se puede deshacer.</p>
                <button id="resetDataBtn" class="btn" style="background:#ef4444; font-size:0.85rem; padding:0.7rem; font-weight:700;">⚠️ REINICIAR ASISTENCIA Y PERFORMANCE</button>
            </div>
        `;
        document.getElementById('resetDataBtn').onclick = async () => {
            if (await showPremiumConfirm("ZONA DE PELIGRO - REINICIAR DATOS", "¿ESTÁS SEGURO? Se borrará TODO el historial de asistencia y performance de forma permanente. Los trabajadores NO se borrarán.", "danger")) {
                await adminService.resetProductionData();
                alert("✅ Se han reiniciado los datos. La aplicación se recargará.");
                window.location.reload();
            }
        };
    } else {
        document.getElementById('configContent').innerHTML = `<div style="padding:1.5rem; font-size:0.85rem;">Estado de API: <span style="color:var(--success); font-weight:bold;">CONECTADO</span></div>`;
    }
  };"""

if OLD_CONFIG in text:
    text = text.replace(OLD_CONFIG, NEW_CONFIG)
    print("Config tab updated successfully with REPORTES management panel.")
else:
    print("ERROR: OLD_CONFIG not found in dashboard_v28.js")

with open("js/views/dashboard_v28.js", "w", encoding="utf-8") as f:
    f.write(text)
