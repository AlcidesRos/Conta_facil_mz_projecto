const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const METODOS_PAGAMENTO = ['Dinheiro', 'M-Pesa', 'e-Mola', 'Transferência Bancária', 'Cartão'];

// GET /api/vendas
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT v.*, c.nome AS cliente_nome,
              json_agg(json_build_object(
                'produtoId', i.produto_id, 'produtoNome', p.nome,
                'quantidade', i.quantidade, 'precoUnitario', i.preco_unitario, 'subtotal', i.subtotal
              )) AS itens
       FROM vendas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       JOIN itens_venda i ON i.venda_id = v.id
       JOIN produtos p ON p.id = i.produto_id
       WHERE v.empresa_id = $1
       GROUP BY v.id, c.nome
       ORDER BY v.data DESC, v.hora DESC`,
      [req.user.empresaId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/vendas
// body: { clienteId, formaPagamento, itens: [{ produtoId, quantidade }] }
// Verifica estoque, dá baixa automática, calcula o lucro (venda - custo) e
// lança a receita "Vendas" — tudo numa única transação atómica.
router.post('/', async (req, res, next) => {
  const { clienteId, formaPagamento, itens } = req.body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'A venda deve ter pelo menos um item.' });
  }
  if (!METODOS_PAGAMENTO.includes(formaPagamento)) {
    return res.status(400).json({ erro: 'Forma de pagamento inválida.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let total = 0, custoTotal = 0;
    const itensProcessados = [];

    for (const item of itens) {
      const produtoResult = await client.query(
        `SELECT * FROM produtos WHERE id=$1 AND empresa_id=$2 FOR UPDATE`,
        [item.produtoId, req.user.empresaId]
      );
      if (produtoResult.rows.length === 0) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
      const produto = produtoResult.rows[0];

      if (item.quantidade > produto.qtd_estoque_unidades) {
        throw Object.assign(
          new Error(`Estoque insuficiente de "${produto.nome}". Existem apenas ${produto.qtd_estoque_unidades} unidades.`),
          { status: 400 }
        );
      }

      const subtotal = item.quantidade * Number(produto.preco_venda_unidade);
      total += subtotal;
      custoTotal += item.quantidade * Number(produto.preco_compra);

      await client.query(`UPDATE produtos SET qtd_estoque_unidades = qtd_estoque_unidades - $1 WHERE id = $2`,
        [item.quantidade, produto.id]);

      await client.query(
        `INSERT INTO movimentacoes_estoque (empresa_id, produto_id, usuario_id, tipo, quantidade_unidades, motivo)
         VALUES ($1,$2,$3,'saida',$4,'Venda ao balcão (PDV)')`,
        [req.user.empresaId, produto.id, req.user.id, item.quantidade]
      );

      itensProcessados.push({ produtoId: produto.id, quantidade: item.quantidade, precoUnitario: produto.preco_venda_unidade, custoUnitario: produto.preco_compra, subtotal });
    }

    const contagemResult = await client.query(`SELECT COUNT(*) FROM vendas WHERE empresa_id = $1`, [req.user.empresaId]);
    const numero = 'REC-' + String(Number(contagemResult.rows[0].count) + 1).padStart(5, '0');
    const lucro = total - custoTotal;

    const vendaResult = await client.query(
      `INSERT INTO vendas (empresa_id, numero, cliente_id, usuario_id, forma_pagamento, total, custo_total, lucro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.empresaId, numero, clienteId || null, req.user.id, formaPagamento, total, custoTotal, lucro]
    );
    const venda = vendaResult.rows[0];

    for (const item of itensProcessados) {
      await client.query(
        `INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, custo_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [venda.id, item.produtoId, item.quantidade, item.precoUnitario, item.custoUnitario, item.subtotal]
      );
    }

    await client.query(
      `INSERT INTO transacoes (empresa_id, tipo, valor, categoria, descricao, cliente_id)
       VALUES ($1, 'receita', $2, 'Vendas', $3, $4)`,
      [req.user.empresaId, total, `Venda ${numero} (${formaPagamento})`, clienteId || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...venda, itens: itensProcessados });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
