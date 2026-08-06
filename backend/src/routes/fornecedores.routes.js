const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM fornecedores WHERE empresa_id = $1 ORDER BY nome ASC`, [req.user.empresaId]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { nome, empresa, telefone, email, cidade, produtosFornecidos } = req.body;
  if (!nome) return res.status(400).json({ erro: 'O nome do fornecedor é obrigatório.' });
  try {
    const result = await pool.query(
      `INSERT INTO fornecedores (empresa_id, nome, empresa, telefone, email, cidade, produtos_fornecidos)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.empresaId, nome, empresa || null, telefone || null, email || null, cidade || null, produtosFornecidos || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  const { nome, empresa, telefone, email, cidade, produtosFornecidos } = req.body;
  try {
    const result = await pool.query(
      `UPDATE fornecedores SET nome=$1, empresa=$2, telefone=$3, email=$4, cidade=$5, produtos_fornecidos=$6
       WHERE id=$7 AND empresa_id=$8 RETURNING *`,
      [nome, empresa, telefone, email, cidade, produtosFornecidos, req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM fornecedores WHERE id=$1 AND empresa_id=$2 RETURNING id`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
