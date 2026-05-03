import React, { useState } from 'react';
import { formatINR } from '../lib/utils';
import { Receipt, Smartphone, Zap, Droplet, Tv } from 'lucide-react';
import { payBill } from '../lib/firebaseUtils';

const billTypes = [
  { id: 'mobile', label: 'Mobile Recharge', icon: Smartphone },
  { id: 'electricity', label: 'Electricity Bill', icon: Zap },
  { id: 'water', label: 'Water Bill', icon: Droplet },
  { id: 'dth', label: 'DTH Recharge', icon: Tv },
];

export function Bills({ user, balance, onComplete }: { user: string, balance: number, onComplete: () => void }) {
  const [selectedType, setSelectedType] = useState(billTypes[0].id);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });
    
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const provider = formData.get('provider') as string;
    const category = billTypes.find(b => b.id === selectedType)?.label || selectedType;
    
    if (amount > balance) {
      setMsg({ text: 'Insufficient balance to pay this bill.', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      await payBill(user, category, provider, amount);
      setMsg({ text: `Successfully paid ${formatINR(amount)} for ${category}`, type: 'success' });
      (e.target as HTMLFormElement).reset();
      onComplete();
    } catch (err: any) {
      setMsg({ text: err.message || 'Payment failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><Receipt className="text-blue-400" /> Utility Bills</h2>
        <p className="text-gray-500">Pay your bills effortlessly. Amount will be deducted from your bank balance directly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 border-r border-white/5 pr-8 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Select Category</div>
          {billTypes.map(type => {
            const Icon = type.icon;
            const active = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type.id); setMsg({text:'', type:''}); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${active ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-[#16191F] border-white/5 text-gray-400 hover:text-gray-200'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm text-left">{type.label}</span>
              </button>
            )
          })}
        </div>

        <div className="md:col-span-2">
          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
              <h3 className="text-xl font-medium">{billTypes.find(b => b.id === selectedType)?.label}</h3>
              <div className="text-sm">Balance: <span className="text-blue-400 font-semibold">{formatINR(balance)}</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Provider / Operator</label>
                <input required name="provider" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="e.g. Jio, BESCOM, Airtel" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {selectedType === 'mobile' ? 'Mobile Number' : 'Consumer ID / Account No.'}
                </label>
                <input required type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Enter ID" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Amount (₹)</label>
                <input required name="amount" type="number" min="1" step="0.01" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-xl font-medium" placeholder="0.00" />
              </div>

              {msg.text && (
                <div className={`p-4 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/50' : 'bg-blue-600/10 text-blue-400 border border-blue-500/50'}`}>
                  {msg.text}
                </div>
              )}

              <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all disabled:opacity-50 text-lg">
                {loading ? 'Processing...' : 'Pay Bill Securely →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
