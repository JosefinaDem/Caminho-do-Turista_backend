const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const authMiddleware = require('../middleware/auth');

// GET /api/trails — всі маршрути з фільтрами
router.get('/', async (req, res) => {
  const { type, difficulty, duration, region, hidden } = req.query;

  try {
    let query = `
      SELECT r.RotaID AS id, r.Titulo AS title, r.Descricao AS description,
             r.TipoViagem AS type, r.Dificuldade AS difficulty,
             r.Duracao AS duration, r.DuracaoLabel AS durationLabel,
             r.DistanciaKm AS distance, r.ElevacaoSubida AS elevation,
             r.TesouroEscondido AS hidden, r.ImagemPrincipal AS image,
             r.MediaRating AS rating, r.TotalAvaliacoes AS totalReviews,
             reg.Nome AS region
      FROM Rotas r
      JOIN Regioes reg ON r.RegiaoID = reg.RegiaoID
      WHERE r.Ativo = 1
    `;
    const params = [];

    if (type && type !== 'all') {
      query += ' AND r.TipoViagem = ?';
      params.push(type);
    }
    if (difficulty && difficulty !== 'all') {
      query += ' AND r.Dificuldade = ?';
      params.push(Number(difficulty));
    }
    if (duration && duration !== 'all') {
      query += ' AND r.Duracao = ?';
      params.push(duration);
    }
    if (region && region !== 'all') {
      query += ' AND reg.Nome = ?';
      params.push(region);
    }
    if (hidden === 'true') {
      query += ' AND r.TesouroEscondido = 1';
    }

    query += ' ORDER BY r.MediaRating DESC, r.TotalAvaliacoes DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// GET /api/trails/:id — detalhe de uma rota
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, reg.Nome AS region
      FROM Rotas r
      JOIN Regioes reg ON r.RegiaoID = reg.RegiaoID
      WHERE r.RotaID = ? AND r.Ativo = 1
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada.' });
    }

    const [tags] = await pool.query(
      'SELECT Tag FROM RotasTags WHERE RotaID = ?', [req.params.id]
    );
    const [tips] = await pool.query(
      'SELECT Categoria, Dica FROM DicasRota WHERE RotaID = ? ORDER BY Ordem', [req.params.id]
    );

    res.json({
      ...rows[0],
      tags: tags.map(t => t.Tag),
      tips
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// POST /api/trails/:id/history — adicionar ao histórico
router.post('/:id/history', auth, async (req, res) => {
  const { estado } = req.body; // 'planeada', 'em_andamento', 'concluida'
  try {
    await pool.query(`
      INSERT INTO HistoricoViagens (UtilizadorID, RotaID, Estado)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE Estado = VALUES(Estado)
    `, [req.user.id, req.params.id, estado || 'planeada']);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});


// GET avaliações de uma rota
router.get('/:id/reviews', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, u.Nome as UserNome, u.Avatar as UserAvatar
       FROM avaliacoes a
       JOIN Utilizadores u ON a.UtilizadorID = u.UtilizadorID
       WHERE a.RotaID = ?
       ORDER BY a.DataAvaliacao DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter avaliações' });
  }
});

// POST nova avaliação
router.post('/:id/reviews', authMiddleware, async (req, res) => {
  const { rating, comentario, fotoUrl } = req.body;
  try {
    await pool.query(
      'INSERT INTO avaliacoes (RotaID, UtilizadorID, Rating, Comentario, FotoUrl) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, rating, comentario || null, fotoUrl || null]
    );
    
    await pool.query(
      `UPDATE Rotas SET 
        TotalAvaliacoes = (SELECT COUNT(*) FROM avaliacoes WHERE RotaID = ?),
        MediaRating = (SELECT AVG(Rating) FROM avaliacoes WHERE RotaID = ?)
       WHERE RotaID = ?`,
      [req.params.id, req.params.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
  console.error('Review error full:', err.message, err.sqlMessage);
  res.status(500).json({ error: err.sqlMessage || 'Erro ao guardar avaliação' });
}
  
});


router.delete('/:id/reviews/:reviewId', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM avaliacoes WHERE AvaliacaoID = ? AND UtilizadorID = ?',
      [req.params.reviewId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao eliminar avaliação' });
  }
});

router.put('/:id/reviews/:reviewId', authMiddleware, async (req, res) => {
  const { rating, comentario, fotoUrl } = req.body;
  try {
    await pool.query(
      'UPDATE avaliacoes SET Rating = ?, Comentario = ?, FotoUrl = ? WHERE AvaliacaoID = ? AND UtilizadorID = ?',
      [rating, comentario || null, fotoUrl !== undefined ? fotoUrl || null : undefined, req.params.reviewId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao editar avaliação' });
  }
});


// GET fotos de uma rota
router.get('/:id/photos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM imagensrota WHERE RotaID = ? ORDER BY Principal DESC, DataUpload ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter fotos' });
  }
});


// GET /api/trails/history — histórico do utilizador
router.get('/history/all', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.RotaID AS id, r.Titulo AS title, r.TipoViagem AS type,
             r.Dificuldade AS difficulty, r.DuracaoLabel AS durationLabel,
             r.DistanciaKm AS distance, r.ImagemPrincipal AS image,
             r.MediaRating AS rating, r.TotalAvaliacoes AS totalReviews,
             reg.Nome AS region, hv.Estado AS estado
      FROM HistoricoViagens hv
      JOIN Rotas r   ON hv.RotaID = r.RotaID
      JOIN Regioes reg ON r.RegiaoID = reg.RegiaoID
      WHERE hv.UtilizadorID = ?
      ORDER BY hv.DataRegisto DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// DELETE /api/trails/:id/history
router.delete('/:id/history', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM HistoricoViagens WHERE UtilizadorID = ? AND RotaID = ?',
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;