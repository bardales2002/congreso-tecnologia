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

/* ---------- PDF DIPLOMA ---------- */
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

  doc
    .fillColor('#fff')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('Universidad Mariano Gálvez de Guatemala', 40, 24, { width: W - 80, align: 'center' })
    .moveDown(0.2)
    .font('Helvetica')
    .fontSize(14)
    .text('Facultad de Ingeniería en Sistemas', { width: W - 80, align: 'center' });

  const cx = W / 2;
  const cy = bandH + 55;
  const logoSize = 110;

  doc.save().circle(cx, cy, logoSize / 2 + 8).lineWidth(4).stroke('#ffffff').restore();
  if (logoExists) {
    doc.save();
    doc.circle(cx, cy, logoSize / 2).clip();
    doc.image(logoPath, cx - logoSize / 2, cy - logoSize / 2, { width: logoSize, height: logoSize });
    doc.restore();
  }

  const topAfterLogo = cy + logoSize / 2 + 24;

  doc
    .fillColor(grisTxt)
    .font('Helvetica-Bold')
    .fontSize(26)
    .text('Diploma de Participación', 40, topAfterLogo, { width: W - 80, align: 'center' });

  const decoW = 140;
  const decoX = (W - decoW) / 2;
  doc.save().moveTo(decoX, topAfterLogo + 34).lineTo(decoX + decoW, topAfterLogo + 34).lineWidth(3).stroke(rojo).restore();

  doc.font('Helvetica').fontSize(14).fillColor('#374151').text('Se otorga a', 40, topAfterLogo + 60, { width: W - 80, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(22).fillColor(rojo).text(nombre, { width: W - 80, align: 'center', underline: true });
  doc.moveDown(1.2);

  doc.font('Helvetica').fontSize(14).fillColor('#111')
    .text(`Por su destacada participación en ${actividad}.`, { width: W - 120, align: 'center' });

  doc.moveDown(1.5);
  doc.font('Helvetica-Oblique').fontSize(12).fillColor('#111')
    .text(`Guastatoya, ${fecha}`, { width: W - 80, align: 'right' });

  const yFirmas = H - 150;
  const sep = 200;
  const x1 = cx - sep - 40;
  const x2 = cx + 40;

  doc.save()
    .lineWidth(1.2)
    .strokeColor(grisClaro)
    .moveTo(x1, yFirmas).lineTo(x1 + 180, yFirmas).stroke()
    .moveTo(x2, yFirmas).lineTo(x2 + 180, yFirmas).stroke()
    .restore();

  doc
    .font('Helvetica-Bold').fontSize(11).fillColor('#111')
    .text('Decano(a)', x1, yFirmas + 6, { width: 180, align: 'center' })
    .text('Coordinador(a)', x2, yFirmas + 6, { width: 180, align: 'center' });

  doc.save().rect(0, H - 16, W, 16).fill(rojoOsc).restore();

  doc.end();
}

/* ---------- EMAIL (Resend) ---------- */
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

async function enviarEmail({ to, subject, html, attachments = [] }) {
  const resp = await resend.emails.send({
    from: `Congreso UMG <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    attachments // [{ filename, content: Buffer }]
  });
  if (resp.error) throw new Error(resp.error.message || 'Error enviando correo');
  return resp;
}

async function enviarQRCorreo({ nombre, correo, dataURL }) {
  const html = `
    <p>Hola <strong>${nombre}</strong>:</p>
    <p>Presenta este código al ingresar:</p>
    <img src="${dataURL}" style="width:160px;height:160px;" />
    <p>Universidad Mariano Gálvez de Guatemala</p>
  `;
  await enviarEmail({
    to: correo,
    subject: 'Tu código QR de asistencia',
    html
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
    attachments: [{ filename: 'diploma.pdf', content: bufferPDF }]
  });
}

/* ---------- APP ---------- */
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/* ---------- DB ---------- */
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  connectTimeout: 15000
});

console.log('MySQL destino →', { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), db: process.env.DB_NAME });

db.connect(err => {
  if (err) { console.error('❌ MySQL:', err); process.exit(1); }
  console.log('✅ Conectado a MySQL');
});

/* ---------- RUTAS ---------- */
app.get('/', (_, res) => res.send('Servidor Node funcionando 🚀'));

/* Health email (prueba Resend) */
app.get('/health/email', async (_, res) => {
  try {
    // prueba mínima: enviar un mail a tu propio remitente (una vez manual)
    // para solo verificar credenciales sin “spamear”, respondemos sin enviar:
    res.json({ ok: true, using: 'Resend' });
  } catch (e) {
    res.json({ ok: false, using: 'Resend', lastError: e.message });
  }
});

app.post('/api/inscribir', (req, res) => {
  const { nombre, correo, colegio, telefono, tipo, actividades = [] } = req.body;

  if (tipo === 'interno' && !correo.toLowerCase().endsWith(process.env.ALLOWED_DOMAIN.toLowerCase().trim())) {
    return res.json({ success: false, msg: `Debes usar un correo que termine en ${process.env.ALLOWED_DOMAIN}` });
  }

  const sqlU = `INSERT INTO usuarios (nombre, correo, colegio, telefono, tipo) VALUES (?,?,?,?,?)`;
  db.query(sqlU, [nombre, correo, colegio, telefono, tipo], (err, r) => {
    if (err) {
      console.error(err);
      return res.json({ success: false });
    }
    const idUsuario = r.insertId;

    if (actividades.length) {
      const valores = actividades.map(id => [idUsuario, id]);
      db.query('INSERT INTO inscripciones (id_usuario,id_actividad) VALUES ?', [valores]);
    }

    const textoQR = `USER-${idUsuario}`;
    QRCode.toDataURL(textoQR, { errorCorrectionLevel: 'H' }, async (errQR, dataURL) => {
      if (!errQR) {
        db.query('UPDATE usuarios SET qr=? WHERE id=?', [dataURL, idUsuario]);
      }

      try {
        await enviarQRCorreo({ nombre, correo, dataURL });
        res.json({ success: true });
      } catch (e) {
        console.error('✉️ Error enviando QR:', e.message);
        res.json({ success: true, warn: 'Inscrito pero no se pudo enviar el correo.' });
      }
    });
  });
});

app.get('/api/actividades', (_, res) => {
  db.query('SELECT id,tipo,nombre FROM actividades ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
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
        db.query(qSel, [idUsuario, idActividad], async (e3, rowsIns) => {
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

app.post('/api/enviar-diploma/:id', (req, res) => {
  const idIns = Number(req.params.id);
  if (isNaN(idIns)) return res.status(400).json({ ok: false });

  const sql = `
    SELECT i.id, u.nombre, u.correo, act.nombre AS actividad,
           DATE_FORMAT(NOW(),'%d/%m/%Y') AS fecha
    FROM   inscripciones i
    JOIN   usuarios      u   ON u.id  = i.id_usuario
    JOIN   actividades   act ON act.id = i.id_actividad
    WHERE  i.id = ?`;
  db.query(sql, [idIns], (err, rs) => {
    if (err || !rs.length) return res.status(404).json({ ok: false });

    const datos = rs[0];
    generarDiploma(datos, async (errPDF, bufferPDF) => {
      if (errPDF) return res.status(500).json({ ok: false });
      try {
        await enviarDiplomaCorreo(datos, datos.correo, bufferPDF);
        return res.json({ ok: true });
      } catch (e) {
        console.error('✉️ Error enviando diploma (manual):', e.message);
        return res.status(500).json({ ok: false });
      }
    });
  });
});

// --- RUTAS DE DIAGNÓSTICO PARA RESEND ---

// 1) Verifica conectividad y (opcional) dispara un correo de prueba
app.get('/health/email', async (req, res) => {
  try {
    const useResend = !!process.env.RESEND_API_KEY;
    const using = useResend ? 'Resend' : 'SMTP';
    const send = req.query.send === '1';
    const to = (req.query.to || '').trim();

    if (send && useResend) {
      const { data, error } = await resend.emails.send({
        from: `Congreso <${process.env.FROM_EMAIL}>`,
        to: [to || process.env.SMTP_USER || ''],
        subject: 'Prueba de correo (health/email)',
        html: '<p>Hola 👋 — Esto es una prueba desde /health/email.</p>'
      });
      if (error) return res.status(500).json({ ok: false, using, error });
      return res.json({ ok: true, using, data });
    }

    return res.json({ ok: true, using });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 2) Enviar un correo de prueba siempre (más explícito)
app.get('/test/send', async (req, res) => {
  const to = (req.query.to || '').trim();
  if (!to) return res.status(400).json({ ok: false, error: 'Agrega ?to=tu_correo' });

  try {
    const { data, error } = await resend.emails.send({
      from: `Congreso <${process.env.FROM_EMAIL}>`,
      to: [to],
      subject: 'Prueba directa: /test/send',
      html: '<h3>✅ Resend funcionando</h3><p>Este es un correo de prueba.</p>'
    });
    if (error) return res.status(500).json({ ok: false, error });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
