# aws-test

Aplicación sencilla de gestión de transporte para una práctica de arquitectura AWS: Node.js/Express en EC2, MySQL / Amazon RDS como base de datos y documentos privados de reservas en Amazon S3 mediante el IAM Role de EC2.

El proyecto completo se encuentra en **[transporte-app](transporte-app/README.md)**, con instrucciones de configuración local, Amazon Linux 2023, RDS y nginx.

```bash
cd transporte-app
npm install
```

Configura `.env`, crea la base de datos `aws-test`, ejecuta `schema.sql` según el README del proyecto y después:

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Las credenciales locales y `node_modules` están excluidos de Git.
