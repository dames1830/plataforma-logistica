/**
 * Admin Module - Gestión de Personal, Asistencia y Performance
 * Extraído de dashboard_v6.js para optimización de rendimiento.
 */
import * as adminService from '../services/adminService.js?v=27';

let activeAdminSub = 'trabajadores';
let activePerfSub = 'historial';
let forcedDate = new Date().toISOString().split('T')[0];
let localState = [];
let kpiStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
let kpiEnd = new Date().toISOString().split('T')[0];
let kpiSearch = '';

export const getActiveAdminSub = () => activeAdminSub;

export const renderAdminTab = (container, user, TABS) => {
    const adminTabDef = TABS.find(t => t.id === 'admin_pers');
    const rolePerms = adminService.getPermissions(user.role) || {};
    
    const allowedSubTabs = adminTabDef.subTabs.filter(sub => {
        if (user.role === 'admin') return true;
        const key = `admin_pers_${sub.id}`;
        return rolePerms[key] === 1;
    });

    if (!allowedSubTabs.find(s => s.id === activeAdminSub)) {
        activeAdminSub = allowedSubTabs[0]?.id || '';
    }

    if (!activeAdminSub) {
        container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No tienes permisos para acceder a las secciones de Administración.</div>`;
        return;
    }

    container.innerHTML = `
        <nav class="sub-nav" style="display:flex; gap:1.5rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem; overflow-x:auto;">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeAdminSub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.5rem 0.2rem; font-size: 0.85rem; white-space:nowrap; cursor:pointer;">
              ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="adminContent"></div>`;
    
    container.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        activeAdminSub = e.currentTarget.dataset.s; 
        renderAdminTab(container, user, TABS); 
    }));

    const adminContainer = document.getElementById('adminContent');
    
    if (activeAdminSub === 'trabajadores') renderTrabajadoresSection(adminContainer, user, TABS);
    else if (activeAdminSub === 'usuarios') renderUsuariosSection(adminContainer, user, TABS);
    else if (activeAdminSub === 'permisos') renderPermisosSection(adminContainer, user, TABS);
    else if (activeAdminSub === 'asistencia') renderAsistenciaSection(adminContainer, user, TABS);
    else if (activeAdminSub === 'performance') renderPerformanceSection(adminContainer, user, TABS);
    else if (activeAdminSub === 'rfs') renderRFSection(adminContainer, user, TABS);
};

const renderTrabajadoresSection = (container, user, TABS) => {
    const workers = adminService.getWorkers();
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 300px; gap:1.5rem;">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
                    <h3 style="color:var(--primary); margin:0;">Base de Datos de Trabajadores</h3>
                    <label class="btn" style="width:auto; background:var(--success); font-size:0.75rem; padding:0.4rem 0.8rem;">
                        📥 IMPORTAR EXCEL <input type="file" id="import_workers" accept=".xlsx,.xls" style="display:none;">
                    </label>
                </div>
                <div class="glass-panel" style="padding:0; overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                        <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                            <tr>
                                <th style="padding:0.7rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                                <th style="padding:0.7rem; text-align:left;">Estado</th>
                                <th style="padding:0.7rem; text-align:left;">DNI</th>
                                <th style="padding:0.7rem; text-align:left;">Nombre</th>
                                <th style="padding:0.7rem; text-align:left;">Apellidos</th>
                                <th style="padding:0.7rem; text-align:left;">Puesto</th>
                                <th style="padding:0.7rem; text-align:left;">Turno</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${workers.length ? workers.map((w, idx) => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.02); opacity: ${w.active === false ? '0.5' : '1'}">
                                    <td style="padding:0.7rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                                    <td style="padding:0.7rem; text-align:center;">
                                        <button class="btn-worker-status" data-dni="${w.dni || w.Dni}" title="${w.active === false ? 'Activar' : 'Desactivar'}" style="background:none; border:none; cursor:pointer; font-size:1rem;">
                                            ${w.active === false ? '❌' : '✅'}
                                        </button>
                                    </td>
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="dni" contenteditable="true" style="padding:0.7rem; font-weight:800; color:#fff; outline:none;">${w.dni || w.Dni || ''}</td>
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="nombre" contenteditable="true" style="padding:0.7rem; outline:none; text-transform:uppercase;">${w.nombre || w.Nombre || ''}</td>
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="apellidos" contenteditable="true" style="padding:0.7rem; outline:none; text-transform:uppercase;">${w.apellidos || w.Apellidos || ''}</td>
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="puesto" contenteditable="true" style="padding:0.7rem; outline:none; text-transform:uppercase;">${w.puesto || w.Puesto || ''}</td>
                                    <td style="padding:0.7rem;">
                                        <select class="edit-worker-select" data-dni="${w.dni || w.Dni}" data-f="turno" style="background:rgba(255,255,255,0.05); border:none; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.65rem; outline:none; cursor:pointer;">
                                            <option value="DIA" ${ (w.turno||w.Turno)==='DIA'?'selected':'' }>DIA</option>
                                            <option value="NOCHE" ${ (w.turno||w.Turno)==='NOCHE'?'selected':'' }>NOCHE</option>
                                        </select>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--text-muted);">No hay trabajadores cargados.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="glass-panel" style="background:rgba(79, 70, 229, 0.05); border-color:rgba(79, 70, 229, 0.2);">
                <h4 style="margin:0 0 1rem 0; color:#fff; font-size:0.9rem;">➕ Nuevo Trabajador</h4>
                <form id="form_new_worker" style="display:flex; flex-direction:column; gap:0.8rem;">
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">DNI</label>
                        <input type="text" id="nw_dni" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">NOMBRE</label>
                        <input type="text" id="nw_nombre" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">APELLIDOS</label>
                        <input type="text" id="nw_apellidos" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">PUESTO</label>
                        <input type="text" id="nw_puesto" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">TURNO</label>
                        <select id="nw_turno" style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                            <option value="DIA" style="background:#0f172a;">DIA</option>
                            <option value="NOCHE" style="background:#0f172a;">NOCHE</option>
                        </select>
                    </div>
                    <button type="submit" class="btn" style="background:var(--primary); margin-top:0.5rem; padding:0.6rem; font-size:0.8rem; font-weight:800;">GUARDAR TRABAJADOR</button>
                </form>
            </div>
        </div>
    `;

    container.querySelector('#form_new_worker').onsubmit = (e) => {
        e.preventDefault();
        const nw = {
            dni: document.getElementById('nw_dni').value.trim(),
            nombre: document.getElementById('nw_nombre').value.toUpperCase().trim(),
            apellidos: document.getElementById('nw_apellidos').value.toUpperCase().trim(),
            puesto: document.getElementById('nw_puesto').value.toUpperCase().trim(),
            turno: document.getElementById('nw_turno').value
        };
        adminService.saveWorker(nw);
        renderAdminTab(container.parentElement.parentElement, user, TABS);
    };

    container.querySelectorAll('.btn-worker-status').forEach(btn => {
        btn.onclick = () => {
            adminService.toggleWorkerStatus(btn.dataset.dni);
            renderAdminTab(container.parentElement.parentElement, user, TABS);
        };
    });

    container.querySelectorAll('.edit-worker').forEach(cell => {
        cell.onblur = (e) => {
            const dni = e.target.dataset.dni;
            const field = e.target.dataset.f;
            const val = e.target.innerText.trim();
            const updates = {};
            updates[field] = (field === 'dni') ? val : val.toUpperCase();
            adminService.saveWorker({ dni, ...updates });
            if (field === 'dni') renderAdminTab(container.parentElement.parentElement, user, TABS);
        };
    });

    container.querySelectorAll('.edit-worker-select').forEach(sel => {
        sel.onchange = (e) => {
            const dni = e.target.dataset.dni;
            const field = e.target.dataset.f;
            const val = e.target.value;
            const updates = {};
            updates[field] = val;
            adminService.saveWorker({ dni, ...updates });
        };
    });

    container.querySelector('#import_workers').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            const normalized = json.map(row => {
                const newRow = {};
                for (let key in row) {
                    newRow[key.toLowerCase().trim()] = row[key];
                }
                return newRow;
            });
            adminService.saveWorkers(normalized);
            renderAdminTab(container.parentElement.parentElement, user, TABS);
        };
        reader.readAsArrayBuffer(file);
    });
};

const renderUsuariosSection = (container, user, TABS) => {
    const users = adminService.getUsers();
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 300px; gap:1.5rem;">
            <div>
                <h3 style="color:var(--primary); margin-bottom:1rem;">Usuarios de la Plataforma</h3>
                <div class="glass-panel" style="padding:0; overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead style="background:rgba(255,255,255,0.05);">
                            <tr>
                                <th style="padding:0.8rem; text-align:left;">Estado</th>
                                <th style="padding:0.8rem; text-align:left;">Nombre</th>
                                <th style="padding:0.8rem; text-align:left;">Usuario</th>
                                <th style="padding:0.8rem; text-align:left;">Contraseña</th>
                                <th style="padding:0.8rem; text-align:left;">Rol</th>
                                <th style="padding:0.8rem; text-align:center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.length ? users.map(u => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.02); opacity: ${u.active === false ? '0.5' : '1'}">
                                    <td style="padding:0.8rem; text-align:center;">
                                        <button class="btn-status" data-user="${u.username}" title="${u.active === false ? 'Activar' : 'Desactivar'}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;">
                                            ${u.active === false ? '❌' : '✅'}
                                        </button>
                                    </td>
                                    <td style="padding:0.8rem; font-weight:600;">${u.name}</td>
                                    <td style="padding:0.8rem; color:var(--text-muted);">${u.username}</td>
                                    <td style="padding:0.8rem; font-family:monospace; color:#fcd34d;">${u.password}</td>
                                    <td style="padding:0.8rem;"><span style="background:rgba(79,70,229,0.2); color:#a5b4fc; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:700;">${u.role.toUpperCase()}</span></td>
                                    <td style="padding:0.8rem; text-align:center;">
                                        <div style="display:flex; gap:0.8rem; justify-content:center;">
                                            <button class="btn-edit" data-user='${JSON.stringify(u)}' title="Editar" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:1rem;">✏️</button>
                                            <button class="btn-del" data-user="${u.username}" title="Eliminar" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:1rem;">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" style="padding:1rem; text-align:center; color:var(--text-muted);">No hay usuarios adicionales creados.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h3 style="color:var(--primary); margin-bottom:1rem;" id="form_title">Nuevo Usuario</h3>
                <div class="glass-panel" style="padding:1.2rem; border-color:rgba(255,255,255,0.1);">
                    <form id="form_user" style="display:flex; flex-direction:column; gap:0.8rem;" autocomplete="off">
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">NOMBRE COMPLETO:</label>
                            <input type="text" id="u_name" placeholder="Ej: Juan Pérez" autocomplete="off" style="width:100%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:0.6rem; border-radius:6px; outline:none;" required>
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">USUARIO (LOGIN):</label>
                            <input type="text" id="u_username" placeholder="Ej: jperez" autocomplete="one-time-code" style="width:100%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:0.6rem; border-radius:6px; outline:none;" required>
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">CONTRASEÑA:</label>
                            <input type="password" id="u_pass" placeholder="••••••••" autocomplete="new-password" style="width:100%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:0.6rem; border-radius:6px; outline:none;" required>
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">ROL ASIGNADO:</label>
                            <select id="u_role" style="width:100%; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.3); color:#fff; padding:0.6rem; border-radius:6px; outline:none; cursor:pointer;">
                                <option value="admin" style="background:#1e293b;">ADMIN</option>
                                <option value="jefe" style="background:#1e293b;">JEFE</option>
                                <option value="supervisor" style="background:#1e293b;">SUPERVISOR</option>
                                <option value="encargado" style="background:#1e293b;">ENCARGADO</option>
                                <option value="asistente" style="background:#1e293b;">ASISTENTE</option>
                            </select>
                        </div>
                        <button type="submit" id="btn_submit_user" class="btn" style="padding:0.7rem; font-weight:700; margin-top:0.5rem;">GUARDAR USUARIO</button>
                        <button type="button" id="btn_cancel_edit" style="display:none; background:none; border:none; color:var(--text-muted); font-size:0.75rem; cursor:pointer; text-decoration:underline;">Cancelar edición</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    const form = container.querySelector('#form_user');
    const uName = container.querySelector('#u_name');
    const uUser = container.querySelector('#u_username');
    const uPass = container.querySelector('#u_pass');
    const uRole = container.querySelector('#u_role');
    const uTitle = container.querySelector('#form_title');
    const btnSubmit = container.querySelector('#btn_submit_user');
    const btnCancel = container.querySelector('#btn_cancel_edit');

    let isEditing = false;

    // LÓGICA DE USUARIO AUTOMÁTICO
    uName.addEventListener('input', () => {
        if (!isEditing) {
            // Convertir a minúsculas, quitar acentos y espacios
            const autoUser = uName.value.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita tildes
                .replace(/\s+/g, '') // Quita espacios
                .substring(0, 15); // Limitar largo
            uUser.value = autoUser;
        }
    });

    form.onsubmit = (e) => {
        e.preventDefault();
        const newUser = {
            name: uName.value,
            username: uUser.value,
            password: uPass.value,
            role: uRole.value
        };
        adminService.saveUser(newUser);
        alert(isEditing ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito');
        form.reset();
        if (isEditing) {
            uUser.readOnly = false;
            uUser.style.opacity = '1';
            uTitle.textContent = "Nuevo Usuario";
            btnSubmit.textContent = "GUARDAR USUARIO";
            btnCancel.style.display = 'none';
            isEditing = false;
        }
        renderAdminTab(container.parentElement.parentElement, user, TABS);
    };

    container.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = (e) => {
        const u = JSON.parse(e.currentTarget.dataset.user);
        uName.value = u.name;
        uUser.value = u.username;
        uUser.readOnly = true;
        uUser.style.opacity = '0.5';
        uPass.value = u.password;
        uRole.value = u.role;
        uTitle.textContent = "Editar Usuario";
        btnSubmit.textContent = "ACTUALIZAR DATOS";
        btnCancel.style.display = 'block';
        isEditing = true;
    });

    btnCancel.onclick = () => {
        form.reset();
        uUser.readOnly = false;
        uUser.style.opacity = '1';
        uTitle.textContent = "Nuevo Usuario";
        btnSubmit.textContent = "GUARDAR USUARIO";
        btnCancel.style.display = 'none';
        isEditing = false;
    };

    container.querySelectorAll('.btn-status').forEach(btn => btn.onclick = () => {
        adminService.toggleUserStatus(btn.dataset.user);
        renderAdminTab(container.parentElement.parentElement, user, TABS);
    });

    container.querySelectorAll('.btn-del').forEach(btn => btn.onclick = () => {
        if (confirm('¿Estás seguro de eliminar permanentemente este usuario?')) {
            adminService.deleteUser(btn.dataset.user);
            renderAdminTab(container.parentElement.parentElement, user, TABS);
        }
    });
};

