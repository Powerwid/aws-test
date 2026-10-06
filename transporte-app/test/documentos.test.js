const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../src/config/database');
const storage = require('../src/config/s3');

const originals = { execute: db.execute, upload: storage.uploadDocument, url: storage.getDocumentUrl, bucket: process.env.S3_BUCKET };
let server, base, reserva, uploads, dbFailure, s3Failure, missingObject;

before(async () => {
  process.env.S3_BUCKET = 'transporte-documentos-joseph-2026';
  db.execute = async (sql, params) => {
    if (dbFailure === 'read' || (dbFailure === 'write' && sql.startsWith('UPDATE'))) throw new Error('MySQL no disponible');
    if (sql.startsWith('SELECT')) return [[Number(params[0]) === 5 ? reserva : null].filter(Boolean)];
    assert.equal(sql, 'UPDATE reservas SET documento_s3_key = ? WHERE id = ?');
    assert.equal(params[1], 5);
    reserva.documento_s3_key = params[0];
    return [{ affectedRows: 1 }];
  };
  storage.uploadDocument = async (key, file) => {
    if (s3Failure) throw new Error('S3 no disponible');
    uploads.push({ key, file });
  };
  storage.getDocumentUrl = async key => {
    assert.equal(key, reserva.documento_s3_key);
    if (missingObject) throw Object.assign(new Error('Objeto eliminado'), { name: 'NotFound' });
    if (s3Failure) throw new Error('S3 no disponible');
    return 'https://s3.example.test/documento?temporal=300';
  };
  const app = express();
  app.use('/api/reservas', require('../src/routes/documentos'));
  app.use((err, req, res, next) => res.status(500).json({ message: 'Error de MySQL.' }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/reservas`;
});

beforeEach(() => {
  reserva = { id: 5, documento_s3_key: null };
  uploads = [];
  dbFailure = s3Failure = missingObject = false;
  process.env.S3_BUCKET = 'transporte-documentos-joseph-2026';
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.execute = originals.execute;
  storage.uploadDocument = originals.upload;
  storage.getDocumentUrl = originals.url;
  if (originals.bucket === undefined) delete process.env.S3_BUCKET;
  else process.env.S3_BUCKET = originals.bucket;
  await db.end();
});

function sendFile({ id = 5, name = 'comprobante.pdf', type = 'application/pdf', content = '%PDF-1.4\nprueba', field = 'documento', extraFile = false, extraField = false } = {}) {
  const data = new FormData();
  data.append(field, new Blob([content], { type }), name);
  if (extraFile) data.append('documento', new Blob(['%PDF-1.4'], { type }), name);
  if (extraField) data.append('texto', 'no permitido');
  return fetch(`${base}/${id}/documento`, { method: 'POST', body: data });
}

test('acepta PDF, JPG, JPEG y PNG y guarda solo una key saneada', async () => {
  const samples = [
    ['comprobante.pdf', 'application/pdf', Buffer.from('%PDF-1.4\nprueba')],
    ['comprobante.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['comprobante.JPEG', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['comprobante.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]
  ];
  for (const [name, type, content] of samples) {
    const response = await sendFile({ name, type, content });
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.match(data.documento_s3_key, /^documentos\/reservas\/5\/\d+-comprobante\.(pdf|jpg|JPEG|png)$/);
    assert.equal(data.documento_s3_key, reserva.documento_s3_key);
    assert.deepEqual(uploads.at(-1).file.buffer, content);
  }
  const response = await sendFile({ name: '../recibo especial.pdf' });
  assert.equal(response.status, 201);
  assert.match(reserva.documento_s3_key, /-recibo_especial\.pdf$/);
});

test('acepta exactamente 5 MB y rechaza un byte adicional', async () => {
  const content = Buffer.alloc(5 * 1024 * 1024);
  content.write('%PDF-1.4');
  assert.equal((await sendFile({ content })).status, 201);
  const response = await sendFile({ content: Buffer.concat([content, Buffer.from('x')]) });
  assert.equal(response.status, 413);
  assert.match((await response.json()).message, /5 MB/);
  assert.equal(uploads.length, 1);
});

test('rechaza extensión, MIME y contenido incorrectos sin enviar a S3', async () => {
  for (const options of [{ name: 'archivo.exe' }, { type: 'text/plain' }, { content: '<script>no es un PDF</script>' }, { content: '' }]) {
    assert.equal((await sendFile(options)).status, 400);
  }
  assert.equal(uploads.length, 0);
});

test('rechaza solicitudes vacías, múltiples archivos y campos inesperados', async () => {
  assert.equal((await fetch(`${base}/5/documento`, { method: 'POST', body: new FormData() })).status, 400);
  for (const options of [{ extraFile: true }, { extraField: true }, { field: 'archivo' }]) {
    assert.equal((await sendFile(options)).status, 400);
  }
  assert.equal(uploads.length, 0);
});

test('rechaza ID inválido, reserva inexistente y falta de configuración', async () => {
  assert.equal((await sendFile({ id: 'abc' })).status, 400);
  assert.equal((await sendFile({ id: 0 })).status, 400);
  assert.equal((await sendFile({ id: 4294967296 })).status, 400);
  assert.equal((await sendFile({ id: 6 })).status, 404);
  delete process.env.S3_BUCKET;
  assert.equal((await sendFile()).status, 503);
  assert.equal(uploads.length, 0);
});

test('un fallo de S3 conserva el documento anterior y permite reintentar', async () => {
  reserva.documento_s3_key = 'documentos/reservas/5/anterior.pdf';
  s3Failure = true;
  assert.equal((await sendFile()).status, 502);
  assert.equal(reserva.documento_s3_key, 'documentos/reservas/5/anterior.pdf');
  s3Failure = false;
  assert.equal((await sendFile()).status, 201);
  assert.equal(uploads.length, 1);
});

test('un fallo de consulta MySQL impide enviar el archivo a S3', async () => {
  dbFailure = 'read';
  assert.equal((await sendFile()).status, 500);
  assert.equal(uploads.length, 0);
});

test('informa si S3 recibió el archivo pero MySQL no pudo guardar la key', async () => {
  dbFailure = 'write';
  const response = await sendFile();
  assert.equal(response.status, 500);
  assert.match((await response.json()).message, /llegó a S3.*MySQL/);
  assert.equal(uploads.length, 1);
  assert.equal(reserva.documento_s3_key, null);
});

test('redirige al documento privado y evita cachear el enlace', async () => {
  assert.equal((await fetch(`${base}/5/documento`)).status, 404);
  reserva.documento_s3_key = 'documentos/reservas/5/comprobante.pdf';
  const response = await fetch(`${base}/5/documento`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://s3.example.test/documento?temporal=300');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('informa errores de S3 al abrir un documento', async () => {
  reserva.documento_s3_key = 'documentos/reservas/5/comprobante.pdf';
  s3Failure = true;
  assert.equal((await fetch(`${base}/5/documento`)).status, 502);
  s3Failure = false;
  missingObject = true;
  assert.equal((await fetch(`${base}/5/documento`)).status, 404);
});
