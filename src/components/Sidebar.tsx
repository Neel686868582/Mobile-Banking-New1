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
    <aside className="w-full md:w-64 border-t md:border-r md:border-t-0 border-white/5 bg-[#111318] flex md:flex-col h-16 md:h-[100dvh] shrink-0 fixed bottom-0 md:static left-0 z-50">
      <div className="hidden md:flex h-20 items-center px-6 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-blue-400 font-sans tracking-tight text-2xl">
          <Wallet className="w-6 h-6" />
          <span>Rupee<span className="text-white">Pay</span></span>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto md:overflow-y-auto px-2 md:px-3 flex flex-row md:flex-col gap-1 md:gap-1 items-center md:items-stretch py-2 md:py-6 no-scrollbar">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 w-16 md:w-full px-1 md:px-4 py-1 md:py-3 rounded-xl text-xs md:text-sm font-medium transition-all group shrink-0",
                isActive 
                  ? "bg-blue-600/10 text-blue-400" 
                  : "text-gray-400 hover:bg-[#16191F] hover:text-gray-200"
              )}
            >
              <Icon className={cn("w-5 h-5 md:w-5 md:h-5", isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-400")} />
              <span className="text-[10px] md:text-sm whitespace-nowrap overflow-hidden text-ellipsis w-full text-center md:text-left">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="p-2 md:p-4 border-l md:border-l-0 md:border-t border-white/5 shrink-0 flex items-center md:block">
        <button
          onClick={onLogout}
          className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 w-16 md:w-full px-1 md:px-4 py-1 md:py-3 rounded-xl text-xs md:text-sm font-medium text-gray-400 border border-transparent md:border-white/5 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
        >
          <LogOut className="w-5 h-5 md:w-4 md:h-4 text-red-500 md:text-gray-400 group-hover:text-red-400" />
          <span className="text-[10px] md:text-sm whitespace-nowrap block md:inline">Logout</span>
        </button>
      </div>
    </aside>
  );
}
