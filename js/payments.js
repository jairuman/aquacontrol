/* =============================================
   payments.js — Registro de Pagos
   ============================================= */

async function openPaymentModal(id) {
  const db = await loadDB();
  const c  = db.clients.find(x => x.id === id);
  if (!c) return;

  const { debt, unpaidMonths, prepaidMonths } = calcDebt(c, db);

  document.getElementById('pay-client-id').value          = id;
  document.getElementById('pay-debt-display').textContent = '$' + debt.toFixed(2);

  let statusText;
  if (unpaidMonths > 0)
    statusText = `${unpaidMonths} mes${unpaidMonths > 1 ? 'es' : ''} pendiente${unpaidMonths > 1 ? 's' : ''} × $${c.monthlyFee}`;
  else if (prepaidMonths > 0)
    statusText = `⬆️ ${prepaidMonths} mes${prepaidMonths > 1 ? 'es' : ''} pagado${prepaidMonths > 1 ? 's' : ''} por adelantado`;
  else
    statusText = '✅ Al corriente — pago adelantará meses futuros';

  document.getElementById('pay-months-display').textContent = statusText;
  document.getElementById('pay-amount').value = c.monthlyFee.toFixed(2);
  document.getElementById('pay-date').value   = new Date().toISOString().split('T')[0];
  document.getElementById('pay-note').value   = '';
  openModal('modal-payment');
}

async function savePayment() {
  const id     = document.getElementById('pay-client-id').value;
  const amount = parseFloat(document.getElementById('pay-amount').value);
  const date   = document.getElementById('pay-date').value;
  const note   = document.getElementById('pay-note').value.trim();

  if (!amount || amount <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
  if (!date)                  { showToast('Selecciona una fecha', 'error'); return; }

  const payment = {
    id:       'p' + Date.now(),
    clientId: id,
    amount,
    date,
    note,
  };

  try {
    // Guarda directamente en Firebase colección 'payments'
    const { id: _id, ...paymentData } = payment;
    await db_firestore.collection('payments').doc(payment.id).set(paymentData);

    // Actualiza cache local
    const db = await loadDB();
    db.payments.push(payment);
    _cache = JSON.parse(JSON.stringify(db));
    localStorage.setItem('aquacontrol_db', JSON.stringify(db));

    closeModal('modal-payment');

    // Calcula si hay meses adelantados para el mensaje
    const freshDb = await loadDB();
    const c = freshDb.clients.find(x => x.id === id);
    if (c) {
      const { prepaidMonths } = calcDebt(c, freshDb);
      showToast(
        prepaidMonths > 0
          ? `Pago registrado — ${prepaidMonths} mes${prepaidMonths > 1 ? 'es' : ''} adelantado${prepaidMonths > 1 ? 's' : ''}`
          : 'Pago registrado correctamente',
        'success'
      );
    } else {
      showToast('Pago registrado correctamente', 'success');
    }

    if (currentPage === 'client-detail') {
      const cl = freshDb.clients.find(x => x.id === id);
      if (cl) await renderClientDetail(cl, false);
    }
    if (currentPage === 'dashboard') await renderDashboard();

  } catch (err) {
    console.error('❌ Error guardando pago:', err);
    showToast('Error al registrar pago, intenta de nuevo', 'error');
  }
}