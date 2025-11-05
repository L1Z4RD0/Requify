// dashboard-admin.js - VERSIÓN CONECTADA A BASE DE DATOS

// ==========================================================
// DEFINIMOS LA URL DE NUESTRA API
// ==========================================================
const API_URL = 'http://localhost:3000/api';

// ==========================================================
// VERIFICACIÓN DE SESIÓN (Esto no cambia)
// ==========================================================
window.addEventListener('load', () => {
    const usuarioActual = sessionStorage.getItem('usuarioActual');
    const nombreUsuario = sessionStorage.getItem('nombreUsuario');
    const rolUsuario = sessionStorage.getItem('rolUsuario');
    
    if (!usuarioActual) {
        window.location.href = '../index.html';
        return;
    }
    
    // Solo el Admin puede estar aquí
    if (rolUsuario !== 'Administrador') {
        alert('Acceso denegado. No tienes permisos de Administrador.');
        window.location.href = '../index.html'; // O al dashboard de encargado
        return;
    }
    
    // Mostrar información del usuario
    document.getElementById('nombreUsuario').textContent = nombreUsuario;
    document.getElementById('rolUsuario').textContent = rolUsuario;
    
    // Mostrar fecha actual
    actualizarFecha();
    
    // Cargar datos iniciales
    cargarDashboard();
    cargarActividadReciente(); // Aún no conectada, pero la dejamos lista
    cargarAlertas();
});

// ==========================================================
// NAVEGACIÓN Y UI (Esto no cambia)
// ==========================================================
const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
const sections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('pageTitle');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        sections.forEach(s => s.classList.remove('active'));
        
        const sectionId = link.getAttribute('data-section');
        document.getElementById(`section-${sectionId}`).classList.add('active');
        
        const titles = {
            'dashboard': 'Dashboard',
            'usuarios': 'Gestión de Usuarios',
            'prestamos': 'Gestión de Préstamos',
            'inventario': 'Inventario de Materiales',
            'reportes': 'Reportes y Estadísticas'
        };
        pageTitle.textContent = titles[sectionId];
        
        // Cargar datos según la sección
        if (sectionId === 'inventario') {
            actualizarInventario();
        } else if (sectionId === 'usuarios') {
            cargarUsuarios();
        } else if (sectionId === 'prestamos') {
            cargarPrestamos();
        }
    });
});

const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
});

document.getElementById('cerrarSesion').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('¿Está seguro que desea cerrar sesión?')) {
        sessionStorage.clear();
        window.location.href = '../index.html';
    }
});

function actualizarFecha() {
    const fecha = new Date();
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fechaActual').textContent = 
        fecha.toLocaleDateString('es-CL', opciones);
}

// ==========================================================
// CARGAR DATOS (¡Aquí reemplazamos localStorage por fetch!)
// ==========================================================

