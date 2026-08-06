const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/estoque/movimentacoes — histórico completo (com nome do produto)
router.get('/movimentacoes', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.*, p.nome AS produto_nome, u.nome AS usuario_nome
       FROM movimentacoes_estoque m
       JOIN produtos p ON p.id = m.produto_id
       LEFT JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.empresa_id = $1
       ORDER BY m.data DESC, m.hora DESC`,
      [req.user.empresaId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/estoque/alertas — produtos com estoque igual ou abaixo do mínimo
router.get('/alertas', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, qtd_por_caixa, qtd_estoque_unidades, qtd_minima_caixas,
              FLOOR(qtd_estoque_unidades::numeric / qtd_por_caixa) AS caixas_atuais
       FROM produtos
       WHERE empresa_id = $1
         AND FLOOR(qtd_estoque_unidades::numeric / qtd_por_caixa) <= qtd_minima_caixas
       ORDER BY nome`,
      [req.user.empresaId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/estoque/movimentacoes — registar entrada ou saída (transação atómica)
// body: { produtoId, tipo: 'entrada'|'saida', quantidade, unidade: 'unidades'|'caixas', motivo }
router.post('/movimentacoes', async (req, res, next) => {
  const { produtoId, tipo, quantidade, unidade, motivo } = req.body;

  if (!produtoId || !['entrada', 'saida'].includes(tipo) || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos para o movimento de estoque.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const produtoResult = await client.query(
      `SELECT * FROM produtos WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [produtoId, req.user.empresaId]
    );
    if (produtoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    const produto = produtoResult.rows[0];
    const quantidadeUnidades = unidade === 'caixas' ? quantidade * produto.qtd_por_caixa : quantidade;

    if (tipo === 'saida' && quantidadeUnidades > produto.qtd_estoque_unidades) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        erro: `Estoque insuficiente. Existem apenas ${produto.qtd_estoque_unidades} unidades de "${produto.nome}" em estoque.`
      });
    }

    const novaQuantidade = tipo === 'entrada'
      ? produto.qtd_estoque_unidades + quantidadeUnidades
      : produto.qtd_estoque_unidades - quantidadeUnidades;

    await client.query(`UPDATE produtos SET qtd_estoque_unidades = $1 WHERE id = $2`, [novaQuantidade, produtoId]);

    const movResult = await client.query(
      `INSERT INTO movimentacoes_estoque (empresa_id, produto_id, usuario_id, tipo, quantidade_unidades, motivo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.empresaId, produtoId, req.user.id, tipo, quantidadeUnidades, motivo || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ movimento: movResult.rows[0], estoqueAtual: novaQuantidade });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
