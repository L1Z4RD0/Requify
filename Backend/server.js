// ==========================================================
// 1. IMPORTAR LAS "HERRAMIENTAS" QUE INSTALAMOS (npm install)
// ==========================================================
const express = require('express'); // El "cerebro" para crear la API
const mysql = require('mysql2');    // El "traductor" para hablar con MySQL
const cors = require('cors');       // El "portero" que da permiso al frontend
const { hashPassword, comparePassword, needsRehash } = require('./utils/passwords');

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
    database: 'requify_demov0.3',
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

const formatDateTimeForSQL = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

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
        SELECT U.ID_USUARIO, U.USERNAME, U.NOMBRE, U.PASSWORD, R.NOMBRE_ROL
        FROM USUARIOS U
        JOIN ROLES R ON U.ID_ROL = R.ID_ROL
        WHERE U.USERNAME = ? AND U.ESTADO = 1
    `;
    
    // NOTA DE SEGURIDAD: En un proyecto 100% real, las contraseñas
    // NUNCA se guardan en texto plano. Se usa algo llamado "bcrypt".
    // Para tu proyecto de clases, esto está perfecto.

    // Ejecuta la consulta en la base de datos
    db.query(sql, [username], async (err, results) => {
        if (err) {
            // Si la base de datos da un error
            console.error(err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        const user = results[0];
        try {
            const passwordValida = await comparePassword(password, user.PASSWORD);
            if (!passwordValida) {
                return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
            }

            if (needsRehash(user.PASSWORD)) {
                try {
                    const nuevoHash = await hashPassword(password);
                    db.query('UPDATE USUARIOS SET PASSWORD = ? WHERE ID_USUARIO = ?', [nuevoHash, user.ID_USUARIO], (updateErr) => {
                        if (updateErr) {
                            console.error('Error al actualizar hash de contraseña:', updateErr);
                        }
                    });
                } catch (rehashErr) {
                    console.error('No se pudo re-encriptar la contraseña:', rehashErr);
                }
            }

            const redirect = user.NOMBRE_ROL === 'Administrador'
                ? 'pages/dashboard-admin.html'
                : 'pages/dashboard-encargado.html';

            return res.json({
                success: true,
                id: user.ID_USUARIO,
                username: user.USERNAME,
                nombre: user.NOMBRE,
                rol: user.NOMBRE_ROL,
                redirect
            });
        } catch (hashErr) {
            console.error('Error validando contraseña:', hashErr);
            return res.status(500).json({ success: false, message: 'No se pudo validar la contraseña del usuario' });
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
app.post('/api/usuarios/crear', async (req, res) => {
    // Recibe los datos del formulario desde el frontend
    const { nombre, rut, email, telefono, rol, username, password, activo } = req.body;

    let hashedPassword;
    try {
        hashedPassword = await hashPassword(password);
    } catch (hashError) {
        console.error('Error al encriptar contraseña:', hashError);
        return res.status(500).json({ message: 'No fue posible asegurar la contraseña del usuario' });
    }

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
        db.query(sql, [idRol, username, nombre, email, hashedPassword, estadoNum, ''], (err, result) => {
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
            ASIG.NOMBRE AS ASIGNATURA,
            U.USERNAME as ENCARGADO_USERNAME
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN MATERIALES M ON DS.ID_MATERIAL = M.ID_MATERIAL
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        JOIN ASIGNATURAS ASIG ON S.ID_ASIGNATURA = ASIG.ID_ASIGNATURA
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

// --- ENDPOINT PARA CATEGORÍAS DE INVENTARIO ---
app.get('/api/categorias', (req, res) => {
    const sql = `
        SELECT
            T.ID_TIPO_MATERIAL,
            T.NOMBRE_TIPO_MATERIAL,
            T.CODIGO_BASE,
            T.MAX_DIAS_PRESTAMO,
            T.CONSECUTIVO_ACTUAL,
            COUNT(M.ID_MATERIAL) AS TOTAL_MATERIALES
        FROM TIPO_MATERIALES T
        LEFT JOIN MATERIALES M ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        GROUP BY T.ID_TIPO_MATERIAL
        ORDER BY T.NOMBRE_TIPO_MATERIAL
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener categorías' });
        }
        res.json(results);
    });
});

