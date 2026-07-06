import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { banUser, delSilentUser, getSilentUserList, unbanUser } from '../services/biliAdmin.js';
import { findSilentRecordWithRetry } from '../services/banAutoCheck.js';

const router = Router();

router.post('/silent', requireAuth, async (req, res, next) => {
  try {
    const { roomId, uid, username, content, hours } = req.body;
    if (!roomId || !uid || hours === undefined) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const banHours = Number(hours);
    await banUser({ roomId, userId: uid, hour: banHours, msg: content || '' });
    const silentRecord = await findSilentRecordWithRetry(roomId, uid);
    const expectedUnbanAt = banHours > 0 ? Date.now() + banHours * 60 * 60 * 1000 : null;

    const now = Date.now();
    const info = db.prepare(`
      INSERT INTO ban_logs (
        room_id, mod_id, target_uid, target_name, trigger_content, ban_hours,
        bilibili_ban_id, expected_unban_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(roomId), req.mod.id, Number(uid), username || '', content || '', banHours,
      silentRecord?.id || null, expectedUnbanAt, now
    );

    res.json({ ok: true, logId: info.lastInsertRowid, banId: silentRecord?.id || null });
  } catch (e) { next(e); }
});

router.post('/unsilent', requireAuth, async (req, res, next) => {
  try {
    const { roomId, banId, uid, logId } = req.body;
    if (!roomId || (!banId && !uid)) return res.status(400).json({ error: '参数不完整' });

    if (uid) {
      await unbanUser({ roomId, userId: uid });
    } else {
      await delSilentUser({ roomId, banId });
    }

    const now = Date.now();
    if (logId) {
      db.prepare(`
        UPDATE ban_logs
        SET unsilenced_at = ?,
            auto_unban_status = 'manual_unsilenced',
            auto_unban_note = '人工解除禁言'
        WHERE id = ?
      `).run(now, logId);
    } else if (uid) {
      db.prepare(`
        UPDATE ban_logs
        SET unsilenced_at = ?,
            auto_unban_status = 'manual_unsilenced',
            auto_unban_note = '人工解除禁言'
        WHERE room_id = ?
          AND target_uid = ?
          AND unsilenced_at IS NULL
      `).run(now, String(roomId), Number(uid));
    } else {
      db.prepare(`
        UPDATE ban_logs
        SET unsilenced_at = ?,
            auto_unban_status = 'manual_unsilenced',
            auto_unban_note = '人工解除禁言'
        WHERE room_id = ?
          AND bilibili_ban_id = ?
          AND unsilenced_at IS NULL
      `).run(now, String(roomId), Number(banId));
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/list', requireAuth, async (req, res, next) => {
  try {
    const { roomId, page = 1 } = req.query;
    if (!roomId) return res.status(400).json({ error: '请提供房间号' });
    const data = await getSilentUserList({ roomId, page: Number(page) });
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/logs', requireAuth, (req, res, next) => {
  try {
    const { modUsername, targetUid, targetName, from, to, page = 1, pageSize = 50 } = req.query;
    const conditions = [];
    const params = [];

    if (modUsername) { conditions.push('m.username LIKE ?');   params.push(`%${modUsername}%`); }
    if (targetUid)   { conditions.push('b.target_uid = ?');    params.push(Number(targetUid)); }
    if (targetName)  { conditions.push('b.target_name LIKE ?');params.push(`%${targetName}%`); }
    if (from)        { conditions.push('b.created_at >= ?');   params.push(Number(from)); }
    if (to)          { conditions.push('b.created_at <= ?');   params.push(Number(to)); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (Number(page) - 1) * Number(pageSize);

    const total = db.prepare(`
      SELECT COUNT(*) AS c FROM ban_logs b LEFT JOIN mods m ON m.id = b.mod_id ${where}
    `).get(...params).c;

    const rows = db.prepare(`
      SELECT b.*, m.username AS mod_name
      FROM ban_logs b
      LEFT JOIN mods m ON m.id = b.mod_id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(pageSize), offset);

    res.json({ total, page: Number(page), pageSize: Number(pageSize), rows });
  } catch (e) { next(e); }
});

export default router;
