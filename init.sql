-- Azure Database for MySQL: crea la BD desde el portal y ejecuta este script dentro de esa BD.

-- Usuarios (admin/estudiante)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  role ENUM('admin','student') NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  career VARCHAR(255),
  cycle VARCHAR(50),
  campus ENUM('arequipa','huancayo','ica','lima','ayacucho','cusco'),
  password_hash VARCHAR(255),
  b2c_sub VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Postulaciones abiertas (sin cuenta)
CREATE TABLE IF NOT EXISTS applications (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  proposal TEXT NOT NULL,
  attachments_json JSON,
  status ENUM('submitted','reviewed','approved','rejected') DEFAULT 'submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fases (Postulación, Selección, Desarrollo, Demo)
CREATE TABLE IF NOT EXISTS phases (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_date DATE,
  end_date DATE,
  position INT DEFAULT 0
);

-- Proyectos (una vez aprobados)
CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  student_id CHAR(36) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  research_line VARCHAR(255),
  ods_json JSON,
  industry VARCHAR(255),
  current_phase CHAR(36),
  score INT DEFAULT 0,
  invite_code CHAR(12) UNIQUE,
  approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_by CHAR(36),
  status ENUM('draft','active','completed','archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (current_phase) REFERENCES phases(id)
);

-- Migración segura para guardar ODS seleccionados por proyecto.
SET @project_ods_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'ods_json'
);
SET @project_ods_sql := IF(
  @project_ods_exists = 0,
  'ALTER TABLE projects ADD COLUMN ods_json JSON',
  'SELECT 1'
);
PREPARE project_ods_stmt FROM @project_ods_sql;
EXECUTE project_ods_stmt;
DEALLOCATE PREPARE project_ods_stmt;

-- Miembros de proyecto
CREATE TABLE IF NOT EXISTS project_members (
  project_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('owner','member') DEFAULT 'member',
  responsibility VARCHAR(500),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Migración segura para agregar columna responsibility si la BD ya existía.
SET @pm_resp_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_members'
    AND COLUMN_NAME = 'responsibility'
);
SET @pm_sql := IF(
  @pm_resp_exists = 0,
  'ALTER TABLE project_members ADD COLUMN responsibility VARCHAR(500)',
  'SELECT 1'
);
PREPARE pm_stmt FROM @pm_sql;
EXECUTE pm_stmt;
DEALLOCATE PREPARE pm_stmt;

-- Entregas por fase
CREATE TABLE IF NOT EXISTS submissions (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  phase_id CHAR(36) NOT NULL,
  url VARCHAR(500) NOT NULL,
  comment TEXT,
  feedback TEXT,
  status ENUM('sent','approved','changes') DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (phase_id) REFERENCES phases(id)
);

-- Rúbrica y puntajes
CREATE TABLE IF NOT EXISTS rubrics (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  criterion VARCHAR(255) NOT NULL,
  weight DECIMAL(5,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  rubric_id CHAR(36) NOT NULL,
  value DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (rubric_id) REFERENCES rubrics(id)
);

-- Mensajería interna
CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Agenda de asesorías
CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  slot_start DATETIME NOT NULL,
  status ENUM('requested','approved','declined','done') DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Reservas de FabLab (bloque de tiempo)
CREATE TABLE IF NOT EXISTS reservations (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36),
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  status ENUM('requested','approved','declined','cancelled','blocked') DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by CHAR(36),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Tareas enviadas por admin (globales o por proyecto)
CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_at DATETIME,
  scope ENUM('global','project') NOT NULL,
  category VARCHAR(120),
  task_group VARCHAR(120),
  active TINYINT(1) DEFAULT 0,
  points INT DEFAULT 0,
  icon_key VARCHAR(50),
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Migración segura para agregar columna active si la BD ya existía.
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'active'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE tasks ADD COLUMN active TINYINT(1) DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migración segura para agregar columnas category/task_group si la BD ya existía.
SET @task_category_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'category'
);
SET @task_group_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'task_group'
);
SET @task_sql := IF(
  @task_category_exists = 0,
  'ALTER TABLE tasks ADD COLUMN category VARCHAR(120)',
  'SELECT 1'
);
PREPARE task_stmt FROM @task_sql;
EXECUTE task_stmt;
DEALLOCATE PREPARE task_stmt;

