import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT m.id, m.username, m.role, m.created_at, m.disabled_at,
             inv.username AS invited_by_name
      FROM mods m
      LEFT JOIN mods inv ON inv.id = m.invited_by
      ORDER BY m.created_at DESC
    `).all();
    res.json(rows);
  } catch (e) { next(e); }
});

router.delete('/:modId', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.modId);
    if (id === req.mod.id) return res.status(400).json({ error: '不能禁用自己' });
    db.prepare('UPDATE mods SET disabled_at = ? WHERE id = ?').run(Date.now(), id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/invites/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    db.prepare('DELETE FROM invite_tokens WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/invites', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT i.*, m.username AS created_by_name, u.username AS used_by_name
      FROM invite_tokens i
      LEFT JOIN mods m ON m.id = i.created_by
      LEFT JOIN mods u ON u.id = i.used_by
      ORDER BY i.id DESC
      LIMIT 50
    `).all();
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
