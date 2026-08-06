/* ContaFácil MZ — Painel de Administração (super_admin / visualizador)
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   PAINEL DE ADMINISTRAÇÃO (super_admin / visualizador)
========================================================= */
async function enterAdminPanel(){
  const u = state.user;
  const initials = (u.ownerName||'U').trim().split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('admin-sidebar-avatar').textContent = initials;
  document.getElementById('admin-sidebar-username').textContent = u.ownerName;
  document.getElementById('admin-sidebar-papel').textContent = u.papel==='super_admin' ? 'Super Administrador' : 'Visualizador';
  document.getElementById('admin-nav-usuarios').style.display = u.papel==='super_admin' ? 'flex' : 'none';

  showScreen('admin');
  showAdminView('empresas');
}

function toggleAdminSidebar(open){
  document.getElementById('admin-sidebar').classList.toggle('open', open);
  document.getElementById('admin-sidebar-overlay').classList.toggle('show', open);
}

function showAdminView(view){
  toggleAdminSidebar(false);
  document.querySelectorAll('#screen-admin .view').forEach(v=>v.classList.remove('active'));
  document.getElementById('admin-view-'+view).classList.add('active');
  document.querySelectorAll('#admin-sidebar .nav-item').forEach(n=>n.classList.remove('active'));
  const navItem = document.querySelector(`#admin-sidebar .nav-item[data-admin-view="${view}"]`);
  if(navItem) navItem.classList.add('active');

  const titles = { empresas:'Empresas', usuarios:'Utilizadores' };
  document.getElementById('admin-topbar-title').textContent = titles[view] || 'Empresas';

  if(view==='empresas') renderAdminEmpresas();
  if(view==='usuarios') renderAdminUsuarios();
}

async function renderAdminEmpresas(){
  let rows;
  try{ rows = await apiFetch('/admin/empresas'); }
  catch(err){ alert(err.message); return; }

  const podeGerir = state.user.papel==='super_admin';
  const tbody = document.querySelector('#table-admin-empresas tbody');
  tbody.innerHTML = rows.map(e=>`
    <tr>
      <td><b>${e.nome_negocio}</b></td>
      <td>${e.tipo_negocio||'—'}</td>
      <td>${e.cidade||'—'}</td>
      <td>${e.dono_nome||'—'}<div style="font-size:11px;color:var(--slate-400);">${e.dono_email||''}</div></td>
      <td style="text-align:right;">${e.total_produtos}</td>
      <td style="text-align:right;">${e.total_usuarios}</td>
      <td style="text-align:right;" class="mono">${formatMZN(e.receitas_mes)}</td>
      <td class="row-actions" style="white-space:nowrap;">
        <button title="Ver produtos" onclick="abrirProdutosDaEmpresa('${e.id}','${e.nome_negocio.replace(/'/g,"&apos;")}')"><i class="fa-solid fa-box"></i></button>
        ${podeGerir? `<button title="Remover empresa" onclick="deleteAdminEmpresa('${e.id}')"><i class="fa-solid fa-trash"></i></button>`:''}
      </td>
    </tr>`).join('');
}

let adminEmpresaAtualId = null;

async function abrirProdutosDaEmpresa(empresaId, nomeNegocio){
  adminEmpresaAtualId = empresaId;
  document.getElementById('admin-produtos-empresa-nome').textContent = nomeNegocio;
  showAdminView('produtos-empresa');
  document.getElementById('admin-topbar-title').textContent = nomeNegocio;

  try{
    const [resumo, produtos] = await Promise.all([
      apiFetch('/admin/empresas/'+empresaId+'/resumo'),
      apiFetch('/admin/empresas/'+empresaId+'/produtos')
    ]);

    document.getElementById('admin-emp-saldo').textContent = formatMZN(resumo.saldoAtual);
    document.getElementById('admin-emp-receitas').textContent = formatMZN(resumo.receitasMes);
    document.getElementById('admin-emp-despesas').textContent = formatMZN(resumo.despesasMes);
    document.getElementById('admin-emp-lucro').textContent = formatMZN(resumo.lucroMes);
    document.getElementById('admin-emp-lucro').style.color = resumo.lucroMes>=0? 'var(--green-600)':'var(--danger)';

    document.querySelector('#table-admin-produtos tbody').innerHTML = produtos.map(p=>`
      <tr>
        <td><b>${p.nome}</b></td>
        <td>${p.categoria||'—'}</td>
        <td>${p.marca||'—'}</td>
        <td style="text-align:right;" class="mono">${formatMZN(p.preco_venda_unidade)}</td>
        <td style="text-align:right;" class="mono">${formatMZN(p.preco_venda_caixa)}</td>
        <td style="text-align:right;">${p.qtd_estoque_unidades}</td>
        <td><span class="tag ${p.status==='Ativo'?'green':'red'}">${p.status}</span></td>
      </tr>`).join('');
    document.getElementById('empty-admin-produtos').style.display = produtos.length? 'none':'block';

    document.querySelector('#table-admin-clientes tbody').innerHTML = resumo.clientes.map(c=>`
      <tr><td><b>${c.nome}</b></td><td>${c.telefone||'—'}</td>
      <td style="text-align:right;" class="${c.saldo_devedor>0?'amount-neg':'amount-pos'}">${formatMZN(c.saldo_devedor)}</td></tr>`).join('');
    document.getElementById('empty-admin-clientes').style.display = resumo.clientes.length? 'none':'block';

    document.querySelector('#table-admin-funcionarios tbody').innerHTML = resumo.funcionarios.map(f=>`
      <tr><td><b>${f.nome}</b></td><td>${f.cargo||'—'}</td>
      <td style="text-align:right;" class="mono">${formatMZN(f.salario)}</td>
      <td><span class="tag ${f.status==='Ativo'?'green':'red'}">${f.status}</span></td></tr>`).join('');
    document.getElementById('empty-admin-funcionarios').style.display = resumo.funcionarios.length? 'none':'block';

    showAdminEmpresaTab('produtos');
  }catch(err){ alert(err.message); }
}

