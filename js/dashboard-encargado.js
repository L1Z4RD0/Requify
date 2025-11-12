// dashboard-encargado.js - VERSIÓN FINAL (v3.0)
// Sincronizado con la Base de Datos v3.0 y el server.js v3.0
// Cumple Puntos 1, 2 y 3 del cliente.

// ==========================================================
// DEFINICIONES
// ==========================================================
const API_URL = 'http://localhost:3000/api';
let usuarioLogueado = {};
let prestamoADevolver = {}; // Variable global para el modal
const modalDevolverBootstrap = new bootstrap.Modal(document.getElementById('modalDevolver'));

// ==========================================================
// AL CARGAR LA PÁGINA (load)
// ==========================================================
window.addEventListener('load', () => {
    // 1. Guardar info del usuario actual de sessionStorage
    usuarioLogueado = {
        username: sessionStorage.getItem('usuarioActual'),
        nombre: sessionStorage.getItem('nombreUsuario'),
        rol: sessionStorage.getItem('rolUsuario'),
        id: sessionStorage.getItem('usuarioId') // ¡El ID es crucial!
    };
    
    // 2. Validar sesión
    if (!usuarioLogueado.id) { // Validamos por ID
        window.location.href = '../index.html';
        return;
    }
    
    // 3. Cargar datos de UI
    document.getElementById('nombreUsuario').textContent = usuarioLogueado.nombre;
    document.getElementById('rolUsuario').textContent = usuarioLogueado.rol;
    actualizarFecha();
    
    // 4. Configurar el formulario
    limpiarFormularioPrestamo(); // (Esto pone las fechas por defecto)
    
    // 5. Cargar todos los datos de la API
    cargarDashboardStats();
    cargarTablaPendientes();
    actualizarInventarioDisplay();
    
    // 6. Cargar los selectores del formulario
    cargarAlumnosSelect();
    cargarAsignaturasSelect(); // (Punto 2)
    cargarMaterialesSelect();   // (Punto 1)

    // 7. Conectar los botones del formulario y modal
    document.getElementById('formNuevoPrestamo').addEventListener('submit', registrarPrestamo);
    document.getElementById('btnLimpiarFormulario').addEventListener('click', limpiarFormularioPrestamo);
    document.getElementById('btnConfirmarDevolucion').addEventListener('click', confirmarDevolucion);
});

// ==========================================================
// NAVEGACIÓN Y UI
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
        
        // Mapeo de títulos
        const titles = {
            'dashboard': 'Dashboard',
            'nuevo-prestamo': 'Nuevo Préstamo',
            'prestamos-activos': 'Préstamos Activos',
            'historial': 'Historial de Préstamos',
            'inventario': 'Inventario Disponible'
        };
        pageTitle.textContent = titles[sectionId];
        
        // Cargar datos dinámicamente al cambiar de pestaña
        if (sectionId === 'prestamos-activos') {
            cargarPrestamosActivosCompletos();
        } else if (sectionId === 'historial') {
            cargarHistorial();
        } else if (sectionId === 'inventario') {
            actualizarInventarioCompleto();
        }
    });
});

// --- Botones de Sidebar y Fecha ---
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
// CARGAR DATOS (Dashboard y Tablas)
// ==========================================================

