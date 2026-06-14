import { db } from './firebase';
import { formatINR } from './utils';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc, where, writeBatch, runTransaction } from 'firebase/firestore';

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

export async function addNotification(uid: string, title: string, message: string) {
  await addDoc(collection(db, 'users', uid, 'notifications'), {
    notificationId: generateId('NOTIF'),
    title,
    message,
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
        transaction.set(globalTxRef, { transactionId: generateId('TXN'),
          transactionId: senderTxRef.id,
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
