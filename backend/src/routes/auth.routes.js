const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { modulosPorOmissao, TODOS_OS_MODULOS } = require('../config/modulos');

const router = express.Router();

function assinarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, empresaId: usuario.empresa_id, papel: usuario.papel },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function formatarUsuarioEmpresa(usuario, empresa) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    papel: usuario.papel,
    empresa: {
      id: empresa.id,
      nomeNegocio: empresa.nome_negocio,
      tipoNegocio: empresa.tipo_negocio,
      cidade: empresa.cidade,
      endereco: empresa.endereco,
      telefone: empresa.telefone,
      logoUrl: empresa.logo_url,
      nuit: empresa.nuit,
      formaJuridica: empresa.forma_juridica,
      sectorActividade: empresa.sector_actividade,
      cae: empresa.cae,
      email: empresa.email,
      capitalSocial: empresa.capital_social,
      dataConstituicao: empresa.data_constituicao,
      regimeIva: empresa.regime_iva,
      regimeIrpc: empresa.regime_irpc,
      taxaIva: empresa.taxa_iva,
      taxaIrpc: empresa.taxa_irpc,
      numeroFuncionarios: empresa.numero_funcionarios,
      responsavelFinanceiro: empresa.responsavel_financeiro,
      contabilistaCertificado: empresa.contabilista_certificado,
      modulosAtivos: empresa.modulos_ativos || [],
    },
  };
}