async function cargarDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/dashboard/encargado-stats/${usuarioLogueado.id}`);
        if (!response.ok) throw new Error('No se pudieron cargar las estadísticas');
        const stats = await response.json();
        document.getElementById('misPrestamosActivos').textContent = stats.activos;
        document.getElementById('prestamosCompletados').textContent = stats.completados;
        document.getElementById('prestamosProximosVencer').textContent = stats.vencer;
    } catch (error) { console.error('Error cargando stats del dashboard:', error); }
}

async function cargarTablaPendientes() {
    const tablaPendientes = document.getElementById('tablaPendientes');
    try {
        const response = await fetch(`${API_URL}/prestamos/activos/${usuarioLogueado.id}`);
        if (!response.ok) throw new Error('No se pudieron cargar los préstamos pendientes');
        const prestamos = await response.json();
        
        tablaPendientes.innerHTML = ''; // Limpiamos
        
        if (prestamos.length === 0) {
            tablaPendientes.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay préstamos pendientes</td></tr>`;
            return;
        }
        
        // ¡ARREGLADO! Usamos addEventListener para evitar bugs con tildes
        prestamos.slice(0, 5).forEach(p => {
            const estadoInfo = getEstadoPrestamo(p.FECHA_DEVOLUCION);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</td>
                <td>${p.MATERIAL_NOMBRE} (${p.CODIGO_PATRIMONIAL})</td>
                <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                <td><span class="badge ${estadoInfo.badge}">${estadoInfo.texto}</span></td>
            `;
            
            // Creamos el botón y el listener
            const tdBoton = document.createElement('td');
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn btn-sm btn-success';
            btnDevolver.innerHTML = '<i class="fas fa-check"></i> Devolver';
            
            // Preparamos los datos para el modal
            const datosPrestamo = {
                id_solicitud: p.ID_SOLICITUD,
                id_detalle: p.ID_DETALLE,
                id_item: p.ID_ITEM,
                alumno: `${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}`,
                material: `${p.MATERIAL_NOMBRE} (${p.CODIGO_PATRIMONIAL})`
            };

            btnDevolver.addEventListener('click', () => {
                abrirModalDevolver(datosPrestamo);
            });

            tdBoton.appendChild(btnDevolver);
            tr.appendChild(tdBoton);
            tablaPendientes.appendChild(tr);
        });
    } catch (error) { 
        console.error("Error cargando pendientes:", error); 
        tablaPendientes.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar préstamos</td></tr>`;
    }
}

