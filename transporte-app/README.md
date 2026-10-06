# Sistema de Reservas de Transporte

Aplicación pequeña con Node.js, Express 5, mysql2, dotenv y HTML/CSS/JavaScript vanilla. Permite registrar y listar clientes, rutas y reservas, y adjuntar documentos privados en S3. Cada reserva relaciona un cliente con una ruta y se crea con estado `CONFIRMADA`.

```text
Navegador → EC2 (nginx :80 → Express :3000) → MySQL / Amazon RDS
                             └─ Amazon S3: documentos privados de reservas
```

El total se calcula en MySQL: `cantidad_pasajes * precio`. Los importes usan `DECIMAL`, las consultas reciben parámetros y el navegador no determina el total guardado. Precios en soles; DNI de 8 dígitos; reservas de 1 a 100 pasajes.

## Estructura

```text
transporte-app/
├── public/
│   ├── index.html
│   ├── clientes.html
│   ├── rutas.html
│   ├── reservas.html
│   ├── favicon.svg
│   ├── css/styles.css
│   └── js/
│       ├── common.js
│       ├── clientes.js
│       ├── rutas.js
│       └── reservas.js
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── s3.js
│   ├── routes/
│   │   ├── clientes.js
│   │   ├── rutas.js
│   │   ├── reservas.js
│   │   └── documentos.js
│   └── server.js
├── schema.sql
├── migrations/001_documento_reserva.sql
├── test/
│   ├── documentos.test.js
│   └── s3.test.js
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## 1. Instalar dependencias

Requisitos locales: Node.js 22 o superior, npm y un servidor MySQL 8.0.16 o superior iniciado. El cliente `mysql` debe estar disponible en la terminal. Se necesita MySQL real; los datos no se almacenan en memoria.

Desde la carpeta que contiene este proyecto:

```bash
cd transporte-app
npm install
```

El archivo `package-lock.json` permite usar `npm ci` en instalaciones posteriores.

## 2. Configurar .env

Si todavía no tienes `.env`, créalo a partir del ejemplo.

Linux/macOS:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edita `.env` con tus credenciales:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=TU_CONTRASENA_MYSQL
DB_NAME=aws-test
PORT=3000
AWS_REGION=us-east-1
S3_BUCKET=transporte-documentos-joseph-2026
```

En esta copia de trabajo ya existe un `.env` con la contraseña local indicada para la práctica. No lo sobrescribas si quieres conservarla. `.env` está excluido de Git; `.env.example` contiene una contraseña de ejemplo. `DB_PASSWORD` es la contraseña del usuario MySQL indicado en `DB_USER`.

## 3. Crear la base de datos MySQL

Conéctate con el administrador local; `-p` solicita su contraseña:

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p
```

En la consola MySQL ejecuta:

```sql
CREATE DATABASE IF NOT EXISTS `aws-test`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

El guion en `aws-test` obliga a rodear el nombre con acentos graves al usarlo en SQL. Como valor de `DB_NAME` y como argumento del cliente no se agregan acentos graves.

## 4. Ejecutar schema.sql

Desde la carpeta `transporte-app`, en Bash o en CMD:

```bash
mysql --default-character-set=utf8mb4 -h 127.0.0.1 -P 3306 -u root -p aws-test < schema.sql
```

En PowerShell, que no admite esa redirección de entrada, usa el comando `source` del cliente:

```powershell
mysql --default-character-set=utf8mb4 -h 127.0.0.1 -P 3306 -u root -p aws-test --execute="source schema.sql"
```

