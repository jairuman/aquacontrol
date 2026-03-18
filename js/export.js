/* =============================================
   export.js — Exportar e Importar Excel
   ============================================= */

/* ===== EXPORTAR ===== */
async function exportExcel() {
  const db = await loadDB();

  const data = db.clients.map(c => {
    const { debt, totalPaid, billedMonths, unpaidMonths } = calcDebt(c, db);
    return {
      'Código':              c.code,
      'Nombre':              c.name,
      'DUI':                 c.dui || '',
      'Teléfono':            c.phone || '',
      'Dirección':           c.address || '',
      'Medidor':             c.meter || '',
      'Estado':              c.status,
      'Cuota Mensual':       c.monthlyFee,
      'Fecha Registro':      c.registrationDate,
      'Meses Transcurridos': billedMonths,
      'Meses Pendientes':    unpaidMonths,
      'Total Pagado':        totalPaid,
      'Deuda Total':         debt,
      'Notas':               c.notes || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

  if (db.payments.length) {
    const pData = db.payments.map(p => {
      const c = db.clients.find(x => x.id === p.clientId);
      return {
        'Cliente': c ? c.name : 'Eliminado',
        'Código':  c ? c.code : '',
        'Monto':   p.amount,
        'Fecha':   p.date,
        'Nota':    p.note || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pData), 'Pagos');
  }

  if (db.deleted.length) {
    const dData = db.deleted.map(c => ({
      'Nombre':            c.name,
      'Código':            c.code,
      'DUI':               c.dui || '',
      'Deuda al eliminar': c.debtAtDeletion || 0,
      'Fecha eliminación': c.deletedAt
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dData), 'Eliminados');
  }

  XLSX.writeFile(wb, `AquaControl_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Archivo Excel exportado', 'success');
}

/* ===== IMPORTAR ===== */
function triggerImport() {
  document.getElementById('import-file-input').click();
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Limpia el input para permitir importar el mismo archivo de nuevo
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const workbook  = XLSX.read(e.target.result, { type: 'binary' });
      const sheet     = workbook.Sheets['Clientes'];

      if (!sheet) {
        showToast('El Excel no tiene una hoja llamada "Clientes"', 'error');
        return;
      }

      const rows = XLSX.utils.sheet_to_json(sheet);
      if (!rows.length) {
        showToast('La hoja "Clientes" está vacía', 'error');
        return;
      }

      const db = await loadDB();

      const nuevos    = [];
      const duplicados = [];

      for (const row of rows) {
        const code = (row['Código'] || '').toString().trim();
        const name = (row['Nombre'] || '').toString().trim();
        if (!name) continue;

        const existe = db.clients.find(c => c.code === code);
        if (existe) {
          duplicados.push({ row, existing: existe });
        } else {
          nuevos.push(row);
        }
      }

      // Si hay duplicados, pregunta qué hacer
      if (duplicados.length > 0) {
        const nombres = duplicados.map(d => d.existing.name).join(', ');
        _pendingImport = { nuevos, duplicados, db };
        document.getElementById('import-dup-list').textContent = nombres;
        openModal('modal-import-duplicates');
        return;
      }

      // Sin duplicados, importa directo
      await commitImport(nuevos, [], db);

    } catch (err) {
      console.error('Error al importar:', err);
      showToast('Error leyendo el archivo Excel', 'error');
    }
  };
  reader.readAsBinaryString(file);
}

// Guarda los datos pendientes de importación mientras el usuario decide
let _pendingImport = null;

// El usuario eligió ACTUALIZAR los duplicados
async function importUpdateDuplicates() {
  if (!_pendingImport) return;
  const { nuevos, duplicados, db } = _pendingImport;
  _pendingImport = null;
  closeModal('modal-import-duplicates');
  await commitImport(nuevos, duplicados, db, true);
}

// El usuario eligió IGNORAR los duplicados
async function importSkipDuplicates() {
  if (!_pendingImport) return;
  const { nuevos, db } = _pendingImport;
  _pendingImport = null;
  closeModal('modal-import-duplicates');
  await commitImport(nuevos, [], db, false);
}

async function commitImport(nuevos, duplicados, db, updateDuplicates = false) {
  let added   = 0;
  let updated = 0;

  // Agrega los clientes nuevos
  for (const row of nuevos) {
    const client = rowToClient(row, db);
    db.clients.push(client);
    db.nextId++;
    added++;
  }

  // Actualiza los duplicados si el usuario lo eligió
  if (updateDuplicates) {
    for (const { row, existing } of duplicados) {
      const idx = db.clients.findIndex(c => c.id === existing.id);
      if (idx > -1) {
        db.clients[idx] = {
          ...db.clients[idx],
          name:             (row['Nombre']        || existing.name).toString().trim(),
          dui:              (row['DUI']            || existing.dui  || '').toString().trim(),
          phone:            (row['Teléfono']       || existing.phone || '').toString().trim(),
          address:          (row['Dirección']      || existing.address || '').toString().trim(),
          meter:            (row['Medidor']        || existing.meter || '').toString().trim(),
          monthlyFee:       parseFloat(row['Cuota Mensual']) || existing.monthlyFee,
          status:           (row['Estado']         || existing.status).toString().trim(),
          registrationDate: (row['Fecha Registro'] || existing.registrationDate).toString().trim(),
          notes:            (row['Notas']          || existing.notes || '').toString().trim(),
        };
        updated++;
      }
    }
  }

  await saveDB(db);

  const msg = updateDuplicates
    ? `${added} agregados, ${updated} actualizados`
    : `${added} clientes importados${duplicados.length > 0 ? `, ${duplicados.length} omitidos` : ''}`;

  showToast(msg, 'success');

  if (currentPage === 'clients')   await renderClientsTable();
  if (currentPage === 'dashboard') await renderDashboard();
}

// Convierte una fila del Excel en un objeto cliente
function rowToClient(row, db) {
  return {
    id:               'c' + Date.now() + Math.random().toString(36).substr(2, 5),
    code:             'CLI-' + String(db.nextId).padStart(4, '0'),
    name:             (row['Nombre']        || '').toString().trim(),
    dui:              (row['DUI']           || '').toString().trim(),
    phone:            (row['Teléfono']      || '').toString().trim(),
    address:          (row['Dirección']     || '').toString().trim(),
    meter:            (row['Medidor']       || '').toString().trim(),
    monthlyFee:       parseFloat(row['Cuota Mensual']) || 10,
    status:           (row['Estado']        || 'activo').toString().trim(),
    registrationDate: (row['Fecha Registro'] || new Date().toISOString().split('T')[0]).toString().trim(),
    notes:            (row['Notas']         || '').toString().trim(),
  };
}