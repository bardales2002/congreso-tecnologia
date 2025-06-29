/**************************************************************
 *  Congreso de Tecnología  –  Backend (Node + Express + MySQL)
 **************************************************************/

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const mysql        = require('mysql2');
const nodemailer   = require('nodemailer');
const QRCode       = require('qrcode');
const PDFDocument  = require('pdfkit');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ╔═ Helpers ─────────────────────────────────────────────── */

/* 1. Generar PDF (Buffer) */
function generarDiploma({ nombre, actividad, fecha }, cb) {
  const doc     = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks  = [];

  doc.on('data', ch => chunks.push(ch));
  doc.on('end', () => cb(null, Buffer.concat(chunks)));
  doc.on('error', cb);

  doc
    .fontSize(26)
    .fillColor('#b60000')
    .text('Universidad Mariano Gálvez de Guatemala', { align: 'center' })
    .moveDown(2);

  doc
    .fontSize(22)
    .fillColor('#000')
    .text('Diploma de Participación', { align: 'center' })
    .moveDown(2);

  doc.fontSize(16).text('Se otorga a:', { align: 'center' }).moveDown(0.5);

  doc
    .fontSize(20)
    .fillColor('#b60000')
    .text(nombre, { align: 'center', underline: true })
    .moveDown(1.5);

  doc
    .fontSize(16)
    .fillColor('#000')
    .text(`Por su participación en el ${actividad}`, { align: 'center' })
    .moveDown(2);

  doc
    .fontSize(14)
    .text(`Guatemala, ${fecha}`, { align: 'right' });

  doc.end();
}

/* 2. Enviar diploma por correo */
function enviarDiploma(datos, correoDestino, cb) {
  generarDiploma(datos, (errPDF, bufferPDF) => {
    if (errPDF) return cb(errPDF);

    const mailOptions = {
      from   : `"Congreso de Tecnología" <${process.env.SMTP_USER}>`,
      to     : correoDestino,
      subject: 'Diploma de participación',
      html   : `<p>Hola <strong>${datos.nombre}</strong>:</p>
                <p>Adjunto encontrarás tu diploma por el ${datos.actividad}.</p>
                <p>¡Gracias por participar!</p>`,
      attachments: [{ filename: 'diploma.pdf', content: bufferPDF }]
    };

    transporter.sendMail(mailOptions, cb);          // cb(err, info)
  });
}

/* ╔═ Middleware ──────────────────────────────────────────── */
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/* ╔═ Conexión MySQL ─────────────────────────────────────── */
const db = mysql.createConnection({
  host    : process.env.DB_HOST,
  user    : process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true          // ← importante para reportes
});

db.connect(err => {
  if (err) { console.error('❌ MySQL:', err); process.exit(1); }
  console.log('✅ Conectado a MySQL');
});

/* ╔═ Nodemailer ─────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  host  : process.env.SMTP_HOST,
  port  : Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth  : { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

/* ╔═ Rutas básicas ──────────────────────────────────────── */
app.get('/', (_, res) => res.send('Servidor Node funcionando 🚀'));

/* ╔═ POST /api/inscribir ───────────────────────────────── */
app.post('/api/inscribir', (req, res) => {
  const { nombre, correo, colegio, telefono, tipo, actividades = [] } = req.body;

  if (tipo === 'interno' &&
      !correo.toLowerCase().endsWith(
        process.env.ALLOWED_DOMAIN.toLowerCase().trim())) {
    return res.json({ success:false,
      msg:`Debes usar un correo que termine en ${process.env.ALLOWED_DOMAIN}` });
  }

  // 1. Insertar usuario
  const sqlU = `INSERT INTO usuarios (nombre, correo, colegio, telefono, tipo)
                VALUES (?,?,?,?,?)`;
  db.query(sqlU, [nombre, correo, colegio, telefono, tipo], (err, r) => {
    if (err) { console.error(err); return res.json({ success:false }); }
    const idUsuario = r.insertId;

    // 2. Insertar inscripciones (si marcó actividades)
    if (actividades.length) {
      const valores = actividades.map(id => [idUsuario, id]);
      db.query('INSERT INTO inscripciones (id_usuario,id_actividad) VALUES ?', [valores]);
    }

    // 3. Generar y guardar QR
    const textoQR = `USER-${idUsuario}`;
    QRCode.toDataURL(textoQR, { errorCorrectionLevel:'H' }, (errQR, dataURL) => {
      if (!errQR) {
        db.query('UPDATE usuarios SET qr=? WHERE id=?', [dataURL, idUsuario]);
      }

      // 4. Enviar correo de confirmación con QR
      const mailOptions = {
        from   : `"Congreso de Tecnología" <${process.env.SMTP_USER}>`,
        to     : correo,
        subject: 'Tu código QR de asistencia',
        html   : `<p>Hola <strong>${nombre}</strong>:</p>
                  <p>Presenta este código al ingresar:</p>
                  <img src="${dataURL}" style="width:160px;height:160px;">`,
        attachments: [{ filename:'qr.png', path:dataURL }]
      };
      transporter.sendMail(mailOptions, () => {});
      res.json({ success:true });
    });
  });
});

