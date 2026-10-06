const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { S3Client } = require('@aws-sdk/client-s3');

// Sustituye solo el transporte y la firma; prueba los comandos del módulo real.
const presignerPath = require.resolve('@aws-sdk/s3-request-presigner');
const presigner = require(presignerPath);
const originalSend = S3Client.prototype.send;
const originalBucket = process.env.S3_BUCKET;
const sent = [];
let signed;

process.env.S3_BUCKET = 'transporte-documentos-joseph-2026';
require.cache[presignerPath].exports = {
  ...presigner,
  getSignedUrl: async (client, command, options) => {
    signed = { command, options };
    return 'https://s3.example.test/temporal';
  }
};
S3Client.prototype.send = async function (command) { sent.push(command); return {}; };
const storage = require('../src/config/s3');

after(() => {
  S3Client.prototype.send = originalSend;
  require.cache[presignerPath].exports = presigner;
  if (originalBucket === undefined) delete process.env.S3_BUCKET;
  else process.env.S3_BUCKET = originalBucket;
});

test('PutObject envía el contenido al bucket privado sin ACL pública', async () => {
  const key = 'documentos/reservas/5/1760000000000-comprobante.pdf';
  const file = { buffer: Buffer.from('%PDF-1.4'), mimetype: 'application/pdf' };
  await storage.uploadDocument(key, file);
  const command = sent.at(-1);
  assert.equal(command.constructor.name, 'PutObjectCommand');
  assert.equal(command.input.Bucket, process.env.S3_BUCKET);
  assert.equal(command.input.Key, key);
  assert.equal(command.input.Body, file.buffer);
  assert.equal(command.input.ContentType, 'application/pdf');
  assert.equal(command.input.ACL, undefined);
  assert.equal(command.input.IfNoneMatch, '*');
});

test('verifica el objeto y firma GetObject durante cinco minutos', async () => {
  const key = 'documentos/reservas/5/1760000000000-comprobante.pdf';
  assert.equal(await storage.getDocumentUrl(key), 'https://s3.example.test/temporal');
  assert.equal(sent.at(-1).constructor.name, 'HeadObjectCommand');
  assert.equal(sent.at(-1).input.Key, key);
  assert.equal(signed.command.constructor.name, 'GetObjectCommand');
  assert.equal(signed.command.input.Bucket, process.env.S3_BUCKET);
  assert.equal(signed.command.input.Key, key);
  assert.match(signed.command.input.ResponseContentDisposition, /^inline; filename="[a-zA-Z0-9._-]+"$/);
  assert.equal(signed.options.expiresIn, 300);
});
