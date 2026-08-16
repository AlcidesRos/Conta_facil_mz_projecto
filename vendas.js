/* ContaFácil MZ — PDV (Ponto de Venda) e Pagamentos Móveis (M-Pesa/e-Mola)
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   VENDAS (PDV)
========================================================= */
function renderPdvProducts(){
  const q = (document.getElementById('pdv-search').value||'').toLowerCase();
  const grid = document.getElementById('pdv-product-grid');
  const items = state.products.filter(p => p.status==='Ativo' && (p.nome.toLowerCase().includes(q) || (p.codigoInterno||'').toLowerCase().includes(q)));
  grid.innerHTML = items.map(p=>{
    const s = stockInfo(p);
    const disabled = s.totalUnidades<=0;
    return `
    <button type="button" class="pdv-product-card" ${disabled?'style="opacity:.45;pointer-events:none;"':''} onclick="addToCart('${p.id}')">
      <div class="ppc-icon">${p.imagem? `<img src="${p.imagem}">`:'<i class="fa-solid fa-box"></i>'}</div>
      <div class="ppc-nome">${p.nome}</div>
      <div class="ppc-preco">${formatMZN(p.precoVendaUnidade)}</div>
      <div class="ppc-stock">${s.totalUnidades} un. em estoque</div>
    </button>`;
  }).join('') || '<p style="color:var(--slate-400);font-size:13.5px;grid-column:1/-1;text-align:center;padding:20px 0;">Nenhum produto encontrado.</p>';
}

function addToCart(productId){
  const p = state.products.find(x=>x.id===productId);
  const s = stockInfo(p);
  const item = pdvCart.find(i=>i.productId===productId);
  const qtdAtual = item? item.qtd : 0;
  if(qtdAtual+1 > s.totalUnidades){
    alert(`Estoque insuficiente de ${p.nome}. Restam apenas ${s.totalUnidades} unidades.`);
    return;
  }
  if(item) item.qtd += 1;
  else pdvCart.push({productId, qtd:1});
  renderPdvCart();
}

function changeCartQty(productId, delta){
  const item = pdvCart.find(i=>i.productId===productId);
  if(!item) return;
  const p = state.products.find(x=>x.id===productId);
  const s = stockInfo(p);
  const novaQtd = item.qtd + delta;
  if(novaQtd<=0){ pdvCart = pdvCart.filter(i=>i.productId!==productId); }
  else if(novaQtd > s.totalUnidades){ alert(`Estoque insuficiente de ${p.nome}.`); return; }
  else item.qtd = novaQtd;
  renderPdvCart();
}

function renderPdvCart(){
  const container = document.getElementById('pdv-cart-items');
  if(!pdvCart.length){
    container.innerHTML = '<p style="color:var(--slate-400);font-size:13.5px;text-align:center;padding:20px 0;">O carrinho está vazio.</p>';
  } else {
    container.innerHTML = pdvCart.map(i=>{
      const p = state.products.find(x=>x.id===i.productId);
      return `
      <div class="pdv-cart-item">
        <div><b style="font-size:13.5px;">${p.nome}</b><div style="font-size:12px;color:var(--slate-400);">${formatMZN(p.precoVendaUnidade)} / un.</div></div>
        <div class="pdv-qty-ctrl">
          <button type="button" onclick="changeCartQty('${p.id}',-1)"><i class="fa-solid fa-minus"></i></button>
          <span class="mono" style="min-width:20px;text-align:center;">${i.qtd}</span>
          <button type="button" onclick="changeCartQty('${p.id}',1)"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>`;
    }).join('');
  }
  const total = pdvCart.reduce((s,i)=>{ const p = state.products.find(x=>x.id===i.productId); return s + p.precoVendaUnidade*i.qtd; },0);
  document.getElementById('pdv-total').textContent = formatMZN(total);

  const clienteSel = document.getElementById('pdv-cliente');
  clienteSel.innerHTML = '<option value="">Cliente não identificado</option>' + state.clients.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
}

function selectPayMethod(el){
  document.querySelectorAll('.pay-method').forEach(m=>m.classList.remove('selected'));
  el.classList.add('selected');
  pdvPayMethod = el.dataset.metodo;

  const ehMovel = pdvPayMethod==='M-Pesa' || pdvPayMethod==='e-Mola';
  document.getElementById('pdv-mobile-phone-field').style.display = ehMovel? 'block':'none';
  if(ehMovel){
    const chave = pdvPayMethod==='M-Pesa' ? 'mpesa' : 'emola';
    const configurado = state.pagamentosEstado && state.pagamentosEstado[chave] && state.pagamentosEstado[chave].configurado;
    const noteEl = document.getElementById('pdv-mobile-sim-note');
    noteEl.textContent = configurado
      ? `Ligado à ${pdvPayMethod} real — vai ser enviado um pedido de confirmação para o telemóvel do cliente.`
      : `Modo de simulação — sem credenciais reais configuradas no backend, este pagamento ${pdvPayMethod} é aceite automaticamente.`;
    noteEl.style.color = configurado? 'var(--green-600)' : 'var(--warn)';
  }
}

