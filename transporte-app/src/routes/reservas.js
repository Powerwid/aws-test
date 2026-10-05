const router = require('express').Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  const [reservas] = await db.execute(`
    SELECT re.*, c.nombre, c.apellido, c.dni,
           r.origen, r.destino, r.fecha_salida, r.hora_salida
    FROM reservas re
    JOIN clientes c ON c.id = re.cliente_id
    JOIN rutas r ON r.id = re.ruta_id
    ORDER BY re.id DESC
  `);
  res.json(reservas);
});

router.post('/', async (req, res) => {
  const { cliente_id, ruta_id, cantidad_pasajes } = req.body || {};
  const ids = [cliente_id, ruta_id];
  if (ids.some(valor => !['number', 'string'].includes(typeof valor) || !/^\d+$/.test(String(valor)) || !Number.isSafeInteger(Number(valor)) || Number(valor) < 1 || Number(valor) > 4294967295)) {
    return res.status(400).json({ message: 'Selecciona un cliente y una ruta válidos.' });
  }
  if (!['number', 'string'].includes(typeof cantidad_pasajes) || !/^\d+$/.test(String(cantidad_pasajes)) || Number(cantidad_pasajes) < 1 || Number(cantidad_pasajes) > 100) {
    return res.status(400).json({ message: 'La cantidad de pasajes debe ser un entero entre 1 y 100.' });
  }
  const [clientes] = await db.execute('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
  if (!clientes.length) return res.status(404).json({ message: 'El cliente no existe.' });
  const [rutas] = await db.execute('SELECT id FROM rutas WHERE id = ?', [ruta_id]);
  if (!rutas.length) return res.status(404).json({ message: 'La ruta no existe.' });

  // MySQL multiplica el precio DECIMAL; el total enviado por el navegador no se utiliza.
  const [result] = await db.execute(`
    INSERT INTO reservas (cliente_id, ruta_id, cantidad_pasajes, total, estado)
    SELECT ?, id, ?, precio * ?, 'CONFIRMADA' FROM rutas WHERE id = ?
  `, [cliente_id, cantidad_pasajes, cantidad_pasajes, ruta_id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'La ruta no existe.' });
  const [reservas] = await db.execute('SELECT * FROM reservas WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Reserva registrada correctamente.', reserva: reservas[0] });
});

module.exports = router;
