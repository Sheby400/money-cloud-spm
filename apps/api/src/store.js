import { randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';

const memory = new Map();
const collectionName = 'moneycloud_demo_transactions';
const useFirestore = () => process.env.STORAGE_DRIVER === 'firestore';

function database() {
  if (!getApps().length) {
    const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    initializeApp({
      credential: credentials ? cert(JSON.parse(credentials)) : applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

export async function listTransactions() {
  if (!useFirestore()) {
    return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const snapshot = await database()
    .collection(collectionName)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return snapshot.docs.map((document) => document.data());
}

export async function createTransaction(data) {
  const item = {
    id: randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  };
  if (useFirestore()) {
    await database().collection(collectionName).doc(item.id).set(item);
  } else {
    memory.set(item.id, item);
  }
  return item;
}

export async function deleteTransaction(id) {
  if (!useFirestore()) return memory.delete(id);

  const reference = database().collection(collectionName).doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return false;

  await reference.delete();
  return true;
}

export function resetMemoryForTests() {
  memory.clear();
}