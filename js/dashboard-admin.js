// dashboard-admin.js - VERSIÓN FINAL (v3.0)
// Incluye toda la lógica de Admin + Nuevo Gestor de Inventario
// (Cumple con los Puntos 1, 2 y 3 de las peticiones del cliente)

// ==========================================================
// DEFINIMOS LA URL DE NUESTRA API
// ==========================================================
const API_URL = 'http://localhost:3000/api';

// ==========================================================
// VERIFICACIÓN DE SESIÓN
// ==========================================================
window.addEventListener('load', () => {
    const usuarioActual = sessionStorage.getItem('usuarioActual');
    const nombreUsuario = sessionStorage.getItem('nombreUsuario');
    const rolUsuario = sessionStorage.getItem('rolUsuario');
    
    // 1. Validar que haya sesión
    if (!usuarioActual) {
        window.location.href = '../index.html';
        return;
    }
    
    // 2. Validar que sea Admin
    if (rolUsuario !== 'Administrador') {
        alert('Acceso denegado. No tienes permisos de Administrador.');
        window.location.href = '../index.html'; // O al dashboard de encargado
        return;
    }
    
    // 3. Cargar datos de UI
    document.getElementById('nombreUsuario').textContent = nombreUsuario;
    document.getElementById('rolUsuario').textContent = rolUsuario;
    actualizarFecha();
    
    // 4. Cargar datos iniciales del Dashboard
    cargarDashboard();
    cargarActividadReciente(); // (Aún pendiente de lógica completa)
    cargarAlertas();
});

// ==========================================================
// NAVEGACIÓN Y UI (Sin cambios)
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
        
        // Cargar datos dinámicamente al cambiar de pestaña
        if (sectionId === 'inventario') {
            actualizarInventario(); // Carga tarjetas Y tabla
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
// CARGAR DATOS (Dashboard, Alertas, etc.)
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
        document.getElementById('totalMateriales').textContent = stats.totalMateriales;

    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// --- Cargar Alertas ---
async function cargarAlertas() {
    const alertasDiv = document.getElementById('alertasSistema');
    try {
        const response = await fetch(`${API_URL}/inventario`); // Reutilizamos el endpoint de inventario
        if (!response.ok) throw new Error('No se pudieron cargar las alertas');
        
        const inventario = await response.json();
        const alertas = inventario.filter(item => item.disponibles < 5); // Alerta si hay menos de 5
        
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

// --- Cargar Actividad Reciente (Pendiente) ---
async function cargarActividadReciente() {
    const actividadDiv = document.getElementById('actividadReciente');
    actividadDiv.innerHTML = '<p class="text-muted text-center">No hay actividad reciente</p>';
    // Para conectar: llamar a /api/prestamos y mostrar los 5 últimos
}


// ==========================================================
// GESTIÓN DE USUARIOS (Sin cambios)
// ==========================================================
const btnMostrarFormulario = document.getElementById('btnMostrarFormulario');
const formularioUsuario = document.getElementById('formularioUsuario');
const btnCancelarFormulario = document.getElementById('btnCancelarFormulario');
const formAgregarUsuario = document.getElementById('formAgregarUsuario');

if (btnMostrarFormulario) {
    btnMostrarFormulario.addEventListener('click', () => {
        formularioUsuario.style.display = 'block';
        btnMostrarFormulario.style.display = 'none';
    });
}
if (btnCancelarFormulario) {
    btnCancelarFormulario.addEventListener('click', () => {
        formularioUsuario.style.display = 'none';
        btnMostrarFormulario.style.display = 'block';
        formAgregarUsuario.reset();
    });
}

if (formAgregarUsuario) {
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
            if (!response.ok) { throw new Error(data.message || 'Error al crear usuario'); }
            alert('Usuario creado exitosamente');
            formAgregarUsuario.reset();
            formularioUsuario.style.display = 'none';
            btnMostrarFormulario.style.display = 'block';
            cargarUsuarios();
            cargarDashboard();
        } catch (error) { console.error('Error al crear usuario:', error); alert(`Error: ${error.message}`); }
    });
}

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
    } catch (error) { console.error('Error cargando usuarios:', error); tablaUsuarios.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar usuarios.</td></tr>`; }
}

async function eliminarUsuario(id) {
    if (id === 1) { alert('No se puede eliminar al usuario Administrador principal.'); return; }
    if (confirm('¿Está seguro de eliminar este usuario? Esta acción es irreversible.')) {
        try {
            const response = await fetch(`${API_URL}/usuarios/eliminar/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.message || 'Error al eliminar usuario'); }
            alert('Usuario eliminado exitosamente');
            cargarUsuarios();
            cargarDashboard();
        } catch (error) { console.error('Error al eliminar usuario:', error); alert(`Error: ${error.message}`); }
    }
}

