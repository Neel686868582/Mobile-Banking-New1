import { db } from './firebase';
import { formatINR } from './utils';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc, where, writeBatch, runTransaction, arrayRemove } from 'firebase/firestore';

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
      if (!data.accountNumber || !data.upiId || data.upiId.endsWith('@sbi')) {
        // Prevent infinite loop if write fails and rolls back locally
        if (!(window as any)._isInitializingUser) {
          (window as any)._isInitializingUser = true;
          const updates: any = {};
          if (!data.accountNumber) {
            updates.accountNumber = Math.floor(100000000000 + Math.random() * 900000000000).toString();
            data.accountNumber = updates.accountNumber; // optimistically patch
          }
          if (!data.upiId || data.upiId.endsWith('@sbi')) {
             (async () => {
                 let baseName = (data.email || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
                 if (!baseName) baseName = `user${Math.floor(Math.random()*10000)}`;
                 let upiIdStr = `${baseName}@rupeepay`;
                 let isUnique = false;
                 for(let i=0; i<5; i++) {
                     const q = query(collection(db, 'users'), where('upiId', '==', upiIdStr));
                     const docs = await getDocs(q);
                     if (docs.empty) {
                        isUnique = true; break;
                     }
                     upiIdStr = `${baseName}${Math.floor(Math.random() * 10000)}@rupeepay`;
                 }
                 if (!isUnique) upiIdStr = `${baseName}${Date.now().toString().substring(6)}@rupeepay`;
                 try {
                   await updateDoc(doc(db, 'users', uid), { upiId: upiIdStr });
                 } catch (err) {
                   console.error("Failed to assign upiId", err);
                 }
             })();
             // optimistically patch so UI doesn't crash until real fetch completes
             data.upiId = `${(data.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}@rupeepay`;
          }
          if (Object.keys(updates).length > 0) {
            updateDoc(doc(db, 'users', uid), updates).catch(console.error);
          }
        } else {
          // If already initializing but still missing, just provide local mock to prevent errors
          if (!data.accountNumber) data.accountNumber = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          if (!data.upiId || data.upiId.endsWith('@sbi')) data.upiId = `${(data.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}@rupeepay`;
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
export function subscribeToCollection(uid: string, collectionName: string, callback: (data: any[]) => void, onError?: (err: any) => void, onAdded?: (data: any) => void) {
  const q = query(collection(db, 'users', uid, collectionName));
  let isFirstLoad = true;
  return onSnapshot(q, (snapshot) => {
    if (onAdded) {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' && !isFirstLoad) {
           onAdded({ id: change.doc.id, ...change.doc.data() });
        }
      });
    }
    isFirstLoad = false;
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    items.sort((a: any, b: any) => {
       const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
       const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
       return timeB - timeA;
    });
    callback(items);
  }, (err) => {
    console.error(`Error fetching collection ${collectionName}:`, err);
    if (onError) onError(err);
  });
}

