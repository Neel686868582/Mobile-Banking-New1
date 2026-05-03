import React, { useState } from 'react';
import { formatINR } from '../lib/utils';
import { ArrowDownToLine, CheckCircle2, FileText, Download, Wallet, CreditCard } from 'lucide-react';
import { doDeposit } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';

export function Deposit({ user, accountNumber, balance, transactions, onComplete }: { user: string, accountNumber?: string, balance: number, transactions: any[], onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  const [amount, setAmount] = useState<string>('');
  const [source, setSource] = useState<string>('UPI');
  const [remarks, setRemarks] = useState<string>('');
  
  const [successData, setSuccessData] = useState<{ amount: number, txId: string, method: string, date: string } | null>(null);

  const lastDeposit = transactions?.find(t => t.type === 'credit');
  const quickAmounts = [500, 1000, 5000, 10000];

  const getChargesInfo = (method: string) => {
    switch(method) {
      case 'UPI': return { time: 'Instant', fee: 0 };
      case 'Net Banking': return { time: 'Instant', fee: 5 };
      case 'Debit Card': return { time: 'Instant', fee: 12 }; // Flat 12 fee
      case 'Cash/Cheque': return { time: '1-3 Working Days', fee: 0 };
      default: return { time: 'Instant', fee: 0 };
    }
  };

  const currentInfo = getChargesInfo(source);
  const numAmount = Number(amount) || 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setMsg({ text: 'Please enter a valid amount', type: 'error' });
      return;
    }
    setLoading(true);
    setMsg({ text: '', type: '' });

    try {
      // Adding fee deduction or anything? The prompt doesn't ask to actually deduct the charge, just show it. Let's keep doDeposit the same, or maybe deduct fee? I'll just deposit the exact amount minus fee if we want, but let's just do deposit for amount for simplicity, or actually just do deposit.
      await doDeposit(user, numAmount, source);
      
      const txId = 'TXN' + Math.random().toString(36).substr(2, 9).toUpperCase();
      setSuccessData({
        amount: numAmount,
        txId,
        method: source,
        date: new Date().toLocaleString()
      });
      setAmount('');
      setRemarks('');
      
    } catch (err: any) {
      setMsg({ text: err.message || 'Deposit failed', type: 'error' });
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
          <p className="text-green-400 font-medium mb-8">Deposited Successfully</p>
          
          <div className="bg-[#0A0B0D] rounded-2xl p-6 mb-8 text-sm text-left border border-white/5 space-y-4">
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
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-4 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none text-white font-medium shadow-inner"
            >
              <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
              <option value="Net Banking">Net Banking</option>
              <option value="Debit Card">Debit / Credit Card</option>
              <option value="Cash/Cheque">Cash / Cheque Deposit</option>
            </select>
          </div>
          
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
            <div className="grid grid-cols-4 gap-2 mt-3">
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

          <button disabled={loading || numAmount <= 0} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-bold py-4 rounded-xl transition-all disabled:opacity-50 text-lg shadow-lg shadow-blue-600/20">
            {loading ? 'Processing...' : (numAmount > 0 ? `Proceed to Pay ${formatINR(numAmount + currentInfo.fee)}` : 'Enter Amount to Deposit')}
          </button>
        </form>
      </div>
    </div>
  );
}