async function carregarPagamentosEstado(){
  try{ state.pagamentosEstado = await apiFetch('/pagamentos/estado'); }
  catch(err){ state.pagamentosEstado = null; }
}

async function finalizarVenda(){
  if(!pdvCart.length){ alert('Adicione pelo menos um produto ao carrinho.'); return; }
  const clienteId = document.getElementById('pdv-cliente').value || null;
  const cliente = clienteId? state.clients.find(c=>c.id===clienteId) : null;
  const total = pdvCart.reduce((s,i)=>{ const p = state.products.find(x=>x.id===i.productId); return s + p.precoVendaUnidade*i.qtd; },0);

  const ehMovel = pdvPayMethod==='M-Pesa' || pdvPayMethod==='e-Mola';
  const telefone = document.getElementById('pdv-mobile-phone').value.trim();
  if(ehMovel && !telefone){
    alert(`Indique o número de telemóvel do cliente para enviar o pedido de pagamento ${pdvPayMethod}.`);
    return;
  }

  const btn = document.getElementById('pdv-finalizar-btn');
  const original = btn.innerHTML;

  if(ehMovel){
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> A pedir confirmação ao cliente via ${pdvPayMethod}...`;
    try{
      const rotaPagamento = pdvPayMethod==='M-Pesa' ? '/pagamentos/mpesa/c2b' : '/pagamentos/emola/c2b';
      const respostaPagamento = await apiFetch(rotaPagamento, { method:'POST', body: JSON.stringify({ telefone, valor: total }) });
      if(!respostaPagamento.sucesso){
        alert(`O pagamento ${pdvPayMethod} não foi confirmado. A venda não foi registada.`);
        btn.disabled = false; btn.innerHTML = original;
        return;
      }
    }catch(err){
      alert(`Falha no pedido de pagamento ${pdvPayMethod}: ${err.message}`);
      btn.disabled = false; btn.innerHTML = original;
      return;
    }
  }

  const payload = {
    clienteId, formaPagamento: pdvPayMethod,
    itens: pdvCart.map(i=>({ produtoId: i.productId, quantidade: i.qtd }))
  };

  try{
    const resultado = await apiFetch('/vendas', { method:'POST', body: JSON.stringify(payload) });

    const itensParaRecibo = resultado.itens.map(it=>{
      const p = state.products.find(x=>x.id===it.produtoId);
      return { nome: p?p.nome:'Produto', qtd: it.quantidade, precoUnit: Number(it.precoUnitario), subtotal: Number(it.subtotal) };
    });
    const venda = {
      numero: resultado.numero, data: resultado.data, hora: (resultado.hora||'').slice(0,5),
      clienteNome: cliente? cliente.nome : 'Cliente não identificado',
      pagamento: resultado.forma_pagamento, itens: itensParaRecibo,
      total: Number(resultado.total), lucro: Number(resultado.lucro)
    };

    mostrarRecibo(venda);
    pdvCart = [];
    document.getElementById('pdv-mobile-phone').value = '';
    document.getElementById('pdv-mobile-phone-field').style.display = 'none';
    document.querySelectorAll('.pay-method').forEach(m=>m.classList.remove('selected'));
    document.querySelector('.pay-method[data-metodo="Dinheiro"]').classList.add('selected');
    pdvPayMethod = 'Dinheiro';
    await renderVendas();
    await renderProdutos();
    await renderEstoque();
    renderDashboard();
  }catch(err){
    alert(err.message);
  }finally{
    btn.disabled = false; btn.innerHTML = original;
  }
}

function mostrarRecibo(venda){
  const linhas = venda.itens.map(i=>`<div class="r-line"><span>${i.qtd}x ${i.nome}</span><span>${formatMZN(i.subtotal)}</span></div>`).join('');
  document.getElementById('recibo-conteudo').innerHTML = `
    <div style="text-align:center;margin-bottom:10px;"><b>${state.user.businessName}</b><br><span style="font-size:11px;">${state.user.address||''} ${state.user.city? '· '+state.user.city:''}</span></div>
    <hr>
    <div class="r-line"><span>Recibo</span><span>${venda.numero}</span></div>
    <div class="r-line"><span>Data</span><span>${formatDatePt(venda.data)} ${venda.hora}</span></div>
    <div class="r-line"><span>Cliente</span><span>${venda.clienteNome}</span></div>
    <hr>
    ${linhas}
    <hr>
    <div class="r-line" style="font-weight:700;"><span>TOTAL</span><span>${formatMZN(venda.total)}</span></div>
    <div class="r-line"><span>Pagamento</span><span>${venda.pagamento}</span></div>
    <hr>
    <div style="text-align:center;font-size:11px;color:var(--slate-400);">Obrigado pela preferência!</div>
  `;
  openModal('modal-recibo');
}

function verReciboVenda(id){
  const v = state.sales.find(x=>x.id===id);
  if(!v) return;
  const itensAdaptados = v.itens.map(it=>({ nome: it.produtoNome, qtd: Number(it.quantidade), precoUnit: Number(it.precoUnitario), subtotal: Number(it.subtotal) }));
  mostrarRecibo({ ...v, itens: itensAdaptados });
}

async function carregarVendas(){
  const rows = await apiFetch('/vendas');
  state.sales = rows.map(r=>({
    id:r.id, numero:r.numero, data:r.data, clienteNome:r.cliente_nome||'Cliente não identificado',
    pagamento:r.forma_pagamento, total:Number(r.total), lucro:Number(r.lucro), itens:r.itens
  }));
}

async function renderVendas(){
  renderPdvProducts();
  renderPdvCart();
  try{ await carregarVendas(); }catch(err){ alert(err.message); return; }

  const tbody = document.querySelector('#table-vendas tbody');
  const vendasOrdenadas = [...state.sales].sort((a,b)=> b.data.localeCompare(a.data));
  tbody.innerHTML = vendasOrdenadas.map(v=>`
    <tr>
      <td class="mono">${v.numero}</td>
      <td>${formatDatePt(v.data)}</td>
      <td>${v.clienteNome}</td>
      <td><span class="tag blue">${v.pagamento}</span></td>
      <td style="text-align:right;" class="mono">${formatMZN(v.total)}</td>
      <td style="text-align:right;" class="amount-pos">${formatMZN(v.lucro)}</td>
      <td class="row-actions"><button title="Ver recibo" onclick="verReciboVenda('${v.id}')"><i class="fa-solid fa-receipt"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-vendas').style.display = state.sales.length? 'none':'block';
}

async function renderPagamentosMoveis(){
  await carregarPagamentosEstado();
  const badgesEl = document.getElementById('pagamentos-status-badges');
  const badge = (nome, configurado) => `
    <span class="tag ${configurado?'green':'blue'}" style="font-size:12.5px;padding:8px 14px;">
      <i class="fa-solid ${configurado?'fa-circle-check':'fa-flask'}"></i> ${nome}: ${configurado? 'Ligado (produção)' : 'Modo de simulação'}
    </span>`;
  badgesEl.innerHTML = badge('M-Pesa', state.pagamentosEstado && state.pagamentosEstado.mpesa.configurado) +
                        badge('e-Mola', state.pagamentosEstado && state.pagamentosEstado.emola.configurado);

  let rows;
  try{ rows = await apiFetch('/pagamentos'); }
  catch(err){ alert(err.message); return; }

  state.mobilePayments = rows;
  const tbody = document.querySelector('#table-pagamentos-moveis tbody');
  tbody.innerHTML = rows.map(p=>`
    <tr>
      <td>${formatDatePt(p.criado_em)}</td>
      <td><span class="tag blue">${p.provedor==='mpesa'?'M-Pesa':'e-Mola'}</span></td>
      <td>${p.telefone_cliente}</td>
      <td style="text-align:right;" class="mono">${formatMZN(p.valor)}</td>
      <td class="mono" style="font-size:12px;">${p.referencia_transacao||'—'}</td>
      <td><span class="tag ${p.estado==='concluido'?'green':(p.estado==='falhado'?'red':'blue')}">${p.estado==='concluido'?'Concluído':(p.estado==='falhado'?'Falhado':'Pendente')}</span></td>
      <td>${p.modo_simulacao? '<span style="color:var(--warn);font-size:12px;">Simulação</span>' : '<span style="color:var(--green-600);font-size:12px;">Real</span>'}</td>
    </tr>`).join('');
  document.getElementById('empty-pagamentos-moveis').style.display = rows.length? 'none':'block';
}

