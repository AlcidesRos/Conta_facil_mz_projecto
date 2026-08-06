const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function calcularTotaisSessao(empresaId, sessaoId) {
  const totaisResult = await pool.query(
    `SELECT tipo, COALESCE(SUM(valor),0) AS total FROM transacoes
     WHERE empresa_id=$1 AND data = CURRENT_DATE GROUP BY tipo`,
    [empresaId]
  );
  let entradas = 0, saidas = 0;
  totaisResult.rows.forEach(r => { if (r.tipo === 'receita') entradas = Number(r.total); if (r.tipo === 'despesa') saidas = Number(r.total); });

  const movResult = await pool.query(
    `SELECT tipo, COALESCE(SUM(valor),0) AS total FROM caixa_movimentos
     WHERE caixa_sessao_id=$1 GROUP BY tipo`,
    [sessaoId]
  );
  let sangrias = 0, reforcos = 0;
  movResult.rows.forEach(r => { if (r.tipo === 'sangria') sangrias = Number(r.total); if (r.tipo === 'reforco') reforcos = Number(r.total); });

  return { entradas, saidas, sangrias, reforcos };
}

// GET /api/caixa/atual — sessão de caixa aberta (se existir), com totais de hoje
router.get('/atual', async (req, res, next) => {
  try {
    const sessaoResult = await pool.query(
      `SELECT * FROM caixa_sessoes WHERE empresa_id=$1 AND status='aberto' LIMIT 1`,
      [req.user.empresaId]
    );
    if (sessaoResult.rows.length === 0) return res.json(null);
    const sessao = sessaoResult.rows[0];

    const { entradas, saidas, sangrias, reforcos } = await calcularTotaisSessao(req.user.empresaId, sessao.id);
    const saldoEsperado = Number(sessao.saldo_inicial) + entradas - saidas - sangrias + reforcos;

    const movimentosResult = await pool.query(
      `SELECT cm.*, u.nome AS usuario_nome FROM caixa_movimentos cm
       LEFT JOIN usuarios u ON u.id = cm.usuario_id
       WHERE cm.caixa_sessao_id = $1 ORDER BY cm.criado_em DESC`,
      [sessao.id]
    );

    res.json({ ...sessao, entradas, saidas, sangrias, reforcos, saldoEsperado, movimentosCaixa: movimentosResult.rows });
  } catch (err) { next(err); }
});

// GET /api/caixa/historico
router.get('/historico', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM caixa_sessoes WHERE empresa_id=$1 AND status='fechado' ORDER BY fechado_em DESC`,
      [req.user.empresaId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/caixa/abrir
router.post('/abrir', async (req, res, next) => {
  const { saldoInicial } = req.body;
  if (saldoInicial == null || saldoInicial < 0) return res.status(400).json({ erro: 'Saldo inicial inválido.' });
  try {
    const result = await pool.query(
      `INSERT INTO caixa_sessoes (empresa_id, usuario_abertura_id, saldo_inicial, status)
       VALUES ($1,$2,$3,'aberto') RETURNING *`,
      [req.user.empresaId, req.user.id, saldoInicial]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Violação do índice único "uma sessão aberta por empresa"
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um caixa aberto. Feche-o antes de abrir um novo.' });
    next(err);
  }
});

// POST /api/caixa/sangria — retirada de dinheiro do caixa (ex: para cofre/depósito)
router.post('/sangria', async (req, res, next) => {
  await registarMovimentoCaixa(req, res, next, 'sangria');
});

// POST /api/caixa/reforco — entrada extra de dinheiro no caixa (ex: troco)
router.post('/reforco', async (req, res, next) => {
  await registarMovimentoCaixa(req, res, next, 'reforco');
});

async function registarMovimentoCaixa(req, res, next, tipo) {
  const { valor, motivo } = req.body;
  if (!valor || valor <= 0) return res.status(400).json({ erro: 'O valor deve ser maior que zero.' });
  try {
    const sessaoResult = await pool.query(
      `SELECT id FROM caixa_sessoes WHERE empresa_id=$1 AND status='aberto' LIMIT 1`,
      [req.user.empresaId]
    );
    if (sessaoResult.rows.length === 0) return res.status(404).json({ erro: 'Não há nenhum caixa aberto neste momento.' });

    const result = await pool.query(
      `INSERT INTO caixa_movimentos (empresa_id, caixa_sessao_id, usuario_id, tipo, valor, motivo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.empresaId, sessaoResult.rows[0].id, req.user.id, tipo, valor, motivo || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

// POST /api/caixa/fechar — body: { saldoFinalContado }
router.post('/fechar', async (req, res, next) => {
  const { saldoFinalContado } = req.body;
  if (saldoFinalContado == null || saldoFinalContado < 0) return res.status(400).json({ erro: 'Saldo final inválido.' });

  try {
    const sessaoResult = await pool.query(
      `SELECT * FROM caixa_sessoes WHERE empresa_id=$1 AND status='aberto' LIMIT 1`,
      [req.user.empresaId]
    );
    if (sessaoResult.rows.length === 0) return res.status(404).json({ erro: 'Não há nenhum caixa aberto neste momento.' });
    const sessao = sessaoResult.rows[0];

    const { entradas, saidas, sangrias, reforcos } = await calcularTotaisSessao(req.user.empresaId, sessao.id);
    const saldoEsperado = Number(sessao.saldo_inicial) + entradas - saidas - sangrias + reforcos;
    const diferenca = Math.round((saldoFinalContado - saldoEsperado) * 100) / 100;

    const result = await pool.query(
      `UPDATE caixa_sessoes SET
         status='fechado', usuario_fecho_id=$1, entradas=$2, saidas=$3,
         sangrias=$4, reforcos=$5, saldo_final_contado=$6, diferenca=$7, fechado_em=now()
       WHERE id=$8 RETURNING *`,
      [req.user.id, entradas, saidas, sangrias, reforcos, saldoFinalContado, diferenca, sessao.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
