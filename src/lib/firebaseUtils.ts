import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';

export async function getUserData(uid: string) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return { uid, ...userDoc.data() };
  }
  return null;
}

export function subscribeToUserData(uid: string, callback: (data: any) => void, onError?: (err: any) => void) {
  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    if (snapshot.exists()) {
      callback({ uid, ...snapshot.data() });
    } else {
      callback(null);
    }
  }, (err) => {
    console.error('Error fetching user data:', err);
    if (onError) onError(err);
  });
}

// Subscribe to subcollections
export function subscribeToCollection(uid: string, collectionName: string, callback: (data: any[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, 'users', uid, collectionName), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => {
    console.error(`Error fetching collection ${collectionName}:`, err);
    if (onError) onError(err);
  });
}

export async function doTransfer(uid: string, name: string, amount: number, method: string) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();
  if (data.balance < numAmount) throw new Error('Insufficient balance');

  await updateDoc(userRef, {
    balance: data.balance - numAmount,
    expenses: (data.expenses || 0) + numAmount
  });

  await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `${method} to ${name}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'debit',
    icon: 'ArrowUpRight'
  });
}

export async function doDeposit(uid: string, amount: number, source: string) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();

  await updateDoc(userRef, {
    balance: data.balance + numAmount,
    income: (data.income || 0) + numAmount
  });

  await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `Deposit via ${source}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'credit',
    icon: 'ArrowDownLeft'
  });
}

export async function payBill(uid: string, category: string, provider: string, amount: number) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();
  if (data.balance < numAmount) throw new Error('Insufficient balance');

  await updateDoc(userRef, {
    balance: data.balance - numAmount,
    expenses: (data.expenses || 0) + numAmount
  });

  await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `${category} Bill - ${provider}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'debit',
    icon: 'FileText'
  });
}

export async function createGoal(uid: string, name: string, targetAmount: number) {
  await addDoc(collection(db, 'users', uid, 'goals'), {
    name,
    targetAmount: parseFloat(targetAmount.toString()),
    currentAmount: 0,
    date: new Date().toISOString()
  });
}

export async function fundGoal(uid: string, goalId: string, amount: number, currentGoalAmount: number, goalName: string) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();
  if (data.balance < numAmount) throw new Error('Insufficient balance');

  // charge user
  await updateDoc(userRef, {
    balance: data.balance - numAmount
  });

  // update goal
  const goalRef = doc(db, 'users', uid, 'goals', goalId);
  await updateDoc(goalRef, {
    currentAmount: currentGoalAmount + numAmount
  });

  // add transaction
  await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `Allocated to Goal: ${goalName}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'debit',
    icon: 'Target'
  });
}

export async function updateUserProfile(uid: string, updates: any) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates);
}

// Admin features
export async function getAllUsers() {
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = await Promise.all(usersSnap.docs.map(async (docSnap) => {
    const data = docSnap.data();
    const txSnap = await getDocs(collection(db, 'users', docSnap.id, 'transactions'));
    return { id: docSnap.id, ...data, txCount: txSnap.size };
  }));
  return users;
}

export async function adminUpdateBalance(uid: string, amount: number, action: 'add' | 'remove') {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;
  const currentBalance = userSnap.data().balance || 0;
  const numAmount = parseFloat(amount.toString());
  const newBalance = action === 'add' ? currentBalance + numAmount : currentBalance - numAmount;
  
  await updateDoc(userRef, { balance: newBalance });
  // add admin transaction
  await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: action === 'add' ? 'Admin Credited Funds' : 'Admin Deducted Funds',
    date: new Date().toISOString(),
    amount: numAmount,
    type: action === 'add' ? 'credit' : 'debit',
    icon: 'ShieldAlert'
  });
}

export async function deleteUser(uid: string) {
  // We can only delete the user document, not their Firebase Auth profile (needs Admin SDK),
  // but deleting the generic document is enough to restrict their use of the app.
  await deleteDoc(doc(db, 'users', uid));
}
