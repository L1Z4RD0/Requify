// dashboard-encargado.js

// ========== VERIFICACIÓN DE SESIÓN ==========
let usuarioActualInfo = {};

window.addEventListener('load', () => {
    const usuarioActual = sessionStorage.getItem('usuarioActual');
    const nombreUsuario = sessionStorage.getItem('nombreUsuario');
    const rolUsuario = sessionStorage.getItem('rolUsuario');
    
    if (!usuarioActual) {
        window.location.href = '../index.html';
        return;
    }
    
    // Guardar info del usuario actual
    usuarioActualInfo = {
        username: usuarioActual,
        nombre: nombreUsuario,
        rol: rolUsuario
    };
    
    // Mostrar información del usuario
    document.getElementById('nombreUsuario').textContent = nombreUsuario;
    document.getElementById('rolUsuario').textContent = rolUsuario;
    
    // Mostrar fecha actual
    actualizarFecha();
    
    // Establecer fecha y hora actual por defecto
    const ahora = new Date();
    const fechaActualString = ahora.toISOString().slice(0, 16);
    document.getElementById('fechaPrestamo').value = fechaActualString;
    
    // Establecer fecha de devolución (7 días después por defecto)
    const fechaDevolucion = new Date(ahora);
    fechaDevolucion.setDate(fechaDevolucion.getDate() + 7);
    document.getElementById('fechaDevolucion').value = fechaDevolucion.toISOString().slice(0, 16);
    
    // Cargar datos iniciales
    cargarDashboard();
    actualizarInventarioDisplay();
});

// ========== NAVEGACIÓN ==========
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
        
        // Cargar datos según la sección
        if (sectionId === 'prestamos-activos') {
            cargarPrestamosActivos();
        } else if (sectionId === 'historial') {
            cargarHistorial();
        } else if (sectionId === 'inventario') {
            actualizarInventarioCompleto();
        }
    });
});

// ========== TOGGLE SIDEBAR ==========
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');

toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
});

// ========== CERRAR SESIÓN ==========
document.getElementById('cerrarSesion').addEventListener('click', (e) => {
    e.preventDefault();
    
    if (confirm('¿Está seguro que desea cerrar sesión?')) {
        sessionStorage.clear();
        window.location.href = '../index.html';
    }
});

// ========== ACTUALIZAR FECHA ==========
function actualizarFecha() {
    const fecha = new Date();
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fechaActual').textContent = 
        fecha.toLocaleDateString('es-CL', opciones);
}

// ========== DATOS ==========
let prestamos = JSON.parse(localStorage.getItem('prestamos')) || [];
let inventario = JSON.parse(localStorage.getItem('inventario')) || {
    tablets: { total: 20, disponibles: 20, prestadas: 0 },
    notebooks: { total: 100, disponibles: 100, prestadas: 0 },
    libros: { total: 50, disponibles: 50, prestados: 0 },
    deportivo: { total: 30, disponibles: 30, prestado: 0 }
};

const alumnosData = {
    '1': { nombre: 'Diego Soto', rut: '12.345.678-9', curso: '8° A' },
    '2': { nombre: 'María Castillo', rut: '23.456.789-0', curso: '7° B' },
    '3': { nombre: 'Carlos Fuentes', rut: '34.567.890-1', curso: '6° C' },
    '4': { nombre: 'Ana López', rut: '45.678.901-2', curso: '8° A' },
    '5': { nombre: 'Pedro Ramírez', rut: '56.789.012-3', curso: '7° A' }
};

// ========== CARGAR DASHBOARD ==========
function cargarDashboard() {
    // Filtrar préstamos del usuario actual
    const misPrestamos = prestamos.filter(p => p.usuario === usuarioActualInfo.username);
    
    const activos = misPrestamos.filter(p => p.estado === 'activo').length;
    const completados = misPrestamos.filter(p => p.estado === 'devuelto').length;
    
    // Préstamos próximos a vencer (menos de 24 horas)
    const ahora = new Date();
    const proximosVencer = misPrestamos.filter(p => {
        if (p.estado === 'activo') {
            const fechaDevolucion = new Date(p.fechaDevolucion);
            const diferencia = fechaDevolucion - ahora;
            const horasRestantes = diferencia / (1000 * 60 * 60);
            return horasRestantes > 0 && horasRestantes <= 24;
        }
        return false;
    }).length;
    
    document.getElementById('misPrestamosActivos').textContent = activos;
    document.getElementById('prestamosCompletados').textContent = completados;
    document.getElementById('prestamosProximosVencer').textContent = proximosVencer;
    
    // Cargar tabla de pendientes
    cargarTablaPendientes();
}

