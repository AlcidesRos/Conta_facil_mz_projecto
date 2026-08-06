const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/notificacoes — calcula alertas em tempo real (estoque baixo, clientes
// devedores) e junta com as notificações persistidas (ex: novas vendas).
router.get('/', async (req, res, next) => {
  try {
    const estoqueBaixoResult = await pool.query(
      `SELECT id, nome, qtd_por_caixa, qtd_estoque_unidades, qtd_minima_caixas,
              FLOOR(qtd_estoque_unidades::numeric / qtd_por_caixa) AS caixas_atuais
       FROM produtos
       WHERE empresa_id = $1 AND FLOOR(qtd_estoque_unidades::numeric / qtd_por_caixa) <= qtd_minima_caixas`,
      [req.user.empresaId]
    );
    const clientesDevedoresResult = await pool.query(
      `SELECT id, nome, saldo_devedor FROM clientes WHERE empresa_id = $1 AND saldo_devedor > 0`,
      [req.user.empresaId]
    );
    const recentesResult = await pool.query(
      `SELECT * FROM notificacoes WHERE empresa_id = $1 ORDER BY criado_em DESC LIMIT 15`,
      [req.user.empresaId]
    );

    const notificacoes = [
      ...estoqueBaixoResult.rows.map(p => ({
        tipo: 'estoque_baixo',
        titulo: `Estoque baixo: ${p.nome}`,
        mensagem: `Restam ${p.caixas_atuais} caixa(s).`,
      })),
      ...clientesDevedoresResult.rows.map(c => ({
        tipo: 'cliente_devedor',
        titulo: `${c.nome} tem dívida pendente`,
        mensagem: `Saldo devedor: ${Number(c.saldo_devedor).toFixed(2)} MT`,
      })),
      ...recentesResult.rows.map(n => ({ tipo: n.tipo, titulo: n.titulo, mensagem: n.mensagem, criadoEm: n.criado_em, lida: n.lida, id: n.id })),
    ];

    res.json({
      total: notificacoes.length,
      alertasCriticos: estoqueBaixoResult.rows.length + clientesDevedoresResult.rows.length,
      notificacoes,
    });
  } catch (err) { next(err); }
});

// PATCH /api/notificacoes/:id/lida — marcar uma notificação persistida como lida
router.patch('/:id/lida', async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notificacoes SET lida = true WHERE id=$1 AND empresa_id=$2 RETURNING *`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Notificação não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
