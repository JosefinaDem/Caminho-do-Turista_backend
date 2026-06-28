const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const nome  = profile.displayName;
    const avatar = profile.photos[0]?.value || null;

    // Verificar se utilizador já existe
    const [rows] = await pool.query(
      'SELECT * FROM Utilizadores WHERE Email = ?', [email]
    );

    let user;
    if (rows.length > 0) {
      // Utilizador já existe — atualizar último login
      await pool.query(
        'UPDATE Utilizadores SET UltimoLogin = NOW() WHERE UtilizadorID = ?',
        [rows[0].UtilizadorID]
      );
      user = rows[0];
    } else {
      // Criar novo utilizador
      const [result] = await pool.query(
        'INSERT INTO Utilizadores (Nome, Email, PasswordHash, Avatar, EmailVerificado) VALUES (?, ?, ?, ?, 1)',
        [nome, email, 'google_oauth', avatar]
      );
      user = { UtilizadorID: result.insertId, Nome: nome, Email: email, Avatar: avatar };
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

// GET /api/auth/google
router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
}));

// GET /api/auth/google/callback
router.get('/callback',
  passport.authenticate('google', { session: false, failureRedirect: 'http://localhost/redes_12_php/PAP/portugal-trails/?error=google_failed' }),
  (req, res) => {
    const user = req.user;
    const token = jwt.sign(
      { id: user.UtilizadorID, nome: user.Nome, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirecionar para o frontend com token
    res.redirect(`http://localhost/redes_12_php/PAP/portugal-trails/?token=${token}&nome=${encodeURIComponent(user.Nome)}&email=${encodeURIComponent(user.Email)}&avatar=${encodeURIComponent(user.Avatar || '')}`);
  }
);

module.exports = router;