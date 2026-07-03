const express = require('express');
const router = express.Router();
const passport = require('passport');
const pool = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
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
      const [rows] = await pool.query('SELECT * FROM utilizadores WHERE Email = ?', [email]);
      let user;
      if (rows.length > 0) {
        await pool.query('UPDATE utilizadores SET UltimoLogin = NOW() WHERE UtilizadorID = ?', [rows[0].UtilizadorID]);
        user = rows[0];
      } else {
        const [result] = await pool.query(
          'INSERT INTO utilizadores (Nome, Email, PasswordHash, Avatar, EmailVerificado) VALUES (?, ?, ?, ?, 1)',
          [nome, email, 'google_oauth', avatar]
        );
        user = { UtilizadorID: result.insertId, Nome: nome, Email: email, Avatar: avatar };
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
}

router.get('/', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res);
});

router.get('/callback', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect('/?error=google_not_configured');
  }
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google_failed' })(req, res, () => {
    const user = req.user;
    const token = jwt.sign(
      { id: user.UtilizadorID, nome: user.Nome, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`/?token=${token}&nome=${encodeURIComponent(user.Nome)}&email=${encodeURIComponent(user.Email)}&avatar=${encodeURIComponent(user.Avatar || '')}`);
  });
});

module.exports = router;
