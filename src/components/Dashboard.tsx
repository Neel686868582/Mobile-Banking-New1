import { useState } from 'react';
import { formatINR } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowUpRight, ArrowDownLeft, Wallet, Building2, Smartphone, Zap, Droplet, Tv, CheckCircle2, Download, X, ReceiptText, Target, PlusCircle, MinusCircle, Shield } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import { toast } from 'react-hot-toast';
import { CompactVintageBadge } from './CompactVintageBadge';
import { VintageSeal } from './VintageSeal';

const txIcons: any = {
  ArrowUpRight: ArrowUpRight,
  ArrowDownLeft: ArrowDownLeft,
  FileText: ReceiptText,
  Target: Target,
  PlusCircle: PlusCircle,
  MinusCircle: MinusCircle
};

export function Dashboard({ userData, setActiveTab, onEnable2FA }: { userData: any, setActiveTab: (t: string) => void, onEnable2FA?: () => void }) {
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const handleDownloadReceipt = async () => {
    if (!selectedTx) return;
    try {
      const element = document.getElementById('receipt-content-dashboard');
      if (!element) return;
      
      const dataUrl = await htmlToImage.toJpeg(element, { 
        backgroundColor: '#16191F',
        pixelRatio: 2
      });
      
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `receipt_${selectedTx.id}.png`;
      a.click();
      toast.success("Receipt downloaded successfully!");
    } catch(err: any) {
      toast.error(`Failed to download receipt: ${err?.message || "Unknown error"}`);
    }
  };
  
  // mock chart data for past 7 days based on transactions, or generic if not enough
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    return {
      date: format(d, 'MMM dd'),
      balance: Math.max(1000, userData.balance - (6-i)*1500 + Math.random()*3000), 
    };
  });

  return (
    <div className="space-y-6">
      
      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-950 border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between min-h-[240px]">
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-2">
              <div className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Total Balance</div>
              <CompactVintageBadge enabled={userData.twoFactorEnabled} onClick={onEnable2FA} />
            </div>
            <div className="text-4xl md:text-5xl font-sans tracking-tight text-white mb-8 truncate">
              {formatINR(userData.balance)}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-gray-500 text-xs mb-1">Bank</div>
                <div className="font-semibold text-blue-400 text-sm sm:text-base">RupeePay Bank</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">A/C No.</div>
                <div className="font-semibold text-gray-200 text-sm sm:text-base">XXXX {userData.accountNumber ? userData.accountNumber.slice(-4) : '4821'}</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-gray-500 text-xs mb-1">IFSC</div>
                <div className="font-semibold text-gray-200">RPAY0001234</div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <VintageSeal className="w-8 h-8 drop-shadow" />
              <span className="text-[13px] sm:text-[14px] font-sans font-semibold text-white/90 uppercase tracking-[0.15em] leading-tight">
                RUPEEPAY SECURED BY 2FA
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="col-span-1 flex flex-row lg:flex-col gap-4 lg:gap-6">
          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-4 lg:p-6 flex-1 flex flex-col justify-center">
            <div className="text-gray-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 sm:mb-2">Total Income</div>
            <div className="text-xl sm:text-2xl font-medium text-blue-400 truncate">{formatINR(userData.income || 0)}</div>
          </div>
          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-4 lg:p-6 flex-1 flex flex-col justify-center">
            <div className="text-gray-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 sm:mb-2">Total Expenses</div>
            <div className="text-xl sm:text-2xl font-medium text-red-400 truncate">{formatINR(userData.expenses || 0)}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => setActiveTab('transfer')} className="flex-1 bg-[#16191F] border border-white/5 hover:border-blue-500/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/5 group">
          <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowUpRight className="w-5 h-5" /></div>
          <span className="text-sm font-medium">Send</span>
        </button>
        <button onClick={() => setActiveTab('deposit')} className="flex-1 bg-[#16191F] border border-white/5 hover:border-blue-500/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/5 group">
          <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowDownLeft className="w-5 h-5" /></div>
          <span className="text-sm font-medium">Receive</span>
        </button>
        <button onClick={() => setActiveTab('bills')} className="flex-1 bg-[#16191F] border border-white/5 hover:border-blue-500/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/5 group">
          <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform"><Zap className="w-5 h-5" /></div>
          <span className="text-sm font-medium">Bills</span>
        </button>
      </div>

      {/* Analytics & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6">
          <h3 className="text-lg font-medium mb-6">Balance Trend</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#3b82f6' }}
                  formatter={(val: number) => formatINR(val)}
                />
                <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">Recent Transactions</h3>
            <button onClick={() => setActiveTab('history')} className="text-sm text-blue-400 hover:underline">View All</button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {userData.transactions?.slice(0, 5).map((tx: any) => {
              const Icon = txIcons[tx.icon] || ReceiptText;
              return (
                <div 
                  key={tx.id} 
                  onClick={() => setSelectedTx(tx)}
                  className="flex items-center justify-between p-4 bg-[#0A0B0D] border border-white/5 hover:border-gray-700 transition-colors rounded-2xl cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-blue-600/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                      <Icon className="w-5 h-5"/>
                    </div>
                    <div>
                      <div className="font-medium">{tx.name}</div>
                      <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className={`font-semibold ${tx.type === 'credit' ? 'text-blue-400' : 'text-gray-200'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                  </div>
                </div>
              );
            })}
            {(!userData.transactions || userData.transactions.length === 0) && (
              <div className="text-center text-gray-500 text-sm py-8">No transactions yet</div>
            )}
          </div>
        </div>

      </div>
      
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedTx(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#16191F] border border-white/10 rounded-3xl p-8 shadow-2xl relative w-full max-w-md z-10"
            >
              <button 
                onClick={() => setSelectedTx(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white bg-[#0A0B0D] p-2 rounded-full border border-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div id="receipt-content-dashboard" className="p-8 pb-4 relative mt-4">
                <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
                <div className="mt-2 mb-6 text-center">
                  <h1 className="text-xl font-bold text-gray-300">MOBILE BANKING</h1>
                </div>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-500/10 text-green-500">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-2 text-center">{formatINR(selectedTx.amount)}</h2>
                <p className="font-medium mb-8 text-center text-green-400">
                  {selectedTx.type === 'credit' ? 'Received' : 'Sent/Paid'} Successfully
                </p>
                
                <div className="bg-[#0A0B0D] rounded-2xl p-6 mb-2 text-sm text-left border border-white/5 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{selectedTx.type === 'credit' ? 'From' : 'To'}</span>
                    <span className="text-white font-medium text-right max-w-[150px] truncate">{selectedTx.toName || selectedTx.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account / Source</span>
                    <span className="text-white">{selectedTx.toAcc || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-4">
                    <span className="text-gray-500">Transaction ID</span>
                    <span className="text-white font-mono text-xs max-w-[150px] truncate" title={selectedTx.id}>{selectedTx.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date & Time</span>
                    <span className="text-white text-right max-w-[150px]">{new Date(selectedTx.date).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Method</span>
                    <span className="text-white text-right max-w-[150px]">{selectedTx.method || 'System Internal'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 mt-6">
                <button 
                  onClick={handleDownloadReceipt}
                  className="w-full bg-[#232730] hover:bg-[#2A2F3A] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5 text-blue-400" /> Download Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
