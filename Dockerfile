# ==========================================
# Dockerfile - Museo Virtual Configurable
# Empaqueta Node.js + SQLite + Frontend
# ==========================================

FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema (SQLite necesita python/make en Alpine)
RUN apk add --no-cache python3 make g++

# Copiar archivos de configuracion
COPY package*.json ./

# Instalar dependencias de Node
RUN npm ci --only=production

# Copiar todo el codigo
COPY . .

# Crear carpetas de uploads con permisos
RUN mkdir -p uploads/images uploads/audio && chmod -R 777 uploads

# Puerto expuesto
EXPOSE 3000

# Variable de entorno para produccion
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["node", "server.js"]