const renderPermisosSection = (container, user, TABS) => {
    const roles = ['jefe', 'supervisor', 'encargado', 'asistente'];
    const allRoles = ['admin', ...roles];
    
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="color:var(--primary); margin:0;">Matriz de Permisos Dinámica</h3>
            <span style="font-size:0.7rem; color:var(--success); font-weight:600;">✨ Haz clic en un módulo para expandir sus sub-pestañas</span>
        </div>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);">
                        <th style="padding:1rem; text-align:left; border-right:1px solid var(--border);">MÓDULO / SECCIÓN</th>
                        ${allRoles.map(r => `<th style="padding:1rem; text-align:center;">${r.toUpperCase()}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${TABS.map(t => {
                        let rows = [];
                        const hasSub = t.subTabs && t.subTabs.length > 0;
                        rows.push(`
                        <tr class="main-tab-row" data-tab-id="${t.id}" style="border-bottom:1px solid rgba(255,255,255,0.02); background:rgba(255,255,255,0.02); cursor:${hasSub ? 'pointer' : 'default'};">
                            <td style="padding:0.8rem; font-weight:700; border-right:1px solid var(--border); color:#fff; display:flex; align-items:center; gap:8px;">
                                ${hasSub ? '<span class="toggle-icon">▶</span>' : ''}
                                ${t.icon} ${t.label}
                            </td>
                            ${allRoles.map(r => {
                                let hasAccess = r === 'admin' ? true : (adminService.getPermissions(r)?.[t.id] === 1 || (t.roles && t.roles.includes(r)));
                                const isFixed = r === 'admin' || t.id === 'inicio';
                                return `<td style="padding:0.8rem; text-align:center;"><input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${t.id}" ${hasAccess ? 'checked' : ''} ${isFixed ? 'disabled' : 'style="cursor:pointer;"'}></td>`;
                            }).join('')}
                        </tr>`);

                        if (hasSub) {
                            t.subTabs.forEach(sub => {
                                const subKey = `${t.id}_${sub.id}`;
                                const hasSubSub = sub.subTabs && sub.subTabs.length > 0;
                                rows.push(`
                                <tr class="sub-row-${t.id} ${hasSubSub ? 'main-tab-row' : ''}" data-tab-id="${subKey}" style="border-bottom:1px solid rgba(255,255,255,0.01); display:none; background:rgba(255,255,255,0.01); cursor:${hasSubSub ? 'pointer' : 'default'};">
                                    <td style="padding:0.6rem 0.8rem 0.6rem 2.5rem; font-style:italic; color:var(--text-muted); border-right:1px solid var(--border); display:flex; align-items:center; gap:8px;">
                                        ${hasSubSub ? '<span class="toggle-icon">▶</span>' : ''}
                                        ${sub.icon} ${sub.label}
                                    </td>
                                    ${allRoles.map(r => {
                                        let hasSubAccess = r === 'admin' ? true : (adminService.getPermissions(r)?.[subKey] === 1 || (t.roles && t.roles.includes(r)));
                                        return `<td style="padding:0.6rem; text-align:center;"><input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${subKey}" ${hasSubAccess ? 'checked' : ''} ${r === 'admin' ? 'disabled' : 'style="cursor:pointer; opacity:0.7;"'}></td>`;
                                    }).join('')}
                                </tr>`);

                                if (hasSubSub) {
                                    sub.subTabs.forEach(ss => {
                                        const ssKey = `${sub.id}_${ss.id}`;
                                        rows.push(`
                                        <tr class="sub-row-${subKey}" style="border-bottom:1px solid rgba(255,255,255,0.005); display:none; background:rgba(0,0,0,0.2);">
                                            <td style="padding:0.5rem 0.8rem 0.5rem 4.5rem; font-size:0.7rem; color:var(--primary); border-right:1px solid var(--border);">${ss.icon} ${ss.label}</td>
                                            ${allRoles.map(r => {
                                                let hasSSAccess = r === 'admin' ? true : (adminService.getPermissions(r)?.[ssKey] === 1 || (t.roles && t.roles.includes(r)));
                                                return `<td style="padding:0.5rem; text-align:center;"><input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${ssKey}" ${hasSSAccess ? 'checked' : ''} ${r === 'admin' ? 'disabled' : 'style="cursor:pointer; opacity:0.6;"'}></td>`;
                                            }).join('')}
                                        </tr>`);
                                    });
                                }
                            });
                        }
                        return rows.join('');
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.main-tab-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            const tabId = row.dataset.tabId;
            const subRows = container.querySelectorAll(`.sub-row-${tabId}`);
            if (subRows.length === 0) return;
            const icon = row.querySelector('.toggle-icon');
            const isVisible = subRows[0].style.display !== 'none';
            subRows.forEach(sr => sr.style.display = isVisible ? 'none' : 'table-row');
            if(icon) icon.textContent = isVisible ? '▶' : '▼';
            row.style.background = isVisible ? 'rgba(255,255,255,0.02)' : 'rgba(79,70,229,0.05)';
        });
    });

    container.querySelectorAll('.perm-toggle:not(:disabled)').forEach(cb => {
        cb.onchange = (e) => {
            const { role, tab } = e.target.dataset;
            adminService.togglePermission(role, tab);
        };
    });
};

const renderAsistenciaSection = (container, user, TABS) => {
    const workers = adminService.getWorkers().filter(w => w.active !== false);
    
    const loadAttendanceState = (dateStr) => {
        const existing = adminService.getAttendance(dateStr);
        if (existing) {
            localState = existing.data.map(d => ({ ...d }));
            workers.forEach(w => {
                const wDni = (w.dni || w.Dni);
                if (!localState.find(d => d.dni === wDni)) {
                    localState.push({
                        dni: wDni,
                        nombre: (w.nombre || w.Nombre),
                        apellidos: (w.apellidos || w.Apellidos),
                        present: true,
                        onTime: true,
                        justification: ''
                    });
                }
            });
            return existing;
        }
        localState = workers.map(w => ({ 
            dni: (w.dni || w.Dni), 
            nombre: (w.nombre || w.Nombre), 
            apellidos: (w.apellidos || w.Apellidos), 
            present: true,
            onTime: true,
            justification: ''
        }));
        return null;
    };

    const existing = loadAttendanceState(forcedDate);
    const dateFormatted = new Date(forcedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    if (!workers.length) {
        container.innerHTML = `<div style="padding:3rem; text-align:center;"><p style="color:var(--text-muted);">Debes registrar <b>Trabajadores Activos</b>.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap;">
            <div style="background:rgba(255,255,255,0.03); padding:0.8rem 1.2rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:15px;">
                <div>
                    <h3 style="color:var(--primary); margin:0; font-size:1.1rem; text-transform:uppercase;">Asistencia Diaria</h3>
                    <p style="font-size:0.85rem; color:#fff; margin:4px 0 0 0; font-weight:600;">🗓️ ${dateFormatted}</p>
                </div>
                <input type="date" id="asist_date_picker" value="${forcedDate}" style="background:rgba(255,255,255,0.1); border:1px solid var(--border); color:#fff; padding:0.4rem; border-radius:6px; outline:none;">
            </div>
            
            <div style="display:flex; gap:1rem;">
                ${!existing?.finalized ? `
                    <button id="btn_close_asist" class="btn" style="width:auto; padding:0.6rem 2.5rem; font-size:0.85rem; font-weight:800;">💾 CERRAR ASISTENCIA</button>
                ` : `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:var(--success); color:#000; padding:0.6rem 1.2rem; border-radius:8px; font-weight:900; font-size:0.85rem;">✅ ASISTENCIA CERRADA</span>
                        ${(user.role.toLowerCase() === 'admin' || user.username === 'dames') ? `
                            <button id="btn_reopen_asist" class="btn" style="width:auto; background:#ef4444; padding:0.6rem 1rem; font-size:0.8rem; font-weight:800;">🔓 REABRIR</button>
                        ` : ''}
                    </div>
                `}
            </div>
        </div>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead style="background:rgba(255,255,255,0.05);">
                    <tr>
                        <th style="padding:0.8rem; text-align:center;">#</th>
                        <th style="padding:0.8rem; text-align:left;">DNI</th>
                        <th style="padding:0.8rem; text-align:left;">Trabajador</th>
                        <th style="padding:0.8rem; text-align:center;">Estado</th>
                        <th style="padding:0.8rem; text-align:center;">Puntualidad</th>
                        <th style="padding:0.8rem; text-align:center;">Justificación</th>
                    </tr>
                </thead>
                <tbody>
                    ${workers.map((w, idx) => {
                        const dni = (w.dni || w.Dni);
                        const rec = localState.find(d => d.dni === dni);
                        const isPresent = rec ? rec.present : true;
                        const isOnTime = rec ? rec.onTime : true;
                        return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                            <td style="padding:0.8rem; text-align:center;">${idx + 1}</td>
                            <td style="padding:0.8rem; font-weight:800;">${dni}</td>
                            <td style="padding:0.8rem;">${w.apellidos || ''}, ${w.nombre || ''}</td>
                            <td style="padding:0.8rem; text-align:center;">
                                <div style="display:flex; gap:0.5rem; justify-content:center;">
                                    <button class="btn-att" data-dni="${dni}" data-v="true" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${isPresent?'var(--success)':'none'};" ${existing?.finalized ? 'disabled' : ''}>P</button>
                                    <button class="btn-att" data-dni="${dni}" data-v="false" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${!isPresent?'#ef4444':'none'};" ${existing?.finalized ? 'disabled' : ''}>F</button>
                                </div>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <div style="display:flex; gap:0.5rem; justify-content:center;">
                                    <button class="btn-ontime" data-dni="${dni}" data-v="true" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${isOnTime?'#06b6d4':'none'}; opacity:${isPresent?'1':'0.3'};" ${existing?.finalized ? 'disabled' : ''}>SÍ</button>
                                    <button class="btn-ontime" data-dni="${dni}" data-v="false" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${!isOnTime?'#f97316':'none'}; opacity:${isPresent?'1':'0.3'};" ${existing?.finalized ? 'disabled' : ''}>NO</button>
                                </div>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <select class="sel-just" data-dni="${dni}" style="background:rgba(255,255,255,0.1); color:#fff; border-radius:6px; outline:none;" ${existing?.finalized || isPresent ? 'disabled' : ''}>
                                    <option value="">-</option>
                                    <option value="Descanso Médico" ${rec?.justification==='Descanso Médico'?'selected':''}>DM</option>
                                    <option value="Vacaciones" ${rec?.justification==='Vacaciones'?'selected':''}>VAC</option>
                                    <option value="Otros" ${rec?.justification==='Otros'?'selected':''}>OTR</option>
                                </select>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (!existing?.finalized) {
        container.querySelectorAll('.btn-att').forEach(btn => btn.onclick = (e) => {
            const dni = e.target.dataset.dni;
            const val = e.target.dataset.v === 'true';
            const node = localState.find(s => s.dni === dni);
            if (node) {
                node.present = val;
                if (!val) node.onTime = false;
            }
            adminService.saveAttendance(forcedDate, { finalized: false, data: localState });
            renderAsistenciaSection(container, user, TABS);
        });

        container.querySelectorAll('.btn-ontime').forEach(btn => btn.onclick = (e) => {
            const dni = e.target.dataset.dni;
            const val = e.target.dataset.v === 'true';
            const node = localState.find(s => s.dni === dni);
            if (node && node.present) node.onTime = val;
            adminService.saveAttendance(forcedDate, { finalized: false, data: localState });
            renderAsistenciaSection(container, user, TABS);
        });

        container.querySelectorAll('.sel-just').forEach(sel => sel.onchange = (e) => {
            const dni = e.target.dataset.dni;
            const node = localState.find(s => s.dni === dni);
            if (node) node.justification = e.target.value;
            adminService.saveAttendance(forcedDate, { finalized: false, data: localState });
        });

        const btnClose = container.querySelector('#btn_close_asist');
        if (btnClose) {
            btnClose.onclick = async () => {
                if (confirm(`¿Cerrar asistencia?`)) {
                    await adminService.saveAttendance(forcedDate, { finalized: true, data: localState });
                    renderAdminTab(container.parentElement.parentElement, user, TABS);
                }
            };
        }
    }

    container.querySelector('#asist_date_picker').onchange = (e) => {
        forcedDate = e.target.value;
        renderAsistenciaSection(container, user, TABS);
    };
};

const renderPerformanceSection = (container, user, TABS) => {
    const perfTabDef = TABS.find(t => t.id === 'admin_pers').subTabs.find(s => s.id === 'performance');
    const perms = adminService.getPermissions(user.role) || {};
    
    const allowedSubSubs = perfTabDef.subTabs.filter(ss => {
        if (user.role === 'admin') return true;
        return perms[`performance_${ss.id}`] === 1 || perms['performance'] === 1;
    });

    if (!allowedSubSubs.find(s => s.id === activePerfSub)) {
        activePerfSub = allowedSubSubs[0]?.id || '';
    }

    container.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05);">
          ${allowedSubSubs.map(ss => `
            <a class="perf-sub-item ${activePerfSub===ss.id?'active':''}" data-ss="${ss.id}" style="padding: 0.5rem 0.2rem; font-size: 0.8rem; cursor:pointer;">
                ${ss.icon} ${ss.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="perfContent"></div>`;

    container.querySelectorAll('.perf-sub-item').forEach(b => b.addEventListener('click', (e) => { 
        activePerfSub = e.currentTarget.dataset.ss; 
        renderPerformanceSection(container, user, TABS); 
    }));

    const perfContent = container.querySelector('#perfContent');
    if (activePerfSub === 'historial') renderPerformanceHistory(perfContent, user, TABS);
    else if (activePerfSub === 'graficos') renderKPIGraphsSection(perfContent, user, TABS);
    else if (activePerfSub === 'reporte') renderKPIReportSection(perfContent, user, TABS);
};

const renderPerformanceHistory = (container, user, TABS) => {
    const log = adminService.getPerformanceLog();
    const grouped = log.reduce((acc, p) => {
        if (!acc[p.date]) acc[p.date] = [];
        acc[p.date].push(p);
        return acc;
    }, {});
    const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h3 style="color:var(--primary); margin:0;">Historial de Performance</h3>
        </div>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);">
                        <th style="padding:0.8rem;">DNI</th>
                        <th style="padding:0.8rem;">Trabajador</th>
                        <th style="padding:0.8rem; text-align:center;">Prod.</th>
                        <th style="padding:0.8rem; text-align:center;">BPA</th>
                        <th style="padding:0.8rem; text-align:center;">Sup.</th>
                        <th style="padding:0.8rem; text-align:center;">% Rend.</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedDates.map(date => `
                        <tr style="background:rgba(255,255,255,0.05);"><td colspan="6" style="padding:0.5rem; font-weight:700; color:var(--primary);">📅 ${date}</td></tr>
                        ${grouped[date].map(p => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                                <td style="padding:0.6rem;">${p.dni}</td>
                                <td style="padding:0.6rem;">${p.apellidos}, ${p.nombre}</td>
                                <td style="text-align:center;"><input type="number" value="${p.produccion}" data-dni="${p.dni}" data-date="${date}" data-f="produccion" class="edit-perf-log" style="width:40px; background:none; border:none; color:#fff; text-align:center;"></td>
                                <td style="text-align:center;"><input type="number" value="${p.bpa}" data-dni="${p.dni}" data-date="${date}" data-f="bpa" class="edit-perf-log" style="width:40px; background:none; border:none; color:#fff; text-align:center;"></td>
                                <td style="text-align:center;"><input type="number" value="${p.supervisor}" data-dni="${p.dni}" data-date="${date}" data-f="supervisor" class="edit-perf-log" style="width:40px; background:none; border:none; color:#fff; text-align:center;"></td>
                                <td style="text-align:center; font-weight:900; color:#fcd34d;">${p.rendimiento}</td>
                            </tr>
                        `).join('')}
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.edit-perf-log').forEach(input => {
        input.onchange = (e) => {
            const { date, dni, f } = e.target.dataset;
            adminService.updatePerformanceLogEntry(date, dni, { [f]: e.target.value });
            renderPerformanceHistory(container, user, TABS);
        };
    });
};

const renderKPIGraphsSection = (container, user, TABS) => {
    container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center;">Performance Charts in development</div>`;
};

const renderKPIReportSection = (container, user, TABS) => {
    container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center;">Performance Reports in development</div>`;
};

let activeRFTab = 'inventario';
let activeInventorySubTab = 'rfs';
let rfSearchQuery = '';
let rfStatusFilter = 'todos';
let scannedRfs = [];
let revisionDate = new Date().toISOString().split('T')[0];
let revisionTurn = 'NOCHE';

const playBeep = (type) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'success') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } else {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.25);
    }
  } catch (e) {
    console.error("Web Audio beep failed:", e);
  }
};

