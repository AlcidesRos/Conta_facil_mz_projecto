/* ContaFácil MZ — Login, registo e autenticação
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   AUTENTICAÇÃO
========================================================= */
function aplicarUsuarioLogado(u){
  state.user = {
    ownerName: u.nome, email: u.email, phone: u.telefone, papel: u.papel,
    businessName: u.empresa.nomeNegocio, businessType: u.empresa.tipoNegocio,
    city: u.empresa.cidade, address: u.empresa.endereco, logo: u.empresa.logoUrl,
    nuit: u.empresa.nuit, formaJuridica: u.empresa.formaJuridica, sectorActividade: u.empresa.sectorActividade,
    cae: u.empresa.cae, empresaEmail: u.empresa.email, capitalSocial: u.empresa.capitalSocial,
    dataConstituicao: u.empresa.dataConstituicao, regimeIva: u.empresa.regimeIva, regimeIrpc: u.empresa.regimeIrpc,
    taxaIva: u.empresa.taxaIva!=null? Number(u.empresa.taxaIva): 0.16, taxaIrpc: u.empresa.taxaIrpc!=null? Number(u.empresa.taxaIrpc): 0.32,
    numeroFuncionarios: u.empresa.numeroFuncionarios, responsavelFinanceiro: u.empresa.responsavelFinanceiro,
    contabilistaCertificado: u.empresa.contabilistaCertificado,
    modulosAtivos: Array.isArray(u.empresa.modulosAtivos) && u.empresa.modulosAtivos.length ? u.empresa.modulosAtivos : Object.keys(MODULOS)
  };
  aplicarFiltroModulos();
}

async function handleLogin(e){
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-password').value;
  const erroEl = document.getElementById('login-error');
  erroEl.style.display = 'none';

  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'A entrar...';
  try{
    const data = await apiFetch('/auth/login', { method:'POST', body: JSON.stringify({ email, senha }) });
    authToken = data.token;
    aplicarUsuarioLogado(data.usuario);
    if(data.usuario.papel==='super_admin' || data.usuario.papel==='visualizador'){
      await enterAdminPanel();
    } else {
      await enterApp();
    }
  }catch(err){
    erroEl.textContent = err.message;
    erroEl.style.display = 'block';
  }finally{
    btn.disabled = false; btn.innerHTML = original;
  }
}

function handleRegister(e){
  e.preventDefault();
  pendingRegisterData = {
    nome: document.getElementById('reg-owner').value.trim(),
    telefone: document.getElementById('reg-phone').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    senha: document.getElementById('reg-password').value
  };
  startOnboarding();
}

function handleLogout(){
  authToken = null;
  state = {
    user:null, transactions:[], clients:[], products:[], stockMovements:[],
    suppliers:[], purchases:[], sales:[], employees:[], cashSessions:[], caixaAtual:null,
    currentPeriod:'mes'
  };
  showScreen('landing');
}

async function enterApp(){
  updateSidebarUser();
  showScreen('app');
  try{
    // Dados de referência usados em vários ecrãs (listas pequenas, por isso
    // carregamos tudo já no início, para os formulários/selects ficarem prontos).
    await Promise.all([carregarProdutos(), carregarClientes(), carregarFornecedores(), carregarFuncionarios(), carregarPagamentosEstado()]);
  }catch(err){
    alert('Não foi possível carregar os dados iniciais: ' + err.message);
  }
  showView('dashboard');
  updateStockAlerts();
  renderNotifPanel();
}