async function cargarPrestamosActivosCompletos() {
    const tablaActivos = document.getElementById('tablaActivosCompleta');
    try {
        const response = await fetch(`${API_URL}/prestamos/activos/${usuarioLogueado.id}`);
        if (!response.ok) throw new Error('No se pudieron cargar los préstamos activos');
        const prestamos = await response.json();

        document.getElementById('totalActivos').textContent = `${prestamos.length} activos`;
        tablaActivos.innerHTML = ''; // Limpiamos

        if (prestamos.length === 0) {
            tablaActivos.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay préstamos activos</td></tr>`;
            return;
        }

        // ¡ARREGLADO! Usamos addEventListener
        prestamos.forEach((p, index) => {
            const estadoInfo = getEstadoPrestamo(p.FECHA_DEVOLUCION);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${p.ID_SOLICITUD}</td>
                <td><strong>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</strong><br><small class="text-muted">${p.CURSO}</small></td>
                <td>${p.MATERIAL_NOMBRE}</td>
                <td><span class="badge bg-secondary">${p.CODIGO_PATRIMONIAL}</span></td>
                <td>${formatearFecha(p.FECHA_SOLICITUD)}</td>
                <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                <td><span class="badge ${estadoInfo.badge}">${estadoInfo.texto}</span></td>
            `;
            
            // Creamos los botones y listeners
            const tdBoton = document.createElement('td');
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn btn-sm btn-success';
            btnDevolver.innerHTML = '<i class="fas fa-check"></i> Devolver';
            
            const btnDetalle = document.createElement('button');
            btnDetalle.className = 'btn btn-sm btn-info ms-1';
            btnDetalle.innerHTML = '<i class="fas fa-eye"></i>';

            const datosPrestamo = {
                id_solicitud: p.ID_SOLICITUD,
                id_detalle: p.ID_DETALLE,
                id_item: p.ID_ITEM,
                alumno: `${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}`,
                material: `${p.MATERIAL_NOMBRE} (${p.CODIGO_PATRIMONIAL})`
            };

            btnDevolver.addEventListener('click', () => {
                abrirModalDevolver(datosPrestamo);
            });
            btnDetalle.addEventListener('click', () => {
                verDetallePrestamo(datosPrestamo); // (Función verDetalle pendiente)
            });

            tdBoton.appendChild(btnDevolver);
            tdBoton.appendChild(btnDetalle);
            tr.appendChild(tdBoton);
            tablaActivos.appendChild(tr);
        });
    } catch (error) { 
        console.error("Error cargando préstamos activos:", error);
        tablaActivos.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error al cargar préstamos</td></tr>`;
    }
}

async function cargarHistorial() {
    const tablaHistorial = document.getElementById('tablaHistorial');
    try {
        const response = await fetch(`${API_URL}/prestamos/historial/${usuarioLogueado.id}`);
        if (!response.ok) throw new Error('No se pudo cargar el historial');
        const prestamos = await response.json();
        
        tablaHistorial.innerHTML = ''; // Limpiamos

        if (prestamos.length === 0) {
            tablaHistorial.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay historial de préstamos</td></tr>`;
            return;
        }

        tablaHistorial.innerHTML = prestamos.map((p, index) => {
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
                    <td><span class="badge bg-secondary">${p.CODIGO_PATRIMONIAL}</span></td>
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

// --- Carga el Inventario (en la pestaña "Inicio" y "Inventario") ---
// (Estas funciones son de solo lectura, no cambian)
async function actualizarInventarioDisplay() {
    try {
        const response = await fetch(`${API_URL}/inventario`); 
        const inventario = await response.json();
        
        inventario.forEach(item => {
            let idDisp, idProg;
            if (item.nombre.includes('Tablet')) { idDisp = 'tabletsDisp'; idProg = 'progTablets'; }
            else if (item.nombre.includes('Notebook')) { idDisp = 'notebooksDisp'; idProg = 'progNotebooks'; }
            else if (item.nombre.includes('Libro')) { idDisp = 'librosDisp'; idProg = 'progLibros'; }
            else if (item.nombre.includes('Deportivo')) { idDisp = 'deportivoDisp'; idProg = 'progDeportivo'; }
            
            if (idDisp && document.getElementById(idDisp)) {
                document.getElementById(idDisp).textContent = item.disponibles;
                const progreso = (item.total > 0) ? (item.disponibles / item.total) * 100 : 0;
                document.getElementById(idProg).style.width = progreso + '%';
            }
        });
    } catch (error) { console.error("Error cargando display inventario:", error); }
}
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

            if (idDisp && document.getElementById(idDisp)) {
                const prestados = item.total - item.disponibles;
                document.getElementById(idDisp).textContent = item.disponibles;
                document.getElementById(idPrest).textContent = prestados;
                const progreso = (item.total > 0) ? (item.disponibles / item.total) * 100 : 0;
                document.getElementById(idProg).style.width = progreso + '%';
            }
        });
    } catch (error) { console.error("Error cargando inventario completo:", error); }
}


// ==========================================================
// FORMULARIO NUEVO PRÉSTAMO (Puntos 1, 2 y 3)
// ==========================================================

