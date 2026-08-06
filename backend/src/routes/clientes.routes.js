const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/clientes
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM clientes WHERE empresa_id = $1 ORDER BY nome ASC`,
      [req.user.empresaId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/clientes
router.post('/', async (req, res, next) => {
  const { nome, telefone, email, endereco, nif, saldoDevedor } = req.body;
  if (!nome) return res.status(400).json({ erro: 'O nome do cliente é obrigatório.' });
  try {
    const result = await pool.query(
      `INSERT INTO clientes (empresa_id, nome, telefone, email, endereco, nif, saldo_devedor)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.empresaId, nome, telefone || null, email || null, endereco || null, nif || null, saldoDevedor || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res, next) => {
  const { nome, telefone, email, endereco, nif } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clientes SET nome=$1, telefone=$2, email=$3, endereco=$4, nif=$5
       WHERE id=$6 AND empresa_id=$7 RETURNING *`,
      [nome, telefone, email, endereco, nif, req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/clientes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM clientes WHERE id=$1 AND empresa_id=$2 RETURNING id`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /api/clientes/:id/pagamentos — histórico de pagamentos do cliente
router.get('/:id/pagamentos', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pagamentos_clientes WHERE cliente_id=$1 AND empresa_id=$2 ORDER BY data DESC`,
      [req.params.id, req.user.empresaId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/clientes/:id/pagamentos
// Regista o pagamento, abate o saldo devedor do cliente e lança automaticamente
// uma receita "Recebimento de Cliente" — tudo numa única transação atómica.
router.post('/:id/pagamentos', async (req, res, next) => {
  const { valor, data } = req.body;
  if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor do pagamento inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const clienteResult = await client.query(
      `SELECT * FROM clientes WHERE id=$1 AND empresa_id=$2 FOR UPDATE`,
      [req.params.id, req.user.empresaId]
    );
    if (clienteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    const cliente = clienteResult.rows[0];
    const novoSaldo = Math.max(0, Number(cliente.saldo_devedor) - Number(valor));

    await client.query(`UPDATE clientes SET saldo_devedor=$1 WHERE id=$2`, [novoSaldo, cliente.id]);

    const pagamentoResult = await client.query(
      `INSERT INTO pagamentos_clientes (empresa_id, cliente_id, valor, data)
       VALUES ($1,$2,$3, COALESCE($4, CURRENT_DATE)) RETURNING *`,
      [req.user.empresaId, cliente.id, valor, data || null]
    );

    await client.query(
      `INSERT INTO transacoes (empresa_id, tipo, valor, categoria, descricao, cliente_id, data)
       VALUES ($1, 'receita', $2, 'Recebimento de Cliente', $3, $4, COALESCE($5, CURRENT_DATE))`,
      [req.user.empresaId, valor, `Pagamento de ${cliente.nome}`, cliente.id, data || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ pagamento: pagamentoResult.rows[0], saldoDevedorAtual: novoSaldo });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