function editarUsuario(id) {
    alert(`Función "Editar" aún no implementada. Se editaría el usuario con ID: ${id}`);
}

// ==========================================================
// GESTIÓN DE PRÉSTAMOS (v2.0)
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
        
        // ¡CAMBIADO! Actualizado a la nueva estructura de la API
        tablaPrestamos.innerHTML = prestamos.map((p, index) => {
            let estadoBadge = 'bg-secondary';
            let estadoTexto = 'Devuelto';
            if (p.ESTADO === 1) { // 1 = Activo
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
                    <td>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</td>
                    <td>${p.MATERIAL_NOMBRE}</td>
                    <td><span class="badge bg-secondary">${p.CODIGO_PATRIMONIAL}</span></td>
                    <td><span class="badge bg-dark">${p.ENCARGADO_USERNAME}</span></td>
                    <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                    <td>
                        ${p.ESTADO === 1 ? `<button class="btn btn-sm btn-success" onclick="adminDevolver(${p.ID_SOLICITUD})">Devolver</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) { console.error('Error cargando préstamos:', error); tablaPrestamos.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error al cargar préstamos.</td></tr>`; }
}

function adminDevolver(id) {
    alert(`¡Función DEVOLVER (Admin) aún no conectada! Se devolvería el préstamo ID: ${id}`);
    // Este endpoint debe ser creado en el backend.
}

// ==========================================================
// GESTIÓN DE INVENTARIO (v3.0 - Cumple requisitos de cliente)
// ==========================================================
async function actualizarInventario() {
    let inventario;
    try {
        const response = await fetch(`${API_URL}/inventario`);
        if (!response.ok) throw new Error('No se pudo cargar el inventario');
        inventario = await response.json();
    } catch (error) {
        console.error('Error cargando inventario:', error);
        document.getElementById('tablaInventarioDetalle').innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar inventario.</td></tr>`;
        return;
    }
    if (inventario.length === 0) {
        document.getElementById('tablaInventarioDetalle').innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay materiales registrados</td></tr>`;
        // Limpiamos las tarjetas si no hay nada
        const tarjetas = ['tablets', 'notebooks', 'libros', 'deportivo'];
        tarjetas.forEach(t => {
            document.getElementById(`${t}Disponibles`).textContent = '0';
            if (document.getElementById(`${t}Disponibles`).nextSibling) {
                document.getElementById(`${t}Disponibles`).nextSibling.textContent = ' / 0';
            }
            document.getElementById(`${t}Prestadas`).textContent = '0';
            document.getElementById(`progress${t.charAt(0).toUpperCase() + t.slice(1)}`).style.width = '0%';
        });
        return;
    }
    
    // 2. ACTUALIZAR LAS TARJETAS
    inventario.forEach(item => {
        let idDisp, idPrest, idProg, idTotalH2;
        // Buscamos los IDs correspondientes del HTML del Admin
        if (item.nombre.includes('Tablet')) { idDisp = 'tabletsDisponibles'; idPrest = 'tabletsPrestadas'; idProg = 'progressTablets'; idTotalH2 = 'tabletsDisponibles'; }
        else if (item.nombre.includes('Notebook')) { idDisp = 'notebooksDisponibles'; idPrest = 'notebooksPrestadas'; idProg = 'progressNotebooks'; idTotalH2 = 'notebooksDisponibles'; }
        else if (item.nombre.includes('Libro')) { idDisp = 'librosDisponibles'; idPrest = 'librosPrestados'; idProg = 'progressLibros'; idTotalH2 = 'librosDisponibles'; }
        else if (item.nombre.includes('Deportivo')) { idDisp = 'deportivoDisponible'; idPrest = 'deportivoPrestado'; idProg = 'progressDeportivo'; idTotalH2 = 'deportivoDisponible'; }

        if (idDisp) {
            const prestados = item.total - item.disponibles;
            const progreso = (item.total > 0) ? (item.disponibles / item.total) * 100 : 0;
            
            const h2Element = document.getElementById(idTotalH2);
            if (h2Element) {
                h2Element.textContent = item.disponibles; 
                if (h2Element.nextSibling && h2Element.nextSibling.nodeType === Node.TEXT_NODE) {
                    h2Element.nextSibling.textContent = ` / ${item.total}`; 
                }
            }
            
            if (document.getElementById(idPrest)) {
                document.getElementById(idPrest).textContent = prestados;
            }
            if (document.getElementById(idProg)) {
                document.getElementById(idProg).style.width = progreso + '%';
            }
        }
    });

    // 3. ACTUALIZAR LA TABLA
    const tablaInventario = document.getElementById('tablaInventarioDetalle');
    tablaInventario.innerHTML = inventario.map(m => {
        const enPrestamo = m.total - m.disponibles;
        const utilizacion = (m.total > 0) ? ((enPrestamo / m.total) * 100).toFixed(1) : 0;
        const estadoClass = utilizacion > 70 ? 'text-danger' : utilizacion > 40 ? 'text-warning' : 'text-success';
        
        // ¡CAMBIADO! Usamos m.NOMBRE que es el texto plano (ej: "iPad Air")
        return `
            <tr>
                <td><strong>${m.NOMBRE}</strong></td>
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
}

// ==========================================================
// LÓGICA PARA GESTIÓN DE TIPOS DE MATERIAL (Punto 3 Cliente)
// ==========================================================
const btnMostrarFormularioMaterial = document.getElementById('btnMostrarFormularioMaterial');
const formularioMaterial = document.getElementById('formularioMaterial');
const btnCancelarFormularioMaterial = document.getElementById('btnCancelarFormularioMaterial');
const formAgregarMaterial = document.getElementById('formAgregarMaterial');
const categoriaSelectMaterial = document.getElementById('categoriaSelectMaterial');

if (btnMostrarFormularioMaterial && formularioMaterial && btnCancelarFormularioMaterial && formAgregarMaterial && categoriaSelectMaterial) {
    
    btnMostrarFormularioMaterial.addEventListener('click', () => {
        formularioMaterial.style.display = 'block';
        btnMostrarFormularioMaterial.style.display = 'none';
        cargarCategoriasParaAdmin();
    });

    btnCancelarFormularioMaterial.addEventListener('click', () => {
        formularioMaterial.style.display = 'none';
        btnMostrarFormularioMaterial.style.display = 'block';
        formAgregarMaterial.reset();
    });

    formAgregarMaterial.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nuevoMaterial = {
            id_tipo_material: categoriaSelectMaterial.value,
            nombre: document.getElementById('materialNombre').value,
            descripcion: document.getElementById('materialDescripcion').value,
            max_dias_prestamo: parseInt(document.getElementById('materialMaxDias').value)
        };

        try {
            const response = await fetch(`${API_URL}/materiales/crear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoMaterial)
            });

            const data = await response.json();
            if (!response.ok) { throw new Error(data.message || 'Error al crear el material'); }

            alert('✅ ¡Nuevo tipo de producto creado exitosamente!');
            formAgregarMaterial.reset();
            
            // Recargamos el <select> del *otro* formulario
            cargarMaterialesParaAdmin();

        } catch (error) {
            console.error('Error al crear material:', error);
            alert(`Error: ${error.message}`);
        }
    });
}

