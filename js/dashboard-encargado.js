// dashboard-encargado.js - VERSIÓN FINAL (CON CORRECCIÓN DE ACENTOS)

// ==========================================================
// DEFINICIONES
// ==========================================================
const API_URL = 'http://localhost:3000/api';
let usuarioLogueado = {};
let prestamoADevolver = {};
const modalDevolverBootstrap = new bootstrap.Modal(document.getElementById('modalDevolver'));

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
    if (!usuarioLogueado.username) { window.location.href = '../index.html'; return; }
    
    document.getElementById('nombreUsuario').textContent = usuarioLogueado.nombre;
    document.getElementById('rolUsuario').textContent = usuarioLogueado.rol;
    
    actualizarFecha();
    configurarFechasPorDefecto();
    
    // Cargas iniciales
    cargarDashboardStats();
    cargarTablaPendientes();
    actualizarInventarioDisplay();
    cargarAlumnosSelect();
    cargarAsignaturasSelect();
    cargarMaterialesSelect();

    document.getElementById('btnConfirmarDevolucion').addEventListener('click', confirmarDevolucion);
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
        const titles = { 'dashboard': 'Dashboard', 'nuevo-prestamo': 'Nuevo Préstamo', 'prestamos-activos': 'Préstamos Activos', 'historial': 'Historial de Préstamos', 'inventario': 'Inventario Disponible' };
        pageTitle.textContent = titles[sectionId];
        if (sectionId === 'prestamos-activos') { cargarPrestamosActivosCompletos(); }
        else if (sectionId === 'inventario') { actualizarInventarioCompleto(); }
        else if (sectionId === 'historial') { cargarHistorial(); }
    });
});
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');
toggleSidebar.addEventListener('click', () => { sidebar.classList.toggle('collapsed'); mainContent.classList.toggle('expanded'); });
document.getElementById('cerrarSesion').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('¿Está seguro que desea cerrar sesión?')) { sessionStorage.clear(); window.location.href = '../index.html'; }
});
function actualizarFecha() {
    const fecha = new Date();
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fechaActual').textContent = fecha.toLocaleDateString('es-CL', opciones);
}
function configurarFechasPorDefecto() {
    const ahora = new Date();
    const fechaPrestamoInput = document.getElementById('fechaPrestamo');
    const fechaDevolucionInput = document.getElementById('fechaDevolucion');
    const fechaActualString = obtenerFechaLocalISO(ahora);
    fechaPrestamoInput.value = fechaActualString;
    fechaPrestamoInput.min = fechaActualString;
    fechaPrestamoInput.max = fechaActualString;
    const fechaDevolucion = new Date(ahora);
    fechaDevolucion.setDate(fechaDevolucion.getDate() + 7);
    const fechaDevolucionString = obtenerFechaLocalISO(fechaDevolucion);
    fechaDevolucionInput.value = fechaDevolucionString;
    fechaDevolucionInput.min = fechaActualString;
    fechaDevolucionInput.removeAttribute('max');
    actualizarLimiteDevolucion(null);
}

function obtenerFechaLocalISO(fecha) {
    const copia = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
    return copia.toISOString().slice(0, 16);
}

function actualizarLimiteDevolucion(maxDias) {
    const mensaje = document.getElementById('mensajeLimiteFecha');
    const fechaPrestamoValor = document.getElementById('fechaPrestamo').value;
    const fechaDevolucionInput = document.getElementById('fechaDevolucion');
    if (!fechaPrestamoValor) { return; }
    if (!maxDias || parseInt(maxDias, 10) <= 0) {
        mensaje.textContent = 'Seleccione un material para conocer el límite máximo.';
        fechaDevolucionInput.removeAttribute('max');
        return;
    }
    const inicio = new Date(fechaPrestamoValor);
    const limite = new Date(inicio);
    limite.setDate(limite.getDate() + parseInt(maxDias, 10));
    const limiteISO = obtenerFechaLocalISO(limite);
    fechaDevolucionInput.max = limiteISO;
    if (fechaDevolucionInput.value && fechaDevolucionInput.value > limiteISO) {
        fechaDevolucionInput.value = limiteISO;
    }
    mensaje.textContent = `Debe devolver antes del ${formatearFecha(limite.toISOString())} (máx. ${maxDias} días).`;
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
        alumnos.forEach(alumno => { select.innerHTML += `<option value="${alumno.ID_ALUMNO}">${alumno.NOMBRE} ${alumno.APELLIDO} (${alumno.RUT} - ${alumno.CURSO})</option>`; });
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
            select.innerHTML += `<option value="${mat.ID_MATERIAL}" data-disponibles="${mat.CANTIDAD_DISPONIBLE}" data-max-dias="${mat.MAX_DIAS_PRESTAMO}">${mat.NOMBRE_TIPO_MATERIAL} - ${mat.NOMBRE} (${mat.CODIGO}) (Disp: ${mat.CANTIDAD_DISPONIBLE})</option>`;
        });
    } catch (error) { console.error('Error cargando materiales:', error); select.innerHTML = '<option value="">Error al cargar materiales</option>'; }
}
document.getElementById('materialSelect').addEventListener('change', (e) => { /* (Sin cambios) */
    const opcionSeleccionada = e.target.selectedOptions[0];
    const disponibles = opcionSeleccionada.getAttribute('data-disponibles') || '-';
    document.getElementById('disponiblesInfo').textContent = disponibles;
    document.getElementById('cantidadPrestamo').max = disponibles;
    const maxDias = opcionSeleccionada.getAttribute('data-max-dias');
    actualizarLimiteDevolucion(maxDias);
});

