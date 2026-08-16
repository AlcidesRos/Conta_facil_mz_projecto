/* ContaFácil MZ — Módulo Fornecedores e Compras
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   FORNECEDORES
========================================================= */
async function carregarFornecedores(){
  const rows = await apiFetch('/fornecedores');
  state.suppliers = rows.map(normalizeFornecedor);
}

async function renderFornecedores(){
  try{ await carregarFornecedores(); }catch(err){ alert(err.message); return; }

  const tbody = document.querySelector('#table-fornecedores tbody');
  tbody.innerHTML = state.suppliers.map(f=>`
    <tr>
      <td><b>${f.nome}</b></td>
      <td>${f.empresa||'—'}</td>
      <td>${f.telefone}</td>
      <td>${f.email||'—'}</td>
      <td>${f.cidade||'—'}</td>
      <td>${f.produtos||'—'}</td>
      <td class="row-actions"><button title="Remover" onclick="deleteFornecedor('${f.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-fornecedores').style.display = state.suppliers.length? 'none':'block';
}

async function handleAddFornecedor(e){
  e.preventDefault();
  const payload = {
    nome: document.getElementById('fornecedor-nome').value.trim(),
    empresa: document.getElementById('fornecedor-empresa').value.trim(),
    telefone: document.getElementById('fornecedor-telefone').value.trim(),
    email: document.getElementById('fornecedor-email').value.trim(),
    cidade: document.getElementById('fornecedor-cidade').value.trim(),
    produtosFornecidos: document.getElementById('fornecedor-produtos').value.trim()
  };
  try{
    await apiFetch('/fornecedores', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-fornecedor');
    renderFornecedores();
  }catch(err){ alert(err.message); }
}

async function deleteFornecedor(id){
  if(!confirm('Tem a certeza que quer remover este fornecedor?')) return;
  try{
    await apiFetch('/fornecedores/'+id, { method:'DELETE' });
    renderFornecedores();
  }catch(err){ alert(err.message); }
}

/* =========================================================
   COMPRAS
========================================================= */
async function carregarCompras(){
  const rows = await apiFetch('/compras');
  state.purchases = rows.map(r=>({
    id:r.id, fornecedorNome:r.fornecedor_nome||'—', total:Number(r.total), data:r.data,
    itens: (r.itens||[]).map(it=>({ produtoNome:it.produtoNome, quantidade:Number(it.quantidade), custoUnitario:Number(it.custoUnitario), subtotal:Number(it.subtotal) }))
  }));
}

async function renderCompras(){
  try{ await carregarCompras(); }catch(err){ alert(err.message); return; }

  const inicioMes = todayISO().slice(0,7);
  const totalMes = state.purchases.filter(c=>c.data.startsWith(inicioMes)).reduce((s,c)=>s+c.total,0);
  document.getElementById('compras-total-mes').textContent = formatMZN(totalMes);

  const tbody = document.querySelector('#table-compras tbody');
  const linhas = [];
  [...state.purchases].sort((a,b)=>b.data.localeCompare(a.data)).forEach(c=>{
    c.itens.forEach(it=>{
      linhas.push(`
      <tr>
        <td>${formatDatePt(c.data)}</td>
        <td>${c.fornecedorNome}</td>
        <td>${it.produtoNome}</td>
        <td style="text-align:right;">${it.quantidade}</td>
        <td style="text-align:right;" class="mono">${formatMZN(it.custoUnitario)}</td>
        <td style="text-align:right;" class="amount-neg">${formatMZN(it.subtotal)}</td>
      </tr>`);
    });
  });
  tbody.innerHTML = linhas.join('');
  document.getElementById('empty-compras').style.display = state.purchases.length? 'none':'block';
}

function openCompraModal(){
  document.querySelector('#modal-compra form').reset();
  document.getElementById('compra-fornecedor').innerHTML = state.suppliers.map(f=>`<option value="${f.id}">${f.nome}${f.empresa? ' — '+f.empresa:''}</option>`).join('');
  document.getElementById('compra-produto').innerHTML = state.products.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  document.getElementById('compra-data').value = todayISO();
  updateCompraContext();
  openModal('modal-compra');
}

function updateCompraContext(){
  const id = document.getElementById('compra-produto').value;
  const p = state.products.find(x=>x.id===id);
  document.getElementById('compra-contexto').textContent = p? `Custo de compra actual: ${formatMZN(p.precoCompra)} · Estoque actual: ${p.qtdEstoqueUnidades} unidades` : '';
}

async function handleAddCompra(e){
  e.preventDefault();
  const payload = {
    fornecedorId: document.getElementById('compra-fornecedor').value,
    data: document.getElementById('compra-data').value,
    itens: [{
      produtoId: document.getElementById('compra-produto').value,
      quantidade: parseInt(document.getElementById('compra-quantidade').value),
      custoUnitario: parseFloat(document.getElementById('compra-custo-unitario').value)
    }]
  };
  try{
    await apiFetch('/compras', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-compra');
    await renderCompras();
    await renderProdutos();
    renderDashboard();
  }catch(err){ alert(err.message); }
}