Verifica las tres tablas:

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p aws-test -e "SHOW TABLES;"
```

`schema.sql` crea las tablas `clientes`, `rutas` y `reservas`, sus claves foráneas y restricciones. Puede ejecutarse de nuevo sin borrar registros; no modifica tablas preexistentes.

Para una instalación anterior que ya tiene la tabla `reservas`, usa la migración de documentos de la sección 9 en lugar de volver a ejecutar `schema.sql`. Las reservas sin documento siguen funcionando; la nueva columna es nullable.

## 5. Ejecutar localmente

```bash
npm start
```

Para desarrollo con reinicio automático:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El servidor escucha en `0.0.0.0:3000`. Al arrancar comprueba la conexión a MySQL; si falla, termina con un mensaje en la consola. Detén el proceso con `Ctrl+C`.

Comprueba el endpoint de salud:

```bash
curl http://localhost:3000/health
```

En PowerShell también puedes usar:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

La respuesta HTTP es `200` con `{"status":"ok"}`. Este endpoint comprueba que Express responde; no consulta la base de datos en cada petición.

Prueba los formularios en este orden:

1. **Clientes:** registra un cliente con DNI único de 8 dígitos, teléfono y correo válido. Debe aparecer en la tabla.
2. **Rutas:** registra, por ejemplo, Lima → Arequipa, una fecha, `09:00` y precio `80.50`.
3. **Reservas:** selecciona ese cliente y esa ruta, e ingresa `2` pasajes. Debe guardarse un total de `S/ 161.00` y estado `CONFIRMADA`.
4. Recarga la página para comprobar que los registros siguen guardados.
5. Intenta repetir el DNI: debe aparecer un error y conservar los datos del formulario.
6. En **Reservas → Adjuntar documento**, selecciona una reserva y un PDF, JPG, JPEG o PNG de hasta 5 MB. Después de subirlo aparece **Ver documento** en la tabla. La carga requiere acceso AWS; en EC2 se utiliza el IAM Role asociado.

## 6. Ejecutar en EC2 con Amazon Linux 2023

Usa una instancia con Amazon Linux 2023, IP pública y acceso SSH. En su grupo de seguridad permite SSH `22` desde tu IP. Para la primera prueba permite TCP `3000` desde tu IP; al configurar nginx usarás HTTP `80`.

Entra por SSH desde tu computadora; reemplaza la clave y la IP:

```bash
ssh -i clave.pem ec2-user@IP_PUBLICA_EC2
```

Instala Node.js y el cliente MySQL compatible de los repositorios de AL2023:

```bash
sudo dnf install -y nodejs22 nodejs22-npm mariadb105
sudo alternatives --set node /usr/bin/node-22
node --version
npm --version
```

Los paquetes de Node.js 22 y sus ejecutables están documentados en [Node.js en Amazon Linux 2023](https://docs.aws.amazon.com/linux/al2023/ug/nodejs.html). `mariadb105` se utiliza aquí como cliente de un servidor MySQL; este comando no instala un servidor de base de datos.

Crea la carpeta remota en la sesión SSH:

```bash
mkdir -p /home/ec2-user/transporte-app
```

Copia el proyecto desde otra terminal de tu computadora. **No copies `node_modules` ni `.env`**; instala dependencias y configura las credenciales de EC2 allí. Desde la carpeta padre del proyecto:

```bash
scp -i clave.pem -r transporte-app/public transporte-app/src ec2-user@IP_PUBLICA_EC2:/home/ec2-user/transporte-app/
scp -i clave.pem transporte-app/package.json transporte-app/package-lock.json transporte-app/schema.sql transporte-app/.env.example transporte-app/README.md ec2-user@IP_PUBLICA_EC2:/home/ec2-user/transporte-app/
```

Dentro de EC2:

```bash
cd /home/ec2-user/transporte-app
npm ci --omit=dev
cp .env.example .env
chmod 600 .env
nano .env
```

Configura `DB_HOST`, usuario y contraseña de un **servidor MySQL accesible desde EC2**. Puedes usar RDS siguiendo el paso 7, o un servidor MySQL que ya tengas en la red. `127.0.0.1` solo sirve si MySQL se ejecuta en esa misma instancia; no apunta al MySQL de tu computadora.

Ejecuta los pasos 3 y 4 desde EC2 cambiando `127.0.0.1` por ese host y `root` por el usuario administrador de ese servidor. Después:

```bash
npm start
```

En otra sesión SSH:

```bash
curl http://127.0.0.1:3000/health
```

Visita `http://IP_PUBLICA_EC2:3000`. Esta primera ejecución termina al cerrar la sesión. Para mantenerla activa y reiniciarla después de reiniciar EC2, detén `npm start` y crea un servicio sencillo:

