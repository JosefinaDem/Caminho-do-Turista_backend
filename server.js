const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── ROUTES ──────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/trails',    require('./routes/trails'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/admin', require('./routes/admin'));

const passport = require('passport');
app.use(passport.initialize());
app.use('/api/auth/google', require('./routes/google'));


const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/upload', require('./routes/upload'));

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Portugal Trails API running' });
});

// ─── START ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor a correr em http://localhost:${PORT}`);
});