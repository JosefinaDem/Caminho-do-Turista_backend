const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');


router.post('/recommend', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    // Конвертуємо формат Groq у формат Anthropic щоб фронтенд не змінювати
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao contactar IA' });
  }
});


router.post('/save', authMiddleware, async (req, res) => {
  const { titulo, regiao, descricao, dificuldade, tipo, duracao, distancia, destaques, dica, sourceUrl, status, imageUrl } = req.body;
  await pool.query(
  `INSERT INTO RotasIA (UtilizadorID, Titulo, Regiao, Descricao, Dificuldade, Tipo, Duracao, Distancia, Destaques, Dica, SourceURL, Status, ImageUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [req.user.id, titulo, regiao, descricao, dificuldade, tipo, duracao, distancia,
    JSON.stringify(destaques || []), dica, sourceUrl || null, status || 'planeada', imageUrl || null]
  );
  try {
    const [existing] = await pool.query(
      'SELECT RotaIAID FROM RotasIA WHERE UtilizadorID = ? AND Titulo = ?',
      [req.user.id, titulo]
      
    );
    if (existing.length > 0) {
      await pool.query(
        'UPDATE RotasIA SET Status = ? WHERE RotaIAID = ?',
        [status || 'planeada', existing[0].RotaIAID]
      );
      return res.json({ success: true, updated: true });
    }
    await pool.query(
      `INSERT INTO RotasIA (UtilizadorID, Titulo, Regiao, Descricao, Dificuldade, Tipo, Duracao, Distancia, Destaques, Dica, SourceURL, Status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, titulo, regiao, descricao, dificuldade, tipo, duracao, distancia,
        JSON.stringify(destaques || []), dica, sourceUrl || null, status || 'planeada']
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao guardar rota' });
  }
});


router.get('/saved', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM RotasIA WHERE UtilizadorID = ? ORDER BY CreatedAt DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter rotas' });
  }
});

// GET деталі маршруту ШІ
router.get('/saved/:id', authMiddleware, async (req, res) => {
  try {
    const [[route]] = await pool.query(
      'SELECT * FROM RotasIA WHERE RotaIAID = ? AND UtilizadorID = ?',
      [req.params.id, req.user.id]
    );
    if (!route) return res.status(404).json({ error: 'Rota não encontrada' });

    const [fotos] = await pool.query(
      'SELECT * FROM RotasIAFotos WHERE RotaIAID = ? ORDER BY CreatedAt ASC',
      [req.params.id]
    );
    const [reviews] = await pool.query(
      `SELECT r.*, u.Nome as UserNome, u.Avatar as UserAvatar 
        FROM RotasIAReviews r 
        JOIN Utilizadores u ON r.UtilizadorID = u.UtilizadorID
        WHERE r.RotaIAID = ? ORDER BY r.CreatedAt DESC`,
      [req.params.id]
    );

    res.json({ ...route, fotos, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter rota' });
  }
});

router.post('/saved/:id/review', authMiddleware, async (req, res) => {
  const { rating, comentario, fotoUrl } = req.body;
  try {
    await pool.query(
      'INSERT INTO RotasIAReviews (RotaIAID, UtilizadorID, Rating, Comentario, FotoUrl) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, rating, comentario, fotoUrl || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao guardar review' });
  }
});

router.post('/saved/:id/foto', authMiddleware, async (req, res) => {
  const { fotoUrl, descricao } = req.body;
  try {
    await pool.query(
      'INSERT INTO RotasIAFotos (RotaIAID, FotoUrl, Descricao) VALUES (?, ?, ?)',
      [req.params.id, fotoUrl, descricao || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao guardar foto' });
  }
});


router.get('/history', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM HistoricoQuiz WHERE UtilizadorID = ? ORDER BY CreatedAt DESC',
      [req.user.id]
    );
    
    rows.forEach(r => {
      if (typeof r.Respostas === 'string') r.Respostas = JSON.parse(r.Respostas);
      if (typeof r.Rotas === 'string') r.Rotas = JSON.parse(r.Rotas);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter histórico' });
  }
});


router.post('/history', authMiddleware, async (req, res) => {
  const { respostas, rotas } = req.body;
  try {
    await pool.query(
      'INSERT INTO HistoricoQuiz (UtilizadorID, Respostas, Rotas) VALUES (?, ?, ?)',
      [req.user.id, JSON.stringify(respostas), JSON.stringify(rotas || [])]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao guardar histórico' });
  }
});


router.delete('/saved/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM RotasIA WHERE RotaIAID = ? AND UtilizadorID = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover rota' });
  }
});

router.put('/saved/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query(
      'UPDATE RotasIA SET Status = ? WHERE RotaIAID = ? AND UtilizadorID = ?',
      [status, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar estado' });
  }
});

router.get('/unsplash', async (req, res) => {
  const { query } = req.query;
  console.log('Unsplash request for:', query);
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6&client_id=${process.env.UNSPLASH_ACCESS_KEY}`
    );
    console.log('Unsplash response status:', response.status);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Unsplash error:', err);
    res.status(500).json({ error: 'Erro ao buscar fotos' });
  }
});

module.exports = router;