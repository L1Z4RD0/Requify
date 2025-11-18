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

const normalizeToLetters = (text) => {
    return (text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase();
};

const generateCodigoBase = (nombreCategoria, existingCodes = []) => {
    const normalized = normalizeToLetters(nombreCategoria);
    let base = normalized.slice(0, 3);
    if (!base) {
        base = 'CAT';
    } else if (base.length < 3) {
        base = (base + 'XXX').slice(0, 3);
    }

    const codesSet = new Set(existingCodes.map(code => (code || '').toUpperCase()));
    if (!codesSet.has(base)) {
        return base;
    }

    const prefix = base.slice(0, 2) || 'CX';
    let counter = 2;
    let candidate = `${prefix}${counter}`;
    while (codesSet.has(candidate)) {
        counter += 1;
        candidate = `${prefix}${counter}`;
    }
    return candidate;
};

const ensureUbicacionValida = (ubicacion, callback) => {
    const nombre = (ubicacion || '').trim();
    if (!nombre) {
        return callback(new Error('La ubicación es obligatoria.'));
    }
    db.query('SELECT 1 FROM UBICACIONES WHERE NOMBRE = ?', [nombre], (err, results) => {
        if (err) { return callback(err); }
        if (results.length === 0) {
            return callback(new Error('La ubicación indicada no existe en el catálogo.'));
        }
        callback(null, nombre);
    });
};

const recalculateMaterialStock = (materialId, callback) => {
    const sql = `
        UPDATE MATERIALES M
        SET
            CANTIDAD_TOTAL = (SELECT COUNT(*) FROM ITEMS_MATERIALES WHERE ID_MATERIAL = ?),
            CANTIDAD_DISPONIBLE = (SELECT COUNT(*) FROM ITEMS_MATERIALES WHERE ID_MATERIAL = ? AND ESTADO_ITEM = 1)
        WHERE M.ID_MATERIAL = ?
    `;
    db.query(sql, [materialId, materialId, materialId], callback);
};

const obtenerNombreUsuario = (idUsuario, callback) => {
    db.query('SELECT NOMBRE FROM USUARIOS WHERE ID_USUARIO = ?', [idUsuario], (err, results) => {
        if (err) { return callback(err); }
        if (results.length === 0) {
            return callback(new Error('Usuario no encontrado'));
        }
        callback(null, results[0].NOMBRE || '');
    });
};

const validarLimitePrestamosAlumno = (idAlumno, callback) => {
    const sql = `
        SELECT MAX_PRESTAMOS,
               (
                    SELECT COUNT(*)
                    FROM SOLICITUDES S
                    JOIN DETALLE_SOLICITUD DS ON DS.ID_SOLICITUD = S.ID_SOLICITUD
                    WHERE S.ID_ALUMNO = A.ID_ALUMNO AND S.ESTADO = 1
               ) AS PRESTAMOS_ACTIVOS
        FROM ALUMNOS A
        WHERE A.ID_ALUMNO = ?
    `;
    db.query(sql, [idAlumno], (err, results) => {
        if (err) { return callback(err); }
        if (results.length === 0) {
            return callback(new Error('Alumno no encontrado'));
        }
        callback(null, results[0]);
    });
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
            I.CODIGO_ITEM,
            I.ID_ITEM,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION,
            S.ESTADO,
            ASIG.NOMBRE AS ASIGNATURA,
            U.USERNAME as ENCARGADO_USERNAME
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN ITEMS_MATERIALES I ON DS.ID_ITEM = I.ID_ITEM
        JOIN MATERIALES M ON I.ID_MATERIAL = M.ID_MATERIAL
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
    const sql = `
        SELECT
            T.NOMBRE_TIPO_MATERIAL,
            COALESCE(COUNT(I.ID_ITEM), 0) AS TOTAL_ITEMS,
            COALESCE(SUM(CASE WHEN I.ESTADO_ITEM = 1 THEN 1 ELSE 0 END), 0) AS DISPONIBLES
        FROM TIPO_MATERIALES T
        LEFT JOIN MATERIALES M ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        LEFT JOIN ITEMS_MATERIALES I ON I.ID_MATERIAL = M.ID_MATERIAL
        GROUP BY T.ID_TIPO_MATERIAL, T.NOMBRE_TIPO_MATERIAL
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al calcular estadísticas' });
        }

        const principalesEsperadas = ['Tablets', 'Notebooks', 'Libros', 'Material Deportivo'];
        const principales = principalesEsperadas.map(nombre => ({ nombre, total: 0, disponibles: 0, prestados: 0 }));
        const otrasCategorias = [];

        results.forEach(row => {
            const prestados = row.TOTAL_ITEMS - row.DISPONIBLES;
            const registro = {
                nombre: row.NOMBRE_TIPO_MATERIAL,
                total: row.TOTAL_ITEMS,
                disponibles: row.DISPONIBLES,
                prestados: prestados < 0 ? 0 : prestados
            };

            const indice = principalesEsperadas.indexOf(row.NOMBRE_TIPO_MATERIAL);
            if (indice >= 0) {
                principales[indice] = registro;
            } else {
                otrasCategorias.push(registro);
            }
        });

        res.json({ principales, otrasCategorias });
    });
});

app.get('/api/dashboard/encargado-stats/:id_usuario', (req, res) => {
    const { id_usuario } = req.params;
    const sql = `
        SELECT
            SUM(CASE WHEN S.ESTADO = 1 AND I.ESTADO_ITEM = 2 THEN 1 ELSE 0 END) AS activos,
            SUM(CASE WHEN S.ESTADO = 2 THEN 1 ELSE 0 END) AS completados,
            SUM(
                CASE WHEN S.ESTADO = 1 AND S.FECHA_DEVOLUCION BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 DAY)
                     THEN 1 ELSE 0 END
            ) AS vencer
        FROM SOLICITUDES S
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN ITEMS_MATERIALES I ON DS.ID_ITEM = I.ID_ITEM
        WHERE S.ID_USUARIO = ?
    `;

    db.query(sql, [id_usuario], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener estadísticas del encargado' });
        }
        const data = results[0] || { activos: 0, completados: 0, vencer: 0 };
        res.json({
            activos: data.activos || 0,
            completados: data.completados || 0,
            vencer: data.vencer || 0
        });
    });
});

// --- ENDPOINT PARA EL INVENTARIO ---
app.get('/api/inventario', (req, res) => {
    const sql = `
        SELECT
            T.NOMBRE_TIPO_MATERIAL AS nombre,
            COALESCE(COUNT(I.ID_ITEM), 0) AS total,
            COALESCE(SUM(CASE WHEN I.ESTADO_ITEM = 1 THEN 1 ELSE 0 END), 0) AS disponibles
        FROM TIPO_MATERIALES T
        LEFT JOIN MATERIALES M ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        LEFT JOIN ITEMS_MATERIALES I ON I.ID_MATERIAL = M.ID_MATERIAL
        GROUP BY T.ID_TIPO_MATERIAL, T.NOMBRE_TIPO_MATERIAL
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
            COUNT(DISTINCT M.ID_MATERIAL) AS TOTAL_MATERIALES,
            COALESCE(COUNT(I.ID_ITEM), 0) AS TOTAL_ITEMS,
            COALESCE(SUM(CASE WHEN I.ESTADO_ITEM = 1 THEN 1 ELSE 0 END), 0) AS ITEMS_DISPONIBLES
        FROM TIPO_MATERIALES T
        LEFT JOIN MATERIALES M ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        LEFT JOIN ITEMS_MATERIALES I ON I.ID_MATERIAL = M.ID_MATERIAL
        GROUP BY T.ID_TIPO_MATERIAL, T.NOMBRE_TIPO_MATERIAL, T.CODIGO_BASE, T.MAX_DIAS_PRESTAMO, T.CONSECUTIVO_ACTUAL
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
    const { nombre, max_dias } = req.body;
    const nombreNormalizado = (nombre || '').trim();
    const maxDias = parseInt(max_dias, 10);

    if (!nombreNormalizado || Number.isNaN(maxDias) || maxDias <= 0) {
        return res.status(400).json({ message: 'Nombre y máximo de días son obligatorios' });
    }

    db.query('SELECT CODIGO_BASE FROM TIPO_MATERIALES', (codesErr, codesResults) => {
        if (codesErr) {
            console.error(codesErr);
            return res.status(500).json({ message: 'No se pudieron validar los códigos existentes' });
        }

        const codigo = generateCodigoBase(nombreNormalizado, codesResults.map(row => row.CODIGO_BASE));
        const sql = `
            INSERT INTO TIPO_MATERIALES (NOMBRE_TIPO_MATERIAL, CODIGO_BASE, MAX_DIAS_PRESTAMO, CONSECUTIVO_ACTUAL)
            VALUES (?, ?, ?, 0)
        `;
        db.query(sql, [nombreNormalizado, codigo, maxDias], (err, result) => {
            if (err) {
                console.error(err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'El nombre ya existe' });
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

    ensureUbicacionValida(ubicacion, (ubicacionErr, ubicacionValida) => {
        if (ubicacionErr) {
            return res.status(400).json({ message: ubicacionErr.message });
        }

        db.beginTransaction(err => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error al preparar la transacción' });
            }

            const sqlCategoria = `
                SELECT NOMBRE_TIPO_MATERIAL, CODIGO_BASE, CONSECUTIVO_ACTUAL, MAX_DIAS_PRESTAMO
                FROM TIPO_MATERIALES
                WHERE ID_TIPO_MATERIAL = ?
                FOR UPDATE
            `;
            db.query(sqlCategoria, [categoriaId], (catErr, catResults) => {
                if (catErr || catResults.length === 0) {
                    return db.rollback(() => {
                        console.error(catErr);
                        res.status(404).json({ message: 'Categoría no encontrada' });
                    });
                }

                const categoria = catResults[0];
                const primerCorrelativo = categoria.CONSECUTIVO_ACTUAL + 1;
                const ultimoCorrelativo = categoria.CONSECUTIVO_ACTUAL + cantidad;
                const codigoMaterial = `${categoria.CODIGO_BASE}-L${String(primerCorrelativo).padStart(3, '0')}`;

                const sqlInsertMaterial = `
                    INSERT INTO MATERIALES (ID_TIPO_MATERIAL, CODIGO, NOMBRE, DESCRIPCION, CANTIDAD_TOTAL, CANTIDAD_DISPONIBLE, ESTADO, UBICACION)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                `;

                db.query(
                    sqlInsertMaterial,
                    [categoriaId, codigoMaterial, nombreMaterial, descripcion || '', cantidad, cantidad, ubicacionValida],
                    (matErr, matResult) => {
                        if (matErr) {
                            return db.rollback(() => {
                                console.error(matErr);
                                res.status(500).json({ message: 'Error al crear el material' });
                            });
                        }

                        const itemsValues = [];
                        for (let correlativo = primerCorrelativo; correlativo <= ultimoCorrelativo; correlativo += 1) {
                            const codigoItem = `${categoria.CODIGO_BASE}-${String(correlativo).padStart(3, '0')}`;
                            itemsValues.push([matResult.insertId, codigoItem, 1, ubicacionValida]);
                        }

                        const sqlInsertItems = 'INSERT INTO ITEMS_MATERIALES (ID_MATERIAL, CODIGO_ITEM, ESTADO_ITEM, UBICACION_ITEM) VALUES ?';
                        db.query(sqlInsertItems, [itemsValues], (itemsErr) => {
                            if (itemsErr) {
                                return db.rollback(() => {
                                    console.error(itemsErr);
                                    res.status(500).json({ message: 'Error al generar los ítems individuales' });
                                });
                            }

                            const sqlUpdateCategoria = 'UPDATE TIPO_MATERIALES SET CONSECUTIVO_ACTUAL = ? WHERE ID_TIPO_MATERIAL = ?';
                            db.query(sqlUpdateCategoria, [ultimoCorrelativo, categoriaId], (updateErr) => {
                                if (updateErr) {
                                    return db.rollback(() => {
                                        console.error(updateErr);
                                        res.status(500).json({ message: 'Error al actualizar el correlativo de la categoría' });
                                    });
                                }

                                recalculateMaterialStock(matResult.insertId, (stockErr) => {
                                    if (stockErr) {
                                        return db.rollback(() => {
                                            console.error(stockErr);
                                            res.status(500).json({ message: 'Error al recalcular el stock del material' });
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
                    }
                );
            });
        });
    });
});

// --- ENDPOINT PARA ALERTAS ---
app.get('/api/alertas', (req, res) => {
    const sql = `
        SELECT
            T.NOMBRE_TIPO_MATERIAL AS nombre,
            COALESCE(SUM(CASE WHEN I.ESTADO_ITEM = 1 THEN 1 ELSE 0 END), 0) AS disponibles
        FROM TIPO_MATERIALES T
        LEFT JOIN MATERIALES M ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        LEFT JOIN ITEMS_MATERIALES I ON I.ID_MATERIAL = M.ID_MATERIAL
        GROUP BY T.ID_TIPO_MATERIAL, T.NOMBRE_TIPO_MATERIAL
        HAVING disponibles < 5
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

// --- ENDPOINT PARA UBICACIONES ---
app.get('/api/ubicaciones', (req, res) => {
    db.query('SELECT ID_UBICACION, NOMBRE FROM UBICACIONES ORDER BY NOMBRE', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener ubicaciones' });
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
        SELECT
            M.ID_MATERIAL,
            M.CODIGO,
            M.NOMBRE,
            M.UBICACION,
            T.NOMBRE_TIPO_MATERIAL,
            T.MAX_DIAS_PRESTAMO,
            COALESCE(COUNT(I.ID_ITEM), 0) AS TOTAL_ITEMS,
            COALESCE(SUM(CASE WHEN I.ESTADO_ITEM = 1 THEN 1 ELSE 0 END), 0) AS DISPONIBLES
        FROM MATERIALES M
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        LEFT JOIN ITEMS_MATERIALES I ON I.ID_MATERIAL = M.ID_MATERIAL
        WHERE M.ESTADO = 1
        GROUP BY M.ID_MATERIAL, M.CODIGO, M.NOMBRE, M.UBICACION, T.NOMBRE_TIPO_MATERIAL, T.MAX_DIAS_PRESTAMO
        HAVING DISPONIBLES > 0
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

app.get('/api/materiales/:id/items-disponibles', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT ID_ITEM, CODIGO_ITEM, UBICACION_ITEM
        FROM ITEMS_MATERIALES
        WHERE ID_MATERIAL = ? AND ESTADO_ITEM = 1
        ORDER BY CODIGO_ITEM
    `;
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener ítems disponibles' });
        }
        res.json(results);
    });
});

// --- ENDPOINT PARA CREAR UN NUEVO PRÉSTAMO (¡El más importante!) ---
app.post('/api/prestamos/crear', (req, res) => {
    // Obtenemos los datos del formulario (frontend)
    const {
        id_alumno,
        id_item,
        id_usuario,
        fecha_devolucion,
        id_asignatura,
        responsable,
        observaciones
    } = req.body;

    if (!id_alumno) {
        return res.status(400).json({ message: 'Debe seleccionar un alumno válido' });
    }

    if (!id_asignatura) {
        return res.status(400).json({ message: 'La asignatura es obligatoria para registrar el préstamo' });
    }

    if (!id_item) {
        return res.status(400).json({ message: 'Debe seleccionar un ítem disponible para continuar' });
    }

    if (!fecha_devolucion) {
        return res.status(400).json({ message: 'Debe indicar la fecha estimada de devolución' });
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

    validarLimitePrestamosAlumno(id_alumno, (limiteErr, info) => {
        if (limiteErr) {
            console.error(limiteErr);
            return res.status(400).json({ message: limiteErr.message });
        }

        const prestamosActivos = info.PRESTAMOS_ACTIVOS || 0;
        if (prestamosActivos >= info.MAX_PRESTAMOS) {
            return res.status(400).json({ message: `El alumno alcanzó su límite de ${info.MAX_PRESTAMOS} préstamos activos.` });
        }

        const sqlItem = `
            SELECT I.ID_ITEM, I.ESTADO_ITEM, I.ID_MATERIAL, T.MAX_DIAS_PRESTAMO
            FROM ITEMS_MATERIALES I
            JOIN MATERIALES M ON I.ID_MATERIAL = M.ID_MATERIAL
            JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
            WHERE I.ID_ITEM = ?
            FOR UPDATE
        `;

        db.beginTransaction(err => {
            if (err) { throw err; }

            db.query(sqlItem, [id_item], (itemErr, itemResults) => {
                if (itemErr) {
                    return db.rollback(() => { console.error(itemErr); res.status(500).json({ message: 'Error al validar el ítem seleccionado' }); });
                }
                if (itemResults.length === 0) {
                    return db.rollback(() => res.status(404).json({ message: 'El ítem seleccionado no existe' }));
                }

                const itemInfo = itemResults[0];
                if (itemInfo.ESTADO_ITEM !== 1) {
                    return db.rollback(() => res.status(400).json({ message: 'El ítem ya fue asignado a otro préstamo' }));
                }

                const limiteDevolucion = new Date(fechaPrestamoServidor);
                limiteDevolucion.setDate(limiteDevolucion.getDate() + itemInfo.MAX_DIAS_PRESTAMO);
                if (fechaDevolucionDate > limiteDevolucion) {
                    return db.rollback(() => res.status(400).json({ message: `La categoría permite un máximo de ${itemInfo.MAX_DIAS_PRESTAMO} días` }));
                }

                const fechaDevolucionSQL = formatDateTimeForSQL(fechaDevolucionDate);

                const sqlSolicitud = `
                    INSERT INTO SOLICITUDES (ID_USUARIO, ID_ALUMNO, ID_ASIGNATURA, FECHA_SOLICITUD, ESTADO, RESPONSABLE, OBSERVACIONES, FECHA_DEVOLUCION)
                    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
                `;
                db.query(sqlSolicitud, [id_usuario, id_alumno, id_asignatura, fechaPrestamoSQL, responsable, observaciones || '', fechaDevolucionSQL], (solErr, solResult) => {
                    if (solErr) {
                        return db.rollback(() => { console.error(solErr); res.status(500).json({ message: 'Error al crear la solicitud' }); });
                    }

                    const idSolicitud = solResult.insertId;
                    const sqlDetalle = 'INSERT INTO DETALLE_SOLICITUD (ID_SOLICITUD, ID_ITEM) VALUES (?, ?)';
                    db.query(sqlDetalle, [idSolicitud, id_item], (detErr) => {
                        if (detErr) {
                            return db.rollback(() => { console.error(detErr); res.status(500).json({ message: 'Error al crear el detalle del préstamo' }); });
                        }

                        const sqlUpdateItem = 'UPDATE ITEMS_MATERIALES SET ESTADO_ITEM = 2 WHERE ID_ITEM = ?';
                        db.query(sqlUpdateItem, [id_item], (updErr) => {
                            if (updErr) {
                                return db.rollback(() => { console.error(updErr); res.status(500).json({ message: 'Error al actualizar el estado del ítem' }); });
                            }

                            recalculateMaterialStock(itemInfo.ID_MATERIAL, (stockErr) => {
                                if (stockErr) {
                                    return db.rollback(() => { console.error(stockErr); res.status(500).json({ message: 'Error al recalcular el stock del material' }); });
                                }

                                db.commit(commitErr => {
                                    if (commitErr) {
                                        return db.rollback(() => { console.error(commitErr); res.status(500).json({ message: 'Error al confirmar el préstamo' }); });
                                    }
                                    res.status(201).json({ success: true, message: '¡Préstamo registrado exitosamente!' });
                                });
                            });
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
            I.ID_ITEM,
            I.CODIGO_ITEM,
            A.NOMBRE as ALUMNO_NOMBRE,
            A.APELLIDO as ALUMNO_APELLIDO,
            A.CURSO,
            M.NOMBRE as MATERIAL_NOMBRE,
            T.NOMBRE_TIPO_MATERIAL,
            ASIG.NOMBRE AS ASIGNATURA,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN ITEMS_MATERIALES I ON DS.ID_ITEM = I.ID_ITEM
        JOIN MATERIALES M ON I.ID_MATERIAL = M.ID_MATERIAL
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
        id_item,
        id_usuario_encargado, // El ID del que presiona el botón
        estado_material,
        observaciones,
        fecha_recepcion
    } = req.body;

    if (!id_item) {
        return res.status(400).json({ message: 'No se recibió el identificador del ítem a devolver' });
    }

    const fechaRecepcionDate = new Date(fecha_recepcion || Date.now());
    if (Number.isNaN(fechaRecepcionDate.getTime())) {
        return res.status(400).json({ message: 'La fecha de recepción no es válida' });
    }
    const fechaRecepcionSQL = formatDateTimeForSQL(fechaRecepcionDate);

    db.beginTransaction(err => {
        if (err) { throw err; }

        const sqlItem = 'SELECT ID_MATERIAL FROM ITEMS_MATERIALES WHERE ID_ITEM = ? FOR UPDATE';
        db.query(sqlItem, [id_item], (itemErr, itemResults) => {
            if (itemErr) {
                return db.rollback(() => { console.error(itemErr); res.status(500).json({ message: 'Error al validar el ítem' }); });
            }
            if (itemResults.length === 0) {
                return db.rollback(() => res.status(404).json({ message: 'Ítem no encontrado' }));
            }

            const materialId = itemResults[0].ID_MATERIAL;

            const sqlSolicitud = 'UPDATE SOLICITUDES SET ESTADO = 2 WHERE ID_SOLICITUD = ?';
            db.query(sqlSolicitud, [id_solicitud], (solErr) => {
                if (solErr) {
                    return db.rollback(() => { console.error(solErr); res.status(500).json({ message: 'Error al actualizar la solicitud' }); });
                }

                const sqlUpdateItem = 'UPDATE ITEMS_MATERIALES SET ESTADO_ITEM = 1 WHERE ID_ITEM = ?';
                db.query(sqlUpdateItem, [id_item], (updErr) => {
                    if (updErr) {
                        return db.rollback(() => { console.error(updErr); res.status(500).json({ message: 'Error al actualizar el estado del ítem' }); });
                    }

                    recalculateMaterialStock(materialId, (stockErr) => {
                        if (stockErr) {
                            return db.rollback(() => { console.error(stockErr); res.status(500).json({ message: 'Error al recalcular el stock del material' }); });
                        }

                        obtenerNombreUsuario(id_usuario_encargado, (userErr, nombreUsuario) => {
                            if (userErr) {
                                return db.rollback(() => { console.error(userErr); res.status(500).json({ message: 'Error al obtener el nombre del encargado' }); });
                            }

                            const sqlRecepcion = `
                                INSERT INTO RECEPCIONES_MATERIAL (ID_DETALLE, ID_USUARIO, NOMBRE_USUARIO, CANTIDAD_RECIBIDA, ESTADO_MATERIAL, OBSERVACIONES, FECHA_RECEPCION)
                                VALUES (?, ?, ?, 1, ?, ?, ?)
                            `;
                            db.query(sqlRecepcion, [id_detalle, id_usuario_encargado, nombreUsuario, estado_material || 'Bueno', observaciones || '', fechaRecepcionSQL], (recErr) => {
                                if (recErr) {
                                    return db.rollback(() => { console.error(recErr); res.status(500).json({ message: 'Error al registrar la recepción' }); });
                                }

                                const sqlDetalle = 'UPDATE DETALLE_SOLICITUD SET ESTADO_DEVOLUCION = ?, OBSERVACIONES_DEVOLUCION = ? WHERE ID_DETALLE = ?';
                                db.query(sqlDetalle, [estado_material || 'Bueno', observaciones || '', id_detalle], (detErr) => {
                                    if (detErr) {
                                        return db.rollback(() => { console.error(detErr); res.status(500).json({ message: 'Error al actualizar el detalle' }); });
                                    }

                                    db.commit(commitErr => {
                                        if (commitErr) {
                                            return db.rollback(() => { console.error(commitErr); res.status(500).json({ message: 'Error al confirmar la devolución' }); });
                                        }
                                        res.status(200).json({ success: true, message: '¡Devolución registrada exitosamente!' });
                                    });
                                });
                            });
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
            I.CODIGO_ITEM,
            T.NOMBRE_TIPO_MATERIAL,
            ASIG.NOMBRE AS ASIGNATURA,
            S.FECHA_SOLICITUD,
            S.FECHA_DEVOLUCION,
            S.ESTADO,
            RM.NOMBRE_USUARIO,
            RM.FECHA_RECEPCION
        FROM SOLICITUDES S
        JOIN ALUMNOS A ON S.ID_ALUMNO = A.ID_ALUMNO
        JOIN DETALLE_SOLICITUD DS ON S.ID_SOLICITUD = DS.ID_SOLICITUD
        JOIN ITEMS_MATERIALES I ON DS.ID_ITEM = I.ID_ITEM
        JOIN MATERIALES M ON I.ID_MATERIAL = M.ID_MATERIAL
        JOIN TIPO_MATERIALES T ON M.ID_TIPO_MATERIAL = T.ID_TIPO_MATERIAL
        JOIN ASIGNATURAS ASIG ON S.ID_ASIGNATURA = ASIG.ID_ASIGNATURA
        LEFT JOIN RECEPCIONES_MATERIAL RM ON RM.ID_DETALLE = DS.ID_DETALLE
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