// --- Cargar <select> de Alumnos (Sin cambios) ---
async function cargarAlumnosSelect() {
    const select = document.getElementById('alumnoSelect');
    try {
        const response = await fetch(`${API_URL}/alumnos`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const alumnos = await response.json();
        select.innerHTML = '<option value="">-- Seleccione un alumno --</option>';
        alumnos.forEach(alumno => { select.innerHTML += `<option value="${alumno.ID_ALUMNO}">${alumno.NOMBRE} ${alumno.APELLIDO} (${alumno.RUT} - ${alumno.CURSO})</option>`; });
    } catch (error) { console.error('Error cargando alumnos:', error); select.innerHTML = '<option value="">Error al cargar alumnos</option>'; }
}

// --- Cargar <select> de Asignaturas (Punto 2) ---
async function cargarAsignaturasSelect() {
    const select = document.getElementById('asignaturaSelect');
    try {
        const response = await fetch(`${API_URL}/asignaturas`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const asignaturas = await response.json();
        select.innerHTML = '<option value="">-- Seleccione una asignatura --</option>';
        asignaturas.forEach(asig => { select.innerHTML += `<option value="${asig.ID_ASIGNATURA}">${asig.NOMBRE_ASIGNATURA}</option>`; });
    } catch (error) { console.error('Error cargando asignaturas:', error); select.innerHTML = '<option value="">Error al cargar</option>'; }
}

// --- Cargar <select> de Productos (Punto 1) ---
async function cargarMaterialesSelect() {
    const select = document.getElementById('materialSelect');
    try {
        const response = await fetch(`${API_URL}/materiales`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const materiales = await response.json();
        select.innerHTML = '<option value="">-- Seleccione un producto --</option>';
        materiales.forEach(mat => {
            select.innerHTML += `
                <option value="${mat.ID_MATERIAL}" data-max-dias="${mat.MAX_DIAS_PRESTAMO}">
                    ${mat.NOMBRE_TIPO_MATERIAL} - ${mat.NOMBRE}
                </option>`;
        });
    } catch (error) { console.error('Error cargando materiales:', error); select.innerHTML = '<option value="">Error al cargar</option>'; }
}

// --- Cargar <select> de Ítems (Punto 1) ---
async function cargarItemsDisponibles(idMaterial) {
    const select = document.getElementById('itemSelect');
    const info = document.getElementById('itemDisponiblesInfo');
    if (!idMaterial) {
        select.innerHTML = '<option value="">-- Primero seleccione un producto --</option>';
        select.disabled = true;
        info.textContent = '';
        return;
    }
    try {
        const response = await fetch(`${API_URL}/items-disponibles/${idMaterial}`);
        if (!response.ok) throw new Error('Respuesta de red no fue OK');
        const items = await response.json();
        if (items.length === 0) {
            select.innerHTML = '<option value="">-- No hay ítems disponibles --</option>';
            select.disabled = true;
            info.textContent = '0 ítems disponibles.';
            return;
        }
        select.innerHTML = '<option value="">-- Seleccione un ítem específico --</option>';
        items.forEach(item => { select.innerHTML += `<option value="${item.ID_ITEM}">${item.CODIGO_PATRIMONIAL}</option>`; });
        select.disabled = false;
        info.textContent = `${items.length} ítems disponibles.`;
    } catch (error) {
        console.error('Error cargando ítems:', error);
        select.innerHTML = '<option value="">Error al cargar ítems</option>';
        select.disabled = true;
    }
}

// --- Event Listeners del Formulario (Punto 1 y 3) ---
document.getElementById('materialSelect').addEventListener('change', (e) => {
    const idMaterialSeleccionado = e.target.value;
    const opcionSeleccionada = e.target.selectedOptions[0];
    const maxDias = opcionSeleccionada.getAttribute('data-max-dias') || 7;
    
    cargarItemsDisponibles(idMaterialSeleccionado);
    
    // Aplicar regla de días máximos (Punto 3.B)
    document.getElementById('fechaLimiteMsg').textContent = `Límite de préstamo para este material: ${maxDias} días.`;
    document.getElementById('fechaLimiteMsg').classList.remove('d-none');
    
    // Pasar maxDias a la función de validación
    validarFechas(maxDias);
});

// --- Lógica de Validación de Fechas (Punto 3.A y 3.B) ---
const fechaPrestamoInput = document.getElementById('fechaPrestamo');
const fechaDevolucionInput = document.getElementById('fechaDevolucion');
const fechaErrorMsg = document.getElementById('fechaErrorMsg');
const fechaLimiteMsg = document.getElementById('fechaLimiteMsg');

function validarFechas(maxDias = null) {
    if (!fechaPrestamoInput.value || !fechaDevolucionInput.value) return false;

    const inicio = new Date(fechaPrestamoInput.value);
    const fin = new Date(fechaDevolucionInput.value);
    let esValido = true;

    // 1. Validar que la devolución no sea antes que el préstamo
    if (fin < inicio) {
        fechaErrorMsg.classList.remove('d-none');
        esValido = false;
    } else {
        fechaErrorMsg.classList.add('d-none');
    }

    // 2. Validar el límite de días (si se pasó)
    if (maxDias) {
        const unDia = 1000 * 60 * 60 * 24;
        const diferenciaMs = fin.getTime() - inicio.getTime();
        const diferenciaDias = Math.ceil(diferenciaMs / unDia);

        if (diferenciaDias > maxDias) {
            fechaLimiteMsg.textContent = `Error: El préstamo no puede exceder los ${maxDias} días.`;
            fechaLimiteMsg.classList.replace('text-info', 'text-danger');
            esValido = false;
        } else {
            fechaLimiteMsg.textContent = `Límite de préstamo para este material: ${maxDias} días.`;
            fechaLimiteMsg.classList.replace('text-danger', 'text-info');
        }
        fechaLimiteMsg.classList.remove('d-none');
    }
    return esValido;
}
fechaPrestamoInput.addEventListener('change', () => {
    const maxDias = document.getElementById('materialSelect').selectedOptions[0].getAttribute('data-max-dias');
    validarFechas(maxDias);
});
fechaDevolucionInput.addEventListener('change', () => {
    const maxDias = document.getElementById('materialSelect').selectedOptions[0].getAttribute('data-max-dias');
    validarFechas(maxDias);
});

// --- Limpiar Formulario ---
function limpiarFormularioPrestamo() {
    document.getElementById('formNuevoPrestamo').reset();
    
    // Configurar fechas por defecto
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    const fechaActualString = ahora.toISOString().slice(0, 16);
    fechaPrestamoInput.value = fechaActualString;
    
    const fechaDevolucion = new Date(ahora);
    fechaDevolucion.setDate(fechaDevolucion.getDate() + 7);
    fechaDevolucionInput.value = fechaDevolucion.toISOString().slice(0, 16);
    
    // Resetear selectores de ítems y mensajes de fecha
    cargarItemsDisponibles(null);
    fechaErrorMsg.classList.add('d-none');
    fechaLimiteMsg.classList.add('d-none');
}

// --- Registrar Préstamo (¡ACTUALIZADO!) ---
async function registrarPrestamo(e) {
    e.preventDefault();
    
    // 1. Validar las fechas (Punto 3)
    const maxDiasAttr = document.getElementById('materialSelect').selectedOptions[0].getAttribute('data-max-dias');
    const maxDias = maxDiasAttr ? parseInt(maxDiasAttr) : null;
    
    if (!validarFechas(maxDias)) {
        alert("Error en las fechas: revise la fecha de devolución o el límite de días.");
        return;
    }

    // 2. Recolectar datos del formulario (v3.0)
    const prestamo = {
        id_alumno: document.getElementById('alumnoSelect').value,
        id_asignatura: document.getElementById('asignaturaSelect').value,
        id_item: document.getElementById('itemSelect').value, // ¡ID de Ítem!
        fecha_prestamo: fechaPrestamoInput.value,
        fecha_devolucion: fechaDevolucionInput.value,
        responsable: document.getElementById('responsableSelect').value,
        observaciones: document.getElementById('observaciones').value,
        id_usuario: usuarioLogueado.id
    };

    // 3. Validar que se haya seleccionado un ítem
    if (!prestamo.id_item) {
        alert("Por favor, seleccione un ítem específico (código) para prestar.");
        return;
    }
    
    // 4. Enviar a la API
    try {
        const response = await fetch(`${API_URL}/prestamos/crear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prestamo)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Error al registrar el préstamo');
        }

        // 5. ¡Éxito!
        alert('✅ ¡Préstamo registrado exitosamente!');
        limpiarFormularioPrestamo();
        
        // 6. Recargar todo el dashboard
        cargarDashboardStats();
        cargarTablaPendientes();
        actualizarInventarioDisplay();
        cargarMaterialesSelect(); // Recarga los productos (no el stock, pero es bueno)

    } catch (error) {
        console.error('Error al crear préstamo:', error);
        alert(`Error: ${error.message}`);
    }
}


// ==========================================================
// LÓGICA DE DEVOLUCIÓN (¡ACTUALIZADA!)
// ==========================================================
function abrirModalDevolver(prestamo) {
    // Guardamos los datos del préstamo en la variable global
    prestamoADevolver = prestamo;
    
    // Llenar información del modal
    const infoPrestamo = document.getElementById('infoPrestamo');
    infoPrestamo.innerHTML = `
        <div class="alert alert-info">
            <strong>Alumno:</strong> ${prestamo.alumno}<br>
            <strong>Material:</strong> ${prestamo.material}
        </div>
    `;
    
    // Establecer fecha actual en el modal
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    document.getElementById('fechaDevolucionReal').value = ahora.toISOString().slice(0, 16);
    
    // Limpiar campos
    document.getElementById('estadoMaterial').value = 'Bueno';
    document.getElementById('observacionesDevolucion').value = '';
    
    // Abrir el modal de Bootstrap
    modalDevolverBootstrap.show();
}

async function confirmarDevolucion() {
    // 1. Recolectar datos del modal
    const devolucion = {
        estado_material: document.getElementById('estadoMaterial').value,
        observaciones: document.getElementById('observacionesDevolucion').value,
        fecha_recepcion: document.getElementById('fechaDevolucionReal').value
    };

    // 2. Juntar con los datos del préstamo que guardamos
    const datosCompletos = {
        ...prestamoADevolver, // Contiene id_solicitud, id_detalle, id_item
        id_usuario_encargado: usuarioLogueado.id,
        ...devolucion
    };

    if (!devolucion.fecha_recepcion) {
        alert('Por favor ingrese la fecha de devolución');
        return;
    }

    try {
        // 3. Enviar a la API (v3.0)
        const response = await fetch(`${API_URL}/prestamos/devolver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCompletos)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al registrar la devolución');

        // 4. ¡Éxito!
        alert('✅ Devolución registrada exitosamente');
        modalDevolverBootstrap.hide();
        
        // 5. Recargar TODA la información
        cargarDashboardStats();
        cargarTablaPendientes();
        actualizarInventarioDisplay();
        cargarPrestamosActivosCompletos(); // (Si está en esa pestaña)
        actualizarInventarioCompleto();    // (Si está en esa pestaña)

    } catch (error) {
        console.error('Error al confirmar devolución:', error);
        alert(`Error: ${error.message}`);
    }
}

function verDetallePrestamo(id) {
    alert(`¡Función DETALLE aún no conectada! Se vería el préstamo ID: ${id}`);
    // Esta función requeriría un nuevo endpoint /api/prestamo/:id
}


// ==========================================================
// UTILIDADES (Formatear Fecha y Estado)
// ==========================================================
function getEstadoPrestamo(fechaDevolucionISO) {
    const fechaDevolucion = new Date(fechaDevolucionISO);
    const ahora = new Date();
    // Comparamos solo fechas, no horas
    const finDiaDevolucion = new Date(fechaDevolucion.setHours(23, 59, 59, 999));
    const diasRestantes = Math.ceil((finDiaDevolucion - ahora) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) return { badge: 'bg-danger', texto: `${Math.abs(diasRestantes)} días atrasado` };
    if (diasRestantes === 0) return { badge: 'bg-warning', texto: 'Vence hoy' };
    if (diasRestantes === 1) return { badge: 'bg-warning', texto: 'Vence mañana' };
    return { badge: 'bg-success', texto: `${diasRestantes} días` };
}

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