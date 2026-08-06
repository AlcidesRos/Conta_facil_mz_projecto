/* ContaFácil MZ — Receitas e Despesas
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   RECEITAS / DESPESAS
========================================================= */
async function carregarTransacoes(tipo, periodo){
  const params = new URLSearchParams();
  if(tipo) params.set('tipo', tipo);
  params.set('periodo', periodo || state.currentPeriod);
  const rows = await apiFetch('/transacoes?' + params.toString());
  return rows.map(normalizeTransacao);
}

async function renderReceitas(){
  let items;
  try{ items = (await carregarTransacoes('receita')).sort((a,b)=>b.data.localeCompare(a.data)); }
  catch(err){ alert(err.message); return; }

  const total = items.reduce((s,t)=>s+t.valor,0);
  document.getElementById('receitas-total-periodo').textContent = formatMZN(total);
  const tbody = document.querySelector('#table-receitas tbody');
  tbody.innerHTML = items.map(t=>`
    <tr>
      <td>${formatDatePt(t.data)}</td>
      <td><span class="tag green">${t.categoria}</span></td>
      <td>${t.descricao}</td>
      <td style="text-align:right;" class="amount-pos">+ ${formatMZN(t.valor)}</td>
      <td class="row-actions"><button onclick="deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-receitas').style.display = items.length? 'none':'block';
}

async function renderDespesas(){
  let items;
  try{ items = (await carregarTransacoes('despesa')).sort((a,b)=>b.data.localeCompare(a.data)); }
  catch(err){ alert(err.message); return; }

  const total = items.reduce((s,t)=>s+t.valor,0);
  document.getElementById('despesas-total-periodo').textContent = formatMZN(total);
  const tbody = document.querySelector('#table-despesas tbody');
  tbody.innerHTML = items.map(t=>`
    <tr>
      <td>${formatDatePt(t.data)}</td>
      <td><span class="tag red">${t.categoria}</span></td>
      <td>${t.descricao}</td>
      <td style="text-align:right;" class="amount-neg">- ${formatMZN(t.valor)}</td>
      <td class="row-actions"><button onclick="deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-despesas').style.display = items.length? 'none':'block';
}

async function popularSelectContaBancaria(selectId){
  try{
    if(!state.bancos || !state.bancos.length) state.bancos = await apiFetch('/bancos');
    document.getElementById(selectId).innerHTML = '<option value="">— Dinheiro/Caixa</option>' +
      state.bancos.filter(b=>b.ativo).map(b=>`<option value="${b.id}">${b.nome_banco}</option>`).join('');
  }catch(err){ /* silencioso — o campo fica só com "Dinheiro/Caixa" */ }
}

async function openReceitaModal(){
  document.querySelector('#modal-receita form').reset();
  try{
    const cats = await carregarCategorias('receita');
    document.getElementById('receita-categoria').innerHTML = cats.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
  }catch(err){ alert(err.message); }
  await popularSelectContaBancaria('receita-conta-bancaria');
  openModal('modal-receita');
}

async function openDespesaModal(){
  document.querySelector('#modal-despesa form').reset();
  try{
    const cats = await carregarCategorias('despesa');
    document.getElementById('despesa-categoria').innerHTML = cats.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
  }catch(err){ alert(err.message); }
  await popularSelectContaBancaria('despesa-conta-bancaria');
  openModal('modal-despesa');
}

async function handleAddReceita(e){
  e.preventDefault();
  const payload = {
    tipo:'receita',
    valor: parseFloat(document.getElementById('receita-valor').value),
    categoria: document.getElementById('receita-categoria').value,
    descricao: document.getElementById('receita-descricao').value.trim(),
    data: document.getElementById('receita-data').value,
    contaBancariaId: document.getElementById('receita-conta-bancaria').value || null
  };
  try{
    await apiFetch('/transacoes', { method:'POST', body: JSON.stringify(payload) });
    e.target.reset();
    closeModal('modal-receita');
    await renderReceitas();
    renderDashboard();
  }catch(err){ alert(err.message); }
}

async function handleAddDespesa(e){
  e.preventDefault();
  const payload = {
    tipo:'despesa',
    valor: parseFloat(document.getElementById('despesa-valor').value),
    categoria: document.getElementById('despesa-categoria').value,
    descricao: document.getElementById('despesa-descricao').value.trim(),
    data: document.getElementById('despesa-data').value,
    contaBancariaId: document.getElementById('despesa-conta-bancaria').value || null
  };
  try{
    await apiFetch('/transacoes', { method:'POST', body: JSON.stringify(payload) });
    e.target.reset();
    closeModal('modal-despesa');
    await renderDespesas();
    renderDashboard();
  }catch(err){ alert(err.message); }
}


async function deleteTransaction(id){
  try{
    await apiFetch('/transacoes/'+id, { method:'DELETE' });
    await renderReceitas();
    await renderDespesas();
    renderDashboard();
  }catch(err){ alert(err.message); }
}