// --- Cargar el <select> de Categorías (TIPO_MATERIALES) ---
async function cargarCategoriasParaAdmin() {
    try {
        const response = await fetch(`${API_URL}/tipos-materiales`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const categorias = await response.json();
        
        categoriaSelectMaterial.innerHTML = '<option value="">-- Seleccione una categoría --</option>';
        categorias.forEach(cat => {
            categoriaSelectMaterial.innerHTML += `
                <option value="${cat.ID_TIPO_MATERIAL}">
                    ${cat.NOMBRE_TIPO_MATERIAL} (Prefijo: ${cat.PREFIJO})
                </option>
            `;
        });
    } catch (error) {
        console.error('Error cargando categorías:', error);
        categoriaSelectMaterial.innerHTML = '<option value="">Error al cargar</option>';
    }
}


// ==========================================================
// LÓGICA PARA GESTIÓN DE ÍTEMS (Punto 1.C)
// ==========================================================
const btnMostrarFormularioItem = document.getElementById('btnMostrarFormularioItem');
const formularioItem = document.getElementById('formularioItem');
const btnCancelarFormularioItem = document.getElementById('btnCancelarFormularioItem');
const formAgregarItem = document.getElementById('formAgregarItem');
const materialSelectItem = document.getElementById('materialSelectItem');

if (btnMostrarFormularioItem && formularioItem && btnCancelarFormularioItem && formAgregarItem && materialSelectItem) {
    
    btnMostrarFormularioItem.addEventListener('click', () => {
        formularioItem.style.display = 'block';
        btnMostrarFormularioItem.style.display = 'none';
        cargarMaterialesParaAdmin();
        cargarUbicacionesParaAdmin(); // Cargar el nuevo <select>
    });

    btnCancelarFormularioItem.addEventListener('click', () => {
        formularioItem.style.display = 'none';
        btnMostrarFormularioItem.style.display = 'block';
        formAgregarItem.reset();
    });

    // --- Enviar el formulario de nuevo ítem (v3.0 - Genera Códigos) ---
    formAgregarItem.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nuevoItem = {
            id_material: materialSelectItem.value,
            cantidad: parseInt(document.getElementById('itemCantidad').value),
            id_ubicacion: document.getElementById('itemUbicacionSelect').value,
            estado: 'Disponible'
        };
        
        if (!nuevoItem.id_material || !nuevoItem.id_ubicacion) {
            alert('Debe seleccionar un producto y una ubicación.');
            return;
        }
        if (!nuevoItem.cantidad || nuevoItem.cantidad < 1) {
            alert('Debe ingresar una cantidad válida.');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/items/crear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoItem)
            });

            const data = await response.json();
            if (!response.ok) { throw new Error(data.message || 'Error al crear el ítem'); }

            alert(`✅ ¡${nuevoItem.cantidad} ítems agregados exitosamente!`);
            formAgregarItem.reset();
            
            // Recargar la vista de inventario para ver el cambio
            actualizarInventario();

        } catch (error) {
            console.error('Error al crear ítem:', error);
            alert(`Error: ${error.message}`);
        }
    });
}

