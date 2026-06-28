const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.RotaID AS id, r.Titulo AS title, r.TipoViagem AS type,
             r.Dificuldade AS difficulty, r.DuracaoLabel AS durationLabel,
             r.DistanciaKm AS distance, r.ImagemPrincipal AS image,
             r.MediaRating AS rating, reg.Nome AS region,
             f.DataAdicionado AS addedAt
      FROM Favoritos f
      JOIN Rotas r   ON f.RotaID = r.RotaID
      JOIN Regioes reg ON r.RegiaoID = reg.RegiaoID
      WHERE f.UtilizadorID = ?
      ORDER BY f.DataAdicionado DESC
    `, [req.user.id]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// POST /api/favorites/:trailId — adicionar favorito
router.post('/:trailId', auth, async (req, res) => {
  try {
    await pool.query(
      'INSERT IGNORE INTO Favoritos (UtilizadorID, RotaID) VALUES (?, ?)',
      [req.user.id, req.params.trailId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// DELETE /api/favorites/:trailId — remover favorito
router.delete('/:trailId', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM Favoritos WHERE UtilizadorID = ? AND RotaID = ?',
      [req.user.id, req.params.trailId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

module.exports = router;