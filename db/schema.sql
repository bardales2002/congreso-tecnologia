SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(100)  NOT NULL,
  correo     VARCHAR(100)  NOT NULL UNIQUE,
  tipo       ENUM('interno','externo') NOT NULL,
  colegio    VARCHAR(100),
  telefono   VARCHAR(20),
  qr         LONGTEXT,
  creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS actividades (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tipo        ENUM('taller','competencia') NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  horario     VARCHAR(50),
  cupo        INT,
  creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_act_tipo_nombre (tipo, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inscripciones (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario      INT NOT NULL,
  id_actividad    INT NOT NULL,
  inscrito_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  diploma_enviado TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_inscripcion (id_usuario, id_actividad),
  CONSTRAINT fk_insc_user FOREIGN KEY (id_usuario)   REFERENCES usuarios(id)   ON DELETE CASCADE,
  CONSTRAINT fk_insc_act  FOREIGN KEY (id_actividad) REFERENCES actividades(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asistencias (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario   INT NOT NULL,
  id_actividad INT NULL,
  fecha_hora   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asist_user FOREIGN KEY (id_usuario)   REFERENCES usuarios(id)   ON DELETE CASCADE,
  CONSTRAINT fk_asist_act  FOREIGN KEY (id_actividad) REFERENCES actividades(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS diplomas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario     INT NOT NULL,
  id_actividad   INT NOT NULL,
  url_pdf        VARCHAR(255) NOT NULL,
  fecha_generado DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dipl_user FOREIGN KEY (id_usuario)   REFERENCES usuarios(id)   ON DELETE CASCADE,
  CONSTRAINT fk_dipl_act  FOREIGN KEY (id_actividad) REFERENCES actividades(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resultados (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_actividad  INT NOT NULL,
  puesto        TINYINT NOT NULL,
  id_usuario    INT NOT NULL,
  descripcion   TEXT,
  foto_url      VARCHAR(255),
  anio          INT NOT NULL,
  publicado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_act   FOREIGN KEY (id_actividad) REFERENCES actividades(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_user  FOREIGN KEY (id_usuario)   REFERENCES usuarios(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  correo        VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           ENUM('staff','coordinador','superadmin') DEFAULT 'staff',
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
