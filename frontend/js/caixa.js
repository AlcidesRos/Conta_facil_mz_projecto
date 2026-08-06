/* ContaFácil MZ — Módulo Caixa (abertura/fecho/sangrias/reforços)
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   CAIXA
========================================================= */
async function carregarCaixaAtual(){
  const sessao = await apiFetch('/caixa/atual');
  if(!sessao){ state.caixaAtual = null; return; }

  const transacoesHoje = await apiFetch('/transacoes?periodo=hoje');
  const movimentosTransacoes = transacoesHoje.map(t=>({
    hora:'—', tipo: t.tipo==='receita'?'entrada':'saida', descricao: t.descricao||t.categoria, valor:Number(t.valor)
  }));
  const movimentosCaixa = (sessao.movimentosCaixa||[]).map(m=>({
    hora: new Date(m.criado_em).toTimeString().slice(0,5),
    tipo: m.tipo==='sangria'? 'saida':'entrada',
    descricao: (m.tipo==='sangria'?'Sangria — ':'Reforço — ') + (m.motivo||'sem motivo indicado'),
    valor: Number(m.valor)
  }));

  state.caixaAtual = {
    saldoInicial: Number(sessao.saldo_inicial),
    data: (sessao.aberto_em||'').slice(0,10),
    hora: new Date(sessao.aberto_em).toTimeString().slice(0,5),
    entradas: Number(sessao.entradas), saidas: Number(sessao.saidas),
    sangrias: Number(sessao.sangrias), reforcos: Number(sessao.reforcos),
    saldoEsperado: Number(sessao.saldoEsperado),
    movimentos: [...movimentosTransacoes, ...movimentosCaixa]
  };
}

async function carregarCaixaHistorico(){
  const rows = await apiFetch('/caixa/historico');
  state.cashSessions = rows.map(r=>({
    id:r.id, data:(r.fechado_em||r.aberto_em||'').slice(0,10),
    saldoInicial:Number(r.saldo_inicial), entradas:Number(r.entradas), saidas:Number(r.saidas),
    sangrias:Number(r.sangrias||0), reforcos:Number(r.reforcos||0),
    saldoFinalContado:Number(r.saldo_final_contado), diferenca:Number(r.diferenca)
  }));
}

async function renderCaixa(){
  try{
    await carregarCaixaAtual();
    await carregarCaixaHistorico();
  }catch(err){ alert(err.message); return; }

  const aberto = !!state.caixaAtual;
  document.getElementById('caixa-fechado-state').style.display = aberto? 'none':'block';
  document.getElementById('caixa-aberto-state').style.display = aberto? 'block':'none';

  if(aberto){
    document.getElementById('caixa-saldo-inicial').textContent = formatMZN(state.caixaAtual.saldoInicial);
    document.getElementById('caixa-entradas').textContent = formatMZN(state.caixaAtual.entradas);
    document.getElementById('caixa-saidas').textContent = formatMZN(state.caixaAtual.saidas);
    document.getElementById('caixa-sangrias').textContent = formatMZN(state.caixaAtual.sangrias);
    document.getElementById('caixa-reforcos').textContent = formatMZN(state.caixaAtual.reforcos);
    document.getElementById('caixa-saldo-esperado').textContent = formatMZN(state.caixaAtual.saldoEsperado);
    document.getElementById('caixa-aberto-desde').textContent = `${formatDatePt(state.caixaAtual.data)} às ${state.caixaAtual.hora}`;

    const tbody = document.querySelector('#table-caixa-movimentos tbody');
    tbody.innerHTML = state.caixaAtual.movimentos.map(m=>`
      <tr><td class="mono">${m.hora}</td><td><span class="tag ${m.tipo==='entrada'?'green':'red'}">${m.tipo==='entrada'?'Entrada':'Saída'}</span></td>
      <td>${m.descricao}</td><td style="text-align:right;" class="${m.tipo==='entrada'?'amount-pos':'amount-neg'}">${formatMZN(m.valor)}</td></tr>`
    ).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--slate-400);padding:20px;">Sem movimentos ainda hoje.</td></tr>';
  }

  const tbodyHist = document.querySelector('#table-caixa-historico tbody');
  const historico = [...state.cashSessions].sort((a,b)=>b.data.localeCompare(a.data));
  tbodyHist.innerHTML = historico.map(c=>`
    <tr>
      <td>${formatDatePt(c.data)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(c.saldoInicial)}</td>
      <td style="text-align:right;" class="amount-pos">${formatMZN(c.entradas)}</td>
      <td style="text-align:right;" class="amount-neg">${formatMZN(c.saidas)}</td>
      <td style="text-align:right;" class="amount-neg">${formatMZN(c.sangrias)}</td>
      <td style="text-align:right;" class="amount-pos">${formatMZN(c.reforcos)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(c.saldoFinalContado)}</td>
      <td style="text-align:right;" class="${c.diferenca===0?'':(c.diferenca>0?'amount-pos':'amount-neg')}">${c.diferenca>0?'+':''}${formatMZN(c.diferenca)}</td>
    </tr>`).join('');
  document.getElementById('empty-caixa-historico').style.display = state.cashSessions.length? 'none':'block';
}

