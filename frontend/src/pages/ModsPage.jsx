import { useState, useEffect } from 'react';
import { getMods, createMod, updateModRole, updateModProfile, disableMod, enableMod, deleteMod, getInvites, createInvite, deleteInvite } from '../services/api';
import './ModsPage.css';

function formatTs(ms) {
  return new Date(ms).toLocaleString();
}

export default function ModsPage() {
  const [mods, setMods] = useState([]);
  const [invites, setInvites] = useState([]);
  const [tab, setTab] = useState('users');

  // 编辑用户
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);

  // 新建用户表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', password: '', role: 'mod' });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // 邀请码
  const [expiresHours, setExpiresHours] = useState(24);
  const [newInvite, setNewInvite] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = async () => {
    const [m, i] = await Promise.all([getMods(), getInvites()]);
    setMods(m.data);
    setInvites(i.data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await createMod(createForm);
      setMods(prev => [{ ...res.data, created_at: Date.now(), invited_by_name: null }, ...prev]);
      setCreateForm({ username: '', password: '', role: 'mod' });
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err.response?.data?.error || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (mod, newRole) => {
    try {
      await updateModRole(mod.id, newRole);
      setMods(prev => prev.map(m => m.id === mod.id ? { ...m, role: newRole } : m));
    } catch (err) {
      alert(err.response?.data?.error || '修改失败');
    }
  };

  const startEdit = (mod) => {
    setEditingId(mod.id);
    setEditForm({ username: mod.username, password: '' });
    setEditError('');
  };

  const cancelEdit = () => { setEditingId(null); setEditError(''); };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditing(true);
    try {
      const payload = {};
      const currentMod = mods.find(m => m.id === editingId);
      if (editForm.username !== currentMod.username) payload.username = editForm.username;
      if (editForm.password) payload.password = editForm.password;
      if (!Object.keys(payload).length) { cancelEdit(); setEditing(false); return; }
      const res = await updateModProfile(editingId, payload);
      setMods(prev => prev.map(m => m.id === editingId ? { ...m, ...res.data } : m));
      cancelEdit();
    } catch (err) {
      setEditError(err.response?.data?.error || '修改失败');
    } finally {
      setEditing(false);
    }
  };

  const handleDisable = async (mod) => {
    try {
      await disableMod(mod.id);
      setMods(prev => prev.map(m => m.id === mod.id ? { ...m, disabled_at: Date.now() } : m));
    } catch (err) {
      alert(err.response?.data?.error || '禁用失败');
    }
  };

  const handleEnable = async (mod) => {
    try {
      await enableMod(mod.id);
      setMods(prev => prev.map(m => m.id === mod.id ? { ...m, disabled_at: null } : m));
    } catch (err) {
      alert(err.response?.data?.error || '启用失败');
    }
  };

  const handleDelete = async (mod) => {
    if (!confirm(`确定删除用户 "${mod.username}"？此操作不可撤销。`)) return;
    try {
      await deleteMod(mod.id);
      setMods(prev => prev.filter(m => m.id !== mod.id));
    } catch (err) {
      alert(err.response?.data?.error || '删除失败');
    }
  };

  const handleCreateInvite = async () => {
    const res = await createInvite(expiresHours);
    setNewInvite(res.data);
    setInvites(prev => [res.data, ...prev]);
  };

  const handleDeleteInvite = async (id) => {
    await deleteInvite(id);
    setInvites(prev => prev.filter(i => i.id !== id));
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
          <button className={tab === 'users' ? 'mods-tab active' : 'mods-tab'} onClick={() => setTab('users')}>
            用户列表
          </button>
          <button className={tab === 'invites' ? 'mods-tab active' : 'mods-tab'} onClick={() => setTab('invites')}>
            邀请码
          </button>
        </div>
      </div>

      {tab === 'users' && (
        <div className="mods-content">
          <div className="mods-toolbar">
            <button className="mods-create-btn" onClick={() => { setShowCreateForm(v => !v); setCreateError(''); }}>
              {showCreateForm ? '收起' : '+ 新建用户'}
            </button>
          </div>

          {showCreateForm && (
            <form className="mods-create-form" onSubmit={handleCreate}>
              <input
                className="mods-field-input"
                placeholder="用户名"
                value={createForm.username}
                onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                required
                autoFocus
              />
              <input
                className="mods-field-input"
                type="password"
                placeholder="密码（至少 6 位）"
                value={createForm.password}
                onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <select
                className="mods-field-select"
                value={createForm.role}
                onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="mod">普通房管</option>
                <option value="admin">系统管理员</option>
              </select>
              {createError && <span className="mods-create-error">{createError}</span>}
              <button type="submit" className="mods-create-submit" disabled={creating}>
                {creating ? '创建中...' : '确认创建'}
              </button>
            </form>
          )}

          <table className="mods-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>角色</th>
                <th>创建时间</th>
                <th>邀请人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {mods.map(mod => (
                editingId === mod.id ? (
                  <tr key={mod.id} className="mods-row-editing">
                    <td colSpan={5}>
                      <form className="mods-edit-form" onSubmit={handleEditSubmit}>
                        <span className="mods-edit-label">修改 {mod.username}</span>
                        <input
                          className="mods-field-input"
                          placeholder="新用户名（留空不改）"
                          value={editForm.username}
                          onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                          autoFocus
                        />
                        <input
                          className="mods-field-input"
                          type="password"
                          placeholder="新密码（留空不改）"
                          value={editForm.password}
                          onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                        />
                        {editError && <span className="mods-create-error">{editError}</span>}
                        <button type="submit" className="mods-create-submit" disabled={editing}>
                          {editing ? '保存中...' : '保存'}
                        </button>
                        <button type="button" className="mods-cancel-btn" onClick={cancelEdit}>取消</button>
                      </form>
                    </td>
                  </tr>
                ) : (
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
                    <button className="mods-edit-btn" onClick={() => startEdit(mod)}>修改</button>
                    {!mod.is_superadmin && (
                      <>
                        {mod.role === 'mod' ? (
                          <button className="mods-role-btn" onClick={() => handleRoleChange(mod, 'admin')}>
                            设为管理员
                          </button>
                        ) : (
                          <button className="mods-role-btn mods-role-btn-demote" onClick={() => handleRoleChange(mod, 'mod')}>
                            设为房管
                          </button>
                        )}
                        {mod.disabled_at ? (
                          <button className="mods-enable-btn" onClick={() => handleEnable(mod)}>启用</button>
                        ) : (
                          <button className="mods-disable-btn" onClick={() => handleDisable(mod)}>禁用</button>
                        )}
                        <button className="mods-delete-btn" onClick={() => handleDelete(mod)}>删除</button>
                      </>
                    )}
                    {!!mod.is_superadmin && (
                      <span className="mods-protected-label">受保护</span>
                    )}
                  </td>
                </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'invites' && (
        <div className="mods-content">
          <div className="mods-invite-create">
            <span className="mods-invite-label">生成邀请链接</span>
            <select
              className="mods-invite-select"
              value={expiresHours}
              onChange={e => setExpiresHours(Number(e.target.value))}
            >
              <option value={24}>24 小时</option>
              <option value={72}>72 小时</option>
              <option value={168}>7 天</option>
            </select>
            <button className="mods-invite-btn" onClick={handleCreateInvite}>生成</button>
          </div>

          {newInvite && (
            <div className="mods-invite-result">
              <span className="mods-invite-link">{newInvite.link}</span>
              <button className="mods-copy-btn" onClick={copyLink}>
                {linkCopied ? '✓ 已复制' : '复制'}
              </button>
            </div>
          )}

          <table className="mods-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>创建人</th>
                <th>有效期至</th>
                <th>使用人</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
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
                      {used
                        ? <span className="mods-invite-used">已使用</span>
                        : expired
                          ? <span className="mods-invite-expired">已过期</span>
                          : <span className="mods-invite-valid">有效</span>
                      }
                    </td>
                    <td>
                      <button className="mods-delete-btn" onClick={() => handleDeleteInvite(inv.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
