const router = require('express').Router();
const multer = require('multer');
const path = require('node:path');
const db = require('../config/database');
const storage = require('../config/s3');

const types = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
  fileFilter(req, file, callback) {
    const type = types[path.extname(file.originalname).toLowerCase()];
    if (!type || file.mimetype !== type) {
      return callback(new Error('Formato no permitido. Solo se aceptan PDF, JPG, JPEG y PNG.'));
    }
    callback(null, true);
  }
}).single('documento');

async function findReserva(req, res, next) {
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1 || Number(req.params.id) > 4294967295) {
    return res.status(400).json({ message: 'El ID de la reserva no es válido.' });
  }
  const [reservas] = await db.execute('SELECT id, documento_s3_key FROM reservas WHERE id = ?', [req.params.id]);
  if (!reservas.length) return res.status(404).json({ message: 'La reserva no existe.' });
  req.reserva = reservas[0];
  next();
}

function checkConfiguration(req, res, next) {
  if (!process.env.S3_BUCKET) {
    return res.status(503).json({ message: 'Configura S3_BUCKET en el .env del servidor para usar documentos.' });
  }
  next();
}

function receiveDocument(req, res, next) {
  upload(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'El archivo supera el máximo permitido de 5 MB.' });
    }
    const message = err instanceof multer.MulterError
      ? 'Envía un solo archivo en el campo documento, sin campos adicionales.'
      : err.message.startsWith('Formato no permitido') ? err.message : 'La solicitud de archivo no es válida.';
    res.status(400).json({ message });
  });
}

function validContent(file) {
  const buffer = file.buffer;
  if (file.mimetype === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimetype === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

router.post('/:id/documento', findReserva, checkConfiguration, receiveDocument, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Selecciona un documento para subir.' });
  if (!validContent(req.file)) {
    return res.status(400).json({ message: 'El contenido del archivo no corresponde a un PDF, JPG, JPEG o PNG válido.' });
  }
  const filename = path.basename(req.file.originalname).normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150);
  const key = `documentos/reservas/${req.reserva.id}/${Date.now()}-${filename}`;
  try {
    await storage.uploadDocument(key, req.file);
  } catch (err) {
    console.error('Error al subir documento a S3:', err.name || err.code);
    return res.status(502).json({ message: 'No se pudo subir el documento a S3. Revisa la conexión, el bucket y los permisos del IAM Role e intenta nuevamente.' });
  }
  try {
    const [result] = await db.execute('UPDATE reservas SET documento_s3_key = ? WHERE id = ?', [key, req.reserva.id]);
    if (!result.affectedRows) {
      console.error('Documento sin reserva asociada en MySQL:', key);
      return res.status(404).json({ message: 'La reserva ya no existe. El archivo fue enviado a S3 pero no pudo asociarse.' });
    }
  } catch (err) {
    console.error('Error MySQL al asociar documento:', err.code, 'Objeto S3:', key);
    return res.status(500).json({ message: 'El archivo llegó a S3, pero no se pudo asociar a la reserva en MySQL. Revisa la base de datos e intenta nuevamente.' });
  }
  res.status(201).json({ message: 'Documento subido y asociado a la reserva correctamente.', documento_s3_key: key });
});

router.get('/:id/documento', findReserva, checkConfiguration, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.reserva.documento_s3_key) {
    return res.status(404).json({ message: 'Esta reserva no tiene un documento asociado.' });
  }
  try {
    const url = await storage.getDocumentUrl(req.reserva.documento_s3_key);
    res.redirect(302, url);
  } catch (err) {
    console.error('Error al abrir documento S3:', err.name || err.code);
    const missing = err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404;
    res.status(missing ? 404 : 502).json({
      message: missing ? 'El documento no se encuentra en S3.' : 'No se pudo abrir el documento de S3. Revisa la conexión y los permisos del IAM Role.'
    });
  }
});

module.exports = router;
