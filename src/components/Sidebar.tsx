import { Wallet, LayoutDashboard, ArrowRightLeft, ArrowDownToLine, Receipt, Clock, Target, Calculator, UserRound, ShieldAlert, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

export function Sidebar({ activeTab, setActiveTab, isAdmin, onLogout }: { activeTab: string, setActiveTab: (t: string) => void, isAdmin: boolean, onLogout: () => void }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
    { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
    { id: 'bills', label: 'Bill Payments', icon: Receipt },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'goals', label: 'Savings Goals', icon: Target },
    { id: 'loan', label: 'EMI Calculator', icon: Calculator },
    { id: 'profile', label: 'Profile Settings', icon: UserRound },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: ShieldAlert });
  }

  return (
    <aside className="w-64 border-r border-white/5 bg-[#111318] flex flex-col h-screen">
      <div className="h-20 flex items-center px-6 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-blue-400 font-sans tracking-tight text-2xl">
          <Wallet className="w-6 h-6" />
          <span>Rupee<span className="text-white">Pay</span></span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                isActive 
                  ? "bg-blue-600/10 text-blue-400" 
                  : "text-gray-400 hover:bg-[#16191F] hover:text-gray-200"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-400")} />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="p-4 border-t border-white/5 shrink-0">
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-400 border border-white/5 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
