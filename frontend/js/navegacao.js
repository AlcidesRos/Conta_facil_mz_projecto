/* ContaFácil MZ — Onboarding, navegação entre ecrãs e modais genéricos
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   ONBOARDING (primeira configuração)
========================================================= */
function startOnboarding(){
  pendingBusinessType = null;
  pendingLogoDataUrl = null;
  document.querySelectorAll('.biztype-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('ob-continue-btn').disabled = true;
  document.getElementById('ob-logo-preview').innerHTML = '<i class="fa-solid fa-image"></i>';
  document.getElementById('ob-business-name').value = '';
  document.getElementById('ob-city').value = '';
  document.getElementById('ob-address').value = '';
  document.getElementById('ob-phone').value = pendingRegisterData.telefone || '';
  goToOnboardingStep(1);
  showScreen('onboarding');
}

function selectBusinessType(el){
  document.querySelectorAll('.biztype-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  pendingBusinessType = el.dataset.tipo;
  document.getElementById('ob-continue-btn').disabled = false;
}

function goToOnboardingStep(step){
  document.querySelectorAll('.onboarding-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('ob-step-'+step).classList.add('active');
  document.getElementById('ob-dot-1').classList.toggle('active', step>=1);
  document.getElementById('ob-dot-2').classList.toggle('active', step>=2);
  window.scrollTo(0,0);
}

function handleLogoUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    pendingLogoDataUrl = ev.target.result;
    document.getElementById('ob-logo-preview').innerHTML = `<img src="${pendingLogoDataUrl}" alt="Logo">`;
  };
  reader.readAsDataURL(file);
}

async function handleOnboardingDetails(e){
  e.preventDefault();
  const payload = {
    ...pendingRegisterData,
    telefone: document.getElementById('ob-phone').value.trim() || pendingRegisterData.telefone,
    nomeNegocio: document.getElementById('ob-business-name').value.trim(),
    tipoNegocio: pendingBusinessType,
    cidade: document.getElementById('ob-city').value.trim(),
    endereco: document.getElementById('ob-address').value.trim()
  };

  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'A criar conta...';
  try{
    const data = await apiFetch('/auth/register', { method:'POST', body: JSON.stringify(payload) });
    authToken = data.token;
    aplicarUsuarioLogado(data.usuario);

    if(pendingLogoDataUrl){
      await apiFetch('/auth/empresa', { method:'PUT', body: JSON.stringify({ logoUrl: pendingLogoDataUrl }) });
      state.user.logo = pendingLogoDataUrl;
    }
    await enterApp();
  }catch(err){
    alert(err.message);
  }finally{
    btn.disabled = false; btn.innerHTML = original;
  }
}

/* =========================================================
   NAVEGAÇÃO ENTRE ECRÃS
========================================================= */
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  window.scrollTo(0,0);
}

function showView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');

  const titles = {
    dashboard:['Visão geral','Dashboard'],
    produtos:['Catálogo','Produtos'],
    estoque:['Gestão de armazém','Estoque'],
    vendas:['Ponto de Venda','Vendas'],
    pagamentosmoveis:['Ponto de Venda','Pagamentos Móveis'],
    receitas:['Gestão financeira','Receitas'],
    despesas:['Gestão financeira','Despesas'],
    bancos:['Gestão financeira','Bancos'],
    cartoes:['Gestão financeira','Cartões'],
    categorias:['Gestão financeira','Categorias'],
    conciliacao:['Gestão financeira','Conciliação Bancária'],
    clientes:['Gestão de clientes','Clientes'],
    fornecedores:['Cadeia de fornecimento','Fornecedores'],
    compras:['Cadeia de fornecimento','Compras'],
    caixa:['Gestão financeira','Caixa'],
    relatorios:['Análise','Relatórios'],
    funcionarios:['Equipa','Funcionários'],
    dre:['Módulo Empresarial','Demonstração de Resultados'],
    iva:['Módulo Empresarial','Controlo de IVA'],
    contaspagar:['Módulo Empresarial','Contas a Pagar'],
    contasreceber:['Módulo Empresarial','Contas a Receber'],
    folhasalarios:['Módulo Empresarial','Folha de Salários'],
    imobilizado:['Módulo Empresarial','Imobilizado'],
    orcamento:['Módulo Empresarial','Orçamento vs Real'],
    calendariofiscal:['Módulo Empresarial','Calendário Fiscal'],
    perfil:['A minha conta','Perfil'],
    configuracoes:['A minha conta','Configurações']
  };
  document.getElementById('topbar-crumb').textContent = titles[view][0];
  document.getElementById('topbar-title').textContent = titles[view][1];
  document.getElementById('period-filter').style.visibility = (view==='dashboard'||view==='receitas'||view==='despesas'||view==='relatorios') ? 'visible':'hidden';

  if(view==='dashboard') renderDashboard();
  if(view==='produtos') renderProdutos();
  if(view==='estoque') renderEstoque();
  if(view==='vendas') renderVendas();
  if(view==='pagamentosmoveis') renderPagamentosMoveis();
  if(view==='receitas') renderReceitas();
  if(view==='despesas') renderDespesas();
  if(view==='bancos') renderBancos();
  if(view==='cartoes') renderCartoes();
  if(view==='categorias') renderCategorias();
  if(view==='conciliacao') renderConciliacaoView();
  if(view==='clientes') renderClientes();
  if(view==='fornecedores') renderFornecedores();
  if(view==='compras') renderCompras();
  if(view==='caixa') renderCaixa();
  if(view==='relatorios') renderRelatorios();
  if(view==='funcionarios') renderFuncionarios();
  if(view==='dre') renderDRE();
  if(view==='iva') renderIva();
  if(view==='contaspagar') renderContasPagar();
  if(view==='contasreceber') renderContasReceber();
  if(view==='folhasalarios') renderFolhaSalarios();
  if(view==='imobilizado') renderImobilizado();
  if(view==='orcamento') renderOrcamento();
  if(view==='calendariofiscal') renderCalendarioFiscal();
  if(view==='perfil') renderPerfil();
  if(view==='configuracoes') renderConfiguracoes();

  toggleSidebar(false);
}

function toggleSidebar(open){
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('sidebar-overlay').classList.toggle('show', open);
}

function setPeriod(p){
  state.currentPeriod = p;
  document.querySelectorAll('#period-filter button').forEach(b=>b.classList.toggle('active', b.dataset.period===p));
  const activeView = document.querySelector('.view.active').id.replace('view-','');
  if(activeView==='dashboard') renderDashboard();
  if(activeView==='receitas') renderReceitas();
  if(activeView==='despesas') renderDespesas();
  if(activeView==='relatorios') renderRelatorios();
}

function periodLabel(period){
  return {hoje:'hoje','semana':'da semana','mes':'do mês','ano':'do ano'}[period];
}

/* =========================================================
   MODAIS
========================================================= */
function openModal(id){
  document.getElementById(id).classList.add('active');
  const dEl = document.querySelector('#'+id+' input[type="date"]');
  if(dEl && !dEl.value) dEl.value = todayISO();
}
function closeModal(id){ document.getElementById(id).classList.remove('active'); }

