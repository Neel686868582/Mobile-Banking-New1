import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/2fa/setup', async (req, res) => {
    try {
      const { user } = req.body;
      const secret = speakeasy.generateSecret({ length: 20, name: `RupeePay (${user})` });
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
      res.json({ success: true, secret: secret.base32, qrCode });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to generate secret' });
    }
  });

  app.post('/api/2fa/verify-setup', (req, res) => {
    const { token, secret } = req.body;
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });
    if (verified) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Invalid token' });
    }
  });

  app.post('/api/2fa/verify', (req, res) => {
    const { token, secret } = req.body;
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });
    if (verified) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Invalid token' });
    }
  });

  app.post('/api/2fa/disable', (req, res) => {
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== 'production') {
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
