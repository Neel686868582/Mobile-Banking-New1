import React, { useState } from 'react';
import { formatINR } from '../lib/utils';
import { ReceiptIndianRupee, Smartphone, Zap, Droplet, Tv, CheckCircle2, Download, Search, FileText, User, Building2, CreditCard, Wallet } from 'lucide-react';
import { payBill } from '../lib/firebaseUtils';
import { toast } from 'react-hot-toast';
import { ElectricityBill } from './ElectricityBill';
import { jsPDF } from "jspdf";
import { MfaModal } from './MfaModal';

const billTypes = [
  { id: 'mobile', label: 'Mobile Recharge', icon: Smartphone },
  { id: 'electricity', label: 'Electricity Bill', icon: Zap },
  { id: 'water', label: 'Water Bill', icon: Droplet },
  { id: 'dth', label: 'DTH Recharge', icon: Tv },
];

const MOBILE_PROVIDERS = ['Airtel', 'Jio', 'Vi (Vodafone Idea)', 'BSNL', 'MTNL'];
const DTH_PROVIDERS = ['Tata Play', 'Airtel Digital TV', 'Dish TV', 'D2H', 'Sun Direct'];
const WATER_PROVIDERS = [
  'Delhi Jal Board (DJB)', 'Bangalore Water Supply and Sewerage Board (BWSSB)',
  'Hyderabad Metropolitan Water Supply and Sewerage Board (HMWSSB)', 'Chennai Metro Water (CMWSSB)',
  'Pune Municipal Corporation Water Department', 'Ahmedabad Municipal Corporation Water Department',
  'Surat Municipal Corporation Water Department', 'Vadodara Municipal Corporation Water Department',
  'Rajkot Municipal Corporation Water Department', 'Indore Municipal Corporation Water Department',
  'Bhopal Municipal Corporation Water Department', 'Nagpur Municipal Corporation Water Department',
  'Mumbai Municipal Corporation Water Department', 'Kolkata Municipal Corporation Water Department',
  'Jaipur Municipal Corporation Water Department', 'Lucknow Jal Sansthan', 'Kanpur Jal Sansthan',
  'Patna Municipal Corporation Water Department', 'Other / Not Listed'
];

