CREATE DATABASE IF NOT EXISTS `requify_demoV0.3`;
USE `requify_demoV0.3`;

/* Desactivar revisión de llaves foráneas para evitar errores al crear */
SET FOREIGN_KEY_CHECKS = 0;

/* 2. BORRAR TABLAS SI EXISTEN (Para empezar limpio) */
DROP TABLE IF EXISTS RECEPCIONES_MATERIAL;
DROP TABLE IF EXISTS DETALLE_SOLICITUD;
DROP TABLE IF EXISTS HISTORIAL_ESTADOS;
DROP TABLE IF EXISTS SOLICITUDES;
DROP TABLE IF EXISTS MATERIALES;
DROP TABLE IF EXISTS TIPO_MATERIALES;
DROP TABLE IF EXISTS USUARIOS;
DROP TABLE IF EXISTS ROLES;
DROP TABLE IF EXISTS ALUMNOS; 

/* 3. CREACIÓN DE TABLAS */

/* Tabla: ROLES */
create table ROLES
(
   ID_ROL               int not null auto_increment,
   NOMBRE_ROL           varchar(30),
   primary key (ID_ROL)
);

/* Tabla: USUARIOS */
create table USUARIOS
(
   ID_USUARIO           int not null auto_increment,
   ID_ROL               int not null,
   USERNAME             varchar(50) NOT NULL UNIQUE, /* (Clave para el Login) */
   NOMBRE               varchar(150),
   APELLIDO             varchar(60),
   EMAIL                varchar(40),
   PASSWORD             varchar(100),
   ESTADO               int,
   FECHA_LOGIN          datetime,
   FECHA_ALTA           datetime,
   primary key (ID_USUARIO),
   CONSTRAINT FK_USUARIO_POSEE FOREIGN KEY (ID_ROL) REFERENCES ROLES (ID_ROL)
);

/* Tabla: TIPO_MATERIALES (Categorías) */
create table TIPO_MATERIALES
(
   ID_TIPO_MATERIAL     int not null auto_increment,
   NOMBRE_TIPO_MATERIAL varchar(30),
   primary key (ID_TIPO_MATERIAL)
);

/* Tabla: MATERIALES (Con Stock Simple - Lo que funcionaba antes) */
create table MATERIALES
(
   ID_MATERIAL          int not null auto_increment,
   ID_TIPO_MATERIAL     int not null,
   NOMBRE               varchar(150),
   DESCRIPCION          text,
   CANTIDAD_TOTAL       int,        /* Stock Total */
   CANTIDAD_DISPONIBLE  int,        /* Stock Disponible */
   ESTADO               int,
   UBICACION            varchar(100), /* Texto plano */
   primary key (ID_MATERIAL),
   CONSTRAINT FK_MATERIAL_ES_DE_UN FOREIGN KEY (ID_TIPO_MATERIAL) REFERENCES TIPO_MATERIALES (ID_TIPO_MATERIAL)
);

/* Tabla: ALUMNOS (Necesaria para el selector) */
create table ALUMNOS
(
  ID_ALUMNO int not null auto_increment,
  RUT varchar(12),
  NOMBRE varchar(150),
  APELLIDO varchar(60),
  CURSO varchar(50),
  primary key (ID_ALUMNO)
);

/* Tabla: SOLICITUDES (Cabecera del Préstamo) */
create table SOLICITUDES
(
   ID_SOLICITUD         int not null auto_increment,
   ID_USUARIO           int not null, /* El encargado */
   ID_ALUMNO            int,          /* El alumno */
   FECHA_SOLICITUD      datetime,
   ESTADO               int,          /* 1=Activo, 2=Devuelto */
   FECHA_DEVOLUCION     datetime,
   RESPONSABLE          varchar(100),
   OBSERVACIONES        text,
   primary key (ID_SOLICITUD),
   CONSTRAINT FK_USUARIO_REALIZA FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS (ID_USUARIO)
);

