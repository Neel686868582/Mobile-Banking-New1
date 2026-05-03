import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { formatINR } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function Loan() {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(10.5);
  const [months, setMonths] = useState(60);

  const emiData = useMemo(() => {
    if (!amount || !rate || !months) return { emi: 0, totalInterest: 0, totalPayment: 0, chart: [] };
    const r = (rate / 12) / 100;
    const n = months;
    
    // EMI Formula: P * r * (1+r)^n / ((1+r)^n - 1)
    let emi = 0;
    if (r === 0) {
      emi = amount / n;
    } else {
      emi = amount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    }
    
    const totalPayment = emi * n;
    const totalInterest = totalPayment - amount;

    // generate chart data (balance over time)
    let bal = amount;
    const chart = [];
    for(let i=0; i<=n; i++) {
        chart.push({ month: i, balance: Math.round(bal) });
        const interestForMonth = bal * r;
        const principalForMonth = emi - interestForMonth;
        bal -= principalForMonth;
    }

    return {
      emi,
      totalInterest,
      totalPayment,
      chart
    };
  }, [amount, rate, months]);


  return (
    <div className="max-w-5xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><Calculator className="text-blue-400" /> EMI Calculator</h2>
        <p className="text-gray-500">Plan your finances instantly with our loan calculator.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
          <div className="space-y-8">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Loan Amount</label>
                <span className="text-blue-400 font-medium">{formatINR(amount)}</span>
              </div>
              <input 
                type="range" min="10000" max="10000000" step="10000" 
                value={amount} onChange={e => setAmount(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Interest Rate (p.a)</label>
                <span className="text-blue-400 font-medium">{rate}%</span>
              </div>
              <input 
                type="range" min="1" max="25" step="0.1" 
                value={rate} onChange={e => setRate(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Tenure (Months)</label>
                <span className="text-blue-400 font-medium">{months} Months</span>
              </div>
              <input 
                type="range" min="6" max="360" step="6" 
                value={months} onChange={e => setMonths(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border border-blue-500/30 rounded-3xl p-8 flex-1 flex flex-col justify-center shadow-xl">
            <div className="text-blue-400/80 text-sm font-semibold uppercase tracking-wider mb-2">Monthly EMI</div>
            <div className="text-5xl font-sans tracking-tight text-white mb-6">
              {formatINR(emiData.emi)}
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-emerald-500/20 pt-6">
              <div>
                <div className="text-sm text-gray-400 mb-1">Total Interest</div>
                <div className="text-lg font-medium text-gray-200">{formatINR(emiData.totalInterest)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Total Payment</div>
                <div className="text-lg font-medium text-white">{formatINR(emiData.totalPayment)}</div>
              </div>
            </div>
          </div>

          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={emiData.chart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#3b82f6' }}
                  formatter={(val: number) => formatINR(val)}
                  labelFormatter={(label: any) => `Month ${label}`}
                />
                <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} fill="url(#colorBal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