export function Bills({ user, userData, balance, onComplete }: { user: string, userData?: any, balance: number, onComplete: () => void }) {
  const [selectedType, setSelectedType] = useState(billTypes[0].id);
  const [loading, setLoading] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  
  // Form fields
  const [provider, setProvider] = useState('');
  const [identifier, setIdentifier] = useState('');
  
  const [step, setStep] = useState(1);
  const [billDetails, setBillDetails] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  
  const [receiptData, setReceiptData] = useState<any>(null);
  
  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    setProvider('');
    setIdentifier('');
    setReceiptData(null);
    setStep(1);
    setBillDetails(null);
    setPaymentMethod('');
  };

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (selectedType === 'mobile') {
      const isDigitsExt = /^[6-9]\d{9}$/.test(identifier);
      if (!isDigitsExt) {
        toast.error('Invalid Mobile Number. Must be 10 digits starting with 6, 7, 8, or 9.');
        return;
      }
    } else if (selectedType === 'dth') {
      if (identifier.length < 6 || identifier.length > 20) {
        toast.error('Invalid Subscriber ID. Length must be 6-20 characters.');
        return;
      }
    } else if (selectedType === 'water') {
      if (identifier.length < 5 || identifier.length > 20) {
        toast.error('Invalid Consumer Number. Length must be 5-20 characters.');
        return;
      }
    }
    
    if (!provider) {
      toast.error('Please select a provider.');
      return;
    }

    setLoading(true);
    
    // Simulate fetch
    setTimeout(() => {
      const generatedAmount = Math.floor(Math.random() * 800) + 200;
      const category = billTypes.find(b => b.id === selectedType)?.label || selectedType;
      
const INDIAN_NAMES = ["Rajesh Kumar", "Amit Singh", "Priya Sharma", "Ravi Patel", "Neha Gupta", "Suresh Desai", "Anjali Verma", "Vikram Reddy", "Kavita Iyer", "Arun Nair", "Manoj Tiwari", "Sunita Rao"];
      const sum = identifier.split('').reduce((acc, char) => acc + (parseInt(char) || 0), 0);
      const randomName = INDIAN_NAMES[(sum + identifier.length) % INDIAN_NAMES.length];

      setBillDetails({
        consumerName: randomName,
        identifier: identifier,
        providerName: provider,
        category: category,
        dueDate: selectedType === 'mobile' ? 'Instant Activation' : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        billAmount: selectedType === 'mobile' ? 0 : generatedAmount,
        status: 'Unpaid'
      });
      setStep(2);
      setLoading(false);
    }, 1500);
  };

  const handlePayment = async (forceNoMfa = false) => {
    if (!paymentMethod) {
      toast.error('Please select a payment method.');
      return;
    }

    if (!userData?.twoFactorEnabled) {
      toast.error('Please enable Two-Factor Authentication (2FA) to proceed with payments.', { duration: 5000 });
      return;
    }

    if (!forceNoMfa) {
      setShowMfa(true);
      return;
    }

    const { category, billAmount } = billDetails;
    
    if (billAmount > balance) {
      toast.error('Insufficient bank balance.');
      return;
    }

    if (userData?.twoFactorEnabled && userData?.require2FAForTransactions && !forceNoMfa) {
      setShowMfa(true);
      return;
    }

    setLoading(true);
    try {
      const txId = await payBill(user, category, provider, billAmount, paymentMethod);
      
      await new Promise(r => setTimeout(r, 2000));
      
      toast.success(`Successfully paid ${formatINR(billAmount)} for ${category}`);
      setReceiptData({
        txId,
        category,
        providerName: provider,
        consumerName: billDetails.consumerName,
        identifier: identifier,
        amount: billAmount,
        date: new Date().toLocaleString(),
        paymentMethod: paymentMethod === 'Virtual Debit Card' && userData?.virtualCard ? `Virtual Debit Card (**** ${userData.virtualCard.cardNumber.slice(-4)})` : paymentMethod,
        status: 'Paid'
      });
      setStep(3);
      setShowMfa(false);
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
      setShowMfa(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!receiptData) return;
    
    const doc = new jsPDF();
    
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(`${receiptData.category.toUpperCase()} RECEIPT`, 105, 25, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    let yPos = 60;
    
    const addRow = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label + ":", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(value, 80, yPos);
      yPos += 10;
    };
    
    addRow("Category", receiptData.category);
    addRow("Provider Name", receiptData.providerName);
    addRow("Consumer Name", receiptData.consumerName);
    addRow("Consumer/Account ID", receiptData.identifier);
    addRow("Transaction ID", receiptData.txId);
    
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    addRow("Payment Method", receiptData.paymentMethod || "Bank Account (Internal)");
    addRow("Date & Time", receiptData.date);
    addRow("Payment Status", receiptData.status);
    
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Total Paid:", 20, yPos);
    doc.text(`INR ${receiptData.amount}`, 80, yPos);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for using RupeePay Utility Services.", 105, 280, { align: "center" });

    doc.save(`${receiptData.category.replace(/\s+/g, '_').toLowerCase()}_receipt_${receiptData.txId}.pdf`);
  };

  const handleShare = () => {
    if (!receiptData) return;
    if (navigator.share) {
      navigator.share({
        title: `${receiptData.category} Receipt`,
        text: `Paid ${receiptData.category} of ₹${receiptData.amount} for ${receiptData.providerName}.`
      }).catch(err => console.log('Error sharing:', err));
    } else {
      toast.success("Share link copied to clipboard (simulated)");
    }
  };

  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  const renderProviderSelect = () => {
    let options: string[] = [];
    if (selectedType === 'mobile') options = MOBILE_PROVIDERS;
    else if (selectedType === 'dth') options = DTH_PROVIDERS;
    else if (selectedType === 'water') options = WATER_PROVIDERS;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowProviderDropdown(!showProviderDropdown)}
          className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors flex justify-between items-center text-left"
        >
          <span className={`block break-words pr-2 ${!provider ? 'text-gray-500 text-sm' : 'text-sm'}`}>
            {provider || 'Select Provider'}
          </span>
          <span className="text-gray-500 flex-shrink-0 ml-2">▼</span>
        </button>
        {showProviderDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-[#0A0B0D] border border-white/5 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setProvider(opt);
                  setShowProviderDropdown(false);
                }}
                className={`w-full text-left p-3 text-sm transition-colors border-b border-white/5 last:border-0 ${provider === opt ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-gray-300 hover:bg-white/5 whitespace-normal break-words'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><ReceiptIndianRupee className="text-blue-400" /> Utility Bills</h2>
        <p className="text-gray-500">Pay your bills effortlessly. Amount will be deducted from your bank balance directly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-white/5 pb-6 md:pb-0 pr-0 md:pr-8 mb-4 md:mb-0 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Select Category</div>
          {billTypes.map(type => {
            const Icon = type.icon;
            const active = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => handleTypeChange(type.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${active ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-[#16191F] border-white/5 text-gray-400 hover:text-gray-200'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm text-left">{type.label}</span>
              </button>
            )
          })}
        </div>

        <div className="md:col-span-2">
          {selectedType === 'electricity' ? (
            <ElectricityBill user={user} userData={userData} balance={balance} onComplete={onComplete} />
          ) : step === 3 && receiptData ? (
            <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl text-center space-y-6">
              <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold">Payment Successful!</h2>
              <p className="text-gray-400">Your {receiptData.category} has been paid.</p>
              
              <div className="bg-[#0A0B0D] p-6 rounded-2xl text-left space-y-3 mx-auto mt-6">
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-medium text-blue-400 text-xl">{formatINR(receiptData.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Provider</span>
                  <span className="font-medium">{receiptData.providerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Consumer Name</span>
                  <span className="font-medium">{receiptData.consumerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{selectedType === 'mobile' ? 'Mobile Number' : selectedType === 'dth' ? 'Subscriber ID' : 'Consumer Number'}</span>
                  <span className="font-medium">{receiptData.identifier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction ID</span>
                  <span className="font-mono text-sm">{receiptData.txId}</span>
                </div>
                {receiptData.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Method</span>
                    <span className="font-medium text-sm">{receiptData.paymentMethod}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button onClick={handleDownloadPDF} className="flex-1 bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" /> Download PDF Receipt
                </button>
                <button onClick={handleShare} className="flex-1 bg-[#232730] hover:bg-[#2A2F3A] text-white font-semibold py-4 rounded-xl transition-all">
                  Share
                </button>
              </div>
              <button 
                onClick={() => {
                  setReceiptData(null);
                  setStep(1);
                  setBillDetails(null);
                  onComplete();
                }} 
                className="mt-4 text-gray-400 hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          ) : step === 2 && billDetails ? (
            <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl space-y-6">
              <h3 className="text-xl font-medium flex items-center gap-2 border-b border-white/5 pb-4"><FileText className="text-blue-400"/> Bill Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0A0B0D] p-6 rounded-2xl">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Consumer Name</div>
                  <div className="font-medium flex items-center gap-2"><User className="w-4 h-4 text-gray-400"/> {billDetails.consumerName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{selectedType === 'mobile' ? 'Mobile Number' : selectedType === 'dth' ? 'Subscriber ID' : 'Consumer Number'}</div>
                  <div className="font-medium">{billDetails.identifier}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Provider</div>
                  <div className="font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400"/> {billDetails.providerName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Due Date</div>
                  <div className={`font-medium ${selectedType !== 'mobile' ? 'text-red-400' : ''}`}>{billDetails.dueDate}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
                  <div className="inline-block px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-semibold uppercase">{billDetails.status}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
                <div className={selectedType === 'mobile' ? "w-full" : ""}>
                  <div className="text-gray-400 text-sm mb-1">{selectedType === 'mobile' ? 'Recharge Amount' : 'Total Amount Due'}</div>
                  {selectedType === 'mobile' ? (
                    <div className="relative mt-2">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-blue-400 font-bold">₹</span>
                       <input 
                         type="number" 
                         value={billDetails.billAmount || ''}
                         onChange={(e) => setBillDetails({...billDetails, billAmount: Number(e.target.value)})}
                         className="w-full bg-[#16191F] border border-blue-500/30 rounded-xl p-4 pl-12 text-3xl font-bold text-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-blue-900/50 appearance-none"
                         placeholder="0.00"
                       />
                    </div>
                  ) : (
                    <div className="text-3xl font-bold text-blue-400">{formatINR(billDetails.billAmount)}</div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-4">
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider">Select Payment Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'RupeePay Balance', icon: Wallet, label: 'RupeePay Balance' },
                    { id: 'UPI', icon: Smartphone, label: 'UPI' },
                    { id: 'Virtual Debit Card', icon: CreditCard, label: 'Virtual Debit Card' }
                  ].map(method => (
                    <button
                      type="button"
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === method.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#0A0B0D] border-white/5 text-gray-400 hover:text-white'}`}
                    >
                      <method.icon className="w-5 h-5" />
                      <span className="text-xs font-medium text-center">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 bg-[#232730] hover:bg-[#2A2F3A] text-white font-semibold py-4 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="button" disabled={loading || (selectedType === 'mobile' && !billDetails.billAmount) || !paymentMethod} onClick={() => handlePayment(false)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(37,99,235,0.2)]">
                  {loading ? 'Processing...' : (selectedType === 'mobile' && !billDetails.billAmount ? 'Enter Amount' : `Pay ${formatINR(billDetails.billAmount)} Now`)}
                </button>
              </div>
            </div>
          ) : (
          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
              <h3 className="text-xl font-medium">{billTypes.find(b => b.id === selectedType)?.label}</h3>
              <div className="text-sm">Balance: <span className="text-blue-400 font-semibold">{formatINR(balance)}</span></div>
            </div>

            <form onSubmit={handleFetch} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Provider / Operator</label>
                {renderProviderSelect()}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {selectedType === 'mobile' ? 'Mobile Number' : selectedType === 'dth' ? 'Subscriber ID / Customer ID' : 'Consumer Number / Connection Number'}
                </label>
                <input 
                  required 
                  type="text" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" 
                  placeholder={selectedType === 'mobile' ? 'Enter 10-digit Mobile Number' : 'Enter ID'} 
                />
              </div>

              <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2">
                {loading ? 'Fetching...' : <><Search className="w-5 h-5"/> Fetch Details</>}
              </button>
            </form>
          </div>
          )}
        </div>
      </div>

      <MfaModal 
        isOpen={showMfa}
        onClose={() => setShowMfa(false)}
        onSuccess={() => handlePayment(true)}
        secret={userData?.twoFactorSecret || ''}
      />
    </div>
  );
}
