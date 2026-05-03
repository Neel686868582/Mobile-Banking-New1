import React, { useState } from 'react';
import { formatINR } from '../lib/utils';
import { ArrowRightLeft } from 'lucide-react';
import { doTransfer } from '../lib/firebaseUtils';

export function Transfer({ user, onComplete }: { user: string, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const name = formData.get('name') as string;
    const method = formData.get('method') as string;

    try {
      await doTransfer(user, name, amount, method);
      setMsg({ text: `Successfully sent ${formatINR(amount)} to ${name}`, type: 'success' });
      (e.target as HTMLFormElement).reset();
      onComplete();
    } catch (err: any) {
      setMsg({ text: err.message || 'Transfer failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><ArrowRightLeft className="text-blue-400" /> Send Money</h2>
        <p className="text-gray-500">Transfer funds to any bank account instantly.</p>
      </div>

      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recipient Name</label>
            <input required name="name" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="e.g. Priya Sharma" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Account Number / UPI</label>
            <input required name="acc" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Enter recipient details" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Amount (₹)</label>
            <input required name="amount" type="number" min="1" step="0.01" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-xl font-medium" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Method</label>
            <select name="method" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none">
              <option value="UPI">UPI</option>
              <option value="IMPS">IMPS</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
            </select>
          </div>

          {msg.text && (
            <div className={`p-4 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/50' : 'bg-blue-600/10 text-blue-400 border border-blue-500/50'}`}>
              {msg.text}
            </div>
          )}

          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all disabled:opacity-50 text-lg">
            {loading ? 'Processing...' : 'Transfer Money →'}
          </button>
        </form>
      </div>
    </div>
  );
}
