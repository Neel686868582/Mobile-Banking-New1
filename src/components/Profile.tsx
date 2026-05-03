import React, { useState, useRef } from 'react';
import { UserRound, Camera } from 'lucide-react';
import { updateUserProfile } from '../lib/firebaseUtils';
import { auth } from '../lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

export function Profile({ userData, user, onComplete }: { userData: any, user: string, onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ text: '', type: '' });
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaData, setMfaData] = useState<{ secret: string, qrCode: string } | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMsg, setMfaMsg] = useState({ text: '', type: '' });
  
  const fileInput = useRef<HTMLInputElement>(null);
  
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      await updateUserProfile(user, { name });
      setMsg({ text: 'Profile updated successfully!', type: 'success' });
      onComplete();
    } catch (err) {
      setMsg({ text: 'Failed to update profile', type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) return;
    
    setPwdLoading(true);
    setPwdMsg({ text: '', type: '' });
    
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPwdMsg({ text: 'Password updated successfully!', type: 'success' });
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setPwdMsg({ text: 'Incorrect old password', type: 'error' });
      } else {
        setPwdMsg({ text: err.message || 'Failed to update password', type: 'error' });
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await updateUserProfile(user, { avatar: base64 });
        onComplete();
      };
      reader.readAsDataURL(file);
    }
  };

  const startMfaSetup = async () => {
    setMfaLoading(true);
    setMfaMsg({ text: '', type: '' });
    try {
      const resp = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      const data = await resp.json();
      if (data.success) {
        setMfaData({ secret: data.secret, qrCode: data.qrCode });
      }
    } catch (err) {
      setMfaMsg({ text: 'Failed to start MFA setup', type: 'error' });
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyMfaSetup = async () => {
    if (!mfaData) return;
    setMfaLoading(true);
    setMfaMsg({ text: '', type: '' });
    try {
      const resp = await fetch('/api/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, token: mfaToken, secret: mfaData.secret })
      });
      const data = await resp.json();
      if (data.success) {
        await updateUserProfile(user, { twoFactorEnabled: true });
        setMfaMsg({ text: '2FA Enabled successfully!', type: 'success' });
        setMfaData(null);
        setMfaToken('');
        onComplete();
      } else {
        setMfaMsg({ text: data.message, type: 'error' });
      }
    } catch (err) {
      setMfaMsg({ text: 'Failed to verify 2FA', type: 'error' });
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!window.confirm('Are you sure you want to disable Two-Factor Authentication?')) return;
    setMfaLoading(true);
    try {
      await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      await updateUserProfile(user, { twoFactorEnabled: false });
      setMfaMsg({ text: '2FA Disabled', type: 'success' });
      onComplete();
    } catch (err) {
      setMfaMsg({ text: 'Failed to disable 2FA', type: 'error' });
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="mb-8 p-8 bg-[#16191F] border border-white/5 rounded-3xl flex flex-col items-center">
        <div className="relative group cursor-pointer mb-4" onClick={() => fileInput.current?.click()}>
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-gray-950 font-bold overflow-hidden shadow-xl text-2xl">
            {userData.avatar ? (
              <img src={userData.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              userData.name.substring(0,2).toUpperCase()
            )}
          </div>
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
        </div>
        <input type="file" accept="image/*" ref={fileInput} className="hidden" onChange={handlePhotoUpload} />
        <h2 className="text-2xl font-sans tracking-tight">{userData.name}</h2>
        <div className="flex flex-col items-center gap-1 mt-1">
          <p className="text-gray-500 text-sm">Account Number: <span className="font-mono text-gray-300">{userData.accountNumber || 'Not available'}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
          <h3 className="text-lg font-medium mb-6 border-b border-white/5 pb-4">Account Settings</h3>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Display Name</label>
              <input name="name" type="text" defaultValue={userData.name} className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" />
            </div>

            {msg.text && (
              <div className={`p-4 rounded-xl text-sm justify-center flex ${msg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-600/10 text-blue-400'}`}>
                {msg.text}
              </div>
            )}

            <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold py-4 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
          <h3 className="text-lg font-medium mb-6 border-b border-white/5 pb-4">Change Password</h3>
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Old Password</label>
              <input 
                type="password" 
                value={oldPassword} 
                onChange={(e) => setOldPassword(e.target.value)} 
                required 
                className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">New Password (Min 6 chars)</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
                minLength={6}
                className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors" 
              />
            </div>

            {pwdMsg.text && (
              <div className={`p-4 rounded-xl text-sm justify-center flex ${pwdMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-600/10 text-blue-400'}`}>
                {pwdMsg.text}
              </div>
            )}

            <button disabled={pwdLoading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all disabled:opacity-50">
              {pwdLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
        <h3 className="text-lg font-medium mb-4 border-b border-white/5 pb-4">Two-Factor Authentication (MFA)</h3>
        <p className="text-gray-400 text-sm mb-6">
          Secure your account by adding an extra layer of security. Once enabled, you'll need to enter a code from your Google Authenticator app to login.
        </p>

        {userData.twoFactorEnabled ? (
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-4 py-2 rounded-lg text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> 2FA is currently ENABLED
            </div>
            <button 
              onClick={disableMfa}
              disabled={mfaLoading}
              className="px-6 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl text-sm font-medium transition-all"
            >
              {mfaLoading ? 'Processing...' : 'Disable 2FA'}
            </button>
          </div>
        ) : (
          <div>
            {!mfaData ? (
              <button 
                onClick={startMfaSetup}
                disabled={mfaLoading}
                className="bg-blue-600 hover:bg-blue-500 text-gray-950 font-semibold px-8 py-3 rounded-xl transition-all"
              >
                {mfaLoading ? 'Loading...' : 'Enable Google Authenticator'}
              </button>
            ) : (
              <div className="flex flex-col md:flex-row gap-8 items-center bg-[#0A0B0D] p-6 rounded-2xl border border-white/5">
                <div className="bg-white p-2 rounded-lg">
                  <img src={mfaData.qrCode} alt="QR Code" className="w-40 h-40" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="font-semibold mb-1">Scan this QR Code</h4>
                    <p className="text-xs text-gray-500">Open Google Authenticator and scan the code above.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Enter 6-digit code to verify</label>
                    <input 
                      type="text" 
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').substring(0, 6))}
                      placeholder="000000"
                      className="w-full bg-[#16191F] text-white border border-white/10 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-center text-xl tracking-[0.5em] font-mono"
                    />
                  </div>
                  <button 
                    onClick={verifyMfaSetup}
                    disabled={mfaLoading || mfaToken.length < 6}
                    className="w-full bg-green-600 hover:bg-green-500 text-gray-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                  >
                    {mfaLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button onClick={() => setMfaData(null)} className="w-full text-xs text-gray-500 hover:text-gray-400">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {mfaMsg.text && (
          <div className={`mt-4 p-4 rounded-xl text-sm justify-center flex ${mfaMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-600/10 text-green-400'}`}>
            {mfaMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}
