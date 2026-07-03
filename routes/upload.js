const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const pool    = require('../db');
const auth    = require('../middleware/auth');

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

// POST /api/upload/avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro enviado.' });
    }

    const avatarUrl = `http://localhost:3000/uploads/${req.file.filename}`;

    await pool.query(
      'UPDATE utilizadores SET Avatar = ? WHERE UtilizadorID = ?',
      [avatarUrl, req.user.id]
    );

    res.json({ success: true, avatar: avatarUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer upload.' });
  }
});


// POST /api/upload — upload de imagem genérica
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro enviado.' });
    }
    const url = `http://localhost:3000/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer upload.' });
  }
});


module.exports = router;    
