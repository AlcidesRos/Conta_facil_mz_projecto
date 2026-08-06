/* ContaFácil MZ — Notificações, Perfil e Configurações (incl. Módulos activos)
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   NOTIFICAÇÕES (calculadas localmente a partir dos dados já
   carregados — produtos e clientes ficam sempre atualizados
   porque cada ecrã os recarrega ao ser aberto)
========================================================= */
function computeNotifications(){
  const notifs = [];
  state.products.forEach(p=>{
    const s = stockInfo(p);
    if(s.isLow) notifs.push({icon:'fa-triangle-exclamation', color:'var(--danger)', titulo:`Estoque baixo: ${p.nome}`, sub:`Restam ${s.caixas} caixa(s).`});
  });
  state.clients.forEach(c=>{
    if(c.saldoDevedor>0) notifs.push({icon:'fa-hand-holding-dollar', color:'var(--warn)', titulo:`${c.nome} tem dívida pendente`, sub: formatMZN(c.saldoDevedor)});
  });
  [...state.sales].slice(-3).reverse().forEach(v=>{
    notifs.push({icon:'fa-cash-register', color:'var(--green-600)', titulo:`Nova venda ${v.numero}`, sub: formatMZN(v.total)});
  });
  return notifs;
}
function toggleNotifPanel(){
  const panel = document.getElementById('notif-panel');
  const opening = !panel.classList.contains('open');
  panel.classList.toggle('open', opening);
  if(opening) renderNotifPanel();
}
function renderNotifPanel(){
  const notifs = computeNotifications();
  const body = document.getElementById('notif-panel-body');
  body.innerHTML = notifs.length? notifs.map(n=>`
    <div class="notif-item"><i class="fa-solid ${n.icon}" style="color:${n.color};"></i>
      <div><div class="ni-title">${n.titulo}</div><div class="ni-sub">${n.sub}</div></div>
    </div>`).join('') : '<div class="notif-empty">Sem notificações por agora.</div>';
  const countEl = document.getElementById('notif-count');
  const alertCount = state.products.filter(p=>stockInfo(p).isLow).length + state.clients.filter(c=>c.saldoDevedor>0).length;
  countEl.style.display = alertCount? 'inline-block':'none';
  countEl.textContent = alertCount;
}

/* =========================================================
   PERFIL
========================================================= */
function renderPerfil(){
  const u = state.user;
  const initials = (u.ownerName||'U').trim().split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('perfil-avatar').textContent = initials;
  document.getElementById('perfil-nome-display').textContent = u.ownerName;
  document.getElementById('perfil-negocio-display').textContent = u.businessName;
  document.getElementById('perfil-business').value = u.businessName;
  document.getElementById('perfil-owner').value = u.ownerName;
  document.getElementById('perfil-phone').value = u.phone;
  document.getElementById('perfil-email').value = u.email;
  document.getElementById('perfil-tipo').value = u.businessType || '—';
  document.getElementById('perfil-cidade').value = u.city || '';
  document.getElementById('perfil-endereco').value = u.address || '';

  document.getElementById('fiscal-nuit').value = u.nuit || '';
  document.getElementById('fiscal-forma-juridica').value = u.formaJuridica || '';
  document.getElementById('fiscal-sector').value = u.sectorActividade || '';
  document.getElementById('fiscal-cae').value = u.cae || '';
  document.getElementById('fiscal-email').value = u.empresaEmail || '';
  document.getElementById('fiscal-capital-social').value = u.capitalSocial || '';
  document.getElementById('fiscal-data-constituicao').value = u.dataConstituicao ? String(u.dataConstituicao).slice(0,10) : '';
  document.getElementById('fiscal-num-funcionarios').value = u.numeroFuncionarios || '';
  document.getElementById('fiscal-regime-iva').value = u.regimeIva || 'Normal';
  document.getElementById('fiscal-regime-irpc').value = u.regimeIrpc || 'Geral';
  document.getElementById('fiscal-taxa-iva').value = u.taxaIva!=null? (u.taxaIva*100) : 16;
  document.getElementById('fiscal-taxa-irpc').value = u.taxaIrpc!=null? (u.taxaIrpc*100) : 32;
  document.getElementById('fiscal-responsavel').value = u.responsavelFinanceiro || '';
  document.getElementById('fiscal-contabilista').value = u.contabilistaCertificado || '';
}

async function handleSaveProfile(e){
  e.preventDefault();
  const nomeNegocio = document.getElementById('perfil-business').value.trim();
  const ownerName = document.getElementById('perfil-owner').value.trim();
  const phone = document.getElementById('perfil-phone').value.trim();
  const cidade = document.getElementById('perfil-cidade').value.trim();
  const endereco = document.getElementById('perfil-endereco').value.trim();

  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'A guardar...';
  try{
    await Promise.all([
      apiFetch('/auth/empresa', { method:'PUT', body: JSON.stringify({ nomeNegocio, cidade, endereco, telefone: phone }) }),
      apiFetch('/auth/usuario', { method:'PUT', body: JSON.stringify({ nome: ownerName, telefone: phone }) })
    ]);
    state.user.businessName = nomeNegocio; state.user.ownerName = ownerName; state.user.phone = phone;
    state.user.city = cidade; state.user.address = endereco;
    updateSidebarUser();
    renderPerfil();
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado!';
  }catch(err){
    alert(err.message);
    btn.innerHTML = original;
  }finally{
    btn.disabled = false;
    setTimeout(()=>{ btn.innerHTML = original; }, 1800);
  }
}