// --- ENDPOINT PARA CREAR CATEGORÍA ---
app.post('/api/categorias', (req, res) => {
    const { nombre, codigo_base, max_dias } = req.body;
    const nombreNormalizado = (nombre || '').trim();
    const codigo = (codigo_base || '').trim().toUpperCase();
    const maxDias = parseInt(max_dias, 10);

    if (!nombreNormalizado || !codigo || Number.isNaN(maxDias) || maxDias <= 0) {
        return res.status(400).json({ message: 'Nombre, código base y máximo de días son obligatorios' });
    }

    const sql = `
        INSERT INTO TIPO_MATERIALES (NOMBRE_TIPO_MATERIAL, CODIGO_BASE, MAX_DIAS_PRESTAMO, CONSECUTIVO_ACTUAL)
        VALUES (?, ?, ?, 0)
    `;
    db.query(sql, [nombreNormalizado, codigo, maxDias], (err, result) => {
        if (err) {
            console.error(err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'El nombre o código base ya existen' });
            }
            return res.status(500).json({ message: 'Error al crear la categoría' });
        }
        res.status(201).json({
            success: true,
            id: result.insertId,
            nombre: nombreNormalizado,
            codigo_base: codigo,
            max_dias: maxDias
        });
    });
});

// --- ENDPOINT PARA CREAR MATERIALES (con código incremental) ---
app.post('/api/materiales', (req, res) => {
    const { id_categoria, nombre, descripcion, cantidad_total, ubicacion } = req.body;
    const categoriaId = parseInt(id_categoria, 10);
    const cantidad = parseInt(cantidad_total, 10);
    const nombreMaterial = (nombre || '').trim();

    if (!categoriaId || !nombreMaterial || Number.isNaN(cantidad) || cantidad <= 0) {
        return res.status(400).json({ message: 'Debe indicar categoría, nombre y cantidad válida' });
    }

    db.beginTransaction(err => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al preparar la transacción' });
        }

        const sqlCategoria = 'SELECT CODIGO_BASE, CONSECUTIVO_ACTUAL, MAX_DIAS_PRESTAMO FROM TIPO_MATERIALES WHERE ID_TIPO_MATERIAL = ? FOR UPDATE';
        db.query(sqlCategoria, [categoriaId], (catErr, catResults) => {
            if (catErr || catResults.length === 0) {
                return db.rollback(() => {
                    console.error(catErr);
                    res.status(404).json({ message: 'Categoría no encontrada' });
                });
            }

            const categoria = catResults[0];
            const nuevoConsecutivo = categoria.CONSECUTIVO_ACTUAL + 1;
            const correlativo = String(nuevoConsecutivo).padStart(3, '0');
            const codigoMaterial = `${categoria.CODIGO_BASE}-${correlativo}`;

            const sqlInsertMaterial = `
                INSERT INTO MATERIALES (ID_TIPO_MATERIAL, CODIGO, NOMBRE, DESCRIPCION, CANTIDAD_TOTAL, CANTIDAD_DISPONIBLE, ESTADO, UBICACION)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            `;

            db.query(sqlInsertMaterial, [categoriaId, codigoMaterial, nombreMaterial, descripcion || '', cantidad, cantidad, ubicacion || ''], (matErr, matResult) => {
                if (matErr) {
                    return db.rollback(() => {
                        console.error(matErr);
                        res.status(500).json({ message: 'Error al crear el material' });
                    });
                }

                const sqlUpdateCategoria = 'UPDATE TIPO_MATERIALES SET CONSECUTIVO_ACTUAL = ? WHERE ID_TIPO_MATERIAL = ?';
                db.query(sqlUpdateCategoria, [nuevoConsecutivo, categoriaId], (updateErr) => {
                    if (updateErr) {
                        return db.rollback(() => {
                            console.error(updateErr);
                            res.status(500).json({ message: 'Error al actualizar el correlativo de la categoría' });
                        });
                    }

                    db.commit(commitErr => {
                        if (commitErr) {
                            return db.rollback(() => {
                                console.error(commitErr);
                                res.status(500).json({ message: 'Error al confirmar la creación del material' });
                            });
                        }

                        res.status(201).json({
                            success: true,
                            id: matResult.insertId,
                            codigo: codigoMaterial,
                            nombre: nombreMaterial,
                            max_dias: categoria.MAX_DIAS_PRESTAMO,
                            cantidad_total: cantidad
                        });
                    });
                });
            });
        });
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

// --- ENDPOINT PARA OBTENER ASIGNATURAS ---
app.get('/api/asignaturas', (req, res) => {
    const sql = 'SELECT ID_ASIGNATURA, NOMBRE FROM ASIGNATURAS ORDER BY NOMBRE';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener asignaturas' });
        }
        res.json(results);
    });
});

