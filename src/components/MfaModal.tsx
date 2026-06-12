import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function MfaModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  secret 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  secret: string;
}) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (token.length !== 6) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, secret })
      });
      const data = await resp.json();
      if (data.success) {
        setToken('');
        onSuccess();
      } else {
        toast.error('Invalid Google Authenticator code');
      }
    } catch (err) {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-[#16191F] border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure Transaction</h3>
            <p className="text-sm text-gray-400">
              Enter the 6-digit code from Google Authenticator to confirm this transaction.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <input 
                type="text" 
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').substring(0, 6))}
                placeholder="000000"
                className="w-full bg-[#0A0B0D] text-white border border-white/10 rounded-2xl py-4 flex-1 focus:border-blue-500 focus:outline-none transition-colors text-center text-3xl tracking-[0.5em] font-mono shadow-inner"
                autoFocus
              />
            </div>
            <button 
              type="submit"
              disabled={loading || token.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Confirm'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
