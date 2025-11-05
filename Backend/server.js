// ==========================================================
// 1. IMPORTAR LAS "HERRAMIENTAS" QUE INSTALAMOS (npm install)
// ==========================================================
const express = require('express'); // El "cerebro" para crear la API
const mysql = require('mysql2');    // El "traductor" para hablar con MySQL
const cors = require('cors');       // El "portero" que da permiso al frontend

// ==========================================================
// 2. CONFIGURACIÓN INICIAL
// ==========================================================
const app = express();
app.use(cors()); // Permite que tu frontend (en Live Server) se conecte
app.use(express.json()); // Permite a la API entender datos JSON

// ==========================================================
// 3. CONEXIÓN A TU BASE DE DATOS 
// ==========================================================
const db = mysql.createConnection({
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: 'BB21JhonWick', 
    database: 'Requify_Demo',
    multipleStatements: true
});

// Intentamos conectarnos
db.connect(err => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err);
        return;
    }
    console.log('¡Conectado exitosamente a la base de datos Requify_Demo!');
});

// ==========================================================
// 4. CREAR NUESTRAS "URLS" (Endpoints)
// ==========================================================

// --- ENDPOINT PARA EL LOGIN ---
// Cuando tu frontend llame a 'http://localhost:3000/login'
app.post('/login', (req, res) => {
    // Recibe el 'username' y 'password' que envió el frontend
    const { username, password } = req.body;

    // Prepara la consulta SQL para buscar al usuario
    // (Usamos los campos que "parchamos" en el paso anterior)
    const sql = `
        SELECT U.ID_USUARIO, U.USERNAME, U.NOMBRE, R.NOMBRE_ROL 
        FROM USUARIOS U 
        JOIN ROLES R ON U.ID_ROL = R.ID_ROL 
        WHERE U.USERNAME = ? AND U.PASSWORD = ? AND U.ESTADO = 1
    `;
    
    // NOTA DE SEGURIDAD: En un proyecto 100% real, las contraseñas
    // NUNCA se guardan en texto plano. Se usa algo llamado "bcrypt".
    // Para tu proyecto de clases, esto está perfecto.

    // Ejecuta la consulta en la base de datos
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            // Si la base de datos da un error
            console.error(err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }

        if (results.length > 0) {
            // ¡ÉXITO! Encontramos al usuario
            const user = results[0];
            
            // Determinamos a qué página redirigirlo
            const redirect = user.NOMBRE_ROL === 'Administrador' 
                ? 'pages/dashboard-admin.html' 
                : 'pages/dashboard-encargado.html';

            res.json({
                success: true,
                id: user.ID_USUARIO, 
                username: user.USERNAME,
                nombre: user.NOMBRE,
                rol: user.NOMBRE_ROL,
                redirect: redirect
            });

        } else {
            // FALLO. No se encontró el usuario o la clave es incorrecta
            res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }
    });
});