// --- Cargar el <select> de Productos (MATERIALES) ---
async function cargarMaterialesParaAdmin() {
    try {
        const response = await fetch(`${API_URL}/materiales`); 
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const materiales = await response.json();
        
        materialSelectItem.innerHTML = '<option value="">-- Seleccione un producto --</option>';
        materiales.forEach(mat => {
            materialSelectItem.innerHTML += `<option value="${mat.ID_MATERIAL}">${mat.NOMBRE_TIPO_MATERIAL} - ${mat.NOMBRE}</option>`;
        });
    } catch (error) {
        console.error('Error cargando materiales:', error);
        materialSelectItem.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// --- Cargar el <select> de Ubicaciones ---
async function cargarUbicacionesParaAdmin() {
    const select = document.getElementById('itemUbicacionSelect');
    try {
        const response = await fetch(`${API_URL}/ubicaciones`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const ubicaciones = await response.json();
        
        select.innerHTML = '<option value="">-- Seleccione una ubicación --</option>';
        ubicaciones.forEach(u => {
            select.innerHTML += `<option value="${u.ID_UBICACION}">${u.NOMBRE_UBICACION}</option>`;
        });
    } catch (error) {
        console.error('Error cargando ubicaciones:', error);
        select.innerHTML = '<option value="">Error al cargar</option>';
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