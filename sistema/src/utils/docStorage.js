// Utilitário de persistência robusta para Documentos e Anexos usando IndexedDB com fallback para LocalStorage
const DB_NAME = 'dgautos_docs_db';
const STORE_NAME = 'docs_store';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado'));
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function salvarDocumentosCliente(chave, documentos) {
  if (!chave || !Array.isArray(documentos)) return;
  const key = String(chave).trim();

  // Salvar no IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, documentos, atualizado_em: Date.now() });
    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar documentos no IndexedDB:', err);
  }

  // Backup seguro no localStorage (se couber)
  try {
    localStorage.setItem(`docs_cli_${key}`, JSON.stringify(documentos));
  } catch (err) {
    // QuotaExceeded ignorado pois está salvo no IndexedDB
  }
}

export async function obterDocumentosCliente(chave) {
  if (!chave) return [];
  const key = String(chave).trim();

  // Tentar primeiro IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    const item = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    if (item && Array.isArray(item.documentos) && item.documentos.length > 0) {
      return item.documentos;
    }
  } catch (err) {
    console.warn('Erro ao ler documentos do IndexedDB:', err);
  }

  // Fallback para localStorage
  try {
    const raw = localStorage.getItem(`docs_cli_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

export async function excluirDocumentosCliente(chave) {
  if (!chave) return;
  const key = String(chave).trim();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
  } catch {}
  try {
    localStorage.removeItem(`docs_cli_${key}`);
  } catch {}
}