async function handleAbrirCaixa(e){
  e.preventDefault();
  const payload = { saldoInicial: parseFloat(document.getElementById('caixa-abrir-saldo').value) };
  try{
    await apiFetch('/caixa/abrir', { method:'POST', body: JSON.stringify(payload) });
    e.target.reset();
    closeModal('modal-caixa-abrir');
    await renderCaixa();
  }catch(err){ alert(err.message); }
}

function abrirModalMovimentoCaixa(tipo){
  document.getElementById('caixa-mov-tipo').value = tipo;
  document.getElementById('caixa-mov-titulo').textContent = tipo==='sangria' ? 'Sangria (retirar dinheiro do caixa)' : 'Reforço (adicionar dinheiro ao caixa)';
  document.querySelector('#modal-caixa-movimento form').reset();
  document.getElementById('caixa-mov-tipo').value = tipo;
  openModal('modal-caixa-movimento');
}

async function handleRegistarMovimentoCaixa(e){
  e.preventDefault();
  const tipo = document.getElementById('caixa-mov-tipo').value;
  const payload = {
    valor: parseFloat(document.getElementById('caixa-mov-valor').value),
    motivo: document.getElementById('caixa-mov-motivo').value.trim()
  };
  try{
    await apiFetch('/caixa/'+tipo, { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-caixa-movimento');
    await renderCaixa();
  }catch(err){ alert(err.message); }
}

function openFecharCaixaModal(){
  document.getElementById('fechar-saldo-inicial').textContent = formatMZN(state.caixaAtual.saldoInicial);
  document.getElementById('fechar-entradas').textContent = formatMZN(state.caixaAtual.entradas);
  document.getElementById('fechar-saidas').textContent = formatMZN(state.caixaAtual.saidas);
  document.getElementById('fechar-sangrias').textContent = formatMZN(state.caixaAtual.sangrias);
  document.getElementById('fechar-reforcos').textContent = formatMZN(state.caixaAtual.reforcos);
  document.getElementById('fechar-saldo-esperado').textContent = formatMZN(state.caixaAtual.saldoEsperado);
  document.getElementById('caixa-fechar-saldo').value = '';
  document.getElementById('caixa-diferenca').value = '';
  openModal('modal-caixa-fechar');
}

function updateDiferencaCaixa(){
  const contado = parseFloat(document.getElementById('caixa-fechar-saldo').value)||0;
  document.getElementById('caixa-diferenca').value = formatMZN(contado - state.caixaAtual.saldoEsperado);
}

async function handleFecharCaixa(e){
  e.preventDefault();
  const payload = { saldoFinalContado: parseFloat(document.getElementById('caixa-fechar-saldo').value) };
  try{
    await apiFetch('/caixa/fechar', { method:'POST', body: JSON.stringify(payload) });
    e.target.reset();
    closeModal('modal-caixa-fechar');
    await renderCaixa();
  }catch(err){ alert(err.message); }
}

