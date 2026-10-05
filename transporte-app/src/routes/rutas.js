const router = require('express').Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  const [rutas] = await db.execute('SELECT * FROM rutas ORDER BY fecha_salida DESC, hora_salida DESC, id DESC');
  res.json(rutas);
});

router.post('/', async (req, res) => {
  const { origen, destino, fecha_salida, hora_salida, precio } = req.body || {};
  if ([origen, destino].some(valor => typeof valor !== 'string' || !valor.trim() || valor.trim().length > 100)) {
    return res.status(400).json({ message: 'Ingresa origen y destino de hasta 100 caracteres.' });
  }
  if (origen.trim().toLowerCase() === destino.trim().toLowerCase()) {
    return res.status(400).json({ message: 'El origen y el destino deben ser diferentes.' });
  }
  const fecha = typeof fecha_salida === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_salida)
    ? new Date(`${fecha_salida}T00:00:00Z`) : new Date(NaN);
  if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== fecha_salida || Number(fecha_salida.slice(0, 4)) < 1000) {
    return res.status(400).json({ message: 'Ingresa una fecha de salida válida.' });
  }
  if (typeof hora_salida !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_salida)) {
    return res.status(400).json({ message: 'Ingresa una hora válida con formato HH:MM.' });
  }
  if (!['string', 'number'].includes(typeof precio) || !/^\d{1,6}(\.\d{1,2})?$/.test(String(precio)) || Number(precio) <= 0) {
    return res.status(400).json({ message: 'El precio debe ser mayor que cero, hasta 999999.99 y con máximo 2 decimales.' });
  }
  const [result] = await db.execute(
    'INSERT INTO rutas (origen, destino, fecha_salida, hora_salida, precio) VALUES (?, ?, ?, ?, ?)',
    [origen.trim(), destino.trim(), fecha_salida, hora_salida, String(precio)]
  );
  res.status(201).json({ message: 'Ruta registrada correctamente.', id: result.insertId });
});

module.exports = router;
