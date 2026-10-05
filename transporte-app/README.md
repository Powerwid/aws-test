# Sistema de Reservas de Transporte

Aplicación pequeña con Node.js, Express 5, mysql2, dotenv y HTML/CSS/JavaScript vanilla. Permite registrar y listar clientes, rutas y reservas. Cada reserva relaciona un cliente con una ruta y se crea con estado `CONFIRMADA`.

```text
Navegador → EC2 (nginx :80 → Express :3000) → MySQL / Amazon RDS
                             └─ Amazon S3: ampliación futura para documentos
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
│   ├── config/database.js
│   ├── routes/
│   │   ├── clientes.js
│   │   ├── rutas.js
│   │   └── reservas.js
│   └── server.js
├── schema.sql
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

Los POST usan JSON y responden `201` al crear un registro. Los errores incluyen `message`: `400` para datos inválidos, `404` para cliente/ruta inexistente, `409` para DNI repetido y `500` para fallos inesperados de base de datos. Las fechas se envían como `YYYY-MM-DD` y las horas como `HH:MM`. Los campos `DECIMAL` se devuelven como cadenas para preservar precisión.

## Ampliación posterior con Amazon S3

La versión actual guarda clientes, rutas y reservas en MySQL. Para agregar documentos más adelante, se puede incorporar un endpoint de carga, un bucket privado de S3 y un rol IAM de EC2 con permisos para ese bucket. El backend guardaría el archivo en S3 y su clave de objeto junto a la reserva en MySQL; un enlace temporal permitiría descargarlo. Esa ampliación no está implementada en esta versión y no requiere guardar archivos en el disco de EC2.

## Problemas frecuentes

- **ECONNREFUSED:** MySQL no está iniciado o `DB_HOST`/`DB_PORT` son incorrectos.
- **ER_ACCESS_DENIED_ERROR:** revisa `DB_USER`, `DB_PASSWORD` y los permisos del usuario para conectarse desde EC2.
- **ER_BAD_DB_ERROR / ER_NO_SUCH_TABLE:** crea `aws-test` y ejecuta `schema.sql` en el host configurado.
- **ETIMEDOUT al conectar RDS:** revisa VPC, grupos de seguridad y conectividad a `3306`.
- **EADDRINUSE:** otro proceso ya está usando `3000`; detén la ejecución manual antes de iniciar el servicio.
- **nginx devuelve 502:** comprueba `systemctl status transporte-app` y `curl http://127.0.0.1:3000/health`.

Solo `npm run dev` usa nodemon. EC2 instala las dependencias de producción con `npm ci --omit=dev`.

En la verificación de esta entrega, `npm audit --omit=dev` no reportó vulnerabilidades. `npm audit` sí reportó tres alertas de severidad alta en la cadena de desarrollo nodemon/chokidar/braces; no había una versión corregida de braces disponible. Estas dependencias no se instalan con `--omit=dev`.

Se verificaron el arranque con MySQL 8.0, las consultas y claves foráneas, todos los endpoints y los tres formularios en un navegador. También se comprobaron el total calculado, los errores de validación, la persistencia al recargar y la adaptación a móvil. Los datos creados para estas pruebas se eliminaron al terminar. El despliegue real en EC2/RDS/nginx queda para la práctica; no se ejecutó desde este entorno local.
