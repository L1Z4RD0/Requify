// dashboard-admin.js

// ========== VERIFICACIÓN DE SESIÓN ==========
window.addEventListener('load', () => {
    const usuarioActual = sessionStorage.getItem('usuarioActual');
    const nombreUsuario = sessionStorage.getItem('nombreUsuario');
    const rolUsuario = sessionStorage.getItem('rolUsuario');
    
    if (!usuarioActual) {
        window.location.href = '../index.html';
        return;
    }
    
    // Mostrar información del usuario
    document.getElementById('nombreUsuario').textContent = nombreUsuario;
    document.getElementById('rolUsuario').textContent = rolUsuario;
    
    // Mostrar fecha actual
    actualizarFecha();
    
    // Cargar datos iniciales
    cargarDashboard();
});

// ========== NAVEGACIÓN ==========
const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
const sections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('pageTitle');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remover active de todos los links
        navLinks.forEach(l => l.classList.remove('active'));
        
        // Agregar active al link clickeado
        link.classList.add('active');
        
        // Ocultar todas las secciones
        sections.forEach(s => s.classList.remove('active'));
        
        // Mostrar la sección correspondiente
        const sectionId = link.getAttribute('data-section');
        document.getElementById(`section-${sectionId}`).classList.add('active');
        
        // Actualizar título
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

// ========== DATOS SIMULADOS ==========
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
let prestamos = JSON.parse(localStorage.getItem('prestamos')) || [];
let inventario = JSON.parse(localStorage.getItem('inventario')) || {
    tablets: { total: 20, disponibles: 20, prestadas: 0 },
    notebooks: { total: 100, disponibles: 100, prestadas: 0 },
    libros: { total: 50, disponibles: 50, prestados: 0 },
    deportivo: { total: 30, disponibles: 30, prestado: 0 }
};

// Alumnos de prueba
const alumnos = [
    { id: 1, nombre: 'Diego Soto', rut: '12.345.678-9', curso: '8° A' },
    { id: 2, nombre: 'María Castillo', rut: '23.456.789-0', curso: '7° B' },
    { id: 3, nombre: 'Carlos Fuentes', rut: '34.567.890-1', curso: '6° C' },
    { id: 4, nombre: 'Ana López', rut: '45.678.901-2', curso: '8° A' },
    { id: 5, nombre: 'Pedro Ramírez', rut: '56.789.012-3', curso: '7° A' }
];

// ========== CARGAR DASHBOARD ==========
function cargarDashboard() {
    // Actualizar estadísticas
    document.getElementById('totalUsuarios').textContent = usuarios.length;
    
    const prestamosActivos = prestamos.filter(p => p.estado === 'activo').length;
    document.getElementById('prestamosActivos').textContent = prestamosActivos;
    
    const prestamosVencidos = prestamos.filter(p => {
        if (p.estado === 'activo') {
            const fechaDevolucion = new Date(p.fechaDevolucion);
            return fechaDevolucion < new Date();
        }
        return false;
    }).length;
    document.getElementById('prestamosVencidos').textContent = prestamosVencidos;
    
    // Cargar actividad reciente
    cargarActividadReciente();
    
    // Cargar alertas
    cargarAlertas();
}

// ========== ACTIVIDAD RECIENTE ==========
function cargarActividadReciente() {
    const actividadDiv = document.getElementById('actividadReciente');
    
    if (prestamos.length === 0) {
        actividadDiv.innerHTML = '<p class="text-muted text-center">No hay actividad reciente</p>';
        return;
    }
    
    // Obtener los últimos 5 préstamos
    const ultimosPrestamos = prestamos.slice(-5).reverse();
    
    actividadDiv.innerHTML = ultimosPrestamos.map(p => `
        <div class="activity-item">
            <strong>${p.alumno}</strong> 
            ${p.estado === 'devuelto' ? 'devolvió' : 'solicitó'} 
            <strong>${p.material}</strong>
            <br>
            <span class="time">
                <i class="fas fa-clock"></i> ${formatearFecha(p.fechaPrestamo)}
            </span>
        </div>
    `).join('');
}

