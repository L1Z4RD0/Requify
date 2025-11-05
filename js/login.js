// login.js - VERSIÓN ACTUALIZADA CON BASE DE DATOS

// ¡YA NO NECESITAMOS USUARIOS DE PRUEBA!
// Los 'usuariosPredefinidos' se eliminan.
// Los 'usuariosCreados' de localStorage se eliminan.

// Obtener elementos del DOM (Esto sigue igual)
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');

// Manejar el envío del formulario
// ¡Convertimos la función en "async" para poder usar "await"!
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    // Ocultar error previo
    errorMessage.classList.add('d-none');

    try {
        // ==========================================================
        // ESTA ES LA MAGIA (REEMPLAZO DEL LOCALSTORAGE)
        // 1. Llamamos a nuestro backend (el server.js en localhost:3000)
        // ==========================================================
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: username, 
                password: password 
            })
        });

        // 2. Obtenemos la respuesta que el backend nos dio
        const data = await response.json();

        // 3. Comprobamos si la respuesta fue exitosa (status 200)
        if (response.ok) {
            // ¡ÉXITO! El backend nos dio luz verde.
            // Usamos la MISMA función que ya tenías para guardar en sessionStorage
            realizarLogin(data);
            return;
            
        } else {
            // FALLO. El backend nos dijo que el usuario no existe (status 401)
            errorMessage.textContent = data.message; // "Usuario o contraseña incorrectos"
            errorMessage.classList.remove('d-none');
        }

    } catch (error) {
        // ERROR DE CONEXIÓN. (Ej: El server.js no está corriendo)
        console.error('Error de conexión:', error);
        errorMessage.textContent = 'No se pudo conectar al servidor. Revisa la terminal.';
        errorMessage.classList.remove('d-none');
    }

    // Si llegamos aquí, el login falló
    passwordInput.value = '';
    passwordInput.focus();
    
    // Agregar animación de sacudida (esto sigue igual)
    loginForm.classList.add('shake');
    setTimeout(() => {
        loginForm.classList.remove('shake');
    }, 500);
});

// ==========================================================
// ESTAS FUNCIONES NO CAMBIAN NADA. ¡YA ESTABAN PERFECTAS!
// ==========================================================

// Función para realizar el login
function realizarLogin(data) { // <-- Cambiado
    errorMessage.classList.add('d-none');
    
    // Guardar información de sesión
    sessionStorage.setItem('usuarioActual', data.username); // <-- Cambiado
    sessionStorage.setItem('rolUsuario', data.rol);       // <-- Cambiado
    sessionStorage.setItem('nombreUsuario', data.nombre);   // <-- Cambiado
    sessionStorage.setItem('usuarioId', data.id);         // <-- ¡LA LÍNEA CLAVE AÑADIDA!
    
    // Mostrar mensaje de éxito
    mostrarExito();
    
    // Redirigir según el rol
    setTimeout(() => {
        window.location.href = data.redirect; // <-- Cambiado
    }, 1000);
}

// Función para mostrar mensaje de éxito
function mostrarExito() {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.innerHTML = '<i class="fas fa-check-circle"></i> Iniciando sesión...';
    
    errorMessage.parentNode.insertBefore(successDiv, errorMessage);
    
    setTimeout(() => {
        successDiv.remove();
    }, 900);
}

// Agregar animación de sacudida al CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
    .shake {
        animation: shake 0.5s;
    }
`;
document.head.appendChild(style);

// Verificar si ya hay sesión activa (Esto no cambia)
window.addEventListener('load', () => {
    if (sessionStorage.getItem('usuarioActual')) {
        const usuario = sessionStorage.getItem('usuarioActual');
        const rol = sessionStorage.getItem('rolUsuario');
        
        // Redirigir según el rol
        if (rol === 'Administrador') {
            window.location.href = 'pages/dashboard-admin.html';
        } else {
            // Ajusta esto si tienes más roles
            window.location.href = 'pages/dashboard-encargado.html';
        }
    }
});