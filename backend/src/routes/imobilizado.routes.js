const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Depreciação linear: depreciação anual = custo / vida útil.
// Valor líquido = custo - (depreciação anual × anos decorridos), nunca abaixo de 0.
function calcularDepreciacao(bem) {
  const custo = Number(bem.custo_aquisicao);
  const vidaUtil = Number(bem.vida_util_anos);
  const depreciacaoAnual = custo / vidaUtil;
  const taxaDepreciacao = 1 / vidaUtil;
  const hoje = new Date();
  const aquisicao = new Date(bem.data_aquisicao);
  const anosDecorridos = Math.max(0, (hoje - aquisicao) / (365.25 * 24 * 3600 * 1000));
  const depreciacaoAcumulada = Math.min(custo, depreciacaoAnual * anosDecorridos);
  const valorLiquido = Math.max(0, custo - depreciacaoAcumulada);
  return {
    depreciacaoAnual: Math.round(depreciacaoAnual * 100) / 100,
    taxaDepreciacao: Math.round(taxaDepreciacao * 10000) / 10000,
    valorLiquido: Math.round(valorLiquido * 100) / 100
  };
}

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM imobilizado WHERE empresa_id=$1 ORDER BY data_aquisicao DESC`, [req.user.empresaId]);
    const comCalculo = result.rows.map(bem => ({ ...bem, ...calcularDepreciacao(bem) }));
    res.json(comCalculo);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { descricao, categoria, custoAquisicao, dataAquisicao, vidaUtilAnos } = req.body;
  if (!descricao || !custoAquisicao || !dataAquisicao) {
    return res.status(400).json({ erro: 'Descrição, custo de aquisição e data de aquisição são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO imobilizado (empresa_id, descricao, categoria, custo_aquisicao, data_aquisicao, vida_util_anos)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.empresaId, descricao, categoria || null, custoAquisicao, dataAquisicao, vidaUtilAnos || 5]
    );
    res.status(201).json({ ...result.rows[0], ...calcularDepreciacao(result.rows[0]) });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM imobilizado WHERE id=$1 AND empresa_id=$2 RETURNING id`,
      [req.params.id, req.user.empresaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Bem não encontrado.' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
