const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Sin credenciales explícitas: en EC2 el SDK obtiene las del IAM Role.
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function uploadDocument(key, file) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    IfNoneMatch: '*'
  }), { abortSignal: AbortSignal.timeout(30000) });
}

async function getDocumentUrl(key) {
  const bucket = process.env.S3_BUCKET;
  // Detecta objetos inexistentes y errores de permisos antes de entregar el enlace.
  await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), {
    abortSignal: AbortSignal.timeout(30000)
  });
  const filename = path.posix.basename(key).replace(/[^a-zA-Z0-9._-]/g, '_');
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `inline; filename="${filename}"`
  }), { expiresIn: 300 });
}

module.exports = { uploadDocument, getDocumentUrl };
