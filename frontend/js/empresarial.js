/* ContaFácil MZ — Módulo Empresarial: DRE, IVA, Contas a Pagar/Receber, Folha de Salários, Imobilizado, Orçamento, Calendário Fiscal
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   MÓDULO EMPRESARIAL — DRE
========================================================= */
const PCAMC_MAP = {
  'Vendas':               {codigo:'71100', rubrica:'Vendas de mercadorias'},
  'Serviços':              {codigo:'71200', rubrica:'Prestação de serviços'},
  'Recebimento de Cliente':{codigo:'72000', rubrica:'Proveitos suplementares'},
  'Outras Receitas':       {codigo:'73000', rubrica:'Outros proveitos operacionais'},
  'Fornecedores':          {codigo:'61100', rubrica:'Custo de mercadorias vendidas'},
  'Renda/Aluguer':         {codigo:'62000', rubrica:'Fornecimentos e serviços ext.'},
  'Transporte':            {codigo:'62000', rubrica:'Fornecimentos e serviços ext.'},
  'Energia/Água':          {codigo:'62000', rubrica:'Fornecimentos e serviços ext.'},
  'Salários':              {codigo:'64000', rubrica:'Custos com pessoal (salários)'},
  'Outras Despesas':       {codigo:'69000', rubrica:'Outros custos operacionais'}
};
const DRE_LINHAS_RECEITA = ['Vendas de mercadorias','Prestação de serviços','Proveitos suplementares','Outros proveitos operacionais'];
const DRE_LINHAS_DESPESA = ['Custo de mercadorias vendidas','Fornecimentos e serviços ext.','Custos com pessoal (salários)','Outros custos operacionais'];

async function renderDRE(){
  const anoInput = document.getElementById('dre-ano');
  if(!anoInput.value) anoInput.value = new Date().getFullYear();
  const ano = parseInt(anoInput.value);

  let rows;
  try{ rows = await apiFetch('/dashboard/dre?ano='+ano); }
  catch(err){ alert(err.message); return; }

  // matriz[rubrica][mes 1-12] = total
  const matriz = {};
  [...DRE_LINHAS_RECEITA, ...DRE_LINHAS_DESPESA].forEach(r=> matriz[r] = Array(12).fill(0));
  rows.forEach(r=>{
    const mapa = PCAMC_MAP[r.categoria];
    if(!mapa) return;
    const mes = parseInt(r.mes) - 1;
    matriz[mapa.rubrica][mes] += Number(r.total);
  });

  function linhaHtml(nome, valores, destaque){
    const total = valores.reduce((s,v)=>s+v,0);
    return `<tr ${destaque?'style="font-weight:800;background:var(--bg);"':''}>
      <td>${nome}</td>${valores.map(v=>`<td style="text-align:right;">${v? formatMZN(v).replace(' MT',''):'-'}</td>`).join('')}
      <td style="text-align:right;" class="mono">${formatMZN(total)}</td></tr>`;
  }

  let totalProveitosMes = Array(12).fill(0), totalCustosMes = Array(12).fill(0);
  let html = `<tr style="background:var(--blue-100);"><td colspan="14"><b>I. PROVEITOS E GANHOS</b></td></tr>`;
  DRE_LINHAS_RECEITA.forEach(r=>{ html += linhaHtml(r, matriz[r]); matriz[r].forEach((v,i)=>totalProveitosMes[i]+=v); });
  html += linhaHtml('TOTAL PROVEITOS', totalProveitosMes, true);
  html += `<tr style="background:var(--danger-bg);"><td colspan="14"><b>II. CUSTOS E PERDAS OPERACIONAIS</b></td></tr>`;
  DRE_LINHAS_DESPESA.forEach(r=>{ html += linhaHtml(r, matriz[r]); matriz[r].forEach((v,i)=>totalCustosMes[i]+=v); });
  html += linhaHtml('TOTAL CUSTOS OPERACIONAIS', totalCustosMes, true);
  const resultadoMes = totalProveitosMes.map((v,i)=> v - totalCustosMes[i]);
  html += linhaHtml('RESULTADO LÍQUIDO', resultadoMes, true);
  document.querySelector('#table-dre tbody').innerHTML = html;

  const totalProveitos = totalProveitosMes.reduce((s,v)=>s+v,0);
  const totalCustos = totalCustosMes.reduce((s,v)=>s+v,0);
  const resultadoLiquido = totalProveitos - totalCustos;
  const taxaIrpc = state.user.taxaIrpc!=null? state.user.taxaIrpc : 0.32;
  const irpcEstimado = resultadoLiquido > 0 ? resultadoLiquido * taxaIrpc : 0;

  document.getElementById('dre-total-proveitos').textContent = formatMZN(totalProveitos);
  document.getElementById('dre-total-custos').textContent = formatMZN(totalCustos);
  document.getElementById('dre-resultado-liquido').textContent = formatMZN(resultadoLiquido);
  document.getElementById('dre-resultado-liquido').style.color = resultadoLiquido>=0? 'var(--green-600)':'var(--danger)';
  document.getElementById('dre-irpc-estimado').textContent = formatMZN(irpcEstimado);
}

