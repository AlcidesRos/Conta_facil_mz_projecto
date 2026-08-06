const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/produtos?busca=texto
router.get('/', async (req, res, next) => {
  const { busca } = req.query;
  try {
    const params = [req.user.empresaId];
    let sql = `SELECT * FROM produtos WHERE empresa_id = $1`;
    if (busca) {
      params.push(`%${busca.toLowerCase()}%`);
      sql += ` AND (LOWER(nome) LIKE $2 OR LOWER(marca) LIKE $2 OR LOWER(codigo_interno) LIKE $2 OR LOWER(codigo_barras) LIKE $2)`;
    }
    sql += ` ORDER BY nome ASC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/produtos/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM produtos WHERE id = $1 AND empresa_id = $2`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// POST /api/produtos
router.post('/', async (req, res, next) => {
  const p = req.body;
  if (!p.nome || p.precoVendaUnidade == null || !p.qtdPorCaixa) {
    return res.status(400).json({ erro: 'Nome, preço de venda por unidade e quantidade por caixa são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO produtos
        (empresa_id, nome, categoria, marca, codigo_interno, codigo_barras, fornecedor_id, descricao,
         preco_compra, preco_venda_unidade, preco_venda_caixa, qtd_por_caixa, qtd_estoque_unidades,
         qtd_minima_caixas, imagem_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [req.user.empresaId, p.nome, p.categoria || null, p.marca || null, p.codigoInterno || null,
       p.codigoBarras || null, p.fornecedorId || null, p.descricao || null,
       p.precoCompra || 0, p.precoVendaUnidade, p.precoVendaCaixa || 0, p.qtdPorCaixa,
       p.qtdEstoqueUnidades || 0, p.qtdMinimaCaixas || 0, p.imagemUrl || null, p.status || 'Ativo']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/produtos/:id
router.put('/:id', async (req, res, next) => {
  const p = req.body;
  try {
    const result = await pool.query(
      `UPDATE produtos SET
         nome = $1, categoria = $2, marca = $3, codigo_interno = $4, codigo_barras = $5,
         fornecedor_id = $6, descricao = $7, preco_compra = $8, preco_venda_unidade = $9,
         preco_venda_caixa = $10, qtd_por_caixa = $11, qtd_minima_caixas = $12,
         imagem_url = COALESCE($13, imagem_url), status = $14
       WHERE id = $15 AND empresa_id = $16 RETURNING *`,
      [p.nome, p.categoria, p.marca, p.codigoInterno, p.codigoBarras, p.fornecedorId || null,
       p.descricao, p.precoCompra, p.precoVendaUnidade, p.precoVendaCaixa, p.qtdPorCaixa,
       p.qtdMinimaCaixas, p.imagemUrl || null, p.status, req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/produtos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM produtos WHERE id = $1 AND empresa_id = $2 RETURNING id`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
