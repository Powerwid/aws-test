const express = require('express');
const path = require('node:path');
const db = require('./config/database');

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/rutas', require('./routes/rutas'));
app.use('/api/reservas', require('./routes/reservas'));
app.use('/api/reservas', require('./routes/documentos'));
app.use(express.static(path.join(__dirname, '../public')));
app.use((req, res) => res.status(404).json({ message: 'Recurso no encontrado.' }));

// Express 5 envía también los errores de las funciones async a este middleware.
app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Ya existe un cliente con ese DNI.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La solicitud es demasiado grande.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'El cliente o la ruta seleccionados ya no existen.' });
  }
  console.error('Error en la solicitud:', err.code || err.message);
  res.status(500).json({ message: 'No se pudo completar la operación. Revisa la conexión y las tablas de la base de datos.' });
});

async function start() {
  await db.query('SELECT 1');
  const server = app.listen(port, '0.0.0.0');
  server.once('listening', () => {
    console.log(`Sistema de Reservas de Transporte disponible en http://0.0.0.0:${port}`);
  });
  server.on('error', async err => {
    console.error('No se pudo iniciar el servidor:', err.code || err.message);
    await db.end();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => { await db.end(); }));
  }
}

start().catch(async err => {
  console.error('No se pudo conectar a MySQL. Revisa .env y que la base de datos esté disponible:', err.code || err.message);
  await db.end();
  process.exitCode = 1;
});
