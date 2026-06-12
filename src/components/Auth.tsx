import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, Wallet, Mail } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

export function Auth({ onLogin }: { onLogin: (user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneVal, setPhoneVal] = useState('+91 ');
  
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const handleForgotPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const emailLower = forgotEmail.toLowerCase().trim();

      await sendPasswordResetEmail(auth, emailLower);
      setForgotSuccess('Password reset link has been sent to your email. Please check your inbox.');
      setForgotEmail('');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setForgotError('This email is not registered. Please register first.');
      } else {
        setForgotError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith("+91 ")) {
      if (val.startsWith("+91")) val = "+91 " + val.slice(3);
      else if (val.startsWith("+9")) val = "+91 " + val.slice(2);
      else if (val.startsWith("+")) val = "+91 " + val.slice(1);
      else val = "+91 " + val;
    }
    setPhoneVal(val);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const emailAsId = result.user.email!;
      const userDoc = await getDoc(doc(db, 'users', emailAsId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (!data.accountNumber) {
          data.accountNumber = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          await setDoc(doc(db, 'users', emailAsId), data);
        }
        toast.success("Login Successful!");
        onLogin({ uid: emailAsId, ...data });
      } else {
        const newUser = {
          uid: emailAsId,
          email: result.user.email,
          name: result.user.displayName || 'User',
          accountNumber: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
          balance: 0,
          income: 0,
          expenses: 0,
          isAdmin: result.user.email === 'admin@rupeepay.com' || result.user.email === 'admin@astrabank.com',
          createdAt: new Date().toISOString(),
          phone: '',
          twoFactorEnabled: false,
          twoFactorStatus: 'Off'
        };
        await setDoc(doc(db, 'users', emailAsId), newUser);
        toast.success("Registration Successful!");
        onLogin(newUser);
      }
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const pass = formData.get('pass') as string;
    const name = formData.get('name') as string;

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const emailAsId = userCredential.user.email!;
        const userDoc = await getDoc(doc(db, 'users', emailAsId));
        if (userDoc.exists()) {
          toast.success("Login Successful!");
          onLogin({ uid: emailAsId, ...userDoc.data() });
        } else {
          setError('User profile not found.');
        }
      } else {
        const name = formData.get('name') as string;
        const phone = formData.get('phone') as string;

        if (phone && phone !== "+91 " && phone.trim() !== '') {
          const numberPart = phone.replace('+91 ', '').replace(/\s/g, '');
          if (numberPart.length !== 10) {
            setError('Please enter a valid 10-digit mobile number.');
            setLoading(false);
            return;
          }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const emailAsId = userCredential.user.email!;
        
        if (phone && phone !== "+91 " && phone.trim() !== '') {
          try {
            const phoneQuery = query(collection(db, 'users'), where('phone', '==', phone));
            const phoneDocs = await getDocs(phoneQuery);
            if (!phoneDocs.empty) {
              // Delete the auth user we just created since phone is duplicate
              await userCredential.user.delete();
              setError('Phone number already used by another account.');
              setLoading(false);
              return;
            }
          } catch (e: any) {
             console.warn("Could not verify phone uniqueness due to permissions", e);
             // If rules prevent querying, we must allow registration to proceed
          }
        }
        
        const newUser = {
          uid: emailAsId,
          email,
          name,
          accountNumber: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
          balance: 0,
          income: 0,
          expenses: 0,
          isAdmin: email === 'admin@rupeepay.com' || email === 'admin@astrabank.com',
          createdAt: new Date().toISOString(),
          phone: phone || '',
          twoFactorEnabled: false,
          twoFactorStatus: 'Off'
        };
        
        await setDoc(doc(db, 'users', emailAsId), newUser);
        toast.success("Registration Successful!");
        onLogin(newUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Email is already registered.');
      else if (err.code === 'auth/invalid-credential') setError('Invalid email or password.');
      else setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex flex-col items-center justify-center p-4 relative overflow-hidden text-gray-200 selection:bg-emerald-500/30">
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#16191F] border border-white/5 p-10 rounded-2xl w-full max-w-md relative z-10 shadow-2xl"
      >
        <div className="mb-10">
          <div className="flex items-center gap-2 text-blue-400 font-sans tracking-tight text-3xl mb-2">
            <Wallet className="w-8 h-8" />
            <span>Rupee<span className="text-white">Pay</span></span>
          </div>
          <p className="text-sm text-gray-500">Secure. Simple. Indian Banking.</p>
        </div>

        <h2 className="text-2xl font-medium mb-1">{isLogin ? 'Welcome back' : 'Create Account'}</h2>
        <p className="text-gray-500 text-sm mb-8">{isLogin ? 'Login to access your account' : 'Open your digital bank account in minutes'}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                    <input required name="name" type="text" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="e.g. Arjun Kumar" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    <input required name="phone" type="text" value={phoneVal} onChange={handlePhoneChange} maxLength={14} className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="+91 98765 43210" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input required name="email" type="email" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="your@email.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input required name="pass" type="password" className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Enter password" />
            </div>
            {isLogin && (
              <div className="mt-2 text-right">
                <button type="button" onClick={() => setShowForgotPass(true)} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Forgot Password?</button>
              </div>
            )}
          </div>

          {error && <div className="text-red-400 text-sm text-center">{error}</div>}

          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-50 mt-4">
            {loading ? 'Processing...' : (isLogin ? 'Login →' : 'Open Account →')}
          </button>
          
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-gray-500 bg-[#16191F]">Or continue with</span>
            </div>
          </div>
          
          <button 
            type="button" 
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full mt-6 bg-[#0A0B0D] hover:bg-white/5 border border-white/5 text-gray-200 font-medium py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-blue-400 hover:text-emerald-300 transition-colors">
            {isLogin ? 'Create one' : 'Login'}
          </button>
        </div>


      </motion.div>

      <AnimatePresence>
        {showForgotPass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#16191F] border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => { setShowForgotPass(false); setForgotError(''); setForgotSuccess(''); }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
              
              <h3 className="text-xl font-medium mb-2 text-white">Reset Password</h3>
              <p className="text-gray-400 text-sm mb-6">Enter your email address and we'll send you a link to reset your password.</p>
              
              {forgotSuccess ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-4 rounded-xl text-center mb-6">
                  {forgotSuccess}
                </div>
              ) : (
                <form onSubmit={handleForgotPass} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                      <input 
                        type="email" 
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none transition-colors text-white" 
                        placeholder="your@email.com" 
                      />
                    </div>
                  </div>
                  
                  {forgotError && <div className="text-red-400 text-sm text-center">{forgotError}</div>}
                  
                  <button 
                    disabled={forgotLoading} 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
