import React, { useState } from 'react';
import { Target, Plus, Lock, Unlock } from 'lucide-react';
import { formatINR } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createGoal, fundGoal, withdrawGoal } from '../lib/firebaseUtils';

export function Goals({ user, goals, balance, onComplete }: { user: string, goals: any[], balance: number, onComplete: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null); // For funding
  const [loadingAction, setLoadingAction] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const targetAmount = Number(formData.get('amount'));
    const lockMonths = Number(formData.get('lockDuration') || 0);
    
    try {
      await createGoal(user, name, targetAmount, lockMonths);
      setShowCreate(false);
      onComplete();
    } catch (err) {
      console.error(err);
      alert('Failed to create goal');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleFund = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction(true);
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    
    if (amount > balance) {
      alert("Insufficient balance!");
      setLoadingAction(false);
      return;
    }

    try {
      await fundGoal(user, selectedGoal.id, amount, selectedGoal.currentAmount, selectedGoal.name);
      setSelectedGoal(null);
      onComplete();
    } catch (err) {
      console.error(err);
      alert('Failed to add funds');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleWithdraw = async (goal: any) => {
    if (goal.lockedUntil && Date.now() < goal.lockedUntil) {
      const unlockDate = new Date(goal.lockedUntil).toLocaleDateString();
      alert(`This goal is locked until ${unlockDate}. You cannot withdraw funds right now.`);
      return;
    }
    
    if (!window.confirm(`Are you sure you want to withdraw ${formatINR(goal.currentAmount)} from "${goal.name}" back to your main balance?`)) return;

    setLoadingAction(true);
    try {
      await withdrawGoal(user, goal.id, goal.currentAmount, goal.name);
      onComplete();
    } catch (err) {
      console.error(err);
      alert('Failed to withdraw goal');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><Target className="text-blue-400" /> Savings Goals</h2>
          <p className="text-gray-500">Lock your funds to reach your goals faster.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-[#16191F] border border-white/5 hover:border-blue-500/50 hover:text-blue-400 text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Goal
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden mb-8">
            <form onSubmit={handleCreate} className="bg-[#16191F] border border-blue-500/30 rounded-3xl p-6 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Goal Name</label>
                <input required name="name" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder="e.g. Dream Car" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Amount (₹)</label>
                <input required name="amount" type="number" min="1" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder="50000" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lock Duration</label>
                <select name="lockDuration" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors appearance-none">
                  <option value="0">No Lock (Flexible)</option>
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">1 Year</option>
                </select>
              </div>
              <button disabled={loadingAction} type="submit" className="bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 min-w-[120px]">
                {loadingAction ? '...' : 'Create'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map(goal => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const isLocked = goal.lockedUntil && Date.now() < goal.lockedUntil;
          const unlockStr = goal.lockedUntil ? new Date(goal.lockedUntil).toLocaleDateString() : '';

          return (
            <div key={goal.id} className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-medium flex items-center gap-2">
                    {goal.name} 
                    {isLocked ? <Lock className="w-4 h-4 text-orange-400" /> : <Unlock className="w-4 h-4 text-green-400" />}
                  </h3>
                  {isLocked && <p className="text-xs text-orange-400/80 mt-1">Locked until {unlockStr}</p>}
                </div>
                <div className="text-sm font-medium text-blue-400 bg-blue-600/10 px-3 py-1 rounded-full">{progress}%</div>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Saved: {formatINR(goal.currentAmount)}</span>
                  <span className="text-gray-500">Target: {formatINR(goal.targetAmount)}</span>
                </div>
                <div className="h-3 w-full bg-[#0A0B0D] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${progress}%` }} 
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" 
                  />
                </div>
              </div>

              {selectedGoal?.id === goal.id ? (
                <form onSubmit={handleFund} className="flex gap-2">
                  <input required name="amount" type="number" min="1" max={balance} className="flex-1 bg-[#0A0B0D] border border-white/5 rounded-lg px-3 text-sm focus:border-blue-500" placeholder={`Amount (Max: ${formatINR(balance)})`} />
                  <button disabled={loadingAction} type="submit" className="bg-blue-600 text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">Add</button>
                  <button type="button" onClick={() => setSelectedGoal(null)} className="bg-gray-800 text-gray-300 text-sm px-4 py-2 rounded-lg">Cancel</button>
                </form>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setSelectedGoal(goal)} className="flex-1 py-2 bg-[#0A0B0D] border border-white/5 rounded-xl text-sm font-medium text-blue-400 opacity-80 group-hover:opacity-100 transition-opacity hover:border-blue-500/50">
                    + Add Funds
                  </button>
                  <button 
                    onClick={() => handleWithdraw(goal)} 
                    disabled={loadingAction}
                    title={isLocked ? `Locked until ${unlockStr}` : 'Withdraw & Delete Goal'}
                    className={`px-4 py-2 bg-[#0A0B0D] border border-white/5 rounded-xl text-sm font-medium transition-opacity ${isLocked ? 'text-gray-600 cursor-not-allowed' : 'text-red-400 hover:border-red-500/50 opacity-80 group-hover:opacity-100'}`}
                  >
                    Withdraw
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {goals.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-500 border border-dashed border-white/5 rounded-2xl">
            You don't have any savings goals yet.
          </div>
        )}
      </div>
    </div>
  );
}
