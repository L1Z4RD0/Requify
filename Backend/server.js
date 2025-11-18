// ==========================================================
// 1. IMPORTAR LIBRERÍAS
// ==========================================================
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt'); 

// ==========================================================
// 2. CONFIGURACIÓN
// ==========================================================
const app = express();
app.use(cors());
app.use(express.json());
const saltRounds = 10; // (Para bcrypt)

// Helper para normalizar fechas provenientes del frontend (datetime-local)
function formatToMySQLDatetime(value) {
    if (!value) return null;

    // Si ya es un objeto Date lo convertimos directo a ISO sin la "T"
    if (value instanceof Date) {
        return value.toISOString().slice(0, 19).replace('T', ' ');
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;

        let normalized = trimmed.replace('T', ' ');

        // Si viene en formato YYYY-MM-DD HH:MM añadimos los segundos
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) {
            normalized = `${normalized}:00`;
        }

        // Si ya cumple con el formato completo, lo retornamos
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
            return normalized;
        }

        // Intentamos parsear cualquier otro formato válido
        const parsedDate = new Date(trimmed);
        if (!isNaN(parsedDate)) {
            return parsedDate.toISOString().slice(0, 19).replace('T', ' ');
        }

        return normalized;
    }

    return null;
}

// ==========================================================
// 3. CONEXIÓN A LA BASE DE DATOS 
// ==========================================================
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'BB21JhonWick',
    database: process.env.DB_NAME || 'requify_demoV0.2',
    multipleStatements: true
};

const db = mysql.createConnection(dbConfig);

db.connect(err => {
    if (err) { console.error('Error al conectar a la base de datos:', err); return; }
    console.log(`¡Conectado exitosamente a la base de datos ${dbConfig.database}!`);
});

// ==========================================================
// 4. ENDPOINTS DE LOGIN Y GESTIÓN DE USUARIOS 
// ==========================================================

// --- LOGIN (¡ACTUALIZADO CON BCRYPT!) ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Buscar al usuario SOLO por username
    const sql = `
        SELECT U.ID_USUARIO, U.USERNAME, U.NOMBRE, U.PASSWORD, R.NOMBRE_ROL 
        FROM USUARIOS U 
        JOIN ROLES R ON U.ID_ROL = R.ID_ROL 
        WHERE U.USERNAME = ? AND U.ESTADO = 1
    `;
    
    db.query(sql, [username], async (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error en el servidor' }); }

        if (results.length === 0) {
            // Usuario no encontrado
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        const user = results[0];
        const hashedPassword = user.PASSWORD;

        // 2. Comparar la contraseña (Punto 4)
        try {
            const match = await bcrypt.compare(password, hashedPassword);
            
            if (match) {
                // ¡Éxito con Bcrypt! (Para usuarios nuevos)
                return enviarRespuestaLogin(res, user);
            }

            // 3. Lógica de "Amnistía" (para usuarios viejos como 'admin')
            // Si bcrypt falla, intentamos una comparación de texto plano
            if (password === hashedPassword) {
                // ¡Éxito con Texto Plano! (Para 'admin')
                return enviarRespuestaLogin(res, user);
            }

            // Si ambas fallan, la contraseña es incorrecta
            res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });

        } catch (bcryptError) {
            console.error('Error en bcrypt:', bcryptError);
            res.status(500).json({ message: 'Error de seguridad en el servidor' });
        }
    });
});

// (Función helper para no repetir código)
function enviarRespuestaLogin(res, user) {
    const redirect = user.NOMBRE_ROL === 'Administrador' ? 'pages/dashboard-admin.html' : 'pages/dashboard-encargado.html';
    res.json({
        success: true,
        id: user.ID_USUARIO,
        username: user.USERNAME,
        nombre: user.NOMBRE,
        rol: user.NOMBRE_ROL,
        redirect: redirect
    });
}