// ==========================================================
// CARGAR TABLAS Y ESTADÍSTICAS
// ==========================================================
async function cargarDashboardStats() { /* (Sin cambios) */
    try {
        const response = await fetch(`${API_URL}/dashboard/encargado-stats/${usuarioLogueado.id}`);
        if (!response.ok) throw new Error('No se pudieron cargar las estadísticas');
        const stats = await response.json();
        document.getElementById('misPrestamosActivos').textContent = stats.activos;
        document.getElementById('prestamosCompletados').textContent = stats.completados;
        document.getElementById('prestamosProximosVencer').textContent = stats.vencer;
    } catch (error) { console.error('Error cargando stats del dashboard:', error); }
}

// --- ¡NUEVA VERSIÓN DE ESTA FUNCIÓN! ---
async function cargarTablaPendientes() {
    const tablaPendientes = document.getElementById('tablaPendientes');
    try {
        const response = await fetch(`${API_URL}/prestamos/activos/${usuarioLogueado.id}`);
        const prestamos = await response.json();
        
        // Limpiamos la tabla
        tablaPendientes.innerHTML = ''; 
        
        if (prestamos.length === 0) {
            tablaPendientes.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay préstamos pendientes</td></tr>`;
            return;
        }
        
        prestamos.slice(0, 5).forEach(p => {
            const estadoInfo = getEstadoPrestamo(p.FECHA_DEVOLUCION);
            
            // 1. Creamos la fila y las celdas de datos
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</td>
                <td>${p.MATERIAL_NOMBRE} (${p.CANTIDAD})</td>
                <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                <td><span class="badge ${estadoInfo.badge}">${estadoInfo.texto}</span></td>
            `;

            // 2. Creamos la celda del botón y el botón
            const tdBoton = document.createElement('td');
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn btn-sm btn-success';
            btnDevolver.innerHTML = '<i class="fas fa-check"></i> Devolver';

            // 3. Preparamos el objeto de datos
            const datosPrestamo = {
                id_solicitud: p.ID_SOLICITUD,
                id_detalle: p.ID_DETALLE,
                id_material: p.ID_MATERIAL,
                cantidad: p.CANTIDAD,
                alumno: `${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}`, // ¡Aquí el nombre con 'López' está seguro!
                material: p.MATERIAL_NOMBRE
            };

            // 4. ¡LA MAGIA! Añadimos el listener (Forma segura)
            btnDevolver.addEventListener('click', () => {
                abrirModalDevolver(datosPrestamo);
            });

            // 5. Armamos la fila y la añadimos a la tabla
            tdBoton.appendChild(btnDevolver);
            tr.appendChild(tdBoton);
            tablaPendientes.appendChild(tr);
        });
    } catch (error) { console.error("Error cargando pendientes:", error); }
}

