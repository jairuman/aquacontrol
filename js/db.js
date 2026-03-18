// =============================================
// db.js — Base de datos con Firebase Firestore
// =============================================

const firebaseConfig = {
  apiKey: "AIzaSyDJVOAOfvN1-b2DlyZyC1CUVRgqJvrYStw",
  authDomain: "aquacontrol-1ef04.firebaseapp.com",
  projectId: "aquacontrol-1ef04",
  storageBucket: "aquacontrol-1ef04.firebasestorage.app",
  messagingSenderId: "315765076547",
  appId: "1:315765076547:web:6f70bbeda13ffc11c3daf6"
};

firebase.initializeApp(firebaseConfig);
const db_firestore = firebase.firestore();

const COL_CLIENTS  = 'clients';
const COL_PAYMENTS = 'payments';
const COL_DELETED  = 'deleted';
const COL_CONFIG   = 'config';

let _cache = null;

async function loadDB() {
  if (_cache) return _cache;

  try {
    const [clientsSnap, paymentsSnap, deletedSnap, configSnap] = await Promise.all([
      db_firestore.collection(COL_CLIENTS).get(),
      db_firestore.collection(COL_PAYMENTS).get(),
      db_firestore.collection(COL_DELETED).get(),
      db_firestore.collection(COL_CONFIG).doc('meta').get(),
    ]);

    _cache = {
      clients:  clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      payments: paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      deleted:  deletedSnap.docs.map(d  => ({ id: d.id, ...d.data() })),
      nextId:   configSnap.exists ? configSnap.data().nextId : 1,
    };

    return _cache;

  } catch (err) {
    console.error('❌ Error cargando Firebase:', err);
    const raw = localStorage.getItem('aquacontrol_db');
    return raw
      ? JSON.parse(raw)
      : { clients: [], deleted: [], payments: [], nextId: 1 };
  }
}

async function saveDB(newData) {
  const old = _cache || { clients: [], deleted: [], payments: [], nextId: 1 };

  // Actualiza cache inmediatamente
  _cache = JSON.parse(JSON.stringify(newData));

  try {
    const batch = db_firestore.batch();

    // ── Clientes activos ──
    const oldClientIds = new Set(old.clients.map(c => c.id));
    const newClientIds = new Set(newData.clients.map(c => c.id));

    for (const client of newData.clients) {
      const ref = db_firestore.collection(COL_CLIENTS).doc(client.id);
      const { id, ...data } = client;
      batch.set(ref, data);
    }

    // Borra de clients los eliminados
    for (const id of oldClientIds) {
      if (!newClientIds.has(id)) {
        batch.delete(db_firestore.collection(COL_CLIENTS).doc(id));
      }
    }

    // ── Pagos: sincroniza todos siempre ──
for (const payment of newData.payments) {
  const ref = db_firestore.collection(COL_PAYMENTS).doc(payment.id);
  const { id, ...data } = payment;
  batch.set(ref, data);
}

    // ── Eliminados: sincroniza todos siempre ──
    const oldDeletedIds = new Set(old.deleted.map(d => d.id));
    const newDeletedIds = new Set(newData.deleted.map(d => d.id));

    // Agrega o actualiza eliminados
    for (const deleted of newData.deleted) {
      const ref = db_firestore.collection(COL_DELETED).doc(deleted.id);
      const { id, ...data } = deleted;
      batch.set(ref, data);
    }

    // Borra de deleted los que se recuperaron
    for (const id of oldDeletedIds) {
      if (!newDeletedIds.has(id)) {
        batch.delete(db_firestore.collection(COL_DELETED).doc(id));
      }
    }

    // ── nextId ──
    batch.set(
      db_firestore.collection(COL_CONFIG).doc('meta'),
      { nextId: newData.nextId }
    );

    await batch.commit();
    localStorage.setItem('aquacontrol_db', JSON.stringify(newData));

  } catch (err) {
    console.error('❌ Error guardando en Firebase:', err);
    localStorage.setItem('aquacontrol_db', JSON.stringify(newData));
    showToast('Sin conexión — guardado localmente', 'error');
  }
}

// Auto-limpieza de eliminados con más de 60 días
async function cleanOldDeleted() {
  try {
    const snap = await db_firestore.collection(COL_DELETED).get();
    if (snap.empty) return;

    const now   = new Date();
    const batch = db_firestore.batch();
    let   dirty = false;

    snap.docs.forEach(doc => {
      const deletedAt = new Date(doc.data().deletedAt);
      const diffDays  = (now - deletedAt) / (1000 * 60 * 60 * 24);
      if (diffDays >= 60) {
        batch.delete(db_firestore.collection(COL_DELETED).doc(doc.id));
        dirty = true;
      }
    });

    if (dirty) {
      await batch.commit();
      _cache = null;
    }
  } catch (err) {
    console.error('Error en limpieza automática:', err);
  }
}

function clearCache() {
  _cache = null;
}