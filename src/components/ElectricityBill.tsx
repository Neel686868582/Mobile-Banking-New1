import React, { useState, useMemo } from 'react';
import { formatINR } from '../lib/utils';
import { Zap, Search, FileText, CheckCircle2, Download, CreditCard, Wallet, Smartphone, Building2, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jsPDF } from "jspdf";
import { payElectricityBill } from '../lib/firebaseUtils';
import { CardForm } from './CardForm';

const ELECTRICITY_PROVIDERS = [
  "MGVCL", "DGVCL", "UGVCL", "PGVCL", "Torrent Power", "MSEDCL (Mahavitaran)", 
  "Tata Power Mumbai", "Adani Electricity Mumbai", "BEST Mumbai", "BSES Rajdhani (BRPL)", 
  "BSES Yamuna (BYPL)", "TPDDL", "JVVNL", "AVVNL", "JDVVNL", "MPPKVVCL (West Zone)", 
  "MPMKVVCL (Central Zone)", "MPPKVVCL (East Zone)", "PVVNL", "MVVNL", "DVVNL", 
  "PuVVNL", "KESCO", "NPCL", "NBPDCL", "SBPDCL", "JBVNL", "WBSEDCL", "CESC Limited", 
  "India Power Corporation", "TPCODL", "TPNODL", "TPWODL", "TPSODL", "APSPDCL", 
  "APEPDCL", "APCPDCL", "TGSPDCL", "TGNPDCL", "TGRPDCL", "BESCOM", "HESCOM", "MESCOM", 
  "GESCOM", "CESC Mysuru", "TANGEDCO", "KSEB", "PSPCL", "UHBVN", "DHBVN", "HPSEBL", 
  "UPCL", "APDCL", "CSPDCL", "Electricity Department Goa", "JPDCL", "KPDCL", 
  "Chandigarh Power Distribution Ltd", "Other / Not Listed"
];

const PROVIDER_LENGTHS: Record<string, { min: number, max: number }> = {
  "MGVCL": { min: 11, max: 14 },
  "DGVCL": { min: 11, max: 14 },
  "UGVCL": { min: 11, max: 14 },
  "PGVCL": { min: 11, max: 14 },
  "Torrent Power": { min: 14, max: 15 },
  "MSEDCL (Mahavitaran)": { min: 12, max: 12 },
  "BSES Rajdhani (BRPL)": { min: 9, max: 11 },
  "BSES Yamuna (BYPL)": { min: 9, max: 11 },
  "Tata Power Mumbai": { min: 9, max: 12 },
  "TANGEDCO": { min: 10, max: 12 },
  "KSEB": { min: 13, max: 13 }
};

