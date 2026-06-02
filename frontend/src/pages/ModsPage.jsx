import { useState, useEffect, useRef } from 'react';
import { getMods, createMod, updateModRole, updateModProfile, disableMod, enableMod, deleteMod, getInvites, createInvite, deleteInvite } from '../services/api';
import './ModsPage.css';

function formatTs(ms) {
  return new Date(ms).toLocaleString();
}

function EditUserModal({ mod, onClose, onSave }) {
  const [form, setForm] = useState({ username: mod.username, password: '', confirm: '', role: mod.role });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password && form.password !== form.confirm) {
      setError('两次密码输入不一致');
      return;
    }
    const payload = {};
    if (form.username !== mod.username) payload.username = form.username;
    if (form.password) payload.password = form.password;
    if (!mod.is_superadmin && form.role !== mod.role) payload.role = form.role;
    if (!Object.keys(payload).length) { onClose(); return; }
    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" ref={ref} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">修改用户 — {mod.username}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>用户名</label>
            <input
              className="modal-input"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoFocus
              required
            />
          </div>
          <div className="modal-field">
            <label>角色</label>
            {mod.is_superadmin ? (
              <input className="modal-input" value="超级管理员" disabled />
            ) : (
              <div className="select-wrap">
                <select className="modal-input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="mod">普通房管</option>
                  <option value="admin">系统管理员</option>
                </select>
              </div>
            )}
          </div>
          <div className="modal-field">
            <label>新密码</label>
            <input
              className="modal-input"
              type="password"
              placeholder="留空则不修改"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          {form.password && (
            <div className="modal-field">
              <label>确认新密码</label>
              <input
                className={`modal-input ${form.confirm && form.confirm !== form.password ? 'modal-input-error' : ''}`}
                type="password"
                placeholder="再次输入新密码"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              />
            </div>
          )}
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-footer">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>取消</button>
            <button type="submit" className="modal-btn-confirm" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ username: '', password: '', role: 'mod' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" ref={ref} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">新建用户</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>用户名</label>
            <input className="modal-input" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoFocus required />
          </div>
          <div className="modal-field">
            <label>密码</label>
            <input className="modal-input" type="password" placeholder="至少 6 位"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required />
          </div>
          <div className="modal-field">
            <label>角色</label>
            <div className="select-wrap">
              <select className="modal-input" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="mod">普通房管</option>
                <option value="admin">系统管理员</option>
              </select>
            </div>
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-footer">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>取消</button>
            <button type="submit" className="modal-btn-confirm" disabled={saving}>
              {saving ? '创建中...' : '确认创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onClose, danger = true }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-sm" ref={ref} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
          <div className="modal-footer">
            <button className="modal-btn-cancel" onClick={onClose}>取消</button>
            <button className={`modal-btn-confirm ${danger ? 'danger' : ''}`} onClick={onConfirm}>确认</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ModsPage() {
  const [mods, setMods] = useState([]);
  const [invites, setInvites] = useState([]);
  const [tab, setTab] = useState('users');

  const [editingMod, setEditingMod] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [expiresHours, setExpiresHours] = useState(24);
  const [newInvite, setNewInvite] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = async () => {
    const [m, i] = await Promise.all([getMods(), getInvites()]);
    setMods(m.data);
    setInvites(i.data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (form) => {
    const res = await createMod(form);
    setMods(prev => [{ ...res.data, created_at: Date.now(), invited_by_name: null }, ...prev]);
  };

  const handleRoleChange = async (mod, newRole) => {
    try {
      await updateModRole(mod.id, newRole);
      setMods(prev => prev.map(m => m.id === mod.id ? { ...m, role: newRole } : m));
    } catch (err) {
      setConfirmState({
        title: '操作失败', message: err.response?.data?.error || '修改失败',
        onConfirm: () => setConfirmState(null), danger: false
      });
    }
  };

  const handleEditSave = async (payload) => {
    const { role, ...profilePayload } = payload;
    if (role) {
      await updateModRole(editingMod.id, role);
      setMods(prev => prev.map(m => m.id === editingMod.id ? { ...m, role } : m));
    }
    if (Object.keys(profilePayload).length) {
      const res = await updateModProfile(editingMod.id, profilePayload);
      setMods(prev => prev.map(m => m.id === editingMod.id ? { ...m, ...res.data } : m));
    }
    window.dispatchEvent(new CustomEvent('user-profile-updated'));
  };

  const handleDisable = async (mod) => {
    try {
      await disableMod(mod.id);
      setMods(prev => prev.map(m => m.id === mod.id ? { ...m, disabled_at: Date.now() } : m));
    } catch (err) {
      setConfirmState({ title: '操作失败', message: err.response?.data?.error || '禁用失败', onConfirm: () => setConfirmState(null), danger: false });
    }
  };

  const handleEnable = async (mod) => {
    try {
      await enableMod(mod.id);
      setMods(prev => prev.map(m => m.id === mod.id ? { ...m, disabled_at: null } : m));
    } catch (err) {
      setConfirmState({ title: '操作失败', message: err.response?.data?.error || '启用失败', onConfirm: () => setConfirmState(null), danger: false });
    }
  };

  const handleDelete = (mod) => {
    setConfirmState({
      title: '删除用户',
      message: `确定删除用户 "${mod.username}"？此操作不可撤销，该用户的禁言记录也将一并删除。`,
      onConfirm: async () => {
        try {
          await deleteMod(mod.id);
          setMods(prev => prev.filter(m => m.id !== mod.id));
        } catch (err) {
          setConfirmState({ title: '删除失败', message: err.response?.data?.error || '删除失败', onConfirm: () => setConfirmState(null), danger: false });
          return;
        }
        setConfirmState(null);
      },
      danger: true
    });
  };

  const handleCreateInvite = async () => {
    const res = await createInvite(expiresHours);
    setNewInvite(res.data);
    setInvites(prev => [res.data, ...prev]);
  };

  const handleDeleteInvite = (id) => {
    setConfirmState({
      title: '删除邀请码',
      message: '确定删除这条邀请码？',
      onConfirm: async () => {
        await deleteInvite(id);
        setInvites(prev => prev.filter(i => i.id !== id));
        setConfirmState(null);
      },
      danger: true
    });
  };

  const copyLink = () => {
    if (!newInvite?.link) return;
    navigator.clipboard.writeText(newInvite.link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="mods-page">
      <div className="mods-header">
        <span className="mods-title">用户管理</span>
        <div className="mods-tabs">
          <button className={tab === 'users' ? 'mods-tab active' : 'mods-tab'} onClick={() => setTab('users')}>用户列表</button>
          <button className={tab === 'invites' ? 'mods-tab active' : 'mods-tab'} onClick={() => setTab('invites')}>邀请码</button>
        </div>
      </div>

      {tab === 'users' && (
        <div className="mods-content">
          <div className="mods-toolbar">
            <button className="mods-create-btn" onClick={() => setShowCreateModal(true)}>
              + 新建用户
            </button>
          </div>

          <table className="mods-table">
            <thead>
              <tr><th>用户名</th><th>角色</th><th>创建时间</th><th>邀请人</th><th>操作</th></tr>
            </thead>
            <tbody>
              {mods.map(mod => (
                <tr key={mod.id} className={mod.disabled_at ? 'mods-row-disabled' : ''}>
                  <td className="mods-username">
                    {mod.username}
                    {mod.disabled_at && <span className="mods-disabled-badge">已禁用</span>}
                  </td>
                  <td>
                    <span className={`mods-role-badge ${mod.is_superadmin ? 'superadmin' : mod.role}`}>
                      {mod.is_superadmin ? '超级管理员' : mod.role === 'admin' ? '系统管理员' : '普通房管'}
                    </span>
                  </td>
                  <td className="mods-time">{formatTs(mod.created_at)}</td>
                  <td className="mods-invitedby">{mod.invited_by_name || '—'}</td>
                  <td className="mods-actions">
                    <button className="mods-edit-btn" onClick={() => setEditingMod(mod)}>修改</button>
                    {!mod.is_superadmin && (
                      <>
                        {mod.role === 'mod' && (
                          <button className="mods-role-btn" onClick={() => handleRoleChange(mod, 'admin')}>设为管理员</button>
                        )}
                        {mod.disabled_at
                          ? <button className="mods-enable-btn" onClick={() => handleEnable(mod)}>启用</button>
                          : <button className="mods-disable-btn" onClick={() => handleDisable(mod)}>禁用</button>
                        }
                        <button className="mods-delete-btn" onClick={() => handleDelete(mod)}>删除</button>
                      </>
                    )}
                    {!!mod.is_superadmin && <span className="mods-protected-label">受保护</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'invites' && (
        <div className="mods-content">
          <div className="mods-invite-create">
            <span className="mods-invite-label">生成邀请链接</span>
            <div className="select-wrap">
              <select className="mods-invite-select" value={expiresHours}
                onChange={e => setExpiresHours(Number(e.target.value))}>
                <option value={24}>24 小时</option>
                <option value={72}>72 小时</option>
                <option value={168}>7 天</option>
              </select>
            </div>
            <button className="mods-invite-btn" onClick={handleCreateInvite}>生成</button>
          </div>
          {newInvite && (
            <div className="mods-invite-result">
              <span className="mods-invite-link">{newInvite.link}</span>
              <button className="mods-copy-btn" onClick={copyLink}>{linkCopied ? '✓ 已复制' : '复制'}</button>
            </div>
          )}
          <table className="mods-table">
            <thead>
              <tr><th>Token</th><th>创建人</th><th>有效期至</th><th>使用人</th><th>状态</th><th>操作</th></tr>
            </thead>
            <tbody>
              {invites.map(inv => {
                const expired = inv.expires_at < Date.now();
                const used = !!inv.used_by;
                return (
                  <tr key={inv.id}>
                    <td className="mods-token">{inv.token.slice(0, 8)}...</td>
                    <td>{inv.created_by_name}</td>
                    <td className="mods-time">{formatTs(inv.expires_at)}</td>
                    <td>{inv.used_by_name || '—'}</td>
                    <td>
                      {used ? <span className="mods-invite-used">已使用</span>
                        : expired ? <span className="mods-invite-expired">已过期</span>
                        : <span className="mods-invite-valid">有效</span>}
                    </td>
                    <td>
                      <button className="mods-delete-btn" onClick={() => handleDeleteInvite(inv.id)}>删除</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {editingMod && (
        <EditUserModal
          mod={editingMod}
          onClose={() => setEditingMod(null)}
          onSave={handleEditSave}
        />
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
