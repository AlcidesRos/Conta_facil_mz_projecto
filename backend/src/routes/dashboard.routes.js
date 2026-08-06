const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function condicaoPeriodo(periodo) {
  switch (periodo) {
    case 'hoje': return `data = CURRENT_DATE`;
    case 'semana': return `data >= date_trunc('week', CURRENT_DATE)`;
    case 'ano': return `date_part('year', data) = date_part('year', CURRENT_DATE)`;
    case 'mes':
    default: return `date_trunc('month', data) = date_trunc('month', CURRENT_DATE)`;
  }
}

// GET /api/dashboard/resumo?periodo=mes
// Saldo actual = soma de TODAS as transações (independente do período).
// Receitas/Despesas/Lucro do período = filtradas pelo período seleccionado.
router.get('/resumo', async (req, res, next) => {
  const { periodo } = req.query;
  try {
    const saldoResult = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END), 0) AS saldo
       FROM transacoes WHERE empresa_id = $1`,
      [req.user.empresaId]
    );

    const periodoResult = await pool.query(
      `SELECT tipo, COALESCE(SUM(valor),0) AS total, COUNT(*) AS quantidade
       FROM transacoes
       WHERE empresa_id = $1 AND ${condicaoPeriodo(periodo)}
       GROUP BY tipo`,
      [req.user.empresaId]
    );

    let totalReceitas = 0, totalDespesas = 0, qtdReceitas = 0, qtdDespesas = 0;
    periodoResult.rows.forEach(r => {
      if (r.tipo === 'receita') { totalReceitas = Number(r.total); qtdReceitas = Number(r.quantidade); }
      if (r.tipo === 'despesa') { totalDespesas = Number(r.total); qtdDespesas = Number(r.quantidade); }
    });

    res.json({
      saldoAtual: Number(saldoResult.rows[0].saldo),
      receitasPeriodo: totalReceitas,
      despesasPeriodo: totalDespesas,
      lucroPeriodo: totalReceitas - totalDespesas,
      quantidadeReceitas: qtdReceitas,
      quantidadeDespesas: qtdDespesas,
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/mensal — últimos 6 meses, receitas vs despesas (para o gráfico de barras)
router.get('/mensal', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT date_trunc('month', data) AS mes, tipo, SUM(valor) AS total
       FROM transacoes
       WHERE empresa_id = $1 AND data >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
       GROUP BY mes, tipo
       ORDER BY mes ASC`,
      [req.user.empresaId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/dashboard/categorias?tipo=receita|despesa&periodo=mes
router.get('/categorias', async (req, res, next) => {
  const { tipo, periodo } = req.query;
  if (!['receita', 'despesa'].includes(tipo)) return res.status(400).json({ erro: 'Parâmetro "tipo" inválido.' });
  try {
    const result = await pool.query(
      `SELECT categoria, SUM(valor) AS total
       FROM transacoes
       WHERE empresa_id = $1 AND tipo = $2 AND ${condicaoPeriodo(periodo)}
       GROUP BY categoria
       ORDER BY total DESC`,
      [req.user.empresaId, tipo]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/dashboard/dre?ano=2026 — total por categoria e por mês, para montar a
// Demonstração de Resultados (DRE) igual à da planilha de referência.
router.get('/dre', async (req, res, next) => {
  const ano = parseInt(req.query.ano) || new Date().getFullYear();
  try {
    const result = await pool.query(
      `SELECT tipo, categoria, date_part('month', data) AS mes, SUM(valor) AS total
       FROM transacoes
       WHERE empresa_id = $1 AND date_part('year', data) = $2
       GROUP BY tipo, categoria, mes
       ORDER BY categoria, mes`,
      [req.user.empresaId, ano]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
