const router = require('express').Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  const [clientes] = await db.execute('SELECT * FROM clientes ORDER BY id DESC');
  res.json(clientes);
});

router.post('/', async (req, res) => {
  const { nombre, apellido, dni, telefono, email } = req.body || {};
  const campos = [nombre, apellido, dni, telefono, email];
  const limites = [100, 100, 8, 20, 150];
  if (campos.some((valor, i) => typeof valor !== 'string' || !valor.trim() || valor.trim().length > limites[i])) {
    return res.status(400).json({ message: 'Completa todos los campos respetando su longitud máxima.' });
  }
  if (!/^\d{8}$/.test(dni.trim())) {
    return res.status(400).json({ message: 'El DNI debe tener exactamente 8 dígitos.' });
  }
  if (!/^[+\d][\d\s()-]{5,19}$/.test(telefono.trim())) {
    return res.status(400).json({ message: 'Ingresa un teléfono válido de 6 a 20 caracteres.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
  }
  const [result] = await db.execute(
    'INSERT INTO clientes (nombre, apellido, dni, telefono, email) VALUES (?, ?, ?, ?, ?)',
    campos.map(valor => valor.trim())
  );
  res.status(201).json({ message: 'Cliente registrado correctamente.', id: result.insertId });
});

module.exports = router;