// --- ENDPOINT PARA LA LISTA DE USUARIOS (DEL ADMIN) ---
// Cuando el admin cargue su página, llamará a 'http://localhost:3000/api/usuarios'
app.get('/api/usuarios', (req, res) => {
    
    const sql = `
        SELECT U.ID_USUARIO, U.NOMBRE, U.APELLIDO, U.USERNAME, U.EMAIL, R.NOMBRE_ROL, U.ESTADO 
        FROM USUARIOS U 
        JOIN ROLES R ON U.ID_ROL = R.ID_ROL
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }
        // Le enviamos al frontend la lista completa de usuarios
        res.json(results);
    });
});


// ==========================================================
// NUEVOS ENDPOINTS PARA EL DASHBOARD DE ADMIN
// ==========================================================

// --- ENDPOINT PARA CREAR USUARIO (del formulario) ---
app.post('/api/usuarios/crear', (req, res) => {
    // Recibe los datos del formulario desde el frontend
    const { nombre, rut, email, telefono, rol, username, password, activo } = req.body;

    // Busca el ID_ROL basado en el nombre del rol
    db.query('SELECT ID_ROL FROM ROLES WHERE NOMBRE_ROL = ?', [rol], (err, results) => {
        if (err || results.length === 0) {
            console.error(err);
            return res.status(500).json({ message: 'Error al buscar el rol' });
        }
        
        const idRol = results[0].ID_ROL;
        const estadoNum = activo ? 1 : 0;

        const sql = `
            INSERT INTO USUARIOS (ID_ROL, USERNAME, NOMBRE, EMAIL, PASSWORD, ESTADO, FECHA_ALTA, APELLIDO)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
        `;
        // Nota: APELLIDO no estaba en tu form, lo ponemos vacío o lo puedes añadir luego.
        db.query(sql, [idRol, username, nombre, email, password, estadoNum, ''], (err, result) => {
            if (err) {
                // Manejar error (ej. usuario duplicado)
                console.error(err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'El nombre de usuario ya existe' });
                }
                return res.status(500).json({ message: 'Error al crear el usuario' });
            }
            res.status(201).json({ success: true, message: 'Usuario creado exitosamente', id: result.insertId });
        });
    });
});

// --- ENDPOINT PARA ELIMINAR USUARIO (botón de la tabla) ---
app.delete('/api/usuarios/eliminar/:id', (req, res) => {
    const { id } = req.params; // Obtiene el ID de la URL (ej: /api/usuarios/eliminar/3)
    
    const sql = 'DELETE FROM USUARIOS WHERE ID_USUARIO = ?';
    
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al eliminar el usuario' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json({ success: true, message: 'Usuario eliminado exitosamente' });
    });
});

// --- ENDPOINT PARA OBTENER TODOS LOS PRÉSTAMOS (Pestaña "Préstamos") ---
// --- ENDPOINT PARA OBTENER TODOS LOS PRÉSTAMOS (PARA EL ADMIN) ---
app.get('/api/prestamos', (req, res) => {
    const sql = `
        SELECT 
            S.ID_SOLICITUD,
            A.NOMBRE as ALUMNO_NOMBRE,
            A.APELLIDO as ALUMNO_APELLIDO,
            M.NOMBRE as MATERIAL_NOMBRE,
            T.NOMBRE_TIPO_MATERIAL,
            DS.CANTIDAD_ENTREGADA as CANTIDAD,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION,
            S.ESTADO,
            U.USERNAME as ENCARGADO_USERNAME
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN MATERIALES M ON DS.ID_MATERIAL = M.ID_MATERIAL
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        JOIN USUARIOS U ON S.ID_USUARIO = U.ID_USUARIO
        ORDER BY S.FECHA_SOLICITUD DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener préstamos' });
        }
        res.json(results);
    });
});

// --- ENDPOINT PARA LAS ESTADÍSTICAS (Las 4 tarjetas de arriba) ---
app.get('/api/dashboard/admin-stats', (req, res) => {
    const sql_usuarios = 'SELECT COUNT(*) as total FROM USUARIOS WHERE ESTADO = 1';
    const sql_activos = 'SELECT COUNT(*) as total FROM SOLICITUDES WHERE ESTADO = 1'; // 1 = Activo
    const sql_vencidos = 'SELECT COUNT(*) as total FROM SOLICITUDES WHERE ESTADO = 1 AND FECHA_DEVOLUCION < NOW()'; // 1 = Activo
    const sql_materiales = 'SELECT SUM(CANTIDAD_TOTAL) as total FROM MATERIALES';

    db.query(`${sql_usuarios}; ${sql_activos}; ${sql_vencidos}; ${sql_materiales}`, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al calcular estadísticas' });
        }
        res.json({
            totalUsuarios: results[0][0].total,
            prestamosActivos: results[1][0].total,
            prestamosVencidos: results[2][0].total,
            totalMateriales: results[3][0].total
        });
    });
});

// --- ENDPOINT PARA EL INVENTARIO ---
app.get('/api/inventario', (req, res) => {
    const sql = `
        SELECT 
            T.NOMBRE_TIPO_MATERIAL as nombre, 
            M.CANTIDAD_TOTAL as total, 
            M.CANTIDAD_DISPONIBLE as disponibles
        FROM MATERIALES M
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener inventario' });
        }
        res.json(results);
    });
});

// --- ENDPOINT PARA ALERTAS ---
app.get('/api/alertas', (req, res) => {
    const sql = `
        SELECT T.NOMBRE_TIPO_MATERIAL as nombre, M.CANTIDAD_DISPONIBLE as disponibles
        FROM MATERIALES M
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        WHERE M.CANTIDAD_DISPONIBLE < 5 -- Definimos "stock bajo" como < 5
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener alertas' });
        }
        res.json(results);
    });
});