// POST /api/auth/register
// Cria a empresa (negócio) e o utilizador administrador numa única transação.
router.post('/register', async (req, res, next) => {
  const { nome, email, telefone, senha, nomeNegocio, tipoNegocio, cidade, endereco } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empresaResult = await client.query(
      `INSERT INTO empresas (nome_negocio, tipo_negocio, cidade, endereco, telefone, modulos_ativos)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nomeNegocio || 'Meu Negócio', tipoNegocio || null, cidade || null, endereco || null, telefone || null,
       modulosPorOmissao(tipoNegocio)]
    );
    const empresa = empresaResult.rows[0];

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuarioResult = await client.query(
      `INSERT INTO usuarios (empresa_id, nome, email, telefone, senha_hash, papel)
       VALUES ($1, $2, $3, $4, $5, 'dono') RETURNING *`,
      [empresa.id, nome, email.toLowerCase(), telefone || null, senhaHash]
    );
    const usuario = usuarioResult.rows[0];

    const categoriasPadrao = [
      ['Vendas','receita','#10B981'], ['Serviços','receita','#34D399'],
      ['Recebimento de Cliente','receita','#3B82F6'], ['Outras Receitas','receita','#2563EB'],
      ['Fornecedores','despesa','#2563EB'], ['Renda/Aluguer','despesa','#3B82F6'],
      ['Salários','despesa','#10B981'], ['Transporte','despesa','#34D399'],
      ['Energia/Água','despesa','#C98A1A'], ['Outras Despesas','despesa','#8598AB'],
    ];
    for (const [cnome, ctipo, ccor] of categoriasPadrao) {
      await client.query(
        `INSERT INTO categorias_financeiras (empresa_id, nome, tipo, cor) VALUES ($1,$2,$3,$4)`,
        [empresa.id, cnome, ctipo, ccor]
      );
    }

    await client.query('COMMIT');

    const token = assinarToken(usuario);
    res.status(201).json({ token, usuario: formatarUsuarioEmpresa(usuario, empresa) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma conta registada com este e-mail.' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, e.nome_negocio, e.tipo_negocio, e.cidade, e.endereco, e.telefone AS empresa_telefone, e.logo_url,
              e.nuit, e.forma_juridica, e.sector_actividade, e.cae, e.email AS empresa_email, e.capital_social,
              e.data_constituicao, e.regime_iva, e.regime_irpc, e.taxa_iva, e.taxa_irpc, e.numero_funcionarios,
              e.responsavel_financeiro, e.contabilista_certificado, e.modulos_ativos
       FROM usuarios u JOIN empresas e ON e.id = u.empresa_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }
    const row = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, row.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }

    const usuario = { id: row.id, empresa_id: row.empresa_id, papel: row.papel, nome: row.nome, email: row.email, telefone: row.telefone };
    const empresa = { id: row.empresa_id, nome_negocio: row.nome_negocio, tipo_negocio: row.tipo_negocio, cidade: row.cidade,
      endereco: row.endereco, telefone: row.empresa_telefone, logo_url: row.logo_url, nuit: row.nuit, forma_juridica: row.forma_juridica,
      sector_actividade: row.sector_actividade, cae: row.cae, email: row.empresa_email, capital_social: row.capital_social,
      data_constituicao: row.data_constituicao, regime_iva: row.regime_iva, regime_irpc: row.regime_irpc, taxa_iva: row.taxa_iva,
      taxa_irpc: row.taxa_irpc, numero_funcionarios: row.numero_funcionarios, responsavel_financeiro: row.responsavel_financeiro,
      contabilista_certificado: row.contabilista_certificado, modulos_ativos: row.modulos_ativos };

    const token = assinarToken(usuario);
    res.json({ token, usuario: formatarUsuarioEmpresa(usuario, empresa) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — dados do utilizador autenticado (útil para restaurar a sessão no frontend)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.*, e.nome_negocio, e.tipo_negocio, e.cidade, e.endereco, e.telefone AS empresa_telefone, e.logo_url,
              e.nuit, e.forma_juridica, e.sector_actividade, e.cae, e.email AS empresa_email, e.capital_social,
              e.data_constituicao, e.regime_iva, e.regime_irpc, e.taxa_iva, e.taxa_irpc, e.numero_funcionarios,
              e.responsavel_financeiro, e.contabilista_certificado, e.modulos_ativos
       FROM usuarios u JOIN empresas e ON e.id = u.empresa_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    const row = result.rows[0];
    const usuario = { id: row.id, papel: row.papel, nome: row.nome, email: row.email, telefone: row.telefone };
    const empresa = { id: row.empresa_id, nome_negocio: row.nome_negocio, tipo_negocio: row.tipo_negocio, cidade: row.cidade,
      endereco: row.endereco, telefone: row.empresa_telefone, logo_url: row.logo_url, nuit: row.nuit, forma_juridica: row.forma_juridica,
      sector_actividade: row.sector_actividade, cae: row.cae, email: row.empresa_email, capital_social: row.capital_social,
      data_constituicao: row.data_constituicao, regime_iva: row.regime_iva, regime_irpc: row.regime_irpc, taxa_iva: row.taxa_iva,
      taxa_irpc: row.taxa_irpc, numero_funcionarios: row.numero_funcionarios, responsavel_financeiro: row.responsavel_financeiro,
      contabilista_certificado: row.contabilista_certificado, modulos_ativos: row.modulos_ativos };
    res.json(formatarUsuarioEmpresa(usuario, empresa));
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/empresa — atualizar dados do negócio (ecrã de Perfil / Dados Fiscais)
router.put('/empresa', requireAuth, async (req, res, next) => {
  const {
    nomeNegocio, tipoNegocio, cidade, endereco, telefone, logoUrl,
    nuit, formaJuridica, sectorActividade, cae, email, capitalSocial, dataConstituicao,
    regimeIva, regimeIrpc, taxaIva, taxaIrpc, numeroFuncionarios,
    responsavelFinanceiro, contabilistaCertificado
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE empresas SET
         nome_negocio             = COALESCE($1, nome_negocio),
         tipo_negocio             = COALESCE($2, tipo_negocio),
         cidade                   = COALESCE($3, cidade),
         endereco                 = COALESCE($4, endereco),
         telefone                 = COALESCE($5, telefone),
         logo_url                 = COALESCE($6, logo_url),
         nuit                     = COALESCE($7, nuit),
         forma_juridica           = COALESCE($8, forma_juridica),
         sector_actividade        = COALESCE($9, sector_actividade),
         cae                      = COALESCE($10, cae),
         email                    = COALESCE($11, email),
         capital_social           = COALESCE($12, capital_social),
         data_constituicao        = COALESCE($13, data_constituicao),
         regime_iva               = COALESCE($14, regime_iva),
         regime_irpc              = COALESCE($15, regime_irpc),
         taxa_iva                 = COALESCE($16, taxa_iva),
         taxa_irpc                = COALESCE($17, taxa_irpc),
         numero_funcionarios      = COALESCE($18, numero_funcionarios),
         responsavel_financeiro   = COALESCE($19, responsavel_financeiro),
         contabilista_certificado = COALESCE($20, contabilista_certificado)
       WHERE id = $21 RETURNING *`,
      [nomeNegocio, tipoNegocio, cidade, endereco, telefone, logoUrl,
       nuit, formaJuridica, sectorActividade, cae, email, capitalSocial, dataConstituicao,
       regimeIva, regimeIrpc, taxaIva, taxaIrpc, numeroFuncionarios,
       responsavelFinanceiro, contabilistaCertificado, req.user.empresaId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/usuario — atualizar nome e telefone do próprio utilizador (ecrã de Perfil)
router.put('/usuario', requireAuth, async (req, res, next) => {
  const { nome, telefone } = req.body;
  try {
    const result = await pool.query(
      `UPDATE usuarios SET
         nome     = COALESCE($1, nome),
         telefone = COALESCE($2, telefone)
       WHERE id = $3 RETURNING *`,
      [nome, telefone, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/senha — trocar a senha (exige a senha atual correta)
router.put('/senha', requireAuth, async (req, res, next) => {
  const { senhaAtual, senhaNova } = req.body;
  if (!senhaAtual || !senhaNova) return res.status(400).json({ erro: 'Preencha a senha atual e a nova senha.' });
  if (senhaNova.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
  try {
    const result = await pool.query(`SELECT senha_hash FROM usuarios WHERE id = $1`, [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Utilizador não encontrado.' });

    const senhaValida = await bcrypt.compare(senhaAtual, result.rows[0].senha_hash);
    if (!senhaValida) return res.status(401).json({ erro: 'A senha atual está incorreta.' });

    const novaHash = await bcrypt.hash(senhaNova, 10);
    await pool.query(`UPDATE usuarios SET senha_hash = $1 WHERE id = $2`, [novaHash, req.user.id]);
    res.json({ sucesso: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/modulos — activar/desactivar módulos do ERP (Configurações > Módulos)
router.put('/modulos', requireAuth, async (req, res, next) => {
  const { modulosAtivos } = req.body;
  if (!Array.isArray(modulosAtivos)) {
    return res.status(400).json({ erro: 'Lista de módulos inválida.' });
  }
  const validos = modulosAtivos.filter(m => TODOS_OS_MODULOS.includes(m));
  try {
    const result = await pool.query(
      `UPDATE empresas SET modulos_ativos = $1 WHERE id = $2 RETURNING modulos_ativos`,
      [validos, req.user.empresaId]
    );
    res.json({ modulosAtivos: result.rows[0].modulos_ativos });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
