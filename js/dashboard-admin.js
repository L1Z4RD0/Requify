// dashboard-admin.js - VERSIÓN CONECTADA A BASE DE DATOS

// ==========================================================
// DEFINIMOS LA URL DE NUESTRA API
// ==========================================================
const API_URL = 'http://localhost:3000/api';
let chartMateriales;
let chartActividad;
let datosReportes = { materiales: [], actividad: [], rangoMateriales: {}, rangoActividad: {} };

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
    cargarCategoriasInventario();
    cargarCategoriasFiltroPrestamos();
    cargarUbicaciones();
    cargarPrestamos();
    inicializarReportes();
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
            cargarCategoriasInventario();
        } else if (sectionId === 'usuarios') {
            cargarUsuarios();
        } else if (sectionId === 'prestamos') {
            cargarPrestamos();
            cargarCategoriasFiltroPrestamos();
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
        const mapaTarjetas = {
            'Tablets': { total: 'cardTabletsTotal', disp: 'cardTabletsDisp', prest: 'cardTabletsPrest' },
            'Notebooks': { total: 'cardNotebooksTotal', disp: 'cardNotebooksDisp', prest: 'cardNotebooksPrest' },
            'Libros': { total: 'cardLibrosTotal', disp: 'cardLibrosDisp', prest: 'cardLibrosPrest' },
            'Material Deportivo': { total: 'cardDeportivoTotal', disp: 'cardDeportivoDisp', prest: 'cardDeportivoPrest' }
        };

        stats.principales.forEach(cat => {
            const refs = mapaTarjetas[cat.nombre];
            if (!refs) { return; }
            document.getElementById(refs.total).textContent = cat.total;
            document.getElementById(refs.disp).textContent = cat.disponibles;
            document.getElementById(refs.prest).textContent = cat.prestados;
        });

        const tablaOtras = document.getElementById('tablaOtrasCategorias');
        if (stats.otrasCategorias.length === 0) {
            tablaOtras.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin categorías adicionales</td></tr>';
        } else {
            tablaOtras.innerHTML = stats.otrasCategorias.map(cat => `
                <tr>
                    <td>${cat.nombre}</td>
                    <td>${cat.total}</td>
                    <td>${cat.disponibles}</td>
                    <td>${cat.prestados}</td>
                </tr>
            `).join('');
        }

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

async function cargarCategoriasFiltroPrestamos() {
    const select = document.getElementById('filtroMaterial');
    if (!select) return;
    try {
        const response = await fetch(`${API_URL}/categorias`);
        if (!response.ok) throw new Error('No se pudieron cargar las categorías');
        const categorias = await response.json();
        select.innerHTML = '<option value="">Todos los materiales</option>';
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.CODIGO_BASE;
            option.textContent = cat.NOMBRE_TIPO_MATERIAL;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando categorías para filtro de préstamos:', error);
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
const formNuevaCategoria = document.getElementById('formNuevaCategoria');
const formNuevoMaterial = document.getElementById('formNuevoMaterial');

btnMostrarFormulario.addEventListener('click', () => {
    formularioUsuario.style.display = 'block';
    btnMostrarFormulario.style.display = 'none';
});

btnCancelarFormulario.addEventListener('click', () => {
    formularioUsuario.style.display = 'none';
    btnMostrarFormulario.style.display = 'block';
    formAgregarUsuario.reset();
});

if (formNuevaCategoria) {
    formNuevaCategoria.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            nombre: document.getElementById('nombreCategoria').value,
            max_dias: document.getElementById('maxDiasCategoria').value,
        };
        try {
            const response = await fetch(`${API_URL}/categorias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al crear categoría');
            alert(`Categoría ${data.codigo_base} creada correctamente`);
            formNuevaCategoria.reset();
            document.getElementById('maxDiasCategoria').value = 7;
            cargarCategoriasInventario();
        } catch (error) {
            console.error('Error al crear categoría:', error);
            alert(`Error: ${error.message}`);
        }
    });
}

if (formNuevoMaterial) {
    formNuevoMaterial.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            id_categoria: document.getElementById('categoriaMaterialSelect').value,
            nombre: document.getElementById('nombreMaterial').value,
            descripcion: document.getElementById('descripcionMaterial').value,
            cantidad_total: document.getElementById('cantidadMaterial').value,
            ubicacion: document.getElementById('ubicacionMaterial').value,
        };
        if (!payload.id_categoria) {
            alert('Seleccione una categoría válida.');
            return;
        }
        if (!payload.ubicacion) {
            alert('Seleccione una ubicación válida.');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/materiales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al crear el material');
            alert(`Material ${data.codigo} creado correctamente`);
            formNuevoMaterial.reset();
            document.getElementById('cantidadMaterial').value = 1;
            actualizarInventario();
            cargarCategoriasInventario();
        } catch (error) {
            console.error('Error al crear material:', error);
            alert(`Error: ${error.message}`);
        }
    });
}

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
                    <button class="btn btn-sm ${usuario.ESTADO ? 'btn-danger' : 'btn-success'}" onclick="cambiarEstadoUsuario(${usuario.ID_USUARIO}, ${usuario.ESTADO ? 0 : 1})">
                        <i class="fas ${usuario.ESTADO ? 'fa-ban' : 'fa-undo'}"></i>
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
async function cambiarEstadoUsuario(id, nuevoEstado) {
    if (id === 1) {
        alert('No se puede desactivar al usuario Administrador principal.');
        return;
    }

    const accion = nuevoEstado === 1 ? 'reactivar' : 'desactivar';
    if (confirm(`¿Desea ${accion} este usuario?`)) {
        try {
            const response = await fetch(`${API_URL}/usuarios/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'No se pudo actualizar el estado');
            alert(`Usuario ${accion}do correctamente`);
            cargarUsuarios();
        } catch (error) {
            console.error('Error al actualizar estado del usuario:', error);
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
    const search = document.getElementById('buscarPrestamo')?.value || '';
    const estado = document.getElementById('filtroEstado')?.value || '';
    const categoria = document.getElementById('filtroMaterial')?.value || '';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (estado) params.append('estado', estado);
    if (categoria) params.append('categoria', categoria);
    try {
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`${API_URL}/prestamos${query}`); // Llama al endpoint que acabamos de mejorar
        if (!response.ok) throw new Error('No se pudieron cargar los préstamos');

        const prestamos = await response.json();

        if (prestamos.length === 0) {
            tablaPrestamos.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No hay préstamos registrados</td></tr>`;
            return;
        }

        tablaPrestamos.innerHTML = prestamos.map((p, index) => {
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
                    <td>${p.ID_SOLICITUD}</td>
                    <td>${p.ALUMNO_NOMBRE} ${p.ALUMNO_APELLIDO}</td>
                    <td>${p.MATERIAL_NOMBRE}</td>
                    <td><span class="badge bg-info text-dark">${p.CODIGO_ITEM}</span></td>
                    <td>${formatearFecha(p.FECHA_SOLICITUD)}</td>
                    <td>${formatearFecha(p.FECHA_DEVOLUCION)}</td>
                    <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                    <td>
                        ${p.ESTADO === 1 ? `<button class="btn btn-sm btn-success" onclick="adminDevolver(${p.ID_SOLICITUD})">Devolver</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando préstamos:', error);
        tablaPrestamos.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error al cargar préstamos.</td></tr>`;
    }
}

const btnBuscarPrestamos = document.getElementById('btnBuscarPrestamos');
if (btnBuscarPrestamos) {
    btnBuscarPrestamos.addEventListener('click', (e) => {
        e.preventDefault();
        cargarPrestamos();
    });
}

// ¡AÑADE ESTA FUNCIÓN AL FINAL DEL ARCHIVO!
// (La necesitamos para el botón de devolver que acabamos de agregar)
function adminDevolver(id) {
    alert(`¡Función DEVOLVER (Admin) aún no conectada! Se devolvería el préstamo ID: ${id}`);
    // La lógica sería idéntica a la del Encargado:
    // 1. Abrir un modal
    // 2. Llamar a un endpoint /api/prestamos/devolver/:id
    // 3. Recargar la tabla
}

// ==========================================================
// REPORTES Y GRÁFICOS
// ==========================================================
function inicializarReportes() {
    const rangoMateriales = document.getElementById('rangoMateriales');
    const rangoActividad = document.getElementById('rangoActividad');
    const exportarExcel = document.getElementById('exportarExcel');
    const exportarPDF = document.getElementById('exportarPDF');
    const imprimirReporte = document.getElementById('imprimirReporte');

    if (rangoMateriales) {
        rangoMateriales.addEventListener('change', () => toggleRangoFechas('material'));
        document.getElementById('aplicarMateriales')?.addEventListener('click', () => cargarReporteMateriales(obtenerParametrosRango('material')));
    }
    if (rangoActividad) {
        rangoActividad.addEventListener('change', () => toggleRangoFechas('actividad'));
        document.getElementById('aplicarActividad')?.addEventListener('click', () => cargarReporteActividad(obtenerParametrosRango('actividad')));
    }

    exportarExcel?.addEventListener('click', exportarReporteExcel);
    exportarPDF?.addEventListener('click', exportarReportePDF);
    imprimirReporte?.addEventListener('click', imprimirReportes);

    cargarReporteMateriales({ meses: 6 });
    cargarReporteActividad({ meses: 12 });
}

function toggleRangoFechas(tipo) {
    const select = document.getElementById(`rango${tipo === 'material' ? 'Materiales' : 'Actividad'}`);
    const contenedor = document.getElementById(`rango${tipo === 'material' ? 'Materiales' : 'Actividad'}Fechas`);
    if (!select || !contenedor) return;
    contenedor.style.display = select.value === 'custom' ? 'flex' : 'none';
    const params = obtenerParametrosRango(tipo);
    if (select.value !== 'custom') {
        if (tipo === 'material') {
            cargarReporteMateriales(params);
        } else {
            cargarReporteActividad(params);
        }
    }
}

function obtenerParametrosRango(tipo) {
    const baseId = tipo === 'material' ? 'Materiales' : 'Actividad';
    const select = document.getElementById(`rango${baseId}`);
    const desde = document.getElementById(`${tipo}Desde`)?.value;
    const hasta = document.getElementById(`${tipo}Hasta`)?.value;
    if (select?.value === 'custom' && desde && hasta) {
        return { from: desde, to: hasta };
    }
    const meses = parseInt(select?.value || '0', 10);
    return { meses: meses > 0 ? meses : undefined };
}

async function cargarReporteMateriales(parametros = {}) {
    const query = new URLSearchParams();
    if (parametros.from) { query.append('from', parametros.from); }
    if (parametros.to) { query.append('to', parametros.to); }
    if (parametros.meses) { query.append('meses', parametros.meses); }

    try {
        const response = await fetch(`${API_URL}/reportes/prestamos-por-material?${query.toString()}`);
        if (!response.ok) throw new Error('No se pudo cargar el reporte de materiales');
        const data = await response.json();
        datosReportes.materiales = data.datos || [];
        datosReportes.rangoMateriales = data.rango;
        renderChartMateriales();
    } catch (error) {
        console.error('Error cargando reporte de materiales:', error);
    }
}

async function cargarReporteActividad(parametros = {}) {
    const query = new URLSearchParams();
    if (parametros.from) { query.append('from', parametros.from); }
    if (parametros.to) { query.append('to', parametros.to); }
    if (parametros.meses) { query.append('meses', parametros.meses); }

    try {
        const response = await fetch(`${API_URL}/reportes/actividad?${query.toString()}`);
        if (!response.ok) throw new Error('No se pudo cargar el reporte de actividad');
        const data = await response.json();
        datosReportes.actividad = data.datos || [];
        datosReportes.rangoActividad = data.rango;
        renderChartActividad();
    } catch (error) {
        console.error('Error cargando actividad:', error);
    }
}

function renderChartMateriales() {
    const ctx = document.getElementById('chartMateriales');
    if (!ctx) return;
    const labels = datosReportes.materiales.map(d => d.categoria);
    const valores = datosReportes.materiales.map(d => d.total);

    if (chartMateriales) chartMateriales.destroy();
    chartMateriales = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Préstamos',
                data: valores,
                backgroundColor: '#0d6efd'
            }]
        },
        options: { responsive: true }
    });
}

function renderChartActividad() {
    const ctx = document.getElementById('chartActividad');
    if (!ctx) return;
    const labels = datosReportes.actividad.map(d => formatearMes(d.mes));
    const valores = datosReportes.actividad.map(d => d.total);

    if (chartActividad) chartActividad.destroy();
    chartActividad = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Préstamos',
                data: valores,
                borderColor: '#198754',
                fill: false
            }]
        },
        options: { responsive: true }
    });
}

function formatearMes(isoDate) {
    if (!isoDate) return '';
    const fecha = new Date(isoDate);
    return fecha.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
}

function exportarReporteExcel() {
    if (!window.XLSX) { alert('Biblioteca XLSX no disponible'); return; }
    const wb = XLSX.utils.book_new();
    const sheetMateriales = XLSX.utils.json_to_sheet(datosReportes.materiales.map(d => ({
        Categoria: d.categoria,
        Prestamos: d.total
    })));
    const sheetActividad = XLSX.utils.json_to_sheet(datosReportes.actividad.map(d => ({
        Mes: formatearMes(d.mes),
        Prestamos: d.total
    })));
    XLSX.utils.book_append_sheet(wb, sheetMateriales, 'Prestamos por material');
    XLSX.utils.book_append_sheet(wb, sheetActividad, 'Actividad mensual');
    XLSX.writeFile(wb, 'reportes-requify.xlsx');
}

function exportarReportePDF() {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) { alert('Biblioteca jsPDF no disponible'); return; }
    const doc = new jsPDF();
    doc.text('Reporte de préstamos por material', 10, 10);
    datosReportes.materiales.forEach((d, idx) => {
        doc.text(`${d.categoria}: ${d.total}`, 10, 20 + idx * 8);
    });
    let offset = 30 + datosReportes.materiales.length * 8;
    doc.text('Actividad mensual', 10, offset);
    datosReportes.actividad.forEach((d, idx) => {
        doc.text(`${formatearMes(d.mes)}: ${d.total}`, 10, offset + 10 + idx * 8);
    });
    doc.save('reportes-requify.pdf');
}

function imprimirReportes() {
    const ventana = window.open('', '_blank');
    const materialesRows = datosReportes.materiales.map(d => `<tr><td>${d.categoria}</td><td>${d.total}</td></tr>`).join('');
    const actividadRows = datosReportes.actividad.map(d => `<tr><td>${formatearMes(d.mes)}</td><td>${d.total}</td></tr>`).join('');
    ventana.document.write(`
        <html><head><title>Reportes</title></head><body>
        <h3>Préstamos por material</h3>
        <table border="1" cellspacing="0" cellpadding="6">
            <tr><th>Material</th><th>Préstamos</th></tr>
            ${materialesRows}
        </table>
        <h3>Actividad mensual</h3>
        <table border="1" cellspacing="0" cellpadding="6">
            <tr><th>Mes</th><th>Préstamos</th></tr>
            ${actividadRows}
        </table>
        </body></html>
    `);
    ventana.document.close();
    ventana.print();
}


// ==========================================================
// GESTIÓN DE INVENTARIO (Conectada)
// ==========================================================
// ==========================================================
// GESTIÓN DE INVENTARIO (¡VERSIÓN CORREGIDA!)
// ==========================================================
async function actualizarInventario() {
    // 1. OBTENER LOS DATOS MÁS RECIENTES DE LA API
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
        return;
    }

    // 2. ACTUALIZAR LAS TARJETAS (¡LA PARTE QUE FALTABA!)
    inventario.forEach(item => {
        let idDisp, idPrest, idProg;
        // Buscamos los IDs correspondientes del HTML del Admin
        if (item.nombre.includes('Tablet')) { idDisp = 'tabletsDisponibles'; idPrest = 'tabletsPrestadas'; idProg = 'progressTablets'; }
        else if (item.nombre.includes('Notebook')) { idDisp = 'notebooksDisponibles'; idPrest = 'notebooksPrestadas'; idProg = 'progressNotebooks'; }
        else if (item.nombre.includes('Libro')) { idDisp = 'librosDisponibles'; idPrest = 'librosPrestados'; idProg = 'progressLibros'; }
        else if (item.nombre.includes('Deportivo')) { idDisp = 'deportivoDisponible'; idPrest = 'deportivoPrestado'; idProg = 'progressDeportivo'; }

        if (idDisp) {
            const prestados = item.total - item.disponibles;
            const progreso = (item.total > 0) ? (item.disponibles / item.total) * 100 : 0;
            
            document.getElementById(idDisp).textContent = item.disponibles;
            document.getElementById(idPrest).textContent = prestados;
            document.getElementById(idProg).style.width = progreso + '%';
        }
    });

    // 3. ACTUALIZAR LA TABLA (Esta parte ya la teníamos)
    const tablaInventario = document.getElementById('tablaInventarioDetalle');
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
}

async function cargarCategoriasInventario() {
    const tablaCategorias = document.getElementById('tablaCategorias');
    const selectCategorias = document.getElementById('categoriaMaterialSelect');
    if (!tablaCategorias || !selectCategorias) { return; }
    try {
        const response = await fetch(`${API_URL}/categorias`);
        if (!response.ok) throw new Error('No se pudieron cargar las categorías');
        const categorias = await response.json();

        if (categorias.length === 0) {
            tablaCategorias.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay categorías registradas</td></tr>`;
        } else {
            tablaCategorias.innerHTML = categorias.map((cat) => `
                <tr>
                    <td>${cat.NOMBRE_TIPO_MATERIAL}</td>
                    <td><span class="badge bg-primary">${cat.CODIGO_BASE}</span></td>
                    <td>${cat.MAX_DIAS_PRESTAMO} días</td>
                    <td>${String(cat.CONSECUTIVO_ACTUAL).padStart(3, '0')}</td>
                    <td>${cat.TOTAL_MATERIALES}</td>
                    <td>${cat.TOTAL_ITEMS}</td>
                    <td>${cat.ITEMS_DISPONIBLES}</td>
                </tr>
            `).join('');
        }

        selectCategorias.innerHTML = '<option value="">-- Seleccione categoría --</option>';
        categorias.forEach((cat) => {
            selectCategorias.innerHTML += `<option value="${cat.ID_TIPO_MATERIAL}">${cat.NOMBRE_TIPO_MATERIAL} (${cat.CODIGO_BASE})</option>`;
        });
    } catch (error) {
        console.error('Error cargando categorías:', error);
        tablaCategorias.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar categorías.</td></tr>`;
        selectCategorias.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function cargarUbicaciones() {
    const selectUbicaciones = document.getElementById('ubicacionMaterial');
    if (!selectUbicaciones) { return; }
    try {
        const response = await fetch(`${API_URL}/ubicaciones`);
        if (!response.ok) throw new Error('No se pudieron cargar las ubicaciones');
        const ubicaciones = await response.json();
        selectUbicaciones.innerHTML = '<option value="">-- Seleccione ubicación --</option>';
        ubicaciones.forEach((ubi) => {
            selectUbicaciones.innerHTML += `<option value="${ubi.NOMBRE}">${ubi.NOMBRE}</option>`;
        });
    } catch (error) {
        console.error('Error cargando ubicaciones:', error);
        selectUbicaciones.innerHTML = '<option value="">Error al cargar ubicaciones</option>';
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