// --- ¡NUEVA VERSIÓN DE ESTA FUNCIÓN! ---
async function cargarPrestamosActivosCompletos() {
    const tablaActivos = document.getElementById('tablaActivosCompleta');
    try {
        const response = await fetch(`${API_URL}/prestamos/activos/${usuarioLogueado.id}`);
        const prestamos = await response.json();
        
        document.getElementById('totalActivos').textContent = `${prestamos.length} activos`;
        
        // Limpiamos la tabla
        tablaActivos.innerHTML = '';

        if (prestamos.length === 0) {
            tablaActivos.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay préstamos activos</td></tr>`;
            return;
        }

        prestamos.forEach((p, index) => {
            const estadoInfo = getEstadoPrestamo(p.FECHA_DEVOLUCION);
            
            // 1. Creamos la fila y las celdas de datos
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${p.ID_SOLICITUD}</td>
                <td><strong>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</strong><br><small class="text-muted">${p.CURSO}</small></td>
                <td>${p.MATERIAL_NOMBRE}</td>
                <td><span class="badge bg-info">${p.CANTIDAD}</span></td>
                <td>${formatearFecha(p.FECHA_SOLICITUD)}</td>
                <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                <td><span class="badge ${estadoInfo.badge}">${estadoInfo.texto}</span></td>
            `;

            // 2. Creamos la celda del botón y los botones
            const tdBoton = document.createElement('td');
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn btn-sm btn-success';
            btnDevolver.innerHTML = '<i class="fas fa-check"></i> Devolver';
            
            const btnDetalle = document.createElement('button');
            btnDetalle.className = 'btn btn-sm btn-info ms-1'; // ms-1 = margin-left
            btnDetalle.innerHTML = '<i class="fas fa-eye"></i>';

            // 3. Preparamos el objeto de datos
            const datosPrestamo = {
                id_solicitud: p.ID_SOLICITUD,
                id_detalle: p.ID_DETALLE,
                id_material: p.ID_MATERIAL,
                cantidad: p.CANTIDAD,
                alumno: `${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}`, // Seguro
                material: p.MATERIAL_NOMBRE
            };

            // 4. ¡LA MAGIA! Añadimos los listeners
            btnDevolver.addEventListener('click', () => {
                abrirModalDevolver(datosPrestamo);
            });
            btnDetalle.addEventListener('click', () => {
                verDetallePrestamo(p.ID_SOLICITUD);
            });

            // 5. Armamos la fila y la añadimos a la tabla
            tdBoton.appendChild(btnDevolver);
            tdBoton.appendChild(btnDetalle);
            tr.appendChild(tdBoton);
            tablaActivos.appendChild(tr);
        });
    } catch (error) { console.error("Error cargando préstamos activos:", error); }
}

