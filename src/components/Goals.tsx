import React, { useState } from 'react';
import { Target, Plus, Lock, Unlock, Zap, Trophy, ShieldAlert, Sparkles, Medal } from 'lucide-react';
import { formatINR, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createGoal, fundGoal, withdrawGoal } from '../lib/firebaseUtils';
import { toast } from 'react-hot-toast';
import { MfaModal } from './MfaModal';

export function Goals({ user, userData, goals, balance, onComplete }: { user: string, userData?: any, goals: any[], balance: number, onComplete: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [mode, setMode] = useState<'strict' | 'flexible'>('strict');
  const [pendingWithdrawal, setPendingWithdrawal] = useState<any>(null);

  const [showMfa, setShowMfa] = useState(false);
  const [mfaAction, setMfaAction] = useState<(() => Promise<void>) | null>(null);

  const executeWithMfa = async (action: () => Promise<void>) => {
    if (userData?.twoFactorEnabled && userData?.require2FAForTransactions) {
      setMfaAction(() => action);
      setShowMfa(true);
    } else {
      await action();
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const targetAmount = Number(formData.get('targetAmount'));
    const lockAmount = Number(formData.get('lockAmount') || 0);
    const lockMonths = Number(formData.get('lockDuration') || 0);
    const category = formData.get('category') as string;
    
    if (lockAmount > balance) {
      toast.error("Insufficient balance to lock initial amount!");
      return;
    }

    const performCreate = async () => {
      setLoadingAction(true);
      try {
        await createGoal(user, name, targetAmount, lockAmount, lockMonths, category, mode);
        await new Promise(r => setTimeout(r, 2000));
        setShowCreate(false);
        setShowMfa(false);
        toast.success("Smart saving goal created!");
        onComplete();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to create goal');
      } finally {
        setLoadingAction(false);
      }
    };

    if (lockAmount > 0) {
      executeWithMfa(performCreate);
    } else {
      performCreate();
    }
  };

  const handleFund = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    
    if (amount > balance) {
      toast.error("Insufficient balance!");
      return;
    }

    executeWithMfa(async () => {
      setLoadingAction(true);
      try {
        await fundGoal(user, selectedGoal.id, amount, selectedGoal.currentAmount, selectedGoal.name);
        await new Promise(r => setTimeout(r, 2000));
        setSelectedGoal(null);
        setShowMfa(false);
        toast.success(`Successfully added ${formatINR(amount)} to goal.`);
        onComplete();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to add funds');
      } finally {
        setLoadingAction(false);
      }
    });
  };

  const handleWithdrawClick = async (goal: any) => {
    if (goal.mode === 'strict' && goal.lockedUntil && Date.now() < new Date(goal.lockedUntil).getTime()) {
      const unlockDate = new Date(goal.lockedUntil).toLocaleDateString();
      toast.error(`STRICT MODE: Goal is locked until ${unlockDate}. Early withdrawal disabled.`);
      return;
    }

    if (goal.mode === 'flexible' && goal.lockedUntil && Date.now() < new Date(goal.lockedUntil).getTime()) {
      setPendingWithdrawal(goal);
      return;
    }
    
    await processWithdrawal(goal);
  };

  const processWithdrawal = async (goal: any) => {
    setPendingWithdrawal(null);
    executeWithMfa(async () => {
      setLoadingAction(true);
      try {
        let withdrawAmount = goal.currentAmount;
        const isPastDueDate = !goal.lockedUntil || Date.now() >= new Date(goal.lockedUntil).getTime();
        
        let penaltyApplied = 0;
        let bonusApplied = 0;
        let unlockedEarly = false;
        
        if (goal.mode === 'flexible' && !isPastDueDate) {
          unlockedEarly = true;
          penaltyApplied = withdrawAmount * 0.02;
          withdrawAmount -= penaltyApplied;
        } else if (isPastDueDate && goal.bonusEligible) {
          const bonus = calculateBonus(goal);
          if (bonus > 0) {
            bonusApplied = bonus;
            withdrawAmount += bonus;
          }
        }
        
        await withdrawGoal(
          user, 
          goal.id, 
          withdrawAmount, 
          goal.name,
          goal.mode,
          goal.currentAmount,
          penaltyApplied,
          bonusApplied,
          unlockedEarly
        );
        
        await new Promise(r => setTimeout(r, 2000));
        
        if (unlockedEarly) {
          toast.success(`Goal withdrawn with 2% early penalty.`);
        } else if (bonusApplied > 0) {
          toast.success(`Goal withdrawn. ${formatINR(bonusApplied)} bonus applied!`);
        } else {
          toast.success(`Goal "${goal.name}" withdrawn successfully.`);
        }
        
        setShowMfa(false);
        onComplete();
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to withdraw goal');
      } finally {
        setLoadingAction(false);
      }
    });
  };

  const getBadge = (progress: number) => {
    if (progress >= 100) return <Medal className="w-5 h-5 text-indigo-400" />;
    if (progress >= 75) return <Medal className="w-5 h-5 text-yellow-500" />; // Gold
    if (progress >= 50) return <Medal className="w-5 h-5 text-gray-300" />; // Silver
    if (progress >= 25) return <Medal className="w-5 h-5 text-orange-400" />; // Bronze
    return null;
  };

  function calculateBonus(goal: any) {
    if (!goal.bonusEligible) return 0;
    const baseInterest = 0.04; // 4% APY
    const strictBonus = goal.mode === 'strict' ? 0.02 : 0; // 2% Extra for strict
    const durationMultiplier = (goal.lockMonths || 0) / 12;
    return goal.currentAmount * (baseInterest + strictBonus) * durationMultiplier;
  }

  return (
    <div className="max-w-5xl mx-auto mt-10 p-4">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-sans font-medium tracking-tight mb-2 flex items-center gap-3"><Target className="text-blue-400" /> Smart Saving Goals</h2>
          <p className="text-gray-500">Lock your funds, earn bonuses, and build discipline.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 hover:bg-blue-500 text-gray-950 text-sm font-semibold px-4 py-3 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20">
          <Plus className="w-5 h-5" /> New Smart Goal
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden mb-8">
            <form onSubmit={handleCreate} className="bg-[#16191F] border border-blue-500/30 shadow-2xl rounded-3xl p-6 lg:p-8 space-y-6">
              <h3 className="text-xl font-medium border-b border-white/5 pb-4">Create New Goal</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Goal Name</label>
                  <input required name="name" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder="e.g. Dream Vacation" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                  <select name="category" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors appearance-none">
                    <option value="Education">Education</option>
                    <option value="Travel">Travel</option>
                    <option value="Emergency">Emergency Fund</option>
                    <option value="Vehicle">Vehicle</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Amount (₹)</label>
                  <input required name="targetAmount" type="number" min="1" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder="e.g. 50000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Initial Lock Amount (₹)</label>
                  <input name="lockAmount" type="number" min="0" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder={`Available: ${formatINR(balance)}`} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lock Duration (Months)</label>
                <div className="flex gap-4 items-center">
                  <div className="relative flex-1 flex items-center bg-[#0A0B0D] border border-white/5 rounded-xl px-4 focus-within:border-blue-500 transition-colors">
                    <input 
                      required 
                      name="lockDuration" 
                      type="number" 
                      min="0" 
                      max="120"
                      defaultValue="3"
                      className="bg-transparent border-none text-white focus:outline-none w-full py-3" 
                      placeholder="e.g. 6" 
                    />
                    <div className="text-gray-500 text-sm pl-2 pointer-events-none">
                      Months
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex-1">
                    Set 0 for Flexible / No Lock
                  </div>
                </div>
              </div>

              <div className="p-5 bg-[#0A0B0D] rounded-2xl border border-white/5">
                <label className="block text-sm font-semibold text-gray-300 mb-4">Select Protection Mode</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    onClick={() => setMode('strict')} 
                    className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all", mode === 'strict' ? "border-blue-500 bg-blue-500/10" : "border-transparent bg-[#16191F] hover:bg-white/5")}
                  >
                    <div className="flex items-center gap-2 text-blue-400 font-medium mb-2"><ShieldAlert className="w-5 h-5" /> Strict Mode</div>
                    <p className="text-xs text-gray-400 leading-relaxed">No withdrawals until maturity. Maximize your bonus rewards (+2% boost).</p>
                  </div>
                  <div 
                    onClick={() => setMode('flexible')} 
                    className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all", mode === 'flexible' ? "border-indigo-500 bg-indigo-500/10" : "border-transparent bg-[#16191F] hover:bg-white/5")}
                  >
                    <div className="flex items-center gap-2 text-indigo-400 font-medium mb-2"><Unlock className="w-5 h-5" /> Flexible Mode</div>
                    <p className="text-xs text-gray-400 leading-relaxed">Withdraw early if needed (after 24h), but incur a 2% penalty and lose bonus eligibility.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors">Cancel</button>
                <button disabled={loadingAction} type="submit" className="bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-50">
                  {loadingAction ? '...' : 'Initialize Goal'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingWithdrawal && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-6 mb-8 shadow-xl relative z-20"
          >
            <div className="flex items-start gap-4 text-orange-400 mb-6">
              <ShieldAlert className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-2">FLEXIBLE MODE WARNING</h3>
                <p className="text-gray-300 leading-relaxed text-sm">
                  Withdrawing early will result in a 2% penalty and loss of bonuses. 
                  Are you sure you want to proceed?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button 
                type="button" 
                onClick={() => setPendingWithdrawal(null)} 
                className="px-6 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                disabled={loadingAction}
              >
                Cancel
              </button>
              <button 
                onClick={() => processWithdrawal(pendingWithdrawal)} 
                disabled={loadingAction}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-50"
              >
                {loadingAction ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {goals.filter((g: any) => g.status !== 'withdrawn').map(goal => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const isLocked = goal.lockedUntil && Date.now() < new Date(goal.lockedUntil).getTime();
          const unlockStr = goal.lockedUntil ? new Date(goal.lockedUntil).toLocaleDateString() : '';
          const estimatedBonus = calculateBonus(goal);

          return (
            <div key={goal.id} className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono px-2 py-0.5 bg-white/5 text-gray-400 rounded-md uppercase tracking-wider">{goal.category || 'Goal'}</span>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1", goal.mode === 'strict' ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400')}>
                      {goal.mode === 'strict' ? <ShieldAlert className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {goal.mode === 'strict' ? 'Strict' : 'Flexible'}
                    </span>
                  </div>
                  <h3 className="text-xl font-medium flex items-center gap-2">
                    {goal.name} 
                  </h3>
                  {isLocked && <p className="text-xs text-orange-400/80 mt-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Locked until {unlockStr}</p>}
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-sm font-medium text-blue-400 bg-blue-600/10 px-3 py-1 rounded-lg">{progress}%</div>
                  {getBadge(progress)}
                </div>
              </div>
              
              {/* Stats Block */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-[#0A0B0D] rounded-2xl border border-white/5">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Saved Amount</div>
                  <div className="text-lg font-medium text-white">{formatINR(goal.currentAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-500/80 mb-1 flex items-center gap-1"><Trophy className="w-3 h-3" /> Est. Bonus</div>
                  <div className="text-emerald-400 font-medium">{estimatedBonus > 0 ? `+${formatINR(estimatedBonus)}` : '-'}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-end text-xs mb-2">
                  <span className="text-gray-500">Target: {formatINR(goal.targetAmount)}</span>
                </div>
                <div className="h-3 w-full bg-[#0A0B0D] rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${progress}%` }} 
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={cn("h-full rounded-full relative", progress >= 100 ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-gradient-to-r from-blue-600 to-blue-400")} 
                  />
                </div>
              </div>

              {selectedGoal?.id === goal.id ? (
                <form onSubmit={handleFund} className="flex gap-2">
                  <input required name="amount" type="number" min="1" max={balance} className="flex-1 bg-[#0A0B0D] border border-white/5 rounded-xl px-4 text-sm focus:border-blue-500 outline-none text-white" placeholder={`Amount (Max: ${formatINR(balance)})`} />
                  <button disabled={loadingAction} type="submit" className="bg-blue-600 text-gray-950 text-sm font-semibold px-6 py-3 rounded-xl disabled:opacity-50 hover:bg-blue-500 transition-colors">Deposit</button>
                  <button type="button" onClick={() => setSelectedGoal(null)} className="bg-transparent border border-white/10 hover:bg-white/5 text-gray-300 text-sm px-4 py-3 rounded-xl transition-colors">Cancel</button>
                </form>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setSelectedGoal(goal)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-medium text-white transition-all">
                    Top Up
                  </button>
                  <button 
                    onClick={() => handleWithdrawClick(goal)} 
                    disabled={loadingAction}
                    className={cn(
                      "px-6 py-3 border rounded-xl text-sm font-medium transition-all",
                      isLocked && goal.mode === 'strict' 
                        ? 'bg-transparent border-white/5 text-gray-600 cursor-not-allowed' 
                        : 'bg-transparent border-red-500/20 text-red-500/80 hover:bg-red-500/10 hover:text-red-400'
                    )}
                  >
                    Withdraw
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {goals.filter((g: any) => g.status !== 'withdrawn').length === 0 && (
          <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center p-12 text-gray-500 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
            <Target className="w-12 h-12 mb-4 opacity-20" />
            <p>You don't have any smart savings goals yet.</p>
            <p className="text-sm mt-2 opacity-60">Create one to start building your discipline bonus.</p>
          </div>
        )}
      </div>

      <MfaModal 
        isOpen={showMfa}
        onClose={() => setShowMfa(false)}
        onSuccess={() => mfaAction && mfaAction()}
        secret={userData?.twoFactorSecret || ''}
      />
    </div>
  );
}
