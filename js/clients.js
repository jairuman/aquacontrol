/* =============================================
   clients.js — Gestión de Clientes
   ============================================= */

/* ===== TABLA DE CLIENTES ===== */
async function renderClientsTable() {
  const db = await loadDB();
  const q  = (document.getElementById('search-input')?.value || '').toLowerCase();
  const st = document.getElementById('filter-status')?.value || '';

  let clients = db.clients;
  if (q)  clients = clients.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.code.toLowerCase().includes(q) ||
    (c.dui || '').includes(q)
  );
  if (st) clients = clients.filter(c => c.status === st);

  const tbody = document.getElementById('clients-table');
  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="emoji">🔍</div><p>Sin resultados</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map(c => {
    const { debt } = calcDebt(c, db);
    return `<tr onclick="openClientDetail('${c.id}')">
      <td class="col-hide-mobile"><span style="font-family:monospace;font-size:12px;color:var(--accent)">${c.code}</span></td>
      <td><strong>${c.name}</strong></td>
      <td class="col-hide-mobile" style="font-size:12px;color:var(--text2)">${c.dui || '—'}</td>
      <td class="col-hide-mobile" style="font-size:13px">${c.phone || '—'}</td>
      <td><span class="badge ${c.status === 'activo' ? 'green' : 'gray'}">${c.status}</span></td>
      <td><strong style="color:${debt > 0 ? 'var(--red)' : 'var(--green)'}">$${debt.toFixed(2)}</strong></td>
      <td onclick="event.stopPropagation()">
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${c.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('${c.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ===== DETALLE CLIENTE ACTIVO ===== */
async function openClientDetail(id) {
  const db = await loadDB();
  const c  = db.clients.find(x => x.id === id);
  if (!c) return;
  showPage('client-detail');
  await renderClientDetail(c, false);
}

/* ===== DETALLE CLIENTE ELIMINADO ===== */
async function openDeletedDetail(id) {
  const db = await loadDB();
  const c  = db.deleted.find(x => x.id === id);
  if (!c) return;
  showPage('client-detail');
  await renderClientDetail(c, true);
}

/* ===== RENDER DETALLE — reutilizado para activos y eliminados ===== */
async function renderClientDetail(c, isDeleted = false) {
  const db       = await loadDB();
  const payments = db.payments
    .filter(p => p.clientId === c.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const { debt, totalPaid, billedMonths, unpaidMonths, prepaidMonths } = calcDebt(c, db);

  // Cuenta regresiva si está eliminado
  let deletedBanner = '';
  if (isDeleted) {
    const now      = new Date();
    const daysLeft = 60 - Math.floor((now - new Date(c.deletedAt)) / (1000 * 60 * 60 * 24));
    const color    = daysLeft <= 5 ? 'var(--red)' : daysLeft <= 15 ? 'var(--yellow)' : 'var(--green)';
    deletedBanner  = `
      <div style="background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.25);border-radius:10px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <span style="color:var(--red);font-weight:600">🗑️ Cliente eliminado el ${new Date(c.deletedAt).toLocaleDateString('es-SV')}</span>
        <span style="color:${color};font-weight:700">⏳ Se borra definitivamente en ${daysLeft > 0 ? daysLeft + ' días' : 'hoy'}</span>
      </div>`;
  }

  // Grid mensual
  const regDate           = new Date(c.registrationDate);
  const totalMonthsToShow = billedMonths + prepaidMonths;
  let monthCells = '';
  for (let i = 0; i < totalMonthsToShow; i++) {
    const d      = new Date(regDate.getFullYear(), regDate.getMonth() + i, 1);
    const status = getMonthStatus(c, d.getFullYear(), d.getMonth(), db);
    const name   = d.toLocaleDateString('es-SV', { month: 'short', year: '2-digit' });
    const isPrepaid = status === 'prepaid', isPaid = status === 'paid', isUnpaid = status === 'unpaid';
    const cellClass   = isUnpaid ? 'unpaid' : isPaid ? 'paid' : isPrepaid ? 'paid' : 'future';
    const icon        = isUnpaid ? '❌' : isPaid ? '✅' : isPrepaid ? '⬆️' : '⏳';
    const amountColor = isUnpaid ? 'var(--red)' : 'var(--green)';
    const amountText  = isUnpaid ? `-$${c.monthlyFee.toFixed(2)}` : isPrepaid ? 'adelantado' : `+$${c.monthlyFee.toFixed(2)}`;
    monthCells += `
      <div class="month-cell ${cellClass}" ${isPrepaid ? 'style="border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.07)"' : ''}>
        <div class="m-name">${name}</div>
        <div class="m-status">${icon}</div>
        <div class="m-amount" style="color:${isPrepaid ? 'var(--accent)' : amountColor}">${amountText}</div>
      </div>`;
  }

  const paymentRows = payments.length
    ? payments.map(p => `
        <div class="payment-row">
          <div>
            <div style="font-size:13px;font-weight:600">${p.note || 'Pago registrado'}</div>
            <div class="date">${new Date(p.date).toLocaleDateString('es-SV')}</div>
          </div>
          <div class="amount">+$${p.amount.toFixed(2)}</div>
        </div>`).join('')
    : '<div class="empty-state" style="padding:30px"><div class="emoji">💸</div><p>Sin pagos registrados</p></div>';

  let statusCard;
  if (unpaidMonths > 0)       statusCard = `<div class="debt-card"><div class="dc-label">Meses Pendientes</div><div class="dc-value" style="color:var(--red)">${unpaidMonths}</div></div>`;
  else if (prepaidMonths > 0) statusCard = `<div class="debt-card"><div class="dc-label">Meses Adelantados</div><div class="dc-value" style="color:var(--accent)">⬆️ ${prepaidMonths}</div></div>`;
  else                        statusCard = `<div class="debt-card"><div class="dc-label">Estado</div><div class="dc-value" style="color:var(--green)">Al día ✓</div></div>`;

  // Botones del header según si está eliminado o activo
  const headerButtons = isDeleted
    ? `<button class="btn btn-success" onclick="restoreClient('${c.id}')">↩️ Recuperar Cliente</button>`
    : `
        <button class="btn btn-primary"   onclick="openPaymentModal('${c.id}')">💵 Registrar Pago</button>
        <button class="btn btn-secondary" onclick="openEditModal('${c.id}')">✏️ Editar</button>
      `;

  document.getElementById('client-detail-content').innerHTML = `
    ${deletedBanner}
    <div class="client-header-card" ${isDeleted ? 'style="border-color:rgba(255,68,68,0.2)"' : ''}>
      <div class="client-avatar" ${isDeleted ? 'style="background:linear-gradient(135deg,#ff4444,#aa2222)"' : ''}>${c.name.charAt(0).toUpperCase()}</div>
      <div class="client-info" style="flex:1">
        <h2>${c.name}</h2>
        <div class="meta">
          <span>📋 ${c.code}</span>
          ${c.dui   ? `<span>🪪 ${c.dui}</span>`            : ''}
          ${c.phone ? `<span>📞 ${c.phone}</span>`          : ''}
          ${c.meter ? `<span>🔧 Medidor: ${c.meter}</span>` : ''}
          <span class="badge ${isDeleted ? 'red' : c.status === 'activo' ? 'green' : 'gray'}" style="margin-left:4px">${isDeleted ? 'eliminado' : c.status}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px">${headerButtons}</div>
    </div>

    <div class="debt-summary">
      <div class="debt-card"><div class="dc-label">Deuda Actual</div><div class="dc-value" style="color:${debt > 0 ? 'var(--red)' : 'var(--green)'}">$${debt.toFixed(2)}</div></div>
      <div class="debt-card"><div class="dc-label">Total Pagado</div><div class="dc-value" style="color:var(--green)">$${totalPaid.toFixed(2)}</div></div>
      ${statusCard}
      <div class="debt-card"><div class="dc-label">Cuota Mensual</div><div class="dc-value" style="color:var(--accent)">$${c.monthlyFee.toFixed(2)}</div></div>
    </div>

    <div class="three-col">
      <div>
        <div class="section-card" style="margin-bottom:20px">
          <div class="section-header">
            <h3>📅 Historial por Mes</h3>
            ${prepaidMonths > 0 ? `<span class="badge blue">⬆️ ${prepaidMonths} mes${prepaidMonths > 1 ? 'es' : ''} adelantado${prepaidMonths > 1 ? 's' : ''}</span>` : ''}
          </div>
          <div class="month-grid">${monthCells || '<div style="padding:20px;color:var(--text2);font-size:13px">Sin meses registrados</div>'}</div>
        </div>
        <div class="section-card">
          <div class="section-header">
            <h3>💳 Pagos Registrados</h3>
            <span style="font-size:12px;color:var(--text2)">${payments.length} pagos</span>
          </div>
          ${paymentRows}
        </div>
      </div>
      <div>
        <div class="section-card">
          <div class="section-header"><h3>👤 Datos Personales</h3></div>
          <div class="data-list">
            <div class="data-item"><span class="key">Nombre</span><span class="val">${c.name}</span></div>
            <div class="data-item"><span class="key">DUI</span><span class="val">${c.dui || '—'}</span></div>
            <div class="data-item"><span class="key">Teléfono</span><span class="val">${c.phone || '—'}</span></div>
            <div class="data-item"><span class="key">Dirección</span><span class="val">${c.address || '—'}</span></div>
            <div class="data-item"><span class="key">Medidor</span><span class="val">${c.meter || '—'}</span></div>
            <div class="data-item"><span class="key">Registro</span><span class="val">${new Date(c.registrationDate).toLocaleDateString('es-SV')}</span></div>
            <div class="data-item"><span class="key">Estado</span><span class="val"><span class="badge ${isDeleted ? 'red' : c.status === 'activo' ? 'green' : 'gray'}">${isDeleted ? 'eliminado' : c.status}</span></span></div>
            ${c.notes ? `<div class="data-item"><span class="key">Notas</span><span class="val">${c.notes}</span></div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ===== TABLA ELIMINADOS ===== */
async function renderDeletedTable() {
  const db    = await loadDB();
  const tbody = document.getElementById('deleted-table');
  const q     = (document.getElementById('search-deleted')?.value || '').toLowerCase();

  let deleted = db.deleted;
  if (q) deleted = deleted.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.dui || '').toLowerCase().includes(q)
  );

  if (!deleted.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="emoji">${q ? '🔍' : '✅'}</div>
        <p>${q ? 'Sin resultados' : 'Sin clientes eliminados'}</p>
      </div>
    </td></tr>`;
    return;
  }

  const now = new Date();

  tbody.innerHTML = deleted.map(c => {
    const deletedAt = new Date(c.deletedAt);
    const diffMs    = now - deletedAt;
    const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const daysLeft  = 60 - diffDays;

    let color, icon;
    if (daysLeft <= 5)       { color = 'var(--red)';    icon = '🔴'; }
    else if (daysLeft <= 15) { color = 'var(--yellow)'; icon = '🟡'; }
    else                     { color = 'var(--green)';  icon = '🟢'; }

    return `<tr onclick="openDeletedDetail('${c.id}')" style="cursor:pointer">
      <td><strong>${c.name}</strong></td>
      <td><span style="font-family:monospace;font-size:12px;color:var(--accent)">${c.code}</span></td>
      <td style="font-size:12px">${c.dui || '—'}</td>
      <td>${c.phone || '—'}</td>
      <td style="font-size:12px">${c.address || '—'}</td>
      <td style="color:var(--red)">$${c.debtAtDeletion?.toFixed(2) || '0.00'}</td>
      <td style="font-size:12px;color:var(--text2)">${deletedAt.toLocaleDateString('es-SV')}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="color:${color};font-weight:700;font-size:12px;white-space:nowrap">
            ${icon} ${daysLeft > 0 ? daysLeft + ' días' : 'Hoy'}
          </span>
          <button class="btn btn-success btn-sm" onclick="restoreClient('${c.id}')">↩️ Recuperar</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ===== RECUPERAR CLIENTE ===== */
async function restoreClient(id) {
  const db  = await loadDB();
  const idx = db.deleted.findIndex(x => x.id === id);
  if (idx === -1) return;

  const c = db.deleted[idx];
  const { debtAtDeletion, deletedAt, ...clientData } = c;
  const restoredClient = { ...clientData, status: 'activo' };

  try {
    const batch = db_firestore.batch();

    // 1. Borra de 'deleted' en Firebase directamente
    batch.delete(db_firestore.collection('deleted').doc(id));

    // 2. Agrega de vuelta a 'clients' en Firebase directamente
    const { id: _id, ...clientFirebaseData } = restoredClient;
    batch.set(db_firestore.collection('clients').doc(id), clientFirebaseData);

    await batch.commit();

    // 3. Actualiza el cache local
    db.deleted.splice(idx, 1);
    db.clients.push(restoredClient);
    _cache = JSON.parse(JSON.stringify(db));

    // 4. Respaldo local
    localStorage.setItem('aquacontrol_db', JSON.stringify(db));

    showToast(`${c.name} recuperado exitosamente`, 'success');
    showPage('deleted');
    await renderDeletedTable();

  } catch (err) {
    console.error('❌ Error recuperando cliente:', err);
    showToast('Error al recuperar, intenta de nuevo', 'error');
  }
}

/* ===== MODAL AGREGAR / EDITAR ===== */
async function openAddModal() {
  document.getElementById('modal-title').textContent = 'Nuevo Cliente';
  document.getElementById('edit-id').value    = '';
  document.getElementById('f-name').value     = '';
  document.getElementById('f-dui').value      = '';
  document.getElementById('f-phone').value    = '';
  document.getElementById('f-address').value  = '';
  document.getElementById('f-fee').value      = '10';
  document.getElementById('f-status').value   = 'activo';
  document.getElementById('f-meter').value    = '';
  document.getElementById('f-notes').value    = '';
  document.getElementById('f-date').value     = new Date().toISOString().split('T')[0];
  const db = await loadDB();
  document.getElementById('f-code').value = 'CLI-' + String(db.nextId).padStart(4, '0');
  openModal('modal-client');
}

async function openEditModal(id) {
  const db = await loadDB();
  const c  = db.clients.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modal-title').textContent = 'Editar Cliente';
  document.getElementById('edit-id').value    = id;
  document.getElementById('f-name').value     = c.name;
  document.getElementById('f-code').value     = c.code;
  document.getElementById('f-dui').value      = c.dui || '';
  document.getElementById('f-phone').value    = c.phone || '';
  document.getElementById('f-address').value  = c.address || '';
  document.getElementById('f-fee').value      = c.monthlyFee;
  document.getElementById('f-status').value   = c.status;
  document.getElementById('f-date').value     = c.registrationDate;
  document.getElementById('f-meter').value    = c.meter || '';
  document.getElementById('f-notes').value    = c.notes || '';
  openModal('modal-client');
}

async function saveClient() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('El nombre es requerido', 'error'); return; }

  const db     = await loadDB();
  const editId = document.getElementById('edit-id').value;

  const client = {
    id:               editId || 'c' + Date.now(),
    code:             document.getElementById('f-code').value,
    name,
    dui:              document.getElementById('f-dui').value.trim(),
    phone:            document.getElementById('f-phone').value.trim(),
    address:          document.getElementById('f-address').value.trim(),
    monthlyFee:       parseFloat(document.getElementById('f-fee').value) || 10,
    status:           document.getElementById('f-status').value,
    registrationDate: document.getElementById('f-date').value || new Date().toISOString().split('T')[0],
    meter:            document.getElementById('f-meter').value.trim(),
    notes:            document.getElementById('f-notes').value.trim(),
  };

  try {
    // Guarda directamente en Firebase
    const { id, ...clientData } = client;
    await db_firestore.collection('clients').doc(id).set(clientData);

    // Actualiza nextId en Firebase si es cliente nuevo
    if (!editId) {
      client.code = 'CLI-' + String(db.nextId).padStart(4, '0');
      db.nextId++;
      await db_firestore.collection('config').doc('meta').set({ nextId: db.nextId });
      // Reescribe con el código correcto
      const { id: _id, ...updatedData } = client;
      await db_firestore.collection('clients').doc(client.id).set(updatedData);
    }

    // Actualiza cache local
    if (editId) {
      const idx = db.clients.findIndex(x => x.id === editId);
      if (idx > -1) db.clients[idx] = { ...db.clients[idx], ...client };
    } else {
      db.clients.push(client);
    }
    _cache = JSON.parse(JSON.stringify(db));
    localStorage.setItem('aquacontrol_db', JSON.stringify(db));

    showToast(editId ? 'Cliente actualizado correctamente' : 'Cliente registrado exitosamente', 'success');
    closeModal('modal-client');

    if (currentPage === 'dashboard')          await renderDashboard();
    else if (currentPage === 'clients')       await renderClientsTable();
    else if (currentPage === 'client-detail') {
      const c = db.clients.find(x => x.id === (editId || client.id));
      if (c) await renderClientDetail(c, false);
    }

  } catch (err) {
    console.error('❌ Error guardando cliente:', err);
    showToast('Error al guardar, intenta de nuevo', 'error');
  }
}

/* ===== ELIMINAR ===== */
let pendingDeleteId = null;

function confirmDelete(id) {
  pendingDeleteId = id;
  openModal('modal-confirm');
  document.getElementById('confirm-ok-btn').onclick = () => doDelete(id);
}

async function doDelete(id) {
  const db  = await loadDB();
  const idx = db.clients.findIndex(x => x.id === id);
  if (idx === -1) return;

  const c = db.clients[idx];
  const { debt } = calcDebt(c, db);

  const deletedClient = {
    ...c,
    debtAtDeletion: debt,
    deletedAt: new Date().toISOString(),
  };

  try {
    const batch = db_firestore.batch();

    // 1. Borra de 'clients' en Firebase directamente
    batch.delete(db_firestore.collection('clients').doc(id));

    // 2. Agrega a 'deleted' en Firebase directamente
    const { id: _id, ...deletedData } = deletedClient;
    batch.set(db_firestore.collection('deleted').doc(id), deletedData);

    await batch.commit();

    // 3. Actualiza el cache local
    db.clients.splice(idx, 1);
    db.deleted.push(deletedClient);
    _cache = JSON.parse(JSON.stringify(db));

    // 4. Respaldo local
    localStorage.setItem('aquacontrol_db', JSON.stringify(db));

    closeModal('modal-confirm');
    showToast(`${c.name} eliminado — se borrará en 60 días`, 'success');

    if (currentPage === 'clients')        await renderClientsTable();
    else if (currentPage === 'dashboard') await renderDashboard();

  } catch (err) {
    console.error('❌ Error eliminando cliente:', err);
    showToast('Error al eliminar, intenta de nuevo', 'error');
  }
}