SET @task_group_sql := IF(
  @task_group_exists = 0,
  'ALTER TABLE tasks ADD COLUMN task_group VARCHAR(120)',
  'SELECT 1'
);
PREPARE task_group_stmt FROM @task_group_sql;
EXECUTE task_group_stmt;
DEALLOCATE PREPARE task_group_stmt;

CREATE TABLE IF NOT EXISTS task_projects (
  task_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  active TINYINT(1) DEFAULT 0,
  PRIMARY KEY (task_id, project_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Migración segura para activar/desactivar tareas por proyecto.
-- Si la columna no existía, se copia el estado actual de tasks.active una sola vez.
SET @task_project_active_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'task_projects'
    AND COLUMN_NAME = 'active'
);
SET @task_project_active_sql := IF(
  @task_project_active_exists = 0,
  'ALTER TABLE task_projects ADD COLUMN active TINYINT(1) DEFAULT 0',
  'SELECT 1'
);
PREPARE task_project_active_stmt FROM @task_project_active_sql;
EXECUTE task_project_active_stmt;
DEALLOCATE PREPARE task_project_active_stmt;

SET @task_project_active_backfill_sql := IF(
  @task_project_active_exists = 0,
  'UPDATE task_projects tp JOIN tasks t ON t.id = tp.task_id SET tp.active = t.active',
  'SELECT 1'
);
PREPARE task_project_active_backfill_stmt FROM @task_project_active_backfill_sql;
EXECUTE task_project_active_backfill_stmt;
DEALLOCATE PREPARE task_project_active_backfill_stmt;

CREATE TABLE IF NOT EXISTS task_submissions (
  id CHAR(36) PRIMARY KEY,
  task_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  submitted_by CHAR(36) NOT NULL,
  url VARCHAR(500),
  comment TEXT,
  status ENUM('submitted','reviewed') DEFAULT 'submitted',
  feedback TEXT,
  points INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id)
);

