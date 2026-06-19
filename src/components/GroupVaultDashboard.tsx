import React, { useState, useEffect } from 'react';
import { Target, Lock, Unlock, ShieldAlert, Zap, ArrowLeft, Plus, Gift, Trash2, Users, UsersRound, Trophy, BadgeIndianRupee } from 'lucide-react';
import { formatINR, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { contributeToGroupVault, withdrawFromGroupVault, deleteGroupVault, leaveGroupVault, markInvitationSeen, respondToVaultInvite, verifyUserForInvitation, inviteToGroupVault, calculateGroupVaultRewards } from '../lib/firebaseUtils';
import { toast } from 'react-hot-toast';

export function GroupVaultDashboard({ vault, user, userData, balance, onBack }: { vault: any, user: string, userData: any, balance: number, onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [amount, setAmount] = useState('');
  
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<any>(null);
  
  const [pendingWithdrawal, setPendingWithdrawal] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const isCreator = vault.creatorId === user;
  const isMember = (vault.memberUids || []).includes(user);
  const isPending = (vault.invitedUids || []).includes(user);
  
  // Member records
  const myRecord = vault.members?.[user];
  let myContribution = 0;
  let myAvailableBalance = 0;
  if (myRecord) {
    myContribution = myRecord.contributed || 0;
    myAvailableBalance = myContribution - (myRecord.withdrawn || 0);
  }

  const markedSeenRef = React.useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (isPending && myRecord?.seenInvitation === false && !markedSeenRef.current[vault.id]) {
      markedSeenRef.current[vault.id] = true;
      markInvitationSeen(vault.id, user).catch(err => {
        console.error("Failed to mark invitation seen", err);
      });
    }
  }, [isPending, myRecord, vault.id, user]);

  const totalGrossContributions = vault.currentAmount || 0;

  const rawProgress = vault.targetAmount > 0 ? (totalGrossContributions / vault.targetAmount) * 100 : 0;
  const progress = Math.min(100, Math.round(Number.isNaN(rawProgress) ? 0 : rawProgress));
  const memberCount = (vault.memberUids || []).length;

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return toast.error("Enter a valid amount");
    if (numAmount > balance) return toast.error("Insufficient balance");
    
    setLoading(true);
    try {
      await contributeToGroupVault(user, vault.id, numAmount);
      toast.success(`Successfully contributed ${formatINR(numAmount)}`);
      setShowContribute(false);
      setAmount('');
    } catch (err: any) {
      toast.error(err.message || 'Contribution failed');
    } finally {
      setLoading(false);
    }
  };

  const rewardsInfo = calculateGroupVaultRewards({
    targetAmount: vault.targetAmount,
    currentAmount: totalGrossContributions,
    durationMonths: vault.durationMonths,
    mode: vault.mode,
    memberCount
  });

  const memberList = Object.values(vault.members || {}) as any[];
  const sortedMembers = [...memberList]
    .map(m => ({ ...m, activeBalance: Math.max(0, (m.contributed || 0) - (m.withdrawn || 0)) }))
    .sort((a, b) => b.activeBalance - a.activeBalance);
  const myContributionPct = totalGrossContributions > 0 && myAvailableBalance > 0 ? (myAvailableBalance / totalGrossContributions) * 100 : 0;
  const myEstReward = totalGrossContributions > 0 ? rewardsInfo.currentRewardPool * (myAvailableBalance / totalGrossContributions) : 0;

  const handleVerify = async () => {
    if (!inviteIdentifier) return;
    setLoading(true);
    try {
      const u = await verifyUserForInvitation(inviteIdentifier);
      if (u) {
        setVerifiedUser(u);
      } else {
        toast.error("User Not Found");
        setVerifiedUser(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!verifiedUser) return;
    setLoading(true);
    try {
      await inviteToGroupVault(vault.id, user, userData.name || 'User', verifiedUser.uid, verifiedUser.name, verifiedUser.email, verifiedUser.upiId);
      toast.success("Invitation sent");
      setShowInviteMenu(false);
      setVerifiedUser(null);
      setInviteIdentifier('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite');
    } finally {
      setLoading(false);
    }
  };

  const respondInvite = async (type: 'accept' | 'decline') => {
    setLoading(true);
    try {
      await respondToVaultInvite(vault.id, user, userData.name || 'User', type, vault.creatorId);
      toast.success(type === 'accept' ? 'Joined Vault' : 'Invitation declined');
      if (type === 'decline') onBack();
    } catch(err:any) {
      toast.error(err.message || "Failed to respond");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (vault.currentAmount > 0) {
      return toast.error("Vault deletion disabled. The vault still has funds.");
    }
    setShowDeleteConfirm(true);
  };

  const processDelete = async () => {
    setLoading(true);
    try {
      await deleteGroupVault(vault.id, user);
      toast.success("Vault deleted");
      onBack();
    } catch(err:any) {
      toast.error(err.message || "Failed to delete vault");
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const processLeave = async () => {
    setLoading(true);
    try {
      await leaveGroupVault(vault.id, user);
      toast.success("Successfully left the vault. It has been removed from your list.");
      onBack();
    } catch(err:any) {
      toast.error(err.message || "Failed to leave vault");
      setLoading(false);
      setShowLeaveConfirm(false);
    }
  };

  const isPastDueDate = !vault.lockedUntil || Date.now() >= new Date(vault.lockedUntil).getTime();
  const isCompleted = isPastDueDate;
  const isTargetMet = totalGrossContributions >= vault.targetAmount;
  
  let daysLeft = 0;
  if (!isPastDueDate && vault.lockedUntil) {
    const timeDiff = new Date(vault.lockedUntil).getTime() - Date.now();
    daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  const handleWithdrawal = async () => {
    if (!isCompleted && vault.mode === 'strict') return toast.error("Early withdrawal is not allowed in Strict Vault.");
    setPendingWithdrawal(true);
  };
  
  const processWithdrawal = async () => {
    setLoading(true);
    try {
       await withdrawFromGroupVault(user, vault.id, myAvailableBalance);
       toast.success(isCompleted ? "Successfully withdrawn funds + reward!" : "Withdrawn remaining funds (with 2% penalty).");
       setPendingWithdrawal(false);
    } catch(err:any) {
       toast.error(err.message || "Withdrawal failed");
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 p-4">
      <button onClick={onBack} className="text-sm font-medium text-gray-400 hover:text-white transition-colors mb-6 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Goals
      </button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Col - Overview & Actions */}
        <div className="flex-1 space-y-6">
          <div className="bg-[#16191F] border border-indigo-500/30 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
             {vault.status === 'completed' && (
               <div className="absolute inset-0 bg-yellow-500/5 z-0 flex items-center justify-center pointer-events-none">
                 <Trophy className="w-40 h-40 text-yellow-500/10" />
               </div>
             )}
             
             <div className="relative z-10 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                   <div>
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-xs font-mono px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md uppercase tracking-wider flex items-center gap-1">
                           <UsersRound className="w-3 h-3" /> Group Vault
                         </span>
                         <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1", vault.mode === 'strict' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-300')}>
                           {vault.mode === 'strict' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                           {vault.mode === 'strict' ? 'Strict' : 'Flexible'}
                         </span>
                         {vault.status === 'completed' && (
                           <span className="text-xs font-medium px-2 py-0.5 bg-green-500/20 text-green-400 rounded-md">
                             Completed
                           </span>
                         )}
                         {!isPastDueDate && daysLeft > 0 && (
                           <span className="text-xs font-medium px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded-md flex items-center gap-1 border border-amber-500/20">
                             <Lock className="w-3 h-3" /> {daysLeft} Days to Maturity
                           </span>
                         )}
                      </div>
                      <h2 className="text-2xl lg:text-3xl font-medium text-white">{vault.name}</h2>
                      <p className="text-gray-400 text-sm mt-1">{vault.description}</p>
                   </div>
                   {isCreator && vault.currentAmount === 0 && (
                      <button onClick={handleDelete} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors" title="Delete Vault">
                         <Trash2 className="w-5 h-5" />
                      </button>
                   )}
                   {!isCreator && isMember && myAvailableBalance === 0 && (
                      <button onClick={() => setShowLeaveConfirm(true)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors" title="Remove Vault">
                         <Trash2 className="w-5 h-5" />
                      </button>
                   )}
                </div>
                
                <div className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-6 space-y-4">
                   <div className="flex justify-between items-end">
                      <div>
                        <div className="text-sm font-medium text-gray-400 mb-1">Current Saved Amount</div>
                        <div className="text-3xl font-sans tracking-tight text-white">{formatINR(totalGrossContributions)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500 mb-1">Target Amount</div>
                        <div className="text-lg font-medium text-gray-300">{formatINR(vault.targetAmount)}</div>
                      </div>
                   </div>
                   
                   <div className="mb-2">
                     <div className="flex justify-between text-sm mb-2 font-medium">
                       <span className="text-indigo-400">{progress}% Completed</span>
                       <span className="text-gray-500">{formatINR(Math.max(0, vault.targetAmount - totalGrossContributions))} Remaining</span>
                     </div>
                     <div className="h-3 w-full bg-[#16191F] rounded-full overflow-hidden border border-white/5 relative">
                       <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 absolute left-0 top-0" />
                     </div>
                   </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-50"><Gift className="w-16 h-16 text-emerald-500/20" /></div>
                   <h3 className="text-emerald-400 text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-wider">Live Reward Tracking</h3>
                   
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                     <div>
                       <div className="text-xs text-gray-500 mb-1">Current Pool</div>
                       <div className="text-xl font-bold text-white">{formatINR(Math.round(rewardsInfo.currentRewardPool))}</div>
                     </div>
                     <div>
                       <div className="text-xs text-gray-500 mb-1">Member Multiplier</div>
                       <div className="text-xl font-bold text-white">{Number(rewardsInfo.memberMultiplier).toFixed(2)}x</div>
                     </div>
                     <div>
                       <div className="text-xs text-gray-500 mb-1">Duration Bonus</div>
                       <div className="text-xl font-bold text-white">+{Math.round(rewardsInfo.durationBonus * 100)}%</div>
                     </div>
                     <div>
                       <div className="text-xs text-gray-500 mb-1">Strict Bonus</div>
                       <div className="text-xl font-bold text-white">+{rewardsInfo.strictBonus * 100}%</div>
                     </div>
                   </div>

                   <div className="bg-[#0A0B0D]/50 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
                     <div>
                       <div className="text-xs font-medium text-gray-400 mb-1">Your Share ({myContributionPct.toFixed(1)}%)</div>
                       <div className="text-2xl font-black text-emerald-400 border-b border-emerald-400/30 pb-0.5 inline-block">{formatINR(Math.round(myEstReward))}</div>
                       {myRecord?.withdrawnEarly && <div className="text-xs text-red-500 mt-1">Not eligible (early withdrawal)</div>}
                     </div>
                     <div className="text-right flex flex-col gap-1 items-end">
                       <span className={cn("text-xs px-2 py-1 rounded-md", !myRecord?.withdrawnEarly ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                         {!myRecord?.withdrawnEarly ? "✓ Reward Eligible" : "✗ Not Eligible"}
                       </span>
                     </div>
                   </div>
                </div>

                {isPending && (
                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 text-center space-y-4">
                     <p className="text-sm font-medium text-blue-300">You must accept the invitation before contributing.</p>
                     <div className="flex justify-center gap-3">
                       <button onClick={() => respondInvite('accept')} disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors">
                         Accept Invitation
                       </button>
                       <button onClick={() => respondInvite('decline')} disabled={loading} className="px-6 py-2 border border-white/10 hover:bg-white/5 text-gray-300 font-medium rounded-xl transition-colors">
                         Reject Invitation
                       </button>
                     </div>
                  </div>
                )}
                
                {isMember && (
                   <div className="flex gap-3">
                      {vault.status === 'active' && !isCompleted && !isTargetMet && (
                        <button onClick={() => setShowContribute(!showContribute)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                          <Plus className="w-5 h-5" /> Add Contribution
                        </button>
                      )}
                      {(vault.mode === 'flexible' || isCompleted) && myAvailableBalance > 0 && (
                        <button onClick={handleWithdrawal} className="flex-1 px-4 py-3 border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 font-medium rounded-xl transition-colors text-center">
                          {isCompleted && !myRecord?.withdrawnEarly ? 'Withdraw & Claim Reward' : 'Withdraw'}
                        </button>
                      )}
                   </div>
                )}
             </div>
          </div>
          
          <AnimatePresence>
            {showContribute && isMember && (
              <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden">
                <form onSubmit={handleContribute} className="bg-[#16191F] border border-white/5 rounded-2xl p-6 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contribution Amount</label>
                    <input required autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} max={balance} min={1} className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-indigo-500 transition-colors" placeholder={`Available: ${formatINR(balance)}`} />
                  </div>
                  <button disabled={loading} type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors whitespace-nowrap">
                    {loading ? 'Processing...' : 'Contribute'}
                  </button>
                </form>
              </motion.div>
            )}

            {pendingWithdrawal && (
               <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden mt-6">
                 <div className={cn("border rounded-3xl p-6 text-center", isCompleted ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20")}>
                   <h3 className={cn("text-xl font-semibold mb-2 flex items-center justify-center gap-2", isCompleted ? "text-emerald-500" : "text-red-500")}>
                     {isCompleted ? <Gift className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                     {isCompleted ? 'Claim Your Rewards' : 'Early Withdrawal Detected'}
                   </h3>
                   <div className="space-y-1 mb-6">
                     {isCompleted ? (
                       <p className="text-gray-300">Vault has matured! You can now withdraw your contribution + estimated reward of <strong className="text-emerald-400">{formatINR(Math.round(myEstReward))}</strong>.</p>
                     ) : (
                       <>
                         <p className="text-gray-300">Penalty: <strong>2%</strong></p>
                         <p className="text-red-400 font-medium">Reward eligibility will be lost permanently.</p>
                       </>
                     )}
                   </div>
                   <div className="flex gap-4 justify-center">
                     <button onClick={() => setPendingWithdrawal(false)} className="px-6 py-2.5 rounded-xl font-medium border border-white/10 hover:bg-white/5 text-gray-300 transition-colors">
                       Cancel
                     </button>
                     <button onClick={processWithdrawal} disabled={loading} className={cn("px-6 py-2.5 rounded-xl font-bold text-white transition-colors", isCompleted ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500")}>
                       {loading ? 'Processing...' : (isCompleted ? 'Withdraw & Claim Reward' : 'Confirm Early Withdrawal')}
                     </button>
                   </div>
                 </div>
               </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDeleteConfirm && (
               <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden mt-6">
                 <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-center">
                   <h3 className="text-xl font-semibold text-red-500 mb-2">Delete Vault</h3>
                   <div className="space-y-1 mb-6">
                     <p className="text-gray-300">Are you sure you want to delete this vault? This action cannot be undone.</p>
                   </div>
                   <div className="flex gap-4 justify-center">
                     <button onClick={() => setShowDeleteConfirm(false)} className="px-6 py-2.5 rounded-xl font-medium border border-white/10 hover:bg-white/5 text-gray-300 transition-colors">
                       Cancel
                     </button>
                     <button onClick={processDelete} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-colors">
                       {loading ? 'Processing...' : 'Confirm'}
                     </button>
                   </div>
                 </div>
               </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showLeaveConfirm && (
               <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="overflow-hidden mt-6">
                 <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-center">
                   <h3 className="text-xl font-semibold text-red-500 mb-2">Remove Vault</h3>
                   <div className="space-y-1 mb-6">
                     <p className="text-gray-300">Are you sure you want to remove this vault from your list? This action cannot be undone.</p>
                   </div>
                   <div className="flex gap-4 justify-center">
                     <button onClick={() => setShowLeaveConfirm(false)} className="px-6 py-2.5 rounded-xl font-medium border border-white/10 hover:bg-white/5 text-gray-300 transition-colors">
                       Cancel
                     </button>
                     <button onClick={processLeave} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-colors">
                       {loading ? 'Processing...' : 'Confirm'}
                     </button>
                   </div>
                 </div>
               </motion.div>
            )}
          </AnimatePresence>

          {/* Contribution Leaderboard */}
          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6">
             <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-400 uppercase tracking-wider">
               <Trophy className="w-5 h-5 text-amber-400" /> Top Contributors
             </div>
             <div className="space-y-3">
               {sortedMembers.filter(m => m.contributed > 0).map((m: any, idx: number) => (
                 <div key={m.uid || `leaderboard-${idx}`} className="flex justify-between items-center bg-[#0A0B0D] p-3 rounded-2xl border border-white/5 relative overflow-hidden">
                   {idx === 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500/20 to-transparent -mr-8 -mt-8 rounded-full" />}
                   <div className="flex items-center gap-3 relative z-10">
                     <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs text-gray-400">
                       #{idx + 1}
                     </div>
                     <div>
                       <div className="font-medium text-white flex items-center gap-2">
                         {m.name} {m.uid === user && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">You</span>}
                       </div>
                       <div className="text-xs text-gray-500">
                         {((m.contributed / totalGrossContributions) * 100).toFixed(1)}% Share
                       </div>
                     </div>
                   </div>
                   <div className="font-bold text-white relative z-10">
                     {formatINR(m.contributed)}
                   </div>
                 </div>
               ))}
               {sortedMembers.filter(m => m.contributed > 0).length === 0 && (
                 <div className="text-sm text-gray-500 text-center py-4 bg-[#0A0B0D] rounded-2xl border border-white/5">
                   No contributions yet. Be the first!
                 </div>
               )}
             </div>
          </div>

          {/* Contribution History */}
          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6">
             <h3 className="font-medium text-lg mb-4 text-white">Contribution History</h3>
             <div className="space-y-4">
               {(vault.timeline || []).filter((t:any) => t.action === 'contribute' || t.action === 'withdraw').slice().reverse().map((t:any, index: number) => (
                 <div key={t.id || `timeline-${index}`} className="flex justify-between items-center bg-[#0A0B0D] p-4 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                       {(t.userName || 'U').substring(0,2).toUpperCase()}
                     </div>
                     <div>
                       <div className="font-medium text-white">{t.userName}</div>
                       <div className="text-xs text-gray-500">{new Date(t.date).toLocaleString()}</div>
                     </div>
                   </div>
                   <div className={cn("font-medium", t.action === 'contribute' ? 'text-green-400' : 'text-red-400')}>
                     {t.action === 'contribute' ? '+' : '-'}{t.amount ? formatINR(t.amount).replace(/[^0-9.,]/g, '') : (t.details?.match(/[\d,.]+/)?.[0] || '0')}
                   </div>
                 </div>
               ))}
               {(vault.timeline || []).filter((t:any) => t.action === 'contribute' || t.action === 'withdraw').length === 0 && (
                 <div className="text-center text-gray-500 py-4 text-sm">No contributions yet.</div>
               )}
             </div>
          </div>
        </div>

        {/* Right Col - Members */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          
          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6">
            <h3 className="font-medium text-lg mb-1 text-white">Creator Information</h3>
            <div className="flex items-center gap-3 mt-4 bg-[#0A0B0D] p-3 rounded-2xl border border-white/5">
               <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                 {((vault.members?.[vault.creatorId]?.name) || 'U').substring(0,2).toUpperCase()}
               </div>
               <div>
                 <div className="text-sm font-medium text-white flex items-center gap-1">✓ {vault.members?.[vault.creatorId]?.name || 'Creator'}</div>
                 <div className="text-xs text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded mt-1 inline-block">Creator</div>
               </div>
            </div>
          </div>

          <div className="bg-[#16191F] border border-white/5 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-lg text-white">Members ({memberCount})</h3>
              {isCreator && vault.status === 'active' && (
                <button onClick={() => setShowInviteMenu(!showInviteMenu)} className="text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1">
                  <Users className="w-3 h-3" /> Invite
                </button>
              )}
            </div>
            
            <AnimatePresence>
              {showInviteMenu && (
                <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="mb-4 overflow-hidden">
                  <div className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-4 space-y-3">
                    <label className="text-xs font-medium text-gray-500 uppercase">Search User</label>
                    <input autoFocus value={inviteIdentifier} onChange={e => setInviteIdentifier(e.target.value)} type="text" placeholder="Email, UPI ID, or Acc. No." className="w-full bg-[#16191F] border border-white/5 py-2 px-3 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                    {!verifiedUser && (
                      <button onClick={handleVerify} disabled={loading || !inviteIdentifier} className="w-full py-2 bg-indigo-600/20 text-indigo-400 font-medium rounded-xl text-sm hover:bg-indigo-600/30 transition-colors">
                        Verify User
                      </button>
                    )}
                    {verifiedUser && (
                      <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                        <div className="text-green-400 text-xs font-bold mb-1">✓ Verified User</div>
                        <div className="text-sm font-medium text-white mb-1">{verifiedUser.name}</div>
                        <div className="text-xs text-gray-400">UPI: {verifiedUser.upiId}</div>
                        <button onClick={handleInvite} disabled={loading} className="w-full mt-3 py-2 bg-indigo-600 text-white font-medium rounded-lg text-sm hover:bg-indigo-500 transition-colors">
                          Send Invitation
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {Object.values(vault.members || {}).filter((m:any) => m.status === 'active').sort((a:any, b:any) => (b.contributed - (b.withdrawn || 0)) - (a.contributed - (a.withdrawn || 0))).map((m: any, index: number) => {
                 const activeBalance = Math.max(0, (m.contributed || 0) - (m.withdrawn || 0));
                 return (
                <div key={m.uid || `active-${index}`} className={cn("flex justify-between items-center bg-[#0A0B0D] p-3 rounded-2xl border border-white/5", m.withdrawnEarly ? "opacity-60 grayscale" : "")}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 text-gray-300 flex items-center justify-center font-medium text-xs">
                      {(m.name || 'U').substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-200 flex items-center gap-2">
                        {m.name || 'User'} 
                        {m.withdrawnEarly && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Withdrawn Early</span>}
                      </div>
                      {(m.email || m.upiId) && (
                        <div className="text-[10px] text-gray-500 truncate">{m.upiId || m.email}</div>
                      )}
                      <div className="text-xs font-mono text-gray-400 mt-1">{formatINR(activeBalance)} {m.withdrawnEarly && <span className="line-through text-[10px] ml-1">{formatINR(m.contributed)}</span>}</div>
                    </div>
                  </div>
                </div>
              )})}
              {Object.values(vault.members || {}).filter((m:any) => m.status === 'invited').map((m: any, index: number) => (
                <div key={m.uid || `invited-${index}`} className="flex justify-between items-center bg-[#0A0B0D] p-3 rounded-2xl border border-white/5 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 text-gray-500 flex items-center justify-center font-medium text-xs">
                      {(m.name || 'U').substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-400">{m.name || 'User'}</div>
                      {(m.email || m.upiId) && (
                        <div className="text-[10px] text-gray-500 truncate">{m.upiId || m.email}</div>
                      )}
                      <div className="text-[10px] text-yellow-500/80 uppercase tracking-widest mt-0.5">Pending</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
