import React, { useState } from 'react';
import { formatINR } from '../lib/utils';
import { ArrowDownToLine, CheckCircle2, FileText, Download, Wallet, CreditCard } from 'lucide-react';
import { doDeposit } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import * as htmlToImage from 'html-to-image';
import { MfaModal } from './MfaModal';

export function Deposit({ user, userData, accountNumber, upiId, balance, transactions, onComplete }: { user: string, userData?: any, accountNumber?: string, upiId?: string, balance: number, transactions: any[], onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  const [amount, setAmount] = useState<string>('');
  const [source, setSource] = useState<string>('UPI');
  const [remarks, setRemarks] = useState<string>('');
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  
  const [successData, setSuccessData] = useState<{ amount: number, txId: string, method: string, date: string, last4?: string } | null>(null);
  const [showMfa, setShowMfa] = useState(false);

  const lastDeposit = transactions?.find(t => t.type === 'credit');
  const quickAmounts = [500, 1000, 5000, 10000];

  const getChargesInfo = (method: string) => {
    switch(method) {
      case 'UPI': return { time: 'Instant', fee: 0 };
      case 'Debit Card': return { time: 'Instant', fee: 12 };
      case 'Credit Card': return { time: 'Instant', fee: 20 };
      default: return { time: 'Instant', fee: 0 };
    }
  };

  const currentInfo = getChargesInfo(source);
  const numAmount = Number(amount) || 0;

  const cleanCardNumber = cardNumber.replace(/\s+/g, '');
  
  const detectCardType = (number: string) => {
    const num = number.replace(/\s+/g, '');
    if (num.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(num)) return 'Mastercard';
    if (/^6(0|5)/.test(num)) return 'RuPay';
    if (/^3[47]/.test(num)) return 'American Express';
    return '';
  };
  
  const cardType = detectCardType(cardNumber);

  const isCardNumberValid = cleanCardNumber.length === 16;
  const isCardNameValid = /^[a-zA-Z\s]{3,50}$/.test(cardName.trim());
  const isExpiryValid = () => {
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return false;
    const [m, y] = cardExpiry.split('/');
    const month = parseInt(m, 10);
    const year = parseInt(`20${y}`, 10);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) return false;
    return true;
  };
  const isCVVValid = /^\d{3}$/.test(cardCVV);

  const isCardFormValid = source.includes('Card') ? (isCardNumberValid && isCardNameValid && isExpiryValid() && isCVVValid) : true;

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 16) val = val.slice(0, 16);
    const formatted = val.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 2) {
      val = val.slice(0, 2) + '/' + val.slice(2, 4);
    }
    if (val.length > 5) val = val.slice(0, 5);
    setCardExpiry(val);
  };

  const handleCVVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 3) val = val.slice(0, 3);
    setCardCVV(val);
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (numAmount <= 0) {
      setMsg({ text: 'Please enter a valid amount', type: 'error' });
      return;
    }

    if (userData?.twoFactorEnabled && userData?.require2FAForTransactions && !showMfa && e) {
      setShowMfa(true);
      return;
    }

    setLoading(true);
    setMsg({ text: '', type: '' });

    try {
      let metadata: any = undefined;
      const finalSource = source.includes('Card') && cardType ? `${cardType} ${source}` : source;
      
      if (source.includes('Card')) {
         metadata = {
           cardType,
           last4: cleanCardNumber.slice(-4)
         };
      }
      
      const txId = await doDeposit(user, numAmount, finalSource, metadata);
      
      await new Promise(r => setTimeout(r, 2000));
      
      setSuccessData({
        amount: numAmount,
        txId,
        method: finalSource,
        date: new Date().toLocaleString(),
        ...(metadata && { last4: metadata.last4 })
      });
      toast.success("Deposit Completed Successfully!");
      setAmount('');
      setRemarks('');
      setCardNumber('');
      setCardName('');
      setCardExpiry('');
      setCardCVV('');
      setShowMfa(false);
      
    } catch (err: any) {
      setMsg({ text: err.message || 'Deposit failed', type: 'error' });
      setShowMfa(false);
    } finally {
      setLoading(false);
    }
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
              <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Credit Card">Credit Card</option>
            </select>
            {source === 'UPI' && upiId && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Your Personal UPI ID</div>
                  <div className="font-mono text-blue-400 font-medium tracking-wide">{upiId}</div>
                </div>
              </div>
            )}
            
            {source.includes('Card') && (
              <div className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-5 mb-4 relative">
                {cardType && (
                  <div className="absolute top-4 right-5 text-sm font-semibold text-blue-400">
                    {cardType}
                  </div>
                )}
                <h3 className="text-white text-sm font-semibold flex items-center gap-2 mb-4 font-sans tracking-wide uppercase">
                  <CreditCard className="w-4 h-4" /> CARD DETAILS
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Card Number *</label>
                    <input 
                      type="text" 
                      placeholder="XXXX XXXX XXXX XXXX" 
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className={`w-full bg-[#16191F] border ${cardNumber && !isCardNumberValid ? 'border-red-500' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white text-sm`}
                      required
                    />
                    {cardNumber && !isCardNumberValid && <p className="text-red-500 text-xs mt-1">Card Number must contain exactly 16 digits</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Cardholder Name *</label>
                    <input 
                      type="text" 
                      placeholder="Name on card" 
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className={`w-full bg-[#16191F] border ${cardName && !isCardNameValid ? 'border-red-500' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white text-sm`}
                      required
                    />
                    {cardName && !isCardNameValid && <p className="text-red-500 text-xs mt-1">Enter valid cardholder name</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Expiry Date *</label>
                      <input 
                        type="text" 
                        placeholder="MM/YY" 
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        className={`w-full bg-[#16191F] border ${cardExpiry && !isExpiryValid() ? 'border-red-500' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white text-sm`}
                        required
                      />
                      {cardExpiry && !isExpiryValid() && <p className="text-red-500 text-xs mt-1">Enter a valid expiry date</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">CVV *</label>
                      <input 
                        type="password" 
                        placeholder="***"
                        value={cardCVV}
                        onChange={handleCVVChange}
                        className={`w-full bg-[#16191F] border ${cardCVV && !isCVVValid ? 'border-red-500' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white text-sm`}
                        required
                        maxLength={3}
                      />
                      {cardCVV && !isCVVValid && <p className="text-red-500 text-xs mt-1">CVV must contain exactly 3 digits</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              {loading ? 'Processing...' : (numAmount > 0 ? `Proceed to Pay ${formatINR(numAmount + currentInfo.fee)}` : 'Enter Amount')}
            </button>
          </div>
        </form>
      </div>

      <MfaModal 
        isOpen={showMfa}
        onClose={() => setShowMfa(false)}
        onSuccess={() => handleSubmit()}
        secret={userData?.twoFactorSecret || ''}
      />
    </div>
  );
}