// ========== ALERTAS ==========
function cargarAlertas() {
    const alertasDiv = document.getElementById('alertasSistema');
    const alertas = [];
    
    // Alertas de inventario bajo
    if (inventario.tablets.disponibles < 5) {
        alertas.push({
            tipo: 'warning',
            mensaje: `Stock bajo de Tablets: solo ${inventario.tablets.disponibles} disponibles`
        });
    }
    
    if (inventario.notebooks.disponibles < 20) {
        alertas.push({
            tipo: 'warning',
            mensaje: `Stock bajo de Notebooks: solo ${inventario.notebooks.disponibles} disponibles`
        });
    }
    
    // Alertas de préstamos vencidos
    const vencidos = prestamos.filter(p => {
        if (p.estado === 'activo') {
            const fechaDevolucion = new Date(p.fechaDevolucion);
            return fechaDevolucion < new Date();
        }
        return false;
    });
    
    if (vencidos.length > 0) {
        alertas.push({
            tipo: 'danger',
            mensaje: `${vencidos.length} préstamo(s) vencido(s) requieren atención`
        });
    }
    
    if (alertas.length === 0) {
        alertasDiv.innerHTML = '<p class="text-muted text-center">No hay alertas</p>';
        return;
    }
    
    alertasDiv.innerHTML = alertas.map(a => `
        <div class="alert-item alert-${a.tipo}">
            <i class="fas fa-exclamation-triangle"></i> ${a.mensaje}
        </div>
    `).join('');
}

// ========== GESTIÓN DE USUARIOS ==========
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

formAgregarUsuario.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const password = document.getElementById('passwordNuevo').value;
    const confirmarPassword = document.getElementById('confirmarPassword').value;
    
    if (password !== confirmarPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }
    
    const nuevoUsuario = {
        id: Date.now(),
        nombre: document.getElementById('nombreCompleto').value,
        rut: document.getElementById('rut').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value,
        rol: document.getElementById('rolUsuarioNuevo').value,
        username: document.getElementById('username').value,
        password: password,
        activo: document.getElementById('usuarioActivo').checked,
        fechaCreacion: new Date().toISOString()
    };
    
    // Verificar si el usuario ya existe
    if (usuarios.some(u => u.username === nuevoUsuario.username)) {
        alert('El nombre de usuario ya existe');
        return;
    }
    
    usuarios.push(nuevoUsuario);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    
    alert('Usuario creado exitosamente');
    
    formAgregarUsuario.reset();
    formularioUsuario.style.display = 'none';
    btnMostrarFormulario.style.display = 'block';
    
    cargarUsuarios();
    cargarDashboard();
});

