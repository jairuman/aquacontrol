// =============================================
// app.js — Inicialización
// =============================================

async function initApp() {
  const now = new Date();
  document.getElementById('dash-date').textContent =
    now.toLocaleDateString('es-SV', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  // Limpia automáticamente eliminados con más de 60 días
  cleanOldDeleted();

  await renderDashboard();
}