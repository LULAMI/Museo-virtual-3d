/**
 * routes/museums.js
 * API REST para gestionar museos, imagenes, audio y configuracion.
 * Endpoints:
 *   POST   /api/museums              -> Crear museo
 *   GET    /api/museums              -> Listar museos
 *   GET    /api/museums/:id          -> Obtener museo completo (config + archivos)
 *   PUT    /api/museums/:id          -> Actualizar nombre/config
 *   DELETE /api/museums/:id          -> Eliminar museo y todo su contenido
 *   POST   /api/museums/:id/images   -> Subir imagen (cuadro)
 *   GET    /api/museums/:id/images   -> Listar imagenes
 *   DELETE /api/museums/:id/images/:imgId -> Eliminar imagen
 *   POST   /api/museums/:id/audio    -> Subir audio (ambiente)
 *   GET    /api/museums/:id/audio    -> Obtener audio
 *   DELETE /api/museums/:id/audio/:audioId -> Eliminar audio
 *   PUT    /api/museums/:id/config   -> Guardar configuracion completa
 *   GET    /api/museums/:id/config   -> Cargar configuracion
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { dbQuery, dbRun } = require('../database');

const router = express.Router();

// ==========================================
// CONFIGURACION DE MULTER (subida de archivos)
// ==========================================

const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, unique);
    }
});

const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'audio');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, unique);
    }
});

const imageFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
};

const audioFilter = (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
    cb(null, allowed.includes(file.mimetype));
};

const uploadImage = multer({ storage: imageStorage, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
const uploadAudio = multer({ storage: audioStorage, fileFilter: audioFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// ==========================================
// CRUD DE MUSEOS
// ==========================================

// Crear un nuevo museo
router.post('/', async (req, res) => {
    try {
        const id = uuidv4();
        const name = req.body.name || 'Museo sin nombre';

        await dbRun('INSERT INTO museums (id, name) VALUES (?, ?)', [id, name]);
        await dbRun(
            'INSERT INTO configurations (museum_id, floor_material, wall_material, ceiling_material) VALUES (?, ?, ?, ?)',
            [id, 'wood', 'plaster', 'white']
        );

        res.status(201).json({ id, name, message: 'Museo creado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar todos los museos
router.get('/', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM museums ORDER BY updated_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener museo completo (config + imagenes + audio)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const museum = await dbQuery('SELECT * FROM museums WHERE id = ?', [id]);
        if (!museum.length) return res.status(404).json({ error: 'Museo no encontrado' });

        const config = await dbQuery('SELECT * FROM configurations WHERE museum_id = ?', [id]);
        const images = await dbQuery('SELECT * FROM images WHERE museum_id = ?', [id]);
        const audio = await dbQuery('SELECT * FROM audio WHERE museum_id = ?', [id]);

        // Construir URLs publicas para las imagenes
        const imagesWithUrls = images.map(img => ({
            ...img,
            url: `/uploads/images/${img.filename}`
        }));

        const audioWithUrls = audio.map(a => ({
            ...a,
            url: `/uploads/audio/${a.filename}`
        }));

        res.json({
            museum: museum[0],
            configuration: config[0] || null,
            images: imagesWithUrls,
            audio: audioWithUrls
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar nombre del museo
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        await dbRun('UPDATE museums SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
        res.json({ message: 'Museo actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar museo y todo su contenido
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener archivos para eliminarlos fisicamente
        const images = await dbQuery('SELECT filename FROM images WHERE museum_id = ?', [id]);
        const audio = await dbQuery('SELECT filename FROM audio WHERE museum_id = ?', [id]);

        images.forEach(img => {
            const p = path.join(__dirname, '..', 'uploads', 'images', img.filename);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });
        audio.forEach(a => {
            const p = path.join(__dirname, '..', 'uploads', 'audio', a.filename);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        await dbRun('DELETE FROM museums WHERE id = ?', [id]); // CASCADE elimina el resto
        res.json({ message: 'Museo eliminado completamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// IMAGENES (CUADROS)
// ==========================================

// Subir imagen
router.post('/:id/images', uploadImage.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ error: 'No se subio ninguna imagen o formato no valido (JPG/PNG)' });

        const { position_x, position_y, position_z, rotation_y, wall_target } = req.body;

        const result = await dbRun(
            `INSERT INTO images (museum_id, filename, original_name, mime_type, size, position_x, position_y, position_z, rotation_y, wall_target)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size,
             position_x || 0, position_y || 3, position_z || 0, rotation_y || 0, wall_target || null]
        );

        res.status(201).json({
            id: result.id,
            filename: req.file.filename,
            url: `/uploads/images/${req.file.filename}`,
            message: 'Imagen subida exitosamente'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar imagenes
router.get('/:id/images', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbQuery('SELECT * FROM images WHERE museum_id = ?', [id]);
        const withUrls = rows.map(img => ({ ...img, url: `/uploads/images/${img.filename}` }));
        res.json(withUrls);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar posicion de una imagen (al arrastrar en el frontend)
router.put('/:id/images/:imgId', async (req, res) => {
    try {
        const { imgId } = req.params;
        const { position_x, position_y, position_z, rotation_y, wall_target } = req.body;

        await dbRun(
            `UPDATE images SET position_x=?, position_y=?, position_z=?, rotation_y=?, wall_target=? WHERE id=?`,
            [position_x, position_y, position_z, rotation_y, wall_target, imgId]
        );
        res.json({ message: 'Posicion de imagen actualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar imagen
router.delete('/:id/images/:imgId', async (req, res) => {
    try {
        const { imgId } = req.params;
        const rows = await dbQuery('SELECT filename FROM images WHERE id = ?', [imgId]);
        if (rows.length) {
            const p = path.join(__dirname, '..', 'uploads', 'images', rows[0].filename);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        await dbRun('DELETE FROM images WHERE id = ?', [imgId]);
        res.json({ message: 'Imagen eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// AUDIO (MUSICA AMBIENTE)
// ==========================================

// Subir audio
router.post('/:id/audio', uploadAudio.single('audio'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ error: 'No se subio ningun archivo de audio o formato no valido (MP3/WAV)' });

        // Eliminar audio previo del mismo museo (solo uno por museo)
        const prev = await dbQuery('SELECT filename FROM audio WHERE museum_id = ?', [id]);
        prev.forEach(a => {
            const p = path.join(__dirname, '..', 'uploads', 'audio', a.filename);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });
        await dbRun('DELETE FROM audio WHERE museum_id = ?', [id]);

        const result = await dbRun(
            'INSERT INTO audio (museum_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
            [id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
        );

        res.status(201).json({
            id: result.id,
            filename: req.file.filename,
            url: `/uploads/audio/${req.file.filename}`,
            message: 'Audio subido exitosamente'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener audio
router.get('/:id/audio', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbQuery('SELECT * FROM audio WHERE museum_id = ?', [id]);
        if (!rows.length) return res.json([]);
        res.json(rows.map(a => ({ ...a, url: `/uploads/audio/${a.filename}` })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar audio
router.delete('/:id/audio/:audioId', async (req, res) => {
    try {
        const { audioId } = req.params;
        const rows = await dbQuery('SELECT filename FROM audio WHERE id = ?', [audioId]);
        if (rows.length) {
            const p = path.join(__dirname, '..', 'uploads', 'audio', rows[0].filename);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        await dbRun('DELETE FROM audio WHERE id = ?', [audioId]);
        res.json({ message: 'Audio eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CONFIGURACION (MATERIALES + ARQUITECTURA)
// ==========================================

// Guardar configuracion completa
router.put('/:id/config', async (req, res) => {
    try {
        const { id } = req.params;
        const { floor_material, wall_material, ceiling_material, doors_json, windows_json } = req.body;

        await dbRun(
            `INSERT INTO configurations (museum_id, floor_material, wall_material, ceiling_material, doors_json, windows_json)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(museum_id) DO UPDATE SET
                floor_material=excluded.floor_material,
                wall_material=excluded.wall_material,
                ceiling_material=excluded.ceiling_material,
                doors_json=excluded.doors_json,
                windows_json=excluded.windows_json,
                updated_at=CURRENT_TIMESTAMP`,
            [id, floor_material, wall_material, ceiling_material, doors_json || '[]', windows_json || '[]']
        );

        res.json({ message: 'Configuracion guardada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cargar configuracion
router.get('/:id/config', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await dbQuery('SELECT * FROM configurations WHERE museum_id = ?', [id]);
        if (!rows.length) return res.json({
            floor_material: 'wood', wall_material: 'plaster', ceiling_material: 'white',
            doors_json: '[]', windows_json: '[]'
        });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