-- Notificaciones para admin y estudiantes
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  project_id CHAR(36),
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Auditoría básica
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entity VARCHAR(50),
  entity_id CHAR(36),
  action VARCHAR(50),
  actor_id CHAR(36),
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registros de Scimanage (papers)
CREATE TABLE IF NOT EXISTS scimanage_papers (
  id VARCHAR(64) PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  integrantes INT NOT NULL DEFAULT 1,
  sede VARCHAR(120) NOT NULL,
  ods_json JSON NOT NULL,
  linea_investigacion VARCHAR(255) NOT NULL,
  pais_revista VARCHAR(120) NOT NULL,
  status ENUM('en_proceso','finalizado') NOT NULL DEFAULT 'en_proceso',
  link_revista TEXT,
  pago_status ENUM('pendiente','pagado') NOT NULL DEFAULT 'pendiente',
  pago_drive_url TEXT,
  pago_monto_pen DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

-- Migración segura para registrar monto pagado de papers en soles.
SET @scimanage_paper_amount_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'scimanage_papers'
    AND COLUMN_NAME = 'pago_monto_pen'
);
SET @scimanage_paper_amount_sql := IF(
  @scimanage_paper_amount_exists = 0,
  'ALTER TABLE scimanage_papers ADD COLUMN pago_monto_pen DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE scimanage_paper_amount_stmt FROM @scimanage_paper_amount_sql;
EXECUTE scimanage_paper_amount_stmt;
DEALLOCATE PREPARE scimanage_paper_amount_stmt;

-- Registros de Scimanage (patentes)
CREATE TABLE IF NOT EXISTS scimanage_patents (
  id VARCHAR(64) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  inventor VARCHAR(255) NOT NULL,
  sede VARCHAR(120) NOT NULL,
  categoria ENUM('modelo_inventiva','modelo_utilidad','diseno_industrial') NOT NULL,
  status ENUM('inicio','en_proceso','finalizado') NOT NULL DEFAULT 'inicio',
  link TEXT,
  numero_expediente VARCHAR(120) NOT NULL,
  fecha_solicitud DATE NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

-- Estado persistente de overrides TRL (evita perder cambios en reinicios/redeploy)
CREATE TABLE IF NOT EXISTS trl_overrides_state (
  id TINYINT NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO trl_overrides_state (id, payload)
VALUES (
  1,
  JSON_OBJECT(
    'forceApproved', JSON_OBJECT(),
    'deletedProjects', JSON_OBJECT(),
    'migratedProjects', JSON_OBJECT(),
    'emailSends', JSON_OBJECT()
  )
)
ON DUPLICATE KEY UPDATE id = id;
-- Datos semilla mínimos
INSERT INTO phases (id, name, position) VALUES
  ('00000000-0000-0000-0000-000000000001','Postulación',1),
  ('00000000-0000-0000-0000-000000000002','Selección',2),
  ('00000000-0000-0000-0000-000000000003','Desarrollo',3),
  ('00000000-0000-0000-0000-000000000004','Demo',4)
ON DUPLICATE KEY UPDATE name = VALUES(name), position = VALUES(position);

-- Touchpoints por categoría (inactivos por defecto)
INSERT INTO tasks (id, title, description, scope, category, task_group, active, points, created_by)
VALUES
  -- Propiedad intelectual
  ('00000000-0000-0000-0000-00000000pi01', 'TP 1 - Informe de Clasificación y Tipo', 'Definición de si es Patente de Invención, Modelo de Utilidad o Diseño Industrial.', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 5, NULL),
  ('00000000-0000-0000-0000-00000000pi02', 'TP 2 - Búsqueda de Arte Previo', 'Reporte de antecedentes encontrados en bases de datos (nacionales e internacionales).', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000pi03', 'TP 3 - Borrador de Resumen', 'Exposición breve de la invención y el problema técnico que resuelve.', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000pi04', 'TP 4 - Set de Dibujos Técnicos (V1)', 'Figuras, esquemas o diagramas de flujo que representan la invención (basado en el prototipo inicial).', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000pi05', 'TP 5 - Descripción: Memoria Descriptiva', 'Redacción detallada de la invención, destacando el aporte a la tecnología anterior.', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 10, NULL),
  ('00000000-0000-0000-0000-00000000pi06', 'TP 6 - Cuadro de Reivindicaciones', 'Listado de las características técnicas novedosas sobre las que se solicita protección legal.', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 12, NULL),
  ('00000000-0000-0000-0000-00000000pi07', 'TP 7 - Documento Técnico Final', 'Consolidación de: Resumen + Dibujos + Descripción + Reivindicaciones.', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 15, NULL),
  ('00000000-0000-0000-0000-00000000pi08', 'TP 8 - Expediente de Solicitud Listo', 'Revisión final de requisitos de admisibilidad (Checklist para INDECOPI).', 'global', 'Propiedad intelectual', 'Touchpoints', 0, 10, NULL),
  -- Producción científica
  ('00000000-0000-0000-0000-00000000pc01', 'TP 1 - Identidad Digital del Investigador', 'Creación de perfiles en ORCID y CRIS UC.', 'global', 'Producción científica', 'Touchpoints', 0, 5, NULL),
  ('00000000-0000-0000-0000-00000000pc02', 'TP 2 - Gestión de Referencias', 'Instalación y configuración de Mendeley o Zotero con las primeras 10 fuentes bibliográficas.', 'global', 'Producción científica', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000pc03', 'TP 3 - Protocolo de Investigación', 'Definición de la pregunta de investigación y objetivos (General y Específicos).', 'global', 'Producción científica', 'Touchpoints', 0, 7, NULL),
  ('00000000-0000-0000-0000-00000000pc04', 'TP 4 - Target de Publicación', 'Identificación de 2 revistas en Scimago (Q1/Q2) o Proceedings afines al proyecto.', 'global', 'Producción científica', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000pc05', 'TP 5 - Cuerpo del Paper: Introducción', 'Redacción de la Introducción y el Estado del Arte (Formato IMRyD).', 'global', 'Producción científica', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000pc06', 'TP 6 - Cuerpo del Paper: Metodología', 'Redacción de la sección de Materiales y Métodos (lo realizado en el FabLab).', 'global', 'Producción científica', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000pc07', 'TP 7 - Cuerpo del Paper: Resultados', 'Redacción de Resultados y Discusión (basado en las pruebas del prototipo).', 'global', 'Producción científica', 'Touchpoints', 0, 10, NULL),
  ('00000000-0000-0000-0000-00000000pc08', 'TP 8 - Manuscrito Final (Ready for Submission)', 'Artículo completo en formato IMRyD con Conclusiones y Referencias bibliográficas.', 'global', 'Producción científica', 'Touchpoints', 0, 12, NULL),
  -- Desarrollo tecnológico
  ('00000000-0000-0000-0000-00000000dt01', 'TP 1 - Concepto y Factibilidad', 'Definición técnica de la solución y alcance del proyecto.', 'global', 'Desarrollo tecnológico', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000dt02', 'TP 2 - BOM y Procesos', 'Listado de componentes y selección de procesos FabLab (Corte láser, 3D, CNC) con presupuesto.', 'global', 'Desarrollo tecnológico', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000dt03', 'TP 3 - Diseño Preliminar', 'Primeros esquemáticos y bocetos iniciales (mano alzada o digital).', 'global', 'Desarrollo tecnológico', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000dt04', 'TP 4 - Prototipo de Baja Fidelidad', 'Mockup rápido (cartón, espuma o piezas básicas) para validar escala y volumen.', 'global', 'Desarrollo tecnológico', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000dt05', 'TP 5 - Diseño CAD Avanzado', 'Archivos de fabricación digital (Rhinoceros, Onshape, Fusion 360) listos para máquinas.', 'global', 'Desarrollo tecnológico', 'Touchpoints', 0, 10, NULL),
  ('00000000-0000-0000-0000-00000000dt06', 'TP 6 - Prototipo Funcional', 'Ensamble de la electrónica y estructura base. El invento ya \"hace\" algo.', 'global', 'Desarrollo tecnológico', 'Touchpoints', 0, 12, NULL),
  ('00000000-0000-0000-0000-00000000dt07', 'TP 7 - Prototipo de Alta Fidelidad', 'Versión final con acabados, optimización de materiales y ensamblaje definitivo.', 'global', 'Desarrollo tecnológico', 'Touchpoints', 0, 14, NULL),
  ('00000000-0000-0000-0000-00000000dt08', 'TP 8 - Producto Final (MVP)', 'Entrega del MVP operando y el Video Demo de funcionamiento real.', 'global', 'Desarrollo tecnologico', 'Touchpoints', 0, 15, NULL),
  -- Makerpreneur
  ('00000000-0000-0000-0000-00000000mk01', 'TP 1 - Problem-Solution Fit', 'Validación del problema: realmente existe el dolor que intento resolver.', 'global', 'Makerpreneur', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000mk02', 'TP 2 - Usuario y Público Objetivo', 'Definición del User Persona y perfil del cliente ideal.', 'global', 'Makerpreneur', 'Touchpoints', 0, 6, NULL),
  ('00000000-0000-0000-0000-00000000mk03', 'TP 3 - Datos del Mercado (TAM, SAM, SOM)', 'Estimación del tamaño del mercado: Total, Alcanzable y el segmento al que atacarán primero.', 'global', 'Makerpreneur', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000mk04', 'TP 4 - Lean Canvas (V1)', 'Primera versión del modelo de negocio de una sola página.', 'global', 'Makerpreneur', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000mk05', 'TP 5 - Propuesta de Valor Técnica', 'Qué hace a este invento mejor que lo que ya existe en el mercado (conexión con patentes).', 'global', 'Makerpreneur', 'Touchpoints', 0, 10, NULL),
  ('00000000-0000-0000-0000-00000000mk06', 'TP 6 - Mecanismo de Monetización', 'Definición de cómo ganará dinero (suscripción, venta directa, licenciamiento, etc.).', 'global', 'Makerpreneur', 'Touchpoints', 0, 8, NULL),
  ('00000000-0000-0000-0000-00000000mk07', 'TP 7 - Modelo de Negocio Validado', 'Ajuste final del Lean Canvas tras recibir feedback de usuarios reales.', 'global', 'Makerpreneur', 'Touchpoints', 0, 12, NULL),
  ('00000000-0000-0000-0000-00000000mk08', 'TP 8 - Pitch Deck & Roadmap', 'Presentación comercial del proyecto y plan de los próximos 6 meses post-Fellowship.', 'global', 'Makerpreneur', 'Touchpoints', 0, 12, NULL)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  scope = VALUES(scope),
  category = VALUES(category),
  task_group = VALUES(task_group),
  active = VALUES(active),
  points = VALUES(points);

-- Usuarios base (1 admin, 2 estudiantes)
INSERT INTO users (id, role, email, name, password_hash)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', 'gestion@conocimiento.fablab', 'Admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'),
  ('22222222-2222-2222-2222-222222222222', 'student', 'estudiante1@fellowship.test', 'Estudiante Uno', NULL),
  ('33333333-3333-3333-3333-333333333333', 'student', 'estudiante2@fellowship.test', 'Estudiante Dos', NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), password_hash = VALUES(password_hash);

