/* ContaFácil MZ — Módulo Clientes
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   CLIENTES
========================================================= */
async function carregarClientes(){
  const rows = await apiFetch('/clientes');
  state.clients = rows.map(normalizeCliente);
}

async function renderClientes(){
  try{ await carregarClientes(); }catch(err){ alert(err.message); return; }

  const totalDivida = state.clients.reduce((s,c)=>s+c.saldoDevedor,0);
  document.getElementById('clientes-divida-total').textContent = formatMZN(totalDivida);
  const tbody = document.querySelector('#table-clientes tbody');
  tbody.innerHTML = state.clients.map(c=>{
    const iniciais = c.nome.trim().split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    return `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px;"><div class="client-avatar">${iniciais}</div><b>${c.nome}</b></div></td>
      <td>${c.telefone}</td>
      <td style="text-align:right;" class="${c.saldoDevedor>0?'amount-neg':'amount-pos'}">${formatMZN(c.saldoDevedor)}</td>
      <td class="row-actions" style="white-space:nowrap;">
        <button title="Registar pagamento" onclick="abrirPagamento('${c.id}')"><i class="fa-solid fa-hand-holding-dollar"></i></button>
        <button title="Histórico" onclick="verHistorico('${c.id}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
        <button title="Remover" onclick="deleteCliente('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('empty-clientes').style.display = state.clients.length? 'none':'block';
}

function openFornecedorModal(){ document.querySelector('#modal-fornecedor form').reset(); openModal('modal-fornecedor'); }

async function handleAddCliente(e){
  e.preventDefault();
  const payload = {
    nome: document.getElementById('cliente-nome').value.trim(),
    telefone: document.getElementById('cliente-telefone').value.trim(),
    nif: document.getElementById('cliente-nif').value.trim(),
    saldoDevedor: parseFloat(document.getElementById('cliente-saldo').value || 0)
  };
  try{
    await apiFetch('/clientes', { method:'POST', body: JSON.stringify(payload) });
    e.target.reset();
    closeModal('modal-cliente');
    renderClientes();
  }catch(err){ alert(err.message); }
}

async function deleteCliente(id){
  if(!confirm('Tem a certeza que quer remover este cliente?')) return;
  try{
    await apiFetch('/clientes/'+id, { method:'DELETE' });
    renderClientes();
  }catch(err){ alert(err.message); }
}

function abrirPagamento(clienteId){
  const c = state.clients.find(x=>x.id===clienteId);
  document.getElementById('pagamento-cliente-id').value = clienteId;
  document.getElementById('pagamento-cliente-nome').textContent = c.nome;
  document.getElementById('pagamento-cliente-saldo-atual').textContent = formatMZN(c.saldoDevedor);
  document.getElementById('pagamento-valor').max = c.saldoDevedor>0 ? c.saldoDevedor : '';
  openModal('modal-pagamento');
}

async function handleRegistarPagamento(e){
  e.preventDefault();
  const id = document.getElementById('pagamento-cliente-id').value;
  const payload = {
    valor: parseFloat(document.getElementById('pagamento-valor').value),
    data: document.getElementById('pagamento-data').value
  };
  try{
    await apiFetch('/clientes/'+id+'/pagamentos', { method:'POST', body: JSON.stringify(payload) });
    e.target.reset();
    closeModal('modal-pagamento');
    await renderClientes();
    renderDashboard();
  }catch(err){ alert(err.message); }
}

async function verHistorico(clienteId){
  const c = state.clients.find(x=>x.id===clienteId);
  document.getElementById('historico-cliente-nome').textContent = c.nome;
  document.getElementById('historico-cliente-saldo').textContent = formatMZN(c.saldoDevedor);
  try{
    const rows = await apiFetch('/clientes/'+clienteId+'/pagamentos');
    const hist = rows.map(r=>({data:r.data, valor:Number(r.valor)})).sort((a,b)=>b.data.localeCompare(a.data));
    const tbody = document.querySelector('#table-historico tbody');
    tbody.innerHTML = hist.map(h=>`<tr><td>${formatDatePt(h.data)}</td><td style="text-align:right;" class="amount-pos">${formatMZN(h.valor)}</td></tr>`).join('');
    document.getElementById('empty-historico').style.display = hist.length? 'none':'block';
    openModal('modal-historico');
  }catch(err){ alert(err.message); }
}

