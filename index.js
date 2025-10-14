require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const { Resend } = require('resend');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

function generarDiploma({ nombre, actividad, fecha }, cb) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks = [];
  const W = doc.page.width;
  const H = doc.page.height;

  doc.on('data', ch => chunks.push(ch));
  doc.on('end', () => cb(null, Buffer.concat(chunks)));
  doc.on('error', cb);

  const rojo = '#b60000';
  const rojoOsc = '#8f0000';
  const grisClaro = '#e9edf3';
  const grisTxt = '#1f2937';

  const logoPath = path.join(__dirname, 'public', 'img', 'logo-umg.png');
  const logoExists = fs.existsSync(logoPath);

  doc.save().lineWidth(2.2).roundedRect(24, 24, W - 48, H - 48, 12).stroke(rojo).restore();
  const bandH = 120;
  doc.save().rect(0, 0, W, bandH).fill(rojo).restore();

  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18)
    .text('Universidad Mariano Gálvez de Guatemala', 40, 24, { width: W - 80, align: 'center' })
    .moveDown(0.2)
    .font('Helvetica').fontSize(14)
    .text('Facultad de Ingeniería en Sistemas', { width: W - 80, align: 'center' });

  const cx = W / 2, cy = bandH + 55, logoSize = 110;
  doc.save().circle(cx, cy, logoSize / 2 + 8).lineWidth(4).stroke('#ffffff').restore();
  if (logoExists) {
    doc.save(); doc.circle(cx, cy, logoSize / 2).clip();
    doc.image(logoPath, cx - logoSize / 2, cy - logoSize / 2, { width: logoSize, height: logoSize });
    doc.restore();
  }

  const topAfterLogo = cy + logoSize / 2 + 24;
  doc.fillColor(grisTxt).font('Helvetica-Bold').fontSize(26)
    .text('Diploma de Participación', 40, topAfterLogo, { width: W - 80, align: 'center' });
  const decoW = 140, decoX = (W - decoW) / 2;
  doc.save().moveTo(decoX, topAfterLogo + 34).lineTo(decoX + decoW, topAfterLogo + 34).lineWidth(3).stroke(rojo).restore();

  doc.font('Helvetica').fontSize(14).fillColor('#374151').text('Se otorga a', 40, topAfterLogo + 60, { width: W - 80, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(22).fillColor(rojo).text(nombre, { width: W - 80, align: 'center', underline: true });
  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(14).fillColor('#111')
     .text(`Por su destacada participación en ${actividad}.`, { width: W - 120, align: 'center' });
  doc.moveDown(1.5);
  doc.font('Helvetica-Oblique').fontSize(12).fillColor('#111')
     .text(`Guastatoya, ${fecha}`, { width: W - 80, align: 'right' });

  const yFirmas = H - 150, sep = 200, x1 = cx - sep - 40, x2 = cx + 40;
  doc.save().lineWidth(1.2).strokeColor(grisClaro)
     .moveTo(x1, yFirmas).lineTo(x1 + 180, yFirmas).stroke()
     .moveTo(x2, yFirmas).lineTo(x2 + 180, yFirmas).stroke().restore();

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
     .text('Decano(a)', x1, yFirmas + 6, { width: 180, align: 'center' })
     .text('Coordinador(a)', x2, yFirmas + 6, { width: 180, align: 'center' });
  doc.save().rect(0, H - 16, W, 16).fill(rojoOsc).restore();

  doc.end();
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

async function enviarEmail({ to, subject, html, attachments = [] }) {
  const { data, error } = await resend.emails.send({
    from: `Congreso UMG <${FROM_EMAIL}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    reply_to: process.env.REPLY_TO || 'bardales02bryan@gmail.com', // <— aquí
    attachments
  });
  if (error) throw new Error(error.message || 'Error enviando correo');
  return data;
}


async function enviarQRConResend({ to, nombre, qrBuffer }) {
  const html = `
    <p>Hola <strong>${nombre}</strong>:</p>
    <p>Presenta este código al ingresar:</p>
    <img src="cid:qrimg" width="160" height="160" alt="QR de asistencia" />
    <p>Universidad Mariano Gálvez de Guatemala</p>
  `;

  await enviarEmail({
    to,
    subject: 'Tu código QR de asistencia',
    html,
    attachments: [
      {
        filename: 'qr.png',
        content: qrBuffer.toString('base64'), 
        contentType: 'image/png',
        contentId: 'qrimg' 
      }
    ]
  });
}

async function enviarDiplomaCorreo(datos, correoDestino, bufferPDF) {
  const html = `
    <p>Hola <strong>${datos.nombre}</strong>:</p>
    <p>Hacemos entrega de tu diploma de ${datos.actividad}.</p>
    <p>¡Gracias por participar!</p>
    <p>Universidad Mariano Gálvez de Guatemala</p>
  `;
  await enviarEmail({
    to: correoDestino,
    subject: 'Diploma de participación',
    html,
    attachments: [
      { filename: 'diploma.pdf', content: bufferPDF.toString('base64'), contentType: 'application/pdf' }
    ]
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  connectTimeout: 15000
});

console.log('MySQL destino →', {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  db: process.env.DB_NAME
});

db.connect(err => {
  if (err) { console.error('❌ MySQL:', err); process.exit(1); }
  console.log('✅ Conectado a MySQL');
});

app.get('/', (_, res) => res.send('Servidor Node funcionando 🚀'));

app.get('/health/email', async (req, res) => {
  try {
    const using = 'Resend';
    if (req.query.send === '1') {
      const to = (req.query.to || '').trim();
      const html = '<p>Hola 👋 — Esto es una prueba desde /health/email con Resend.</p>';
      await enviarEmail({ to: to || process.env.SMTP_USER || '', subject: 'Prueba Resend', html });
    }
    res.json({ ok: true, using });
  } catch (e) {
    res.json({ ok: false, using: 'Resend', lastError: e.message });
  }
});

app.get('/api/actividades', (_, res) => {
  db.query('SELECT id,tipo,nombre FROM actividades ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

app.post('/api/inscribir', (req, res) => {
  const { nombre, correo, colegio, telefono, tipo, actividades = [] } = req.body;

  if (tipo === 'interno' && !correo.toLowerCase().endsWith(process.env.ALLOWED_DOMAIN.toLowerCase().trim())) {
    return res.json({ success: false, msg: `Debes usar un correo que termine en ${process.env.ALLOWED_DOMAIN}` });
  }

  const sqlU = `INSERT INTO usuarios (nombre, correo, colegio, telefono, tipo) VALUES (?,?,?,?,?)`;
  db.query(sqlU, [nombre, correo, colegio, telefono, tipo], async (err, r) => {
    if (err) { console.error(err); return res.json({ success: false }); }

    const idUsuario = r.insertId;

    if (actividades.length) {
      const valores = actividades.map(id => [idUsuario, id]);
      db.query('INSERT INTO inscripciones (id_usuario,id_actividad) VALUES ?', [valores]);
    }

    try {
      const textoQR = `USER-${idUsuario}`;
      const qrBuffer = await new Promise((resolve, reject) => {
        QRCode.toBuffer(textoQR, { type: 'png', width: 256, errorCorrectionLevel: 'H' },
          (e, buf) => (e ? reject(e) : resolve(buf)));
      });

      const dataURL = `data:image/png;base64,${qrBuffer.toString('base64')}`;
      db.query('UPDATE usuarios SET qr=? WHERE id=?', [dataURL, idUsuario]);

      await enviarQRConResend({ to: correo, nombre, qrBuffer });

      res.json({ success: true });
    } catch (e) {
      console.error('✉️ Error enviando QR:', e.message);
      res.json({ success: true, warn: 'Inscrito, pero no se pudo enviar el correo.' });
    }
  });
});

app.post('/api/asistir', (req, res) => {
  const { qr, idActividad = null } = req.body;
  if (!qr) return res.status(400).json({ ok: false, msg: 'QR faltante' });

  const idUsuario = parseInt(qr.replace('USER-', ''), 10);
  if (isNaN(idUsuario)) return res.json({ ok: false, msg: 'QR inválido' });

  db.query('SELECT id FROM usuarios WHERE id=?', [idUsuario], (err, uRows) => {
    if (err || !uRows.length) return res.json({ ok: false });

    db.query('INSERT INTO asistencias (id_usuario,id_actividad) VALUES (?,?)', [idUsuario, idActividad], err2 => {
      if (err2) { console.error(err2); return res.json({ ok: false }); }

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
        db.query(qSel, [idUsuario, idActividad], (e3, rowsIns) => {
          if (e3 || !rowsIns.length) return res.json({ ok: true });

          const ins = rowsIns[0];
          if (ins.diploma_enviado) return res.json({ ok: true });

          const datosPDF = { nombre: ins.nombre, actividad: ins.actividad, fecha: ins.fecha };
          generarDiploma(datosPDF, async (errPDF, bufferPDF) => {
            if (errPDF) return res.json({ ok: true });
            try {
              await enviarDiplomaCorreo(datosPDF, ins.correo, bufferPDF);
              db.query('UPDATE inscripciones SET diploma_enviado=1 WHERE id=?', [ins.id]);
            } catch (e) {
              console.error('✉️ Error enviando diploma:', e.message);
            }
            res.json({ ok: true });
          });
        });
      } else {
        res.json({ ok: true });
      }
    });
  });
});

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

app.get('/api/reporte/actividad/:id', (req, res) => {
  const idAct = Number(req.params.id);
  if (isNaN(idAct)) return res.status(400).json({});

  const sql = `
    SELECT u.id, u.nombre, u.correo, a.fecha_hora
    FROM   inscripciones i
    JOIN   usuarios      u ON u.id = i.id_usuario
    LEFT   JOIN asistencias a
           ON a.id_usuario   = i.id_usuario
          AND a.id_actividad = i.id_actividad
    WHERE  i.id_actividad = ?
    ORDER  BY COALESCE(a.fecha_hora, '9999-12-31'), u.nombre;

    SELECT COUNT(i.id)                  AS inscritos,
           COUNT(a.id)                  AS escanes,
           COUNT(DISTINCT a.id_usuario) AS personas
    FROM   inscripciones i
    LEFT   JOIN asistencias a
           ON a.id_actividad = i.id_actividad
          AND a.id_usuario   = i.id_usuario
    WHERE  i.id_actividad = ?;`;

  db.query(sql, [idAct, idAct], (err, rs) => {
    if (err) { console.error(err); return res.status(500).json({}); }
    res.json({ detalle: rs[0], resumen: rs[1][0] });
  });
});

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
    generarDiploma(rs[0], (e, buff) => {
      if (e) return res.sendStatus(500);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Diploma_${rs[0].nombre.replace(/\s+/g, '_')}.pdf"`);
      res.send(buff);
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
