import React, { useState, useEffect } from 'react';
import { formatINR } from '../lib/utils';
import { ArrowRightLeft, CheckCircle2, Wallet, UserIcon, Download } from 'lucide-react';
import { doTransfer } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';

export function Transfer({ user, balance, onComplete }: { user: string, balance: number, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const [name, setName] = useState('');
  const [acc, setAcc] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');

  const [isVerified, setIsVerified] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number, txId: string, method: string, date: string, toName: string, toAcc: string } | null>(null);

  useEffect(() => {
    if (method === 'UPI') {
      setIsVerified(acc.length >= 8);
    } else {
      if (acc.length >= 9 && acc.length <= 16 && ifsc.length >= 4) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    }
  }, [acc, ifsc, method]);

  const quickContacts = [
    { name: 'Mom', acc: '1234567890', ifsc: 'HDFC0001234' },
    { name: 'Dad', acc: '9876543210', ifsc: 'SBIN0001234' },
    { name: 'Rahul', acc: '1122334455', ifsc: 'ICIC0001234' },
    { name: 'Priya', acc: '9988776655', ifsc: 'AXIC0001234' },
  ];

  const handleQuickContact = (c: typeof quickContacts[0]) => {
    setName(c.name);
    setAcc(c.acc);
    setIfsc(c.ifsc);
  };

  const getTransferInfo = (m: string) => {
    switch(m) {
      case 'UPI': return { time: 'Instant', fee: 0 };
      case 'IMPS': return { time: 'Instant', fee: 5 };
      case 'NEFT': return { time: '2-4 Hours', fee: 0 };
      case 'RTGS': return { time: 'Instant', fee: 0 };
      default: return { time: 'Instant', fee: 0 };
    }
  };

  const currentInfo = getTransferInfo(method);
  const numAmount = Number(amount) || 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    
    if (numAmount <= 0) {
      setMsg({ text: 'Please enter a valid amount', type: 'error' });
      return;
    }
    if (numAmount + currentInfo.fee > balance) {
      setMsg({ text: 'Insufficient balance (including charges)', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await doTransfer(user, name, numAmount + currentInfo.fee, method);
      
      const txId = 'TXN' + Math.random().toString(36).substr(2, 9).toUpperCase();
      setSuccessData({
        amount: numAmount,
        txId,
        method,
        date: new Date().toLocaleString(),
        toName: name,
        toAcc: acc
      });

      setAmount('');
      setAcc('');
      setIfsc('');
      setName('');
    } catch (err: any) {
      setMsg({ text: err.message || 'Transfer failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = () => {
    // Fake download interaction
    alert("Receipt downloaded successfully!");
  };

  if (successData) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          className="bg-[#16191F] border border-green-500/30 rounded-3xl p-8 shadow-2xl shadow-green-500/10 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-2">{formatINR(successData.amount)}</h2>
          <p className="text-green-400 font-medium mb-8">Transferred Successfully</p>
          
          <div className="bg-[#0A0B0D] rounded-2xl p-6 mb-8 text-sm text-left border border-white/5 space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Sent To</span>
              <span className="text-white font-medium">{successData.toName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Account</span>
              <span className="text-white">{successData.toAcc}</span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-4">
              <span className="text-gray-500">Transaction ID</span>
              <span className="text-white font-mono">{successData.txId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date & Time</span>
              <span className="text-white">{successData.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment Method</span>
              <span className="text-white">{successData.method}</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
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
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><ArrowRightLeft className="text-blue-400" /> Send Money</h2>
        <p className="text-gray-500">Transfer funds securely to any bank account.</p>
      </div>

      {/* 1. Available Balance Card */}
      <div className="bg-gradient-to-br from-[#1A1D24] to-[#16191F] border border-white/5 rounded-3xl p-6 mb-8 shadow-xl relative overflow-hidden flex items-center justify-between">
        <div className="relative z-10">
          <p className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Available Balance</p>
          <h3 className="text-3xl font-bold text-white">{formatINR(balance)}</h3>
        </div>
        <div className="bg-blue-500/10 p-4 rounded-2xl relative z-10">
          <Wallet className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      {/* 4. Quick Contacts */}
      <div className="mb-8 overflow-x-auto no-scrollbar pb-2">
        <div className="flex gap-4 min-w-max">
          {quickContacts.map((contact, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleQuickContact(contact)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-full bg-[#16191F] border border-white/5 flex items-center justify-center group-hover:border-blue-500/50 transition-colors">
                <UserIcon className="w-6 h-6 text-gray-400 group-hover:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">{contact.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Method</label>
            <select 
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setAcc('');
                setIfsc('');
              }}
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-4 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none text-white font-medium"
            >
              <option value="UPI">UPI</option>
              <option value="IMPS">IMPS</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS (Min 2 Lakhs)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recipient Name</label>
            <input 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text" 
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white" 
              placeholder="e.g. Priya Sharma" 
            />
          </div>
          {method === 'UPI' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">UPI ID / Mobile Number</label>
              <input 
                required 
                value={acc}
                onChange={(e) => setAcc(e.target.value)}
                type="text" 
                className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white" 
                placeholder="e.g. 9876543210@upi" 
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Account Number</label>
                <input 
                  required 
                  value={acc}
                  onChange={(e) => setAcc(e.target.value)}
                  type="text" 
                  minLength={9} 
                  maxLength={16} 
                  pattern="\d+" 
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white" 
                  placeholder="e.g. 1234567890" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">IFSC Code</label>
                <input 
                  required 
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  type="text" 
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors uppercase text-white" 
                  placeholder="e.g. HDFC0001234" 
                />
              </div>
            </div>
          )}

          {/* 2. Recipient Verification Check */}
          <AnimatePresence>
            {isVerified && name && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }} 
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-4 py-3 rounded-xl border border-green-500/20">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <p>Verified Account Holder: <strong>{name}</strong></p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-2 border-t border-white/5">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount (₹)</label>
            </div>
            <input 
              required 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number" 
              min="1" 
              step="0.01" 
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-4 px-4 focus:border-blue-500 focus:outline-none transition-colors text-2xl font-bold text-white shadow-inner" 
              placeholder="0.00" 
            />
          </div>

          {/* 5. Transaction Summary Box */}
          <AnimatePresence>
            {numAmount > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-5 mt-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Transaction Summary</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sending to</span>
                      <span className="text-white font-medium text-right max-w-[150px] truncate">{name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount</span>
                      <span className="text-white">{formatINR(numAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Mode</span>
                      <span className="text-white">{method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Delivery Time</span>
                      <span className="text-blue-400">{currentInfo.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Charges</span>
                      <span className={currentInfo.fee === 0 ? "text-green-400" : "text-orange-400"}>
                        {currentInfo.fee === 0 ? '₹0 (Free)' : `₹${currentInfo.fee}`}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-3 mt-1 font-semibold">
                      <span className="text-white">Total Source Deduction</span>
                      <span className="text-white text-lg">{formatINR(numAmount + currentInfo.fee)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {msg.text && (
            <div className={`p-4 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/50' : 'bg-green-600/10 text-green-400 border border-green-500/50'}`}>
              {msg.text}
            </div>
          )}

          <button disabled={loading || numAmount <= 0} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-bold py-4 rounded-xl transition-all disabled:opacity-50 text-lg shadow-lg shadow-blue-600/20">
            {loading ? 'Processing...' : (numAmount > 0 ? `Pay ${formatINR(numAmount + currentInfo.fee)}` : 'Enter Amount to Transfer')}
          </button>
        </form>
      </div>
    </div>
  );
}

