const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const pool    = require('../db');
const auth    = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage para avatares
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'portugal-trails/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

// Storage para imagens genéricas (reviews, etc.)
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'portugal-trails/uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 1200, crop: 'limit' }]
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/upload/avatar
router.post('/avatar', auth, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro enviado.' });
    }

    const avatarUrl = req.file.path; // Cloudinary já devolve URL https completo

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
router.post('/', auth, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro enviado.' });
    }
    res.json({ success: true, url: req.file.path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fazer upload.' });
  }
});

module.exports = router;