/* ╔═ GET /api/actividades ─────────────────────────────── */
app.get('/api/actividades', (_, res) => {
  db.query('SELECT id,tipo,nombre FROM actividades ORDER BY id',
    (err, rows) => {
      if (err) return res.status(500).json([]);
      res.json(rows);
    });
});

/* ╔═ POST /api/asistir ──────────────────────────────────
   body: { qr:'USER-3', idActividad:2? } */
app.post('/api/asistir', (req, res) => {
  const { qr, idActividad = null } = req.body;
  if (!qr) return res.status(400).json({ ok:false, msg:'QR faltante' });

  const idUsuario = parseInt(qr.replace('USER-',''), 10);
  if (isNaN(idUsuario)) return res.json({ ok:false, msg:'QR inválido' });

  db.query('SELECT id FROM usuarios WHERE id=?', [idUsuario], (err, uRows) => {
    if (err || !uRows.length) return res.json({ ok:false });

    // Registrar asistencia
    db.query('INSERT INTO asistencias (id_usuario,id_actividad) VALUES (?,?)',
      [idUsuario,idActividad], (err2) => {
        if (err2) { console.error(err2); return res.json({ ok:false }); }

        /* Enviar diploma si es taller/competencia y no se ha enviado */
        if (idActividad) {
          const qSel = `
            SELECT i.id, i.diploma_enviado,
                   u.nombre, u.correo,
                   act.nombre AS actividad,
                   DATE_FORMAT(NOW(),'%d/%m/%Y') AS fecha
            FROM   inscripciones i
            JOIN   usuarios      u   ON u.id=i.id_usuario
            JOIN   actividades   act ON act.id=i.id_actividad
            WHERE  i.id_usuario=? AND i.id_actividad=? LIMIT 1`;
          db.query(qSel, [idUsuario,idActividad], (e3, rowsIns) => {
            if (e3 || !rowsIns.length) return res.json({ ok:true });

            const ins = rowsIns[0];
            if (ins.diploma_enviado) return res.json({ ok:true });

            const datosPDF = {
              nombre   : ins.nombre,
              actividad: ins.actividad,
              fecha    : ins.fecha
            };
            enviarDiploma(datosPDF, ins.correo, () => {
              db.query('UPDATE inscripciones SET diploma_enviado=1 WHERE id=?',[ins.id]);
              res.json({ ok:true });
            });
          });
        } else {
          res.json({ ok:true });   // asistencia general
        }
      });
  });
});

/* ╔═ Reporte general ─────────────────────────────────── */
app.get('/api/reporte/general', (_, res) => {
  const sql = `
    SELECT COUNT(*) AS total_escanes,
           COUNT(DISTINCT id_usuario) AS personas_unicas
    FROM asistencias;
    SELECT HOUR(fecha_hora) AS hora, COUNT(*) AS escanes
    FROM asistencias
    GROUP BY hora ORDER BY hora;`;
  db.query(sql, (err, rs) => {
    if (err) return res.status(500).json({});
    res.json({ resumen: rs[0][0], porHora: rs[1] });
  });
});

/* ╔═ Reporte por actividad ───────────────────────────── */
app.get('/api/reporte/actividad/:id', (req, res) => {
  const idAct = Number(req.params.id);
  if (isNaN(idAct)) return res.status(400).json({});

  /* ── NUEVA CONSULTA ──
     - Devuelve SIEMPRE los inscritos.
     - Cuenta escaneos y personas presentes si ya hay asistencias. */
  const sql = `
    /* 1)  Lista de inscritos + fecha de escaneo (NULL si no ha pasado) */
    SELECT u.id,
           u.nombre,
           u.correo,
           a.fecha_hora
    FROM   inscripciones i
    JOIN   usuarios      u ON u.id = i.id_usuario
    LEFT   JOIN asistencias a
           ON a.id_usuario   = i.id_usuario
          AND a.id_actividad = i.id_actividad
    WHERE  i.id_actividad = ?
    ORDER  BY COALESCE(a.fecha_hora, '9999-12-31'), u.nombre;

    /* 2)  Resumen:
           - inscritos  = total en inscripciones
           - escanes    = total de registros en asistencias
           - personas   = únicos con asistencia */
    SELECT COUNT(i.id)                      AS inscritos,
           COUNT(a.id)                      AS escanes,
           COUNT(DISTINCT a.id_usuario)     AS personas
    FROM   inscripciones i
    LEFT   JOIN asistencias a
           ON a.id_actividad = i.id_actividad
          AND a.id_usuario   = i.id_usuario
    WHERE  i.id_actividad = ?;`;

  db.query(sql, [idAct, idAct], (err, rs) => {
    if (err) { console.error(err); return res.status(500).json({}); }
    res.json({
      detalle : rs[0],     // lista de inscritos (con o sin asistencia)
      resumen : rs[1][0]   // inscritos, escanes, personas
    });
  });
});