// --- CREAR USUARIO (¡ACTUALIZADO CON BCRYPT!) ---
app.post('/api/usuarios/crear', (req, res) => {
    const { nombre, rut, email, telefono, rol, username, password, activo } = req.body;
    
    // 1. Encriptar la contraseña (Punto 4)
    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
            console.error('Error al hashear:', err);
            return res.status(500).json({ message: 'Error de seguridad al crear usuario' });
        }

        // 2. Buscar el ID del Rol
        db.query('SELECT ID_ROL FROM ROLES WHERE NOMBRE_ROL = ?', [rol], (err, results) => {
            if (err || results.length === 0) { return res.status(500).json({ message: 'Error al buscar el rol' }); }
            
            const idRol = results[0].ID_ROL;
            const estadoNum = activo ? 1 : 0;

            // 3. Insertar el usuario con la contraseña ENCRIPTADA
            const sql = `
                INSERT INTO USUARIOS (ID_ROL, USERNAME, NOMBRE, EMAIL, PASSWORD, ESTADO, FECHA_ALTA, APELLIDO)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
            `;
            db.query(sql, [idRol, username, nombre, email, hashedPassword, estadoNum, ''], (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') { return res.status(409).json({ message: 'El nombre de usuario ya existe' }); }
                    return res.status(500).json({ message: 'Error al crear el usuario' });
                }
                res.status(201).json({ success: true, message: 'Usuario creado exitosamente', id: result.insertId });
            });
        });
    });
});

// --- ELIMINAR USUARIO (Admin) (Sin cambios) ---
app.delete('/api/usuarios/eliminar/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM USUARIOS WHERE ID_USUARIO = ?';
    db.query(sql, [id], (err, result) => {
        if (err) { return res.status(500).json({ message: 'Error al eliminar el usuario' }); }
        if (result.affectedRows === 0) { return res.status(404).json({ message: 'Usuario no encontrado' }); }
        res.json({ success: true, message: 'Usuario eliminado exitosamente' });
    });
});


// ==========================================================
// 5. ENDPOINTS DE GESTIÓN DE INVENTARIO (Admin) (Sin cambios)
// ==========================================================

// --- OBTENER LAS CATEGORÍAS (TIPO_MATERIALES) ---
app.get('/api/tipos-materiales', (req, res) => {
    const sql = 'SELECT * FROM TIPO_MATERIALES ORDER BY NOMBRE_TIPO_MATERIAL';
    db.query(sql, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener tipos de materiales' }); }
        res.json(results);
    });
});

// --- OBTENER LAS UBICACIONES ---
app.get('/api/ubicaciones', (req, res) => {
    const sql = 'SELECT * FROM UBICACIONES ORDER BY NOMBRE_UBICACION';
    db.query(sql, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener ubicaciones' }); }
        res.json(results);
    });
});

