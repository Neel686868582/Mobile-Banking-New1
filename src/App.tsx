import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Transfer } from './components/Transfer';
import { Deposit } from './components/Deposit';
import { Bills } from './components/Bills';
import { History } from './components/History';
import { Goals } from './components/Goals';
import { Analytics } from './components/Analytics';
import { Loan } from './components/Loan';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel';
import { Bell, X } from 'lucide-react';
import { cn } from './lib/utils';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { subscribeToUserData, subscribeToCollection, markAllNotificationsRead } from './lib/firebaseUtils';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profileTab, setProfileTab] = useState<'personal'|'security'|'notifications'|'password'>('personal');
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [is2faVerified, setIs2faVerified] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isPhoneMissing = userData && (!userData.phone || userData.phone.trim() === '');

  useEffect(() => {
    if (isPhoneMissing && activeTab !== 'profile') {
      toast.error('Please add your mobile number in Profile Settings to continue.', { id: 'phone-missing', duration: 4000 });
      setActiveTab('profile');
      setProfileTab('personal');
    }
  }, [isPhoneMissing, activeTab]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setAuthError(null);
        setUser({ uid: currentUser.email!, email: currentUser.email });
      } else {
        setUser(null);
        setUserData(null);
        setIs2faVerified(false);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubUser = subscribeToUserData(user.uid, (data) => {
      setUserData(data);
      if (data && data.isAdmin && activeTab === 'dashboard') setActiveTab('dashboard'); // could redirect to admin
      setLoading(false);
    }, (err) => {
      setAuthError("Failed to fetch user profile. Please check Firebase rules.");
      setLoading(false);
    });

    const unsubTx = subscribeToCollection(user.uid, 'transactions', setTransactions, (err) => setAuthError("Failed to fetch transactions."));
    const unsubGoals = subscribeToCollection(user.uid, 'goals', setGoals, (err) => setAuthError("Failed to fetch goals."));
    const unsubNotifs = subscribeToCollection(
      user.uid, 
      'notifications', 
      setNotifications, 
      (err) => setAuthError("Failed to fetch notifications."),
      (newNotif) => {
        toast.success(newNotif.message);
      }
    );

    return () => {
      unsubUser();
      unsubTx();
      unsubGoals();
      unsubNotifs();
    };
  }, [user?.uid]);

  if (loading) {
    return <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex flex-col items-center justify-center p-8">
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl p-6 flex flex-col items-center max-w-md text-center">
          <div className="text-xl mb-2 font-bold flex items-center gap-2">⚠️ Database Connection Issue</div>
          <p className="text-sm opacity-90 mb-6">{authError}</p>
          <div className="text-left bg-[#0A0B0D] p-4 rounded-lg text-xs font-mono space-y-2 mb-6">
            <p className="font-semibold text-gray-300">Quick Fix:</p>
            <p>1. Go to Firebase Console &gt; Firestore Database</p>
            <p>2. Select the "Rules" tab</p>
            <p>3. Update your rules to allow read/write</p>
          </div>
          <button onClick={() => { signOut(auth); setAuthError(null); }} className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-lg font-medium transition-colors">
            Sign Out & Try Again
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('dashboard');
    setIs2faVerified(false);
  };

  const handleVerify2FA = async (token: string) => {
    try {
      const resp = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, secret: userData?.twoFactorSecret })
      });
      const data = await resp.json();
      if (data.success) {
        setIs2faVerified(true);
      } else {
        alert(data.message || 'Invalid code');
      }
    } catch (err) {
      alert('Verification failed');
    }
  };

  if (!user || (!userData && !loading)) {
    return <Auth onLogin={() => {}} />;
  }

  if (userData?.twoFactorEnabled && userData?.require2FAForLogin !== false && !is2faVerified) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-2xl text-center"
        >
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🛡️</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Two-Step Verification</h2>
            <p className="text-gray-400 text-sm">Enter the code from your Google Authenticator app to continue.</p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center gap-2">
              <input 
                id="mfa-input"
                type="text"
                maxLength={6}
                placeholder="000000"
                autoFocus
                className="w-full bg-[#0A0B0D] text-white border border-white/10 rounded-xl py-4 px-4 text-center text-3xl tracking-[0.5em] font-mono focus:border-blue-500 outline-none transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value;
                    if (val.length === 6) {
                      handleVerify2FA(val);
                    }
                  }
                }}
              />
            </div>

            <button 
              onClick={() => {
                const input = document.getElementById('mfa-input') as HTMLInputElement;
                handleVerify2FA(input.value);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              Verify & Log In
            </button>

            <button 
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-400 font-medium"
            >
              Cancel and Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const appData = { ...userData, transactions, goals, notifications };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[#0A0B0D] text-gray-100 font-sans tracking-tight selection:bg-blue-600/30">
      <Toaster position="top-right" toastOptions={{ style: { background: '#16191F', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={userData.isAdmin} onLogout={handleLogout} />
      
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-[#0A0B0D] sticky top-0 z-10 w-full">
          
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-medium text-white tracking-tight truncate">
              Welcome, <span className="text-blue-400">{userData.name?.split(' ')[0] || 'User'}</span>
            </h1>
          </div>

          <div className="flex items-center gap-4 md:gap-6 relative">
            
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-gray-400 hover:text-white transition-colors"
            >
              <div className="text-xl">🔔</div>
              {notifications?.filter((n: any) => !n.read).length > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0A0B0D]" />
              )}
            </button>
            <div 
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold overflow-hidden">
                {userData.avatar ? (
                  <img src={userData.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  userData.name?.substring(0,2).toUpperCase()
                )}
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium">{userData.name}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">{userData.isAdmin ? 'Super Admin' : 'Standard User'}</div>
              </div>
            </div>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-4 w-[calc(100vw-2rem)] md:w-80 max-w-sm bg-[#16191F] border border-white/5 rounded-xl shadow-2xl overflow-hidden z-50 text-left"
                >
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <span className="font-medium text-gray-200">Notifications</span>
                    <button 
                      onClick={async () => {
                        await markAllNotificationsRead(user.uid, notifications);
                        setShowNotifications(false);
                      }}
                      className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
                      title="Clear & Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications?.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                    ) : (
                      notifications?.map((n: any) => (
                        <div key={n.id} className={cn("p-4 border-b border-white/5 text-sm", !n.read && "bg-white/5")}>
                          <div className="text-gray-300 mb-1">{n.message}</div>
                          <div className="text-xs text-gray-500">{new Date(n.date).toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard userData={appData} setActiveTab={setActiveTab} onEnable2FA={() => { setProfileTab('security'); setActiveTab('profile'); }} />}
              {activeTab === 'analytics' && <Analytics appData={appData} />}
              {activeTab === 'transfer' && <Transfer user={user.uid} userData={userData} balance={userData.balance} onComplete={() => setActiveTab('dashboard')} />}
              {activeTab === 'deposit' && <Deposit user={user.uid} userData={userData} accountNumber={userData?.accountNumber} upiId={userData?.upiId} balance={userData.balance} transactions={transactions} onComplete={() => setActiveTab('dashboard')} />}
              {activeTab === 'bills' && <Bills user={user.uid} userData={userData} onComplete={() => setActiveTab('dashboard')} balance={userData.balance} />}
              {activeTab === 'history' && <History transactions={transactions} />}
              {activeTab === 'goals' && <Goals user={user.uid} userData={userData} goals={goals} balance={userData.balance} onComplete={() => {}} />}
              {activeTab === 'loan' && <Loan />}
              {activeTab === 'profile' && <Profile userData={appData} user={user.uid} onComplete={() => {}} initialTab={profileTab} />}
              {activeTab === 'admin' && userData.isAdmin && <AdminPanel adminUser={user.uid} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
