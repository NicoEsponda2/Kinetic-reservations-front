# ==========================================
# Etapa 1: Dependencias
# ==========================================
FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ==========================================
# Etapa 2: Tester (Verificación estricta de tests y contratos de interfaz)
# Si algún test o tipo falla, el build se detiene inmediatamente.
# ==========================================
FROM dependencies AS tester
WORKDIR /app
COPY . .
RUN npm run test:ci

# ==========================================
# Etapa 3: Builder (Compilación de producción)
# Requiere que la etapa tester haya pasado satisfactoriamente.
# ==========================================
FROM tester AS builder
WORKDIR /app
RUN npm run build

# ==========================================
# Etapa 4: Desarrollo local (utilizada por docker-compose)
# ==========================================
FROM dependencies AS development
WORKDIR /app
COPY . .
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]

# ==========================================
# Etapa 5: Producción (Servidor Nginx optimizado con soporte SPA)
# ==========================================
FROM nginx:alpine AS production

COPY --from=builder /app/dist/kinetic-reservations-front/browser /usr/share/nginx/html

RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    error_page 500 502 503 504 /50x.html;\n\
    location = /50x.html {\n\
        root /usr/share/nginx/html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
