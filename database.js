/**
 * database.js
 * Configuracion y esquema de la base de datos SQLite.
 * Tablas: museums, images, audio, configurations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'museo.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error al abrir la base de datos:', err.message);
    } else {
        console.log('✅ Conectado a SQLite:', DB_PATH);
        initSchema();
    }
});

function initSchema() {
    db.serialize(() => {
        // Tabla de museos (salas)
        db.run(`
            CREATE TABLE IF NOT EXISTS museums (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT 'Museo sin nombre',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => { if(err) console.error(err); });

        // Tabla de imagenes (cuadros)
        db.run(`
            CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                museum_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                original_name TEXT,
                mime_type TEXT,
                size INTEGER,
                position_x REAL DEFAULT 0,
                position_y REAL DEFAULT 3,
                position_z REAL DEFAULT 0,
                rotation_y REAL DEFAULT 0,
                wall_target TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (museum_id) REFERENCES museums(id) ON DELETE CASCADE
            )
        `, (err) => { if(err) console.error(err); });

        // Tabla de audio (musica ambiente)
        db.run(`
            CREATE TABLE IF NOT EXISTS audio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                museum_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                original_name TEXT,
                mime_type TEXT,
                size INTEGER,
                volume REAL DEFAULT 0.5,
                is_looping INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (museum_id) REFERENCES museums(id) ON DELETE CASCADE
            )
        `, (err) => { if(err) console.error(err); });

        // Tabla de configuracion (materiales, estado arquitectonico)
        db.run(`
            CREATE TABLE IF NOT EXISTS configurations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                museum_id TEXT NOT NULL UNIQUE,
                floor_material TEXT DEFAULT 'wood',
                wall_material TEXT DEFAULT 'plaster',
                ceiling_material TEXT DEFAULT 'white',
                doors_json TEXT DEFAULT '[]',
                windows_json TEXT DEFAULT '[]',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (museum_id) REFERENCES museums(id) ON DELETE CASCADE
            )
        `, (err) => { if(err) console.error(err); });

        console.log('✅ Esquema de base de datos inicializado');
    });
}

// Helper: promisify para usar async/await
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

module.exports = { db, dbQuery, dbRun };