/* Tabla: DETALLE_SOLICITUD (Detalle del Préstamo) */
create table DETALLE_SOLICITUD
(
   ID_DETALLE           int not null auto_increment,
   ID_SOLICITUD         int not null,
   ID_MATERIAL          int not null, /* Se conecta al MATERIAL, no al ítem único */
   CANTIDAD_SOLICITADA  int,
   CANTIDAD_ENTREGADA   int,
   /* Campos extra para devolución */
   ESTADO_DEVOLUCION    varchar(100),
   OBSERVACIONES_DEVOLUCION text,
   primary key (ID_DETALLE),
   CONSTRAINT FK_SOLICITUD_SE_GUARDA_EN FOREIGN KEY (ID_SOLICITUD) REFERENCES SOLICITUDES (ID_SOLICITUD),
   CONSTRAINT FK_MATERIAL_POSEE FOREIGN KEY (ID_MATERIAL) REFERENCES MATERIALES (ID_MATERIAL)
);

/* Tabla: RECEPCIONES_MATERIAL (Historial de devoluciones) */
create table RECEPCIONES_MATERIAL
(
   ID_RECEPCION         int not null auto_increment,
   ID_DETALLE           int not null,
   ID_USUARIO           int not null,
   CANTIDAD_RECIBIDA    int,
   ESTADO_MATERIAL      varchar(100), /* Texto plano */
   OBSERVACIONES        text,
   FECHA_RECEPCION      datetime,
   primary key (ID_RECEPCION),
   CONSTRAINT FK_SE_ALMACENA_ESTADO FOREIGN KEY (ID_DETALLE) REFERENCES DETALLE_SOLICITUD (ID_DETALLE),
   CONSTRAINT FK_USUARIO_RECIBE FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS (ID_USUARIO)
);

/* Tabla: HISTORIAL_ESTADOS (Auditoría) */
create table HISTORIAL_ESTADOS
(
   ID_HISTORIAL         int not null auto_increment,
   ID_SOLICITUD         int not null,
   ESTADO_ANTERIOR      varchar(50),
   ESTADO_NUEVO         varchar(50),
   FECHA_CAMBIO         datetime,
   primary key (ID_HISTORIAL),
   CONSTRAINT FK_POSEE_SOLICITUDES FOREIGN KEY (ID_SOLICITUD) REFERENCES SOLICITUDES (ID_SOLICITUD)
);


/* 4. DATOS DE PRUEBA INICIALES */

/* Roles */
INSERT INTO ROLES (NOMBRE_ROL) VALUES ('Administrador'), ('Encargado de Recursos');

/* Tipos de Materiales */
INSERT INTO TIPO_MATERIALES (NOMBRE_TIPO_MATERIAL) VALUES 
('Tablets'), ('Notebooks'), ('Libros'), ('Material Deportivo');

/* Materiales (Con Stock) */
INSERT INTO MATERIALES (ID_TIPO_MATERIAL, NOMBRE, CANTIDAD_TOTAL, CANTIDAD_DISPONIBLE, ESTADO, UBICACION) VALUES
(1, 'Tablet Samsung Galaxy Tab A8', 20, 20, 1, 'Bodega A-1'),
(2, 'Notebook HP 14-dq2055wm', 100, 100, 1, 'Carro B-1'),
(3, 'Libro "El Quijote"', 50, 50, 1, 'Biblioteca'),
(4, 'Balón de Fútbol N°5', 30, 30, 1, 'Gimnasio');

/* Alumnos */
INSERT INTO ALUMNOS (RUT, NOMBRE, APELLIDO, CURSO) VALUES 
('12.345.678-9', 'Diego', 'Soto', '8° A'),
('23.456.789-0', 'María', 'Castillo', '7° B');

/* Usuario Admin (Contraseña simple para empezar) */
INSERT INTO USUARIOS (ID_ROL, USERNAME, NOMBRE, APELLIDO, EMAIL, PASSWORD, ESTADO, FECHA_ALTA)
VALUES (1, 'admin', 'Pedro', 'Fernández', 'admin@requify.cl', 'admin123', 1, NOW());

/* Reactivar seguridad */
SET FOREIGN_KEY_CHECKS = 1;