import { db } from '../db.js';
import { delSilentUser, getSilentUserList } from './biliAdmin.js';

const CHECK_INTERVAL_MS = Number(process.env.BAN_AUTO_CHECK_INTERVAL_MS || 60 * 1000);
const LIVE_END_CHECK_DELAY_MS = Number(process.env.BAN_LIVE_END_CHECK_DELAY_MS || 30 * 1000);

let intervalTimer = null;
let checkingFinite = false;
const liveEndTimers = new Map();
const checkingRooms = new Set();

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) return { rows: payload, totalPage: 1 };
  return {
    rows: Array.isArray(payload?.data) ? payload.data : [],
    totalPage: Number(payload?.total_page || 1)
  };
}

export async function getAllSilentUsers(roomId) {
  const first = normalizeListPayload(await getSilentUserList({ roomId, page: 1 }));
  const rows = [...first.rows];
  const totalPage = Math.max(1, first.totalPage);

  for (let page = 2; page <= totalPage; page += 1) {
    const next = normalizeListPayload(await getSilentUserList({ roomId, page }));
    rows.push(...next.rows);
  }

  return rows;
}

export async function findSilentRecord(roomId, uid) {
  const users = await getAllSilentUsers(roomId);
  return users.find(item => String(item.tuid) === String(uid)) || null;
}

export async function findSilentRecordWithRetry(roomId, uid, delays = [0, 1000, 3000, 5000]) {
  for (const delay of delays) {
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    const record = await findSilentRecord(roomId, uid);
    if (record?.id) return record;
  }
  return null;
}

function buildActiveMap(activeUsers) {
  const byId = new Map();
  const byUid = new Map();

  for (const user of activeUsers) {
    if (user.id !== undefined && user.id !== null) byId.set(String(user.id), user);
    if (!byUid.has(String(user.tuid))) byUid.set(String(user.tuid), []);
    byUid.get(String(user.tuid)).push(user);
  }

  return { byId, byUid };
}

function findMatchingActive(log, activeMap) {
  if (!log.bilibili_ban_id) return null;
  return activeMap.byId.get(String(log.bilibili_ban_id)) || null;
}

function removeActive(activeMap, active) {
  if (!active) return;
  if (active.id !== undefined && active.id !== null) activeMap.byId.delete(String(active.id));
  const list = activeMap.byUid.get(String(active.tuid));
  if (!list) return;
  const next = list.filter(item => String(item.id) !== String(active.id));
  if (next.length) activeMap.byUid.set(String(active.tuid), next);
  else activeMap.byUid.delete(String(active.tuid));
}

function markAutoState(logId, status, note, checkedAt = Date.now(), unsilencedAt = null) {
  db.prepare(`
    UPDATE ban_logs
    SET auto_unban_checked_at = ?,
        auto_unban_status = ?,
        auto_unban_note = ?,
        unsilenced_at = COALESCE(unsilenced_at, ?)
    WHERE id = ?
  `).run(checkedAt, status, note, unsilencedAt, logId);
}

function hasOpenPermanentBan(log) {
  const row = db.prepare(`
    SELECT id FROM ban_logs
    WHERE room_id = ?
      AND target_uid = ?
      AND ban_hours = -1
      AND unsilenced_at IS NULL
      AND id <> ?
    LIMIT 1
  `).get(log.room_id, log.target_uid, log.id);
  return !!row;
}

async function resolveLogIfNeeded(log, activeMap, reason) {
  const now = Date.now();

  if (!log.bilibili_ban_id) {
    markAutoState(log.id, 'missing_ban_id', `${reason}检查时缺少 B站禁言记录 ID，已跳过自动解禁`, now, null);
    return { status: 'missing_ban_id', logId: log.id };
  }

  const active = findMatchingActive(log, activeMap);
  if (!active) {
    markAutoState(log.id, 'already_released', `${reason}检查时 B站禁言列表中已不存在`, now, now);
    return { status: 'already_released', logId: log.id };
  }

  if (hasOpenPermanentBan(log)) {
    markAutoState(
      log.id,
      'skipped_newer_permanent',
      '该用户存在未解除的永久禁言记录，跳过本条自动解禁',
      now,
      now
    );
    return { status: 'skipped_newer_permanent', logId: log.id };
  }

  try {
    await delSilentUser({ roomId: log.room_id, banId: active.id });
    removeActive(activeMap, active);
    markAutoState(log.id, 'auto_unsilenced', `${reason}检查时仍在 B站禁言列表，系统已自动解除`, now, now);
    return { status: 'auto_unsilenced', logId: log.id, banId: active.id };
  } catch (e) {
    markAutoState(log.id, 'failed', `${reason}自动解除失败：${e.message}`, now, null);
    return { status: 'failed', logId: log.id, error: e.message };
  }
}