// ==========================================================
// NUEVOS ENDPOINTS PARA EL DASHBOARD DE ENCARGADO
// ==========================================================

// --- ENDPOINT PARA LLENAR EL <select> DE ALUMNOS ---
app.get('/api/alumnos', (req, res) => {
    const sql = 'SELECT ID_ALUMNO, RUT, NOMBRE, APELLIDO, CURSO FROM ALUMNOS ORDER BY NOMBRE';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener alumnos' });
        }
        res.json(results);
    });
});

// --- ENDPOINT PARA LLENAR EL <select> DE MATERIALES ---
app.get('/api/materiales', (req, res) => {
    const sql = `
        SELECT M.ID_MATERIAL, M.NOMBRE, M.CANTIDAD_DISPONIBLE, T.NOMBRE_TIPO_MATERIAL
        FROM MATERIALES M
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        WHERE M.CANTIDAD_DISPONIBLE > 0 AND M.ESTADO = 1
        ORDER BY T.NOMBRE_TIPO_MATERIAL, M.NOMBRE
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener materiales' });
        }
        res.json(results);
    });
});

// --- ENDPOINT PARA CREAR UN NUEVO PRÉSTAMO (¡El más importante!) ---
app.post('/api/prestamos/crear', (req, res) => {
    // Obtenemos los datos del formulario (frontend)
    const {
        id_alumno,
        id_material,
        cantidad,
        id_usuario, // El ID del Encargado que está logueado
        fecha_prestamo,
        fecha_devolucion,
        responsable,
        observaciones
    } = req.body;

    // Usamos una TRANSACCIÓN para asegurar que todo salga bien, o nada
    db.beginTransaction(err => {
        if (err) { throw err; }

        // 1. Crear la SOLICITUD (el "préstamo")
        const sqlSolicitud = `
            INSERT INTO SOLICITUDES (ID_USUARIO, ID_ALUMNO, FECHA_SOLICITUD, ESTADO, RESPONSABLE, OBSERVACIONES, FECHA_DEVOLUCION)
            VALUES (?, ?, ?, 1, ?, ?, ?)
        `;
        db.query(sqlSolicitud, [id_usuario, id_alumno, fecha_prestamo, responsable, observaciones, fecha_devolucion], (err, result) => {
            if (err) {
                return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al crear la solicitud" }); });
            }
            
            const idSolicitud = result.insertId;

            // 2. Crear el DETALLE de la solicitud (qué material se prestó)
            const sqlDetalle = `
                INSERT INTO DETALLE_SOLICITUD (ID_MATERIAL, ID_SOLICITUD, CANTIDAD_SOLICITADA, CANTIDAD_ENTREGADA)
                VALUES (?, ?, ?, ?)
            `;
            // Asumimos que se entrega la misma cantidad que se solicita
            db.query(sqlDetalle, [id_material, idSolicitud, cantidad, cantidad], (err, result) => {
                if (err) {
                    return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al crear el detalle" }); });
                }

                // 3. ACTUALIZAR el inventario (restar la cantidad)
                const sqlUpdateInventario = `
                    UPDATE MATERIALES 
                    SET CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE - ? 
                    WHERE ID_MATERIAL = ?
                `;
                db.query(sqlUpdateInventario, [cantidad, id_material], (err, result) => {
                    if (err) {
                        return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar inventario" }); });
                    }

                    // 4. Si todo salió bien, CONFIRMAR la transacción
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al confirmar" }); });
                        }
                        res.status(201).json({ success: true, message: "¡Préstamo registrado exitosamente!" });
                    });
                });
            });
        });
    });
});


// ==========================================================
// ENDPOINT PARA PRÉSTAMOS ACTIVOS (MEJORADO)
// ==========================================================
app.get('/api/prestamos/activos/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;

    const sql = `
        SELECT 
            S.ID_SOLICITUD,
            DS.ID_DETALLE,    /* <-- AÑADIDO */
            M.ID_MATERIAL,    /* <-- AÑADIDO */
            A.NOMBRE as ALUMNO_NOMBRE,
            A.APELLIDO as ALUMNO_APELLIDO,
            A.CURSO,
            M.NOMBRE as MATERIAL_NOMBRE,
            T.NOMBRE_TIPO_MATERIAL,
            DS.CANTIDAD_ENTREGADA as CANTIDAD,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN MATERIALES M ON DS.ID_MATERIAL = M.ID_MATERIAL
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        WHERE S.ESTADO = 1 AND S.ID_USUARIO = ?
        ORDER BY S.FECHA_DEVOLUCION ASC
    `;
    db.query(sql, [id_usuario], (err, results) => {
        if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener préstamos activos' }); }
        res.json(results);
    });
});

// ==========================================================
// ENDPOINT PARA DEVOLVER UN PRÉSTAMO 
// ==========================================================
app.post('/api/prestamos/devolver', (req, res) => {
    // Obtenemos los datos del modal y del usuario logueado
    const {
        id_solicitud,
        id_detalle,
        id_material,
        id_usuario_encargado, // El ID del que presiona el botón
        cantidad_recibida,
        estado_material,
        observaciones,
        fecha_recepcion
    } = req.body;

    // ¡Usamos una transacción! O todo funciona, o nada se guarda.
    db.beginTransaction(err => {
        if (err) { throw err; }

        // 1. Actualizar el ESTADO de la SOLICITUD (de 1 'Activo' a 2 'Completado')
        const sqlSolicitud = 'UPDATE SOLICITUDES SET ESTADO = 2 WHERE ID_SOLICITUD = ?';
        db.query(sqlSolicitud, [id_solicitud], (err, result) => {
            if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar la solicitud" }); }); }

            // 2. Devolver el stock al INVENTARIO
            const sqlInventario = 'UPDATE MATERIALES SET CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE + ? WHERE ID_MATERIAL = ?';
            db.query(sqlInventario, [cantidad_recibida, id_material], (err, result) => {
                if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar inventario" }); }); }

                // 3. Crear el registro en RECEPCIONES_MATERIAL (como pediste)
                const sqlRecepcion = `
                    INSERT INTO RECEPCIONES_MATERIAL (ID_DETALLE, ID_USUARIO, CANTIDAD_RECIBIDA, ESTADO_MATERIAL, OBSERVACIONES, FECHA_RECEPCION)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                db.query(sqlRecepcion, [id_detalle, id_usuario_encargado, cantidad_recibida, estado_material, observaciones, fecha_recepcion], (err, result) => {
                    if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al crear la recepción" }); }); }

                    // (Opcional) Actualizamos también nuestra tabla "parche"
                    const sqlDetalle = 'UPDATE DETALLE_SOLICITUD SET ESTADO_DEVOLUCION = ?, OBSERVACIONES_DEVOLUCION = ? WHERE ID_DETALLE = ?';
                    db.query(sqlDetalle, [estado_material, observaciones, id_detalle], (err, result) => {
                        if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar el detalle" }); }); }

                        // 4. Si todo salió bien, CONFIRMAR
                        db.commit(err => {
                            if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al confirmar" }); }); }
                            res.status(200).json({ success: true, message: "¡Devolución registrada exitosamente!" });
                        });
                    });
                });
            });
        });
    });
});


