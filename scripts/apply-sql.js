require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

(async () => {
  try {
    const fileArg = process.argv[2];
    if (!fileArg) {
      console.error('Uso: node scripts/apply-sql.js <ruta-del-sql>');
      process.exit(1);
    }
    const filePath = path.resolve(process.cwd(), fileArg);
    if (!fs.existsSync(filePath)) {
      console.error('No existe el archivo:', filePath);
      process.exit(1);
    }

    const { DB_HOST, DB_PORT = '3306', DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
      console.error('Faltan variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
      process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf8');

    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      multipleStatements: true
    });

    try {
      console.log(`▶ Ejecutando: ${filePath}`);
      await conn.query(sql);
      console.log('✅ Listo.');
    } finally {
      await conn.end();
    }
  } catch (err) {
    console.error('❌ Error ejecutando SQL:', err.message);
    process.exit(1);
  }
})();