// --- Cargar Tarjetas (Stats) ---
async function cargarDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard/admin-stats`);
        if (!response.ok) throw new Error('No se pudieron cargar las estadísticas');
        
        const stats = await response.json();
        
        document.getElementById('totalUsuarios').textContent = stats.totalUsuarios;
        document.getElementById('prestamosActivos').textContent = stats.prestamosActivos;
        document.getElementById('prestamosVencidos').textContent = stats.prestamosVencidos;
        document.getElementById('totalMateriales').textContent = stats.totalMateriales || 170; // 170 es tu valor de respaldo

    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// --- Cargar Alertas ---
async function cargarAlertas() {
    const alertasDiv = document.getElementById('alertasSistema');
    try {
        const response = await fetch(`${API_URL}/alertas`);
        if (!response.ok) throw new Error('No se pudieron cargar las alertas');
        
        const alertas = await response.json();
        
        if (alertas.length === 0) {
            alertasDiv.innerHTML = '<p class="text-muted text-center">No hay alertas</p>';
            return;
        }
        
        alertasDiv.innerHTML = alertas.map(a => `
            <div class="alert-item alert-warning">
                <i class="fas fa-exclamation-triangle"></i> 
                Stock bajo de ${a.nombre}: solo ${a.disponibles} disponibles
            </div>
        `).join('');

    } catch (error) {
        console.error('Error cargando alertas:', error);
        alertasDiv.innerHTML = '<p class="text-danger text-center">No se pudieron cargar las alertas</p>';
    }
}

// --- Cargar Actividad Reciente (Pestaña Préstamos) ---
async function cargarActividadReciente() {
    // Esta la dejaremos pendiente, por ahora un placeholder
    const actividadDiv = document.getElementById('actividadReciente');
    actividadDiv.innerHTML = '<p class="text-muted text-center">No hay actividad reciente</p>';
    // Para conectarla, tendrías que llamar a /api/prestamos y mostrar los 5 últimos
}


// ==========================================================
// GESTIÓN DE USUARIOS (¡Conectado!)
// ==========================================================
const btnMostrarFormulario = document.getElementById('btnMostrarFormulario');
const formularioUsuario = document.getElementById('formularioUsuario');
const btnCancelarFormulario = document.getElementById('btnCancelarFormulario');
const formAgregarUsuario = document.getElementById('formAgregarUsuario');

btnMostrarFormulario.addEventListener('click', () => {
    formularioUsuario.style.display = 'block';
    btnMostrarFormulario.style.display = 'none';
});

btnCancelarFormulario.addEventListener('click', () => {
    formularioUsuario.style.display = 'none';
    btnMostrarFormulario.style.display = 'block';
    formAgregarUsuario.reset();
});

// --- ENVIAR FORMULARIO DE NUEVO USUARIO ---
formAgregarUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('passwordNuevo').value;
    const confirmarPassword = document.getElementById('confirmarPassword').value;
    
    if (password !== confirmarPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }
    
    const nuevoUsuario = {
        nombre: document.getElementById('nombreCompleto').value,
        rut: document.getElementById('rut').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value,
        rol: document.getElementById('rolUsuarioNuevo').value,
        username: document.getElementById('username').value,
        password: password,
        activo: document.getElementById('usuarioActivo').checked,
    };

    try {
        const response = await fetch(`${API_URL}/usuarios/crear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoUsuario)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al crear usuario');
        }

        alert('Usuario creado exitosamente');
        formAgregarUsuario.reset();
        formularioUsuario.style.display = 'none';
        btnMostrarFormulario.style.display = 'block';
        
        cargarUsuarios(); // Recargar la tabla
        cargarDashboard(); // Actualizar el contador de usuarios

    } catch (error) {
        console.error('Error al crear usuario:', error);
        alert(`Error: ${error.message}`);
    }
});

