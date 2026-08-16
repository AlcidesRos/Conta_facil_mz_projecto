/* ContaFácil MZ — Módulo Relatórios (exportação PDF/Excel)
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   RELATÓRIOS
========================================================= */
async function renderRelatorios(){
  const periodo = state.currentPeriod;
  let recCat, despCat;
  try{
    [recCat, despCat] = await Promise.all([
      apiFetch('/dashboard/categorias?tipo=receita&periodo='+periodo),
      apiFetch('/dashboard/categorias?tipo=despesa&periodo='+periodo)
    ]);
  }catch(err){ alert(err.message); return; }

  const recTotals = {}; recCat.forEach(r=>recTotals[r.categoria]=Number(r.total));
  const despTotals = {}; despCat.forEach(r=>despTotals[r.categoria]=Number(r.total));

  const ctxR = document.getElementById('chart-receitas-cat').getContext('2d');
  if(chartReceitasCat) chartReceitasCat.destroy();
  chartReceitasCat = new Chart(ctxR, {
    type:'doughnut',
    data:{ labels:Object.keys(recTotals), datasets:[{data:Object.values(recTotals), backgroundColor:Object.keys(recTotals).map(l=>CATEGORIAS_RECEITA_COLORS[l]||'#8598AB'), borderWidth:2, borderColor:'#fff'}] },
    options:{ responsive:true, plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}, cutout:'60%' }
  });

  const ctxD = document.getElementById('chart-despesas-cat').getContext('2d');
  if(chartDespesasCat) chartDespesasCat.destroy();
  chartDespesasCat = new Chart(ctxD, {
    type:'doughnut',
    data:{ labels:Object.keys(despTotals), datasets:[{data:Object.values(despTotals), backgroundColor:Object.keys(despTotals).map(l=>CATEGORIAS_DESPESA_COLORS[l]||'#8598AB'), borderWidth:2, borderColor:'#fff'}] },
    options:{ responsive:true, plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}, cutout:'60%' }
  });

  const tbody = document.querySelector('#table-resumo tbody');
  const rows = [];
  Object.entries(recTotals).forEach(([cat,val])=> rows.push({cat,tipo:'Receita',val}));
  Object.entries(despTotals).forEach(([cat,val])=> rows.push({cat,tipo:'Despesa',val}));
  rows.sort((a,b)=>b.val-a.val);
  tbody.innerHTML = rows.map(r=>`
    <tr><td>${r.cat}</td><td><span class="tag ${r.tipo==='Receita'?'green':'red'}">${r.tipo}</span></td>
    <td style="text-align:right;" class="${r.tipo==='Receita'?'amount-pos':'amount-neg'}">${formatMZN(r.val)}</td></tr>`
  ).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--slate-400);padding:30px;">Sem dados para este período.</td></tr>';
}

async function exportarRelatorioExcel(){
  let receitas, despesas;
  try{
    [receitas, despesas] = await Promise.all([
      carregarTransacoes('receita', state.currentPeriod),
      carregarTransacoes('despesa', state.currentPeriod)
    ]);
  }catch(err){ alert(err.message); return; }

  const wb = XLSX.utils.book_new();
  const wsReceitas = XLSX.utils.json_to_sheet(receitas.map(t=>({Data:formatDatePt(t.data), Categoria:t.categoria, Descrição:t.descricao, 'Valor (MT)':t.valor})));
  const wsDespesas = XLSX.utils.json_to_sheet(despesas.map(t=>({Data:formatDatePt(t.data), Categoria:t.categoria, Descrição:t.descricao, 'Valor (MT)':t.valor})));
  XLSX.utils.book_append_sheet(wb, wsReceitas, 'Receitas');
  XLSX.utils.book_append_sheet(wb, wsDespesas, 'Despesas');
  XLSX.writeFile(wb, `ContaFacilMZ_Relatorio_${todayISO()}.xlsx`);
}

async function exportarRelatorioPDF(){
  let receitas, despesas;
  try{
    [receitas, despesas] = await Promise.all([
      carregarTransacoes('receita', state.currentPeriod),
      carregarTransacoes('despesa', state.currentPeriod)
    ]);
  }catch(err){ alert(err.message); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const totalR = receitas.reduce((s,t)=>s+t.valor,0);
  const totalD = despesas.reduce((s,t)=>s+t.valor,0);

  doc.setFontSize(16); doc.text('ContaFácil MZ — Relatório Financeiro', 14, 18);
  doc.setFontSize(10); doc.text(`${state.user.businessName} · Período: ${periodLabel(state.currentPeriod)} · Gerado em ${formatDatePt(todayISO())}`, 14, 25);

  doc.setFontSize(12); doc.text(`Receitas: ${formatMZN(totalR)}`, 14, 38);
  doc.text(`Despesas: ${formatMZN(totalD)}`, 14, 45);
  doc.text(`Lucro: ${formatMZN(totalR-totalD)}`, 14, 52);

  let y = 65;
  doc.setFontSize(11); doc.text('Receitas', 14, y); y+=6;
  doc.setFontSize(9);
  receitas.forEach(t=>{ doc.text(`${formatDatePt(t.data)}  ${t.categoria}  ${t.descricao}  —  ${formatMZN(t.valor)}`, 14, y); y+=6; if(y>270){ doc.addPage(); y=20; } });

  y+=6; doc.setFontSize(11); doc.text('Despesas', 14, y); y+=6;
  doc.setFontSize(9);
  despesas.forEach(t=>{ doc.text(`${formatDatePt(t.data)}  ${t.categoria}  ${t.descricao}  —  ${formatMZN(t.valor)}`, 14, y); y+=6; if(y>270){ doc.addPage(); y=20; } });

  doc.save(`ContaFacilMZ_Relatorio_${todayISO()}.pdf`);
}

