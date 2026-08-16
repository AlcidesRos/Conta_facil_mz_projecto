/* ContaFácil MZ — Configuração da API, estado global, arquitectura modular e normalização de dados
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   CONFIGURAÇÃO DA API
   ---------------------------------------------------------
   Isto é a ÚNICA linha que precisa de mudar quando publicar
   o backend no seu VPS. Enquanto testa no seu computador,
   deixe como está (http://localhost:4000/api).
========================================================= */
const API_BASE = 'https://conta-facil-mz-projecto.onrender.com/api';

let authToken = null;

/**
 * Função central para falar com o backend.
 * - Junta a URL base ao caminho pedido
 * - Anexa automaticamente o token JWT (quando existe)
 * - Converte a resposta em JSON
 * - Lança um erro com a mensagem vinda da API, para podermos
 *   mostrar isso ao utilizador com alert()/mensagens no ecrã
 */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

  let res;
  try {
    res = await fetch(API_BASE + path, { ...options, headers });
  } catch (err) {
    throw new Error('Não foi possível ligar ao servidor. Verifique se o backend está a correr em ' + API_BASE + '.');
  }

  if (res.status === 204) return null; // DELETE bem-sucedido não devolve corpo

  let data = null;
  try { data = await res.json(); } catch (e) { /* resposta sem corpo JSON */ }

  if (!res.ok) {
    if (res.status === 401 && authToken) {
      alert('A sua sessão expirou. Por favor entre novamente.');
      handleLogout();
    }
    throw new Error((data && data.erro) || 'Ocorreu um erro. Tente novamente.');
  }
  return data;
}

/* =========================================================
   ESTADO LOCAL — funciona como uma "cache" do que a API devolveu.
   Cada vez que abrimos um ecrã, voltamos a buscar os dados
   frescos à API e substituímos o conteúdo destes arrays.
========================================================= */
let state = {
  user: null,
  transactions: [],
  clients: [],
  products: [],
  stockMovements: [],
  suppliers: [],
  purchases: [],
  sales: [],
  employees: [],
  cashSessions: [],
  caixaAtual: null,
  currentPeriod: 'mes',
  payables: [],
  fixedAssets: [],
  budgetLines: [],
  ivaEntries: [],
  irpsEscaloes: [],
  ivaPeriod: 'mes',
  pagamentosEstado: null,
  mobilePayments: [],
  bancos: [],
  cartoes: [],
  categoriasFinanceiras: []
};

let pendingBusinessType = null;   // tipo de negócio escolhido no onboarding, antes de submeter
let pendingLogoDataUrl = null;    // logo do negócio (onboarding/perfil), em base64
let pendingProdutoImagemUrl = null; // imagem do produto, em base64 (variável própria, para não colidir com o logo)
let pendingRegisterData = null;   // nome/e-mail/telefone/senha recolhidos no passo 1 do registo
let pdvCart = [];
let pdvPayMethod = 'Dinheiro';