// --- CARGAR TABLA DE USUARIOS ---
async function cargarUsuarios() {
    const tablaUsuarios = document.getElementById('tablaUsuarios');
    try {
        const response = await fetch(`${API_URL}/usuarios`);
        if (!response.ok) throw new Error('No se pudieron cargar los usuarios');
        
        const usuarios = await response.json();
        
        if (usuarios.length === 0) {
            tablaUsuarios.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay usuarios registrados</td></tr>`;
            return;
        }
        
        tablaUsuarios.innerHTML = usuarios.map((usuario, index) => `
            <tr>
                <td>${usuario.ID_USUARIO}</td>
                <td>${usuario.NOMBRE} ${usuario.APELLIDO || ''}</td>
                <td>${usuario.USERNAME}</td>
                <td><span class="badge bg-primary">${usuario.NOMBRE_ROL}</span></td>
                <td>${usuario.EMAIL}</td>
                <td>
                    <span class="badge ${usuario.ESTADO ? 'bg-success' : 'bg-secondary'}">
                        ${usuario.ESTADO ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarUsuario(${usuario.ID_USUARIO})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${usuario.ID_USUARIO})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error cargando usuarios:', error);
        tablaUsuarios.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar usuarios.</td></tr>`;
    }
}

// --- ELIMINAR USUARIO ---
async function eliminarUsuario(id) {
    // No permitimos borrar el usuario admin (ID 1)
    if (id === 1) {
        alert('No se puede eliminar al usuario Administrador principal.');
        return;
    }
    
    if (confirm('¿Está seguro de eliminar este usuario? Esta acción es irreversible.')) {
        try {
            const response = await fetch(`${API_URL}/usuarios/eliminar/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al eliminar usuario');
            }

            alert('Usuario eliminado exitosamente');
            cargarUsuarios(); // Recargar la tabla
            cargarDashboard(); // Actualizar stats

        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

// --- EDITAR USUARIO (Función de ejemplo, no conectada) ---
function editarUsuario(id) {
    alert(`Función "Editar" aún no implementada. Se editaría el usuario con ID: ${id}`);
    // Para implementarla:
    // 1. Harías un fetch a /api/usuarios/${id} para obtener sus datos.
    // 2. Llenarías el formulario con esos datos.
    // 3. Cambiarías el botón "Guardar" por "Actualizar".
    // 4. El submit haría un fetch con método 'PUT' o 'PATCH' a /api/usuarios/actualizar/${id}
}


// ==========================================================
// GESTIÓN DE PRÉSTAMOS (Conectada)
// ==========================================================
async function cargarPrestamos() {
    const tablaPrestamos = document.getElementById('tablaPrestamos');
    try {
        const response = await fetch(`${API_URL}/prestamos`);
        if (!response.ok) throw new Error('No se pudieron cargar los préstamos');

        const prestamos = await response.json();

        if (prestamos.length === 0) {
            tablaPrestamos.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay préstamos registrados</td></tr>`;
            return;
        }

        tablaPrestamos.innerHTML = prestamos.map((p, index) => {
            let estadoBadge = 'bg-secondary'; // Devuelto
            let estadoTexto = 'Devuelto';
            if (p.ESTADO === 1) { // Activo
                if (new Date(p.FECHA_DEVOLUCION) < new Date()) {
                    estadoBadge = 'bg-danger';
                    estadoTexto = 'Vencido';
                } else {
                    estadoBadge = 'bg-success';
                    estadoTexto = 'Activo';
                }
            }
            
            return `
                <tr>
                    <td>${p.ID_SOLICITUD}</td>
                    <td>${p.NOMBRE_ALUMNO}</td>
                    <td>(Material)</td> <td>(Cant)</td>
                    <td>${formatearFecha(p.FECHA_SOLICITUD)}</td>
                    <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                    <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                    <td>
                        ${p.ESTADO === 1 ? `<button class="btn btn-sm btn-success">Devolver</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando préstamos:', error);
        tablaPrestamos.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error al cargar préstamos.</td></tr>`;
    }
}


// ==========================================================
// GESTIÓN DE INVENTARIO (Conectada)
// ==========================================================
async function actualizarInventario() {
    const tablaInventario = document.getElementById('tablaInventarioDetalle');
    try {
        const response = await fetch(`${API_URL}/inventario`);
        if (!response.ok) throw new Error('No se pudo cargar el inventario');
        
        const inventario = await response.json();

        if (inventario.length === 0) {
            tablaInventario.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay materiales registrados</td></tr>`;
            return;
        }
        
        tablaInventario.innerHTML = inventario.map(m => {
            const enPrestamo = m.total - m.disponibles;
            const utilizacion = (m.total > 0) ? ((enPrestamo / m.total) * 100).toFixed(1) : 0;
            const estadoClass = utilizacion > 70 ? 'text-danger' : utilizacion > 40 ? 'text-warning' : 'text-success';
            
            return `
                <tr>
                    <td><strong>${m.nombre}</strong></td>
                    <td>${m.total}</td>
                    <td><span class="badge bg-success">${m.disponibles}</span></td>
                    <td><span class="badge bg-warning">${enPrestamo}</span></td>
                    <td><strong class="${estadoClass}">${utilizacion}%</strong></td>
                    <td>
                        ${m.disponibles < 5 ? 
                            '<span class="badge bg-danger">Stock Crítico</span>' : 
                            '<span class="badge bg-success">Normal</span>'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando inventario:', error);
        tablaInventario.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar inventario.</td></tr>`;
    }
}


// ==========================================================
// UTILIDADES (Formatear Fecha)
// ==========================================================
function formatearFecha(fechaISO) {
    if (!fechaISO) return 'N/A';
    const date = new Date(fechaISO);
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}