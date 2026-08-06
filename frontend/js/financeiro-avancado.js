/* ContaFácil MZ — Bancos, Cartões, Categorias Financeiras e Conciliação Bancária
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   BANCOS
========================================================= */
async function renderBancos(){
  let rows;
  try{ rows = await apiFetch('/bancos'); }
  catch(err){ alert(err.message); return; }
  state.bancos = rows;

  const totalSaldo = rows.filter(b=>b.ativo).reduce((s,b)=>s+Number(b.saldo_atual),0);
  document.getElementById('bancos-saldo-total').textContent = formatMZN(totalSaldo);

  const tbody = document.querySelector('#table-bancos tbody');
  tbody.innerHTML = rows.map(b=>`
    <tr>
      <td><b>${b.nome_banco}</b>${!b.ativo?' <span class="tag red">Inactiva</span>':''}</td>
      <td>${b.numero_conta||'—'}</td>
      <td>${b.titular||'—'}</td>
      <td>${b.tipo_conta}</td>
      <td style="text-align:right;" class="mono">${formatMZN(b.saldo_atual)}</td>
      <td class="row-actions"><button title="Remover" onclick="deleteBanco('${b.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-bancos').style.display = rows.length? 'none':'block';
}

function openBancoModal(){ document.querySelector('#modal-banco form').reset(); openModal('modal-banco'); }

async function handleAddBanco(e){
  e.preventDefault();
  const payload = {
    nomeBanco: document.getElementById('banco-nome').value.trim(),
    numeroConta: document.getElementById('banco-numero-conta').value.trim(),
    titular: document.getElementById('banco-titular').value.trim(),
    tipoConta: document.getElementById('banco-tipo-conta').value,
    saldoInicial: parseFloat(document.getElementById('banco-saldo-inicial').value) || 0
  };
  try{
    await apiFetch('/bancos', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-banco');
    renderBancos();
  }catch(err){ alert(err.message); }
}

async function deleteBanco(id){
  if(!confirm('Remover esta conta bancária?')) return;
  try{ await apiFetch('/bancos/'+id, { method:'DELETE' }); renderBancos(); }
  catch(err){ alert(err.message); }
}

/* =========================================================
   CARTÕES
========================================================= */
async function renderCartoes(){
  let rows, bancos;
  try{ [rows, bancos] = await Promise.all([apiFetch('/cartoes'), apiFetch('/bancos')]); }
  catch(err){ alert(err.message); return; }
  state.cartoes = rows; state.bancos = bancos;

  const tbody = document.querySelector('#table-cartoes tbody');
  tbody.innerHTML = rows.map(c=>`
    <tr>
      <td><b>${c.nome}</b>${!c.ativo?' <span class="tag red">Inactivo</span>':''}</td>
      <td>${c.banco_emissor||'—'}</td>
      <td><span class="tag blue">${c.tipo}</span></td>
      <td class="mono">${c.ultimos_digitos? '•••• '+c.ultimos_digitos : '—'}</td>
      <td style="text-align:right;" class="mono">${c.limite? formatMZN(c.limite) : '—'}</td>
      <td>${c.conta_bancaria_nome||'—'}</td>
      <td class="row-actions"><button title="Remover" onclick="deleteCartao('${c.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-cartoes').style.display = rows.length? 'none':'block';
}

function openCartaoModal(){
  document.querySelector('#modal-cartao form').reset();
  document.getElementById('cartao-conta-bancaria').innerHTML = '<option value="">— Nenhuma</option>' +
    (state.bancos||[]).map(b=>`<option value="${b.id}">${b.nome_banco}</option>`).join('');
  openModal('modal-cartao');
}

async function handleAddCartao(e){
  e.preventDefault();
  const payload = {
    nome: document.getElementById('cartao-nome').value.trim(),
    bancoEmissor: document.getElementById('cartao-banco').value.trim(),
    tipo: document.getElementById('cartao-tipo').value,
    ultimosDigitos: document.getElementById('cartao-ultimos-digitos').value.trim(),
    limite: parseFloat(document.getElementById('cartao-limite').value) || null,
    contaBancariaId: document.getElementById('cartao-conta-bancaria').value || null
  };
  try{
    await apiFetch('/cartoes', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-cartao');
    renderCartoes();
  }catch(err){ alert(err.message); }
}

async function deleteCartao(id){
  if(!confirm('Remover este cartão?')) return;
  try{ await apiFetch('/cartoes/'+id, { method:'DELETE' }); renderCartoes(); }
  catch(err){ alert(err.message); }
}

/* =========================================================
   CATEGORIAS FINANCEIRAS
========================================================= */
async function carregarCategorias(tipo){
  const query = tipo? '?tipo='+tipo : '?incluirInativas=1';
  return await apiFetch('/categorias'+query);
}

async function renderCategorias(){
  let rows;
  try{ rows = await carregarCategorias(); }
  catch(err){ alert(err.message); return; }
  state.categoriasFinanceiras = rows;

  const linha = c => `
    <tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.cor};margin-right:8px;"></span><b>${c.nome}</b></td>
      <td><span class="tag ${c.ativo?'green':'red'}">${c.ativo?'Activa':'Inactiva'}</span></td>
      <td class="row-actions">
        <button title="${c.ativo?'Desactivar':'Activar'}" onclick="toggleCategoriaAtivo('${c.id}',${!c.ativo})"><i class="fa-solid ${c.ativo?'fa-eye-slash':'fa-eye'}"></i></button>
        <button title="Remover" onclick="deleteCategoria('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  document.querySelector('#table-categorias-receita tbody').innerHTML = rows.filter(c=>c.tipo==='receita').map(linha).join('');
  document.querySelector('#table-categorias-despesa tbody').innerHTML = rows.filter(c=>c.tipo==='despesa').map(linha).join('');
}

function openCategoriaModal(){ document.querySelector('#modal-categoria form').reset(); openModal('modal-categoria'); }

async function handleAddCategoria(e){
  e.preventDefault();
  const payload = {
    nome: document.getElementById('categoria-nome').value.trim(),
    tipo: document.getElementById('categoria-tipo').value,
    cor: document.getElementById('categoria-cor').value
  };
  try{
    await apiFetch('/categorias', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-categoria');
    renderCategorias();
  }catch(err){ alert(err.message); }
}

async function toggleCategoriaAtivo(id, ativo){
  try{ await apiFetch('/categorias/'+id, { method:'PUT', body: JSON.stringify({ ativo }) }); renderCategorias(); }
  catch(err){ alert(err.message); }
}

async function deleteCategoria(id){
  if(!confirm('Remover esta categoria?')) return;
  try{ await apiFetch('/categorias/'+id, { method:'DELETE' }); renderCategorias(); }
  catch(err){ alert(err.message); }
}

/* =========================================================
   CONCILIAÇÃO BANCÁRIA
========================================================= */
async function renderConciliacaoView(){
  try{
    const bancos = await apiFetch('/bancos');
    state.bancos = bancos;
    const select = document.getElementById('conciliacao-conta');
    const valorActual = select.value;
    select.innerHTML = '<option value="">Selecione uma conta bancária...</option>' +
      bancos.filter(b=>b.ativo).map(b=>`<option value="${b.id}">${b.nome_banco}${b.numero_conta? ' — '+b.numero_conta:''}</option>`).join('');
    select.value = valorActual;
  }catch(err){ alert(err.message); return; }
  renderConciliacao();
}

async function renderConciliacao(){
  const contaId = document.getElementById('conciliacao-conta').value;
  document.getElementById('conciliacao-sem-conta').style.display = contaId? 'none':'block';
  document.getElementById('conciliacao-com-conta').style.display = contaId? 'block':'none';
  if(!contaId) return;

  try{
    const rows = await apiFetch('/transacoes?contaBancariaId='+contaId+'&periodo=ano&naoConciliadas=1');
    const total = rows.reduce((s,t)=> s + (t.tipo==='receita'? Number(t.valor) : -Number(t.valor)), 0);
    document.getElementById('conciliacao-total-pendente').textContent = formatMZN(total);

    const tbody = document.querySelector('#table-conciliacao tbody');
    tbody.innerHTML = rows.map(t=>`
      <tr>
        <td><input type="checkbox" onchange="marcarConciliado('${t.id}', this.checked)"></td>
        <td>${formatDatePt(t.data)}</td>
        <td><span class="tag ${t.tipo==='receita'?'green':'red'}">${t.tipo==='receita'?'Receita':'Despesa'}</span></td>
        <td>${t.categoria}</td>
        <td>${t.descricao||'—'}</td>
        <td style="text-align:right;" class="${t.tipo==='receita'?'amount-pos':'amount-neg'}">${formatMZN(t.valor)}</td>
      </tr>`).join('');
    document.getElementById('empty-conciliacao').style.display = rows.length? 'none':'block';
  }catch(err){ alert(err.message); }
}

async function marcarConciliado(id, conciliado){
  try{
    await apiFetch('/transacoes/'+id+'/conciliar', { method:'PATCH', body: JSON.stringify({ conciliado }) });
    renderConciliacao();
  }catch(err){ alert(err.message); }
}

