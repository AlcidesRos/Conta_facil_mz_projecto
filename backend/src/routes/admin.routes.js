const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/* =========================================================
   EMPRESAS — visível para super_admin E visualizador (só leitura)
========================================================= */

// GET /api/admin/empresas/:id/resumo — visão completa de UMA empresa (só leitura)
router.get('/empresas/:id/resumo', requireRole('super_admin', 'visualizador'), async (req, res, next) => {
  const empresaId = req.params.id;
  try {
    const empresaResult = await pool.query(`SELECT * FROM empresas WHERE id=$1`, [empresaId]);
    if (empresaResult.rows.length === 0) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    const [saldoResult, mesResult, clientesResult, funcionariosResult, produtosResult, vendasResult] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END),0) AS saldo FROM transacoes WHERE empresa_id=$1`, [empresaId]),
      pool.query(`SELECT tipo, COALESCE(SUM(valor),0) AS total FROM transacoes WHERE empresa_id=$1 AND date_trunc('month', data) = date_trunc('month', CURRENT_DATE) GROUP BY tipo`, [empresaId]),
      pool.query(`SELECT id, nome, telefone, saldo_devedor FROM clientes WHERE empresa_id=$1 ORDER BY saldo_devedor DESC LIMIT 50`, [empresaId]),
      pool.query(`SELECT id, nome, cargo, salario, status FROM funcionarios WHERE empresa_id=$1 ORDER BY nome LIMIT 50`, [empresaId]),
      pool.query(`SELECT COUNT(*) FROM produtos WHERE empresa_id=$1`, [empresaId]),
      pool.query(`SELECT COUNT(*) FROM vendas WHERE empresa_id=$1`, [empresaId]),
    ]);

    let receitasMes = 0, despesasMes = 0;
    mesResult.rows.forEach(r => { if (r.tipo === 'receita') receitasMes = Number(r.total); if (r.tipo === 'despesa') despesasMes = Number(r.total); });

    res.json({
      empresa: empresaResult.rows[0],
      saldoAtual: Number(saldoResult.rows[0].saldo),
      receitasMes, despesasMes, lucroMes: receitasMes - despesasMes,
      totalProdutos: Number(produtosResult.rows[0].count),
      totalVendas: Number(vendasResult.rows[0].count),
      clientes: clientesResult.rows,
      funcionarios: funcionariosResult.rows,
    });
  } catch (err) { next(err); }
});

// GET /api/admin/empresas — lista todas as empresas do SaaS, com o dono e alguns totais
router.get('/empresas', requireRole('super_admin', 'visualizador'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id, e.nome_negocio, e.tipo_negocio, e.cidade, e.telefone, e.criado_em,
        u.nome AS dono_nome, u.email AS dono_email,
        (SELECT COUNT(*) FROM produtos p WHERE p.empresa_id = e.id) AS total_produtos,
        (SELECT COUNT(*) FROM usuarios uu WHERE uu.empresa_id = e.id) AS total_usuarios,
        (SELECT COALESCE(SUM(valor),0) FROM transacoes t WHERE t.empresa_id = e.id AND t.tipo='receita'
           AND date_trunc('month', t.data) = date_trunc('month', CURRENT_DATE)) AS receitas_mes
      FROM empresas e
      LEFT JOIN usuarios u ON u.empresa_id = e.id AND u.papel = 'dono'
      ORDER BY e.criado_em DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/admin/empresas/:id/produtos — catálogo de produtos de UMA empresa (leitura)
router.get('/empresas/:id/produtos', requireRole('super_admin', 'visualizador'), async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM produtos WHERE empresa_id = $1 ORDER BY nome ASC`, [req.params.id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// DELETE /api/admin/empresas/:id — remove uma empresa e todos os seus dados (apenas super_admin)
router.delete('/empresas/:id', requireRole('super_admin'), async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM empresas WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

/* =========================================================
   UTILIZADORES — apenas super_admin
========================================================= */

// GET /api/admin/usuarios — lista todos os utilizadores do SaaS
router.get('/usuarios', requireRole('super_admin'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.nome, u.email, u.telefone, u.papel, u.criado_em,
             e.id AS empresa_id, e.nome_negocio
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      ORDER BY u.criado_em DESC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/admin/usuarios — criar um utilizador "visualizador" ou "super_admin"
// (não está associado a nenhum negócio próprio — usa a empresa de quem o cria
// apenas para satisfazer a estrutura da base de dados, mas isso é irrelevante
// para estes dois papéis, que não ficam limitados a uma única empresa)
router.post('/usuarios', requireRole('super_admin'), async (req, res, next) => {
  const { nome, email, senha, telefone, papel } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  if (!['super_admin', 'visualizador', 'dono'].includes(papel)) {
    return res.status(400).json({ erro: 'Papel inválido.' });
  }
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (empresa_id, nome, email, telefone, senha_hash, papel)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nome, email, telefone, papel, criado_em`,
      [req.user.empresaId, nome, email.toLowerCase(), telefone || null, senhaHash, papel]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' });
    next(err);
  }
});

// PATCH /api/admin/usuarios/:id/papel — mudar o papel de um utilizador
router.patch('/usuarios/:id/papel', requireRole('super_admin'), async (req, res, next) => {
  const { papel } = req.body;
  if (!['super_admin', 'dono', 'visualizador'].includes(papel)) {
    return res.status(400).json({ erro: 'Papel inválido.' });
  }
  try {
    const result = await pool.query(
      `UPDATE usuarios SET papel=$1 WHERE id=$2 RETURNING id, nome, email, papel`,
      [papel, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/admin/usuarios/:id — remover um utilizador (não permite remover-se a si próprio)
router.delete('/usuarios/:id', requireRole('super_admin'), async (req, res, next) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ erro: 'Não pode remover a sua própria conta por aqui.' });
  }
  try {
    const result = await pool.query(`DELETE FROM usuarios WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
