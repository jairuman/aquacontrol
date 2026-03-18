async function renderDashboard() {
  const db = await loadDB();

  const active     = db.clients.filter(c => c.status === 'activo');
  const totalDebt  = db.clients.reduce((s, c) => s + calcDebt(c, db).debt, 0);
  const totalPaid  = db.payments.reduce((s, p) => s + p.amount, 0);
  const withDebt   = db.clients.filter(c => calcDebt(c, db).debt > 0).length;

  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card accent">
      <div class="label">Total Clientes</div>
      <div class="value">${db.clients.length}</div>
      <div class="sub">${active.length} activos</div>
    </div>
    <div class="stat-card red">
      <div class="label">Deuda Total</div>
      <div class="value">$${totalDebt.toFixed(2)}</div>
      <div class="sub">${withDebt} con deuda</div>
    </div>
    <div class="stat-card green">
      <div class="label">Total Cobrado</div>
      <div class="value">$${totalPaid.toFixed(2)}</div>
      <div class="sub">Pagos registrados: ${db.payments.length}</div>
    </div>
    <div class="stat-card yellow">
      <div class="label">Al Corriente</div>
      <div class="value">${db.clients.length - withDebt}</div>
      <div class="sub">sin deuda pendiente</div>
    </div>
  `;

  const sorted  = [...db.clients].sort((a, b) => calcDebt(a, db).debt - calcDebt(b, db).debt);
  const maxDebt = sorted.length ? calcDebt(sorted[sorted.length - 1], db).debt : 1;
  const tbody   = document.getElementById('dashboard-table');

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><div class="emoji">💧</div><p>No hay clientes registrados</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((c, i) => {
    const { debt, unpaidMonths, prepaidMonths } = calcDebt(c, db);
    const pct   = maxDebt > 0 ? (debt / maxDebt * 100) : 0;
    const color = debt === 0 ? 'var(--green)' : debt < 50 ? 'var(--yellow)' : 'var(--red)';

    let statusBadge;
    if (unpaidMonths > 0) {
      statusBadge = `<span class="badge red">${unpaidMonths} mes${unpaidMonths > 1 ? 'es' : ''} pendiente${unpaidMonths > 1 ? 's' : ''}</span>`;
    } else if (prepaidMonths > 0) {
      statusBadge = `<span class="badge blue">⬆️ ${prepaidMonths} mes${prepaidMonths > 1 ? 'es' : ''} adelantado${prepaidMonths > 1 ? 's' : ''}</span>`;
    } else {
      statusBadge = `<span class="badge green">Al día</span>`;
    }

    return `<tr onclick="openClientDetail('${c.id}')">
      <td><span style="color:var(--text2);font-size:12px">#${i + 1}</span></td>
      <td><strong>${c.name}</strong></td>
      <td class="col-hide-mobile"><span style="font-family:monospace;font-size:12px;color:var(--accent)">${c.code}</span></td>
      <td class="col-hide-mobile" style="font-size:12px;color:var(--text2)">${c.dui || '—'}</td>
      <td><span class="badge ${c.status === 'activo' ? 'green' : 'gray'}">${c.status}</span></td>
      <td class="col-hide-mobile">${statusBadge}</td>
      <td>
        <div class="debt-rank">
          <strong style="color:${color};min-width:60px">$${debt.toFixed(2)}</strong>
          <div class="debt-bar-wrap">
            <div class="debt-bar" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
}