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
        <p className="text-gray-500 text-sm">User ID: {user}</p>
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
    </div>
  );
}
