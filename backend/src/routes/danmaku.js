import { Router } from 'express';
import { WebSocketServer } from 'ws';
import { BilibiliLiveWS } from '../services/bilibiliLiveWS.js';
import { loadCookies } from '../utils/cookieStorage.js';
import { requireAuth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'change_me';

let currentWS = null;
let currentRoomId = null;
let wss = null;

function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function attachHandlers(liveWS) {
  liveWS.onDanmaku    = (msg) => broadcast(msg);
  liveWS.onGift       = (msg) => broadcast(msg);
  liveWS.onGuard      = (msg) => broadcast(msg);
  liveWS.onSuperChat  = (msg) => broadcast(msg);
  liveWS.onLiveStatus = (msg) => broadcast({ type: 'live_status', ...msg });
  liveWS.onRoomInfo   = (msg) => broadcast({ type: 'room_info', ...msg });
  liveWS.onWatched    = (msg) => broadcast(msg);
  liveWS.onLike       = (msg) => broadcast(msg);
  liveWS.onRankCount  = (msg) => broadcast(msg);
  liveWS.onPopularity = (msg) => broadcast(msg);
}

export async function connectRoom(roomId) {
  if (currentWS) {
    currentWS._intentionalDisconnect = true;
    currentWS.disconnect?.();
  }
  const cookies = await loadCookies();
  currentWS = new BilibiliLiveWS(roomId, cookies);
  currentRoomId = roomId;
  attachHandlers(currentWS);
  await currentWS.connect();
  console.log(`✅ 已连接直播间 ${roomId}`);
}

// 手动触发连接（房管重连等场景）
router.post('/start', requireAuth, async (req, res, next) => {
  try {
    const roomId = req.body.roomId || process.env.ROOM_ID;
    if (!roomId) return res.status(400).json({ error: '未配置房间号' });
    await connectRoom(roomId);
    res.json({ ok: true, roomId: currentRoomId });
  } catch (e) { next(e); }
});

router.post('/stop', requireAuth, (req, res) => {
  if (currentWS) {
    currentWS._intentionalDisconnect = true;
    currentWS.disconnect?.();
    currentWS = null;
    currentRoomId = null;
  }
  res.json({ ok: true });
});

router.get('/rooms', requireAuth, (req, res) => {
  res.json({
    roomId: currentRoomId,
    configured: process.env.ROOM_ID || null,
    connected: !!currentWS?.isConnected
  });
});

export function createDanmakuWSS(server) {
  wss = new WebSocketServer({ server, path: '/ws/danmaku' });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    try {
      jwt.verify(token, SECRET);
    } catch {
      ws.close(4001, 'Unauthorized');
      return;
    }
    ws.on('error', () => {});
  });
}

export default router;
