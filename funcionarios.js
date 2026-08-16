/* ContaFácil MZ — Módulo Funcionários
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   FUNCIONÁRIOS
========================================================= */
async function carregarFuncionarios(){
  const rows = await apiFetch('/funcionarios');
  state.employees = rows.map(normalizeFuncionario);
}

async function renderFuncionarios(){
  try{ await carregarFuncionarios(); }catch(err){ alert(err.message); return; }

  const totalSalarios = state.employees.filter(f=>f.status==='Ativo').reduce((s,f)=>s+f.salario,0);
  document.getElementById('funcionarios-total-salarios').textContent = formatMZN(totalSalarios);
  const tbody = document.querySelector('#table-funcionarios tbody');
  tbody.innerHTML = state.employees.map(f=>`
    <tr>
      <td><b>${f.nome}</b></td>
      <td>${f.cargo}</td>
      <td>${f.telefone}</td>
      <td style="text-align:right;" class="mono">${formatMZN(f.salario)}</td>
      <td><span class="tag ${f.status==='Ativo'?'green':'red'}">${f.status}</span></td>
      <td class="row-actions"><button title="Remover" onclick="deleteFuncionario('${f.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('empty-funcionarios').style.display = state.employees.length? 'none':'block';
}

function openFuncionarioModal(){ document.querySelector('#modal-funcionario form').reset(); openModal('modal-funcionario'); }

async function handleAddFuncionario(e){
  e.preventDefault();
  const payload = {
    nome: document.getElementById('funcionario-nome').value.trim(),
    cargo: document.getElementById('funcionario-cargo').value.trim(),
    telefone: document.getElementById('funcionario-telefone').value.trim(),
    salario: parseFloat(document.getElementById('funcionario-salario').value),
    status: document.getElementById('funcionario-status').value
  };
  try{
    await apiFetch('/funcionarios', { method:'POST', body: JSON.stringify(payload) });
    closeModal('modal-funcionario');
    renderFuncionarios();
  }catch(err){ alert(err.message); }
}

async function deleteFuncionario(id){
  if(!confirm('Tem a certeza que quer remover este funcionário?')) return;
  try{
    await apiFetch('/funcionarios/'+id, { method:'DELETE' });
    renderFuncionarios();
  }catch(err){ alert(err.message); }
}