// --- ENDPOINT PARA LLENAR EL <select> DE MATERIALES ---
app.get('/api/materiales', (req, res) => {
    const sql = `
        SELECT M.ID_MATERIAL, M.CODIGO, M.NOMBRE, M.CANTIDAD_DISPONIBLE, T.NOMBRE_TIPO_MATERIAL, T.MAX_DIAS_PRESTAMO
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
        fecha_devolucion,
        id_asignatura,
        responsable,
        observaciones
    } = req.body;

    if (!id_asignatura) {
        return res.status(400).json({ message: 'La asignatura es obligatoria para registrar el préstamo' });
    }

    const cantidadSolicitada = parseInt(cantidad, 10);
    if (!cantidadSolicitada || cantidadSolicitada <= 0) {
        return res.status(400).json({ message: 'La cantidad solicitada debe ser un número válido' });
    }

    if (!fecha_devolucion) {
        return res.status(400).json({ message: 'Debe indicar la fecha estimada de devolución' });
    }

    const sqlMaterialInfo = `
        SELECT M.CANTIDAD_DISPONIBLE, T.MAX_DIAS_PRESTAMO
        FROM MATERIALES M
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        WHERE M.ID_MATERIAL = ?
    `;

    db.query(sqlMaterialInfo, [id_material], (materialErr, materialResults) => {
        if (materialErr) {
            console.error(materialErr);
            return res.status(500).json({ message: 'Error al validar el material seleccionado' });
        }
        if (materialResults.length === 0) {
            return res.status(404).json({ message: 'El material seleccionado no existe' });
        }

        const materialInfo = materialResults[0];
        if (materialInfo.CANTIDAD_DISPONIBLE < cantidadSolicitada) {
            return res.status(400).json({ message: 'No hay stock suficiente para completar el préstamo' });
        }

        const fechaPrestamoServidor = new Date();
        const fechaPrestamoSQL = formatDateTimeForSQL(fechaPrestamoServidor);
        const fechaDevolucionDate = new Date(fecha_devolucion);

        if (Number.isNaN(fechaDevolucionDate.getTime())) {
            return res.status(400).json({ message: 'La fecha de devolución no tiene un formato válido' });
        }

        if (fechaDevolucionDate < fechaPrestamoServidor) {
            return res.status(400).json({ message: 'La devolución no puede ser anterior a la fecha actual' });
        }

        const limiteDevolucion = new Date(fechaPrestamoServidor);
        limiteDevolucion.setDate(limiteDevolucion.getDate() + materialInfo.MAX_DIAS_PRESTAMO);
        if (fechaDevolucionDate > limiteDevolucion) {
            return res.status(400).json({ message: `La categoría permite un máximo de ${materialInfo.MAX_DIAS_PRESTAMO} días para este préstamo` });
        }

        const fechaDevolucionSQL = formatDateTimeForSQL(fechaDevolucionDate);

        // Usamos una TRANSACCIÓN para asegurar que todo salga bien, o nada
        db.beginTransaction(err => {
            if (err) { throw err; }

            // 1. Crear la SOLICITUD (el "préstamo")
            const sqlSolicitud = `
                INSERT INTO SOLICITUDES (ID_USUARIO, ID_ALUMNO, ID_ASIGNATURA, FECHA_SOLICITUD, ESTADO, RESPONSABLE, OBSERVACIONES, FECHA_DEVOLUCION)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            `;
            db.query(sqlSolicitud, [id_usuario, id_alumno, id_asignatura, fechaPrestamoSQL, responsable, observaciones, fechaDevolucionSQL], (err, result) => {
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
                db.query(sqlDetalle, [id_material, idSolicitud, cantidadSolicitada, cantidadSolicitada], (err, result) => {
                    if (err) {
                        return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al crear el detalle" }); });
                    }

                    // 3. ACTUALIZAR el inventario (restar la cantidad)
                    const sqlUpdateInventario = `
                        UPDATE MATERIALES
                        SET CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE - ?
                        WHERE ID_MATERIAL = ?
                    `;
                    db.query(sqlUpdateInventario, [cantidadSolicitada, id_material], (err, result) => {
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
            ASIG.NOMBRE AS ASIGNATURA,
            DS.CANTIDAD_ENTREGADA as CANTIDAD,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN MATERIALES M ON DS.ID_MATERIAL = M.ID_MATERIAL
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        JOIN ASIGNATURAS ASIG ON S.ID_ASIGNATURA = ASIG.ID_ASIGNATURA
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
            ASIG.NOMBRE AS ASIGNATURA,
            DS.CANTIDAD_ENTREGADA as CANTIDAD,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION,
            S.ESTADO
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN MATERIALES M ON DS.ID_MATERIAL = M.ID_MATERIAL
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        JOIN ASIGNATURAS ASIG ON S.ID_ASIGNATURA = ASIG.ID_ASIGNATURA
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