async function actualizarInventarioDisplay() { /* (Sin cambios) */
    try {
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
async function actualizarInventarioCompleto() { /* (Sin cambios) */
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
// FORMULARIO NUEVO PRÉSTAMO (Sin cambios)
// ==========================================================
const formNuevoPrestamo = document.getElementById('formNuevoPrestamo');
formNuevoPrestamo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prestamo = {
        id_alumno: document.getElementById('alumnoSelect').value,
        id_material: document.getElementById('materialSelect').value,
        id_asignatura: document.getElementById('asignaturaSelect').value,
        cantidad: parseInt(document.getElementById('cantidadPrestamo').value),
        fecha_prestamo: document.getElementById('fechaPrestamo').value,
        fecha_devolucion: document.getElementById('fechaDevolucion').value,
        responsable: document.getElementById('responsableSelect').value,
        observaciones: document.getElementById('observaciones').value,
        id_usuario: usuarioLogueado.id
    };
    const maxDisponible = document.getElementById('materialSelect').selectedOptions[0].getAttribute('data-disponibles');
    if (!maxDisponible || prestamo.cantidad > parseInt(maxDisponible)) { alert(`Error: No puedes prestar ${prestamo.cantidad}. Solo hay ${maxDisponible || 0} disponibles.`); return; }
    if (!prestamo.id_alumno || !prestamo.id_material) { alert("Por favor, seleccione un alumno y un material."); return; }
    if (!prestamo.id_asignatura) { alert('Por favor, seleccione una asignatura.'); return; }
    if (!prestamo.fecha_devolucion) { alert('Debe indicar la fecha estimada de devolución.'); return; }
    const fechaPrestamo = new Date(prestamo.fecha_prestamo);
    const fechaDevolucion = new Date(prestamo.fecha_devolucion);
    if (fechaDevolucion < fechaPrestamo) { alert('La fecha de devolución no puede ser anterior a la fecha de préstamo.'); return; }
    const maxDiasPermitidos = parseInt(document.getElementById('materialSelect').selectedOptions[0].getAttribute('data-max-dias') || '0', 10);
    if (maxDiasPermitidos) {
        const diasSolicitados = Math.ceil((fechaDevolucion - fechaPrestamo) / (1000 * 60 * 60 * 24));
        if (diasSolicitados > maxDiasPermitidos) {
            alert(`La devolución supera el máximo permitido de ${maxDiasPermitidos} días para este material.`);
            return;
        }
    }
    try {
        const response = await fetch(`${API_URL}/prestamos/crear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prestamo) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al registrar el préstamo');
        alert('✅ ¡Préstamo registrado exitosamente!');
        formNuevoPrestamo.reset();
        configurarFechasPorDefecto();
        // Recargar todo
        cargarMaterialesSelect();
        cargarTablaPendientes();
        actualizarInventarioDisplay();
        cargarPrestamosActivosCompletos();
        actualizarInventarioCompleto();
        cargarDashboardStats();
    } catch (error) { console.error('Error al crear préstamo:', error); alert(`Error: ${error.message}`); }
});

// ==========================================================
// LÓGICA DE DEVOLUCIÓN (Sin cambios)
// ==========================================================
function abrirModalDevolver(prestamo) {
    prestamoADevolver = prestamo;
    const infoPrestamo = document.getElementById('infoPrestamo');
    infoPrestamo.innerHTML = `<div class="alert alert-info"><strong>Alumno:</strong> ${prestamo.alumno}<br><strong>Material:</strong> ${prestamo.material} (${prestamo.cantidad})</div>`;
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    document.getElementById('fechaDevolucionReal').value = ahora.toISOString().slice(0, 16);
    document.getElementById('estadoMaterial').value = 'Bueno';
    document.getElementById('observacionesDevolucion').value = '';
    modalDevolverBootstrap.show();
}

async function confirmarDevolucion() {
    const devolucion = { estado_material: document.getElementById('estadoMaterial').value, observaciones: document.getElementById('observacionesDevolucion').value, fecha_recepcion: document.getElementById('fechaDevolucionReal').value };
    const datosCompletos = { ...prestamoADevolver, id_usuario_encargado: usuarioLogueado.id, cantidad_recibida: prestamoADevolver.cantidad, ...devolucion };
    if (!devolucion.fecha_recepcion) { alert('Por favor ingrese la fecha de devolución'); return; }
    try {
        const response = await fetch(`${API_URL}/prestamos/devolver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosCompletos) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al registrar la devolución');
        alert('✅ Devolución registrada exitosamente');
        modalDevolverBootstrap.hide();
        // Recargar TODA la información
        cargarDashboardStats();
        cargarTablaPendientes();
        actualizarInventarioDisplay();
        cargarPrestamosActivosCompletos();
        actualizarInventarioCompleto();
        cargarMaterialesSelect();
    } catch (error) { console.error('Error al confirmar devolución:', error); alert(`Error: ${error.message}`); }
}

function verDetallePrestamo(id) {
    alert(`¡Función DETALLE aún no conectada! Se vería el préstamo ID: ${id}`);
}

// ¡NUEVA FUNCIÓN PARA EL HISTORIAL!
async function cargarHistorial() {
    const tablaHistorial = document.getElementById('tablaHistorial');
    try {
        const response = await fetch(`${API_URL}/prestamos/historial/${usuarioLogueado.id}`);
        if (!response.ok) throw new Error('No se pudo cargar el historial');

        const prestamos = await response.json();

        if (prestamos.length === 0) {
            tablaHistorial.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay historial de préstamos</td></tr>`;
            return;
        }

        tablaHistorial.innerHTML = prestamos.map((p, index) => {
            // Lógica para determinar el estado (Activo, Vencido, Devuelto)
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
                    <td>#${p.ID_SOLICITUD}</td>
                    <td>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</td>
                    <td>${p.MATERIAL_NOMBRE}</td>
                    <td><span class="badge bg-info">${p.CANTIDAD}</span></td>
                    <td>${formatearFecha(p.FECHA_SOLICITUD)}</td>
                    <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                    <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="verDetallePrestamo(${p.ID_SOLICITUD})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando historial:', error);
        tablaHistorial.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error al cargar el historial.</td></tr>`;
    }
}

async function cargarAsignaturasSelect() {
    const select = document.getElementById('asignaturaSelect');
    try {
        const response = await fetch(`${API_URL}/asignaturas`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const asignaturas = await response.json();
        select.innerHTML = '<option value="">-- Seleccione asignatura --</option>';
        asignaturas.forEach(asignatura => {
            select.innerHTML += `<option value="${asignatura.ID_ASIGNATURA}">${asignatura.NOMBRE}</option>`;
        });
    } catch (error) {
        console.error('Error cargando asignaturas:', error);
        select.innerHTML = '<option value="">Error al cargar asignaturas</option>';
    }
}

// ==========================================================
// UTILIDADES (Sin cambios)
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