```bash
sudo tee /etc/systemd/system/transporte-app.service > /dev/null <<'EOF'
[Unit]
Description=Sistema de Reservas de Transporte
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/transporte-app
ExecStart=/usr/bin/node-22 /home/ec2-user/transporte-app/src/server.js
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now transporte-app
sudo systemctl status transporte-app --no-pager
```

El proceso carga `.env` directamente con dotenv. Para consultar logs y aplicar cambios:

```bash
sudo journalctl -u transporte-app -n 50 --no-pager
sudo systemctl restart transporte-app
```

## 7. Cambiar MySQL local por Amazon RDS

1. Crea una instancia de **RDS for MySQL** en la misma VPC que EC2. Anota el usuario administrador, contraseña y endpoint en **Connectivity & security**. El identificador de la instancia RDS puede ser `aws-test`; el nombre inicial de base de datos déjalo vacío y crea `aws-test` con SQL, ya que contiene un guion.
2. En el grupo de seguridad de RDS permite TCP `3306` con el **grupo de seguridad de EC2 como origen**. EC2 debe tener salida hacia RDS. Una conexión privada dentro de la VPC no necesita acceso público para RDS. AWS explica esta conexión en [Conectar EC2 con RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/ec2-rds-connect.html).
3. Desde EC2 conéctate; reemplaza `ENDPOINT_RDS` y `USUARIO_RDS`:

```bash
mysql -h ENDPOINT_RDS -P 3306 -u USUARIO_RDS -p
```

En MySQL:

```sql
CREATE DATABASE IF NOT EXISTS `aws-test`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

Desde la carpeta del proyecto en EC2:

```bash
mysql --default-character-set=utf8mb4 -h ENDPOINT_RDS -P 3306 -u USUARIO_RDS -p aws-test < schema.sql
```

4. Edita el `.env` de EC2:

```dotenv
DB_HOST=tu-instancia.abcdefghijkl.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=USUARIO_RDS
DB_PASSWORD=CONTRASENA_RDS
DB_NAME=aws-test
PORT=3000
AWS_REGION=us-east-1
S3_BUCKET=transporte-documentos-joseph-2026
```

`DB_HOST` lleva solamente el hostname del endpoint, sin `https://` y sin `:3306`. Si mantienes el mismo usuario y contraseña basta con cambiar el host; de lo contrario actualiza también las credenciales.

5. Reinicia el servicio con `sudo systemctl restart transporte-app`, registra un cliente y revisa los datos desde RDS:

```bash
mysql -h ENDPOINT_RDS -P 3306 -u USUARIO_RDS -p aws-test -e "SELECT id, nombre, apellido FROM clientes;"
```

Cambiar `DB_HOST` no migra registros existentes. Para conservarlos, exporta la base local con `mysqldump` e importa el resultado en RDS antes de cambiar la conexión. Para esta práctica también puedes empezar con las tablas vacías.

## 8. nginx: puerto 80 hacia localhost:3000

En una instancia dedicada a esta práctica:

```bash
sudo dnf install -y nginx
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.transporte-backup
```

Reemplaza la configuración por una mínima. Esto evita conflictos con el bloque `server` predeterminado del paquete de AL2023:

```bash
sudo tee /etc/nginx/nginx.conf > /dev/null <<'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;
include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log /var/log/nginx/access.log;

    server {
        listen 80 default_server;
        server_name _;
        client_max_body_size 6m;

        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
curl http://127.0.0.1/health
```

Permite HTTP `80` desde tu IP en el grupo de seguridad de EC2 y retira la regla de entrada `3000`: nginx se conecta por loopback, por lo que no requiere exponer ese puerto. Visita `http://IP_PUBLICA_EC2` sin `:3000`. Express sigue escuchando en `0.0.0.0:3000`.

