import React, { useMemo } from 'react';
import { BarChart, Bar, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowDownToLine, ArrowRightLeft, ReceiptIndianRupee, Target, Activity, TrendingUp, TrendingDown, AlignLeft, BarChart3, Lightbulb } from 'lucide-react';
import { formatINR } from '../lib/utils';
import { motion } from 'motion/react';

export function Analytics({ appData }: { appData: any }) {
  const { transactions = [], goals = [] } = appData;

  const totalDeposits = useMemo(() => 
    transactions.filter((t: any) => t.icon === 'ArrowDownLeft').reduce((sum: number, t: any) => sum + t.amount, 0)
  , [transactions]);

  const totalTransfers = useMemo(() => 
    transactions.filter((t: any) => t.icon === 'ArrowUpRight').reduce((sum: number, t: any) => sum + t.amount, 0)
  , [transactions]);

  const totalBills = useMemo(() => 
    transactions.filter((t: any) => t.icon === 'FileText' || t.icon === 'Zap' || t.icon === 'ReceiptText').reduce((sum: number, t: any) => sum + t.amount, 0)
  , [transactions]);

  const totalSavings = useMemo(() => 
    transactions.filter((t: any) => t.icon === 'Target' && t.type === 'debit').reduce((sum: number, t: any) => sum + t.amount, 0)
  , [transactions]);

  const countDeposits = transactions.filter((t: any) => t.icon === 'ArrowDownLeft').length;
  const countTransfers = transactions.filter((t: any) => t.icon === 'ArrowUpRight').length;
  const countBills = transactions.filter((t: any) => t.icon === 'FileText' || t.icon === 'Zap' || t.icon === 'ReceiptText').length;
  const countSavings = transactions.filter((t: any) => t.icon === 'Target' && t.type === 'debit').length;

  const totalSpent = totalTransfers + totalBills + totalSavings;

  const getPercentage = (amount: number) => {
    if (totalSpent === 0) return 0;
    return Math.round((amount / totalSpent) * 100);
  };

  const spendingData = [
    { name: 'Transfers', value: getPercentage(totalTransfers), amount: totalTransfers, color: '#3b82f6' },
    { name: 'Bills', value: getPercentage(totalBills), amount: totalBills, color: '#8b5cf6' },
    { name: 'Savings', value: getPercentage(totalSavings), amount: totalSavings, color: '#10b981' }
  ].filter(d => d.value > 0);

  const highestSpendingCategory = useMemo(() => {
    if (spendingData.length === 0) return 'None';
    return [...spendingData].sort((a, b) => b.amount - a.amount)[0].name;
  }, [spendingData]);

  const monthlyChartData = useMemo(() => {
    const monthlyData: Record<string, { month: string; added: number; spent: number; timestamp: number }> = {};
    
    transactions.forEach((t: any) => {
      const date = new Date(t.date);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { month: monthYear, added: 0, spent: 0, timestamp: date.getTime() };
      }
      
      if (t.type === 'credit') {
        monthlyData[monthYear].added += t.amount;
      } else if (t.type === 'debit') {
        monthlyData[monthYear].spent += t.amount;
      }
    });

    return Object.values(monthlyData).sort((a, b) => a.timestamp - b.timestamp);
  }, [transactions]);

  const numMonths = monthlyChartData.length || 1;
  const avgMonthlySpending = totalSpent / numMonths;

  const largestTransaction = useMemo(() => {
    if (transactions.length === 0) return null;
    return transactions.reduce((max: any, t: any) => (t.amount > max.amount ? t : max), transactions[0]);
  }, [transactions]);

  const getTransactionLabel = (t: any) => {
    if (t.icon === 'ArrowDownLeft') return 'Deposit';
    if (t.icon === 'ArrowUpRight') return 'Transfer';
    if (t.icon === 'FileText' || t.icon === 'Zap' || t.icon === 'ReceiptText') return 'Bill Payment';
    if (t.icon === 'Target') return 'Savings Tracker';
    return t.type === 'credit' ? 'Credit' : 'Debit';
  };

  const activeGoalsCount = goals.filter((g: any) => g.status !== 'withdrawn').length;
  const avgTransactionAmount = transactions.length > 0 
    ? transactions.reduce((sum: number, t: any) => sum + t.amount, 0) / transactions.length 
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-400" />
          Financial Analytics
        </h2>
        <p className="text-gray-400 mt-2 font-medium">Overview of your financial activity and account performance.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/20 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute -top-2 -right-2 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowDownToLine className="w-10 h-10 text-emerald-400" />
          </div>
          <div className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Total Deposits</div>
          <div className="text-2xl font-light text-white tracking-tight">{formatINR(totalDeposits)}</div>
        </div>

        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/20 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute -top-2 -right-2 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowRightLeft className="w-10 h-10 text-blue-400" />
          </div>
          <div className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Total Transfers Sent</div>
          <div className="text-2xl font-light text-white tracking-tight">{formatINR(totalTransfers)}</div>
        </div>

        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/20 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute -top-2 -right-2 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <ReceiptIndianRupee className="w-10 h-10 text-purple-400" />
          </div>
          <div className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Total Bills Paid</div>
          <div className="text-2xl font-light text-white tracking-tight">{formatINR(totalBills)}</div>
        </div>

        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/20 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute -top-2 -right-2 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target className="w-10 h-10 text-orange-400" />
          </div>
          <div className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Savings Contributions</div>
          <div className="text-2xl font-light text-white tracking-tight">{formatINR(totalSavings)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Transaction Breakdown */}
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden lg:col-span-1 shadow-md min-w-0">
          <h3 className="font-medium text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-gray-400" /> Transaction Breakdown
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400">Deposits</span>
              <span className="text-white font-medium bg-[#1A1E26] px-3 py-1 rounded-lg">{countDeposits}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400">Transfers</span>
              <span className="text-white font-medium bg-[#1A1E26] px-3 py-1 rounded-lg">{countTransfers}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400">Bill Payments</span>
              <span className="text-white font-medium bg-[#1A1E26] px-3 py-1 rounded-lg">{countBills}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400">Savings Top-Ups</span>
              <span className="text-white font-medium bg-[#1A1E26] px-3 py-1 rounded-lg">{countSavings}</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden lg:col-span-2 shadow-md min-w-0">
          <h3 className="font-medium text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" /> Monthly Activity
          </h3>
          <div className="h-64 w-full">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatINR(value)}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1A1E26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                  <Bar dataKey="added" name="Deposits" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} barSize={monthlyChartData.length === 1 ? 60 : undefined} />
                  <Bar dataKey="spent" name="Expenses" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} barSize={monthlyChartData.length === 1 ? 60 : undefined} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No activity data available yet</div>
            )}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        {/* Spending Overview */}
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-md min-w-0 flex flex-col">
          <h3 className="font-medium text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-gray-400" /> Spending Overview
          </h3>
          {spendingData.length > 0 ? (
            <div className="space-y-6 flex-1">
              {spendingData.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <div className="text-sm text-gray-300">{item.name}</div>
                      <div className="text-xs text-gray-500 font-medium">{formatINR(item.amount)}</div>
                    </div>
                    <span className="text-white font-medium text-sm">{item.value}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1 text-gray-500">No spending data available</div>
          )}
        </div>

        {/* Largest Transaction Card */}
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-md min-w-0 flex flex-col">
          <h3 className="font-medium text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" /> Largest Transaction
          </h3>
          {largestTransaction ? (
            <div className="flex flex-col flex-1 space-y-3 justify-between">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-gray-400 text-xs uppercase tracking-widest">Type</span>
                <span className="text-white font-medium">{getTransactionLabel(largestTransaction)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-gray-400 text-xs uppercase tracking-widest">Amount</span>
                <span className="text-lg text-emerald-400 font-medium tracking-tight">{formatINR(largestTransaction.amount)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-gray-400 text-xs uppercase tracking-widest">Date</span>
                <span className="text-white font-medium">{new Date(largestTransaction.date).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1 text-gray-500">No transactions available</div>
          )}
        </div>

        {/* Account Statistics */}
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-md min-w-0 flex flex-col">
          <h3 className="font-medium text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" /> Account Statistics
          </h3>
          <div className="space-y-0.5 flex flex-col flex-1 justify-between">
             <div className="flex justify-between items-center border-b border-white/5 py-3">
              <span className="text-gray-400">Total Transactions</span>
              <span className="text-white font-medium">{transactions.length}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 py-3">
              <span className="text-gray-400">Avg. Transaction</span>
              <span className="text-white font-medium">{formatINR(avgTransactionAmount)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 py-3">
              <span className="text-gray-400">Current Balance</span>
              <span className="text-white font-medium">{formatINR(appData.balance || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-400">Active Savings Goals</span>
              <span className="text-white font-medium">{activeGoalsCount}</span>
            </div>
          </div>
        </div>

        {/* Analytics Insights */}
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-md group hover:border-blue-500/20 transition-colors min-w-0 flex flex-col">
          <h3 className="font-medium text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-emerald-400" /> Quick Insights
          </h3>
          <div className="space-y-0.5 flex flex-col flex-1 justify-between">
            <div className="flex flex-col border-b border-white/5 py-3">
              <span className="text-gray-400 text-xs uppercase tracking-wider">Highest Spending</span>
              <span className="text-white font-medium mt-1">{highestSpendingCategory}</span>
            </div>
            <div className="flex flex-col border-b border-white/5 py-3">
              <span className="text-gray-400 text-xs uppercase tracking-wider">Total Money Saved</span>
              <span className="text-white font-medium mt-1">{formatINR(totalSavings)}</span>
            </div>
            <div className="flex flex-col py-3">
              <span className="text-gray-400 text-xs uppercase tracking-wider">Avg. Monthly Spent</span>
              <span className="text-white font-medium mt-1">{formatINR(avgMonthlySpending)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
