const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Converte o filtro de período em uma condição SQL segura
function condicaoPeriodo(periodo) {
  switch (periodo) {
    case 'hoje': return `data = CURRENT_DATE`;
    case 'semana': return `data >= date_trunc('week', CURRENT_DATE)`;
    case 'ano': return `date_part('year', data) = date_part('year', CURRENT_DATE)`;
    case 'mes':
    default: return `date_trunc('month', data) = date_trunc('month', CURRENT_DATE)`;
  }
}

// GET /api/transacoes?tipo=receita|despesa&periodo=hoje|semana|mes|ano&contaBancariaId=&naoConciliadas=1
router.get('/', async (req, res, next) => {
  const { tipo, periodo, contaBancariaId, naoConciliadas } = req.query;
  try {
    const params = [req.user.empresaId];
    let sql = `SELECT * FROM transacoes WHERE empresa_id = $1 AND ${condicaoPeriodo(periodo)}`;
    if (tipo) { params.push(tipo); sql += ` AND tipo = $${params.length}`; }
    if (contaBancariaId) { params.push(contaBancariaId); sql += ` AND conta_bancaria_id = $${params.length}`; }
    if (naoConciliadas) { sql += ` AND conciliado = false`; }
    sql += ` ORDER BY data DESC, criado_em DESC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/transacoes
router.post('/', async (req, res, next) => {
  const { tipo, valor, categoria, descricao, data, contaBancariaId, cartaoId } = req.body;
  if (!['receita', 'despesa'].includes(tipo) || !valor || valor <= 0 || !categoria) {
    return res.status(400).json({ erro: 'Tipo, valor e categoria são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO transacoes (empresa_id, tipo, valor, categoria, descricao, data, conta_bancaria_id, cartao_id)
       VALUES ($1,$2,$3,$4,$5, COALESCE($6, CURRENT_DATE), $7, $8) RETURNING *`,
      [req.user.empresaId, tipo, valor, categoria, descricao || null, data || null, contaBancariaId || null, cartaoId || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/transacoes/:id/conciliar — marca/desmarca como conciliado com o extracto bancário
router.patch('/:id/conciliar', async (req, res, next) => {
  const { conciliado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE transacoes SET conciliado=$1, conciliado_em=CASE WHEN $1 THEN now() ELSE NULL END
       WHERE id=$2 AND empresa_id=$3 RETURNING *`,
      [!!conciliado, req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/transacoes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM transacoes WHERE id=$1 AND empresa_id=$2 RETURNING id`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