const generateId = (prefix: string) => `${prefix}${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

export async function addNotification(uid: string, title: string, message: string, type: string = 'info', metadata: any = null) {
  await addDoc(collection(db, 'users', uid, 'notifications'), {
    notificationId: generateId('NOTIF'),
    title,
    message,
    type,
    metadata,
    date: new Date().toISOString(), timestamp: Date.now(),
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

export async function validateUpiId(upiId: string) {
  const q = query(collection(db, 'users'), where('upiId', '==', upiId.trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return { uid: snap.docs[0].id, name: data.name, upiId: data.upiId };
}

export async function getOrCreateVirtualCard(uid: string, name: string, currentCard?: any) {
  if (currentCard && currentCard.cardNumber && currentCard.cardId) return currentCard;
  
  const generateCardNumber = () => {
    const prefix = Math.random() > 0.5 ? '4' : '5';
    let num = prefix;
    for(let i=0; i<15; i++) num += Math.floor(Math.random()*10).toString();
    return num;
  };

  const generateCardId = () => {
    let num = '';
    for(let i=0; i<6; i++) num += Math.floor(Math.random()*10).toString();
    return `RPAY${num}`;
  };

  const cardNumber = currentCard?.cardNumber || generateCardNumber();
  const cvv = currentCard?.cvv || Math.floor(100 + Math.random() * 900).toString();
  const month = currentCard ? currentCard.expiry.split('/')[0] : Math.floor(1 + Math.random() * 12).toString().padStart(2, '0');
  const year = currentCard ? currentCard.expiry.split('/')[1] : (new Date().getFullYear() + Math.floor(3 + Math.random() * 4)).toString().slice(-2);
  const network = currentCard?.network || (cardNumber.startsWith('4') ? 'Visa' : 'Mastercard');
  const cardId = currentCard?.cardId || generateCardId();
  
  const newCard = { cardNumber, name: name || 'User', expiry: `${month}/${year}`, cvv, network, cardId };
  
  await updateDoc(doc(db, 'users', uid), { virtualCard: newCard });
  return newCard;
}

export async function validateVirtualAcc(accNumber: string, ifsc: string) {
  if (ifsc.trim().toUpperCase() !== 'RPAY0001234') return null;
  const q = query(collection(db, 'users'), where('accountNumber', '==', accNumber.trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return { uid: snap.docs[0].id, name: data.name, acc: data.accountNumber };
}

export async function validateVirtualDebitCardId(cardId: string) {
  const q = query(collection(db, 'users'));
  const snap = await getDocs(q);
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.virtualCard && data.virtualCard.cardId === cardId) {
      return { uid: doc.id, name: data.virtualCard.name, balance: data.balance || 0, virtualCard: data.virtualCard };
    }
  }
  return null;
}

export async function requestCardDepositAuth(requesterId: string, requesterName: string, amount: number, amountWithFee: number, targetUserId: string, cardNumber: string, last4: string) {
  const reqRef = doc(collection(db, 'users', targetUserId, 'deposit_requests'));
  const authCode = Math.floor(1000 + Math.random() * 9000).toString();
  
  await setDoc(reqRef, { requestId: generateId('REQ'),
    requesterId,
    requesterName,
    amount,
    amountWithFee,
    cardNumber,
    last4,
    authCode,
    status: 'pending', // pending, approved, rejected, used
    date: new Date().toISOString()
  });

  const notifRef = doc(collection(db, 'users', targetUserId, 'notifications'));
  await setDoc(notifRef, {
    title: 'Deposit Authorization',
    message: `${requesterName} wants to add ₹${amount} using your Virtual Debit Card ending in ${last4}.`,
    date: new Date().toISOString(), timestamp: Date.now(),
    read: false,
    requestId: reqRef.id,
    type: 'deposit_request'
  });
  
  return reqRef.id;
}

export async function submitCardDepositAuth(targetUserId: string, requestId: string, requesterId: string, requesterName: string, targetName: string, amount: number, amountWithFee: number, authCode: string, method: string) {
  // We use runTransaction to prevent duplicate processing
  let txId = '';
  await runTransaction(db, async (transaction) => {
    const reqRef = doc(db, 'users', targetUserId, 'deposit_requests', requestId);
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) throw new Error('Authorization request not found');
    const reqData = reqSnap.data();
    
    if (reqData.status !== 'approved') throw new Error('Request has not been approved or was rejected');
    if (reqData.authCode !== authCode) throw new Error('Invalid authorization code');
    
    const targetUserRef = doc(db, 'users', targetUserId);
    const targetSnap = await transaction.get(targetUserRef);
    const targetData = targetSnap.data() || {};
    
    if ((targetData.balance || 0) < amountWithFee) throw new Error('Cardholder has insufficient balance');
    
    const requesterRef = doc(db, 'users', requesterId);
    const requesterSnap = await transaction.get(requesterRef);
    const requesterData = requesterSnap.data() || {};

    // Do deductions
    transaction.update(targetUserRef, {
      balance: (targetData.balance || 0) - amountWithFee,
      expenses: (targetData.expenses || 0) + amountWithFee
    });

    transaction.update(requesterRef, {
      balance: (requesterData.balance || 0) + amount,
      income: (requesterData.income || 0) + amount
    });

    transaction.update(reqRef, { status: 'used' });

    // Transactions
    const targetTxRef = doc(collection(db, 'users', targetUserId, 'transactions'));
    transaction.set(targetTxRef, { transactionId: generateId('TXN'),
      name: `Deposit authorized for ${requesterName}`,
      date: new Date().toISOString(), timestamp: Date.now(),
      amount: amountWithFee,
      type: 'debit',
      icon: 'CreditCard',
      fromAcc: 'Virtual Debit Card'
    });

    const requesterTxRef = doc(collection(db, 'users', requesterId, 'transactions'));
    txId = requesterTxRef.id;
    transaction.set(requesterTxRef, { transactionId: generateId('TXN'),
      name: `Deposit from ${targetName}'s Card`,
      date: new Date().toISOString(), timestamp: Date.now(),
      amount: amount,
      type: 'credit',
      icon: 'ArrowDownLeft',
      method: method
    });

    // Notifications
    const targetNotifRef = doc(collection(db, 'users', targetUserId, 'notifications'));
    transaction.set(targetNotifRef, { notificationId: generateId('NOTIF'),
      title: 'Virtual Card Debited',
      message: `₹${amountWithFee} debited from your Virtual Debit Card for ${requesterName}.`,
      date: new Date().toISOString(), timestamp: Date.now(),
      read: false
    });
  });
  
  return txId;
}