function showAdminEmpresaTab(tab){
  document.querySelectorAll('#admin-emp-tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.admin-emp-tab-panel').forEach(p=>{
    p.style.display = p.id==='admin-emp-tab-'+tab ? 'block' : 'none';
  });
}

async function deleteAdminEmpresa(id){
  if(!confirm('Isto remove PERMANENTEMENTE esta empresa e todos os seus dados (produtos, clientes, vendas, etc.). Tem a certeza?')) return;
  try{
    await apiFetch('/admin/empresas/'+id, { method:'DELETE' });
    renderAdminEmpresas();
  }catch(err){ alert(err.message); }
}

async function renderAdminUsuarios(){
  let rows;
  try{ rows = await apiFetch('/admin/usuarios'); }
  catch(err){ alert(err.message); return; }

  const papelLabel = {super_admin:'Super Administrador', dono:'Dono de Negócio', visualizador:'Visualizador'};
  const tbody = document.querySelector('#table-admin-usuarios tbody');
  tbody.innerHTML = rows.map(u=>`
    <tr>
      <td><b>${u.nome}</b></td>
      <td>${u.email}</td>
      <td>${u.nome_negocio||'—'}</td>
      <td><div class="field-plain"><select onchange="changeAdminUsuarioPapel('${u.id}', this.value)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;">
        <option value="dono" ${u.papel==='dono'?'selected':''}>Dono de Negócio</option>
        <option value="visualizador" ${u.papel==='visualizador'?'selected':''}>Visualizador</option>
        <option value="super_admin" ${u.papel==='super_admin'?'selected':''}>Super Administrador</option>
      </select></div></td>
      <td class="row-actions"><button title="Remover" onclick="deleteAdminUsuario('${u.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
}

function openAdminUsuarioModal(){
  document.querySelector('#modal-admin-usuario form').reset();
  openModal('modal-admin-usuario');
}

async function handleAddAdminUsuario(e){
  e.preventDefault();
  const payload = {
    nome: document.getElementById('admin-user-nome').value.trim(),
    email: document.getElementById('admin-user-email').value.trim(),
    telefone: document.getElementById('admin-user-telefone').value.trim(),
    senha: document.getElementById('admin-user-senha').value,
    papel: document.getElementById('admin-user-papel').value
  };
  try{
    await apiFetch('/admin/usuarios', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-admin-usuario');
    renderAdminUsuarios();
  }catch(err){ alert(err.message); }
}

async function changeAdminUsuarioPapel(id, papel){
  try{
    await apiFetch('/admin/usuarios/'+id+'/papel', { method:'PATCH', body: JSON.stringify({ papel }) });
  }catch(err){
    alert(err.message);
    renderAdminUsuarios();
  }
}

async function deleteAdminUsuario(id){
  if(!confirm('Remover este utilizador?')) return;
  try{
    await apiFetch('/admin/usuarios/'+id, { method:'DELETE' });
    renderAdminUsuarios();
  }catch(err){ alert(err.message); }
}

function updateSidebarUser(){
  const u = state.user;
  const initials = (u.ownerName||'U').trim().split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-username').textContent = u.ownerName;
  document.getElementById('sidebar-bizname').textContent = u.businessName;
}