// ========== CARGAR USUARIOS EN TABLA ==========
function cargarUsuarios() {
    const tablaUsuarios = document.getElementById('tablaUsuarios');
    
    if (usuarios.length === 0) {
        tablaUsuarios.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">No hay usuarios registrados</td>
            </tr>
        `;
        return;
    }
    
    tablaUsuarios.innerHTML = usuarios.map((usuario, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${usuario.nombre}</td>
            <td>${usuario.username}</td>
            <td><span class="badge bg-primary">${usuario.rol}</span></td>
            <td>${usuario.email}</td>
            <td>
                <span class="badge ${usuario.activo ? 'bg-success' : 'bg-secondary'}">
                    ${usuario.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarUsuario(${usuario.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${usuario.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ========== ELIMINAR USUARIO ==========
function eliminarUsuario(id) {
    if (confirm('¿Está seguro de eliminar este usuario?')) {
        usuarios = usuarios.filter(u => u.id !== id);
        localStorage.setItem('usuarios', JSON.stringify(usuarios));
        cargarUsuarios();
        cargarDashboard();
        alert('Usuario eliminado exitosamente');
    }
}

// ========== CARGAR PRÉSTAMOS ==========
function cargarPrestamos() {
    const tablaPrestamos = document.getElementById('tablaPrestamos');
    
    if (prestamos.length === 0) {
        tablaPrestamos.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">No hay préstamos registrados</td>
            </tr>
        `;
        return;
    }
    
    tablaPrestamos.innerHTML = prestamos.map((prestamo, index) => {
        const estadoBadge = prestamo.estado === 'activo' ? 'bg-success' : 
                           prestamo.estado === 'devuelto' ? 'bg-secondary' : 'bg-danger';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${prestamo.alumno}</td>
                <td>${prestamo.material}</td>
                <td>${prestamo.cantidad}</td>
                <td>${formatearFecha(prestamo.fechaPrestamo)}</td>
                <td>${prestamo.fechaDevolucionReal || formatearFecha(prestamo.fechaDevolucion)}</td>
                <td><span class="badge ${estadoBadge}">${prestamo.estado}</span></td>
                <td>
                    ${prestamo.estado === 'activo' ? `
                        <button class="btn btn-sm btn-success" onclick="devolverPrestamo(${prestamo.id})">
                            <i class="fas fa-check"></i> Devolver
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// ========== DEVOLVER PRÉSTAMO ==========
function devolverPrestamo(id) {
    if (confirm('¿Confirmar devolución del material?')) {
        const prestamo = prestamos.find(p => p.id === id);
        if (prestamo) {
            prestamo.estado = 'devuelto';
            prestamo.fechaDevolucionReal = new Date().toLocaleString('es-CL');
            
            // Actualizar inventario
            const materialKey = prestamo.material.toLowerCase().replace(' ', '');
            if (inventario[materialKey]) {
                inventario[materialKey].disponibles += prestamo.cantidad;
                inventario[materialKey].prestadas = Math.max(0, inventario[materialKey].prestadas - prestamo.cantidad);
            }
            
            localStorage.setItem('prestamos', JSON.stringify(prestamos));
            localStorage.setItem('inventario', JSON.stringify(inventario));
            
            cargarPrestamos();
            actualizarInventario();
            cargarDashboard();
            
            alert('Material devuelto exitosamente');
        }
    }
}

// ========== ACTUALIZAR INVENTARIO ==========
function actualizarInventario() {
    // Actualizar tarjetas
    document.getElementById('tabletsDisponibles').textContent = inventario.tablets.disponibles;
    document.getElementById('tabletsPrestadas').textContent = inventario.tablets.prestadas;
    
    document.getElementById('notebooksDisponibles').textContent = inventario.notebooks.disponibles;
    document.getElementById('notebooksPrestadas').textContent = inventario.notebooks.prestadas;
    
    document.getElementById('librosDisponibles').textContent = inventario.libros.disponibles;
    document.getElementById('librosPrestados').textContent = inventario.libros.prestados;
    
    document.getElementById('deportivoDisponible').textContent = inventario.deportivo.disponibles;
    document.getElementById('deportivoPrestado').textContent = inventario.deportivo.prestado;
    
    // Actualizar barras de progreso
    const progressTablets = (inventario.tablets.disponibles / inventario.tablets.total) * 100;
    document.getElementById('progressTablets').style.width = progressTablets + '%';
    
    const progressNotebooks = (inventario.notebooks.disponibles / inventario.notebooks.total) * 100;
    document.getElementById('progressNotebooks').style.width = progressNotebooks + '%';
    
    const progressLibros = (inventario.libros.disponibles / inventario.libros.total) * 100;
    document.getElementById('progressLibros').style.width = progressLibros + '%';
    
    const progressDeportivo = (inventario.deportivo.disponibles / inventario.deportivo.total) * 100;
    document.getElementById('progressDeportivo').style.width = progressDeportivo + '%';
    
    // Actualizar tabla de detalle
    actualizarTablaInventario();
}

// ========== TABLA DE INVENTARIO DETALLE ==========
function actualizarTablaInventario() {
    const tabla = document.getElementById('tablaInventarioDetalle');
    
    const materiales = [
        { nombre: 'Tablets', data: inventario.tablets, key: 'prestadas' },
        { nombre: 'Notebooks', data: inventario.notebooks, key: 'prestadas' },
        { nombre: 'Libros', data: inventario.libros, key: 'prestados' },
        { nombre: 'Material Deportivo', data: inventario.deportivo, key: 'prestado' }
    ];
    
    tabla.innerHTML = materiales.map(m => {
        const enPrestamo = m.data[m.key];
        const utilizacion = ((enPrestamo / m.data.total) * 100).toFixed(1);
        const estadoClass = utilizacion > 70 ? 'text-danger' : utilizacion > 40 ? 'text-warning' : 'text-success';
        
        return `
            <tr>
                <td><strong>${m.nombre}</strong></td>
                <td>${m.data.total}</td>
                <td><span class="badge bg-success">${m.data.disponibles}</span></td>
                <td><span class="badge bg-warning">${enPrestamo}</span></td>
                <td><strong class="${estadoClass}">${utilizacion}%</strong></td>
                <td>
                    ${m.data.disponibles < 5 ? 
                        '<span class="badge bg-danger">Stock Crítico</span>' : 
                        '<span class="badge bg-success">Normal</span>'}
                </td>
            </tr>
        `;
    }).join('');
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

// ========== EXPORTAR REPORTES (SIMULADO) ==========
document.getElementById('exportarExcel')?.addEventListener('click', () => {
    alert('Funcionalidad de exportación a Excel en desarrollo');
});

document.getElementById('exportarPDF')?.addEventListener('click', () => {
    alert('Funcionalidad de exportación a PDF en desarrollo');
});

document.getElementById('imprimirReporte')?.addEventListener('click', () => {
    window.print();
});