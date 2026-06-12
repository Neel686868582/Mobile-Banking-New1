import { db } from './firebase';
import { formatINR } from './utils';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';

export async function getUserData(uid: string) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return { uid, ...userDoc.data() };
  }
  return null;
}

export function subscribeToUserData(uid: string, callback: (data: any) => void, onError?: (err: any) => void) {
  return onSnapshot(doc(db, 'users', uid), async (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (!data.accountNumber || !data.upiId) {
        // Prevent infinite loop if write fails and rolls back locally
        if (!(window as any)._isInitializingUser) {
          (window as any)._isInitializingUser = true;
          const updates: any = {};
          if (!data.accountNumber) {
            updates.accountNumber = Math.floor(100000000000 + Math.random() * 900000000000).toString();
            data.accountNumber = updates.accountNumber; // optimistically patch
          }
          if (!data.upiId) {
            updates.upiId = `${Math.random().toString(36).substring(2, 8)}@sbi`;
            data.upiId = updates.upiId; // optimistically patch
          }
          updateDoc(doc(db, 'users', uid), updates).catch(console.error);
        } else {
          // If already initializing but still missing, just provide local mock to prevent errors
          if (!data.accountNumber) data.accountNumber = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          if (!data.upiId) data.upiId = `${Math.random().toString(36).substring(2, 8)}@sbi`;
        }
      }
      callback({ uid, ...data });
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

export async function addNotification(uid: string, title: string, message: string) {
  await addDoc(collection(db, 'users', uid, 'notifications'), {
    title,
    message,
    date: new Date().toISOString(),
    read: false
  });
}

export async function markAllNotificationsRead(uid: string, notifications: any[]) {
  const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
  for (const id of unreadIds) {
    if (id) {
      await updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true });
    }
  }
}

export async function doTransfer(uid: string, name: string, amount: number, method: string, toAcc: string) {
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

  const txRef = await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `${method} to ${name}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'debit',
    icon: 'ArrowUpRight',
    toName: name,
    toAcc: toAcc,
    method: method
  });
  await addNotification(uid, 'Transfer Successful', `Successfully transferred ${formatINR(numAmount)} to ${name} via ${method}.`);
  return txRef.id;
}

export async function doDeposit(uid: string, amount: number, source: string, metadata?: any) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();

  await updateDoc(userRef, {
    balance: data.balance + numAmount,
    income: (data.income || 0) + numAmount
  });

  const txData: any = {
    name: `Deposit via ${source}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'credit',
    icon: 'ArrowDownLeft',
    toName: 'Self',
    toAcc: 'Internal',
    method: source
  };
  
  if (metadata) {
    txData.metadata = metadata;
  }

  const txRef = await addDoc(collection(db, 'users', uid, 'transactions'), txData);
  await addNotification(uid, 'Deposit Successful', `Successfully deposited ${formatINR(numAmount)} via ${source}.`);
  return txRef.id;
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

  const txRef = await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `${category} Bill - ${provider}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'debit',
    icon: 'FileText',
    toName: provider,
    toAcc: `${category} Account`,
    method: 'Internal Balance'
  });
  await addNotification(uid, 'Bill Paid', `Successfully paid ${formatINR(numAmount)} for ${category} (${provider}).`);
  return txRef.id;
}

export async function payElectricityBill(uid: string, receiptData: any, amount: number) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();
  
  if (data.balance < numAmount) throw new Error('Insufficient bank balance');

  await updateDoc(userRef, {
    balance: data.balance - numAmount,
    expenses: (data.expenses || 0) + numAmount
  });

  const txRef = await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `Electricity Bill - ${receiptData.providerName}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'debit',
    icon: 'Zap',
    toName: receiptData.providerName,
    toAcc: receiptData.consumerNumber,
    method: receiptData.paymentMethod,
    // Store specific metadata for receipt rendering in History page
    electricityBillDetails: {
      providerName: receiptData.providerName,
      consumerName: receiptData.consumerName,
      consumerNumber: receiptData.consumerNumber,
      billingMonth: receiptData.billingMonth,
      dueDate: receiptData.dueDate,
      status: 'Paid'
    }
  });

  await addNotification(uid, 'Electricity Bill Paid', `Successfully paid ${formatINR(numAmount)} to ${receiptData.providerName}.`);
  return txRef.id;
}

