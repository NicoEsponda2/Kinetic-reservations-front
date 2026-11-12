<p align="center">
  <a href="https://angular.dev/" target="_blank">
    <img src="https://raw.githubusercontent.com/angular/angular/main/adev/src/assets/images/press-kit/angular_icon_gradient.gif" width="120" height="120" alt="Angular 19 Logo" />
  </a>
</p>

# KR Front desarrollado en Angular

Aplicación web frontend de **Kinetic Reservations**, construida con **Angular 19**, **Tailwind CSS** y **TypeScript**, orientada a la gestión y reserva de canchas deportivas con integración de Google OAuth y pagos vía Transbank Webpay Plus.

---

## Requisitos previos

- **Node.js 22+** y **npm** (para ejecución local sin contenedores)
- **Docker** y **Docker Compose** (recomendado)
- Tener levantado el backend (`kinetic-reservations-back`) en el puerto **`3000`** junto con su base de datos PostgreSQL.

---

## Configuración del entorno

- **API y Proxy:**
  - Los archivos [`src/environments/environment.ts`](./src/environments/environment.ts) y [`src/environments/environment.development.ts`](./src/environments/environment.development.ts) apuntan a `baseUrl: '/api'`.
  - El servidor de desarrollo utiliza [`proxy.conf.json`](./proxy.conf.json) para redirigir las peticiones `/api` hacia `http://host.docker.internal:3000`.
  - Si ejecutas el frontend localmente fuera de Docker y tu entorno no resuelve `host.docker.internal`, asegúrate de que el backend esté escuchando en el puerto `3000` y, de ser necesario, ajusta temporalmente el `target` en [`proxy.conf.json`](./proxy.conf.json) a `http://localhost:3000` (sin subir cambios locales innecesarios si trabajas en equipo con Docker).
- **Google OAuth:** No requiere configurar el `clientId` manualmente en el frontend; se obtiene dinámicamente desde el backend mediante `GET /api/auth/google/config`.

---

## Instructivo de ejecución

### Opción 1: Levantar todo el proyecto con Docker Compose (recomendado)

Desde la carpeta raíz del proyecto (`KR_Angular_Nest`):

```bash
docker compose up -d --build
```

O para levantar únicamente el contenedor de desarrollo del frontend dentro de `kinetic-reservations-front/`:

```bash
docker compose up -d --build
```

Una vez iniciado, accede en tu navegador a:

- **Frontend:** `http://localhost:4200`

*(El contenedor usa `target: development` con recarga automática ante cambios mediante `ng serve --host 0.0.0.0 --poll 2000`.)*

---

### Opción 2: Ejecución local sin Docker

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Asegurar que el backend esté activo en el puerto `3000` (y los datos iniciales cargados con `/api/seed` desde el backend si estás en desarrollo).
3. Iniciar el servidor de desarrollo:
   ```bash
   npm start
   ```
4. Abrir `http://localhost:4200` en el navegador.

---

## Scripts disponibles

Definidos en [`package.json`](./package.json):

| Comando | Descripción |
| :--- | :--- |
| `npm start` | Levanta el servidor de desarrollo de Angular (`ng serve`) en el puerto `4200`. |
| `npm run build` | Genera la compilación de producción en `dist/kinetic-reservations-front`. |
| `npm run watch` | Compila continuamente en modo desarrollo ante cambios en los archivos. |
| `npm test` | Ejecuta las pruebas unitarias con Jasmine y Karma. |
| `npm run test:ci` | Valida estrictamente tipos y contratos TypeScript sobre las pruebas (`tsc --noEmit -p tsconfig.spec.json`). |

---

## Build de producción con Docker

El [`Dockerfile`](./Dockerfile) utiliza un flujo multi-etapa (`dependencies` → `tester` → `builder` → `development` / `production`). Antes de generar el artefacto final con Nginx, **ejecuta automáticamente `npm run test:ci`**; si existe algún error de tipos o pruebas rotas, el build se detiene.

Para construir la imagen de producción:

```bash
docker build --target production -t kinetic-reservations-front:prod .
```

La etapa `production` sirve los archivos estáticos compilados mediante **Nginx** (`nginx:alpine`) en el puerto `80` con soporte de enrutamiento SPA (`try_files $uri $uri/ /index.html`).

---

## Estructura principal del proyecto

```text
src/app/
├── user-front/        # Landing pública (Inicio, Servicios/Deportes, Comentarios, Footer)
├── auth/              # Login, Registro, Google OAuth, Guards e Interceptor JWT
├── user-dashboard/    # Panel del usuario (Dashboard, Mis Reservas, Mis Comentarios, Perfil)
├── admin-dashboard/   # Panel administrador (Métricas, Reservas, Usuarios, Servicios, Comentarios)
├── components/        # Flujo compartido de Nueva Reserva, Confirmación Webpay, Tabla y Sidebar
├── pipes/             # Pipes utilitarios (sportImage, sportIcon, diasRestantes)
└── shared/            # Caché HTTP (RAM + sessionStorage), CacheStorage de imágenes, Cookies y Zona horaria (America/Santiago)
```

---

## Rutas y flujos principales

- **Público:** `/` (Inicio, catálogo de deportes, reseñas activas y centro de privacidad/cookies Ley N° 21.719).
- **Autenticación:** `/auth/login` y `/auth/register`.
- **Panel de Usuario (requiere sesión):** `/panel-usuario/dashboard-usuario`, `/panel-usuario/reservas-usuario`, `/panel-usuario/comentarios-usuario`, `/panel-usuario/nueva-reserva`, `/panel-usuario/confirmacion-reserva` y `/panel-usuario/configuracion-perfil`.
- **Panel Administrador (requiere rol `admin`):** `/admin/dashboard`, `/admin/bookings`, `/admin/comentarios`, `/admin/users`, `/admin/servicios`, `/admin/nuevo-servicio`, `/admin/editar-servicio/:id` y `/admin/nueva-reserva`.
