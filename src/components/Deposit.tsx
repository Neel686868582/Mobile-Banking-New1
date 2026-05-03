import React, { useState } from 'react';
import { formatINR } from '../lib/utils';
import { ArrowDownToLine } from 'lucide-react';
import { doDeposit } from '../lib/firebaseUtils';

export function Deposit({ user, onComplete }: { user: string, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const source = formData.get('source') as string;

    try {
      await doDeposit(user, amount, source);
      setMsg({ text: `Successfully deposited ${formatINR(amount)}`, type: 'success' });
      (e.target as HTMLFormElement).reset();
      onComplete();
    } catch (err: any) {
      setMsg({ text: err.message || 'Deposit failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><ArrowDownToLine className="text-blue-400" /> Deposit Funds</h2>
        <p className="text-gray-500">Add money to your account securely.</p>
      </div>

      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Deposit Source</label>
            <select name="source" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none">
              <option value="UPI">UPI (Any App)</option>
              <option value="Net Banking">Net Banking</option>
              <option value="Debit Card">Debit / Credit Card</option>
              <option value="Cash/Cheque">Cash / Cheque Deposit</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Amount (₹)</label>
            <input required name="amount" type="number" min="1" step="0.01" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-xl font-medium" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reference / UTR No. (Optional)</label>
            <input name="ref" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="e.g. 1234567890" />
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/50' : 'bg-blue-600/10 text-blue-400 border border-blue-500/50'}`}>
              {msg.text}
            </div>
          )}

          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all disabled:opacity-50 text-lg">
            {loading ? 'Processing...' : 'Deposit Money →'}
          </button>
        </form>
      </div>
    </div>
  );
}
