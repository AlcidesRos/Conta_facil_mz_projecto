/* ContaFácil MZ — Dashboard principal com KPIs
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   DASHBOARD
========================================================= */
let chartMonthly, chartCatDashboard, chartReceitasCat, chartDespesasCat;

async function renderDashboard(){
  const periodo = state.currentPeriod;
  let resumo, mensal, despCat, recentes;
  try{
    [resumo, mensal, despCat, recentes] = await Promise.all([
      apiFetch('/dashboard/resumo?periodo='+periodo),
      apiFetch('/dashboard/mensal'),
      apiFetch('/dashboard/categorias?tipo=despesa&periodo='+periodo),
      carregarTransacoes(null, periodo)
    ]);
  }catch(err){ alert(err.message); return; }

  document.getElementById('card-saldo').textContent = formatMZN(resumo.saldoAtual);
  document.getElementById('card-receitas').textContent = formatMZN(resumo.receitasPeriodo);
  document.getElementById('card-despesas').textContent = formatMZN(resumo.despesasPeriodo);
  document.getElementById('card-lucro').textContent = formatMZN(resumo.lucroPeriodo);
  document.getElementById('card-lucro').style.color = resumo.lucroPeriodo>=0 ? 'var(--green-600)':'var(--danger)';

  document.getElementById('label-receitas').textContent = 'Receitas '+periodLabel(periodo);
  document.getElementById('label-despesas').textContent = 'Despesas '+periodLabel(periodo);
  document.getElementById('label-lucro').textContent = 'Lucro '+periodLabel(periodo);
  document.getElementById('card-receitas-count').textContent = resumo.quantidadeReceitas + ' lanç.';
  document.getElementById('card-despesas-count').textContent = resumo.quantidadeDespesas + ' lanç.';

  const recentesOrdenados = [...recentes].sort((a,b)=> b.data.localeCompare(a.data)).slice(0,8);
  const tbody = document.querySelector('#table-recentes tbody');
  tbody.innerHTML = recentesOrdenados.map(t=>`
    <tr>
      <td>${formatDatePt(t.data)}</td>
      <td><span class="tag ${t.tipo==='receita'?'green':'red'}">${t.tipo==='receita'?'Receita':'Despesa'}</span></td>
      <td>${t.categoria}</td>
      <td>${t.descricao}</td>
      <td style="text-align:right;" class="${t.tipo==='receita'?'amount-pos':'amount-neg'}">${t.tipo==='receita'?'+':'-'} ${formatMZN(t.valor)}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--slate-400);padding:30px;">Sem lançamentos ainda.</td></tr>';

  renderChartMonthly(mensal);
  renderChartCatDashboard(despCat);
  renderDashboardKpisExtra(periodo);
}

async function renderDashboardKpisExtra(periodo){
  const ativos = state.user.modulosAtivos || Object.keys(MODULOS);
  document.querySelectorAll('#cards-grid-kpis [data-modulo]').forEach(card=>{
    card.style.display = ativos.includes(card.dataset.modulo) ? '' : 'none';
  });

  // Vendas de hoje + ticket médio (módulo "vendas")
  if(ativos.includes('vendas')){
    try{
      const vendasHoje = (await carregarTransacoes('receita','hoje')).filter(t=>t.categoria==='Vendas');
      const totalHoje = vendasHoje.reduce((s,t)=>s+t.valor,0);
      document.getElementById('card-vendas-hoje').textContent = formatMZN(totalHoje);
      document.getElementById('card-vendas-hoje-count').textContent = vendasHoje.length + ' venda(s) hoje';

      const vendasMes = (await carregarTransacoes('receita', periodo)).filter(t=>t.categoria==='Vendas');
      const totalMes = vendasMes.reduce((s,t)=>s+t.valor,0);
      const ticketMedio = vendasMes.length ? totalMes/vendasMes.length : 0;
      document.getElementById('card-ticket-medio').textContent = formatMZN(ticketMedio);
    }catch(err){ /* silencioso — não bloqueia o resto do dashboard */ }
  }

  // Produtos em falta (módulo "estoque")
  if(ativos.includes('estoque')){
    try{
      await carregarProdutos();
      const emFalta = state.products.filter(p=>stockInfo(p).isLow).length;
      document.getElementById('card-produtos-falta').textContent = emFalta;
    }catch(err){ /* silencioso */ }
  }

  // Contas por receber / pagar (módulo "financeiro")
  if(ativos.includes('financeiro')){
    try{
      await carregarClientes();
      const totalReceber = state.clients.reduce((s,c)=>s+c.saldoDevedor,0);
      document.getElementById('card-contas-receber').textContent = formatMZN(totalReceber);
    }catch(err){ /* silencioso */ }
    try{
      const pagar = await apiFetch('/contas-pagar');
      const totalPagar = pagar.filter(c=>c.estado!=='Pago').reduce((s,c)=>s+Number(c.valor),0);
      document.getElementById('card-contas-pagar').textContent = formatMZN(totalPagar);
    }catch(err){ /* silencioso */ }
  }

  // Estado do caixa (módulo "caixa")
  if(ativos.includes('caixa')){
    try{
      const sessao = await apiFetch('/caixa/atual');
      const el = document.getElementById('card-estado-caixa');
      if(sessao){ el.innerHTML = '<span class="tag green">Aberto</span>'; }
      else{ el.innerHTML = '<span class="tag red">Fechado</span>'; }
    }catch(err){ /* silencioso */ }
  }
}

function last6MonthsLabels(){
  const labels = [], keys = [];
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  for(let i=5;i>=0;i--){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    labels.push(meses[d.getMonth()]+'/'+String(d.getFullYear()).slice(2));
    keys.push(d.getFullYear()+'-'+d.getMonth());
  }
  return {labels, keys};
}

function renderChartMonthly(mensalRows){
  const {labels, keys} = last6MonthsLabels();
  const buscarTotal = (tipo, y, m) => {
    const row = mensalRows.find(r => r.tipo===tipo && new Date(r.mes).getFullYear()===y && new Date(r.mes).getMonth()===m);
    return row ? Number(row.total) : 0;
  };
  const receitasData = keys.map(k=>{ const [y,m]=k.split('-').map(Number); return buscarTotal('receita', y, m); });
  const despesasData = keys.map(k=>{ const [y,m]=k.split('-').map(Number); return buscarTotal('despesa', y, m); });

  const ctx = document.getElementById('chart-monthly').getContext('2d');
  if(chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[
      {label:'Receitas', data:receitasData, backgroundColor:'#34D399', borderRadius:6, maxBarThickness:26},
      {label:'Despesas', data:despesasData, backgroundColor:'#D64545', borderRadius:6, maxBarThickness:26}
    ]},
    options:{
      responsive:true,
      plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:12}}}},
      scales:{ y:{ ticks:{ callback:v=>v.toLocaleString('pt-MZ') }, grid:{color:'#EEF3F8'} }, x:{ grid:{display:false} } }
    }
  });
}

function renderChartCatDashboard(despCatRows){
  const labels = despCatRows.map(r=>r.categoria);
  const data = despCatRows.map(r=>Number(r.total));
  const colors = labels.map(l=>CATEGORIAS_DESPESA_COLORS[l]||'#8598AB');
  const ctx = document.getElementById('chart-cat-dashboard').getContext('2d');
  if(chartCatDashboard) chartCatDashboard.destroy();
  chartCatDashboard = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{data, backgroundColor:colors, borderWidth:2, borderColor:'#fff'}] },
    options:{ responsive:true, plugins:{legend:{position:'bottom', labels:{boxWidth:10,font:{size:11}}}}, cutout:'60%' }
  });
  ctx.canvas.parentElement.querySelector('.chart-empty-note')?.remove();
  if(!labels.length){
    const note = document.createElement('p');
    note.className='chart-empty-note';
    note.style.cssText='text-align:center;color:var(--slate-400);font-size:13px;margin-top:10px;';
    note.textContent='Sem despesas neste período.';
    ctx.canvas.parentElement.appendChild(note);
  }
}