// ========== TABLA DE PENDIENTES ==========
function cargarTablaPendientes() {
    const tablaPendientes = document.getElementById('tablaPendientes');
    const misPrestamosActivos = prestamos.filter(p => 
        p.estado === 'activo' && p.usuario === usuarioActualInfo.username
    );
    
    if (misPrestamosActivos.length === 0) {
        tablaPendientes.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">No hay préstamos pendientes</td>
            </tr>
        `;
        return;
    }
    
    tablaPendientes.innerHTML = misPrestamosActivos.map(p => {
        const fechaDevolucion = new Date(p.fechaDevolucion);
        const ahora = new Date();
        const diasRestantes = Math.ceil((fechaDevolucion - ahora) / (1000 * 60 * 60 * 24));
        
        let estadoBadge = 'bg-success';
        let estadoTexto = 'A tiempo';
        
        if (diasRestantes < 0) {
            estadoBadge = 'bg-danger';
            estadoTexto = 'Vencido';
        } else if (diasRestantes <= 1) {
            estadoBadge = 'bg-warning';
            estadoTexto = 'Por vencer';
        }
        
        return `
            <tr>
                <td>${p.alumno}</td>
                <td>${p.material} (${p.cantidad})</td>
                <td>${formatearFecha(p.fechaDevolucion)}</td>
                <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="abrirModalDevolver(${p.id})">
                        <i class="fas fa-check"></i> Devolver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== ACTUALIZAR DISPONIBILIDAD AL SELECCIONAR MATERIAL ==========
document.getElementById('materialSelect').addEventListener('change', (e) => {
    const material = e.target.value;
    const disponiblesInfo = document.getElementById('disponiblesInfo');
    
    if (!material) {
        disponiblesInfo.textContent = '-';
        return;
    }
    
    const materialKey = material.toLowerCase().replace(/\s+/g, '');
    if (inventario[materialKey]) {
        disponiblesInfo.textContent = inventario[materialKey].disponibles;
    }
});

// ========== FORMULARIO NUEVO PRÉSTAMO ==========
const formNuevoPrestamo = document.getElementById('formNuevoPrestamo');

formNuevoPrestamo.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const alumnoId = document.getElementById('alumnoSelect').value;
    const material = document.getElementById('materialSelect').value;
    const cantidad = parseInt(document.getElementById('cantidadPrestamo').value);
    const asignatura = document.getElementById('asignatura').value;
    const fechaPrestamo = document.getElementById('fechaPrestamo').value;
    const fechaDevolucion = document.getElementById('fechaDevolucion').value;
    const responsable = document.getElementById('responsableSelect').value;
    const observaciones = document.getElementById('observaciones').value;
    
    // Validar disponibilidad
    const materialKey = material.toLowerCase().replace(' ', '');
    if (inventario[materialKey].disponibles < cantidad) {
        alert(`No hay suficiente stock. Solo hay ${inventario[materialKey].disponibles} ${material}(s) disponibles.`);
        return;
    }
    
    // Crear préstamo
    const nuevoPrestamo = {
        id: Date.now(),
        alumno: alumnosData[alumnoId].nombre,
        alumnoRut: alumnosData[alumnoId].rut,
        alumnoCurso: alumnosData[alumnoId].curso,
        material: material,
        cantidad: cantidad,
        asignatura: asignatura,
        fechaPrestamo: fechaPrestamo,
        fechaDevolucion: fechaDevolucion,
        responsable: responsable,
        observaciones: observaciones,
        estado: 'activo',
        usuario: usuarioActualInfo.username,
        nombreUsuario: usuarioActualInfo.nombre,
        fechaRegistro: new Date().toISOString()
    };
    
    // Actualizar inventario
    inventario[materialKey].disponibles -= cantidad;
    if (materialKey === 'libros' || materialKey === 'deportivo') {
        inventario[materialKey].prestados = (inventario[materialKey].prestados || 0) + cantidad;
    } else {
        inventario[materialKey].prestadas += cantidad;
    }
    
    // Guardar
    prestamos.push(nuevoPrestamo);
    localStorage.setItem('prestamos', JSON.stringify(prestamos));
    localStorage.setItem('inventario', JSON.stringify(inventario));
    
    // Mensaje de éxito
    alert(`✅ Préstamo registrado exitosamente\n\nAlumno: ${nuevoPrestamo.alumno}\nMaterial: ${material} (${cantidad})\nDevolución: ${formatearFecha(fechaDevolucion)}`);
    
    // Limpiar formulario
    formNuevoPrestamo.reset();
    
    // Actualizar fechas por defecto
    const ahora = new Date();
    document.getElementById('fechaPrestamo').value = ahora.toISOString().slice(0, 16);
    const fechaDevFutura = new Date(ahora);
    fechaDevFutura.setDate(fechaDevFutura.getDate() + 7);
    document.getElementById('fechaDevolucion').value = fechaDevFutura.toISOString().slice(0, 16);
    
    // Actualizar displays
    cargarDashboard();
    actualizarInventarioDisplay();
});

