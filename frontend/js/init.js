/* ContaFácil MZ — Inicialização — listeners globais (fecha modais/painéis ao clicar fora)
   Este ficheiro depende de config.js (deve ser carregado antes). */

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
document.addEventListener('click', function(e){
  document.querySelectorAll('.modal-backdrop.active').forEach(m=>{
    if(e.target===m) m.classList.remove('active');
  });
  const notifPanel = document.getElementById('notif-panel');
  const notifWrap = document.querySelector('.notif-wrap');
  if(notifPanel && notifPanel.classList.contains('open') && notifWrap && !notifWrap.contains(e.target)){
    notifPanel.classList.remove('open');
  }
});

