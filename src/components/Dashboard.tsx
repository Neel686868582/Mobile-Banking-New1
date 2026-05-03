import { formatINR } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowUpRight, ArrowDownLeft, Wallet, Building2, Smartphone, Zap, Droplet, Tv } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

const txIcons: any = {
  ArrowUpRight: ArrowUpRight,
  ArrowDownLeft: ArrowDownLeft,
  FileText: ReceiptTextIcon,
  Target: TargetIcon,
  PlusCircle: PlusCircleIcon,
  MinusCircle: MinusCircleIcon
};

// Generic icons
function ReceiptTextIcon(props: any) { return <ReceiptTextIcon {...props} /> } // placeholder
function TargetIcon(props: any) { return <TargetIcon {...props} /> }
function PlusCircleIcon(props: any) { return <PlusCircleIcon {...props} /> }
function MinusCircleIcon(props: any) { return <MinusCircleIcon {...props} /> }

export function Dashboard({ userData, setActiveTab }: { userData: any, setActiveTab: (t: string) => void }) {
  
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
            <div className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Total Balance</div>
            <div className="text-4xl md:text-5xl font-sans tracking-tight text-white mb-8 truncate">
              {formatINR(userData.balance)}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-gray-500 text-xs mb-1">Bank</div>
                <div className="font-semibold text-blue-400 text-sm sm:text-base">SBI Savings</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">A/C No.</div>
                <div className="font-semibold text-gray-200 text-sm sm:text-base">XXXX {userData.accountNumber ? userData.accountNumber.slice(-4) : '4821'}</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-gray-500 text-xs mb-1">IFSC</div>
                <div className="font-semibold text-gray-200">SBI001</div>
              </div>
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
            {userData.transactions?.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-[#0A0B0D] border border-white/5 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-blue-600/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                    {tx.type === 'credit' ? <ArrowDownLeft className="w-5 h-5"/> : <ArrowUpRight className="w-5 h-5"/>}
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
            ))}
            {(!userData.transactions || userData.transactions.length === 0) && (
              <div className="text-center text-gray-500 text-sm py-8">No transactions yet</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
