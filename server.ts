import express from 'express';
// Vite import removed from top level to allow dynamic import in development
import path from 'path';
import fs from 'fs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  const DB_FILE = path.join(process.cwd(), 'database.json');

  interface Transaction {
    id: string;
    name: string;
    date: string;
    amount: number;
    type: 'credit' | 'debit';
    icon: string;
  }

  interface Notification {
    id: string;
    message: string;
    date: string;
    read: boolean;
  }

  interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
  }

  interface UserData {
    pass: string;
    name: string;
    balance: number;
    transactions: Transaction[];
    income: number;
    expenses: number;
    isAdmin?: boolean;
    avatar?: string;
    notifications?: Notification[];
    goals?: Goal[];
    twoFactorSecret?: string;
    twoFactorEnabled?: boolean;
  }

  let users: Record<string, UserData> = {};

  if (fs.existsSync(DB_FILE)) {
    try {
      users = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      users = {};
    }
  }

  if (!users['admin']) {
    users['admin'] = {
      pass: 'admin123',
      name: 'System Administrator',
      balance: 0,
      transactions: [],
      income: 0,
      expenses: 0,
      isAdmin: true,
      notifications: [],
      goals: []
    };
  }
  if (!users['arjun@rupeepay']) {
    users['arjun@rupeepay'] = {
      pass: 'demo1234',
      name: 'Arjun Kumar',
      balance: 124500,
      transactions: [
        { id: 'tx1', name: 'Salary - Infosys Ltd', date: new Date(Date.now() - 3 * 86400000).toISOString(), amount: 48200, type: 'credit', icon: 'ArrowDownLeft' },
        { id: 'tx2', name: 'Amazon India', date: new Date(Date.now() - 4 * 86400000).toISOString(), amount: 3499, type: 'debit', icon: 'ArrowUpRight' },
        { id: 'tx3', name: 'Swiggy Order', date: new Date(Date.now() - 5 * 86400000).toISOString(), amount: 450, type: 'debit', icon: 'ArrowUpRight' },
      ],
      income: 53200,
      expenses: 6079,
      isAdmin: false,
      notifications: [
        { id: 'n1', message: 'Welcome to RupeePay!', date: new Date().toISOString(), read: false }
      ],
      goals: []
    }
  }

  const saveDB = () => {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
  };
  saveDB();

  function addNotification(user: string, message: string) {
    if (!users[user]) return;
    if (!users[user].notifications) users[user].notifications = [];
    users[user].notifications.unshift({
      id: Date.now().toString(),
      message,
      date: new Date().toISOString(),
      read: false
    });
  }

  app.post('/api/register', (req, res) => {
    const { name, user, pass } = req.body;
    if (!name || !user || !pass) return res.status(400).json({ success: false, message: "Fill all fields" });
    if (users[user]) return res.status(400).json({ success: false, message: "User ID already exists!" });

    users[user] = {
      pass,
      name,
      balance: 0,
      transactions: [],
      income: 0,
      expenses: 0,
      notifications: [],
      goals: []
    };
    addNotification(user, `Welcome to RupeePay, ${name}!`);
    saveDB();
    res.json({ success: true, message: "Account created successfully", name });
  });

  app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const account = users[user];
    if (account && account.pass === pass) {
      res.json({ success: true, message: "Logged in successfully", account: { user, name: account.name, isAdmin: account.isAdmin } });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  app.get('/api/dashboard', (req, res) => {
    const user = req.query.user as string;
    const account = users[user];
    if (!account) return res.status(401).json({ success: false, message: "Not logged in" });

    res.json({
       ...account,
       pass: undefined 
    });
  });

  app.post('/api/transfer', (req, res) => {
    const { user, name, amount, method } = req.body;
    const account = users[user];
    if (!account) return res.status(401).json({ success: false, message: "Not logged in" });

    const numAmount = parseFloat(amount);
    if (!name || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid transfer details" });
    }
    if (numAmount > account.balance) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    account.balance -= numAmount;
    account.expenses += numAmount;
    
    account.transactions.unshift({
      id: Date.now().toString(),
      name: `${method} to ${name}`,
      date: new Date().toISOString(),
      amount: numAmount,
      type: 'debit',
      icon: 'ArrowUpRight'
    });

    addNotification(user, `Sent ₹${numAmount} to ${name} via ${method}.`);

    if (account.balance < 5000) {
      addNotification(user, `Low balance warning! Your balance is below ₹5,000.`);
    }

    saveDB();
    res.json({ success: true });
  });

  app.post('/api/deposit', (req, res) => {
    const { user, amount, source, ref } = req.body;
    const account = users[user];
    if (!account) return res.status(401).json({ success: false, message: "Not logged in" });

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });

    account.balance += numAmount;
    account.income += numAmount;
    
    account.transactions.unshift({
      id: Date.now().toString(),
      name: `Deposit via ${source}`,
      date: new Date().toISOString(),
      amount: numAmount,
      type: 'credit',
      icon: 'ArrowDownLeft'
    });

    addNotification(user, `Received ₹${numAmount} via ${source}.`);
    saveDB();
    res.json({ success: true });
  });

  app.post('/api/bills/pay', (req, res) => {
    const { user, category, provider, amount } = req.body;
    const account = users[user];
    if (!account) return res.status(401).json({ success: false, message: "Not logged in" });

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });
    if (numAmount > account.balance) return res.status(400).json({ success: false, message: "Insufficient balance" });

    account.balance -= numAmount;
    account.expenses += numAmount;

    account.transactions.unshift({
      id: Date.now().toString(),
      name: `${category} Bill - ${provider}`,
      date: new Date().toISOString(),
      amount: numAmount,
      type: 'debit',
      icon: 'FileText'
    });

    addNotification(user, `Bill paid: ₹${numAmount} for ${category} (${provider}).`);
    
    if (account.balance < 5000) {
      addNotification(user, `Low balance warning! Your balance is below ₹5,000.`);
    }

    saveDB();
    res.json({ success: true });
  });

  app.post('/api/goals/create', (req, res) => {
    const { user, name, targetAmount } = req.body;
    const account = users[user];
    if (!account) return res.status(401).json({ success: false });

    if (!account.goals) account.goals = [];
    account.goals.unshift({
      id: Date.now().toString(),
      name,
      targetAmount: parseFloat(targetAmount),
      currentAmount: 0
    });
    saveDB();
    res.json({ success: true });
  });

  app.post('/api/goals/fund', (req, res) => {
    const { user, goalId, amount } = req.body;
    const account = users[user];
    if (!account) return res.status(401).json({ success: false });

    const numAmt = parseFloat(amount);
    if (numAmt > account.balance) return res.status(400).json({ success: false, message: "Insufficient balance" });

    const goal = account.goals?.find(g => g.id === goalId);
    if (!goal) return res.status(404).json({ success: false });

    account.balance -= numAmt;
    goal.currentAmount += numAmt;

    account.transactions.unshift({
      id: Date.now().toString(),
      name: `Allocated to Goal: ${goal.name}`,
      date: new Date().toISOString(),
      amount: numAmt,
      type: 'debit',
      icon: 'Target'
    });

    saveDB();
    res.json({ success: true });
  });

  app.post('/api/profile/update', (req, res) => {
    const { user, name, pass, avatar } = req.body;
    const account = users[user];
    if (!account) return res.status(401).json({ success: false });

    if (name) account.name = name;
    if (pass) account.pass = pass;
    if (avatar) account.avatar = avatar;

    saveDB();
    res.json({ success: true });
  });

  // --- 2FA ENDPOINTS ---

  app.post('/api/2fa/setup', async (req, res) => {
    const { user } = req.body;
    if (!user) return res.status(400).json({ success: false });

    const secret = speakeasy.generateSecret({
      name: `RupeePay (${user})`,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  });

  app.post('/api/2fa/verify-setup', (req, res) => {
    const { token, secret } = req.body;
    if (!token || !secret) return res.status(400).json({ success: false });

    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token
    });

    if (verified) {
      res.json({ success: true, message: 'Two-factor authentication enabled!' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid code. Please try again.' });
    }
  });

  app.post('/api/2fa/verify', (req, res) => {
    const { token, secret } = req.body;

    if (!secret) return res.status(400).json({ success: false, message: '2FA is not enabled for this user.' });

    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token
    });

    if (verified) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Invalid code' });
    }
  });

  app.post('/api/2fa/disable', (req, res) => {
    res.json({ success: true });
  });

  app.get('/api/admin/stats', (req, res) => {
    const { user } = req.query;
    if (!users[user as string]?.isAdmin) return res.status(403).json({ success: false, message: "Unauthorized" });

    const normalUsers = Object.entries(users).filter(([k, v]) => !v.isAdmin);
    const totalUsers = normalUsers.length;
    const totalMoney = normalUsers.reduce((acc, [_, v]) => acc + v.balance, 0);

    const userList = normalUsers.map(([id, data]) => ({
      id,
      name: data.name,
      balance: data.balance,
      txCount: data.transactions?.length || 0,
      joined: data.transactions?.[data.transactions.length - 1]?.date || new Date().toISOString()
    }));

    res.json({ success: true, totalUsers, totalMoney, users: userList });
  });

  app.post('/api/admin/user/balance', (req, res) => {
    const { admin, targetUser, action, amount } = req.body;
    if (!users[admin]?.isAdmin) return res.status(403).json({ success: false });

    const account = users[targetUser];
    if (!account) return res.status(404).json({ success: false, message: "User not found" });

    const numAmount = parseFloat(amount);
    if (action === 'add') {
      account.balance += numAmount;
      account.income += numAmount;
      account.transactions.unshift({
        id: Date.now().toString(),
        name: `Admin Adjustment (Credit)`,
        date: new Date().toISOString(),
        amount: numAmount,
        type: 'credit',
        icon: 'PlusCircle'
      });
      addNotification(targetUser, `Admin credited ₹${numAmount} to your account.`);
    } else if (action === 'remove') {
      if (account.balance < numAmount) return res.status(400).json({ success: false, message: "Insufficient user balance" });
      account.balance -= numAmount;
      account.expenses += numAmount;
      account.transactions.unshift({
        id: Date.now().toString(),
        name: `Admin Adjustment (Debit)`,
        date: new Date().toISOString(),
        amount: numAmount,
        type: 'debit',
        icon: 'MinusCircle'
      });
      addNotification(targetUser, `Admin deducted ₹${numAmount} from your account.`);
    }

    saveDB();
    res.json({ success: true, newBalance: account.balance });
  });

  app.delete('/api/admin/user/:id', (req, res) => {
    const { user } = req.query; 
    if (!users[user as string]?.isAdmin) return res.status(403).json({ success: false });
    
    if (req.params.id === 'admin') return res.status(400).json({ success: false, message: "Cannot delete admin" });

    delete users[req.params.id];
    saveDB();
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