export async function updateDepositRequestStatus(userId: string, requestId: string, newStatus: 'approved' | 'rejected') {
  const reqRef = doc(db, 'users', userId, 'deposit_requests', requestId);
  await updateDoc(reqRef, { status: newStatus });
  
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return null;
  const data = reqSnap.data();

  // Notify requester
  const notifRef = doc(collection(db, 'users', data.requesterId, 'notifications'));
  await setDoc(notifRef, {
    title: 'Deposit Request',
    message: newStatus === 'approved' 
      ? `Your deposit request was approved. You can now use the authorization code.` 
      : `Your deposit request was rejected.`,
    date: new Date().toISOString(), timestamp: Date.now(),
    read: false
  });
  
  return data;
}

export async function doTransfer(uid: string, name: string, amount: number, method: string, toAcc: string, ifsc?: string) {
  const numAmount = parseFloat(amount.toString());

  const isInternalUpi = method === 'UPI' && toAcc.toLowerCase().endsWith('@rupeepay');
  const isInternalBank = (method === 'IMPS' || method === 'NEFT' || method === 'RTGS') && ifsc?.trim().toUpperCase() === 'RPAY0001234';

  if (isInternalUpi || isInternalBank) {
    let internalTxId = '';
    await runTransaction(db, async (transaction) => {
      const senderRef = doc(db, 'users', uid);
      const senderSnap = await transaction.get(senderRef);
      if (!senderSnap.exists()) throw new Error('Sender not found');
      
      const senderData = senderSnap.data();
      if (senderData.balance < numAmount) throw new Error('Insufficient balance');

      // Find recipient
      let recipientSnaps;
      if (isInternalUpi) {
        const q = query(collection(db, 'users'), where('upiId', '==', toAcc.toLowerCase()));
        recipientSnaps = await getDocs(q); 
      } else {
        const q = query(collection(db, 'users'), where('accountNumber', '==', toAcc.trim()));
        recipientSnaps = await getDocs(q); 
      }
      
      if (recipientSnaps.empty) throw new Error('Recipient not found');
      
      const recipientDoc = recipientSnaps.docs[0];
      const recipientId = recipientDoc.id;
      if (recipientId === uid) throw new Error('Cannot transfer to yourself');

      const recipientRef = doc(db, 'users', recipientId);
      const recipientSnap = await transaction.get(recipientRef);
      const recipientData = recipientSnap.data();

      // Write deductions
      transaction.update(senderRef, {
        balance: senderData.balance - numAmount,
        expenses: (senderData.expenses || 0) + numAmount
      });

      // Write additions
      transaction.update(recipientRef, {
        balance: (recipientData.balance || 0) + numAmount,
        income: (recipientData.income || 0) + numAmount
      });

      // Transaction docs
      const senderTxId = generateId('TXN');
      const senderTxRef = doc(collection(db, 'users', uid, 'transactions'));
      transaction.set(senderTxRef, { transactionId: senderTxId,
        name: `Transfer to ${recipientData.name}`,
        date: new Date().toISOString(), timestamp: Date.now(),
        amount: numAmount,
        type: 'debit',
        icon: 'ArrowUpRight',
        toName: recipientData.name,
        toAcc: toAcc,
        method: method
      });
      internalTxId = senderTxId;

      const recipientTxRef = doc(collection(db, 'users', recipientId, 'transactions'));
      transaction.set(recipientTxRef, { transactionId: generateId('TXN'),
        name: `Received from ${senderData.name}`,
        date: new Date().toISOString(), timestamp: Date.now(),
        amount: numAmount,
        type: 'credit',
        icon: 'ArrowDownLeft',
        fromName: senderData.name,
        fromAcc: isInternalUpi ? (senderData.upiId || 'Unknown') : (senderData.accountNumber || 'Unknown'),
        method: method
      });

      // Notifications
      const senderNotifRef = doc(collection(db, 'users', uid, 'notifications'));
      transaction.set(senderNotifRef, { notificationId: generateId('NOTIF'),
        title: 'Transfer Successful',
        message: `₹${numAmount} sent via ${method} to ${recipientData.name}.`,
        date: new Date().toISOString(), timestamp: Date.now(),
        read: false
      });

      const recipientNotifRef = doc(collection(db, 'users', recipientId, 'notifications'));
      transaction.set(recipientNotifRef, { notificationId: generateId('NOTIF'),
        title: 'Amount Received',
        message: `₹${numAmount} received via ${method} from ${senderData.name}.`,
        date: new Date().toISOString(), timestamp: Date.now(),
        read: false
      });

      // Global UPI Transfers Record (Only for UPI for now to not break existing, or we can make a global transfers table)
      if (isInternalUpi) {
        const globalTxRef = doc(collection(db, 'upi_transfers'));
        transaction.set(globalTxRef, { 
          transactionId: internalTxId,
          amount: numAmount,
          senderUid: uid,
          senderName: senderData.name,
          senderUpiId: senderData.upiId || 'Unknown',
          recipientUid: recipientId,
          recipientName: recipientData.name,
          recipientUpiId: toAcc.toLowerCase(),
          date: new Date().toISOString(), timestamp: Date.now(),
          status: 'SUCCESS'
        });
      }
    });
    return internalTxId;
  }

  // External Transfer
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('User not found');
  const data = userSnap.data();
  if (data.balance < numAmount) throw new Error('Insufficient balance');

  await updateDoc(userRef, {
    balance: data.balance - numAmount,
    expenses: (data.expenses || 0) + numAmount
  });

  const txId = generateId('TXN');
  const txRef = await addDoc(collection(db, 'users', uid, 'transactions'), { transactionId: txId,
    name: `${method} to ${name}`,
    date: new Date().toISOString(), timestamp: Date.now(),
    amount: numAmount,
    type: 'debit',
    icon: 'ArrowUpRight',
    toName: name,
    toAcc: toAcc,
    method: method
  });
  await addNotification(uid, 'Transfer Successful', `Successfully transferred ${formatINR(numAmount)} to ${name} via ${method}.`);
  return txId;
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

  const txData: any = { transactionId: generateId('TXN'),
    name: `Deposit via ${source}`,
    date: new Date().toISOString(), timestamp: Date.now(),
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
  return txData.transactionId;
}

export async function payBill(uid: string, category: string, provider: string, amount: number, paymentMethod: string = 'Internal Balance') {
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

  const txId = generateId('TXN');
  const txRef = await addDoc(collection(db, 'users', uid, 'transactions'), { transactionId: txId,
    name: `${category} Bill - ${provider}`,
    date: new Date().toISOString(), timestamp: Date.now(),
    amount: numAmount,
    type: 'debit',
    icon: 'FileText',
    toName: provider,
    toAcc: `${category} Account`,
    method: paymentMethod
  });
  await addNotification(uid, 'Bill Paid', `Successfully paid ${formatINR(numAmount)} for ${category} (${provider}).`);
  return txId;
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

  const txId = generateId('TXN');
  const txRef = await addDoc(collection(db, 'users', uid, 'transactions'), { transactionId: txId,
    name: `Electricity Bill - ${receiptData.providerName}`,
    date: new Date().toISOString(), timestamp: Date.now(),
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
  return txId;
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
    
    await addDoc(collection(db, 'users', uid, 'transactions'), { transactionId: generateId('TXN'),
      name: `Initial Lock: ${name}`,
      date: new Date().toISOString(), timestamp: Date.now(),
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
    date: new Date().toISOString(), timestamp: Date.now(),
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
    await addDoc(collection(db, 'users', uid, 'transactions'), { transactionId: generateId('TXN'),
      name: `Withdraw Goal: ${goalName}`,
      date: new Date().toISOString(), timestamp: Date.now(),
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

  await addDoc(collection(db, 'users', uid, 'transactions'), { transactionId: generateId('TXN'),
    name: `Allocated to Goal: ${goalName}`,
    date: new Date().toISOString(), timestamp: Date.now(),
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
  await addDoc(collection(db, 'users', uid, 'transactions'), { transactionId: generateId('TXN'),
    name: action === 'add' ? 'Admin Credited Funds' : 'Admin Deducted Funds',
    date: new Date().toISOString(), timestamp: Date.now(),
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

// ==========================================
// GROUP VAULT FEATURES
// ==========================================

export async function createGroupVault(
  uid: string,
  creatorName: string,
  name: string,
  description: string,
  targetAmount: number,
  durationMonths: number,
  mode: 'strict' | 'flexible'
) {
  const lockedUntil = durationMonths > 0 ? new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  const vaultRef = await addDoc(collection(db, 'group_vaults'), {
    name,
    description,
    targetAmount: parseFloat(targetAmount.toString()),
    currentAmount: 0,
    lockedUntil,
    durationMonths,
    mode,
    creatorId: uid,
    createdAt: new Date().toISOString(),
    status: 'active', // active, completed, closed
    memberUids: [uid],
    invitedUids: [],
    type: 'group',
    
    // Top-level explicit fields for easy viewing in Firebase Console
    ownerOfVault: creatorName,
    ownerContribution: 0,
    invitedUsersData: [],
    acceptedUsersData: [creatorName],
    lockinPeriodOfVault: durationMonths > 0 ? `${durationMonths} Months` : 'None',

    members: {
      [uid]: { uid, name: creatorName, joinedAt: new Date().toISOString(), contributed: 0, status: 'active', role: 'creator' }
    },
    timeline: [
      { id: generateId('TL'), date: new Date().toISOString(), action: 'create', userId: uid, userName: creatorName, details: 'Vault Created' }
    ],
    closureTransferApprovals: {}
  });
  return vaultRef.id;
}

export async function verifyUserForInvitation(identifier: string) {
  const usersRef = collection(db, 'users');
  let q = query(usersRef, where('email', '==', identifier));
  let snap = await getDocs(q);
  if (snap.empty) {
    q = query(usersRef, where('upiId', '==', identifier));
    snap = await getDocs(q);
  }
  if (snap.empty) {
    q = query(usersRef, where('accountNumber', '==', identifier));
    snap = await getDocs(q);
  }
  
  if (snap.empty) return null;
  
  const targetUser = snap.docs[0];
  const targetData = targetUser.data();
  return { uid: targetUser.id, name: targetData.name, upiId: targetData.upiId, accountNumber: targetData.accountNumber, email: targetData.email, photoURL: targetData.photoURL };
}

export async function inviteToGroupVault(vaultId: string, inviterUid: string, inviterName: string, targetUid: string, targetName: string, targetEmail?: string, targetUpiId?: string) {
  const vaultRef = doc(db, 'group_vaults', vaultId);
  const vaultSnap = await getDoc(vaultRef);
  if (!vaultSnap.exists()) throw new Error('Vault not found');
  const vaultData = vaultSnap.data();

  if (vaultData.memberUids.includes(targetUid) || (vaultData.invitedUids || []).includes(targetUid)) {
    if ((vaultData.invitedUids || []).includes(targetUid)) throw new Error('Invitation already pending');
    throw new Error('User is already a member of this vault');
  }

  await updateDoc(vaultRef, {
    invitedUids: [...(vaultData.invitedUids || []), targetUid],
    invitedUsersData: [...(vaultData.invitedUsersData || []), targetEmail || targetName],
    [`members.${targetUid}`]: { uid: targetUid, name: targetName, email: targetEmail || '', upiId: targetUpiId || '', status: 'invited', invitedAt: new Date().toISOString(), seenInvitation: false },
    timeline: [...vaultData.timeline, { id: generateId('TL'), date: new Date().toISOString(), action: 'invite', userId: inviterUid, userName: inviterName, details: `Invited ${targetName}` }]
  });

  // Simple Notification
  await addNotification(targetUid, 'Group Vault Invitation', `${inviterName} invited you to join a Group Vault.`, 'info', {
    type: 'vault_invite',
    vaultId: vaultId
  });
}

export async function markInvitationSeen(vaultId: string, uid: string) {
  const vaultRef = doc(db, 'group_vaults', vaultId);
  await updateDoc(vaultRef, {
    [`members.${uid}.seenInvitation`]: true
  });
}

export async function respondToVaultInvite(vaultId: string, uid: string, userName: string, response: 'accept' | 'decline', creatorUid: string) {
  const vaultRef = doc(db, 'group_vaults', vaultId);
  await runTransaction(db, async (transaction) => {
    const vaultDoc = await transaction.get(vaultRef);
    if (!vaultDoc.exists()) throw new Error("Vault not found");
    const data = vaultDoc.data();
    
    if (response === 'accept') {
      const newMembers = { ...data.members };
      const finalName = (userName && userName !== 'User') ? userName : (newMembers[uid].name || 'User');
      newMembers[uid] = { ...newMembers[uid], status: 'active', joinedAt: new Date().toISOString(), contributed: 0, name: finalName };
      transaction.update(vaultRef, {
        memberUids: [...data.memberUids, uid],
        invitedUids: data.invitedUids.filter((id: string) => id !== uid),
        acceptedUsersData: [...(data.acceptedUsersData || []), finalName],
        members: newMembers,
        timeline: [...data.timeline, { id: generateId('TL'), date: new Date().toISOString(), action: 'join', userId: uid, userName, details: 'Joined the vault' }]
      });
      addNotification(creatorUid, 'Vault Invitation Accepted', `${userName} accepted your invitation.`, 'success');
    } else {
      const newMembers = { ...data.members };
      delete newMembers[uid];
      transaction.update(vaultRef, {
        invitedUids: data.invitedUids.filter((id: string) => id !== uid),
        members: newMembers,
        timeline: [...data.timeline, { id: generateId('TL'), date: new Date().toISOString(), action: 'decline', userId: uid, userName, details: 'Declined invitation' }]
      });
      addNotification(creatorUid, 'Vault Invitation Declined', `${userName} declined your invitation.`, 'info');
    }
  });
}

export async function contributeToGroupVault(uid: string, vaultId: string, amount: number) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const vaultRef = doc(db, 'group_vaults', vaultId);

  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const vaultDoc = await transaction.get(vaultRef);
    
    if (!userDoc.exists() || !vaultDoc.exists()) throw new Error("Document not found");

    const userData = userDoc.data();
    const vaultData = vaultDoc.data();

    if (userData.balance < numAmount) throw new Error("Insufficient balance");
    if (vaultData.status !== 'active') throw new Error("Vault is not active");
    if (vaultData.members[uid]?.status !== 'active') throw new Error("You must accept the invitation before contributing");

    const userName = vaultData.members[uid]?.name || 'User';
    const newMembers = { ...vaultData.members };
    newMembers[uid] = { ...newMembers[uid], contributed: (newMembers[uid].contributed || 0) + numAmount, name: userName };

    transaction.update(userRef, { balance: userData.balance - numAmount, expenses: (userData.expenses || 0) + numAmount });
    
    const newVaultAmount = vaultData.currentAmount + numAmount;
    let status = vaultData.status;
    let completionTimeline: any[] = [];
    
    // Check milestones
    const oldProgress = (vaultData.currentAmount / vaultData.targetAmount) * 100;
    const newProgress = (newVaultAmount / vaultData.targetAmount) * 100;
    
    if (newProgress >= 25 && oldProgress < 25) completionTimeline.push({ id: generateId('TL'), date: new Date().toISOString(), action: 'milestone', userId: 'system', userName: 'System', details: 'Reached 25% of Target!' });
    if (newProgress >= 50 && oldProgress < 50) completionTimeline.push({ id: generateId('TL'), date: new Date().toISOString(), action: 'milestone', userId: 'system', userName: 'System', details: 'Reached 50% of Target!' });
    if (newProgress >= 75 && oldProgress < 75) completionTimeline.push({ id: generateId('TL'), date: new Date().toISOString(), action: 'milestone', userId: 'system', userName: 'System', details: 'Reached 75% of Target!' });
    
    if (newVaultAmount >= vaultData.targetAmount && vaultData.currentAmount < vaultData.targetAmount) {
      status = 'completed';
      completionTimeline.push({ id: generateId('TL'), date: new Date().toISOString(), action: 'complete', userId: 'system', userName: 'System', details: 'Target Achieved!' });
      
      // Send completion notifications to all active members
      vaultData.memberUids.forEach((memberUid: string) => {
        addNotification(memberUid, 'Group Savings Champion', `Successfully Completed: ${vaultData.name}. Generating Rewards...`, 'success');
      });
    }

    transaction.update(vaultRef, {
      currentAmount: newVaultAmount,
      members: newMembers,
      status,
      timeline: [...vaultData.timeline, { id: generateId('TL'), date: new Date().toISOString(), action: 'contribute', userId: uid, userName, details: `Contributed ₹${formatINR(numAmount)}` }, ...completionTimeline]
    });

    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    transaction.set(txRef, {
      transactionId: generateId('TXN'),
      name: `Vault Contribution: ${vaultData.name}`,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      amount: numAmount,
      type: 'debit',
      icon: 'Target'
    });
    
    // Notify all other members
    vaultData.memberUids.forEach((memberUid: string) => {
       if (memberUid !== uid) {
          addNotification(memberUid, `Vault Contribution`, `${userName} contributed ${formatINR(numAmount)}.`, 'info');
       }
    });
  });
}

export function calculateGroupVaultRewards(vaultInfo: { targetAmount: number; currentAmount: number; durationMonths: number; mode: string; memberCount: number; }) {
  const membersCount = vaultInfo.memberCount || 1;
  const targetAmount = vaultInfo.targetAmount || 0;
  
  let baseRewardPercent = 0.03;
  if (targetAmount >= 500000) baseRewardPercent = 0.08;
  else if (targetAmount >= 100000) baseRewardPercent = 0.06;
  else if (targetAmount >= 50000) baseRewardPercent = 0.04;

  let memberBonusPercent = 0;
  if (membersCount >= 10) memberBonusPercent = 0.03;
  else if (membersCount >= 6) memberBonusPercent = 0.02;
  else if (membersCount >= 4) memberBonusPercent = 0.015;
  else if (membersCount >= 2) memberBonusPercent = 0.01;
  else memberBonusPercent = 0;

  const totalBasePercent = baseRewardPercent + memberBonusPercent;

  let durationBonus = 0;
  const durationMonths = vaultInfo.durationMonths || 0;
  if (durationMonths >= 36) durationBonus = 0.75;
  else if (durationMonths >= 24) durationBonus = 0.50;
  else if (durationMonths >= 12) durationBonus = 0.25;
  else if (durationMonths >= 6) durationBonus = 0.10;

  let strictBonus = 0;
  if (vaultInfo.mode === 'strict') strictBonus = 0.50;

  const finalEstPool = targetAmount * totalBasePercent * (1 + durationBonus + strictBonus);
  const currentRewardPool = (vaultInfo.currentAmount || 0) * totalBasePercent * (1 + durationBonus + strictBonus);
  const teamCompletionBonus = 1000;

  return {
    estRewardPool: finalEstPool > 0 ? finalEstPool + teamCompletionBonus : 0,
    currentRewardPool: currentRewardPool, // Team completion is applied at completion
    memberMultiplier: 1 + (memberBonusPercent / baseRewardPercent), // For backwards compatibility
    durationBonus,
    strictBonus,
    baseRewardPercent: totalBasePercent,
    teamCompletionBonus
  };
}

export async function withdrawFromGroupVault(uid: string, vaultId: string, amount: number) {
  const numAmount = parseFloat(amount.toString());
  const userRef = doc(db, 'users', uid);
  const vaultRef = doc(db, 'group_vaults', vaultId);

  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const vaultDoc = await transaction.get(vaultRef);
    
    if (!userDoc.exists() || !vaultDoc.exists()) throw new Error("Document not found");

    const userData = userDoc.data();
    const vaultData = vaultDoc.data();

    const isPastDueDate = !vaultData.lockedUntil || Date.now() >= new Date(vaultData.lockedUntil).getTime();
    const totalGrossContributions = (Object.values(vaultData.members || {}) as any[]).reduce((acc: number, m: any) => acc + (m.contributed || 0), 0) as number;
    const isCompleted = isPastDueDate;

    if (!isCompleted && vaultData.mode === 'strict') throw new Error("Early withdrawal is not allowed in Strict Vault.");
    
    const contributedAmount = vaultData.members[uid]?.contributed || 0;
    const previouslyWithdrawn = vaultData.members[uid]?.withdrawn || 0;
    const maxWithdrawable = contributedAmount - previouslyWithdrawn;

    if (maxWithdrawable < numAmount) throw new Error("Cannot withdraw more than available balance");

    let penalty = 0;
    let reward = 0;
    let returned = numAmount;

    let totalRewardPoolToDistribute = 0;
    const memberCount = Object.keys(vaultData.members || {}).length;
    
    if (!isCompleted && vaultData.mode === 'flexible') {
      penalty = numAmount * 0.02; // 2% penalty
      returned = numAmount - penalty;
    } else if (isCompleted) {
      if (!vaultData.members[uid]?.withdrawnEarly) {
        const rewardsInfo = calculateGroupVaultRewards({
          targetAmount: vaultData.targetAmount,
          currentAmount: totalGrossContributions,
          durationMonths: vaultData.durationMonths,
          mode: vaultData.mode,
          memberCount
        });

        const totalMembers = Object.keys(vaultData.members || {}).length;
        const eligibleMembers = Object.values(vaultData.members as any).filter((m: any) => !m.withdrawnEarly).length;
        const everyoneEligible = totalMembers === eligibleMembers;

        totalRewardPoolToDistribute = rewardsInfo.currentRewardPool;
        if (everyoneEligible) {
           totalRewardPoolToDistribute += rewardsInfo.teamCompletionBonus;
        }

        const totalEligibleContributions = (Object.values(vaultData.members || {}) as any[]).reduce((acc: number, m: any) => {
           if (!m.withdrawnEarly) return acc + (m.contributed || 0);
           return acc;
        }, 0) as number;

        if (totalEligibleContributions > 0) {
           const sharePercent = numAmount / totalEligibleContributions;
           reward = totalRewardPoolToDistribute * sharePercent;
        }

        returned = numAmount + reward;
      }
    }

    const userName = vaultData.members[uid]?.name || 'User';
    const newMembers = { ...vaultData.members };
    newMembers[uid] = { ...newMembers[uid] };
    newMembers[uid].withdrawn = (newMembers[uid].withdrawn || 0) + numAmount;
    if (penalty > 0) {
      newMembers[uid].penaltyPaid = (newMembers[uid].penaltyPaid || 0) + penalty;
      newMembers[uid].withdrawnEarly = true; // lose reward eligibility
    }
    if (reward > 0) {
      newMembers[uid].rewardClaimed = (newMembers[uid].rewardClaimed || 0) + reward;
    }

    let timelineDetails = `Withdrew ₹${formatINR(numAmount)}`;
    if (penalty > 0) timelineDetails += ` (2% penalty)`;
    if (reward > 0) timelineDetails += ` + ₹${formatINR(reward)} Reward!`;

    // Only deduct numAmount from vault current amount, not the reward (since reward comes from platform, not from vault contributions)
    transaction.update(userRef, { balance: userData.balance + returned });
    transaction.update(vaultRef, {
      currentAmount: vaultData.currentAmount - numAmount,
      members: newMembers,
      timeline: [...vaultData.timeline, { id: generateId('TL'), date: new Date().toISOString(), action: 'withdraw', userId: uid, userName, details: timelineDetails }]
    });

    const txRef = doc(collection(db, 'users', uid, 'transactions'));
    transaction.set(txRef, {
      transactionId: generateId('TXN'),
      name: `Vault Withdrawal: ${vaultData.name}`,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      amount: returned,
      type: 'credit',
      icon: 'Target'
    });
  });
}

export async function leaveGroupVault(vaultId: string, uid: string) {
  const vaultRef = doc(db, 'group_vaults', vaultId);
  const vaultSnap = await getDoc(vaultRef);
  if (!vaultSnap.exists()) throw new Error("Vault not found");
  const vaultData = vaultSnap.data();

  if (vaultData.creatorId === uid) throw new Error("Creator cannot leave vault. They must delete it instead.");
  
  const memberRecord = vaultData.members?.[uid] || {};
  const currentContribution = (memberRecord.contributed || 0) - (memberRecord.withdrawn || 0);

  if (currentContribution > 0) throw new Error("You cannot leave vault with active funds.");

  // Remove from memberUids so it stops showing up in their feed
  await updateDoc(vaultRef, {
    memberUids: arrayRemove(uid)
  });
}

export async function deleteGroupVault(vaultId: string, uid: string) {
  const vaultRef = doc(db, 'group_vaults', vaultId);
  const vaultSnap = await getDoc(vaultRef);
  if (!vaultSnap.exists()) throw new Error("Vault not found");
  const vaultData = vaultSnap.data();

  if (vaultData.creatorId !== uid) throw new Error("Only the creator can delete this vault");
  if (vaultData.currentAmount > 0) throw new Error("Vault deletion disabled. The vault still has funds.");

  await deleteDoc(vaultRef);
}

export function subscribeToGroupVaults(uid: string, callback: (data: any[]) => void) {
  let memberVaults: any[] = [];
  let invitedVaults: any[] = [];
  
  const updateFrontend = () => {
    const map = new Map();
    memberVaults.forEach(v => map.set(v.id, v));
    invitedVaults.forEach(v => map.set(v.id, v));
    callback(Array.from(map.values()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const q = query(collection(db, 'group_vaults'), where('memberUids', 'array-contains', uid));
  const unsub1 = onSnapshot(q, (snapshot) => {
    memberVaults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateFrontend();
  });
  
  const q2 = query(collection(db, 'group_vaults'), where('invitedUids', 'array-contains', uid));
  const unsub2 = onSnapshot(q2, (snapshot) => {
    invitedVaults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateFrontend();
  });
  
  return () => { unsub1(); unsub2(); };
}


