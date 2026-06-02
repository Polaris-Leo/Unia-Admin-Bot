import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import axios from 'axios';
import authRouter from './routes/auth.js';
import danmakuRouter, { createDanmakuWSS } from './routes/danmaku.js';
import banRouter from './routes/ban.js';
import historyRouter from './routes/history.js';
import tagsRouter from './routes/tags.js';
import modsRouter from './routes/mods.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

initDb();

const app = express();
const server = createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/cookie-status', async (req, res) => {
  const url = (process.env.COOKIE_MANAGER_URL || '').replace(/\/$/, '');
  if (!url) {
    return res.json({ source: 'local', connected: false, configured: false });
  }
  try {
    const r = await axios.get(`${url}/api/accounts/cookie`, { timeout: 3000 });
    const uid = r.data?.data?.uid;
    res.json({ source: 'remote', connected: true, configured: true, uid, url });
  } catch {
    res.json({ source: 'remote', connected: false, configured: true, url });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/danmaku', danmakuRouter);
app.use('/api/ban', banRouter);
app.use('/api/history', historyRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/mods', modsRouter);

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

createDanmakuWSS(server);

server.listen(PORT, () => {
  console.log(`✅ Unia-Admin-Bot backend running on port ${PORT}`);
});
