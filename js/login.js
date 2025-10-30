// login.js - VERSIÓN ACTUALIZADA

// Usuarios de prueba predefinidos (solo para demo)
const usuariosPredefinidos = {
    'admin': {
        password: 'admin123',
        rol: 'Administrador',
        nombre: 'Pedro Fernández',
        redirect: 'pages/dashboard-admin.html'
    }
};

// Obtener elementos del DOM
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');

// Manejar el envío del formulario
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    // Primero buscar en usuarios predefinidos
    if (usuariosPredefinidos[username] && usuariosPredefinidos[username].password === password) {
        realizarLogin(
            username, 
            usuariosPredefinidos[username].rol, 
            usuariosPredefinidos[username].nombre,
            usuariosPredefinidos[username].redirect
        );
        return;
    }
    
    // Buscar en usuarios creados desde el dashboard
    const usuariosCreados = JSON.parse(localStorage.getItem('usuarios')) || [];
    const usuarioEncontrado = usuariosCreados.find(u => 
        u.username === username && 
        u.password === password && 
        u.activo === true
    );
    
    if (usuarioEncontrado) {
        // Determinar redirect según el rol
        let redirect = 'pages/dashboard-encargado.html';
        if (usuarioEncontrado.rol === 'Administrador') {
            redirect = 'pages/dashboard-admin.html';
        }
        
        realizarLogin(
            username,
            usuarioEncontrado.rol,
            usuarioEncontrado.nombre,
            redirect
        );
        return;
    }
    
    // Login fallido
    errorMessage.classList.remove('d-none');
    passwordInput.value = '';
    passwordInput.focus();
    
    // Agregar animación de sacudida
    loginForm.classList.add('shake');
    setTimeout(() => {
        loginForm.classList.remove('shake');
    }, 500);
});

// Función para realizar el login
function realizarLogin(username, rol, nombre, redirect) {
    errorMessage.classList.add('d-none');
    
    // Guardar información de sesión
    sessionStorage.setItem('usuarioActual', username);
    sessionStorage.setItem('rolUsuario', rol);
    sessionStorage.setItem('nombreUsuario', nombre);
    
    // Mostrar mensaje de éxito
    mostrarExito();
    
    // Redirigir según el rol
    setTimeout(() => {
        window.location.href = redirect;
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

// Verificar si ya hay sesión activa
window.addEventListener('load', () => {
    if (sessionStorage.getItem('usuarioActual')) {
        const usuario = sessionStorage.getItem('usuarioActual');
        const rol = sessionStorage.getItem('rolUsuario');
        
        // Redirigir según el rol
        if (rol === 'Administrador') {
            window.location.href = 'pages/dashboard-admin.html';
        } else {
            window.location.href = 'pages/dashboard-encargado.html';
        }
    }
});