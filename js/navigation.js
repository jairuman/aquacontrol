let currentPage = 'dashboard';

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const navMap = { dashboard: 0, clients: 1, deleted: 2 };
  if (navMap[page] !== undefined)
    document.querySelectorAll('.nav-item')[navMap[page]]?.classList.add('active');
  document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
  const mbEl = document.getElementById('mbnav-' + page);
  if (mbEl) mbEl.classList.add('active');
  currentPage = page;
  if (page === 'dashboard') renderDashboard();
  if (page === 'clients')   renderClientsTable();
  if (page === 'deleted')   renderDeletedTable();
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}