/* ╔═ Descargar diploma PDF (manual) ─────────────────── */
app.get('/api/diploma/:id', (req, res) => {
  const idIns = Number(req.params.id);
  if (isNaN(idIns)) return res.status(400).send('ID inválido');

  const sql = `
    SELECT u.nombre, act.nombre AS actividad,
           DATE_FORMAT(NOW(),'%d/%m/%Y') AS fecha
    FROM   inscripciones i
    JOIN   usuarios      u   ON u.id = i.id_usuario
    JOIN   actividades   act ON act.id = i.id_actividad
    WHERE  i.id = ?`;
  db.query(sql, [idIns], (err, rs) => {
    if (err || !rs.length) return res.sendStatus(404);
    generarDiploma(rs[0], (e,buff) => {
      if (e) return res.sendStatus(500);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition',
        `attachment; filename="Diploma_${rs[0].nombre.replace(/\s+/g,'_')}.pdf"`);
      res.send(buff);
    });
  });
});

/* ╔═ Reenviar diploma manualmente ───────────────────── */
app.post('/api/enviar-diploma/:id', (req, res) => {
  const idIns = Number(req.params.id);
  if (isNaN(idIns)) return res.status(400).json({ ok:false });

  const sql = `
    SELECT i.id, u.nombre, u.correo, act.nombre AS actividad,
           DATE_FORMAT(NOW(),'%d/%m/%Y') AS fecha
    FROM   inscripciones i
    JOIN   usuarios      u   ON u.id  = i.id_usuario
    JOIN   actividades   act ON act.id = i.id_actividad
    WHERE  i.id = ?`;
  db.query(sql, [idIns], (err, rs) => {
    if (err || !rs.length) return res.status(404).json({ ok:false });
    enviarDiploma(rs[0], rs[0].correo, (eMail, info) => {
      if (eMail) { console.error(eMail); return res.status(500).json({ ok:false }); }
      console.log('✉️  Diploma enviado (manual):', info.response);
      res.json({ ok:true });
    });
  });
});

/* ╔══════════════════════════════════════════════════════════╗
   ║   PUBLICACIÓN DE RESULTADOS (sin “?” en la ruta)         ║
   ╚══════════════════════════════════════════════════════════╝ */
function getResultados(anio, res) {
  const sql = `
    SELECT r.id, r.puesto, r.descripcion, r.foto_url,
           act.id AS act_id, act.nombre AS actividad,
           u.id  AS user_id, u.nombre  AS ganador
    FROM   resultados r
    JOIN   actividades act ON act.id = r.id_actividad
    JOIN   usuarios    u   ON u.id = r.id_usuario
    WHERE  r.anio = ?
    ORDER  BY act.id, r.puesto;`;

  db.query(sql, [anio], (err, rows) => {
    if (err) { console.error(err); return res.status(500).json([]); }

    const mapa = {};
    rows.forEach(r => {
      if (!mapa[r.act_id]) mapa[r.act_id] = {
        actividad : r.actividad,
        ganadores : []
      };
      mapa[r.act_id].ganadores.push({
        puesto      : r.puesto,
        nombre      : r.ganador,
        descripcion : r.descripcion,
        foto        : r.foto_url
      });
    });
    res.json({ anio, competencias: Object.values(mapa) });
  });
}

/* ─── GET /api/resultados  (año actual) ─────────────────── */
app.get('/api/resultados', (_req, res) => {
  const anioActual = new Date().getFullYear();
  getResultados(anioActual, res);
});

/* ─── GET /api/resultados/:anio  (año concreto) ─────────── */
app.get('/api/resultados/:anio', (req, res) => {
  const anio = Number(req.params.anio);
  if (isNaN(anio)) return res.status(400).json([]);
  getResultados(anio, res);
});



/* ╔═ Arrancar servidor ─────────────────────────────── */
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
