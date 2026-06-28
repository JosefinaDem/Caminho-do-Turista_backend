const authMiddleware = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nome, email, password } = req.body;

  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT UtilizadorID FROM Utilizadores WHERE Email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este email já está registado.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO Utilizadores (Nome, Email, PasswordHash) VALUES (?, ?, ?)',
      [nome, email, hash]
    );

    const token = jwt.sign(
      { id: result.insertId, nome, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: result.insertId, nome, email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM Utilizadores WHERE Email = ? AND Ativo = 1', [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email ou palavra-passe incorretos.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.PasswordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou palavra-passe incorretos.' });
    }

    await pool.query(
      'UPDATE Utilizadores SET UltimoLogin = NOW() WHERE UtilizadorID = ?',
      [user.UtilizadorID]
    );

    const token = jwt.sign(
      { id: user.UtilizadorID, nome: user.Nome, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
  token,
  user: {
    id:        user.UtilizadorID,
    nome:      user.Nome,
    email:     user.Email,
    avatar:    user.Avatar,
    bio:       user.Bio,
    location:  user.Localizacao,
    instagram: user.Instagram,
    facebook:  user.Facebook,
    tiktok:    user.TikTok,
    reddit:    user.Reddit,
    threads:   user.Threads,
    role:      user.Role,
    banned:    user.Banned
  }
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { nome, bio, location, instagram, facebook, tiktok, reddit, threads, avatar } = req.body;
  try {
    await pool.query(
      'UPDATE Utilizadores SET Nome = ?, Bio = ?, Localizacao = ?, Instagram = ?, Facebook = ?, TikTok = ?, Reddit = ?, Threads = ?, Avatar = ? WHERE UtilizadorID = ?',
      [nome, bio || null, location || null, instagram || null, facebook || null, tiktok || null, reddit || null, threads || null, avatar || null, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
});

module.exports = router;