export async function createGoal(
  uid: string, 
  name: string, 
  targetAmount: number, 
  lockAmount: number, 
  lockMonths: number, 
  category: string, 
  mode: 'strict' | 'flexible'
) {
  const lockedUntil = lockMonths > 0 ? new Date(Date.now() + lockMonths * 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  
  const baseInterest = 0.04;
  const strictBonus = mode === 'strict' ? 0.02 : 0;
  const durationMultiplier = (lockMonths || 0) / 12;
  const estimatedBonus = parseFloat(lockAmount.toString()) * (baseInterest + strictBonus) * durationMultiplier;

  if (lockAmount > 0) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    const data = userSnap.data();
    if (data.balance < lockAmount) throw new Error('Insufficient balance to lock initial amount');
    
    await updateDoc(userRef, {
      balance: data.balance - lockAmount
    });
    
    await addDoc(collection(db, 'users', uid, 'transactions'), {
      name: `Initial Lock: ${name}`,
      date: new Date().toISOString(),
      amount: lockAmount,
      type: 'debit',
      icon: 'Target',
      toName: `Goal: ${name}`,
      toAcc: 'Savings Account',
      method: lockedUntil ? `Goal Allocation (Locked until ${new Date(lockedUntil).toLocaleDateString()})` : 'Goal Allocation'
    });
  }

  await addDoc(collection(db, 'users', uid, 'goals'), {
    name,
    targetAmount: parseFloat(targetAmount.toString()),
    currentAmount: parseFloat(lockAmount.toString()),
    lockedUntil,
    lockMonths,
    category,
    mode,
    date: new Date().toISOString(),
    bonusEligible: true,
    estimatedBonus,
    lastContribution: new Date().toISOString()
  });

  await addNotification(uid, 'Goal Created', `Created saving goal "${name}" with target ${formatINR(targetAmount)}.`);
}

export async function withdrawGoal(
  uid: string, 
  goalId: string, 
  totalWithdrawn: number, 
  goalName: string,
  mode: string,
  lockedAmount: number,
  penaltyApplied: number,
  bonusEarned: number,
  unlockedEarly: boolean
) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();

  // Give money back
  await updateDoc(userRef, {
    balance: data.balance + totalWithdrawn
  });

  // Instead of deleting, mark it as withdrawn to keep history
  const goalRef = doc(db, 'users', uid, 'goals', goalId);
  await updateDoc(goalRef, {
    status: 'withdrawn',
    withdrawnAt: new Date().toISOString(),
    totalWithdrawn,
    penaltyApplied,
    bonusEarned,
    unlockedEarly
  });

  if (totalWithdrawn > 0) {
    await addDoc(collection(db, 'users', uid, 'transactions'), {
      name: `Withdraw Goal: ${goalName}`,
      date: new Date().toISOString(),
      amount: totalWithdrawn,
      type: 'credit',
      icon: 'Target',
      toName: 'Self',
      toAcc: 'Main Balance',
      method: 'Goal Withdrawal'
    });
  }
  await addNotification(uid, 'Goal Withdrawn', `Successfully withdrew ${formatINR(totalWithdrawn)} from goal "${goalName}".`);
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
  const goalSnap = await getDoc(goalRef);
  if (!goalSnap.exists()) throw new Error('Goal not found');
  const goalData = goalSnap.data();

  const baseInterest = 0.04;
  const strictBonus = goalData.mode === 'strict' ? 0.02 : 0;
  const durationMultiplier = (goalData.lockMonths || 0) / 12;
  const estimatedBonus = (currentGoalAmount + numAmount) * (baseInterest + strictBonus) * durationMultiplier;

  await updateDoc(goalRef, {
    currentAmount: currentGoalAmount + numAmount,
    estimatedBonus
  });

  await addDoc(collection(db, 'users', uid, 'transactions'), {
    name: `Allocated to Goal: ${goalName}`,
    date: new Date().toISOString(),
    amount: numAmount,
    type: 'debit',
    icon: 'Target',
    toName: `Goal: ${goalName}`,
    toAcc: 'Savings Account',
    method: 'Goal Allocation'
  });
  await addNotification(uid, 'Goal Funded', `Added ${formatINR(numAmount)} to goal "${goalName}".`);
}

export async function updateUserProfile(uid: string, updates: any) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const current = userSnap.data();
    const next = { ...current, ...updates };
    if (next.twoFactorEnabled) {
      if (next.require2FAForLogin !== false && next.require2FAForTransactions === true) {
        updates.twoFactorStatus = "For both Login and Transactions";
      } else if (next.require2FAForLogin !== false) {
        updates.twoFactorStatus = "For Login only";
      } else if (next.require2FAForTransactions === true) {
        updates.twoFactorStatus = "For Transactions only";
      } else {
        updates.twoFactorStatus = "Enabled but not active for any action";
      }
    } else {
      updates.twoFactorStatus = "Off";
    }
  }
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