La directiva está documentada en [nginx: proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

`client_max_body_size 6m` deja espacio para un archivo de 5 MB y la cabecera multipart. La aplicación sigue limitando el archivo a 5 MB. Si ya tienes nginx configurado, agrega esa línea al bloque `server` de la aplicación, ejecuta `sudo nginx -t` y después `sudo systemctl reload nginx`.

## API

| Método | Endpoint | Resultado |
| --- | --- | --- |
| GET | `/health` | `{"status":"ok"}` |
| GET | `/api/clientes` | Array de clientes |
| POST | `/api/clientes` | Registra nombre, apellido, dni, telefono, email |
| GET | `/api/rutas` | Array de rutas |
| POST | `/api/rutas` | Registra origen, destino, fecha_salida, hora_salida, precio |
| GET | `/api/reservas` | Array de reservas con datos del cliente y ruta |
| POST | `/api/reservas` | Recibe cliente_id, ruta_id, cantidad_pasajes |
| POST | `/api/reservas/:id/documento` | Multipart con un archivo en el campo documento |
| GET | `/api/reservas/:id/documento` | Redirige a una URL privada prefirmada de 5 minutos |

Los POST usan JSON y responden `201` al crear un registro. Los errores incluyen `message`: `400` para datos inválidos, `404` para cliente/ruta inexistente, `409` para DNI repetido y `500` para fallos inesperados de base de datos. Las fechas se envían como `YYYY-MM-DD` y las horas como `HH:MM`. Los campos `DECIMAL` se devuelven como cadenas para preservar precisión.

## 9. Documentos privados en S3 y actualización de la EC2 existente

Paquetes agregados: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` y `multer`. Multer recibe un archivo en memoria, sin escribirlo en el disco de EC2, y el SDK lo envía al bucket privado. Se validan extensión, MIME y firma inicial del archivo; solo se aceptan PDF, JPG, JPEG y PNG de hasta `5 * 1024 * 1024` bytes.

Agrega estas dos líneas al `.env` existente de EC2, conservando la configuración de RDS:

```dotenv
AWS_REGION=us-east-1
S3_BUCKET=transporte-documentos-joseph-2026
```

No agregues Access Key, Secret Key ni Session Token al archivo. `S3Client` utiliza la cadena de credenciales predeterminada del SDK y obtiene las credenciales temporales del IAM Role de EC2. El rol debe permitir `s3:PutObject` y `s3:GetObject` sobre `arn:aws:s3:::transporte-documentos-joseph-2026/documentos/reservas/*`. `HeadObject`, usado para verificar que el documento existe, requiere el mismo permiso `s3:GetObject`. Mantén el bucket privado; no se envían ACL públicas. Véase [proveedores de credenciales de AWS SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html).

La key tiene este formato:

```text
documentos/reservas/5/1760000000000-comprobante.pdf
```

En MySQL solo se guarda esa key en `reservas.documento_s3_key`; no se guardan archivos ni URLs prefirmadas. **Ver documento** solicita un enlace nuevo que caduca en cinco minutos y abre el PDF o imagen en otra pestaña. Desde el visor del navegador también puedes descargarlo. Los registros sin documento muestran un guion en esa columna.

Primero registra una reserva y después adjúntale el documento desde el segundo formulario. Si una carga falla, la reserva permanece y puedes reintentar sin crear otra. Una nueva carga para la misma reserva actualiza la key asociada; el objeto anterior permanece privado en S3. No se necesita permiso `s3:DeleteObject`.

Para RDS existente, ejecuta **una sola vez**:

```sql
ALTER TABLE reservas
  ADD COLUMN documento_s3_key VARCHAR(500) NULL AFTER estado;
```

La misma sentencia está en `migrations/001_documento_reserva.sql`. No elimina datos. Si la columna ya existe porque usaste el `schema.sql` nuevo, no ejecutes esta migración. Puedes comprobarlo con `SHOW COLUMNS FROM reservas LIKE 'documento_s3_key';`.

Actualiza EC2 desde la carpeta del proyecto clonado. El siguiente ejemplo supone que el repositorio está en `/home/ec2-user/aws-test`; ajusta esa ruta si usaste otra:

```bash
cd /home/ec2-user/aws-test/transporte-app
git pull --ff-only origin main
npm ci --omit=dev
nano .env
```

Agrega las dos variables S3 indicadas. Sustituye `ENDPOINT_RDS` y `USUARIO_RDS` por los valores de `DB_HOST` y `DB_USER` de tu `.env`, y ejecuta la migración antes de reiniciar:

```bash
mysql --default-character-set=utf8mb4 -h ENDPOINT_RDS -P 3306 -u USUARIO_RDS -p aws-test < migrations/001_documento_reserva.sql
```

Configura el límite de nginx y reinicia el proceso. Estos comandos suponen que usas el servicio `transporte-app` descrito en la sección 6:

```bash
sudo nano /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart transporte-app
sudo systemctl status transporte-app --no-pager
curl http://127.0.0.1:3000/health
```

Dentro del bloque `server` de nginx agrega `client_max_body_size 6m;`. Si usas el servicio de la sección 6 pero ahora clonaste el proyecto en otra ruta, actualiza `WorkingDirectory` y `ExecStart` para apuntar al directorio actual y ejecuta `sudo systemctl daemon-reload` antes de reiniciar. Si ejecutas manualmente con `npm start`, detén el proceso anterior con `Ctrl+C` y vuelve a iniciarlo desde el directorio actualizado.

Comprueba una carga real desde la web y después revisa RDS:

```sql
SELECT id, documento_s3_key FROM reservas ORDER BY id DESC;
```

La aplicación responde `413` cuando el archivo supera 5 MB, `400` para formato/contenido incorrecto, `404` si no existe la reserva o el documento, `502` para fallos de S3 y `500` para fallos de MySQL. Si S3 recibe un archivo y luego falla el UPDATE de MySQL, se informa que el archivo quedó en S3 sin asociar; el mensaje de consola incluye la key para localizarlo. El enlace anterior de la reserva no se modifica si el UPDATE falla.

Para ejecutar las pruebas locales de documentos:

```bash
npm test
```

Estas pruebas simulan MySQL y el transporte/firma de S3 para comprobar los formatos, el límite de 5 MB, la asociación de la key, los comandos del SDK, la caducidad, la redirección y los errores. No usan credenciales AWS ni suben archivos reales. La carga y la apertura reales con el IAM Role se verifican desde la EC2 desplegada.

## Problemas frecuentes

- **ECONNREFUSED:** MySQL no está iniciado o `DB_HOST`/`DB_PORT` son incorrectos.
- **ER_ACCESS_DENIED_ERROR:** revisa `DB_USER`, `DB_PASSWORD` y los permisos del usuario para conectarse desde EC2.
- **ER_BAD_DB_ERROR / ER_NO_SUCH_TABLE:** crea `aws-test` y ejecuta `schema.sql` en el host configurado.
- **ETIMEDOUT al conectar RDS:** revisa VPC, grupos de seguridad y conectividad a `3306`.
- **EADDRINUSE:** otro proceso ya está usando `3000`; detén la ejecución manual antes de iniciar el servicio.
- **nginx devuelve 502:** comprueba `systemctl status transporte-app` y `curl http://127.0.0.1:3000/health`.
- **nginx devuelve 413 al subir:** agrega `client_max_body_size 6m;` al bloque `server` y recarga nginx; el archivo debe seguir siendo de hasta 5 MB.
- **S3 devuelve AccessDenied o faltan credenciales:** comprueba el IAM Role de EC2 y sus permisos para el prefijo `documentos/reservas/*`; no agregues claves AWS al `.env`.

Solo `npm run dev` usa nodemon. EC2 instala las dependencias de producción con `npm ci --omit=dev`.

En la verificación de esta entrega, `npm audit --omit=dev` no reportó vulnerabilidades. `npm audit` sí reportó tres alertas de severidad alta en la cadena de desarrollo nodemon/chokidar/braces; no había una versión corregida de braces disponible. Estas dependencias no se instalan con `--omit=dev`.

Se verificaron el arranque con MySQL 8.0, las consultas y claves foráneas y los formularios de clientes, rutas, reservas y documentos en un navegador. También se comprobaron el total calculado, los errores de validación, la persistencia al recargar, la migración sin perder reservas y la adaptación a móvil. Los datos creados para estas pruebas se eliminaron al terminar. Las pruebas de documentos usaron S3 simulado; la actualización y la carga real con el IAM Role de EC2 deben verificarse en el entorno AWS siguiendo la sección 9.
