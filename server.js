/**
 * server.js
 * Servidor Express para el Museo Virtual Configurable.
 * Listo para produccion con variables de entorno.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ==========================================
// CORS - Configuracion segura para produccion
// ==========================================
const corsOptions = {
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(o => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// ==========================================
// Middlewares
// ==========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging en desarrollo
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ==========================================
// Archivos estaticos
// ==========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Rutas API
// ==========================================
app.use('/api/museums', require('./routes/museums'));

// Health check (usado por Railway, Render, Docker, etc.)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: process.uptime()
    });
});

// ==========================================
// Frontend SPA - Redirigir rutas desconocidas a index.html
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Si el usuario entra con ?museum=ID, tambien sirve el frontend
app.get('/museo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// Manejo de errores
// ==========================================
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack || err.message);
    res.status(500).json({ 
        error: NODE_ENV === 'production' ? 'Error interno del servidor' : err.message 
    });
});

// ==========================================
// Iniciar servidor
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║           🏛️  MUSEO VIRTUAL BACKEND  🏛️                    ║
    ║                                                              ║
    ║     🌐 Servidor corriendo en:                               ║
    ║        http://localhost:${PORT}                               ║
    ║                                                              ║
    ║     📡 API Base:     /api/museums                           ║
    ║     💓 Health Check: /api/health                            ║
    ║     🌍 Entorno:      ${NODE_ENV.padEnd(20)}                    ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    `);

    // Crear carpetas necesarias
    ['uploads/images', 'uploads/audio', 'public'].forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`📁 Creada carpeta: ${fullPath}`);
        }
    });
});
