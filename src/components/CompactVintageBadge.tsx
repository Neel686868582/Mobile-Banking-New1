import React from 'react';
import { Shield, ShieldAlert } from 'lucide-react';

export function CompactVintageBadge({ enabled, onClick }: { enabled?: boolean; onClick?: () => void }) {
  if (!enabled) {
    return (
      <div 
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-600/40 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-sm relative overflow-hidden group cursor-pointer hover:border-gray-500/60 transition-colors"
        title="Click to enable Two-Factor Authentication"
      >
        <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-gray-950 border border-gray-600/40 shadow-inner">
          <ShieldAlert className="w-3 h-3 text-gray-400" />
        </div>
        <span 
          className="text-[10px] font-sans font-bold tracking-[0.1em] text-gray-400"
        >
          2FA DISABLED
        </span>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-green-500/30 bg-gradient-to-r from-green-900/60 via-green-800/40 to-green-900/60 shadow-[0_4px_10px_rgba(34,197,94,0.15)] ring-1 ring-green-500/20 relative overflow-hidden group cursor-pointer transition-colors"
      title="Secured by Two-Factor Authentication"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-black/40 border border-green-500/40 shadow-inner">
        <Shield className="w-3 h-3 text-green-400" />
      </div>
      <span 
        className="text-[10px] font-sans font-bold tracking-[0.1em] text-green-400"
      >
        2FA ENABLED
      </span>
    </div>
  );
}



