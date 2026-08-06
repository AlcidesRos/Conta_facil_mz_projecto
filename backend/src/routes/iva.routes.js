const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/iva?periodo=mes|ano  — livro de lançamentos + resumo (liquidado, dedutível, a pagar/recuperar)
router.get('/', async (req, res, next) => {
  const { periodo } = req.query;
  const condicao = periodo === 'ano'
    ? `date_part('year', data) = date_part('year', CURRENT_DATE)`
    : `date_trunc('month', data) = date_trunc('month', CURRENT_DATE)`;
  try {
    const lancamentosResult = await pool.query(
      `SELECT * FROM iva_lancamentos WHERE empresa_id=$1 AND ${condicao} ORDER BY data DESC`,
      [req.user.empresaId]
    );
    const totalLiquidado = lancamentosResult.rows.filter(r => r.tipo === 'liquidado').reduce((s, r) => s + Number(r.valor_iva), 0);
    const totalDedutivel = lancamentosResult.rows.filter(r => r.tipo === 'dedutivel').reduce((s, r) => s + Number(r.valor_iva), 0);
    res.json({
      lancamentos: lancamentosResult.rows,
      ivaLiquidado: Math.round(totalLiquidado * 100) / 100,
      ivaDedutivel: Math.round(totalDedutivel * 100) / 100,
      ivaAPagarOuRecuperar: Math.round((totalLiquidado - totalDedutivel) * 100) / 100
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { tipo, descricao, baseTributavel, taxaIva, numeroFatura, data } = req.body;
  if (!['liquidado', 'dedutivel'].includes(tipo) || baseTributavel == null) {
    return res.status(400).json({ erro: 'Tipo e base tributável são obrigatórios.' });
  }
  const taxa = taxaIva != null ? Number(taxaIva) : 0.16;
  const valorIva = Math.round(Number(baseTributavel) * taxa * 100) / 100;
  try {
    const result = await pool.query(
      `INSERT INTO iva_lancamentos (empresa_id, tipo, descricao, base_tributavel, taxa_iva, valor_iva, numero_fatura, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, CURRENT_DATE)) RETURNING *`,
      [req.user.empresaId, tipo, descricao || null, baseTributavel, taxa, valorIva, numeroFatura || null, data || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM iva_lancamentos WHERE id=$1 AND empresa_id=$2 RETURNING id`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