export function ElectricityBill({ user, balance, onComplete }: { user: string, balance: number, onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [consumerNumber, setConsumerNumber] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [billDetails, setBillDetails] = useState<any>(null);
  
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isCardValid, setIsCardValid] = useState(false);
  const [maskedCard, setMaskedCard] = useState('');
  
  const [receiptData, setReceiptData] = useState<any>(null);

  const filteredProviders = useMemo(() => {
    return ELECTRICITY_PROVIDERS.filter(p => p.toLowerCase().includes(providerSearch.toLowerCase()));
  }, [providerSearch]);

  const handleFetchBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !consumerNumber) {
      toast.error('Please fill all the details');
      return;
    }
    
    const limits = PROVIDER_LENGTHS[selectedProvider];
    if (limits) {
      const isDigitsOnly = /^\d+$/.test(consumerNumber);
      if (!isDigitsOnly || consumerNumber.length < limits.min || consumerNumber.length > limits.max) {
        toast.error('data invalid');
        return;
      }
    }
    
    setLoading(true);
    // Simulate API fetch delay
    setTimeout(() => {
const INDIAN_NAMES = ["Rajesh Kumar", "Amit Singh", "Priya Sharma", "Ravi Patel", "Neha Gupta", "Suresh Desai", "Anjali Verma", "Vikram Reddy", "Kavita Iyer", "Arun Nair", "Manoj Tiwari", "Sunita Rao"];
      const sum = consumerNumber.split('').reduce((acc, char) => acc + (parseInt(char) || 0), 0);
      const randomName = INDIAN_NAMES[(sum + consumerNumber.length) % INDIAN_NAMES.length];

      setBillDetails({
        consumerName: randomName,
        consumerNumber: consumerNumber,
        providerName: selectedProvider,
        billingMonth: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        billAmount: Math.floor(Math.random() * 2000) + 500,
        status: 'Unpaid'
      });
      setStep(2);
      setLoading(false);
    }, 1500);
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }
    
    const isCard = paymentMethod === 'Debit Card' || paymentMethod === 'Credit Card';
    if (isCard && !isCardValid) {
      toast.error('Please provide valid card details.');
      return;
    }
    
    setLoading(true);
    try {
      const receipt = {
        ...billDetails,
        status: 'Paid',
        paymentMethod: isCard ? `${paymentMethod} ${maskedCard}` : paymentMethod,
        date: new Date().toLocaleString(),
      };
      
      const txId = await payElectricityBill(user, receipt, billDetails.billAmount);
      
      await new Promise(r => setTimeout(r, 2000));
      
      setReceiptData({ ...receipt, txId });
      setStep(3);
      toast.success("Payment successful!");
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!receiptData) return;
    
    const doc = new jsPDF();
    
    // Branding
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("ELECTRICITY BILL RECEIPT", 105, 25, { align: "center" });
    
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
    
    addRow("Provider Name", receiptData.providerName);
    addRow("Consumer Name", receiptData.consumerName);
    addRow("Consumer Number", receiptData.consumerNumber);
    addRow("Transaction ID", receiptData.txId);
    if (receiptData.paymentMethod) {
      addRow("Payment Method", receiptData.paymentMethod);
    }
    addRow("Billing Month", receiptData.billingMonth);
    addRow("Due Date", receiptData.dueDate);
    
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    addRow("Payment Method", receiptData.paymentMethod || "Bank Account (Internal)");
    addRow("Date & Time", receiptData.date);
    addRow("Payment Status", "PAID");
    
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Total Paid:", 20, yPos);
    doc.text(`INR ${receiptData.billAmount}`, 80, yPos);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for using RupeePay Utility Services.", 105, 280, { align: "center" });

    doc.save(`electricity_receipt_${receiptData.txId}.pdf`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Electricity Bill Receipt',
        text: `Paid electricity bill of ${formatINR(receiptData.billAmount)} for ${receiptData.providerName}.`
      }).catch(err => console.log('Error sharing:', err));
    } else {
      toast.success("Share link copied to clipboard (simulated)");
    }
  };

  if (step === 3 && receiptData) {
    return (
      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl text-center space-y-6">
        <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold">Payment Successful!</h2>
        <p className="text-gray-400">Your electricity bill has been paid.</p>
        
        <div className="bg-[#0A0B0D] p-6 rounded-2xl text-left space-y-3 mx-auto mt-6">
          <div className="flex justify-between border-b border-white/5 pb-3">
            <span className="text-gray-500">Amount Paid</span>
            <span className="font-medium text-blue-400 text-xl">{formatINR(receiptData.billAmount)}</span>
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
        <button onClick={onComplete} className="mt-4 text-gray-400 hover:text-white transition-colors">
          Back to Utilities
        </button>
      </div>
    );
  }

  if (step === 2 && billDetails) {
    return (
      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl space-y-6">
        <h3 className="text-xl font-medium flex items-center gap-2 border-b border-white/5 pb-4"><FileText className="text-blue-400"/> Bill Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0A0B0D] p-6 rounded-2xl">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Consumer Name</div>
            <div className="font-medium flex items-center gap-2"><User className="w-4 h-4 text-gray-400"/> {billDetails.consumerName}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Consumer Number</div>
            <div className="font-medium">{billDetails.consumerNumber}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Provider</div>
            <div className="font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400"/> {billDetails.providerName}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Billing Month</div>
            <div className="font-medium">{billDetails.billingMonth}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Due Date</div>
            <div className="font-medium text-red-400">{billDetails.dueDate}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
            <div className="inline-block px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-semibold uppercase">{billDetails.status}</div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
          <div>
            <div className="text-gray-400 text-sm mb-1">Total Amount Due</div>
            <div className="text-3xl font-bold text-blue-400">{formatINR(billDetails.billAmount)}</div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 space-y-4">
          <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider">Select Payment Method</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: 'UPI', icon: Smartphone, label: 'UPI' },
              { id: 'Debit Card', icon: CreditCard, label: 'Debit Card' },
              { id: 'Credit Card', icon: CreditCard, label: 'Credit Card' }
            ].map(method => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === method.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#0A0B0D] border-white/5 text-gray-400 hover:text-white'}`}
              >
                <method.icon className="w-5 h-5" />
                <span className="text-xs font-medium text-center">{method.label}</span>
              </button>
            ))}
          </div>
          
          {(paymentMethod === 'Debit Card' || paymentMethod === 'Credit Card') && (
            <CardForm onValidData={(valid, masked) => { setIsCardValid(valid); setMaskedCard(masked); }} />
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={() => setStep(1)} className="flex-1 bg-[#232730] hover:bg-[#2A2F3A] text-white font-semibold py-4 rounded-xl transition-all">
            Cancel
          </button>
          <button disabled={loading || ((paymentMethod === 'Debit Card' || paymentMethod === 'Credit Card') && !isCardValid)} onClick={handlePayment} className="flex-1 bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all disabled:opacity-50">
            {loading ? 'Processing...' : `Pay ${formatINR(billDetails.billAmount)} Now`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl">
      <h3 className="text-xl font-medium mb-6 flex items-center gap-2 border-b border-white/5 pb-4"><Zap className="text-blue-400"/> Electricity Bill</h3>
      
      <form onSubmit={handleFetchBill} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Search Electricity Provider</label>
          <div className="relative mb-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search provider (e.g. MGVCL)" 
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="bg-[#0A0B0D] border border-white/5 rounded-xl max-h-48 overflow-y-auto custom-scrollbar">
            {filteredProviders.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No providers found</div>
            ) : (
              filteredProviders.map(provider => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => { setSelectedProvider(provider); setProviderSearch(provider); }}
                  className={`w-full text-left p-3 text-sm transition-colors ${selectedProvider === provider ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-gray-300 hover:bg-white/5'}`}
                >
                  {provider}
                </button>
              ))
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Consumer / Service Number</label>
          <input 
            required 
            type="text" 
            value={consumerNumber}
            onChange={(e) => setConsumerNumber(e.target.value)}
            className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" 
            placeholder="Enter Consumer Number" 
          />
        </div>

        <button disabled={loading || !selectedProvider} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2">
          {loading ? 'Fetching Details...' : <><Search className="w-5 h-5"/> Fetch Bill</>}
        </button>
      </form>
    </div>
  );
}