// ==========================================================
// ENDPOINT PARA EL HISTORIAL COMPLETO (POR ENCARGADO)
// ==========================================================
app.get('/api/prestamos/historial/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;

    // Es casi igual al del Admin, pero con un "WHERE" para el ID del usuario
    const sql = `
        SELECT 
            S.ID_SOLICITUD,
            A.NOMBRE as ALUMNO_NOMBRE,
            A.APELLIDO as ALUMNO_APELLIDO,
            M.NOMBRE as MATERIAL_NOMBRE,
            T.NOMBRE_TIPO_MATERIAL,
            DS.CANTIDAD_ENTREGADA as CANTIDAD,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION,
            S.ESTADO
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN MATERIALES M ON DS.ID_MATERIAL = M.ID_MATERIAL
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        WHERE S.ID_USUARIO = ?
        ORDER BY S.FECHA_SOLICITUD DESC
    `;

    db.query(sql, [id_usuario], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener el historial' });
        }
        res.json(results);
    });
});
// ==========================================================
// 5. ENCENDER EL SERVIDOR
// ==========================================================
const PORT = 3000; // Usaremos el puerto 3000 para nuestra API
app.listen(PORT, () => {
    console.log(`Servidor API corriendo en http://localhost:${PORT}`);
    console.log('Presiona CTRL+C para detener el servidor.');
});