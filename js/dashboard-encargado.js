// dashboard-encargado.js - VERSIÓN CONECTADA A BASE DE DATOS

// ==========================================================
// DEFINIMOS LA URL DE NUESTRA API Y DATOS DE SESIÓN
// ==========================================================
const API_URL = 'http://localhost:3000/api';
let usuarioLogueado = {}; // Guardaremos info del usuario aquí

// ==========================================================
// VERIFICACIÓN DE SESIÓN (MODIFICADA)
// ==========================================================
window.addEventListener('load', () => {
    // Guardar info del usuario actual de sessionStorage
    usuarioLogueado = {
        username: sessionStorage.getItem('usuarioActual'),
        nombre: sessionStorage.getItem('nombreUsuario'),
        rol: sessionStorage.getItem('rolUsuario'),
        id: sessionStorage.getItem('usuarioId') // ¡Importante! Lo necesitaremos
    };
    
    if (!usuarioLogueado.username) {
        window.location.href = '../index.html';
        return;
    }
    
    // Mostrar información del usuario
    document.getElementById('nombreUsuario').textContent = usuarioLogueado.nombre;
    document.getElementById('rolUsuario').textContent = usuarioLogueado.rol;
    
    // Funciones iniciales
    actualizarFecha();
    configurarFechasPorDefecto();
    
    // ¡Cargar datos desde la API!
    cargarDashboardStats();
    cargarTablaPendientes();
    actualizarInventarioDisplay();
    
    // Llenar los <select> del formulario
    cargarAlumnosSelect();
    cargarMaterialesSelect();
});

// ==========================================================
// NAVEGACIÓN Y UI (Sin cambios grandes)
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
        
        // ... (resto de la lógica de títulos) ...
        // ... (cargas de datos por sección) ...
    });
});

// ... (Toggle Sidebar, Cerrar Sesión, Actualizar Fecha - Sin cambios) ...
// (Pega aquí el código de esas funciones de tu archivo original si se borraron)

// ==========================================================
// CARGA DE DATOS (NUEVAS FUNCIONES CON FETCH)
// ==========================================================

// --- Llenar <select> de Alumnos ---
async function cargarAlumnosSelect() {
    const select = document.getElementById('alumnoSelect');
    try {
        const response = await fetch(`${API_URL}/alumnos`);
        const alumnos = await response.json();
        
        select.innerHTML = '<option value="">-- Seleccione un alumno --</option>'; // Limpiar
        alumnos.forEach(alumno => {
            select.innerHTML += `
                <option value="${alumno.ID_ALUMNO}">
                    ${alumno.NOMBRE} ${alumno.APELLIDO} (${alumno.RUT} - ${alumno.CURSO})
                </option>
            `;
        });
    } catch (error) {
        console.error('Error cargando alumnos:', error);
        select.innerHTML = '<option value="">Error al cargar alumnos</option>';
    }
}

// --- Llenar <select> de Materiales ---
async function cargarMaterialesSelect() {
    const select = document.getElementById('materialSelect');
    try {
        const response = await fetch(`${API_URL}/materiales`);
        const materiales = await response.json();
        
        select.innerHTML = '<option value="">-- Seleccione material --</option>';
        materiales.forEach(mat => {
            select.innerHTML += `
                <option value="${mat.ID_MATERIAL}" data-disponibles="${mat.CANTIDAD_DISPONIBLE}">
                    ${mat.NOMBRE_TIPO_MATERIAL} - ${mat.NOMBRE} (Disp: ${mat.CANTIDAD_DISPONIBLE})
                </option>
            `;
        });
    } catch (error) {
        console.error('Error cargando materiales:', error);
        select.innerHTML = '<option value="">Error al cargar materiales</option>';
    }
}

// --- Actualizar "Disponibles" al cambiar material ---
document.getElementById('materialSelect').addEventListener('change', (e) => {
    const opcionSeleccionada = e.target.selectedOptions[0];
    const disponibles = opcionSeleccionada.getAttribute('data-disponibles') || '-';
    document.getElementById('disponiblesInfo').textContent = disponibles;
    // Poner el input de cantidad max=disponibles
    document.getElementById('cantidadPrestamo').max = disponibles;
});


// ==========================================================
// FORMULARIO NUEVO PRÉSTAMO (¡CONECTADO!)
// ==========================================================
const formNuevoPrestamo = document.getElementById('formNuevoPrestamo');

formNuevoPrestamo.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Recolectar datos del formulario
    const prestamo = {
        id_alumno: document.getElementById('alumnoSelect').value,
        id_material: document.getElementById('materialSelect').value,
        cantidad: parseInt(document.getElementById('cantidadPrestamo').value),
        fecha_prestamo: document.getElementById('fechaPrestamo').value,
        fecha_devolucion: document.getElementById('fechaDevolucion').value,
        responsable: document.getElementById('responsableSelect').value,
        observaciones: document.getElementById('observaciones').value,
        id_usuario: usuarioLogueado.id // ¡El ID del Encargado!
    };

    // Validar cantidad
    const maxDisponible = document.getElementById('materialSelect').selectedOptions[0].getAttribute('data-disponibles');
    if (prestamo.cantidad > parseInt(maxDisponible)) {
        alert(`Error: No puedes prestar ${prestamo.cantidad}. Solo hay ${maxDisponible} disponibles.`);
        return;
    }

    try {
        // Enviar a la API
        const response = await fetch(`${API_URL}/prestamos/crear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prestamo)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al registrar el préstamo');
        }

        // ¡Éxito!
        alert('✅ ¡Préstamo registrado exitosamente!');
        formNuevoPrestamo.reset();
        configurarFechasPorDefecto();
        
        // Recargar todo
        cargarMaterialesSelect();
        // ... recargar otras stats ...

    } catch (error) {
        console.error('Error al crear préstamo:', error);
        alert(`Error: ${error.message}`);
    }
});


// ==========================================================
// PENDIENTE DE CONECTAR:
// - cargarDashboardStats()
// - cargarTablaPendientes()
// - actualizarInventarioDisplay()
// - Lógica de Devolución
// ==========================================================

// (El resto de tus funciones (manejo de UI, fechas) puedes mantenerlas)
// (Ej: configurarFechasPorDefecto, actualizarFecha, etc.)