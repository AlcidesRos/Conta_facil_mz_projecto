/* ContaFácil MZ — Módulo Produtos e Estoque
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   PRODUTOS
========================================================= */
function stockInfo(p){
  const totalUnidades = p.qtdEstoqueUnidades;
  const caixas = Math.floor(totalUnidades / p.qtdPorCaixa);
  const resto = totalUnidades % p.qtdPorCaixa;
  const isLow = caixas <= p.qtdMinima;
  return {totalUnidades, caixas, resto, isLow};
}

async function carregarProdutos(busca){
  const query = busca ? ('?busca=' + encodeURIComponent(busca)) : '';
  const rows = await apiFetch('/produtos' + query);
  state.products = rows.map(normalizeProduto);
}

async function renderProdutos(){
  try{
    await carregarProdutos(document.getElementById('produtos-search').value);
  }catch(err){ alert(err.message); return; }

  const tbody = document.querySelector('#table-produtos tbody');
  tbody.innerHTML = state.products.map(p=>{
    const s = stockInfo(p);
    return `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div class="client-avatar">${p.imagem? `<img src="${p.imagem}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`:'<i class="fa-solid fa-box"></i>'}</div>
        <div><b>${p.nome}</b><div style="font-size:12px;color:var(--slate-400);">${p.marca||'—'}</div></div>
      </div></td>
      <td>${p.categoria}</td>
      <td>${p.marca||'—'}</td>
      <td class="mono" style="font-size:12.5px;">${p.codigoInterno||'—'}</td>
      <td style="text-align:right;" class="mono">${formatMZN(p.precoVendaUnidade)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(p.precoVendaCaixa)}</td>
      <td style="text-align:right;">${s.caixas} cx ${s.resto? '+ '+s.resto+' un':''}</td>
      <td><span class="tag ${p.status==='Ativo'?'green':'red'}">${p.status}</span></td>
      <td class="row-actions" style="white-space:nowrap;">
        <button title="Editar" onclick="openProdutoModal('${p.id}')"><i class="fa-solid fa-pen"></i></button>
        <button title="Remover" onclick="deleteProduto('${p.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('empty-produtos').style.display = state.products.length? 'none':'block';
  updateStockAlerts();
}

function openProdutoModal(id){
  const isEdit = !!id;
  document.getElementById('produto-modal-title').textContent = isEdit? 'Editar Produto':'Novo Produto';
  document.getElementById('produto-id').value = id||'';

  const fornecedorSelect = document.getElementById('produto-fornecedor');
  fornecedorSelect.innerHTML = '<option value="">Nenhum / a definir</option>' +
    state.suppliers.map(f=>`<option value="${f.id}">${f.nome}${f.empresa? ' — '+f.empresa:''}</option>`).join('');

  const qtdEstoqueInput = document.getElementById('produto-qtd-estoque');

  if(isEdit){
    const p = state.products.find(x=>x.id===id);
    document.getElementById('produto-nome').value = p.nome;
    document.getElementById('produto-categoria').value = p.categoria;
    document.getElementById('produto-marca').value = p.marca||'';
    fornecedorSelect.value = p.fornecedorId||'';
    document.getElementById('produto-codigo-interno').value = p.codigoInterno||'';
    document.getElementById('produto-codigo-barras').value = p.codigoBarras||'';
    document.getElementById('produto-descricao').value = p.descricao||'';
    document.getElementById('produto-preco-compra').value = p.precoCompra;
    document.getElementById('produto-preco-venda-unidade').value = p.precoVendaUnidade;
    document.getElementById('produto-preco-venda-caixa').value = p.precoVendaCaixa;
    document.getElementById('produto-qtd-caixa').value = p.qtdPorCaixa;
    qtdEstoqueInput.value = p.qtdEstoqueUnidades;
    qtdEstoqueInput.disabled = true;
    qtdEstoqueInput.title = 'Para alterar o estoque, use o módulo Estoque (Entrada/Saída).';
    document.getElementById('produto-qtd-minima').value = p.qtdMinima;
    document.getElementById('produto-status').value = p.status;
    pendingProdutoImagemUrl = null;
    document.getElementById('produto-imagem-preview').innerHTML = p.imagem? `<img src="${p.imagem}">` : '<i class="fa-solid fa-image"></i>';
  } else {
    document.querySelector('#modal-produto form').reset();
    document.getElementById('produto-imagem-preview').innerHTML = '<i class="fa-solid fa-image"></i>';
    qtdEstoqueInput.disabled = false;
    qtdEstoqueInput.title = '';
    pendingProdutoImagemUrl = null;
  }
  openModal('modal-produto');
}

function handleProdutoImagem(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    pendingProdutoImagemUrl = ev.target.result;
    document.getElementById('produto-imagem-preview').innerHTML = `<img src="${pendingProdutoImagemUrl}">`;
  };
  reader.readAsDataURL(file);
}

async function handleSaveProduto(e){
  e.preventDefault();
  const id = document.getElementById('produto-id').value;
  const payload = {
    nome: document.getElementById('produto-nome').value.trim(),
    categoria: document.getElementById('produto-categoria').value.trim(),
    marca: document.getElementById('produto-marca').value.trim(),
    fornecedorId: document.getElementById('produto-fornecedor').value || null,
    codigoInterno: document.getElementById('produto-codigo-interno').value.trim(),
    codigoBarras: document.getElementById('produto-codigo-barras').value.trim(),
    descricao: document.getElementById('produto-descricao').value.trim(),
    precoCompra: parseFloat(document.getElementById('produto-preco-compra').value),
    precoVendaUnidade: parseFloat(document.getElementById('produto-preco-venda-unidade').value),
    precoVendaCaixa: parseFloat(document.getElementById('produto-preco-venda-caixa').value),
    qtdPorCaixa: parseInt(document.getElementById('produto-qtd-caixa').value),
    qtdMinimaCaixas: parseInt(document.getElementById('produto-qtd-minima').value),
    status: document.getElementById('produto-status').value,
    imagemUrl: pendingProdutoImagemUrl
  };
  if(!id) payload.qtdEstoqueUnidades = parseInt(document.getElementById('produto-qtd-estoque').value) || 0;

  try{
    if(id) await apiFetch('/produtos/'+id, { method:'PUT', body: JSON.stringify(payload) });
    else await apiFetch('/produtos', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-produto');
    renderProdutos();
  }catch(err){ alert(err.message); }
}

async function deleteProduto(id){
  if(!confirm('Tem a certeza que quer remover este produto?')) return;
  try{
    await apiFetch('/produtos/'+id, { method:'DELETE' });
    renderProdutos();
  }catch(err){ alert(err.message); }
}

/* =========================================================
   ESTOQUE
========================================================= */
async function carregarEstoqueMovimentacoes(){
  const rows = await apiFetch('/estoque/movimentacoes');
  state.stockMovements = rows.map(normalizeMovimento);
}

async function renderEstoque(){
  try{
    await carregarProdutos();
    await carregarEstoqueMovimentacoes();
  }catch(err){ alert(err.message); return; }

  const tbodyNiveis = document.querySelector('#table-estoque-niveis tbody');
  tbodyNiveis.innerHTML = state.products.map(p=>{
    const s = stockInfo(p);
    return `
    <tr>
      <td><b>${p.nome}</b></td>
      <td style="text-align:right;">${p.qtdPorCaixa}</td>
      <td style="text-align:right;">${s.caixas} cx ${s.resto? '+ '+s.resto+' un':''} <span style="color:var(--slate-400);font-size:12px;">(${s.totalUnidades} un.)</span></td>
      <td style="text-align:right;">${p.qtdMinima}</td>
      <td><span class="stock-badge ${s.isLow?'low':'ok'}"><i class="fa-solid ${s.isLow?'fa-triangle-exclamation':'fa-circle-check'}"></i> ${s.isLow?'Estoque baixo':'Normal'}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--slate-400);padding:30px;">Nenhum produto registado ainda.</td></tr>';

  const hist = [...state.stockMovements].sort((a,b)=> b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id)));
  const tbodyHist = document.querySelector('#table-estoque-historico tbody');
  tbodyHist.innerHTML = hist.map(m=>{
    const p = state.products.find(x=>x.id===m.productId);
    return `
    <tr>
      <td>${formatDatePt(m.data)}</td>
      <td class="mono">${m.hora||'—'}</td>
      <td>${p? p.nome : '—'}</td>
      <td><span class="tag ${m.tipo==='entrada'?'green':'red'}">${m.tipo==='entrada'?'Entrada':'Saída'}</span></td>
      <td style="text-align:right;" class="${m.tipo==='entrada'?'amount-pos':'amount-neg'}">${m.tipo==='entrada'?'+':'-'} ${m.quantidade} un.</td>
      <td>${m.motivo}</td>
      <td>${m.usuario}</td>
    </tr>`;
  }).join('');
  document.getElementById('empty-estoque-historico').style.display = hist.length? 'none':'block';

  updateStockAlerts();
}

function updateStockAlerts(){
  if(!state.user) return;
  const lowItems = state.products.filter(p => stockInfo(p).isLow);
  const navBadge = document.getElementById('nav-estoque-alert');
  navBadge.style.display = lowItems.length? 'inline-block':'none';
  navBadge.textContent = lowItems.length;

  const banner = document.getElementById('stock-alert-banner');
  if(banner){
    if(lowItems.length){
      banner.style.display = 'flex';
      banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
        <div><b>ATENÇÃO — Estoque a acabar</b>
        <div class="sab-list">${lowItems.map(p=>{
          const s = stockInfo(p);
          return `O produto <b>${p.nome}</b> está a acabar. Restam apenas ${s.caixas} caixa(s). Recomendamos repor o estoque.`;
        }).join('<br>')}</div></div>`;
    } else {
      banner.style.display = 'none';
    }
  }
  if(document.getElementById('notif-count')) renderNotifPanel();
}

function openMovimentoModal(){
  const select = document.getElementById('movimento-produto');
  select.innerHTML = state.products.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  updateMovimentoContext();
  document.getElementById('movimento-motivo').value = '';
  document.getElementById('movimento-quantidade').value = '';
  openModal('modal-movimento');
}

function updateMovimentoContext(){
  const id = document.getElementById('movimento-produto').value;
  const p = state.products.find(x=>x.id===id);
  const ctx = document.getElementById('movimento-contexto');
  if(p){
    const s = stockInfo(p);
    ctx.textContent = `1 caixa = ${p.qtdPorCaixa} unidades · Estoque actual: ${s.caixas} cx + ${s.resto} un. (${s.totalUnidades} unidades)`;
  } else {
    ctx.textContent = '';
  }
}

async function handleMovimentoEstoque(e){
  e.preventDefault();
  const payload = {
    produtoId: document.getElementById('movimento-produto').value,
    tipo: document.getElementById('movimento-tipo').value,
    quantidade: parseInt(document.getElementById('movimento-quantidade').value),
    unidade: document.getElementById('movimento-unidade').value,
    motivo: document.getElementById('movimento-motivo').value.trim()
  };
  try{
    await apiFetch('/estoque/movimentacoes', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-movimento');
    await renderEstoque();
    renderDashboard();
  }catch(err){ alert(err.message); }
}