/* =========================================================
   MÓDULO EMPRESARIAL — IVA
========================================================= */
function setIvaPeriod(p){
  state.ivaPeriod = p;
  document.querySelectorAll('#iva-period-filter button').forEach(b=>b.classList.toggle('active', b.dataset.period===p));
  renderIva();
}

async function renderIva(){
  let data;
  try{ data = await apiFetch('/iva?periodo='+state.ivaPeriod); }
  catch(err){ alert(err.message); return; }

  document.getElementById('iva-liquidado').textContent = formatMZN(data.ivaLiquidado);
  document.getElementById('iva-dedutivel').textContent = formatMZN(data.ivaDedutivel);
  document.getElementById('iva-saldo').textContent = formatMZN(data.ivaAPagarOuRecuperar);
  document.getElementById('iva-saldo').style.color = data.ivaAPagarOuRecuperar>=0? 'var(--danger)':'var(--green-600)';

  const tbody = document.querySelector('#table-iva tbody');
  tbody.innerHTML = data.lancamentos.map(l=>`
    <tr>
      <td>${formatDatePt(l.data)}</td>
      <td><span class="tag ${l.tipo==='liquidado'?'green':'blue'}">${l.tipo==='liquidado'?'Liquidado':'Dedutível'}</span></td>
      <td>${l.descricao||'—'}</td>
      <td style="text-align:right;" class="mono">${formatMZN(l.base_tributavel)}</td>
      <td style="text-align:right;">${(Number(l.taxa_iva)*100).toFixed(0)}%</td>
      <td style="text-align:right;" class="mono">${formatMZN(l.valor_iva)}</td>
      <td>${l.numero_fatura||'—'}</td>
      <td class="row-actions"><button onclick="deleteIvaEntry('${l.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-iva').style.display = data.lancamentos.length? 'none':'block';
}

function openIvaModal(){
  document.querySelector('#modal-iva-lancamento form').reset();
  document.getElementById('iva-taxa').value = (state.user.taxaIva!=null? state.user.taxaIva*100 : 16);
  openModal('modal-iva-lancamento');
}

async function handleAddIva(e){
  e.preventDefault();
  const payload = {
    tipo: document.getElementById('iva-tipo').value,
    descricao: document.getElementById('iva-descricao').value.trim(),
    baseTributavel: parseFloat(document.getElementById('iva-base').value),
    taxaIva: (parseFloat(document.getElementById('iva-taxa').value)||0)/100,
    numeroFatura: document.getElementById('iva-numero-fatura').value.trim(),
    data: document.getElementById('iva-data').value
  };
  try{
    await apiFetch('/iva', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-iva-lancamento');
    renderIva();
  }catch(err){ alert(err.message); }
}

async function deleteIvaEntry(id){
  try{ await apiFetch('/iva/'+id, { method:'DELETE' }); renderIva(); }
  catch(err){ alert(err.message); }
}

/* =========================================================
   MÓDULO EMPRESARIAL — CONTAS A PAGAR / RECEBER
========================================================= */
async function renderContasPagar(){
  let rows;
  try{ rows = await apiFetch('/contas-pagar'); }
  catch(err){ alert(err.message); return; }

  state.payables = rows;
  const totalPendente = rows.filter(c=>c.estado!=='Pago').reduce((s,c)=>s+Number(c.valor),0);
  document.getElementById('contaspagar-total').textContent = formatMZN(totalPendente);

  const tbody = document.querySelector('#table-contaspagar tbody');
  tbody.innerHTML = rows.map(c=>`
    <tr>
      <td>${c.fornecedor_nome||'—'}</td>
      <td>${c.descricao||'—'}</td>
      <td style="text-align:right;" class="mono">${formatMZN(c.valor)}</td>
      <td>${c.data_emissao? formatDatePt(c.data_emissao):'—'}</td>
      <td>${c.data_vencimento? formatDatePt(c.data_vencimento):'—'}</td>
      <td><span class="tag ${c.estado==='Pago'?'green':(c.estado==='Vencido'?'red':'blue')}">${c.estado}</span></td>
      <td class="row-actions" style="white-space:nowrap;">
        ${c.estado!=='Pago'? `<button title="Marcar como paga" onclick="pagarContaPagar('${c.id}')"><i class="fa-solid fa-check"></i></button>`:''}
        <button title="Remover" onclick="deleteContaPagar('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
  document.getElementById('empty-contaspagar').style.display = rows.length? 'none':'block';
}

function openContaPagarModal(){
  document.querySelector('#modal-conta-pagar form').reset();
  document.getElementById('cp-fornecedor').innerHTML = '<option value="">— (opcional)</option>' + state.suppliers.map(f=>`<option value="${f.id}">${f.nome}</option>`).join('');
  openModal('modal-conta-pagar');
}

async function handleAddContaPagar(e){
  e.preventDefault();
  const payload = {
    fornecedorId: document.getElementById('cp-fornecedor').value || null,
    descricao: document.getElementById('cp-descricao').value.trim(),
    valor: parseFloat(document.getElementById('cp-valor').value),
    dataEmissao: document.getElementById('cp-data-emissao').value || null,
    dataVencimento: document.getElementById('cp-data-vencimento').value || null
  };
  try{
    await apiFetch('/contas-pagar', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-conta-pagar');
    renderContasPagar();
  }catch(err){ alert(err.message); }
}

async function pagarContaPagar(id){
  if(!confirm('Marcar esta conta como paga? Isto lança automaticamente uma despesa em Fornecedores.')) return;
  try{
    await apiFetch('/contas-pagar/'+id+'/pagar', { method:'PATCH' });
    await renderContasPagar();
    renderDashboard();
  }catch(err){ alert(err.message); }
}

async function deleteContaPagar(id){
  try{ await apiFetch('/contas-pagar/'+id, { method:'DELETE' }); renderContasPagar(); }
  catch(err){ alert(err.message); }
}

async function renderContasReceber(){
  try{ await carregarClientes(); }catch(err){ alert(err.message); return; }
  const comDivida = state.clients.filter(c=>c.saldoDevedor>0).sort((a,b)=>b.saldoDevedor-a.saldoDevedor);
  const total = comDivida.reduce((s,c)=>s+c.saldoDevedor,0);
  document.getElementById('contasreceber-total').textContent = formatMZN(total);
  const tbody = document.querySelector('#table-contasreceber tbody');
  tbody.innerHTML = comDivida.map(c=>`
    <tr><td><b>${c.nome}</b></td><td>${c.telefone}</td><td>${c.nif||'—'}</td>
    <td style="text-align:right;" class="amount-neg">${formatMZN(c.saldoDevedor)}</td></tr>`).join('');
  document.getElementById('empty-contasreceber').style.display = comDivida.length? 'none':'block';
}

/* =========================================================
   MÓDULO EMPRESARIAL — FOLHA DE SALÁRIOS (INSS + IRPS)
========================================================= */
function calcularIrpsLocal(baseIrps, escaloes){
  if(!escaloes.length) return {irps:0, semEscalao:true};
  const e = escaloes.find(x =>
    baseIrps >= Number(x.limite_inferior) && (x.limite_superior===null || baseIrps <= Number(x.limite_superior))
  );
  if(!e) return {irps:0, semEscalao:true};
  const irps = Math.max(0, baseIrps*Number(e.taxa) - Number(e.parcela_abater));
  return {irps, semEscalao:false};
}

async function renderFolhaSalarios(){
  try{
    await carregarFuncionarios();
    state.irpsEscaloes = await apiFetch('/irps/escaloes');
  }catch(err){ alert(err.message); return; }

  const aviso = document.getElementById('folha-salarios-aviso');
  aviso.style.display = state.irpsEscaloes.length? 'none':'block';
  aviso.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Ainda não configurou os escalões de IRPS — o IRPS está a ser calculado como 0,00 MT. Clique em "Configurar Escalões de IRPS" acima.';

  const ativos = state.employees.filter(f=>f.status==='Ativo');
  let totais = {bruto:0, inssTrab:0, irps:0, descontos:0, liquido:0, inssPatronal:0};

  const linhas = ativos.map(f=>{
    const bruto = f.salario;
    const inssTrab = Math.round(bruto*0.03*100)/100;
    const baseIrps = Math.round((bruto-inssTrab)*100)/100;
    const {irps} = calcularIrpsLocal(baseIrps, state.irpsEscaloes);
    const irpsArred = Math.round(irps*100)/100;
    const totalDescontos = Math.round((inssTrab+irpsArred)*100)/100;
    const liquido = Math.round((bruto-totalDescontos)*100)/100;
    const inssPatronal = Math.round(bruto*0.04*100)/100;

    totais.bruto+=bruto; totais.inssTrab+=inssTrab; totais.irps+=irpsArred;
    totais.descontos+=totalDescontos; totais.liquido+=liquido; totais.inssPatronal+=inssPatronal;

    return `<tr>
      <td><b>${f.nome}</b></td><td>${f.cargo}</td>
      <td style="text-align:right;" class="mono">${formatMZN(bruto)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(inssTrab)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(baseIrps)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(irpsArred)}</td>
      <td style="text-align:right;" class="amount-neg">${formatMZN(totalDescontos)}</td>
      <td style="text-align:right;" class="amount-pos">${formatMZN(liquido)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(inssPatronal)}</td>
    </tr>`;
  }).join('');

  document.querySelector('#table-folha-salarios tbody').innerHTML = linhas;
  document.querySelector('#table-folha-salarios tfoot').innerHTML = ativos.length? `
    <tr style="font-weight:800;background:var(--bg);">
      <td colspan="2">TOTAIS</td>
      <td style="text-align:right;">${formatMZN(totais.bruto)}</td>
      <td style="text-align:right;">${formatMZN(totais.inssTrab)}</td>
      <td></td>
      <td style="text-align:right;">${formatMZN(totais.irps)}</td>
      <td style="text-align:right;">${formatMZN(totais.descontos)}</td>
      <td style="text-align:right;">${formatMZN(totais.liquido)}</td>
      <td style="text-align:right;">${formatMZN(totais.inssPatronal)}</td>
    </tr>` : '';
  document.getElementById('empty-folha-salarios').style.display = ativos.length? 'none':'block';
}

function openIrpsModal(){
  const tbody = document.querySelector('#table-irps-escaloes tbody');
  tbody.innerHTML = state.irpsEscaloes.map(e=>irpsEscalaoRowHtml(e)).join('');
  if(!state.irpsEscaloes.length) addIrpsEscalaoRow();
  openModal('modal-irps');
}

function irpsEscalaoRowHtml(e){
  e = e || {limite_inferior:0, limite_superior:'', taxa:0, parcela_abater:0};
  return `<tr>
    <td><input type="number" step="0.01" class="irps-limite-inferior" value="${e.limite_inferior||0}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;"></td>
    <td><input type="number" step="0.01" class="irps-limite-superior" value="${e.limite_superior!=null?e.limite_superior:''}" placeholder="sem limite" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;"></td>
    <td><input type="number" step="0.01" class="irps-taxa" value="${e.taxa? e.taxa*100 : 0}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;"></td>
    <td><input type="number" step="0.01" class="irps-parcela" value="${e.parcela_abater||0}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;"></td>
    <td><button type="button" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></button></td>
  </tr>`;
}

function addIrpsEscalaoRow(){
  document.querySelector('#table-irps-escaloes tbody').insertAdjacentHTML('beforeend', irpsEscalaoRowHtml());
}

async function handleSaveIrpsEscaloes(){
  const linhas = [...document.querySelectorAll('#table-irps-escaloes tbody tr')].map(tr=>({
    limiteInferior: parseFloat(tr.querySelector('.irps-limite-inferior').value) || 0,
    limiteSuperior: tr.querySelector('.irps-limite-superior').value === '' ? null : parseFloat(tr.querySelector('.irps-limite-superior').value),
    taxa: (parseFloat(tr.querySelector('.irps-taxa').value) || 0) / 100,
    parcelaAbater: parseFloat(tr.querySelector('.irps-parcela').value) || 0
  })).sort((a,b)=>a.limiteInferior-b.limiteInferior);

  try{
    state.irpsEscaloes = await apiFetch('/irps/escaloes', { method:'PUT', body: JSON.stringify({ escaloes: linhas }) });
    closeModal('modal-irps');
    renderFolhaSalarios();
  }catch(err){ alert(err.message); }
}

/* =========================================================
   MÓDULO EMPRESARIAL — IMOBILIZADO
========================================================= */
async function renderImobilizado(){
  let rows;
  try{ rows = await apiFetch('/imobilizado'); }
  catch(err){ alert(err.message); return; }

  state.fixedAssets = rows;
  const totalLiquido = rows.reduce((s,b)=>s+Number(b.valorLiquido),0);
  document.getElementById('imobilizado-total-liquido').textContent = formatMZN(totalLiquido);

  const tbody = document.querySelector('#table-imobilizado tbody');
  tbody.innerHTML = rows.map(b=>`
    <tr>
      <td><b>${b.descricao}</b></td>
      <td>${b.categoria||'—'}</td>
      <td style="text-align:right;" class="mono">${formatMZN(b.custo_aquisicao)}</td>
      <td>${formatDatePt(b.data_aquisicao)}</td>
      <td style="text-align:right;">${b.vida_util_anos} anos</td>
      <td style="text-align:right;" class="mono">${formatMZN(b.depreciacaoAnual)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(b.valorLiquido)}</td>
      <td class="row-actions"><button title="Remover" onclick="deleteImobilizado('${b.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-imobilizado').style.display = rows.length? 'none':'block';
}

function openImobilizadoModal(){ document.querySelector('#modal-imobilizado form').reset(); openModal('modal-imobilizado'); }

async function handleAddImobilizado(e){
  e.preventDefault();
  const payload = {
    descricao: document.getElementById('im-descricao').value.trim(),
    categoria: document.getElementById('im-categoria').value.trim(),
    custoAquisicao: parseFloat(document.getElementById('im-custo').value),
    dataAquisicao: document.getElementById('im-data-aquisicao').value,
    vidaUtilAnos: parseInt(document.getElementById('im-vida-util').value)
  };
  try{
    await apiFetch('/imobilizado', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-imobilizado');
    renderImobilizado();
  }catch(err){ alert(err.message); }
}

async function deleteImobilizado(id){
  if(!confirm('Remover este bem do imobilizado?')) return;
  try{ await apiFetch('/imobilizado/'+id, { method:'DELETE' }); renderImobilizado(); }
  catch(err){ alert(err.message); }
}

/* =========================================================
   MÓDULO EMPRESARIAL — ORÇAMENTO VS REAL
========================================================= */
const CATEGORIAS_ORCAMENTO = ['Vendas','Serviços','Recebimento de Cliente','Outras Receitas','Fornecedores','Renda/Aluguer','Salários','Transporte','Energia/Água','Outras Despesas'];

async function renderOrcamento(){
  const anoInput = document.getElementById('orcamento-ano');
  if(!anoInput.value) anoInput.value = new Date().getFullYear();
  const ano = parseInt(anoInput.value);

  let rows;
  try{ rows = await apiFetch('/orcamento?ano='+ano); }
  catch(err){ alert(err.message); return; }
  state.budgetLines = rows;

  const tbody = document.querySelector('#table-orcamento tbody');
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td><b>${r.rubrica}</b></td>
      <td><span class="tag ${r.tipo==='receita'?'green':'red'}">${r.tipo==='receita'?'Receita':'Despesa'}</span></td>
      <td style="text-align:right;" class="mono">${formatMZN(r.valor_orcado)}</td>
      <td style="text-align:right;" class="mono">${formatMZN(r.realizado)}</td>
      <td style="text-align:right;" class="${r.desvioValor>=0?'amount-pos':'amount-neg'}">${r.desvioValor>=0?'+':''}${formatMZN(r.desvioValor)}</td>
      <td style="text-align:right;">${r.desvioPercentual!=null? r.desvioPercentual.toFixed(1)+'%' : '—'}</td>
      <td class="row-actions"><button title="Remover" onclick="deleteOrcamento('${r.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-orcamento').style.display = rows.length? 'none':'block';
}

function openOrcamentoModal(){
  document.querySelector('#modal-orcamento form').reset();
  document.getElementById('orc-categorias').innerHTML = CATEGORIAS_ORCAMENTO.map(c=>`<option value="${c}">${c}</option>`).join('');
  openModal('modal-orcamento');
}

async function handleAddOrcamento(e){
  e.preventDefault();
  const categoriasSelecionadas = [...document.getElementById('orc-categorias').selectedOptions].map(o=>o.value);
  const payload = {
    rubrica: document.getElementById('orc-rubrica').value.trim(),
    tipo: document.getElementById('orc-tipo').value,
    categorias: categoriasSelecionadas.join(','),
    valorOrcado: parseFloat(document.getElementById('orc-valor').value),
    ano: parseInt(document.getElementById('orcamento-ano').value) || new Date().getFullYear()
  };
  try{
    await apiFetch('/orcamento', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-orcamento');
    renderOrcamento();
  }catch(err){ alert(err.message); }
}

async function deleteOrcamento(id){
  try{ await apiFetch('/orcamento/'+id, { method:'DELETE' }); renderOrcamento(); }
  catch(err){ alert(err.message); }
}

/* =========================================================
   MÓDULO EMPRESARIAL — CALENDÁRIO FISCAL (referência estática)
========================================================= */
function renderCalendarioFiscal(){
  const obrigacoes = [
    ['20 de Janeiro', 'IRPC/IRPS – Pagamento Antecipado (3.º Terço)'],
    ['28 de Fevereiro', 'NUIT – Confirmação anual de dados'],
    ['20 de Março', 'IVA – Declaração e pagamento (mês anterior)'],
    ['30 de Abril', 'IRPC – Entrega Modelo 20 (ano anterior)'],
    ['20 de Maio', 'IVA – Declaração e pagamento (mês anterior)'],
    ['30 de Junho', 'Balanço semestral obrigatório (grandes empresas)'],
    ['20 de Julho', 'IRPC – 1.º Pagamento Antecipado (1.º Terço)'],
    ['20 de Setembro', 'IRPC – 2.º Pagamento Antecipado (2.º Terço)'],
    ['31 de Outubro', 'Revisão de contas – auditoria externa (se obrigatória)'],
    ['31 de Dezembro', 'Encerramento do exercício fiscal']
  ];
  document.querySelector('#table-calendario-fiscal tbody').innerHTML = obrigacoes.map(([data,obrigacao])=>
    `<tr><td class="mono">${data}</td><td>${obrigacao}</td></tr>`
  ).join('');
}

