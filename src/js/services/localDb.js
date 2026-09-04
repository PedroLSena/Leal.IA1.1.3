/**
 * Leal.ai — Banco de dados local (IndexedDB) para persistência de cadastros.
 *
 * Estratégia de persistência do portal:
 *  1) Se o backend Express/PostgreSQL estiver disponível e o usuário autenticado,
 *     o cadastro é gravado via API (tabela `users` / `organizations`).
 *  2) Independentemente disso, o registro é sempre gravado no banco local
 *     (IndexedDB `leal_ai_db`, store `accounts`), garantindo que o Painel
 *     Pessoal funcione mesmo sem servidor, e servindo de fila de sincronização.
 */

const DB_NAME = 'leal_ai_db';
const DB_VERSION = 1;
const STORE = 'accounts';
const LS_FALLBACK = 'leal_ai_accounts_fallback';
const CURRENT_KEY = 'leal_current_account_id';

function hasIDB() {
  return typeof indexedDB !== 'undefined';
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Fallback localStorage (navegadores sem IndexedDB) ---------- */
function lsAll() {
  try {
    return JSON.parse(localStorage.getItem(LS_FALLBACK) || '[]');
  } catch {
    return [];
  }
}
function lsWrite(rows) {
  localStorage.setItem(LS_FALLBACK, JSON.stringify(rows));
}

export const localDb = {
  async save(record) {
    const row = {
      id: record.id || (crypto.randomUUID ? crypto.randomUUID() : 'acc_' + Date.now()),
      createdAt: record.createdAt || new Date().toISOString(),
      syncedWithApi: !!record.syncedWithApi,
      ...record,
    };
    row.id = row.id || 'acc_' + Date.now();

    if (!hasIDB()) {
      const rows = lsAll().filter((r) => r.id !== row.id);
      rows.push(row);
      lsWrite(rows);
      return row;
    }

    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(row);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return row;
  },

  async list() {
    if (!hasIDB()) return lsAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const db = await openDb();
    const rows = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async get(id) {
    if (!id) return null;
    if (!hasIDB()) return lsAll().find((r) => r.id === id) || null;
    const db = await openDb();
    const row = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return row;
  },

  async remove(id) {
    if (!hasIDB()) {
      lsWrite(lsAll().filter((r) => r.id !== id));
      return;
    }
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  setCurrentId(id) {
    try {
      localStorage.setItem(CURRENT_KEY, id);
    } catch {
      /* ignore */
    }
  },
  getCurrentId() {
    try {
      return localStorage.getItem(CURRENT_KEY);
    } catch {
      return null;
    }
  },
};

export default localDb;
