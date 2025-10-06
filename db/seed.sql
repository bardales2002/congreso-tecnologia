SET NAMES utf8mb4;

INSERT IGNORE INTO actividades (tipo, nombre, descripcion, horario, cupo) VALUES
('taller','Desarrollo Web con Node','Node.js básico para web','10:15 – 12:00',60),
('taller','Introducción a IA','Fundamentos de IA aplicada','10:15 – 12:00',60),
('competencia','Hackathon','Proyecto libre de 1 día','14:00 – 18:00',120),
('competencia','Reto de Algoritmos','Problemas de programación competitiva','14:00 – 18:00',80);

INSERT IGNORE INTO usuarios (nombre, correo, tipo, colegio, telefono) VALUES
('Estudiante Interno Ejemplo','interno1@miumg.edu.gt','interno',NULL,'5555-0001'),
('Estudiante Externo Ejemplo','externo1@gmail.com','externo','Colegio Demo','5555-0002');

INSERT IGNORE INTO inscripciones (id_usuario, id_actividad)
SELECT u.id, a.id
FROM usuarios u
JOIN actividades a ON a.nombre IN ('Desarrollo Web con Node','Hackathon')
WHERE u.correo IN ('interno1@miumg.edu.gt','externo1@gmail.com');

INSERT IGNORE INTO asistencias (id_usuario, id_actividad)
SELECT u.id, NULL FROM usuarios u WHERE u.correo='interno1@miumg.edu.gt';
