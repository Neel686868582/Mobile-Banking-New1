import React, { useState, useEffect } from 'react';
import { Target, Plus, Lock, Unlock, Zap, Trophy, ShieldAlert, Sparkles, Medal, UsersRound, Gift } from 'lucide-react';
import { formatINR, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createGoal, fundGoal, withdrawGoal, createGroupVault, markInvitationSeen } from '../lib/firebaseUtils';
import { toast } from 'react-hot-toast';
import { MfaModal } from './MfaModal';
import { GroupVaultDashboard } from './GroupVaultDashboard';

export function Goals({ user, userData, goals, groupVaults, balance, onComplete, initialViewType = 'personal', initialActiveVaultId, onClearInitialActiveVaultId }: { user: string, userData?: any, goals: any[], groupVaults?: any[], balance: number, onComplete: () => void, initialViewType?: 'personal' | 'group', initialActiveVaultId?: string | null, onClearInitialActiveVaultId?: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [goalType, setGoalType] = useState<'personal'|'group'>('personal');
  const [mode, setMode] = useState<'strict' | 'flexible'>('strict');
  const [pendingWithdrawal, setPendingWithdrawal] = useState<any>(null);
  const [activeVault, setActiveVault] = useState<any>(null);
  const [viewType, setViewType] = useState<'personal'|'group'>(initialViewType);

  const [showMfa, setShowMfa] = useState(false);
  const [mfaAction, setMfaAction] = useState<(() => Promise<void>) | null>(null);
  
  const [createFormTarget, setCreateFormTarget] = useState<number>(0);
  const [createFormDuration, setCreateFormDuration] = useState<number>(3);

  const markedSeenRef = React.useRef<Record<string, boolean>>({});

  useEffect(() => {
    setViewType(initialViewType);
  }, [initialViewType]);

  useEffect(() => {
    if (initialActiveVaultId && groupVaults) {
      const targetVault = groupVaults.find(v => v.id === initialActiveVaultId);
      if (targetVault) {
        setActiveVault(targetVault);
        if (onClearInitialActiveVaultId) {
          onClearInitialActiveVaultId();
        }
      }
    }
  }, [initialActiveVaultId, groupVaults, onClearInitialActiveVaultId]);

  useEffect(() => {
    if (viewType === 'group' && groupVaults) {
      const unseenVaults = groupVaults.filter(v => 
        (v.invitedUids || []).includes(user) && 
        v.members?.[user]?.seenInvitation === false &&
        !markedSeenRef.current[v.id]
      );
      unseenVaults.forEach(async (vault) => {
        markedSeenRef.current[vault.id] = true;
        try {
          await markInvitationSeen(vault.id, user);
        } catch (e) {
          console.error("Failed to mark invitation as seen for", vault.id, e);
        }
      });
    }
  }, [viewType, groupVaults, user]);

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
    const lockMonths = Number(formData.get('lockDuration') || 0);

    const performCreate = async () => {
      setLoadingAction(true);
      try {
        if (goalType === 'group') {
          const desc = formData.get('description') as string || '';
          await createGroupVault(user, userData?.name || 'User', name, desc, targetAmount, lockMonths, mode);
          toast.success("Group Vault Created!");
        } else {
          const lockAmount = Number(formData.get('lockAmount') || 0);
          const category = formData.get('category') as string;
          if (lockAmount > balance) {
            toast.error("Insufficient balance to lock initial amount!");
            setLoadingAction(false);
            return;
          }
          await createGoal(user, name, targetAmount, lockAmount, lockMonths, category, mode);
          toast.success("Smart saving goal created!");
        }
        await new Promise(r => setTimeout(r, 2000));
        setShowCreate(false);
        setShowMfa(false);
        onComplete();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to create goal');
      } finally {
        setLoadingAction(false);
      }
    };

    if (goalType === 'group') {
      performCreate(); // No immediate deduction required for vault creation
      return;
    }

    const lockAmount = Number(formData.get('lockAmount') || 0);
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

  const currentVault = groupVaults?.find(v => v.id === activeVault?.id) || activeVault;

  if (activeVault && currentVault) {
    return <GroupVaultDashboard vault={currentVault} user={user} userData={userData} balance={balance} onBack={() => setActiveVault(null)} />;
  }

  return (
    <div className="max-w-5xl mx-auto mt-10 p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-sans font-medium tracking-tight mb-2 flex items-center gap-3"><Target className="text-blue-400" /> Savings Goals</h2>
          <div className="flex gap-2 p-1 bg-[#16191F] rounded-xl self-start w-max">
            <button type="button" onClick={() => setViewType('personal')} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", viewType === 'personal' ? 'bg-[#0A0B0D] text-white shadow-sm' : 'text-gray-400 hover:text-white')}>Personal Goals</button>
            <button type="button" onClick={() => setViewType('group')} className={cn("relative px-4 py-2 rounded-lg text-sm font-medium transition-colors", viewType === 'group' ? 'bg-[#0A0B0D] text-white shadow-sm' : 'text-gray-400 hover:text-white')}>
              Group Vaults
              {groupVaults?.some(v => (v.invitedUids || []).includes(user) && v.members?.[user]?.seenInvitation === false) && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse border border-[#16191F]" />
              )}
            </button>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 hover:bg-blue-500 text-gray-950 text-sm font-semibold px-4 py-3 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20">
          <Plus className="w-5 h-5" /> Create New Goal
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden mb-8">
            <form onSubmit={handleCreate} className="bg-[#16191F] border border-blue-500/30 shadow-2xl rounded-3xl p-6 lg:p-8 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h3 className="text-xl font-medium">Create New Goal</h3>
                <div className="flex gap-2 p-1 bg-[#0A0B0D] rounded-lg">
                  <button type="button" onClick={() => setGoalType('personal')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", goalType === 'personal' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white')}>Personal Goal</button>
                  <button type="button" onClick={() => setGoalType('group')} className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer", goalType === 'group' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white')}>Group Vault</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{goalType === 'group' ? 'Vault Name' : 'Goal Name'}</label>
                  <input required name="name" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder="e.g. Dream Vacation" />
                </div>
                {goalType === 'group' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                    <input required name="description" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-indigo-500 transition-colors" placeholder="What is this fund for?" />
                  </div>
                ) : (
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
                )}
                
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Amount (₹)</label>
                  <input required name="targetAmount" type="number" min="1" value={createFormTarget || ''} onChange={e => setCreateFormTarget(Number(e.target.value))} className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder="e.g. 50000" />
                </div>
                {goalType === 'personal' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Initial Lock Amount (₹)</label>
                    <input name="lockAmount" type="number" min="0" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 transition-colors" placeholder={`Available: ${formatINR(balance)}`} />
                  </div>
                )}
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
                      value={createFormDuration}
                      onChange={e => setCreateFormDuration(Number(e.target.value))}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div 
                    onClick={() => setMode('strict')} 
                    className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all", mode === 'strict' ? "border-blue-500 bg-blue-500/10" : "border-transparent bg-[#16191F] hover:bg-white/5")}
                  >
                    <div className="flex items-center gap-2 text-blue-400 font-medium mb-2"><ShieldAlert className="w-5 h-5" /> Strict Mode</div>
                    <p className="text-xs text-gray-400 leading-relaxed">Maximum discipline, maximum rewards (+50% Bonus).</p>
                  </div>
                  <div 
                    onClick={() => setMode('flexible')} 
                    className={cn("p-4 rounded-xl border-2 cursor-pointer transition-all", mode === 'flexible' ? "border-indigo-500 bg-indigo-500/10" : "border-transparent bg-[#16191F] hover:bg-white/5")}
                  >
                    <div className="flex items-center gap-2 text-indigo-400 font-medium mb-2"><Unlock className="w-5 h-5" /> Flexible Mode</div>
                    <p className="text-xs text-gray-400 leading-relaxed">Maintain liquidity for emergencies.</p>
                  </div>
                </div>
                
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl mt-4">
                  <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-blue-400" /> Rules & Eligibility ({mode === 'strict' ? 'Strict Mode' : 'Flexible Mode'})
                  </h4>
                  {mode === 'strict' ? (
                    <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                      <li><strong className="text-white">NO EARLY WITHDRAWALS ALLOWED.</strong></li>
                      <li>You must wait until the selected maturity period to access funds.</li>
                      <li>To earn the bonus, the <strong className="text-white">Target Amount</strong> must be fully achieved.</li>
                    </ul>
                  ) : (
                    <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                      <li>To earn the bonus, the <strong className="text-white">Target Amount</strong> must be achieved AND the <strong className="text-white">time duration</strong> must fully pass.</li>
                      <li>If both conditions are met, you are eligible for the bonus.</li>
                      <li>If you withdraw early before maturity, a <strong className="text-red-400">2% penalty</strong> will be charged, and you will lose bonus eligibility permanently.</li>
                    </ul>
                  )}
                </div>
              </div>

              {goalType === 'group' && createFormTarget > 0 && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mt-4">
                  <h4 className="text-emerald-400 text-sm font-bold flex items-center gap-2 mb-2"><Gift className="w-4 h-4" /> Estimated Group Vault Reward</h4>
                  <div className="text-sm text-gray-300 mb-2">
                    Start a vault with <span className="font-bold text-white">{formatINR(createFormTarget)}</span> for <span className="font-bold text-white">{createFormDuration} Months</span> in <span className="font-bold text-white">{mode === 'strict' ? 'Strict' : 'Flexible'}</span> mode to unlock premium cash rewards!
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-black text-emerald-400">
                      {formatINR(Math.round(createFormTarget * (createFormTarget >= 500000 ? 0.08 : createFormTarget >= 100000 ? 0.06 : createFormTarget >= 50000 ? 0.04 : 0.03) * (1 + (mode === 'strict' ? 0.5 : 0) + (createFormDuration >= 36 ? 0.75 : createFormDuration >= 24 ? 0.50 : createFormDuration >= 12 ? 0.25 : createFormDuration >= 6 ? 0.10 : 0))))} – {formatINR(Math.round(createFormTarget * (createFormTarget >= 500000 ? 0.08 : createFormTarget >= 100000 ? 0.06 : createFormTarget >= 50000 ? 0.04 : 0.03) * 3 * (1 + (mode === 'strict' ? 0.5 : 0) + (createFormDuration >= 36 ? 0.75 : createFormDuration >= 24 ? 0.50 : createFormDuration >= 12 ? 0.25 : createFormDuration >= 6 ? 0.10 : 0)) + 1000))}
                    </div>
                    <div className="text-xs text-emerald-500/70">Estimated Reward Pool</div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-wide">Final reward depends on: Number of Members • Total Contributions • Goal Duration • Goal Type</p>
                </div>
              )}

              {goalType === 'group' && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mt-4">
                  <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                    <Gift className="w-4 h-4" /> Reward Rules
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                     <li><strong className="text-emerald-400">Current Pool:</strong> The total platform reward generated by your vault.</li>
                     <li><strong className="text-emerald-400">Member Multiplier:</strong> Adding more active members multiplies the reward amount.</li>
                     <li><strong className="text-emerald-400">Duration Bonus:</strong> Locking the vault for a longer time adds a duration bonus. (EXAMPLE: 6 to 11 Months: +10% Bonus | 12 to 23 Months: +25% Bonus | 24 to 35 Months: +50% Bonus | 36+ Months: +75% Bonus)</li>
                     <li><strong className="text-emerald-400">Strict Bonus:</strong> Choosing Strict mode adds a substantial bonus over Flexible mode.</li>
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors">Cancel</button>
                <button disabled={loadingAction} type="submit" className={cn("font-semibold py-3 px-8 rounded-xl transition-all disabled:opacity-50", goalType === 'group' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-gray-950')}>
                  {loadingAction ? '...' : (goalType === 'group' ? 'Create Vault' : 'Initialize Goal')}
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

      {viewType === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.map((goal: any) => {
            const isWithdrawn = goal.status === 'withdrawn';
            const progress = isWithdrawn ? 0 : Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
            const isLocked = !isWithdrawn && goal.lockedUntil && Date.now() < new Date(goal.lockedUntil).getTime();
            const unlockStr = goal.lockedUntil ? new Date(goal.lockedUntil).toLocaleDateString() : '';
            const estimatedBonus = isWithdrawn ? 0 : calculateBonus(goal);
            
            let daysLeft = 0;
            if (isLocked) {
              const timeDiff = new Date(goal.lockedUntil).getTime() - Date.now();
              daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
            }

            return (
              <div key={goal.id} className={cn("bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-xl", isWithdrawn ? "opacity-60 grayscale" : "")}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 bg-white/5 text-gray-400 rounded-md uppercase tracking-wider">{goal.category || 'Goal'}</span>
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1", goal.mode === 'strict' ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400')}>
                        {goal.mode === 'strict' ? <ShieldAlert className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {goal.mode === 'strict' ? 'Strict' : 'Flexible'}
                      </span>
                      {isWithdrawn && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-red-500/20 text-red-400 rounded-md">Withdrawn</span>
                      )}
                    </div>
                    <h3 className="text-xl font-medium flex items-center gap-2">
                       {goal.name}
                    </h3>
                    {isLocked && (
                      <p className="text-xs text-amber-500/80 mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked until {unlockStr} ({daysLeft} Days Left)
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    {!isWithdrawn && (
                      <>
                        <div className="text-sm font-medium text-blue-400 bg-blue-600/10 px-3 py-1 rounded-lg">{progress}%</div>
                        {getBadge(progress)}
                      </>
                    )}
                  </div>
                </div>
                
                {/* Stats Block */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-[#0A0B0D] rounded-2xl border border-white/5">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Saved Amount</div>
                    <div className="text-lg font-medium text-white">{isWithdrawn ? formatINR(0) : formatINR(goal.currentAmount)}</div>
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

                {isWithdrawn ? (
                  <button 
                    onClick={async () => {
                      try {
                         const { deleteDoc, doc } = await import('firebase/firestore');
                         const { db } = await import('../lib/firebase');
                         await deleteDoc(doc(db, 'users', user, 'goals', goal.id));
                         toast.success("Goal deleted forever");
                      } catch (err:any) {
                         toast.error("Failed to delete goal");
                      }
                    }}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-sm font-medium transition-all"
                  >
                    Delete Goal
                  </button>
                ) : selectedGoal?.id === goal.id ? (
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

          {goals.length === 0 && (
            <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center p-12 text-gray-500 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
              <Target className="w-12 h-12 mb-4 opacity-20" />
              <p>You don't have any smart savings goals yet.</p>
              <p className="text-sm mt-2 opacity-60">Create one to start building your discipline bonus.</p>
            </div>
          )}
        </div>
      )}

      {viewType === 'group' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(groupVaults || []).map(vault => {
            const progress = Math.min(100, Math.round((vault.currentAmount / vault.targetAmount) * 100));
            const memberCount = vault.memberUids.length;
            const isPending = (vault.invitedUids || []).includes(user);
            const myRecord = vault.members[user];
            
            return (
              <div key={vault.id} onClick={() => setActiveVault(vault)} className="bg-[#16191F] border border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-xl cursor-pointer hover:border-indigo-500/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md uppercase tracking-wider flex items-center gap-1"><UsersRound className="w-3 h-3"/> Group</span>
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1", vault.mode === 'strict' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-300')}>
                        {vault.mode === 'strict' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {vault.mode === 'strict' ? 'Strict' : 'Flexible'}
                      </span>
                    </div>
                    <h3 className="text-xl font-medium flex items-center gap-2">
                       {vault.name} 
                    </h3>
                  </div>
                  {isPending && myRecord?.seenInvitation === false ? (
                      <div className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded">NEW</div>
                  ) : (
                    <div className="text-sm font-medium text-indigo-400 bg-indigo-600/10 px-3 py-1 rounded-lg">{progress}%</div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-5">
                   <div>
                     <div className="text-xs text-gray-500 mb-1">Current Pool</div>
                     <div className="text-lg font-medium text-white">{formatINR(vault.currentAmount)}</div>
                   </div>
                   <div>
                     <div className="text-xs text-gray-500 mb-1">Total Members</div>
                     <div className="text-lg font-medium text-gray-300">{memberCount} Joined</div>
                   </div>
                </div>

                <div className="h-2 w-full bg-[#0A0B0D] rounded-full overflow-hidden border border-white/5">
                   <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className={cn("h-full rounded-full relative", progress >= 100 ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-gradient-to-r from-indigo-600 to-indigo-400")} />
                </div>
                
                {isPending && (
                   <div className="mt-4 text-sm text-blue-400 font-medium bg-blue-500/10 py-2 px-3 rounded-lg text-center">
                     Pending Invitation
                   </div>
                )}
              </div>
            );
          })}
          
          {(groupVaults || []).length === 0 && (
            <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center p-12 text-gray-500 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
              <UsersRound className="w-12 h-12 mb-4 opacity-20" />
              <p>You are not part of any Group Vaults yet.</p>
              <p className="text-sm mt-2 opacity-60">Create one or ask a friend to invite you.</p>
            </div>
          )}
        </div>
      )}

      <MfaModal 
        isOpen={showMfa}
        onClose={() => setShowMfa(false)}
        onSuccess={() => mfaAction && mfaAction()}
        secret={userData?.twoFactorSecret || ''}
      />
    </div>
  );
}
