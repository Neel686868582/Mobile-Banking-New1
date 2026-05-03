import { useEffect, useState } from 'react';
import { formatINR } from '../lib/utils';
import { ShieldAlert, Users, IndianRupee, Trash2, Plus, Minus } from 'lucide-react';
import { getAllUsers, adminUpdateBalance, deleteUser } from '../lib/firebaseUtils';

export function AdminPanel({ adminUser }: { adminUser: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      const users = await getAllUsers();
      const totalMoney = users.reduce((acc: number, u: any) => acc + (u.balance || 0), 0);
      setStats({
        users,
        totalUsers: users.length,
        totalMoney
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleBalance = async (targetUser: string, action: 'add'|'remove') => {
    const amount = prompt(`Enter amount to ${action}:`);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    
    try {
      await adminUpdateBalance(targetUser, Number(amount), action);
      loadStats();
    } catch (e) {
      alert('Failed to update balance');
    }
  };

  const handleDelete = async (targetUser: string) => {
    try {
      await deleteUser(targetUser);
      loadStats();
    } catch (e) {
      alert('Failed to delete user');
    }
  };

  if (loading) return <div className="text-gray-500 mt-10 text-center">Loading Admin Panel...</div>;

  return (
    <div className="max-w-6xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><ShieldAlert className="text-blue-400" /> Admin Dashboard</h2>
        <p className="text-gray-500">System-wide overview and user management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="text-gray-500 font-medium uppercase tracking-wider text-sm mb-1">Total Users</div>
            <div className="text-4xl font-sans tracking-tight text-white">{stats?.totalUsers || 0}</div>
          </div>
        </div>
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center">
            <IndianRupee className="w-8 h-8" />
          </div>
          <div>
            <div className="text-gray-500 font-medium uppercase tracking-wider text-sm mb-1">Total Money Inside Bank</div>
            <div className="text-4xl font-sans tracking-tight text-white">{formatINR(stats?.totalMoney || 0)}</div>
          </div>
        </div>
      </div>

      <div className="bg-[#16191F] border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-medium">Registered Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A0B0D] text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">User ID</th>
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">Balance</th>
                <th className="p-4 font-semibold">Transactions</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats?.users?.map((u: any) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-gray-300 font-medium">{u.id}</td>
                  <td className="p-4 text-gray-400">{u.name}</td>
                  <td className="p-4 text-blue-400 font-medium">{formatINR(u.balance)}</td>
                  <td className="p-4 text-gray-400">{u.txCount}</td>
                  <td className="p-4 flex items-center justify-end gap-2">
                    <button onClick={() => handleBalance(u.id, 'add')} className="p-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg" title="Add Funds">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleBalance(u.id, 'remove')} className="p-2 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-lg" title="Deduct Funds">
                      <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(u.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg" title="Delete User">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {stats?.users?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