export async function checkCurrentSessionBansAfterLiveEnd({ roomId, sessionId, endedAt = Date.now() }) {
  if (!roomId) return [];
  const key = String(roomId);
  if (checkingRooms.has(key)) return [];
  checkingRooms.add(key);

  try {
    const sessionStartMs = sessionId ? Number(sessionId) * 1000 : 0;
    const logs = db.prepare(`
      SELECT * FROM ban_logs
      WHERE room_id = ?
        AND ban_hours = 0
        AND unsilenced_at IS NULL
        AND created_at <= ?
        AND (? = 0 OR created_at >= ?)
      ORDER BY created_at ASC
    `).all(String(roomId), endedAt, sessionStartMs, sessionStartMs);

    if (logs.length === 0) return [];

    const activeUsers = await getAllSilentUsers(roomId);
    const activeMap = buildActiveMap(activeUsers);
    const results = [];

    for (const log of logs) {
      results.push(await resolveLogIfNeeded(log, activeMap, '本场禁言直播结束后'));
    }

    console.log(`[ban-auto-check] 本场禁言检查完成 room=${roomId} count=${results.length}`);
    return results;
  } catch (e) {
    console.error('[ban-auto-check] 本场禁言检查失败:', e.message);
    return [];
  } finally {
    checkingRooms.delete(key);
  }
}

export function scheduleLiveEndBanCheck(payload) {
  const roomId = payload?.roomId;
  if (!roomId) return;
  const key = String(roomId);
  const existing = liveEndTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    liveEndTimers.delete(key);
    checkCurrentSessionBansAfterLiveEnd(payload).catch(e => {
      console.error('[ban-auto-check] 直播结束检查异常:', e.message);
    });
  }, LIVE_END_CHECK_DELAY_MS);

  timer.unref?.();
  liveEndTimers.set(key, timer);
}

export async function checkExpiredFiniteBans() {
  if (checkingFinite) return [];
  checkingFinite = true;

  try {
    const now = Date.now();
    const logs = db.prepare(`
      SELECT * FROM ban_logs
      WHERE ban_hours > 0
        AND unsilenced_at IS NULL
        AND expected_unban_at IS NOT NULL
        AND expected_unban_at <= ?
      ORDER BY room_id ASC, expected_unban_at ASC
    `).all(now);

    if (logs.length === 0) return [];

    const byRoom = new Map();
    for (const log of logs) {
      if (!byRoom.has(log.room_id)) byRoom.set(log.room_id, []);
      byRoom.get(log.room_id).push(log);
    }

    const results = [];
    for (const [roomId, roomLogs] of byRoom.entries()) {
      try {
        const activeUsers = await getAllSilentUsers(roomId);
        const activeMap = buildActiveMap(activeUsers);
        for (const log of roomLogs) {
          results.push(await resolveLogIfNeeded(log, activeMap, '定时禁言到期后'));
        }
      } catch (e) {
        console.error(`[ban-auto-check] 房间 ${roomId} 定时禁言检查失败:`, e.message);
        for (const log of roomLogs) {
          markAutoState(log.id, 'failed', `定时禁言到期检查失败：${e.message}`, now, null);
          results.push({ status: 'failed', logId: log.id, error: e.message });
        }
      }
    }

    console.log(`[ban-auto-check] 定时禁言检查完成 count=${results.length}`);
    return results;
  } finally {
    checkingFinite = false;
  }
}

export function startBanAutoCheckScheduler() {
  if (intervalTimer) return;

  checkExpiredFiniteBans().catch(e => {
    console.error('[ban-auto-check] 启动检查失败:', e.message);
  });

  intervalTimer = setInterval(() => {
    checkExpiredFiniteBans().catch(e => {
      console.error('[ban-auto-check] 定时检查异常:', e.message);
    });
  }, CHECK_INTERVAL_MS);

  intervalTimer.unref?.();
  console.log(`✅ 禁言到期检查已启动 (${Math.round(CHECK_INTERVAL_MS / 1000)}s)`);
}
