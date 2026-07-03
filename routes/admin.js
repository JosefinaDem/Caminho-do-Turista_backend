const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');


async function adminMiddleware(req, res, next) {
  try {
    const [[user]] = await pool.query(
      'SELECT Role FROM utilizadores WHERE UtilizadorID = ?',
      [req.user.id]
    );
    if (!user || user.Role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
}


router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT UtilizadorID, Nome, Email, Role, Banned, DataRegisto FROM utilizadores ORDER BY DataRegisto DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter utilizadores' });
  }
});

// PUT banir/desbanir utilizador
router.put('/users/:id/ban', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [[user]] = await pool.query('SELECT Banned FROM utilizadores WHERE UtilizadorID = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });
    await pool.query('UPDATE utilizadores SET Banned = ? WHERE UtilizadorID = ?', [user.Banned ? 0 : 1, req.params.id]);
    res.json({ success: true, banned: !user.Banned });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao banir utilizador' });
  }
});


router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({ error: 'Não podes eliminar a tua própria conta' });
  try {
    await pool.query('DELETE FROM utilizadores WHERE UtilizadorID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao eliminar utilizador' });
  }
});


router.get('/ai-routes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.Nome as UserNome 
       FROM rotasia r 
       JOIN utilizadores u ON r.UtilizadorID = u.UtilizadorID 
       ORDER BY r.CreatedAt DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter rotas' });
  }
});


router.delete('/ai-routes/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM rotasia WHERE RotaIAID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao eliminar rota' });
  }
});


router.get('/reviews', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.Nome as UserNome, ra.Titulo as RotaTitulo
       FROM rotasiareviews r
       JOIN utilizadores u ON r.UtilizadorID = u.UtilizadorID
       JOIN rotasia ra ON r.RotaIAID = ra.RotaIAID
       ORDER BY r.CreatedAt DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter reviews' });
  }
});


router.delete('/reviews/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM rotasiareviews WHERE ReviewID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao eliminar review' });
  }
});


// POST criar nova rota
router.post('/routes', authMiddleware, adminMiddleware, async (req, res) => {
  const { titulo, descricao, regiaoId, tipo, dificuldade, duracao, duracaoLabel, distancia, elevacao, estacao, imagem, tesouro, lat, lng } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO rotas (RegiaoID, Titulo, Descricao, TipoViagem, Dificuldade, Duracao, DuracaoLabel, DistanciaKm, ElevacaoSubida, EstacaoRecomendada, ImagemPrincipal, TesouroEscondido, CriadoPor, LatitudeInicio, LongitudeInicio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [regiaoId, titulo, descricao, tipo, dificuldade, duracao, duracaoLabel, distancia, elevacao || 0, estacao || 'Todo o ano', imagem || null, tesouro ? 1 : 0, req.user.id, lat || null, lng || null]
    );
    
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar rota' });
  }

  
});

// GET regiões para o formulário
router.get('/regions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM regioes ORDER BY Nome');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter regiões' });
  }
});



module.exports = router;