async function handleSaveDadosFiscais(e){
  e.preventDefault();
  const payload = {
    nuit: document.getElementById('fiscal-nuit').value.trim(),
    formaJuridica: document.getElementById('fiscal-forma-juridica').value,
    sectorActividade: document.getElementById('fiscal-sector').value.trim(),
    cae: document.getElementById('fiscal-cae').value.trim(),
    email: document.getElementById('fiscal-email').value.trim(),
    capitalSocial: parseFloat(document.getElementById('fiscal-capital-social').value) || 0,
    dataConstituicao: document.getElementById('fiscal-data-constituicao').value || null,
    numeroFuncionarios: parseInt(document.getElementById('fiscal-num-funcionarios').value) || 0,
    regimeIva: document.getElementById('fiscal-regime-iva').value,
    regimeIrpc: document.getElementById('fiscal-regime-irpc').value,
    taxaIva: (parseFloat(document.getElementById('fiscal-taxa-iva').value) || 0) / 100,
    taxaIrpc: (parseFloat(document.getElementById('fiscal-taxa-irpc').value) || 0) / 100,
    responsavelFinanceiro: document.getElementById('fiscal-responsavel').value.trim(),
    contabilistaCertificado: document.getElementById('fiscal-contabilista').value.trim()
  };
  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'A guardar...';
  try{
    await apiFetch('/auth/empresa', { method:'PUT', body: JSON.stringify(payload) });
    Object.assign(state.user, {
      nuit: payload.nuit, formaJuridica: payload.formaJuridica, sectorActividade: payload.sectorActividade,
      cae: payload.cae, empresaEmail: payload.email, capitalSocial: payload.capitalSocial,
      dataConstituicao: payload.dataConstituicao, numeroFuncionarios: payload.numeroFuncionarios,
      regimeIva: payload.regimeIva, regimeIrpc: payload.regimeIrpc, taxaIva: payload.taxaIva, taxaIrpc: payload.taxaIrpc,
      responsavelFinanceiro: payload.responsavelFinanceiro, contabilistaCertificado: payload.contabilistaCertificado
    });
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado!';
  }catch(err){
    alert(err.message);
    btn.innerHTML = original;
  }finally{
    btn.disabled = false;
    setTimeout(()=>{ btn.innerHTML = original; }, 1800);
  }
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */
function renderConfiguracoes(){
  const u = state.user;
  document.getElementById('cfg-nome-negocio').textContent = u.businessName;
  document.getElementById('cfg-negocio-sub').textContent = `${u.businessType || 'Negócio'} · ${u.city || 'Moçambique'} · ${u.email}`;
  renderModulosConfig();
}

function renderModulosConfig(){
  const ativos = state.user.modulosAtivos || Object.keys(MODULOS);
  const container = document.getElementById('cfg-modulos-lista');
  container.innerHTML = Object.entries(MODULOS).map(([chave, mod])=>`
    <div class="settings-row">
      <div><div class="sr-title"><i class="fa-solid ${mod.icon}" style="width:18px;color:var(--blue-700);"></i> ${mod.label}</div></div>
      <div class="switch ${ativos.includes(chave)?'on':''}" data-modulo="${chave}" onclick="this.classList.toggle('on'); handleToggleModulo()"></div>
    </div>`).join('');
}

let modulosGuardarTimeout = null;
function handleToggleModulo(){
  clearTimeout(modulosGuardarTimeout);
  modulosGuardarTimeout = setTimeout(salvarModulosAtivos, 600);
}

async function salvarModulosAtivos(){
  const selecionados = [...document.querySelectorAll('#cfg-modulos-lista .switch.on')].map(el=>el.dataset.modulo);
  try{
    const data = await apiFetch('/auth/modulos', { method:'PUT', body: JSON.stringify({ modulosAtivos: selecionados }) });
    state.user.modulosAtivos = data.modulosAtivos;
    aplicarFiltroModulos();
    const viewActivo = document.querySelector('#screen-app .view.active');
    if(viewActivo){
      const nomeView = viewActivo.id.replace('view-','');
      const modulo = moduloDoView(nomeView);
      if(modulo && !data.modulosAtivos.includes(modulo)){
        showView('dashboard');
        showView('configuracoes');
      }
    }
  }catch(err){ alert(err.message); }
}

function toggleDarkMode(el){
  const ativo = el.classList.toggle('on');
  document.body.classList.toggle('dark-mode', ativo);
}

function handleChangeIdioma(){
  const idioma = document.getElementById('cfg-idioma').value;
  if(idioma !== 'pt-MZ'){
    alert('Esse idioma ainda não está disponível. Por agora o sistema funciona apenas em Português.');
    document.getElementById('cfg-idioma').value = 'pt-MZ';
  }
}

async function handleTrocarSenha(e){
  e.preventDefault();
  const senhaAtual = document.getElementById('senha-atual').value;
  const senhaNova = document.getElementById('senha-nova').value;
  const confirmar = document.getElementById('senha-confirmar').value;
  const erro = document.getElementById('trocar-senha-erro');

  if(senhaNova !== confirmar){
    erro.textContent = 'As senhas não coincidem.';
    erro.style.display = 'block';
    return;
  }
  try{
    await apiFetch('/auth/senha', { method:'PUT', body: JSON.stringify({ senhaAtual, senhaNova }) });
    erro.style.display = 'none';
    e.target.reset();
    closeModal('modal-trocar-senha');
    alert('Senha alterada com sucesso.');
  }catch(err){
    erro.textContent = err.message;
    erro.style.display = 'block';
  }
}

