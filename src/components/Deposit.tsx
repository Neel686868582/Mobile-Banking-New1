import React, { useState, useEffect } from 'react';
import { formatINR } from '../lib/utils';
import { ArrowDownToLine, CheckCircle2, FileText, Download, Wallet, CreditCard } from 'lucide-react';
import { doDeposit, validateVirtualDebitCardId, requestCardDepositAuth, submitCardDepositAuth } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import * as htmlToImage from 'html-to-image';
import { MfaModal } from './MfaModal';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function Deposit({ user, userData, accountNumber, upiId, balance, transactions, onComplete }: { user: string, userData?: any, accountNumber?: string, upiId?: string, balance: number, transactions: any[], onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  const [amount, setAmount] = useState<string>('');
  const [source, setSource] = useState<string>('UPI');
  const [remarks, setRemarks] = useState<string>('');
  
  const [cardId, setCardId] = useState('');
  
  const [successData, setSuccessData] = useState<{ amount: number, txId: string, method: string, date: string, last4?: string } | null>(null);
  const [showMfa, setShowMfa] = useState(false);

  const [authRequestId, setAuthRequestId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [cardNetwork, setCardNetwork] = useState<string>('');
  const [cardLast4, setCardLast4] = useState<string>('');
  const [authCode, setAuthCode] = useState('');
  const [showAuthCodeModal, setShowAuthCodeModal] = useState(false);
  const [cardValidationStatus, setCardValidationStatus] = useState<{ isChecking: boolean, error?: string, verifiedTargetName?: string }>({ isChecking: false });

  const lastDeposit = transactions?.find(t => t.type === 'credit');
  const quickAmounts = [500, 1000, 5000, 10000];

  const getChargesInfo = (method: string) => {
    switch(method) {
      case 'UPI': return { time: 'Instant', fee: 0 };
      case 'Debit Card': return { time: 'Instant', fee: 12 };
      default: return { time: 'Instant', fee: 0 };
    }
  };

  const currentInfo = getChargesInfo(source);
  const numAmount = Number(amount) || 0;

  const isCardFormValid = source === 'Debit Card' ? !!targetUserId : true;

  useEffect(() => {
    if (!targetUserId || !authRequestId) return;
    const unsub = onSnapshot(doc(db, 'users', targetUserId, 'deposit_requests', authRequestId), (snap) => {
      if (snap.exists() && snap.data().status === 'rejected') {
         setShowAuthCodeModal(false);
         setLoading(false);
         setAuthRequestId(null);
      }
    });
    return () => unsub();
  }, [targetUserId, authRequestId]);

  React.useEffect(() => {
    let isMounted = true;
    const verifyCard = async () => {
       if (source !== 'Debit Card') return;
       if (cardId.length >= 8) { // assuming RPAYxxxx
         setCardValidationStatus({ isChecking: true });
         try {
           const target = await validateVirtualDebitCardId(cardId);
           if (!isMounted) return;
           if (target) {
              if (target.uid === user) {
                setCardValidationStatus({ isChecking: false, error: "✗ You cannot use your own Virtual Debit Card." });
                setTargetUserId(null);
                setTargetName(null);
              } else {
                setCardValidationStatus({ isChecking: false, verifiedTargetName: target.name });
                setTargetUserId(target.uid);
                setTargetName(target.name);
                if (target.virtualCard) {
                   setCardNetwork(target.virtualCard.network);
                   setCardLast4(target.virtualCard.cardNumber.slice(-4));
                }
              }
           } else {
              setCardValidationStatus({ isChecking: false, error: "✗ Invalid Card ID / Not Found" });
              setTargetUserId(null);
              setTargetName(null);
           }
         } catch(e) {
           if (isMounted) setCardValidationStatus({ isChecking: false, error: "✗ Verification failed" });
         }
       } else {
         setCardValidationStatus({ isChecking: false });
         setTargetUserId(null);
         setTargetName(null);
       }
    };
    const timer = setTimeout(verifyCard, 600);
    return () => { isMounted = false; clearTimeout(timer); };
  }, [cardId, source, user]);

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (numAmount <= 0) {
      setMsg({ text: 'Please enter a valid amount', type: 'error' });
      return;
    }

    if (source === 'Debit Card' && !targetUserId) {
      setMsg({ text: 'Please enter valid verified card details', type: 'error' });
      return;
    }

    if (userData?.twoFactorEnabled && userData?.require2FAForTransactions && !showMfa && e) {
      setShowMfa(true);
      return;
    }

    setLoading(true);
    setMsg({ text: '', type: '' });

    try {
      if (source === 'Debit Card' && targetUserId) {
         // Create auth request
         const reqId = await requestCardDepositAuth(user, userData.name || 'User', numAmount, numAmount + currentInfo.fee, targetUserId, cardId, cardLast4);
         setAuthRequestId(reqId);
         setShowAuthCodeModal(true);
      } else {
         // Regular UPI or other
         let metadata: any = undefined;
         const txId = await doDeposit(user, numAmount, source, metadata);
         await new Promise(r => setTimeout(r, 2000));
         setSuccessData({
           amount: numAmount,
           txId,
           method: source,
           date: new Date().toLocaleString()
         });
         toast.success("Deposit Completed Successfully!");
         resetForm();
      }
    } catch (err: any) {
      setMsg({ text: err.message || 'Deposit failed', type: 'error' });
    } finally {
      setLoading(false);
      setShowMfa(false);
    }
  };

  const handleAuthCodeSubmit = async () => {
     if (!authCode || authCode.length !== 4) {
       toast.error('Enter 4-digit code');
       return;
     }

     setLoading(true);
     try {
       const finalSource = cardNetwork ? `${cardNetwork} Debit Card` : 'Debit Card';
       const txId = await submitCardDepositAuth(targetUserId!, authRequestId!, user, userData.name || 'User', targetName || 'User', numAmount, numAmount + currentInfo.fee, authCode, finalSource);
       
       setSuccessData({
         amount: numAmount,
         txId,
         method: finalSource,
         date: new Date().toLocaleString(),
         last4: cardLast4
       });
       toast.success("Deposit Completed Successfully!");
       resetForm();
       setShowAuthCodeModal(false);
     } catch (err: any) {
       toast.error(err.message || 'Authorization failed');
     } finally {
       setLoading(false);
     }
  };

  const resetForm = () => {
    setAmount('');
    setRemarks('');
    setCardId('');
    setAuthRequestId(null);
    setAuthCode('');
  };

  const handleDownloadReceipt = async () => {
    if (!successData) return;
    try {
      const element = document.getElementById('receipt-content-deposit');
      if (!element) return;
      
      const dataUrl = await htmlToImage.toJpeg(element, { 
        backgroundColor: '#16191F',
        pixelRatio: 2
      });
      
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `deposit_receipt_${successData.txId}.png`;
      a.click();
      toast.success("Receipt downloaded successfully!");
    } catch(err: any) {
      toast.error(`Failed to download receipt: ${err?.message || "Unknown error"}`);
    }
  };

  if (successData) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          className="bg-[#16191F] border border-green-500/30 rounded-3xl p-8 shadow-2xl shadow-green-500/10 text-center relative overflow-hidden"
        >
          <div id="receipt-content-deposit" className="p-8 pb-4 relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
            <div className="mt-2 mb-6">
              <h1 className="text-xl font-bold text-gray-300">MOBILE BANKING</h1>
            </div>
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2">{formatINR(successData.amount)}</h2>
            <p className="text-green-400 font-medium mb-8">Deposited Successfully</p>
            
            <div className="bg-[#0A0B0D] rounded-2xl p-6 mb-2 text-sm text-left border border-white/5 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Transaction ID</span>
                <span className="text-white font-mono">{successData.txId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date & Time</span>
                <span className="text-white">{successData.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method</span>
                <span className="text-white">{successData.method} {successData.last4 ? `(ends in ${successData.last4})` : ''}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <button 
              onClick={handleDownloadReceipt}
              className="flex-1 bg-[#232730] hover:bg-[#2A2F3A] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5 text-blue-400" /> Download Receipt
            </button>
            <button 
              onClick={() => { setSuccessData(null); onComplete(); }}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-10 p-4 pb-24 md:pb-4">
      <div className="mb-6">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><ArrowDownToLine className="text-blue-400" /> Deposit Funds</h2>
        <p className="text-gray-500">Add money to your account securely.</p>
      </div>

      {/* 1. Current Balance Card */}
      <div className="bg-gradient-to-br from-[#16191F] to-[#1A1D24] border border-white/5 rounded-3xl p-6 mb-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Wallet className="w-24 h-24 text-white" />
        </div>
        <div className="relative z-10">
          <p className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Current Balance</p>
          <h3 className="text-3xl font-bold text-white mb-4">{formatINR(balance)}</h3>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 border-t border-white/10 pt-4 mt-2">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Number</p>
              <p className="text-sm text-gray-300 font-mono flex items-center gap-2">
                <span className="tracking-[0.2em]">XXXX</span> {accountNumber ? accountNumber.slice(-4) : '4821'}
              </p>
            </div>
            {lastDeposit && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Last Deposit</p>
                <p className="text-sm text-green-400 font-medium">{formatINR(lastDeposit.amount)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Deposit Source</label>
            <select 
              name="source" 
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-4 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none text-white font-medium shadow-inner mb-4"
            >
              <option value="UPI">UPI (Receive via RupeePay)</option>
              <option value="Debit Card">Debit Card</option>
            </select>
          </div>
          
          {source === 'UPI' && (
            <div className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-8 mb-4 flex flex-col items-center justify-center space-y-6">
               <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                 <ArrowDownToLine className="w-10 h-10 text-blue-400" />
               </div>
               <div className="text-center">
                 <h3 className="text-xl text-white font-medium mb-1">Receive Money</h3>
                 <p className="text-gray-400 text-sm">
                   Share your RupeePay UPI ID with other RupeePay users to receive virtual funds instantly.
                 </p>
               </div>
               
               <div className="bg-[#16191F] border border-blue-500/30 p-5 rounded-xl w-full text-center hover:bg-[#1A1E26] transition-colors">
                  <div className="text-xs text-blue-400/70 uppercase tracking-widest mb-2 font-semibold">Your Personal UPI ID</div>
                  <div className="font-mono text-xl sm:text-2xl break-all text-blue-400 font-bold tracking-wider">{upiId || 'Loading...'}</div>
               </div>
               
               <div className="flex gap-4 w-full">
                 <button type="button" onClick={() => {
                   if (upiId) {
                     navigator.clipboard.writeText(upiId);
                     toast.success("UPI ID copied!");
                   }
                 }} className="w-full bg-[#232730] hover:bg-[#2A2F3A] border border-white/5 text-white font-medium py-4 rounded-xl transition-all">
                   Copy ID
                 </button>
               </div>
            </div>
          )}
          
          {source.includes('Card') && (
              <div className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-5 mb-4 relative">
                <h3 className="text-white text-sm font-semibold flex items-center gap-2 mb-4 font-sans tracking-wide uppercase">
                  <CreditCard className="w-4 h-4" /> CARD ID
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Enter Card ID *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. RPAY123456" 
                      value={cardId}
                      onChange={(e) => setCardId(e.target.value.toUpperCase())}
                      className="w-full bg-[#16191F] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white text-sm"
                      required
                    />
                  </div>

                  {cardId.length >= 8 && (
                    <div className="mt-4">
                       {cardValidationStatus.isChecking ? (
                         <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 px-4 py-3 rounded-xl border border-blue-500/20">
                           <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0"></div>
                           <p>Verifying Card ID...</p>
                         </div>
                       ) : cardValidationStatus.verifiedTargetName ? (
                         <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-4 py-3 rounded-xl border border-green-500/20">
                           <CheckCircle2 className="w-5 h-5 shrink-0" />
                           <p>Verified Card Holder: <strong>{cardValidationStatus.verifiedTargetName}</strong></p>
                         </div>
                       ) : cardValidationStatus.error ? (
                         <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20">
                           <p>{cardValidationStatus.error}</p>
                         </div>
                       ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
            
          {source !== 'UPI' && (
             <>
               <div>
                 <div className="flex justify-between items-end mb-2">
                   <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount (₹)</label>
                 </div>
                 <input 
                   required 
                   name="amount" 
                   type="number" 
                   min="1" 
                   step="0.01" 
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-4 px-4 focus:border-blue-500 focus:outline-none transition-colors text-2xl font-bold text-white shadow-inner" 
                   placeholder="0.00" 
                 />
                 
                 {/* 2. Quick Amount Buttons */}
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                   {quickAmounts.map(val => (
                     <button
                       key={val}
                       type="button"
                       onClick={() => setAmount(val.toString())}
                       className="bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 py-2 rounded-lg text-sm font-medium transition-colors"
                     >
                       +{formatINR(val).replace('.00', '')}
                     </button>
                   ))}
                 </div>
               </div>
               
               <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Purpose / Remarks (Optional)</label>
                 <input 
                   name="remarks" 
                   type="text" 
                   value={remarks}
                   onChange={(e) => setRemarks(e.target.value)}
                   className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-gray-300" 
                   placeholder="e.g. Salary, Pocket Money, Savings" 
                 />
               </div>

               {/* 3 & 4. Transaction Charges & Summary Box */}
               {numAmount > 0 && (
                 <motion.div 
                   initial={{ opacity: 0, height: 0 }} 
                   animate={{ opacity: 1, height: 'auto' }} 
                   className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-5 overflow-hidden"
                 >
                   <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Deposit Summary</h4>
                   <div className="space-y-3 text-sm">
                     <div className="flex justify-between">
                       <span className="text-gray-400">Amount to add</span>
                       <span className="text-white font-medium">{formatINR(numAmount)}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-400">Method</span>
                       <span className="text-white">{source}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-400">Processing Time</span>
                       <span className="text-green-400">{currentInfo.time}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-400">Charges</span>
                       <span className={currentInfo.fee === 0 ? "text-green-400" : "text-orange-400"}>
                         {currentInfo.fee === 0 ? '₹0 (Free)' : `₹${currentInfo.fee}`}
                       </span>
                     </div>
                     <div className="flex justify-between border-t border-white/5 pt-3 mt-1 font-semibold">
                       <span className="text-white">Total Deducted</span>
                       <span className="text-white text-lg">{formatINR(numAmount + currentInfo.fee)}</span>
                     </div>
                   </div>
                 </motion.div>
               )}

               {msg.text && (
                 <div className={`p-4 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/50' : 'bg-blue-600/10 text-blue-400 border border-blue-500/50'}`}>
                   {msg.text}
                 </div>
               )}

               <div className="flex gap-4">
                 <button 
                   type="button" 
                   onClick={() => {
                     setAmount('');
                     setSource('UPI');
                     setRemarks('');
                   }}
                   className="flex-1 bg-[#232730] hover:bg-[#2A2F3A] text-white font-semibold py-4 rounded-xl transition-all border border-transparent"
                 >
                   Cancel
                 </button>
                 <button 
                   disabled={loading || numAmount <= 0 || !isCardFormValid} 
                   type="submit" 
                   className="flex-[2] bg-blue-600/90 hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] disabled:opacity-50"
                 >
                   {loading ? 'Processing...' : (numAmount > 0 ? `Proceed for Deposit ${formatINR(numAmount + currentInfo.fee)}` : 'Enter Amount')}
                 </button>
               </div>
             </>
          )}
        </form>
      </div>

      <MfaModal 
        isOpen={showMfa}
        onClose={() => setShowMfa(false)}
        onSuccess={() => handleSubmit()}
        secret={userData?.twoFactorSecret || ''}
      />

      {/* Auth Code Modal for Virtual Debit Card */}
      <AnimatePresence>
         {showAuthCodeModal && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.95, opacity: 0, y: 20 }} 
                className="relative bg-[#16191F] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl z-10"
              >
                 <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                   <CreditCard className="w-8 h-8 text-blue-400" />
                 </div>
                 <h2 className="text-xl font-bold text-center text-white mb-2">Authorization Pending</h2>
                 <p className="text-gray-400 text-center text-sm mb-6">
                   A deposit authorization request has been sent to <strong>{targetName}</strong>. 
                   Once they approve, they will receive a 4-digit code. Please enter that code below to confirm the deposit.
                 </p>
                 
                 <div className="mb-6">
                   <input 
                     type="text" 
                     value={authCode}
                     onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, '').substring(0, 4))}
                     placeholder="0000"
                     className="w-full bg-[#0A0B0D] border border-white/10 rounded-2xl py-4 px-6 text-center text-3xl font-mono tracking-[0.5em] focus:border-blue-500 focus:outline-none transition-colors text-white"
                   />
                 </div>

                 <div className="flex gap-4">
                   <button 
                     onClick={() => { setShowAuthCodeModal(false); setLoading(false); setAuthRequestId(null); }}
                     className="flex-1 px-4 py-3 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5 transition-all text-gray-300"
                   >
                     Cancel
                   </button>
                   <button 
                     disabled={loading || authCode.length !== 4}
                     onClick={handleAuthCodeSubmit}
                     className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50"
                   >
                     {loading ? 'Verifying...' : 'Complete Deposit'}
                   </button>
                 </div>
              </motion.div>
           </div>
         )}
      </AnimatePresence>
    </div>
  );
}
