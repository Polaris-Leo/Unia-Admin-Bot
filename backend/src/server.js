import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import axios from 'axios';
import authRouter from './routes/auth.js';
import danmakuRouter, { createDanmakuWSS, connectRoom } from './routes/danmaku.js';
import banRouter from './routes/ban.js';
import historyRouter from './routes/history.js';
import tagsRouter from './routes/tags.js';
import modsRouter from './routes/mods.js';
import bilibiliRouter from './routes/bilibili.js';
import { loadCookies, loadLocalCookies } from './utils/cookieStorage.js';

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

  // 检查远程 BiliCookie 服务（用配置的 UID 验证可达性）
  const configuredUid = (process.env.BILI_COOKIE_UID || '').trim();
  let remote = { connected: false, uid: null, configuredUid: configuredUid || null };
  if (url) {
    const endpoint = configuredUid
      ? `${url}/api/accounts/${configuredUid}/cookie`
      : `${url}/api/accounts/cookie`;
    try {
      const r = await axios.get(endpoint, { timeout: 3000 });
      if (r.data?.success) {
        remote = { connected: true, uid: r.data?.data?.uid || configuredUid || null, configuredUid: configuredUid || null };
      }
    } catch {}
  }

  // 检查本地 cookies.json（只读文件，不走 BiliCookie 服务）
  const localCookies = loadLocalCookies();
  const localAuth = !!(localCookies?.SESSDATA && localCookies?.bili_jct);
  const localUid = localCookies?.DedeUserID || null;

  // 当前实际使用的来源
  const activeSource = remote.connected ? 'remote' : localAuth ? 'local' : 'none';

  res.json({
    activeSource,
    remote: {
      configured: !!url,
      url: url || null,
      connected: remote.connected,
      uid: remote.uid,
      configuredUid: remote.configuredUid   // 修复：之前漏掉了这个字段
    },
    local: { authenticated: localAuth, uid: localUid }
  });
});

app.use('/api/auth', authRouter);
app.use('/api/danmaku', danmakuRouter);
app.use('/api/ban', banRouter);
app.use('/api/history', historyRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/mods', modsRouter);
app.use('/api/bilibili', bilibiliRouter);

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

createDanmakuWSS(server);

server.listen(PORT, () => {
  console.log(`✅ Unia-Admin-Bot backend running on port ${PORT}`);
  const roomId = process.env.ROOM_ID;
  if (roomId) {
    setTimeout(() => connectRoom(roomId).catch(e => console.error('自动连接失败:', e.message)), 1000);
  } else {
    console.log('⚠️  未配置 ROOM_ID，跳过自动连接');
  }
});
