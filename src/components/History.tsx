import { useState } from 'react';
import { formatINR } from '../lib/utils';
import { Clock, Search, ArrowDownLeft, ArrowUpRight, ReceiptText, Target, PlusCircle, MinusCircle } from 'lucide-react';

const icons: any = {
  ArrowDownLeft, ArrowUpRight, FileText: ReceiptText, Target, PlusCircle, MinusCircle
};

export function History({ transactions }: { transactions: any[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');

  const filtered = transactions.filter(tx => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const dA = new Date(a.date).getTime();
    const dB = new Date(b.date).getTime();
    return sort === 'desc' ? dB - dA : dA - dB;
  });

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><Clock className="text-blue-400" /> Transaction History</h2>
        <p className="text-gray-500">View and search through your past transactions.</p>
      </div>

      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-12 pr-4 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-4">
            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value as any)}
              className="bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none"
            >
              <option value="all">All Types</option>
              <option value="credit">Money In (Credit)</option>
              <option value="debit">Money Out (Debit)</option>
            </select>
            <select 
              value={sort} 
              onChange={e => setSort(e.target.value as any)}
              className="bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none"
            >
              <option value="desc">Latest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-dashed border-white/5 rounded-2xl">
              No transactions found matching your criteria.
            </div>
          ) : (
            filtered.map(tx => {
              const Icon = icons[tx.icon] || ReceiptText;
              return (
                <div key={tx.id} className="flex items-center justify-between p-5 bg-[#0A0B0D] border border-white/5 hover:border-gray-700 transition-colors rounded-2xl group">
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${tx.type === 'credit' ? 'bg-blue-600/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-medium text-lg text-gray-200">{tx.name}</div>
                      <div className="text-sm text-gray-500">{new Date(tx.date).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className={`font-semibold text-xl ${tx.type === 'credit' ? 'text-blue-400' : 'text-gray-200'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}
