// dashboard-encargado.js - VERSIÓN CONECTADA (CASI COMPLETA)

// ==========================================================
// DEFINICIONES
// ==========================================================
const API_URL = 'http://localhost:3000/api';
let usuarioLogueado = {};

// ==========================================================
// AL CARGAR LA PÁGINA (load)
// ==========================================================
window.addEventListener('load', () => {
    usuarioLogueado = {
        username: sessionStorage.getItem('usuarioActual'),
        nombre: sessionStorage.getItem('nombreUsuario'),
        rol: sessionStorage.getItem('rolUsuario'),
        id: sessionStorage.getItem('usuarioId')
    };
    
    if (!usuarioLogueado.username) {
        window.location.href = '../index.html';
        return;
    }
    
    document.getElementById('nombreUsuario').textContent = usuarioLogueado.nombre;
    document.getElementById('rolUsuario').textContent = usuarioLogueado.rol;
    
    actualizarFecha();
    configurarFechasPorDefecto();
    
    // ¡AHORA SÍ CARGAMOS TODO DESDE EL INICIO!
    cargarTablaPendientes(); // <-- ¡NUEVO!
    actualizarInventarioDisplay(); // <-- ¡NUEVO!
    
    cargarAlumnosSelect();
    cargarMaterialesSelect();
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
            'nuevo-prestamo': 'Nuevo Préstamo',
            'prestamos-activos': 'Préstamos Activos',
            'historial': 'Historial de Préstamos',
            'inventario': 'Inventario Disponible'
        };
        pageTitle.textContent = titles[sectionId];
        
        // ¡ACTUALIZAMOS AL HACER CLIC EN LA PESTAÑA!
        if (sectionId === 'prestamos-activos') {
            cargarPrestamosActivosCompletos(); // <-- ¡NUEVO!
        } else if (sectionId === 'inventario') {
            actualizarInventarioCompleto(); // <-- ¡NUEVO!
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

function configurarFechasPorDefecto() {
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    const fechaActualString = ahora.toISOString().slice(0, 16);
    document.getElementById('fechaPrestamo').value = fechaActualString;
    
    const fechaDevolucion = new Date(ahora);
    fechaDevolucion.setDate(fechaDevolucion.getDate() + 7);
    document.getElementById('fechaDevolucion').value = fechaDevolucion.toISOString().slice(0, 16);
}

// ==========================================================
// CARGA DE DATOS (Selects)
// ==========================================================
async function cargarAlumnosSelect() { /* (Sin cambios) */
    const select = document.getElementById('alumnoSelect');
    try {
        const response = await fetch(`${API_URL}/alumnos`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const alumnos = await response.json();
        
        select.innerHTML = '<option value="">-- Seleccione un alumno --</option>';
        alumnos.forEach(alumno => {
            select.innerHTML += `<option value="${alumno.ID_ALUMNO}">${alumno.NOMBRE} ${alumno.APELLIDO} (${alumno.RUT} - ${alumno.CURSO})</option>`;
        });
    } catch (error) { console.error('Error cargando alumnos:', error); select.innerHTML = '<option value="">Error al cargar alumnos</option>'; }
}

async function cargarMaterialesSelect() { /* (Sin cambios) */
    const select = document.getElementById('materialSelect');
    try {
        const response = await fetch(`${API_URL}/materiales`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const materiales = await response.json();
        
        select.innerHTML = '<option value="">-- Seleccione material --</option>';
        materiales.forEach(mat => {
            select.innerHTML += `<option value="${mat.ID_MATERIAL}" data-disponibles="${mat.CANTIDAD_DISPONIBLE}">${mat.NOMBRE_TIPO_MATERIAL} - ${mat.NOMBRE} (Disp: ${mat.CANTIDAD_DISPONIBLE})</option>`;
        });
    } catch (error) { console.error('Error cargando materiales:', error); select.innerHTML = '<option value="">Error al cargar materiales</option>'; }
}

document.getElementById('materialSelect').addEventListener('change', (e) => { /* (Sin cambios) */
    const opcionSeleccionada = e.target.selectedOptions[0];
    const disponibles = opcionSeleccionada.getAttribute('data-disponibles') || '-';
    document.getElementById('disponiblesInfo').textContent = disponibles;
    document.getElementById('cantidadPrestamo').max = disponibles;
});

// ==========================================================
// ¡NUEVO! CARGAR TABLAS Y ESTADÍSTICAS
// ==========================================================

// --- Carga la tabla de "Pendientes" (en la pestaña "Inicio") ---
async function cargarTablaPendientes() {
    const tablaPendientes = document.getElementById('tablaPendientes');
    try {
        const response = await fetch(`${API_URL}/prestamos/activos/${usuarioLogueado.id}`);
        const prestamos = await response.json();
        
        if (prestamos.length === 0) {
            tablaPendientes.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay préstamos pendientes</td></tr>`;
            return;
        }
        
        // Tomamos solo los 5 más próximos a vencer
        tablaPendientes.innerHTML = prestamos.slice(0, 5).map(p => {
            const estadoInfo = getEstadoPrestamo(p.FECHA_DEVOLUCION);
            return `
                <tr>
                    <td>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</td>
                    <td>${p.MATERIAL_NOMBRE} (${p.CANTIDAD})</td>
                    <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                    <td><span class="badge ${estadoInfo.badge}">${estadoInfo.texto}</span></td>
                    <td><button class="btn btn-sm btn-success" onclick="abrirModalDevolver(${p.ID_SOLICITUD})"><i class="fas fa-check"></i> Devolver</button></td>
                </tr>
            `;
        }).join('');
    } catch (error) { console.error("Error cargando pendientes:", error); }
}

// --- Carga la tabla "Préstamos Activos" (en su pestaña) ---
async function cargarPrestamosActivosCompletos() {
    const tablaActivos = document.getElementById('tablaActivosCompleta');
    try {
        const response = await fetch(`${API_URL}/prestamos/activos/${usuarioLogueado.id}`);
        const prestamos = await response.json();
        
        document.getElementById('totalActivos').textContent = `${prestamos.length} activos`;
        
        if (prestamos.length === 0) {
            tablaActivos.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay préstamos activos</td></tr>`;
            return;
        }

        tablaActivos.innerHTML = prestamos.map((p, index) => {
            const estadoInfo = getEstadoPrestamo(p.FECHA_DEVOLUCION);
            return `
                <tr>
                    <td>#${p.ID_SOLICITUD}</td>
                    <td><strong>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</strong><br><small class="text-muted">${p.CURSO}</small></td>
                    <td>${p.MATERIAL_NOMBRE}</td>
                    <td><span class="badge bg-info">${p.CANTIDAD}</span></td>
                    <td>${formatearFecha(p.FECHA_SOLICITUD)}</td>
                    <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                    <td><span class="badge ${estadoInfo.badge}">${estadoInfo.texto}</span></td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="abrirModalDevolver(${p.ID_SOLICITUD})"><i class="fas fa-check"></i> Devolver</button>
                        <button class="btn btn-sm btn-info" onclick="verDetallePrestamo(${p.ID_SOLICITUD})"><i class="fas fa-eye"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) { console.error("Error cargando préstamos activos:", error); }
}

// --- Carga el Inventario (en la pestaña "Inicio") ---
async function actualizarInventarioDisplay() {
    try {
        // Usamos el endpoint de inventario del Admin, ¡es reutilizable!
        const response = await fetch(`${API_URL}/inventario`); 
        const inventario = await response.json();
        
        inventario.forEach(item => {
            let idDisp, idProg;
            if (item.nombre.includes('Tablet')) { idDisp = 'tabletsDisp'; idProg = 'progTablets'; }
            else if (item.nombre.includes('Notebook')) { idDisp = 'notebooksDisp'; idProg = 'progNotebooks'; }
            else if (item.nombre.includes('Libro')) { idDisp = 'librosDisp'; idProg = 'progLibros'; }
            else if (item.nombre.includes('Deportivo')) { idDisp = 'deportivoDisp'; idProg = 'progDeportivo'; }
            
            if (idDisp) {
                document.getElementById(idDisp).textContent = item.disponibles;
                const progreso = (item.disponibles / item.total) * 100;
                document.getElementById(idProg).style.width = progreso + '%';
            }
        });
    } catch (error) { console.error("Error cargando display inventario:", error); }
}

// --- Carga el Inventario (en la pestaña "Inventario") ---
async function actualizarInventarioCompleto() {
    try {
        const response = await fetch(`${API_URL}/inventario`); 
        const inventario = await response.json();
        
        inventario.forEach(item => {
            let idDisp, idPrest, idProg;
            if (item.nombre.includes('Tablet')) { idDisp = 'tabletsInvDisp'; idPrest = 'tabletsInvPrest'; idProg = 'progressInvTablets'; }
            else if (item.nombre.includes('Notebook')) { idDisp = 'notebooksInvDisp'; idPrest = 'notebooksInvPrest'; idProg = 'progressInvNotebooks'; }
            else if (item.nombre.includes('Libro')) { idDisp = 'librosInvDisp'; idPrest = 'librosInvPrest'; idProg = 'progressInvLibros'; }
            else if (item.nombre.includes('Deportivo')) { idDisp = 'deportivoInvDisp'; idPrest = 'deportivoInvPrest'; idProg = 'progressInvDeportivo'; }

            if (idDisp) {
                const prestados = item.total - item.disponibles;
                document.getElementById(idDisp).textContent = item.disponibles;
                document.getElementById(idPrest).textContent = prestados;
                const progreso = (item.disponibles / item.total) * 100;
                document.getElementById(idProg).style.width = progreso + '%';
            }
        });
    } catch (error) { console.error("Error cargando inventario completo:", error); }
}


// ==========================================================
// FORMULARIO NUEVO PRÉSTAMO (¡ACTUALIZADO!)
// ==========================================================
const formNuevoPrestamo = document.getElementById('formNuevoPrestamo');

formNuevoPrestamo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prestamo = { /* (código de recolectar datos sin cambios) */
        id_alumno: document.getElementById('alumnoSelect').value,
        id_material: document.getElementById('materialSelect').value,
        cantidad: parseInt(document.getElementById('cantidadPrestamo').value),
        fecha_prestamo: document.getElementById('fechaPrestamo').value,
        fecha_devolucion: document.getElementById('fechaDevolucion').value,
        responsable: document.getElementById('responsableSelect').value,
        observaciones: document.getElementById('observaciones').value,
        id_usuario: usuarioLogueado.id
    };

    // (código de validación sin cambios)
    const maxDisponible = document.getElementById('materialSelect').selectedOptions[0].getAttribute('data-disponibles');
    if (!maxDisponible || prestamo.cantidad > parseInt(maxDisponible)) { alert(`Error: No puedes prestar ${prestamo.cantidad}. Solo hay ${maxDisponible || 0} disponibles.`); return; }
    if (!prestamo.id_alumno || !prestamo.id_material) { alert("Por favor, seleccione un alumno y un material."); return; }

    try {
        const response = await fetch(`${API_URL}/prestamos/crear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prestamo)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al registrar el préstamo');

        alert('✅ ¡Préstamo registrado exitosamente!');
        formNuevoPrestamo.reset();
        configurarFechasPorDefecto();
        
        // ¡¡AQUÍ ESTÁ EL ARREGLO!!
        // AHORA SÍ RECARGAMOS TODO DESPUÉS DE CREAR
        cargarMaterialesSelect();      // Recarga el <select>
        cargarTablaPendientes();       // Recarga la tabla de "Inicio"
        actualizarInventarioDisplay(); // Recarga las barras de "Inicio"
        
        // (Si estás en la pestaña de "Préstamos Activos", también deberías recargarla)
        cargarPrestamosActivosCompletos();
        
        // (Y la de "Inventario")
        actualizarInventarioCompleto();

    } catch (error) {
        console.error('Error al crear préstamo:', error);
        alert(`Error: ${error.message}`);
    }
});


// ==========================================================
// LÓGICA DE DEVOLUCIÓN (Pendiente)
// ==========================================================

function abrirModalDevolver(id) {
    alert(`¡Función DEVOLVER aún no conectada! Se devolvería el préstamo ID: ${id}`);
    // Aquí es donde conectaríamos el Modal y el endpoint /api/prestamos/devolver
}

function verDetallePrestamo(id) {
    alert(`¡Función DETALLE aún no conectada! Se vería el préstamo ID: ${id}`);
}


// ==========================================================
// UTILIDADES (NUEVAS)
// ==========================================================
function getEstadoPrestamo(fechaDevolucionISO) {
    const fechaDevolucion = new Date(fechaDevolucionISO);
    const ahora = new Date();
    const diasRestantes = Math.ceil((fechaDevolucion - ahora) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) return { badge: 'bg-danger', texto: `${Math.abs(diasRestantes)} días atrasado` };
    if (diasRestantes === 0) return { badge: 'bg-warning', texto: 'Vence hoy' };
    if (diasRestantes === 1) return { badge: 'bg-warning', texto: 'Vence mañana' };
    return { badge: 'bg-success', texto: `${diasRestantes} días` };
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'N/A';
    const date = new Date(fechaISO);
    return date.toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}