const renderRFSection = (container, user, TABS) => {
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

    // Auto-sanear inconsistencias de RFs huérfanos sin asignación activa en la bitácora
    let rfsChanged = false;
    rfs.forEach(r => {
      if (r.asignadoDni) {
        const hasActive = assignments.some(a => a.rf_serial === r.serie && !a.returned_at);
        if (!hasActive) {
          console.warn(`[PULSE] Auto-saneando RF ${r.serie}: figuraba como asignado pero no tiene asignación activa en bitácora.`);
          r.asignadoDni = null;
          r.asignadoNombre = null;
          r.asignadoTurno = null;
          rfsChanged = true;
        }
      }
    });
    if (rfsChanged) {
      adminService.saveRfs(rfs);
    }
    const workers = adminService.getWorkers() || [];
    const batteries = adminService.getRfsBatteries() || [];
    const chargers = adminService.getRfsChargers() || [];

        const expectedRFSerials = [];
    const expectedRFDetails = {};
    
    rfs.forEach(r => {
      if (r.estado === 'Operativo') {
        expectedRFSerials.push(r.serie);
        // Buscar la última asignación de este equipo para mostrar detalles de quién lo usó por última vez
        const rfAsigs = assignments.filter(a => a.rf_serial === r.serie);
        if (rfAsigs.length > 0) {
          rfAsigs.sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));
          expectedRFDetails[r.serie] = rfAsigs[0];
        }
      }
    });

    const totalExpected = expectedRFSerials.length;
    const foundExpectedSerials = scannedRfs.filter(s => expectedRFSerials.includes(s.serial)).map(s => s.serial);
    const uniqueFoundExpected = [...new Set(foundExpectedSerials)].length;
    const pendingCount = totalExpected - uniqueFoundExpected;
    
    const unexpectedScans = scannedRfs.filter(s => !expectedRFSerials.includes(s.serial));
    const uniqueUnexpected = [...new Set(unexpectedScans.map(s => s.serial))].length;

    // Calcular métricas dinámicas según pestaña
    let metricsHtml = '';
    if (activeRFTab === 'inventario') {
      if (activeInventorySubTab === 'rfs') {
        const totalRFs = rfs.length;
        const availableRFs = rfs.filter(r => r.estado === 'Operativo' && !r.asignadoDni).length;
        const assignedRFs = rfs.filter(r => r.asignadoDni).length;
        const maintenanceRFs = rfs.filter(r => r.estado === 'En Mantenimiento').length;
        const avgBattery = totalRFs ? Math.round(rfs.reduce((sum, r) => sum + parseInt(r.bateria || 0), 0) / totalRFs) : 0;
        
        metricsHtml = `
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--primary); background:rgba(79,70,229,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(79,70,229,0.4));">📡</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Equipos RF</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Disponibles</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${availableRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #06b6d4; background:rgba(6,182,212,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(6,182,212,0.4));">👷</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Uso</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#06b6d4;">${assignedRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Taller</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintenanceRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">🔋</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Promedio Batería</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#10b981;">${avgBattery}%</p>
            </div>
          </div>
        `;
      } else if (activeInventorySubTab === 'baterias') {
        const totalBats = batteries.length;
        const opBats = batteries.filter(b => b.estado === 'Operativo').length;
        const maintBats = batteries.filter(b => b.estado === 'En Mantenimiento').length;
        const bajaBats = batteries.filter(b => b.estado === 'De Baja').length;
        const avgHealth = totalBats ? Math.round(batteries.reduce((sum, b) => sum + parseInt(b.salud || 0), 0) / totalBats) : 0;
        
        metricsHtml = `
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">🔋</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Baterías</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Operativas</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${opBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Taller</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #ef4444; background:rgba(239,68,68,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(239,68,68,0.4));">🚨</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">De Baja</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#ef4444;">${bajaBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #3b82f6; background:rgba(59,130,246,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(59,130,246,0.4));">❤️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Promedio Salud</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#3b82f6;">${avgHealth}%</p>
            </div>
          </div>
        `;
      } else {
        const totalChgs = chargers.length;
        const opChgs = chargers.filter(c => c.estado === 'Operativo').length;
        const maintChgs = chargers.filter(c => c.estado === 'En Mantenimiento').length;
        const totalSlots = chargers.reduce((sum, c) => sum + parseInt(c.capacidad || 0), 0);
        const totalSlotsOk = chargers.reduce((sum, c) => sum + parseInt(c.ranuras_ok || 0), 0);
        
        metricsHtml = `
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #06b6d4; background:rgba(6,182,212,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(6,182,212,0.4));">🔌</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Cargadores</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalChgs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Cargadores OK</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${opChgs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Cargadores Taller</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintChgs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #3b82f6; background:rgba(59,130,246,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(59,130,246,0.4));">⚡</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Ranuras Totales</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#3b82f6;">${totalSlots} ranuras</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">⚡</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Ranuras OK</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#10b981;">${totalSlotsOk} / ${totalSlots}</p>
            </div>
          </div>
        `;
      }
    } else if (activeRFTab === 'revision') {
      metricsHtml = `
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">📋</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Esperados</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalExpected}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✔️</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Coincidentes OK</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${uniqueFoundExpected}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #ef4444; background:rgba(239,68,68,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(239,68,68,0.4));">⏳</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Pendientes</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#ef4444;">${pendingCount}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #3b82f6; background:rgba(59,130,246,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(59,130,246,0.4));">❌</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Inesperados</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#3b82f6;">${uniqueUnexpected}</p>
          </div>
        </div>
      `;
    } else {
      const totalRFs = rfs.length;
      const availableRFs = rfs.filter(r => r.estado === 'Operativo' && !r.asignadoDni).length;
      const assignedRFs = rfs.filter(r => r.asignadoDni).length;
      const maintenanceRFs = rfs.filter(r => r.estado === 'En Mantenimiento').length;
      const avgBattery = totalRFs ? Math.round(rfs.reduce((sum, r) => sum + parseInt(r.bateria || 0), 0) / totalRFs) : 0;
      
      metricsHtml = `
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--primary); background:rgba(79,70,229,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(79,70,229,0.4));">📡</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Equipos RF</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Disponibles</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${availableRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #06b6d4; background:rgba(6,182,212,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(6,182,212,0.4));">👷</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Uso</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#06b6d4;">${assignedRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Taller</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintenanceRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">🔋</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Promedio Batería</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#10b981;">${avgBattery}%</p>
          </div>
        </div>
      `;
    }

    // Filtrar equipos
    let filteredRfs = [...rfs];
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredRfs = filteredRfs.filter(r => 
        (r.serie || '').toLowerCase().includes(q) || 
        (r.marca || '').toLowerCase().includes(q) || 
        (r.modelo || '').toLowerCase().includes(q) ||
        (r.asignadoNombre || '').toLowerCase().includes(q)
      );
    }
    if (rfStatusFilter && rfStatusFilter !== 'todos') {
      filteredRfs = filteredRfs.filter(r => r.estado === rfStatusFilter);
    }

    // Filtrar baterías
    let filteredBatteries = [...batteries];
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredBatteries = filteredBatteries.filter(b => 
        (b.codigo || '').toLowerCase().includes(q) || 
        (b.modelo || '').toLowerCase().includes(q) || 
        (b.ubicacion || '').toLowerCase().includes(q)
      );
    }
    if (rfStatusFilter && rfStatusFilter !== 'todos') {
      filteredBatteries = filteredBatteries.filter(b => b.estado === rfStatusFilter);
    }

    // Filtrar cargadores
    let filteredChargers = [...chargers];
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredChargers = filteredChargers.filter(c => 
        (c.codigo || '').toLowerCase().includes(q) || 
        (c.marca || '').toLowerCase().includes(q) || 
        (c.modelo || '').toLowerCase().includes(q) || 
        (c.ubicacion || '').toLowerCase().includes(q)
      );
    }
    if (rfStatusFilter && rfStatusFilter !== 'todos') {
      filteredChargers = filteredChargers.filter(c => c.estado === rfStatusFilter);
    }

    // Filtrar asignaciones
    let filteredAssignments = [...assignments].sort((a,b) => new Date(b.assigned_at) - new Date(a.assigned_at));
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredAssignments = filteredAssignments.filter(a => 
        (a.rf_serial || '').toLowerCase().includes(q) || 
        (a.worker_name || '').toLowerCase().includes(q) || 
        (a.worker_dni || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q)
      );
    }

    // Listado para pestaña ASIGNAR RF
    const availableOperativeRfs = rfs.filter(r => r.estado === 'Operativo' && !r.asignadoDni);
    const activeWorkers = workers.filter(w => w.active !== false);
    const activeAssignments = assignments.filter(a => !a.returned_at);

    container.innerHTML = `
      <!-- METRICS CARDS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        ${metricsHtml}
      </div>

      <!-- HEADER ACTION BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:1rem; width:100%;">
        <!-- TAB SELECTOR -->
        <nav style="display:flex; gap:1.2rem;">
          <a class="perf-sub-item ${activeRFTab==='inventario'?'active':''}" id="rf_tab_inventario">📁 INVENTARIO</a>
          <a class="perf-sub-item ${activeRFTab==='asignar'?'active':''}" id="rf_tab_asignar">🔑 ASIGNAR RF</a>
          <a class="perf-sub-item ${activeRFTab==='asignaciones'?'active':''}" id="rf_tab_asignaciones">📝 BITÁCORA</a>
          <a class="perf-sub-item ${activeRFTab==='revision'?'active':''}" id="rf_tab_revision">🔍 REVISIÓN RF</a>
        </nav>

        <!-- SEARCH AND ADD -->
        ${activeRFTab !== 'revision' ? `
        <div style="display:flex; gap:0.8rem; align-items:center; flex-wrap:wrap; padding-bottom:0.3rem;">
          <input type="text" id="rf_search_input" placeholder="🔍 Buscar..." value="${rfSearchQuery}" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); color:#fff; padding:0.5rem 1rem; border-radius:8px; font-size:0.8rem; outline:none; width:220px;">
          
          ${activeRFTab === 'inventario' ? `
            <select id="rf_status_filter" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; padding:0.5rem; border-radius:8px; font-size:0.8rem; outline:none; cursor:pointer;">
              <option value="todos" ${rfStatusFilter==='todos'?'selected':''}>- TODOS LOS ESTADOS -</option>
              <option value="Operativo" ${rfStatusFilter==='Operativo'?'selected':''}>OPERATIVO</option>
              <option value="En Mantenimiento" ${rfStatusFilter==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
              <option value="De Baja" ${rfStatusFilter==='De Baja'?'selected':''}>DE BAJA</option>
            </select>
            ${activeInventorySubTab === 'rfs' ? `
              <button id="btn_new_rf" class="btn" style="width:auto; background:var(--primary); font-size:0.78rem; padding:0.5rem 1.2rem; font-weight:800; border-radius:8px;">📡 REGISTRAR EQUIPO</button>
            ` : activeInventorySubTab === 'baterias' ? `
              <button id="btn_new_battery" class="btn" style="width:auto; background:linear-gradient(135deg, #10b981 0%, #064e3b 150%); font-size:0.78rem; padding:0.5rem 1.2rem; font-weight:800; border-radius:8px; border:none; color:#fff; cursor:pointer; box-shadow:0 4px 10px rgba(16,185,129,0.3);">🔋 REGISTRAR BATERÍA</button>
            ` : `
              <button id="btn_new_charger" class="btn" style="width:auto; background:linear-gradient(135deg, #06b6d4 0%, #083344 150%); font-size:0.78rem; padding:0.5rem 1.2rem; font-weight:800; border-radius:8px; border:none; color:#fff; cursor:pointer; box-shadow:0 4px 10px rgba(6,182,212,0.3);">🔌 REGISTRAR CARGADOR</button>
            `}
          ` : ''}
        </div>
        ` : `
        <div style="font-size:0.75rem; color:#818cf8; font-weight:800; background:rgba(129,140,248,0.1); border:1px solid rgba(129,140,248,0.2); padding:5px 12px; border-radius:20px; letter-spacing:0.5px;">
          🖥️ MÓDULO DE VERIFICACIÓN AUTOMÁTICO
        </div>
        `}
      </div>

      <!-- MAIN CONTENT -->
      ${activeRFTab === 'inventario' ? `
        <!-- SUB-TAB SELECTOR -->
        <div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.03); margin-bottom:1.2rem; width:100%; gap:1.2rem;">
          <a class="perf-sub-item ${activeInventorySubTab==='rfs'?'active':''}" id="rf_sub_tab_rfs">📡 EQUIPOS RF</a>
          <a class="perf-sub-item ${activeInventorySubTab==='baterias'?'active':''}" id="rf_sub_tab_baterias">🔋 BATERÍAS</a>
          <a class="perf-sub-item ${activeInventorySubTab==='cargadores'?'active':''}" id="rf_sub_tab_cargadores">🔌 CARGADORES</a>
        </div>
        
        ${activeInventorySubTab === 'rfs' ? `
          <!-- TABLE INVENTARIO EQUIPOS RF -->
          <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
              <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                  <th style="padding:0.8rem; text-align:left;">Serie</th>
                  <th style="padding:0.8rem; text-align:left;">Marca / Modelo</th>
                  <th style="padding:0.8rem; text-align:left;">Número</th>
                  <th style="padding:0.8rem; text-align:left;">Batería</th>
                  <th style="padding:0.8rem; text-align:center;">Estado Físico</th>
                  <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRfs.length ? filteredRfs.map((r, idx) => {
                  const bat = parseInt(r.bateria || 0);
                  const batColor = bat >= 70 ? '#10b981' : (bat >= 30 ? '#f59e0b' : '#ef4444');
                  const isPulsing = bat < 30 ? 'animation: pulse-bat 1.2s infinite alternate;' : '';
                  
                  let stateColor = '#10b981';
                  let stateGlow = 'rgba(16, 185, 129, 0.2)';
                  if (r.estado === 'En Mantenimiento') {
                    stateColor = '#f59e0b';
                    stateGlow = 'rgba(245, 158, 11, 0.2)';
                  } else if (r.estado === 'De Baja') {
                    stateColor = '#ef4444';
                    stateGlow = 'rgba(239, 68, 68, 0.2)';
                  }

                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                      <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                      <td style="padding:0.8rem; font-weight:900; color:#fff; font-size:0.85rem; letter-spacing:0.5px;">
                        <span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-family:monospace;">${r.serie}</span>
                      </td>
                      <td style="padding:0.8rem;">
                        <span style="font-weight:600; color:#cbd5e1;">${r.marca || ''}</span> 
                        <span style="color:var(--text-muted); font-size:0.7rem;">${r.modelo || ''}</span>
                      </td>
                      <td style="padding:0.8rem;">
                        ${r.numero ? `<span style="background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.3); color:#a5b4fc; padding:3px 9px; border-radius:6px; font-family:monospace; font-size:0.8rem; font-weight:700;">${r.numero}</span>` : `<span style="color:rgba(255,255,255,0.2); font-size:0.75rem;">—</span>`}
                      </td>
                      <td style="padding:0.8rem;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="width:38px; height:18px; border:1.5px solid rgba(255,255,255,0.3); border-radius:4px; padding:2px; position:relative; display:flex; ${isPulsing}">
                            <div style="width:${bat}%; height:100%; background:${batColor}; border-radius:2px; transition: width 0.3s ease;"></div>
                            <div style="width:3px; height:6px; background:rgba(255,255,255,0.3); position:absolute; right:-4.5px; top:4.5px; border-radius: 0 1px 1px 0;"></div>
                          </div>
                          <span style="font-weight:800; color:#fff; font-size:0.75rem;">${bat}%</span>
                        </div>
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="background:${stateGlow}; color:${stateColor}; border:1px solid ${stateColor}44; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                          ${r.estado || 'Operativo'}
                        </span>
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <div style="display:flex; gap:0.8rem; justify-content:center; align-items:center;">
                          <button class="btn-edit-rf" data-rf='${JSON.stringify(r).replace(/'/g, "&apos;")}' style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">✏️</button>
                          <button class="btn-delete-rf" data-serie="${r.serie}" style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">🗑️</button>
                        </div>
                      </td>
                    </tr>`;
                }) : '<tr><td colspan="6" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se encontraron equipos registrados.</td></tr>'}
              </tbody>
            </table>
          </div>
        ` : activeInventorySubTab === 'baterias' ? `
          <!-- TABLE INVENTARIO BATERÍAS -->
          <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
              <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                  <th style="padding:0.8rem; text-align:left;">Código de Batería</th>
                  <th style="padding:0.8rem; text-align:left;">Compatibilidad (Modelo)</th>
                  <th style="padding:0.8rem; text-align:left;">Salud / Vida Útil</th>
                  <th style="padding:0.8rem; text-align:left;">Ubicación / Ranura</th>
                  <th style="padding:0.8rem; text-align:center;">Estado Físico</th>
                  <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredBatteries.length ? filteredBatteries.map((b, idx) => {
                  const salud = parseInt(b.salud || 100);
                  const saludColor = salud >= 80 ? '#10b981' : (salud >= 60 ? '#f59e0b' : '#ef4444');
                  
                  let stateColor = '#10b981';
                  let stateGlow = 'rgba(16, 185, 129, 0.2)';
                  if (b.estado === 'En Mantenimiento') {
                    stateColor = '#f59e0b';
                    stateGlow = 'rgba(245, 158, 11, 0.2)';
                  } else if (b.estado === 'De Baja') {
                    stateColor = '#ef4444';
                    stateGlow = 'rgba(239, 68, 68, 0.2)';
                  }

                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                      <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                      <td style="padding:0.8rem; font-weight:900; color:#fff; font-size:0.85rem; letter-spacing:0.5px;">
                        <span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-family:monospace;">${b.codigo}</span>
                      </td>
                      <td style="padding:0.8rem; font-weight:600; color:#cbd5e1;">${b.modelo || 'Universal'}</td>
                      <td style="padding:0.8rem;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="font-weight:900; color:${saludColor};">${salud}%</div>
                          <div style="font-size:0.65rem; color:var(--text-muted);">
                            (${salud >= 80 ? 'Excelente' : (salud >= 60 ? 'Bueno' : 'Desgastada')})
                          </div>
                        </div>
                      </td>
                      <td style="padding:0.8rem; font-weight:600; color:#cbd5e1;">📍 ${b.ubicacion || 'Estante Principal'}</td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="background:${stateGlow}; color:${stateColor}; border:1px solid ${stateColor}44; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                          ${b.estado || 'Operativo'}
                        </span>
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <div style="display:flex; gap:0.8rem; justify-content:center; align-items:center;">
                          <button class="btn-edit-battery" data-battery='${JSON.stringify(b).replace(/'/g, "&apos;")}' style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">✏️</button>
                          <button class="btn-delete-battery" data-codigo="${b.codigo}" style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">🗑️</button>
                        </div>
                      </td>
                    </tr>`;
                }) : '<tr><td colspan="7" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se encontraron baterías registradas.</td></tr>'}
              </tbody>
            </table>
          </div>
        ` : `
          <!-- TABLE INVENTARIO CARGADORES -->
          <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
              <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                  <th style="padding:0.8rem; text-align:left;">Código de Cargador</th>
                  <th style="padding:0.8rem; text-align:left;">Marca / Modelo</th>
                  <th style="padding:0.8rem; text-align:center;">Capacidad (Ranuras)</th>
                  <th style="padding:0.8rem; text-align:center;">Ranuras Operativas</th>
                  <th style="padding:0.8rem; text-align:left;">Ubicación de Carga</th>
                  <th style="padding:0.8rem; text-align:center;">Estado Físico</th>
                  <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredChargers.length ? filteredChargers.map((c, idx) => {
                  let stateColor = '#10b981';
                  let stateGlow = 'rgba(16, 185, 129, 0.2)';
                  if (c.estado === 'En Mantenimiento') {
                    stateColor = '#f59e0b';
                    stateGlow = 'rgba(245, 158, 11, 0.2)';
                  } else if (c.estado === 'De Baja') {
                    stateColor = '#ef4444';
                    stateGlow = 'rgba(239, 68, 68, 0.2)';
                  }

                  const slotsOk = parseInt(c.ranuras_ok || c.capacidad || 4);
                  const slotsTotal = parseInt(c.capacidad || 4);

                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                      <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                      <td style="padding:0.8rem; font-weight:900; color:#fff; font-size:0.85rem; letter-spacing:0.5px;">
                        <span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-family:monospace;">${c.codigo}</span>
                      </td>
                      <td style="padding:0.8rem;">
                        <span style="font-weight:600; color:#cbd5e1;">${c.marca || ''}</span> 
                        <span style="color:var(--text-muted); font-size:0.7rem;">${c.modelo || ''}</span>
                      </td>
                      <td style="padding:0.8rem; text-align:center; font-weight:700; color:#fff;">${slotsTotal} slots</td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="color:${slotsOk === slotsTotal ? '#10b981' : '#f59e0b'}; font-weight:800;">
                          ${slotsOk} / ${slotsTotal} OK
                        </span>
                      </td>
                      <td style="padding:0.8rem; font-weight:600; color:#cbd5e1;">⚡ ${c.ubicacion || 'Zona de Carga Principal'}</td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="background:${stateGlow}; color:${stateColor}; border:1px solid ${stateColor}44; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                          ${c.estado || 'Operativo'}
                        </span>
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <div style="display:flex; gap:0.8rem; justify-content:center; align-items:center;">
                          <button class="btn-edit-charger" data-charger='${JSON.stringify(c).replace(/'/g, "&apos;")}' style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">✏️</button>
                          <button class="btn-delete-charger" data-codigo="${c.codigo}" style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">🗑️</button>
                        </div>
                      </td>
                    </tr>`;
                }) : '<tr><td colspan="8" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se encontraron cargadores registrados.</td></tr>'}
              </tbody>
            </table>
          </div>
        `}
      ` : activeRFTab === 'asignar' ? `
        <!-- SUB-MÓDULO DE ASIGNACIÓN Y CONTROL RÁPIDO -->
        <div style="display:grid; grid-template-columns: 350px 1fr; gap:1.5rem; align-items:start;">
          <!-- COLUMNA IZQUIERDA: REGISTRO ENTREGA -->
          <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08);">
            <h4 style="margin:0 0 1.2rem 0; color:var(--primary); font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">🔑 Entrega de Turno</h4>
            <form id="form_fast_assign" style="display:flex; flex-direction:column; gap:0.9rem;">
              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">1. SELECCIONAR OPERARIO ACTIVO:</label>
                <select id="rf_fast_worker" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem;">
                  <option value="" style="background:#0f172a;">-- Seleccionar operario --</option>
                  ${activeWorkers.map(w => `<option value="${w.dni}" style="background:#0f172a;">${w.apellidos}, ${w.nombre} (${w.dni})</option>`).join('')}
                </select>
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">2. SELECCIONAR TERMINAL DISPONIBLE:</label>
                <select id="rf_fast_device" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-family:monospace; font-size:0.8rem;">
                  <option value="" style="background:#0f172a;">-- Seleccionar serie RF --</option>
                  ${availableOperativeRfs.map(r => `<option value="${r.serie}" style="background:#0f172a;">${r.serie} - ${r.marca} (${r.bateria}% bat)</option>`).join('')}
                </select>
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">3. TURNO:</label>
                <select id="rf_fast_turn" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem;">
                  <option value="DIA" style="background:#0f172a;">DIA</option>
                  <option value="NOCHE" style="background:#0f172a;">NOCHE</option>
                </select>
              </div>

              <!-- CRITERIOS DE VERIFICACIÓN -->
              <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); padding:0.8rem; border-radius:8px; display:flex; flex-direction:column; gap:0.6rem;">
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:block;">📝 CRITERIOS DE CONTROL (ENTREGA):</span>
                
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
                  <span>🖥️ Pantalla en buen estado</span>
                  <input type="checkbox" id="rf_fast_pantalla" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
                </label>
                
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
                  <span>🏷️ Numeración legible / OK</span>
                  <input type="checkbox" id="rf_fast_numeracion" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
                </label>
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / COMENTARIOS:</label>
                <textarea id="rf_fast_notes" rows="2" placeholder="Ej: Sin arañazos, incluye lápiz..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; resize:none;"></textarea>
              </div>

              <button type="submit" class="btn" style="background:linear-gradient(135deg, var(--primary) 0%, #1e1b4b 150%); padding:0.7rem; font-weight:800; font-size:0.75rem; width:100%; border-radius:10px; box-shadow:0 4px 12px rgba(79,70,229,0.3); margin-top:0.3rem;">⚡ ENTREGAR Y ASIGNAR RF</button>
            </form>
          </div>

          <!-- COLUMNA DERECHA: EQUIPOS ACTUALMENTE EN USO -->
          <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08);">
            <h4 style="margin:0 0 1.2rem 0; color:#06b6d4; font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">📥 Equipos en uso (Retornos de Turno)</h4>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border);">
                  <tr>
                    <th style="padding:0.7rem; text-align:left;">Equipo RF</th>
                    <th style="padding:0.7rem; text-align:left;">Trabajador</th>
                    <th style="padding:0.7rem; text-align:center;">Turno</th>
                    <th style="padding:0.7rem; text-align:left;">Entrega</th>
                    <th style="padding:0.7rem; text-align:center;">Estado Inicial</th>
                    <th style="padding:0.7rem; text-align:center; width:130px;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeAssignments.length ? activeAssignments.map(a => {
                    const activeTime = new Date(a.assigned_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
                    
                    const screenStyle = a.pantalla_ok !== false ? 'color:#10b981; font-weight:800;' : 'color:#ef4444; font-weight:800; text-decoration:line-through;';
                    const numStyle = a.numeracion_ok !== false ? 'color:#10b981; font-weight:800;' : 'color:#ef4444; font-weight:800; text-decoration:line-through;';

                    return `
                      <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                        <td style="padding:0.7rem; font-weight:900; color:#fff;"><span style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-family:monospace;">${a.rf_serial}</span></td>
                        <td style="padding:0.7rem;">
                          <div style="font-weight:700; color:#fff;">${a.worker_name}</div>
                          <div style="font-size:0.6rem; color:var(--text-muted);">DNI: ${a.worker_dni}</div>
                        </td>
                        <td style="padding:0.7rem; text-align:center;">
                          <span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-weight:800;">${a.turn}</span>
                        </td>
                        <td style="padding:0.7rem; color:#cbd5e1;">🕒 ${activeTime}</td>
                        <td style="padding:0.7rem; text-align:center;">
                          <div style="display:flex; flex-direction:column; gap:2px; font-size:0.65rem;">
                            <span style="${screenStyle}">🖥️ ${a.pantalla_ok !== false ? 'PANTALLA OK' : 'PANTALLA MAL'}</span>
                            <span style="${numStyle}">🏷️ ${a.numeracion_ok !== false ? 'NUMERACIÓN OK' : 'NUMERACIÓN MAL'}</span>
                          </div>
                        </td>
                        <td style="padding:0.7rem; text-align:center;">
                          <button class="btn-recibir-rf" data-serie="${a.rf_serial}" style="background:linear-gradient(135deg, #f97316 0%, #ea580c 100%); border:none; color:#fff; font-weight:800; font-size:0.65rem; padding:4px 12px; border-radius:6px; cursor:pointer; box-shadow:0 3px 8px rgba(234,88,12,0.3); outline:none;">📥 RECIBIR RF</button>
                        </td>
                      </tr>`;
                  }).join('') : '<tr><td colspan="6" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600;">No hay terminales asignados en uso en este turno.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : activeRFTab === 'asignaciones' ? `
        <!-- TABLE BITÁCORA ASIGNACIONES -->
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
            <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
              <tr>
                <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                <th style="padding:0.8rem; text-align:left;">Equipo RF</th>
                <th style="padding:0.8rem; text-align:left;">Trabajador</th>
                <th style="padding:0.8rem; text-align:center;">Turno</th>
                <th style="padding:0.8rem; text-align:left;">Asignación (Entrega)</th>
                <th style="padding:0.8rem; text-align:left;">Devolución (Retorno)</th>
                <th style="padding:0.8rem; text-align:left;">Bitácora de Control y Observaciones</th>
                <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAssignments.length ? filteredAssignments.map((a, idx) => {
                const assignedTime = new Date(a.assigned_at).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
                const returnedTime = a.returned_at ? new Date(a.returned_at).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : null;
                
                const isDamaged = a.returned_at && (a.retorno_pantalla_ok === false || a.retorno_numeracion_ok === false);
                const isPending = !a.returned_at;
                
                let rowBg = '';
                let rowOpacity = '1';
                let rowBorder = 'border-bottom:1px solid rgba(255,255,255,0.03);';
                
                if (isDamaged) {
                  rowBg = 'background: rgba(239, 68, 68, 0.08);';
                  rowBorder += ' border-left: 4px solid #ef4444;';
                } else if (isPending) {
                  rowBg = 'background: rgba(245, 158, 11, 0.03);';
                  rowBorder += ' border-left: 4px solid #ea580c;';
                } else {
                  rowOpacity = '0.55';
                  rowBg = 'background: rgba(255, 255, 255, 0.01);';
                }
                
                let returnStatusHtml = '';
                if (returnedTime) {
                  if (a.retorno_pantalla_ok !== false && a.retorno_numeracion_ok !== false) {
                    returnStatusHtml = `
                      <div style="margin-bottom:6px;"><span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px;">✅ CONFORME</span></div>
                      <div style="color:#10b981; font-weight:700; font-size:0.75rem;">${returnedTime}</div>
                      <div style="font-size:0.65rem; color:rgba(16,185,129,0.7); margin-top:2px;">
                        🖥️ Pantalla: OK | 🏷️ Num: OK
                      </div>
                    `;
                  } else {
                    returnStatusHtml = `
                      <div style="margin-bottom:6px;"><span style="background:rgba(239,68,68,0.25); color:#f87171; border:1px solid rgba(239,68,68,0.5); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px; box-shadow:0 0 10px rgba(239,68,68,0.25);">🚨 DAÑADO / TALLER</span></div>
                      <div style="color:#ef4444; font-weight:800; font-size:0.75rem;">${returnedTime}</div>
                      <div style="font-size:0.65rem; color:#f87171; font-weight:700; margin-top:2px; display:flex; flex-direction:column; gap:2px;">
                        <span>${a.retorno_pantalla_ok === false ? '❌ Pantalla Dañada' : '🖥️ Pantalla OK'}</span>
                        <span>${a.retorno_numeracion_ok === false ? '❌ Numeración Borrada' : '🏷️ Numeración OK'}</span>
                      </div>
                    `;
                  }
                } else {
                  returnStatusHtml = `<span style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.65rem; letter-spacing:0.5px;">⏳ EN USO</span>`;
                }

                return `
                  <tr style="${rowBg} ${rowBorder} opacity: ${rowOpacity}">
                    <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                    <td style="padding:0.8rem; font-weight:900; color:#fff; font-size:0.85rem; letter-spacing:0.5px;">
                      <span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-family:monospace;">${a.rf_serial}</span>
                    </td>
                    <td style="padding:0.8rem;">
                      <div style="font-weight:700; color:#fff; text-transform:uppercase;">${a.worker_name}</div>
                      <div style="font-size:0.6rem; color:var(--text-muted);">DNI: ${a.worker_dni}</div>
                    </td>
                    <td style="padding:0.8rem; text-align:center;">
                      <span style="background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:800; color:#cbd5e1;">${a.turn}</span>
                    </td>
                    <td style="padding:0.8rem; color:#cbd5e1; font-weight:500;">
                      <div style="font-weight:700; color:#fff; margin-bottom:4px;">📅 ${assignedTime}</div>
                      <div style="font-size:0.65rem; color:rgba(255,255,255,0.45); display:flex; flex-direction:column; gap:2px;">
                        <span style="${a.pantalla_ok !== false ? 'color:#10b981;' : 'color:#ef4444; font-weight:800;'}">🖥️ Pantalla: ${a.pantalla_ok !== false ? 'OK' : 'DAÑADA'}</span>
                        <span style="${a.numeracion_ok !== false ? 'color:#10b981;' : 'color:#ef4444; font-weight:800;'}">🏷️ Num: ${a.numeracion_ok !== false ? 'OK' : 'DAÑADA'}</span>
                      </div>
                    </td>
                    <td style="padding:0.8rem;">
                      ${returnStatusHtml}
                    </td>
                    <td style="padding:0.8rem; color:#cbd5e1; font-size:0.72rem; line-height:1.4; max-width:320px; overflow:visible; word-break:break-word; white-space:normal;">
                      ${a.notes ? `<div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:5px 8px; border-radius:6px; margin-bottom:4px; color:rgba(255,255,255,0.65);">🗣️ <b>Entrega:</b> ${a.notes}</div>` : ''}
                      ${a.return_notes ? `
                        <div style="background:${isDamaged ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)'}; border:1px solid ${isDamaged ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}; padding:5px 8px; border-radius:6px; color:${isDamaged ? '#f87171; font-weight:700;' : '#34d399;'};">
                          📥 <b>Retorno:</b> ${a.return_notes}
                        </div>
                      ` : ''}
                    </td>
                    <td style="padding:0.8rem; text-align:center; border-left:1px solid rgba(255,255,255,0.02);">
                      <div style="display:flex; gap:0.5rem; justify-content:center; align-items:center;">
                        <button class="btn-edit-assignment" data-id="${a.id}" title="Editar registro" style="background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.35); color:#a5b4fc; font-size:0.85rem; padding:5px 9px; border-radius:7px; cursor:pointer; outline:none; transition:all 0.2s; font-weight:700;" onmouseover="this.style.background='rgba(99,102,241,0.3)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(99,102,241,0.15)'; this.style.color='#a5b4fc';">✏️</button>
                        <button class="btn-delete-assignment" data-id="${a.id}" data-serial="${a.rf_serial}" data-pending="${isPending}" title="Eliminar registro" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; font-size:0.85rem; padding:5px 9px; border-radius:7px; cursor:pointer; outline:none; transition:all 0.2s; font-weight:700;" onmouseover="this.style.background='rgba(239,68,68,0.28)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239,68,68,0.12)'; this.style.color='#fca5a5';">🗑️</button>
                      </div>
                    </td>
                  </tr>`;
              }) : '<tr><td colspan="8" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se registran asignaciones en la bitácora.</td></tr>'}
            </tbody>
          </table>
        </div>
      ` : `
        <!-- REVISIÓN RF SECTION -->
        <div style="display:grid; grid-template-columns: 380px 1fr; gap:1.5rem; align-items:start;">
          <!-- COLUMNA IZQUIERDA: CONTROL Y ESCANEO -->
          <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08);">
            <h4 style="margin:0 0 1.2rem 0; color:var(--primary); font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">🔍 Panel de Validación</h4>
            
            <div style="display:flex; flex-direction:column; gap:0.9rem;">
              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">1. FECHA DEL TURNO REFERENCIA (FIN DE TURNO):</label>
                <input type="date" id="rf_rev_date" value="${revisionDate}" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">2. TURNO A REVISAR (ANTERIOR):</label>
                <select id="rf_rev_turn" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem;">
                  <option value="NOCHE" ${revisionTurn==='NOCHE'?'selected':''}>NOCHE (Salida: 6:00 AM)</option>
                  <option value="DIA" ${revisionTurn==='DIA'?'selected':''}>DIA (Salida: 6:00 PM)</option>
                </select>
              </div>

              <!-- LECTORA DE BARRAS DE RF -->
              <div style="background:rgba(0, 0, 0, 0.25); border:2px dashed rgba(99,102,241,0.4); padding:1.2rem; border-radius:12px; margin-top:0.5rem; text-align:center; position:relative; box-shadow:inset 0 0 15px rgba(99,102,241,0.05);">
                <div style="position:absolute; top:8px; right:12px; display:flex; align-items:center; gap:5px;">
                  <span style="display:inline-block; width:8px; height:8px; background:#10b981; border-radius:50%; box-shadow:0 0 8px #10b981; animation:pulse-bat 1s infinite alternate;"></span>
                  <span style="font-size:0.6rem; color:#10b981; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Listo</span>
                </div>

                <label style="font-size:0.75rem; color:#fff; display:block; margin-bottom:10px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase;">⚡ Escanear Terminal RF:</label>
                <input type="text" id="rf_rev_scanner_input" placeholder="Pistolear Código..." autofocus autocomplete="off" style="width:100%; background:rgba(15,23,42,0.9); border:2px solid rgba(99,102,241,0.6); color:#fff; font-size:1.1rem; font-weight:900; letter-spacing:1px; outline:none; padding:0.7rem; border-radius:8px; text-align:center; box-shadow:0 0 10px rgba(99,102,241,0.25); transition:all 0.2s;" onfocus="this.style.borderColor='#818cf8'; this.style.boxShadow='0 0 15px rgba(129,140,248,0.4)';" onblur="this.style.borderColor='rgba(99,102,241,0.6)';">
                
                <span style="font-size:0.6rem; color:var(--text-muted); display:block; margin-top:8px;">Haga clic en la caja si pierde el foco para seguir pistoleando.</span>
              </div>

              <!-- BOTONES AUXILIARES -->
              <div style="display:flex; flex-direction:column; gap:8px; margin-top:0.5rem;">
                <button id="btn_generate_summary" class="btn" style="width:100%; background:linear-gradient(135deg, var(--primary) 0%, #1e1b4b 150%); color:#fff; font-size:0.8rem; padding:0.7rem; font-weight:800; border-radius:8px; box-shadow:0 4px 12px rgba(79,70,229,0.35); border:none; cursor:pointer;">📊 Generar Resumen</button>
                <div style="display:flex; gap:10px;">
                  <button id="btn_clear_revision" class="btn" style="flex:1; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; font-size:0.75rem; padding:0.6rem; font-weight:700; border-radius:8px; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)';" onmouseout="this.style.background='rgba(239,68,68,0.1)';">🗑️ Limpiar Lecturas</button>
                  <button id="btn_export_revision" class="btn" style="flex:1; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#a7f3d0; font-size:0.75rem; padding:0.6rem; font-weight:700; border-radius:8px; transition:all 0.2s;" onmouseover="this.style.background='rgba(16,185,129,0.2)';" onmouseout="this.style.background='rgba(16,185,129,0.1)';">📥 Exportar Reporte</button>
                </div>
              </div>

              <!-- ULTIMO ESCANEO DETALLE -->
              ${scannedRfs.length ? (() => {
                const last = scannedRfs[0];
                const isExpected = expectedRFSerials.includes(last.serial);
                const bg = isExpected ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)';
                const border = isExpected ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)';
                const color = isExpected ? '#34d399' : '#f87171';
                
                return `
                  <div style="background:${bg}; border:${border}; border-radius:10px; padding:0.8rem; margin-top:0.3rem;">
                    <span style="font-size:0.6rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Última RF Escaneada:</span>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-size:1.1rem; font-weight:900; color:#fff; font-family:monospace;">${last.serial}</span>
                      <span style="background:${isExpected?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'}; color:${color}; font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:12px; border:1px solid ${color}44;">
                        ${isExpected ? '✔️ CONFORME' : '❌ NO ESPERADO'}
                      </span>
                    </div>
                  </div>
                `;
              })() : ''}
            </div>
          </div>

          <!-- COLUMNA DERECHA: COMPARACIÓN Y LISTAS -->
          <div style="display:flex; flex-direction:column; gap:1.5rem; flex:1; width:100%; overflow:hidden;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
              <!-- EQUIPOS LEÍDOS / HISTORIAL -->
              <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08); display:flex; flex-direction:column; min-height:420px;">
                <h4 style="margin:0 0 1rem 0; color:#06b6d4; font-size:0.85rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                  📋 Equipos Escaneados (${scannedRfs.length})
                </h4>
                
                <div style="overflow-y:auto; max-height:350px; flex:1;">
                  <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                    <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:1;">
                      <tr>
                        <th style="padding:0.6rem; text-align:left;">Equipo RF</th>
                        <th style="padding:0.6rem; text-align:left;">Estado anterior / Operario</th>
                        <th style="padding:0.6rem; text-align:center; width:90px;">Validación</th>
                        <th style="padding:0.6rem; text-align:center; width:40px;"></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${scannedRfs.length ? scannedRfs.map((s, sIdx) => {
                        const isExpected = expectedRFSerials.includes(s.serial);
                        const detail = expectedRFDetails[s.serial];
                        
                        return `
                          <tr style="border-bottom:1px solid rgba(255,255,255,0.02); background:${isExpected?'rgba(16,185,129,0.02)':'rgba(239,68,68,0.02)'};">
                            <td style="padding:0.7rem; font-weight:900; color:#fff; font-family:monospace;">${s.serial}</td>
                            <td style="padding:0.7rem;">
                              ${isExpected && detail ? `
                                <div style="font-weight:700; color:#cbd5e1;">${detail.worker_name}</div>
                                <div style="font-size:0.6rem; color:var(--text-muted);">Turno anterior: ${detail.turn}</div>
                              ` : `
                                <div style="color:var(--text-muted); font-style:italic;">No estuvo en uso en el turno</div>
                              `}
                            </td>
                            <td style="padding:0.7rem; text-align:center;">
                              ${isExpected ? `
                                <span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px;">✔️ BIEN</span>
                              ` : `
                                <span style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px;">❌ X</span>
                              `}
                            </td>
                            <td style="padding:0.7rem; text-align:center;">
                              <button class="btn-delete-scan" data-idx="${sIdx}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; filter:grayscale(0.5); outline:none;">🗑️</button>
                            </td>
                          </tr>
                        `;
                      }).join('') : '<tr><td colspan="4" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-style:italic;">Use su lectora para escanear los equipos.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- EQUIPOS PENDIENTES / FALTANTES -->
              <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08); display:flex; flex-direction:column; min-height:420px;">
                <h4 style="margin:0 0 1rem 0; color:#ef4444; font-size:0.85rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                  ⏳ Pendientes por Encontrar (${pendingCount})
                </h4>
                
                <div style="overflow-y:auto; max-height:350px; flex:1;">
                  <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                    <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:1;">
                      <tr>
                        <th style="padding:0.6rem; text-align:left;">Equipo RF</th>
                        <th style="padding:0.6rem; text-align:left;">Operario Turno Anterior</th>
                        <th style="padding:0.6rem; text-align:center; width:90px;">Turno anterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser)).length ? 
                        expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser)).map(ser => {
                          const detail = expectedRFDetails[ser];
                          return `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                              <td style="padding:0.7rem; font-weight:900; color:#fff; font-family:monospace;">${ser}</td>
                              <td style="padding:0.7rem;">
                                <div style="font-weight:700; color:#cbd5e1;">${detail ? detail.worker_name : '—'}</div>
                              </td>
                              <td style="padding:0.7rem; text-align:center; color:var(--text-muted);">
                                ${detail ? detail.turn : '—'}
                              </td>
                            </tr>
                          `;
                        }).join('') : '<tr><td colspan="3" style="padding:3rem; text-align:center; color:#10b981; font-weight:800; font-size:0.85rem;">🎉 ¡Todos los equipos esperados han sido validados!</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      `}
    `;

    // AÑADIR LISTENERS DE EVENTOS
    setTimeout(() => {
      // TAB CLICKS
      const tabInv = document.getElementById('rf_tab_inventario');
      const tabAsig = document.getElementById('rf_tab_asignaciones');
      const tabAsigar = document.getElementById('rf_tab_asignar');
      const tabRev = document.getElementById('rf_tab_revision');
      if (tabInv) tabInv.onclick = () => { activeRFTab = 'inventario'; renderRFSection(container, user, TABS); };
      if (tabAsig) tabAsig.onclick = () => { activeRFTab = 'asignaciones'; renderRFSection(container, user, TABS); };
      if (tabAsigar) tabAsigar.onclick = () => { activeRFTab = 'asignar'; renderRFSection(container, user, TABS); };
      if (tabRev) tabRev.onclick = () => { activeRFTab = 'revision'; renderRFSection(container, user, TABS); };

      // REVISION SUB-TAB LISTENERS
      const revDateInput = document.getElementById('rf_rev_date');
      if (revDateInput) {
        revDateInput.onchange = (e) => {
          revisionDate = e.target.value;
          renderRFSection(container, user, TABS);
        };
      }

      const revTurnInput = document.getElementById('rf_rev_turn');
      if (revTurnInput) {
        revTurnInput.onchange = (e) => {
          revisionTurn = e.target.value;
          renderRFSection(container, user, TABS);
        };
      }

      const scannerInput = document.getElementById('rf_rev_scanner_input');
      if (scannerInput) {
        scannerInput.focus();
        scannerInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            const val = e.target.value.trim();
            if (val) {
              if (scannedRfs.some(s => s.serial === val)) {
                alert(`⚠️ El equipo ${val} ya fue escaneado en esta sesión.`);
                e.target.value = '';
                return;
              }
              const isExpected = expectedRFSerials.includes(val);
              playBeep(isExpected ? 'success' : 'error');
              scannedRfs.unshift({
                serial: val,
                timestamp: new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
              });
              renderRFSection(container, user, TABS);
            }
            e.target.value = '';
          }
        };
      }

      const btnClearRev = document.getElementById('btn_clear_revision');
      if (btnClearRev) {
        btnClearRev.onclick = () => {
          if (confirm("¿Está seguro de limpiar todas las lecturas de la sesión de validación actual?")) {
            scannedRfs = [];
            renderRFSection(container, user, TABS);
          }
        };
      }

      const btnGenSummary = document.getElementById('btn_generate_summary');
      if (btnGenSummary) {
        btnGenSummary.onclick = () => {
          const missing = expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser));
          const unexpected = scannedRfs.filter(s => !expectedRFSerials.includes(s.serial));
          
          const modal = document.createElement('div');
          modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
          modal.innerHTML = `
            <div class="glass-panel" style="width:580px; max-height:85vh; display:flex; flex-direction:column; padding:2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.25); overflow:hidden;">
              <h3 style="margin:0 0 1.2rem 0; color:#fff; font-size:1.15rem; font-weight:800; text-align:center; letter-spacing:0.5px;">
                📊 RESUMEN DE VALIDACIÓN RF
              </h3>
              
              <!-- METRICS GRID -->
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:1.5rem;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Esperados</div>
                  <div style="font-size:1.2rem; font-weight:900; color:#fff; margin-top:4px;">${totalExpected}</div>
                </div>
                <div style="background:rgba(34,197,94,0.05); border:1px solid rgba(34,197,94,0.2); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:#86efac; font-weight:800; text-transform:uppercase;">Coincidentes</div>
                  <div style="font-size:1.2rem; font-weight:900; color:var(--success); margin-top:4px;">${uniqueFoundExpected}</div>
                </div>
                <div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:#fca5a5; font-weight:800; text-transform:uppercase;">Faltantes</div>
                  <div style="font-size:1.2rem; font-weight:900; color:#ef4444; margin-top:4px;">${pendingCount}</div>
                </div>
                <div style="background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:#93c5fd; font-weight:800; text-transform:uppercase;">Inesperados</div>
                  <div style="font-size:1.2rem; font-weight:900; color:#3b82f6; margin-top:4px;">${uniqueUnexpected}</div>
                </div>
              </div>

              <!-- DETAILS CONTAINER -->
              <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:1.2rem; margin-bottom:1.5rem; padding-right:5px;">
                <!-- SECCIÓN FALTANTES -->
                <div>
                  <h4 style="margin:0 0 8px 0; color:#ef4444; font-size:0.78rem; font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
                    ⏳ FALTANTES POR ENCONTRAR (${missing.length})
                  </h4>
                  <div style="background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.04); border-radius:8px; padding:8px; font-size:0.72rem; max-height:180px; overflow-y:auto;">
                    ${missing.length ? missing.map(ser => {
                      const detail = expectedRFDetails[ser];
                      return `<div style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; justify-content:space-between;">
                        <span style="font-family:monospace; font-weight:800; color:#fff;">${ser}</span>
                        <span style="color:var(--text-muted); font-size:0.68rem;">Anterior: ${detail ? detail.worker_name : '—'} (${detail ? detail.turn : '—'})</span>
                      </div>`;
                    }).join('') : '<div style="color:var(--success); text-align:center; padding:8px; font-weight:700;">¡Ningún equipo faltante! Todos fueron validados.</div>'}
                  </div>
                </div>

                <!-- SECCIÓN INESPERADOS -->
                <div>
                  <h4 style="margin:0 0 8px 0; color:#3b82f6; font-size:0.78rem; font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
                    ❌ INESPERADOS / NUEVOS DETECTADOS (${unexpected.length})
                  </h4>
                  <div style="background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.04); border-radius:8px; padding:8px; font-size:0.72rem; max-height:180px; overflow-y:auto;">
                    ${unexpected.length ? unexpected.map(s => {
                      return `<div style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; justify-content:space-between;">
                        <span style="font-family:monospace; font-weight:800; color:#fff;">${s.serial}</span>
                        <span style="color:#93c5fd; font-size:0.65rem; font-weight:700;">[${s.timestamp}] -> NO ESPERADO</span>
                      </div>`;
                    }).join('') : '<div style="color:var(--text-muted); text-align:center; padding:8px;">No se detectaron equipos fuera de turno.</div>'}
                  </div>
                </div>
              </div>

              <!-- BUTTONS -->
              <div style="display:flex; justify-content:flex-end;">
                <button id="btn_close_summary_modal" class="btn" style="width:120px; background:rgba(255,255,255,0.08); border:1px solid var(--border); color:#fff; font-weight:800; font-size:0.78rem; border-radius:8px; padding:0.6rem;">Cerrar</button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
          
          document.getElementById('btn_close_summary_modal').onclick = () => {
            document.body.removeChild(modal);
          };
        };
      }

      const btnExportRev = document.getElementById('btn_export_revision');
      if (btnExportRev) {
        btnExportRev.onclick = () => {
          const missing = expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser));
          const unexpected = scannedRfs.filter(s => !expectedRFSerials.includes(s.serial));
          
          if (!scannedRfs.length && !missing.length) {
            alert("⚠️ No hay lecturas escaneadas ni faltantes para exportar.");
            return;
          }
          
          let reportContent = `REPORTE DE VALIDACIÓN Y REVISIÓN DE RF\n`;
          reportContent += `========================================\n`;
          reportContent += `Fecha Referencia: ${revisionDate}\n`;
          reportContent += `Turno Referencia: ${revisionTurn}\n`;
          reportContent += `Fecha de Generación: ${new Date().toLocaleString('es-ES')}\n`;
          reportContent += `----------------------------------------\n\n`;
          reportContent += `RESUMEN DE EQUIPOS:\n`;
          reportContent += `Esperados: ${totalExpected}\n`;
          reportContent += `Coincidentes OK: ${uniqueFoundExpected}\n`;
          reportContent += `Faltantes: ${pendingCount}\n`;
          reportContent += `Inesperados: ${uniqueUnexpected}\n\n`;
          
          reportContent += `DETALLE DE EQUIPOS FALTANTES E INESPERADOS (NUEVOS):\n`;
          reportContent += `----------------------------------------\n`;
          reportContent += `FALTANTES POR ENCONTRAR:\n`;
          if (missing.length) {
            missing.forEach(ser => {
              const detail = expectedRFDetails[ser];
              const workerName = detail ? detail.worker_name : 'Sin registro';
              const turnName = detail ? detail.turn : '—';
              reportContent += `- Serial: ${ser} - Anterior: ${workerName} (${turnName})\n`;
            });
          } else {
            reportContent += `¡Ningún equipo faltante! Todos fueron encontrados.\n`;
          }
          
          reportContent += `\nINESPERADOS / NUEVOS DETECTADOS:\n`;
          if (unexpected.length) {
            unexpected.forEach(s => {
              reportContent += `- [${s.timestamp}] Serial: ${s.serial} -> NO ESPERADO\n`;
            });
          } else {
            reportContent += `Ninguno.\n`;
          }
          
          const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `Reporte_Revision_RF_${revisionDate}_${revisionTurn}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
      }

      container.querySelectorAll('.btn-delete-scan').forEach(btn => {
        btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.dataset.idx);
          scannedRfs.splice(idx, 1);
          renderRFSection(container, user, TABS);
        };
      });

      // SUB-TABS CLICKS
      const subTabRfs = document.getElementById('rf_sub_tab_rfs');
      const subTabBats = document.getElementById('rf_sub_tab_baterias');
      const subTabChgs = document.getElementById('rf_sub_tab_cargadores');
      if (subTabRfs) subTabRfs.onclick = () => { activeInventorySubTab = 'rfs'; renderRFSection(container, user, TABS); };
      if (subTabBats) subTabBats.onclick = () => { activeInventorySubTab = 'baterias'; renderRFSection(container, user, TABS); };
      if (subTabChgs) subTabChgs.onclick = () => { activeInventorySubTab = 'cargadores'; renderRFSection(container, user, TABS); };

      // SEARCH & FILTER INPUTS
      const searchInput = document.getElementById('rf_search_input');
      if (searchInput) {
        searchInput.oninput = (e) => {
          rfSearchQuery = e.target.value;
          renderRFSection(container, user, TABS);
          document.getElementById('rf_search_input').focus();
          document.getElementById('rf_search_input').selectionStart = document.getElementById('rf_search_input').selectionEnd = rfSearchQuery.length;
        };
      }

      const statusFilter = document.getElementById('rf_status_filter');
      if (statusFilter) {
        statusFilter.onchange = (e) => {
          rfStatusFilter = e.target.value;
          renderRFSection(container, user, TABS);
        };
      }

      // SUBMIT FORM FAST ASSIGN
      const formFast = document.getElementById('form_fast_assign');
      if (formFast) {
        formFast.onsubmit = async (e) => {
          e.preventDefault();
          const workerDni = document.getElementById('rf_fast_worker').value;
          const rfSerie = document.getElementById('rf_fast_device').value;
          const turnVal = document.getElementById('rf_fast_turn').value;
          const pantallaOk = document.getElementById('rf_fast_pantalla').checked;
          const numeracionOk = document.getElementById('rf_fast_numeracion').checked;
          const notesVal = document.getElementById('rf_fast_notes').value.trim();

          const worker = activeWorkers.find(w => w.dni === workerDni);
          const rfDevice = rfs.find(r => r.serie === rfSerie);

          if (!worker || !rfDevice) return alert("Operario o Terminal RF no seleccionado.");

          // Validar asignaciones existentes
          const workerActiveRf = rfs.find(r => r.asignadoDni === workerDni);
          if (workerActiveRf) {
            if (!confirm(`⚠️ El operario ${worker.nombre} ya tiene asignado el equipo ${workerActiveRf.serie}. ¿Deseas asignarle este nuevo equipo adicional?`)) {
              return;
            }
          }

          // Actualizar RF
          const listRfs = [...rfs];
          const rfIdx = listRfs.findIndex(r => r.serie === rfSerie);
          if (rfIdx !== -1) {
            listRfs[rfIdx].asignadoDni = workerDni;
            listRfs[rfIdx].asignadoNombre = `${worker.apellidos}, ${worker.nombre}`;
            listRfs[rfIdx].asignadoTurno = turnVal;
          }

          // Crear Asignación
          const listAssignments = [...assignments];
          listAssignments.push({
            id: 'ASIG_' + Date.now(),
            rf_serial: rfSerie,
            worker_dni: workerDni,
            worker_name: `${worker.apellidos}, ${worker.nombre}`,
            turn: turnVal,
            assigned_at: new Date().toISOString(),
            returned_at: null,
            pantalla_ok: pantallaOk,
            numeracion_ok: numeracionOk,
            notes: notesVal,
            return_notes: null
          });

          await adminService.saveRfs(listRfs);
          await adminService.saveRfAssignments(listAssignments);

          alert(`✅ Asignación rápida exitosa: RF ${rfSerie} entregada a ${worker.nombre}.`);
          renderRFSection(container, user, TABS);
        };
      }

      // NUEVO REGISTRO EQUIPO RF
      const btnNewRf = document.getElementById('btn_new_rf');
      if (btnNewRf) btnNewRf.onclick = () => abrirModalRF(container, user, TABS);

      // NUEVA BATERÍA
      const btnNewBattery = document.getElementById('btn_new_battery');
      if (btnNewBattery) btnNewBattery.onclick = () => abrirModalBattery(container, user, TABS);

      // NUEVO CARGADOR
      const btnNewCharger = document.getElementById('btn_new_charger');
      if (btnNewCharger) btnNewCharger.onclick = () => abrirModalCharger(container, user, TABS);

      // ACCIONES INDIVIDUALES EQUIPOS RF
      container.querySelectorAll('.btn-edit-rf').forEach(btn => {
        btn.onclick = (e) => {
          const rf = JSON.parse(e.currentTarget.dataset.rf);
          abrirModalRF(container, user, TABS, rf);
        };
      });

      container.querySelectorAll('.btn-delete-rf').forEach(btn => {
        btn.onclick = async (e) => {
          const serie = e.currentTarget.dataset.serie;
          if (confirm(`¿Estás seguro de eliminar el terminal RF ${serie} de forma permanente?`)) {
            const list = adminService.getRfs().filter(r => r.serie !== serie);
            await adminService.saveRfs(list);
            alert("✅ Equipo eliminado con éxito.");
            renderRFSection(container, user, TABS);
          }
        };
      });

      // ACCIONES INDIVIDUALES BATERÍAS
      container.querySelectorAll('.btn-edit-battery').forEach(btn => {
        btn.onclick = (e) => {
          const bat = JSON.parse(e.currentTarget.dataset.battery);
          abrirModalBattery(container, user, TABS, bat);
        };
      });

      container.querySelectorAll('.btn-delete-battery').forEach(btn => {
        btn.onclick = async (e) => {
          const codigo = e.currentTarget.dataset.codigo;
          if (confirm(`¿Estás seguro de eliminar la batería ${codigo} de forma permanente?`)) {
            const list = adminService.getRfsBatteries().filter(b => b.codigo !== codigo);
            await adminService.saveRfsBatteries(list);
            alert("✅ Batería eliminada con éxito.");
            renderRFSection(container, user, TABS);
          }
        };
      });

      // ACCIONES INDIVIDUALES CARGADORES
      container.querySelectorAll('.btn-edit-charger').forEach(btn => {
        btn.onclick = (e) => {
          const chg = JSON.parse(e.currentTarget.dataset.charger);
          abrirModalCharger(container, user, TABS, chg);
        };
      });

      container.querySelectorAll('.btn-delete-charger').forEach(btn => {
        btn.onclick = async (e) => {
          const codigo = e.currentTarget.dataset.codigo;
          if (confirm(`¿Estás seguro de eliminar el cargador ${codigo} de forma permanente?`)) {
            const list = adminService.getRfsChargers().filter(c => c.codigo !== codigo);
            await adminService.saveRfsChargers(list);
            alert("✅ Cargador eliminado con éxito.");
            renderRFSection(container, user, TABS);
          }
        };
      });

      // BOTÓN DE RECIBIR EN TABLA (dentro de celda Devolución)
      container.querySelectorAll('.btn-recibir-rf').forEach(btn => {
        btn.onclick = (e) => {
          const serie = e.currentTarget.dataset.serie;
          abrirModalRecibir(container, user, TABS, serie);
        };
      });

      // EDITAR ASIGNACIÓN EN BITÁCORA
      container.querySelectorAll('.btn-edit-assignment').forEach(btn => {
        btn.onclick = (e) => {
          const id = e.currentTarget.dataset.id;
          abrirModalEditarAsignacion(container, user, TABS, id);
        };
      });

      // BORRAR ASIGNACIÓN EN BITÁCORA
      container.querySelectorAll('.btn-delete-assignment').forEach(btn => {
        btn.onclick = async (e) => {
          const id = e.currentTarget.dataset.id;
          const serial = e.currentTarget.dataset.serial;
          const isPendingDel = e.currentTarget.dataset.pending === 'true';
          if (!confirm(`¿Eliminar este registro de asignación del equipo ${serial}?\nEsta acción no se puede deshacer.`)) return;
          let listAsig = adminService.getRfAssignments().filter(a => a.id !== id);
          await adminService.saveRfAssignments(listAsig);
          if (isPendingDel) {
            const listRfs = adminService.getRfs();
            const rfIdx = listRfs.findIndex(r => r.serie === serial);
            if (rfIdx !== -1) {
              listRfs[rfIdx].asignadoDni = null;
              listRfs[rfIdx].asignadoNombre = null;
              listRfs[rfIdx].asignadoTurno = null;
              await adminService.saveRfs(listRfs);
            }
          }
          alert('✅ Registro eliminado correctamente.');
          renderRFSection(container, user, TABS);
        };
      });

    }, 10);
  };

  const abrirModalEditarAsignacion = (container, user, TABS, asigId) => {
    const allAssignments = adminService.getRfAssignments() || [];
    const allWorkers = adminService.getWorkers() || [];
    const a = allAssignments.find(x => x.id === asigId);
    if (!a) return alert('No se encontró el registro.');

    const toLocalDT = (isoStr) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(12px); overflow-y:auto; padding:2rem 0;";
    modal.innerHTML = `
      <div class="glass-panel" style="width:min(600px,96vw); padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(99,102,241,0.25); background:linear-gradient(135deg, rgba(30,41,59,0.97) 0%, rgba(15,23,42,0.99) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.15); position:relative; max-height:90vh; overflow-y:auto;">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit',sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ✏️ EDITAR REGISTRO DE ASIGNACIÓN
        </h3>
        <div style="font-size:0.7rem; color:rgba(255,255,255,0.35); text-align:center; margin-bottom:1.5rem; font-family:monospace;">ID: ${a.id}</div>

        <form id="form_edit_asig" style="display:flex; flex-direction:column; gap:1.2rem;">

          <!-- TRABAJADOR -->
          <div>
            <label style="font-size:0.72rem; color:#94a3b8; display:block; margin-bottom:6px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">👷 TRABAJADOR:</label>
            <select id="ea_worker" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.78rem;">
              ${allWorkers.filter(w => w.active !== false).map(w =>
                `<option value="${w.dni}|${w.apellidos}, ${w.nombre}" style="background:#0f172a;" ${a.worker_dni === w.dni ? 'selected' : ''}>${w.apellidos}, ${w.nombre} (${w.dni})</option>`
              ).join('')}
            </select>
          </div>

          <!-- TURNO -->
          <div>
            <label style="font-size:0.72rem; color:#94a3b8; display:block; margin-bottom:6px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">🔄 TURNO:</label>
            <select id="ea_turn" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.78rem;">
              <option value="DIA" style="background:#0f172a;" ${a.turn === 'DIA' ? 'selected' : ''}>DIA</option>
              <option value="NOCHE" style="background:#0f172a;" ${a.turn === 'NOCHE' ? 'selected' : ''}>NOCHE</option>
            </select>
          </div>

          <!-- ASIGNACIÓN (ENTREGA) -->
          <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:1rem;">
            <p style="margin:0 0 0.8rem 0; font-size:0.72rem; color:#818cf8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">📦 ASIGNACIÓN (ENTREGA):</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:0.8rem;">
              <div>
                <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">FECHA / HORA:</label>
                <input type="datetime-local" id="ea_assigned_at" value="${toLocalDT(a.assigned_at)}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; font-weight:600;">
              </div>
              <div style="display:flex; flex-direction:column; gap:0.6rem; padding-top:0.3rem;">
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🖥️ Pantalla OK</span>
                  <input type="checkbox" id="ea_pantalla_ok" ${a.pantalla_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#6366f1;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🏷️ Numeración OK</span>
                  <input type="checkbox" id="ea_numeracion_ok" ${a.numeracion_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#6366f1;">
                </label>
              </div>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES ENTREGA:</label>
              <textarea id="ea_notes" rows="2" placeholder="Observaciones al momento de la entrega..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; resize:none;">${a.notes || ''}</textarea>
            </div>
          </div>

          <!-- DEVOLUCIÓN (RETORNO) -->
          <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:1rem;">
            <p style="margin:0 0 0.8rem 0; font-size:0.72rem; color:#34d399; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">📥 DEVOLUCIÓN (RETORNO):</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:0.8rem;">
              <div>
                <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">FECHA / HORA:</label>
                <input type="datetime-local" id="ea_returned_at" value="${toLocalDT(a.returned_at)}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; font-weight:600;">
              </div>
              <div style="display:flex; flex-direction:column; gap:0.6rem; padding-top:0.3rem;">
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🖥️ Pantalla OK</span>
                  <input type="checkbox" id="ea_ret_pantalla_ok" ${a.retorno_pantalla_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#10b981;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🏷️ Numeración OK</span>
                  <input type="checkbox" id="ea_ret_numeracion_ok" ${a.retorno_numeracion_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#10b981;">
                </label>
              </div>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES RETORNO (Bitácora):</label>
              <textarea id="ea_return_notes" rows="2" placeholder="Observaciones al momento del retorno..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; resize:none;">${a.return_notes || ''}</textarea>
            </div>
          </div>

          <!-- BOTONES -->
          <div style="display:flex; gap:10px; margin-top:0.8rem;">
            <button type="button" id="ea_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:2; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(99,102,241,0.35); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">💾 GUARDAR CAMBIOS</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#ea_cancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelector('#form_edit_asig').onsubmit = async (e) => {
      e.preventDefault();
      const workerRaw = modal.querySelector('#ea_worker').value.split('|');
      const newDni = workerRaw[0];
      const newName = workerRaw.slice(1).join('|');
      const newTurn = modal.querySelector('#ea_turn').value;
      const newAssignedAt = modal.querySelector('#ea_assigned_at').value;
      const newReturnedAt = modal.querySelector('#ea_returned_at').value;
      const newPantallaOk = modal.querySelector('#ea_pantalla_ok').checked;
      const newNumOk = modal.querySelector('#ea_numeracion_ok').checked;
      const newNotes = modal.querySelector('#ea_notes').value.trim();
      const newRetPantallaOk = modal.querySelector('#ea_ret_pantalla_ok').checked;
      const newRetNumOk = modal.querySelector('#ea_ret_numeracion_ok').checked;
      const newRetNotes = modal.querySelector('#ea_return_notes').value.trim();

      const wasActive = !a.returned_at;
      const nowActive = !newReturnedAt;

      const updatedList = allAssignments.map(x => {
        if (x.id !== asigId) return x;
        return {
          ...x,
          worker_dni: newDni,
          worker_name: newName,
          turn: newTurn,
          assigned_at: newAssignedAt ? new Date(newAssignedAt).toISOString() : x.assigned_at,
          returned_at: newReturnedAt ? new Date(newReturnedAt).toISOString() : null,
          pantalla_ok: newPantallaOk,
          numeracion_ok: newNumOk,
          notes: newNotes,
          retorno_pantalla_ok: newRetPantallaOk,
          retorno_numeracion_ok: newRetNumOk,
          return_notes: newRetNotes || null
        };
      });
      await adminService.saveRfAssignments(updatedList);

      const listRfs = adminService.getRfs();
      const rfIdx = listRfs.findIndex(r => r.serie === a.rf_serial);
      if (rfIdx !== -1) {
        if (wasActive && !nowActive) {
          listRfs[rfIdx].asignadoDni = null;
          listRfs[rfIdx].asignadoNombre = null;
          listRfs[rfIdx].asignadoTurno = null;
          await adminService.saveRfs(listRfs);
        } else if (!wasActive && nowActive) {
          listRfs[rfIdx].asignadoDni = newDni;
          listRfs[rfIdx].asignadoNombre = newName;
          listRfs[rfIdx].asignadoTurno = newTurn;
          await adminService.saveRfs(listRfs);
        } else if (wasActive && nowActive) {
          listRfs[rfIdx].asignadoDni = newDni;
          listRfs[rfIdx].asignadoNombre = newName;
          listRfs[rfIdx].asignadoTurno = newTurn;
          await adminService.saveRfs(listRfs);
        }
      }

      alert('✅ Registro de asignación actualizado correctamente.');
      modal.remove();
      renderRFSection(container, user, TABS);
    };
  };

  const abrirModalRF = (container, user, TABS, rf = null) => {
    const isEdit = !!rf;
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.2rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ${isEdit ? '✏️ EDITAR EQUIPO RF' : '📡 REGISTRAR EQUIPO RF'}
        </h3>
        
        <form id="form_rf_modal" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">SERIE / IDENTIFICADOR:</label>
            <input type="text" id="rf_m_serie" required value="${rf ? rf.serie : ''}" ${isEdit ? 'readonly style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); cursor:not-allowed; width:100%; outline:none; padding:0.6rem; border-radius:8px;"' : 'style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:800;"'}>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MARCA:</label>
              <input type="text" id="rf_m_marca" required placeholder="Ej: Zebra" value="${rf ? rf.marca : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MODELO:</label>
              <input type="text" id="rf_m_modelo" required placeholder="Ej: MC3300" value="${rf ? rf.modelo : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">NÚMERO:</label>
            <input type="text" id="rf_m_numero" placeholder="Ej: 001, A-12, RF-05..." value="${rf ? (rf.numero || '') : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(99,102,241,0.35); color:#a5b4fc; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:700; font-size:0.85rem;">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">BATERÍA (%):</label>
              <input type="number" id="rf_m_bateria" min="0" max="100" required value="${rf ? rf.bateria : '100'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">ESTADO FÍSICO:</label>
              <select id="rf_m_estado" style="background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer;">
                <option value="Operativo" ${rf && rf.estado==='Operativo'?'selected':''}>OPERATIVO</option>
                <option value="En Mantenimiento" ${rf && rf.estado==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
                <option value="De Baja" ${rf && rf.estado==='De Baja'?'selected':''}>DE BAJA</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">COMENTARIOS / NOTAS:</label>
            <textarea id="rf_m_comentarios" rows="3" placeholder="Detalles de estado del terminal..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;">${rf ? (rf.comentarios || '') : ''}</textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="rf_m_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, var(--primary) 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(79,70,229,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#rf_m_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_rf_modal').onsubmit = async (e) => {
      e.preventDefault();
      const serieVal = modal.querySelector('#rf_m_serie').value.trim().toUpperCase();
      const marcaVal = modal.querySelector('#rf_m_marca').value.trim();
      const modeloVal = modal.querySelector('#rf_m_modelo').value.trim();
      const numeroVal = modal.querySelector('#rf_m_numero').value.trim();
      const bateriaVal = modal.querySelector('#rf_m_bateria').value;
      const estadoVal = modal.querySelector('#rf_m_estado').value;
      const comentariosVal = modal.querySelector('#rf_m_comentarios').value.trim();

      if (!isEdit) {
        if (rfs.find(r => r.serie === serieVal)) {
          return alert(`❌ Error: El equipo con Serie ${serieVal} ya se encuentra registrado.`);
        }
      }

      const list = [...rfs];
      if (isEdit) {
        const idx = list.findIndex(r => r.serie === serieVal);
        if (idx !== -1) {
          list[idx] = { ...list[idx], marca: marcaVal, modelo: modeloVal, numero: numeroVal, bateria: bateriaVal, estado: estadoVal, comentarios: comentariosVal };
          if (estadoVal !== 'Operativo' && list[idx].asignadoDni) {
            const activeAssignment = assignments.find(a => a.rf_serial === serieVal && !a.returned_at);
            if (activeAssignment) {
              activeAssignment.returned_at = new Date().toISOString();
              activeAssignment.return_notes = `Retorno forzado: El equipo pasó a estado ${estadoVal}.`;
              await adminService.saveRfAssignments(assignments);
            }
            list[idx].asignadoDni = null;
            list[idx].asignadoNombre = null;
            list[idx].asignadoTurno = null;
          }
        }
      } else {
        list.push({ serie: serieVal, marca: marcaVal, modelo: modeloVal, numero: numeroVal, bateria: bateriaVal, estado: estadoVal, comentarios: comentariosVal, asignadoDni: null });
      }

      await adminService.saveRfs(list);
      alert(isEdit ? "✅ Datos del equipo actualizados." : "✅ Equipo RF registrado con éxito.");
      modal.remove();
      renderRFSection(container, user, TABS);
    };
  };

  const abrirModalBattery = (container, user, TABS, bat = null) => {
    const isEdit = !!bat;
    const batteries = adminService.getRfsBatteries() || [];

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(16,185,129,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.2rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ${isEdit ? '✏️ EDITAR BATERÍA' : '🔋 REGISTRAR BATERÍA'}
        </h3>
        
        <form id="form_battery_modal" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">CÓDIGO DE BATERÍA:</label>
            <input type="text" id="bat_m_codigo" required value="${bat ? bat.codigo : ''}" ${isEdit ? 'readonly style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); cursor:not-allowed; width:100%; outline:none; padding:0.6rem; border-radius:8px;"' : 'style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:800;"'}>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">COMPATIBILIDAD (MODELO RFS):</label>
            <input type="text" id="bat_m_modelo" required placeholder="Ej: Zebra MC3300" value="${bat ? bat.modelo : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">SALUD CELDA (%):</label>
              <input type="number" id="bat_m_salud" min="0" max="100" required value="${bat ? bat.salud : '100'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">ESTADO FÍSICO:</label>
              <select id="bat_m_estado" style="background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer;">
                <option value="Operativo" ${bat && bat.estado==='Operativo'?'selected':''}>OPERATIVO</option>
                <option value="En Mantenimiento" ${bat && bat.estado==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
                <option value="De Baja" ${bat && bat.estado==='De Baja'?'selected':''}>DE BAJA</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">UBICACIÓN / RANURA DE CARGA:</label>
            <input type="text" id="bat_m_ubicacion" required placeholder="Ej: Cargador 1, Ranura 3" value="${bat ? bat.ubicacion : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / COMENTARIOS:</label>
            <textarea id="bat_m_comentarios" rows="3" placeholder="Comentarios sobre el estado de la batería..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;">${bat ? (bat.comentarios || '') : ''}</textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="bat_m_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #10b981 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(16,185,129,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#bat_m_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_battery_modal').onsubmit = async (e) => {
      e.preventDefault();
      const codigoVal = modal.querySelector('#bat_m_codigo').value.trim().toUpperCase();
      const modeloVal = modal.querySelector('#bat_m_modelo').value.trim();
      const saludVal = modal.querySelector('#bat_m_salud').value;
      const estadoVal = modal.querySelector('#bat_m_estado').value;
      const ubicacionVal = modal.querySelector('#bat_m_ubicacion').value.trim();
      const comentariosVal = modal.querySelector('#bat_m_comentarios').value.trim();

      if (!isEdit) {
        if (batteries.find(b => b.codigo === codigoVal)) {
          return alert(`❌ Error: La batería con Código ${codigoVal} ya se encuentra registrada.`);
        }
      }

      const list = [...batteries];
      if (isEdit) {
        const idx = list.findIndex(b => b.codigo === codigoVal);
        if (idx !== -1) {
          list[idx] = { ...list[idx], modelo: modeloVal, salud: saludVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal };
        }
      } else {
        list.push({ codigo: codigoVal, modelo: modeloVal, salud: saludVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal });
      }

      await adminService.saveRfsBatteries(list);
      alert(isEdit ? "✅ Datos de la batería actualizados." : "✅ Batería registrada con éxito.");
      modal.remove();
      renderRFSection(container, user, TABS);
    };
  };

  const abrirModalCharger = (container, user, TABS, chg = null) => {
    const isEdit = !!chg;
    const chargers = adminService.getRfsChargers() || [];

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(6, 182, 212, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(6,182,212,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.2rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ${isEdit ? '✏️ EDITAR CARGADOR' : '🔌 REGISTRAR CARGADOR'}
        </h3>
        
        <form id="form_charger_modal" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">CÓDIGO DE CARGADOR:</label>
            <input type="text" id="chg_m_codigo" required value="${chg ? chg.codigo : ''}" ${isEdit ? 'readonly style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); cursor:not-allowed; width:100%; outline:none; padding:0.6rem; border-radius:8px;"' : 'style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:800;"'}>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MARCA:</label>
              <input type="text" id="chg_m_marca" required placeholder="Ej: Zebra" value="${chg ? chg.marca : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MODELO:</label>
              <input type="text" id="chg_m_modelo" required placeholder="Ej: 4 Slots Stand" value="${chg ? chg.modelo : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">CAPACIDAD (RANURAS):</label>
              <input type="number" id="chg_m_capacidad" min="1" max="24" required value="${chg ? chg.capacidad : '4'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">RANURAS OPERATIVAS:</label>
              <input type="number" id="chg_m_ranuras_ok" min="0" max="24" required value="${chg ? chg.ranuras_ok : '4'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">UBICACIÓN / MESA:</label>
              <input type="text" id="chg_m_ubicacion" required placeholder="Ej: Mesa de Carga 1" value="${chg ? chg.ubicacion : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">ESTADO FÍSICO:</label>
              <select id="chg_m_estado" style="background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer;">
                <option value="Operativo" ${chg && chg.estado==='Operativo'?'selected':''}>OPERATIVO</option>
                <option value="En Mantenimiento" ${chg && chg.estado==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
                <option value="De Baja" ${chg && chg.estado==='De Baja'?'selected':''}>DE BAJA</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">COMENTARIOS / NOTAS:</label>
            <textarea id="chg_m_comentarios" rows="3" placeholder="Comentarios sobre el estado del cargador..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;">${chg ? (chg.comentarios || '') : ''}</textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="chg_m_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #06b6d4 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(6,182,212,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#chg_m_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_charger_modal').onsubmit = async (e) => {
      e.preventDefault();
      const codigoVal = modal.querySelector('#chg_m_codigo').value.trim().toUpperCase();
      const marcaVal = modal.querySelector('#chg_m_marca').value.trim();
      const modeloVal = modal.querySelector('#chg_m_modelo').value.trim();
      const capacidadVal = modal.querySelector('#chg_m_capacidad').value;
      const ranurasOkVal = modal.querySelector('#chg_m_ranuras_ok').value;
      const estadoVal = modal.querySelector('#chg_m_estado').value;
      const ubicacionVal = modal.querySelector('#chg_m_ubicacion').value.trim();
      const comentariosVal = modal.querySelector('#chg_m_comentarios').value.trim();

      if (parseInt(ranurasOkVal) > parseInt(capacidadVal)) {
        return alert("❌ Error: Las ranuras operativas no pueden exceder la capacidad total.");
      }

      if (!isEdit) {
        if (chargers.find(c => c.codigo === codigoVal)) {
          return alert(`❌ Error: El cargador con Código ${codigoVal} ya se encuentra registrado.`);
        }
      }

      const list = [...chargers];
      if (isEdit) {
        const idx = list.findIndex(c => c.codigo === codigoVal);
        if (idx !== -1) {
          list[idx] = { ...list[idx], marca: marcaVal, modelo: modeloVal, capacidad: capacidadVal, ranuras_ok: ranurasOkVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal };
        }
      } else {
        list.push({ codigo: codigoVal, marca: marcaVal, modelo: modeloVal, capacidad: capacidadVal, ranuras_ok: ranurasOkVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal });
      }

      await adminService.saveRfsChargers(list);
      alert(isEdit ? "✅ Datos del cargador actualizados." : "✅ Cargador registrado con éxito.");
      modal.remove();
      renderRFSection(container, user, TABS);
    };
  };

  const abrirModalAsignar = (container, user, TABS, serie) => {
    const workers = adminService.getWorkers() || [];
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

    const activeWorkers = workers.filter(w => w.active !== false);

    const workerOptions = activeWorkers.map(w => `
      <option value="${w.dni}" style="background:#0f172a;">${w.apellidos}, ${w.nombre} (DNI: ${w.dni})</option>
    `).join('');

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          👷 ASIGNAR EQUIPO RF
        </h3>
        <p style="margin:-1rem 0 1.5rem 0; text-align:center; color:var(--primary); font-family:monospace; font-weight:800; font-size:0.9rem;">SERIE: ${serie}</p>
        
        <form id="form_rf_assign" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">SELECCIONAR TRABAJADOR:</label>
            <select id="rf_a_worker" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.65rem; border-radius:8px; font-weight:700; cursor:pointer;">
              <option value="" style="background:#0f172a;">-- Seleccionar operario activo --</option>
              ${workerOptions}
            </select>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">TURNO DE TRABAJO:</label>
            <select id="rf_a_turn" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.65rem; border-radius:8px; font-weight:700; cursor:pointer;">
              <option value="DIA" style="background:#0f172a;">DIA</option>
              <option value="NOCHE" style="background:#0f172a;">NOCHE</option>
            </select>
          </div>

          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); padding:0.8rem; border-radius:8px; display:flex; flex-direction:column; gap:0.6rem;">
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:block;">📝 CRITERIOS DE CONTROL (ENTREGA):</span>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🖥️ Pantalla en buen estado</span>
              <input type="checkbox" id="rf_a_pantalla" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🏷️ Numeración legible / OK</span>
              <input type="checkbox" id="rf_a_numeracion" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / COMENTARIOS:</label>
            <textarea id="rf_a_notes" rows="2" placeholder="Ej: Sin arañazos, incluye lápiz..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;"></textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="rf_a_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, var(--primary) 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(79,70,229,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">ASIGNAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#rf_a_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_rf_assign').onsubmit = async (e) => {
      e.preventDefault();
      const workerDni = modal.querySelector('#rf_a_worker').value;
      const turnVal = modal.querySelector('#rf_a_turn').value;
      const pantallaOk = modal.querySelector('#rf_a_pantalla').checked;
      const numeracionOk = modal.querySelector('#rf_a_numeracion').checked;
      const notesVal = modal.querySelector('#rf_a_notes').value.trim();

      const worker = activeWorkers.find(w => w.dni === workerDni);
      if (!worker) return;

      const workerActiveRf = rfs.find(r => r.asignadoDni === workerDni);
      if (workerActiveRf) {
        if (!confirm(`⚠️ El operario ${worker.nombre} ya tiene asignado el equipo ${workerActiveRf.serie}. ¿Deseas asignarle este nuevo equipo adicional?`)) {
          return;
        }
      }

      const listRfs = [...rfs];
      const rfIdx = listRfs.findIndex(r => r.serie === serie);
      if (rfIdx !== -1) {
        listRfs[rfIdx].asignadoDni = workerDni;
        listRfs[rfIdx].asignadoNombre = `${worker.apellidos}, ${worker.nombre}`;
        listRfs[rfIdx].asignadoTurno = turnVal;
      }

      const listAssignments = [...assignments];
      listAssignments.push({
        id: 'ASIG_' + Date.now(),
        rf_serial: serie,
        worker_dni: workerDni,
        worker_name: `${worker.apellidos}, ${worker.nombre}`,
        turn: turnVal,
        assigned_at: new Date().toISOString(),
        returned_at: null,
        pantalla_ok: pantallaOk,
        numeracion_ok: numeracionOk,
        notes: notesVal,
        return_notes: null
      });

      await adminService.saveRfs(listRfs);
      await adminService.saveRfAssignments(listAssignments);

      alert(`✅ Equipo RF ${serie} asignado correctamente.`);
      modal.remove();
      renderRFSection(container, user, TABS);
    };
  };

  const abrirModalRecibir = (container, user, TABS, serie) => {
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

    const rf = rfs.find(r => r.serie === serie);
    if (!rf) return;

    const activeAssignment = assignments.find(a => a.rf_serial === serie && !a.returned_at);

    const pantallaInicialText = activeAssignment && activeAssignment.pantalla_ok !== false ? '🖥️ OK' : '🖥️ FALLO / MAL';
    const numeracionInicialText = activeAssignment && activeAssignment.numeracion_ok !== false ? '🏷️ OK' : '🏷️ FALLO / MAL';

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          📥 RECIBIR EQUIPO RF (DEVOLUCIÓN)
        </h3>
        <p style="margin:-1rem 0 0.5rem 0; text-align:center; color:#f97316; font-family:monospace; font-weight:800; font-size:0.9rem;">SERIE: ${serie}</p>
        <div style="background:rgba(255,255,255,0.02); padding:0.5rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05); margin-bottom:1.2rem; font-size:0.7rem; text-align:center; color:var(--text-muted);">
          Operario: <b style="color:#fff;">${rf.asignadoNombre || 'Operario'}</b><br>
          <span style="display:inline-block; margin-top:3px;">
            Condición inicial: <span style="color:#38bdf8;">${pantallaInicialText}</span> | <span style="color:#38bdf8;">${numeracionInicialText}</span>
          </span>
        </div>
        
        <form id="form_rf_receive" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">BATERÍA DE RETORNO (%):</label>
            <input type="number" id="rf_r_bateria" min="0" max="100" required value="${rf.bateria}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
          </div>

          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); padding:0.8rem; border-radius:8px; display:flex; flex-direction:column; gap:0.6rem;">
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:block;">📝 CRITERIOS DE CONTROL (DEVOLUCIÓN):</span>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🖥️ Pantalla devuelta OK / Sin daños</span>
              <input type="checkbox" id="rf_r_pantalla" ${!activeAssignment || activeAssignment.pantalla_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🏷️ Numeración devuelta legible / OK</span>
              <input type="checkbox" id="rf_r_numeracion" ${!activeAssignment || activeAssignment.numeracion_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / NOTAS DE RETORNO:</label>
            <textarea id="rf_r_notes" rows="2" placeholder="Ej: Todo conforme, devuelto operativo..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;"></textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="rf_r_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #f97316 0%, #ea580c 100%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(234,88,12,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#rf_r_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_rf_receive').onsubmit = async (e) => {
      e.preventDefault();
      const batVal = modal.querySelector('#rf_r_bateria').value;
      const pantallaDevuelta = modal.querySelector('#rf_r_pantalla').checked;
      const numeracionDevuelta = modal.querySelector('#rf_r_numeracion').checked;
      const notesVal = modal.querySelector('#rf_r_notes').value.trim();

      const nuevoEstado = (!pantallaDevuelta || !numeracionDevuelta) ? 'En Mantenimiento' : 'Operativo';

      const listRfs = [...rfs];
      const rfIdx = listRfs.findIndex(r => r.serie === serie);
      if (rfIdx !== -1) {
        listRfs[rfIdx].asignadoDni = null;
        listRfs[rfIdx].asignadoNombre = null;
        listRfs[rfIdx].asignadoTurno = null;
        listRfs[rfIdx].bateria = batVal;
        listRfs[rfIdx].estado = nuevoEstado;
        if (nuevoEstado === 'En Mantenimiento') {
          listRfs[rfIdx].comentarios = `Devuelto con daños. Pantalla: ${pantallaDevuelta?'OK':'DAÑADA'} | Numeración: ${numeracionDevuelta?'OK':'DAÑADA'}. Observaciones: ${notesVal}`;
        }
      }

      const listAssignments = [...assignments];
      if (activeAssignment) {
        const asigIdx = listAssignments.findIndex(a => a.id === activeAssignment.id);
        if (asigIdx !== -1) {
          listAssignments[asigIdx].returned_at = new Date().toISOString();
          listAssignments[asigIdx].retorno_pantalla_ok = pantallaDevuelta;
          listAssignments[asigIdx].retorno_numeracion_ok = numeracionDevuelta;
          
          let alertDetails = `Devolución Conforme con ${batVal}% bat.`;
          if (nuevoEstado === 'En Mantenimiento') {
             alertDetails = `⚠️ DEVOLUCIÓN REGISTRADA CON DAÑOS. El terminal ha sido enviado automáticamente a Taller/Mantenimiento.`;
          }
          listAssignments[asigIdx].return_notes = `${alertDetails} ${notesVal ? '- ' + notesVal : ''}`;
        }
      }

      await adminService.saveRfs(listRfs);
      await adminService.saveRfAssignments(listAssignments);

      const successMsg = nuevoEstado === 'En Mantenimiento' 
        ? `⚠️ Equipo RF ${serie} devuelto CON DAÑOS. Se envió automáticamente al taller.`
        : `✅ Equipo RF ${serie} devuelto conforme y disponible.`;
      
      alert(successMsg);
      modal.remove();
      renderRFSection(container, user, TABS);
    };
  };