function todayISO(){ return new Date().toISOString().slice(0,10); }
function formatMZN(valor){
  const v = Number(valor||0);
  return v.toLocaleString('pt-MZ', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' MT';
}
function formatDatePt(iso){
  if(!iso) return '—';
  const [y,m,d] = String(iso).slice(0,10).split('-');
  return `${d}/${m}/${y}`;
}

const CATEGORIAS_DESPESA_COLORS = {
  'Fornecedores':'#2563EB','Renda/Aluguer':'#3B82F6','Salários':'#10B981',
  'Transporte':'#34D399','Energia/Água':'#C98A1A','Outras Despesas':'#8598AB'
};
const CATEGORIAS_RECEITA_COLORS = {
  'Vendas':'#10B981','Serviços':'#34D399','Recebimento de Cliente':'#3B82F6','Outras Receitas':'#2563EB'
};

/* =========================================================
   ARQUITECTURA MODULAR — cada módulo controla um grupo de ecrãs.
   Módulos que não aparecem aqui (dashboard, perfil, configuracoes) são
   "core" e ficam sempre visíveis, para todos os tipos de negócio.
========================================================= */
const MODULOS = {
  financeiro:         { label:'Financeiro',          icon:'fa-sack-dollar',            views:['receitas','despesas','contaspagar','contasreceber','bancos','cartoes','categorias','conciliacao'] },
  caixa:              { label:'Caixa',                icon:'fa-vault',                   views:['caixa'] },
  estoque:            { label:'Estoque',              icon:'fa-warehouse',               views:['produtos','estoque'] },
  vendas:             { label:'Vendas (PDV)',         icon:'fa-cash-register',           views:['vendas'] },
  clientes:           { label:'Clientes',             icon:'fa-users',                   views:['clientes'] },
  fornecedores:       { label:'Fornecedores e Compras',icon:'fa-truck-field',            views:['fornecedores','compras'] },
  funcionarios:       { label:'Gestão de Funcionários',icon:'fa-user-tie',               views:['funcionarios'] },
  relatorios:         { label:'Relatórios',           icon:'fa-chart-pie',               views:['relatorios'] },
  pagamentos_moveis:  { label:'Pagamentos Móveis (M-Pesa/e-Mola)', icon:'fa-mobile-screen-button', views:['pagamentosmoveis'] },
  contabilidade:      { label:'Módulo Empresarial (DRE, IVA, Folha de Salários...)', icon:'fa-building-columns', views:['dre','iva','folhasalarios','imobilizado','orcamento','calendariofiscal'] }
};

function moduloDoView(view){
  for(const [chave, mod] of Object.entries(MODULOS)){
    if(mod.views.includes(view)) return chave;
  }
  return null; // ecrã "core" — sempre visível
}

// Mostra/esconde os itens do menu lateral consoante os módulos activos da empresa.
function aplicarFiltroModulos(){
  const ativos = state.user.modulosAtivos || Object.keys(MODULOS);
  document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item=>{
    const modulo = moduloDoView(item.dataset.view);
    item.style.display = (!modulo || ativos.includes(modulo)) ? '' : 'none';
  });
  // Esconde o rótulo "Módulo Empresarial" se nenhum dos itens a seguir estiver visível
  document.querySelectorAll('.sidebar-section-label').forEach(label=>{
    let el = label.nextElementSibling, algumVisivel = false;
    while(el && el.classList.contains('nav-item')){
      if(el.style.display !== 'none') algumVisivel = true;
      el = el.nextElementSibling;
    }
    label.style.display = algumVisivel ? '' : 'none';
  });
}

/* =========================================================
   NORMALIZAÇÃO — converte as respostas da API (colunas em
   snake_case, como vêm do Postgres) para o formato camelCase
   que o resto da interface usa.
========================================================= */
function normalizeProduto(r){
  return {
    id: r.id, nome:r.nome, categoria:r.categoria||'', marca:r.marca||'',
    codigoInterno:r.codigo_interno||'', codigoBarras:r.codigo_barras||'',
    fornecedorId:r.fornecedor_id||'', descricao:r.descricao||'',
    precoCompra:Number(r.preco_compra), precoVendaUnidade:Number(r.preco_venda_unidade),
    precoVendaCaixa:Number(r.preco_venda_caixa), qtdPorCaixa:Number(r.qtd_por_caixa),
    qtdEstoqueUnidades:Number(r.qtd_estoque_unidades), qtdMinima:Number(r.qtd_minima_caixas),
    imagem:r.imagem_url, status:r.status
  };
}
function normalizeCliente(r){
  return { id:r.id, nome:r.nome, telefone:r.telefone||'', nif:r.nif||'', saldoDevedor:Number(r.saldo_devedor) };
}
function normalizeFornecedor(r){
  return { id:r.id, nome:r.nome, empresa:r.empresa||'', telefone:r.telefone||'', email:r.email||'', cidade:r.cidade||'', produtos:r.produtos_fornecidos||'' };
}
function normalizeFuncionario(r){
  return { id:r.id, nome:r.nome, cargo:r.cargo||'', telefone:r.telefone||'', salario:Number(r.salario), status:r.status };
}
function normalizeTransacao(r){
  return { id:r.id, tipo:r.tipo, valor:Number(r.valor), categoria:r.categoria, descricao:r.descricao||'', data:r.data };
}
function normalizeMovimento(r){
  return { id:r.id, productId:r.produto_id, tipo:r.tipo, quantidade:Number(r.quantidade_unidades),
    motivo:r.motivo||'', data:r.data, hora:(r.hora||'').slice(0,5), usuario:r.usuario_nome||state.user.ownerName };
}

