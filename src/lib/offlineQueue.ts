// Offline queue management using IndexedDB for sales coach recordings

const DB_NAME = 'salesCoachOffline';
const DB_VERSION = 1;
const STORE_NAME = 'recordingQueue';

export interface QueuedRecording {
  id: string;
  audioBlob: Blob;
  userId: string;
  clientName: string;
  meetingDate: string;
  processType: string;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

let db: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initOfflineDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Add recording to offline queue
export async function addToOfflineQueue(recording: Omit<QueuedRecording, 'id' | 'queuedAt' | 'attempts'>): Promise<void> {
  if (!db) await initOfflineDB();

  const queuedRecording: QueuedRecording = {
    ...recording,
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(queuedRecording);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get all queued recordings
export async function getOfflineQueue(): Promise<QueuedRecording[]> {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Remove recording from queue
export async function removeFromOfflineQueue(id: string): Promise<void> {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Update recording in queue (for retry tracking)
export async function updateQueuedRecording(recording: QueuedRecording): Promise<void> {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(recording);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get queue size
export async function getOfflineQueueSize(): Promise<number> {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clear entire queue
export async function clearOfflineQueue(): Promise<void> {
  if (!db) await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
