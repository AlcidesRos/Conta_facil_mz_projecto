const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM funcionarios WHERE empresa_id=$1 ORDER BY nome ASC`, [req.user.empresaId]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { nome, cargo, telefone, salario, status } = req.body;
  if (!nome) return res.status(400).json({ erro: 'O nome do funcionário é obrigatório.' });
  try {
    const result = await pool.query(
      `INSERT INTO funcionarios (empresa_id, nome, cargo, telefone, salario, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.empresaId, nome, cargo || null, telefone || null, salario || 0, status || 'Ativo']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  const { nome, cargo, telefone, salario, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE funcionarios SET nome=$1, cargo=$2, telefone=$3, salario=$4, status=$5
       WHERE id=$6 AND empresa_id=$7 RETURNING *`,
      [nome, cargo, telefone, salario, status, req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM funcionarios WHERE id=$1 AND empresa_id=$2 RETURNING id`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