// --- CREAR UN NUEVO TIPO DE MATERIAL (ej: "iPad Air") ---
app.post('/api/materiales/crear', (req, res) => {
    const { id_tipo_material, nombre, descripcion, max_dias_prestamo } = req.body;
    const sql = `
        INSERT INTO MATERIALES (ID_TIPO_MATERIAL, NOMBRE, DESCRIPCION, MAX_DIAS_PRESTAMO)
        VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [id_tipo_material, nombre, descripcion, max_dias_prestamo], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') { return res.status(409).json({ message: 'Ese nombre de material ya existe.' }); }
            console.error(err);
            return res.status(500).json({ message: 'Error al crear el material.' });
        }
        res.status(201).json({ success: true, message: 'Nuevo tipo de producto creado.', id: result.insertId });
    });
});

// --- AÑADIR ITEMS (Genera Códigos Automáticos) ---
app.post('/api/items/crear', (req, res) => {
    const { id_material, cantidad, id_ubicacion, estado } = req.body;
    const estadoItem = estado ? estado : 'Disponible';
    db.beginTransaction(async (err) => {
        if (err) { throw err; }
        try {
            const [rows] = await db.promise().query(
                `SELECT T.PREFIJO 
                 FROM TIPO_MATERIALES T 
                 JOIN MATERIALES M ON T.ID_TIPO_MATERIAL = M.ID_TIPO_MATERIAL
                 WHERE M.ID_MATERIAL = ?`, 
                [id_material]
            );
            if (rows.length === 0) { throw new Error('Categoría de material no encontrada.'); }
            const prefijo = rows[0].PREFIJO;
            const [maxRows] = await db.promise().query(
                `SELECT CODIGO_PATRIMONIAL FROM ITEMS_INVENTARIO 
                 WHERE CODIGO_PATRIMONIAL LIKE ? 
                 ORDER BY ID_ITEM DESC LIMIT 1`, 
                [`${prefijo}-%`]
            );
            let numeroSiguiente = 1001;
            if (maxRows.length > 0) {
                const ultimoCodigo = maxRows[0].CODIGO_PATRIMONIAL;
                const ultimoNumero = parseInt(ultimoCodigo.split('-')[1]);
                numeroSiguiente = ultimoNumero + 1;
            }
            const sqlInsert = `
                INSERT INTO ITEMS_INVENTARIO (ID_MATERIAL, CODIGO_PATRIMONIAL, ESTADO, ID_UBICACION)
                VALUES ?
            `;
            const valores = [];
            for (let i = 0; i < cantidad; i++) {
                const nuevoCodigo = `${prefijo}-${numeroSiguiente + i}`;
                valores.push([id_material, nuevoCodigo, estadoItem, id_ubicacion]);
            }
            await db.promise().query(sqlInsert, [valores]);
            await db.promise().commit();
            res.status(201).json({ success: true, message: `¡${cantidad} ítems agregados exitosamente!` });
        } catch (error) {
            await db.promise().rollback();
            console.error(error);
            if (error.code === 'ER_DUP_ENTRY') {
                res.status(409).json({ message: 'Error: Se intentó generar un código que ya existe. Intente de nuevo.' });
            } else {
                res.status(500).json({ message: 'Error al crear los ítems.' });
            }
        }
    });
});

// ==========================================================
// 6. ENDPOINTS DE LECTURA (Dashboard y Préstamos) (Sin cambios)
// ==========================================================

// --- OBTENER ALUMNOS ---
app.get('/api/alumnos', (req, res) => {
    const sql = 'SELECT ID_ALUMNO, RUT, NOMBRE, APELLIDO, CURSO FROM ALUMNOS ORDER BY NOMBRE';
    db.query(sql, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener alumnos' }); }
        res.json(results);
    });
});

// --- OBTENER ASIGNATURAS ---
app.get('/api/asignaturas', (req, res) => {
    const sql = 'SELECT * FROM ASIGNATURAS ORDER BY NOMBRE_ASIGNATURA';
    db.query(sql, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener asignaturas' }); }
        res.json(results);
    });
});

// --- OBTENER "PRODUCTOS" (MATERIALES) ---
app.get('/api/materiales', (req, res) => {
    const sql = `
        SELECT M.ID_MATERIAL, M.NOMBRE, T.NOMBRE_TIPO_MATERIAL, M.MAX_DIAS_PRESTAMO
        FROM MATERIALES M
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        ORDER BY T.NOMBRE_TIPO_MATERIAL, M.NOMBRE
    `;
    db.query(sql, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener materiales' }); }
        res.json(results);
    });
});

// --- OBTENER ITEMS DISPONIBLES ---
app.get('/api/items-disponibles/:id_material', (req, res) => {
    const { id_material } = req.params;
    const sql = `
        SELECT ID_ITEM, CODIGO_PATRIMONIAL 
        FROM ITEMS_INVENTARIO 
        WHERE ID_MATERIAL = ? AND ESTADO = 'Disponible'
        ORDER BY CODIGO_PATRIMONIAL
    `;
    db.query(sql, [id_material], (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener ítems' }); }
        res.json(results);
    });
});

// --- OBTENER INVENTARIO (General) ---
app.get('/api/inventario', (req, res) => {
    const sql = `
        SELECT
            T.NOMBRE_TIPO_MATERIAL AS tipo,
            M.ID_MATERIAL AS id_material,
            M.NOMBRE AS nombre,
            M.MAX_DIAS_PRESTAMO AS max_dias_prestamo,
            (SELECT COUNT(*) FROM ITEMS_INVENTARIO i WHERE i.ID_MATERIAL = M.ID_MATERIAL) AS total,
            (SELECT COUNT(*) FROM ITEMS_INVENTARIO i WHERE i.ID_MATERIAL = M.ID_MATERIAL AND i.ESTADO = 'Disponible') AS disponibles
        FROM MATERIALES M
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
    `;
    db.query(sql, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener inventario' }); }
        res.json(results);
    });
});

// --- OBTENER STATS (Admin) ---
app.get('/api/dashboard/admin-stats', (req, res) => {
    const sql_usuarios = 'SELECT COUNT(*) as total FROM USUARIOS WHERE ESTADO = 1';
    const sql_activos = 'SELECT COUNT(*) as total FROM SOLICITUDES WHERE ESTADO = 1';
    const sql_vencidos = 'SELECT COUNT(*) as total FROM SOLICITUDES WHERE ESTADO = 1 AND FECHA_DEVOLUCION < NOW()';
    const sql_materiales = 'SELECT COUNT(*) as total FROM ITEMS_INVENTARIO';
    db.query(`${sql_usuarios}; ${sql_activos}; ${sql_vencidos}; ${sql_materiales}`, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al calcular estadísticas' }); }
        res.json({
            totalUsuarios: results[0][0].total,
            prestamosActivos: results[1][0].total,
            prestamosVencidos: results[2][0].total,
            totalMateriales: results[3][0].total
        });
    });
});

// --- OBTENER STATS (Encargado) ---
app.get('/api/dashboard/encargado-stats/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;
    const sql_activos = 'SELECT COUNT(*) as total FROM SOLICITUDES WHERE ESTADO = 1 AND ID_USUARIO = ?';
    const sql_completados = 'SELECT COUNT(*) as total FROM SOLICITUDES WHERE ESTADO != 1 AND ID_USUARIO = ?';
    const sql_vencer = `
        SELECT COUNT(*) as total FROM SOLICITUDES 
        WHERE ESTADO = 1 AND ID_USUARIO = ? AND FECHA_DEVOLUCION BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 DAY)
    `;
    db.query(`${sql_activos}; ${sql_completados}; ${sql_vencer}`, [id_usuario, id_usuario, id_usuario], (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al calcular estadísticas' }); }
        res.json({
            activos: results[0][0].total,
            completados: results[1][0].total,
            vencer: results[2][0].total
        });
    });
});

// --- OBTENER TODOS LOS PRÉSTAMOS (Admin) ---
app.get('/api/prestamos', (req, res) => {
    const sql = `
        SELECT 
            S.ID_SOLICITUD,
            A.NOMBRE as ALUMNO_NOMBRE, A.APELLIDO as ALUMNO_APELLIDO,
            M.NOMBRE as MATERIAL_NOMBRE,
            I.CODIGO_PATRIMONIAL,
            S.FECHA_SOLICITUD, S.FECHA_DEVOLUCION, S.ESTADO,
            U.USERNAME as ENCARGADO_USERNAME
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN ITEMS_INVENTARIO I ON DS.ID_ITEM = I.ID_ITEM
        JOIN MATERIALES M ON I.ID_MATERIAL = M.ID_MATERIAL
        JOIN USUARIOS U ON S.ID_USUARIO = U.ID_USUARIO
        ORDER BY S.FECHA_SOLICITUD DESC
    `;
    db.query(sql, (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener préstamos' }); }
        res.json(results);
    });
});

// --- OBTENER PRÉSTAMOS ACTIVOS (Encargado) ---
app.get('/api/prestamos/activos/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;
    const sql = `
        SELECT 
            S.ID_SOLICITUD, DS.ID_DETALLE, I.ID_ITEM,
            A.NOMBRE as ALUMNO_NOMBRE, A.APELLIDO as ALUMNO_APELLIDO, A.CURSO,
            M.NOMBRE as MATERIAL_NOMBRE,
            I.CODIGO_PATRIMONIAL,
            S.FECHA_SOLICITUD, S.FECHA_DEVOLUCION
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN ITEMS_INVENTARIO I ON DS.ID_ITEM = I.ID_ITEM
        JOIN MATERIALES M ON I.ID_MATERIAL = M.ID_MATERIAL
        WHERE S.ESTADO = 1 AND S.ID_USUARIO = ?
        ORDER BY S.FECHA_DEVOLUCION ASC
    `;
    db.query(sql, [id_usuario], (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener préstamos activos' }); }
        res.json(results);
    });
});

// --- OBTENER HISTORIAL (Encargado) ---
app.get('/api/prestamos/historial/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;
    const sql = `
        SELECT 
            S.ID_SOLICITUD,
            A.NOMBRE as ALUMNO_NOMBRE, A.APELLIDO as ALUMNO_APELLIDO,
            M.NOMBRE as MATERIAL_NOMBRE,
            I.CODIGO_PATRIMONIAL,
            S.FECHA_SOLICITUD, S.FECHA_DEVOLUCION, S.ESTADO
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN ITEMS_INVENTARIO I ON DS.ID_ITEM = I.ID_ITEM
        JOIN MATERIALES M ON I.ID_MATERIAL = M.ID_MATERIAL
        WHERE S.ID_USUARIO = ?
        ORDER BY S.FECHA_SOLICITUD DESC
    `;
    db.query(sql, [id_usuario], (err, results) => {
        if (err) { return res.status(500).json({ message: 'Error al obtener el historial' }); }
        res.json(results);
    });
});

// ==========================================================
// 7. ENDPOINTS DE ESCRITURA (Préstamos) (Sin cambios)
// ==========================================================

// --- CREAR PRÉSTAMO (Encargado - v3.0) ---
app.post('/api/prestamos/crear', (req, res) => {
    const { id_alumno, id_asignatura, id_item, id_usuario, fecha_prestamo, fecha_devolucion, responsable, observaciones } = req.body;
    const fechaSolicitudSQL = formatToMySQLDatetime(fecha_prestamo) || formatToMySQLDatetime(new Date());
    const fechaDevolucionSQL = formatToMySQLDatetime(fecha_devolucion) || formatToMySQLDatetime(new Date());
    db.beginTransaction(err => {
        if (err) { throw err; }
        const sqlSolicitud = `
            INSERT INTO SOLICITUDES (ID_USUARIO, ID_ALUMNO, FECHA_SOLICITUD, ESTADO, RESPONSABLE, OBSERVACIONES, FECHA_DEVOLUCION, ID_ASIGNATURA)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?)
        `;
        db.query(sqlSolicitud, [id_usuario, id_alumno, fechaSolicitudSQL, responsable, observaciones, fechaDevolucionSQL, id_asignatura], (err, result) => {
            if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al crear la solicitud" }); }); }
            const idSolicitud = result.insertId;
            const sqlDetalle = `INSERT INTO DETALLE_SOLICITUD (ID_SOLICITUD, ID_ITEM) VALUES (?, ?)`;
            db.query(sqlDetalle, [idSolicitud, id_item], (err, result) => {
                if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al crear el detalle" }); }); }
                const sqlUpdateItem = `UPDATE ITEMS_INVENTARIO SET ESTADO = 'En Préstamo' WHERE ID_ITEM = ?`;
                db.query(sqlUpdateItem, [id_item], (err, result) => {
                    if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar el ítem" }); }); }
                    db.commit(err => {
                        if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al confirmar" }); }); }
                        res.status(201).json({ success: true, message: "¡Préstamo registrado exitosamente!" });
                    });
                });
            });
        });
    });
});

// --- DEVOLVER PRÉSTAMO (Encargado - v3.0) ---
app.post('/api/prestamos/devolver', (req, res) => {
    const { id_solicitud, id_detalle, id_item, id_usuario_encargado, estado_material, observaciones, fecha_recepcion } = req.body;
    const fechaRecepcionSQL = formatToMySQLDatetime(fecha_recepcion) || formatToMySQLDatetime(new Date());

    db.beginTransaction(err => {
        if (err) { throw err; }
        // 1. Actualizar SOLICITUD (Estado 2 = Completado)
        const sqlSolicitud = 'UPDATE SOLICITUDES SET ESTADO = 2 WHERE ID_SOLICITUD = ?';
        db.query(sqlSolicitud, [id_solicitud], (err, result) => {
            if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar la solicitud" }); }); }

            // 2. Devolver el ítem al inventario
            const nuevoEstadoItem = (estado_material === 'Bueno' || estado_material === 'Regular') ? 'Disponible' : 'Mantenimiento';
            const sqlInventario = "UPDATE ITEMS_INVENTARIO SET ESTADO = ? WHERE ID_ITEM = ?";
            db.query(sqlInventario, [nuevoEstadoItem, id_item], (err, result) => {
                if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar inventario" }); }); }

                // 3. Crear el registro en RECEPCIONES_MATERIAL
                const sqlRecepcion = `
                    INSERT INTO RECEPCIONES_MATERIAL (ID_DETALLE, ID_USUARIO, ESTADO_MATERIAL, OBSERVACIONES, FECHA_RECEPCION)
                    VALUES (?, ?, ?, ?, ?)
                `;
                db.query(sqlRecepcion, [id_detalle, id_usuario_encargado, estado_material, observaciones, fechaRecepcionSQL], (err, result) => {
                    if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al crear la recepción" }); }); }

                    // 4. Actualizar el DETALLE_SOLICITUD
                    const sqlDetalle = 'UPDATE DETALLE_SOLICITUD SET ESTADO_DEVOLUCION = ?, OBSERVACIONES_DEVOLUCION = ? WHERE ID_DETALLE = ?';
                    db.query(sqlDetalle, [estado_material, observaciones, id_detalle], (err, result) => {
                        if (err) { return db.rollback(() => { console.error(err); res.status(500).json({ message: "Error al actualizar el detalle" }); }); }
                        
                        // 5. Confirmar
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
// 8. INICIAR SERVIDOR
// ==========================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor API v3.1 (Bcrypt) corriendo en http://localhost:${PORT}`);
    console.log('Presiona CTRL+C para detener el servidor.');
});