// ========== CARGAR PRÉSTAMOS ACTIVOS ==========
function cargarPrestamosActivos() {
    const tablaActivos = document.getElementById('tablaActivosCompleta');
    const misPrestamosActivos = prestamos.filter(p => 
        p.estado === 'activo' && p.usuario === usuarioActualInfo.username
    );
    
    document.getElementById('totalActivos').textContent = `${misPrestamosActivos.length} activos`;
    
    if (misPrestamosActivos.length === 0) {
        tablaActivos.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">No hay préstamos activos</td>
            </tr>
        `;
        return;
    }
    
    tablaActivos.innerHTML = misPrestamosActivos.map((p, index) => {
        const fechaDevolucion = new Date(p.fechaDevolucion);
        const ahora = new Date();
        const diasRestantes = Math.ceil((fechaDevolucion - ahora) / (1000 * 60 * 60 * 24));
        
        let diasBadge = 'badge bg-success';
        let diasTexto = `${diasRestantes} días`;
        
        if (diasRestantes < 0) {
            diasBadge = 'badge bg-danger';
            diasTexto = `${Math.abs(diasRestantes)} días atrasado`;
        } else if (diasRestantes === 0) {
            diasBadge = 'badge bg-warning';
            diasTexto = 'Vence hoy';
        } else if (diasRestantes === 1) {
            diasBadge = 'badge bg-warning';
            diasTexto = 'Vence mañana';
        }
        
        return `
            <tr>
                <td>#${index + 1}</td>
                <td>
                    <strong>${p.alumno}</strong><br>
                    <small class="text-muted">${p.alumnoCurso}</small>
                </td>
                <td>${p.material}</td>
                <td><span class="badge bg-info">${p.cantidad}</span></td>
                <td>${formatearFecha(p.fechaPrestamo)}</td>
                <td>${formatearFecha(p.fechaDevolucion)}</td>
                <td><span class="${diasBadge}">${diasTexto}</span></td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="abrirModalDevolver(${p.id})">
                        <i class="fas fa-check"></i> Devolver
                    </button>
                    <button class="btn btn-sm btn-info" onclick="verDetallePrestamo(${p.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== MODAL DEVOLVER ==========
let prestamoADevolver = null;

function abrirModalDevolver(id) {
    prestamoADevolver = prestamos.find(p => p.id === id);
    
    if (!prestamoADevolver) {
        alert('Préstamo no encontrado');
        return;
    }
    
    // Llenar información
    const infoPrestamo = document.getElementById('infoPrestamo');
    infoPrestamo.innerHTML = `
        <div class="alert alert-info">
            <strong>Alumno:</strong> ${prestamoADevolver.alumno}<br>
            <strong>Material:</strong> ${prestamoADevolver.material} (${prestamoADevolver.cantidad})<br>
            <strong>Fecha Préstamo:</strong> ${formatearFecha(prestamoADevolver.fechaPrestamo)}<br>
            <strong>Fecha Devolución Programada:</strong> ${formatearFecha(prestamoADevolver.fechaDevolucion)}
        </div>
    `;
    
    // Establecer fecha actual
    const ahora = new Date();
    document.getElementById('fechaDevolucionReal').value = ahora.toISOString().slice(0, 16);
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalDevolver'));
    modal.show();
}

// ========== CONFIRMAR DEVOLUCIÓN ==========
document.getElementById('btnConfirmarDevolucion').addEventListener('click', () => {
    if (!prestamoADevolver) return;
    
    const fechaDevolucionReal = document.getElementById('fechaDevolucionReal').value;
    const estadoMaterial = document.getElementById('estadoMaterial').value;
    const observacionesDevolucion = document.getElementById('observacionesDevolucion').value;
    
    if (!fechaDevolucionReal) {
        alert('Por favor ingrese la fecha de devolución');
        return;
    }
    
    // Actualizar préstamo
    prestamoADevolver.estado = 'devuelto';
    prestamoADevolver.fechaDevolucionReal = fechaDevolucionReal;
    prestamoADevolver.estadoMaterial = estadoMaterial;
    prestamoADevolver.observacionesDevolucion = observacionesDevolucion;
    
    // Actualizar inventario
    const materialKey = prestamoADevolver.material.toLowerCase().replace(' ', '');
    inventario[materialKey].disponibles += prestamoADevolver.cantidad;
    
    if (materialKey === 'libros' || materialKey === 'deportivo') {
        const key = materialKey === 'libros' ? 'prestados' : 'prestado';
        inventario[materialKey][key] = Math.max(0, inventario[materialKey][key] - prestamoADevolver.cantidad);
    } else {
        inventario[materialKey].prestadas = Math.max(0, inventario[materialKey].prestadas - prestamoADevolver.cantidad);
    }
    
    // Guardar
    localStorage.setItem('prestamos', JSON.stringify(prestamos));
    localStorage.setItem('inventario', JSON.stringify(inventario));
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalDevolver'));
    modal.hide();
    
    alert('✅ Devolución registrada exitosamente');
    
    // Actualizar vistas
    cargarDashboard();
    cargarPrestamosActivos();
    actualizarInventarioDisplay();
    
    prestamoADevolver = null;
});

// ========== CARGAR HISTORIAL ==========
function cargarHistorial() {
    const tablaHistorial = document.getElementById('tablaHistorial');
    const misPrestamos = prestamos.filter(p => p.usuario === usuarioActualInfo.username);
    
    if (misPrestamos.length === 0) {
        tablaHistorial.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">No hay historial de préstamos</td>
            </tr>
        `;
        return;
    }
    
    // Ordenar por fecha más reciente
    const prestamosOrdenados = [...misPrestamos].sort((a, b) => 
        new Date(b.fechaRegistro) - new Date(a.fechaRegistro)
    );
    
    tablaHistorial.innerHTML = prestamosOrdenados.map((p, index) => {
        const estadoBadge = p.estado === 'activo' ? 'bg-success' : 'bg-secondary';
        const estadoTexto = p.estado === 'activo' ? 'Activo' : 'Devuelto';
        
        return `
            <tr>
                <td>#${index + 1}</td>
                <td>${p.alumno}</td>
                <td>${p.material}</td>
                <td>${p.cantidad}</td>
                <td>${formatearFecha(p.fechaPrestamo)}</td>
                <td>${p.fechaDevolucionReal ? formatearFecha(p.fechaDevolucionReal) : formatearFecha(p.fechaDevolucion)}</td>
                <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="verDetallePrestamo(${p.id})">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== VER DETALLE ==========
function verDetallePrestamo(id) {
    const prestamo = prestamos.find(p => p.id === id);
    if (!prestamo) return;
    
    let detalles = `
=== DETALLE DEL PRÉSTAMO ===

ALUMNO:
${prestamo.alumno}
${prestamo.alumnoRut}
Curso: ${prestamo.alumnoCurso}

MATERIAL:
${prestamo.material} (${prestamo.cantidad} unidad${prestamo.cantidad > 1 ? 'es' : ''})
Asignatura: ${prestamo.asignatura}

FECHAS:
Préstamo: ${formatearFecha(prestamo.fechaPrestamo)}
Devolución programada: ${formatearFecha(prestamo.fechaDevolucion)}
${prestamo.fechaDevolucionReal ? `Devolución real: ${formatearFecha(prestamo.fechaDevolucionReal)}` : ''}

RESPONSABLE: ${prestamo.responsable}
ESTADO: ${prestamo.estado.toUpperCase()}

${prestamo.observaciones ? `OBSERVACIONES:\n${prestamo.observaciones}` : ''}

${prestamo.estadoMaterial ? `ESTADO DEL MATERIAL: ${prestamo.estadoMaterial}` : ''}
${prestamo.observacionesDevolucion ? `OBSERVACIONES DEVOLUCIÓN:\n${prestamo.observacionesDevolucion}` : ''}

Registrado por: ${prestamo.nombreUsuario}
    `;
    
    alert(detalles);
}

// ========== ACTUALIZAR INVENTARIO DISPLAY ==========
function actualizarInventarioDisplay() {
    // Dashboard
    document.getElementById('tabletsDisp').textContent = inventario.tablets.disponibles;
    const progTablets = (inventario.tablets.disponibles / inventario.tablets.total) * 100;
    document.getElementById('progTablets').style.width = progTablets + '%';
    
    document.getElementById('notebooksDisp').textContent = inventario.notebooks.disponibles;
    const progNotebooks = (inventario.notebooks.disponibles / inventario.notebooks.total) * 100;
    document.getElementById('progNotebooks').style.width = progNotebooks + '%';
    
    document.getElementById('librosDisp').textContent = inventario.libros.disponibles;
    const progLibros = (inventario.libros.disponibles / inventario.libros.total) * 100;
    document.getElementById('progLibros').style.width = progLibros + '%';
    
    document.getElementById('deportivoDisp').textContent = inventario.deportivo.disponibles;
    const progDeportivo = (inventario.deportivo.disponibles / inventario.deportivo.total) * 100;
    document.getElementById('progDeportivo').style.width = progDeportivo + '%';
}

// ========== ACTUALIZAR INVENTARIO COMPLETO ==========
function actualizarInventarioCompleto() {
    // Tarjetas de inventario
    document.getElementById('tabletsInvDisp').textContent = inventario.tablets.disponibles;
    document.getElementById('tabletsInvPrest').textContent = inventario.tablets.prestadas;
    const progInvTablets = (inventario.tablets.disponibles / inventario.tablets.total) * 100;
    document.getElementById('progressInvTablets').style.width = progInvTablets + '%';
    
    document.getElementById('notebooksInvDisp').textContent = inventario.notebooks.disponibles;
    document.getElementById('notebooksInvPrest').textContent = inventario.notebooks.prestadas;
    const progInvNotebooks = (inventario.notebooks.disponibles / inventario.notebooks.total) * 100;
    document.getElementById('progressInvNotebooks').style.width = progInvNotebooks + '%';
    
    document.getElementById('librosInvDisp').textContent = inventario.libros.disponibles;
    document.getElementById('librosInvPrest').textContent = inventario.libros.prestados;
    const progInvLibros = (inventario.libros.disponibles / inventario.libros.total) * 100;
    document.getElementById('progressInvLibros').style.width = progInvLibros + '%';
    
    document.getElementById('deportivoInvDisp').textContent = inventario.deportivo.disponibles;
    document.getElementById('deportivoInvPrest').textContent = inventario.deportivo.prestado;
    const progInvDeportivo = (inventario.deportivo.disponibles / inventario.deportivo.total) * 100;
    document.getElementById('progressInvDeportivo').style.width = progInvDeportivo + '%';
}

// ========== FORMATEAR FECHA ==========
function formatearFecha(fecha) {
    const date = new Date(fecha);
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}