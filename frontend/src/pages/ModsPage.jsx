import { useState, useEffect } from 'react';
import { getMods, createMod, updateModRole, deleteMod, getInvites, createInvite, deleteInvite } from '../services/api';
import './ModsPage.css';

function formatTs(ms) {
  return new Date(ms).toLocaleString();
}

export default function ModsPage() {
  const [mods, setMods] = useState([]);
  const [invites, setInvites] = useState([]);
  const [tab, setTab] = useState('users');

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
                <tr key={mod.id}>
                  <td className="mods-username">{mod.username}</td>
                  <td>
                    <span className={`mods-role-badge ${mod.role}`}>
                      {mod.role === 'admin' ? '系统管理员' : '普通房管'}
                    </span>
                  </td>
                  <td className="mods-time">{formatTs(mod.created_at)}</td>
                  <td className="mods-invitedby">{mod.invited_by_name || '—'}</td>
                  <td className="mods-actions">
                    {mod.role === 'mod' ? (
                      <button className="mods-role-btn" onClick={() => handleRoleChange(mod, 'admin')}>
                        设为管理员
                      </button>
                    ) : (
                      <button className="mods-role-btn mods-role-btn-demote" onClick={() => handleRoleChange(mod, 'mod')}>
                        设为房管
                      </button>
                    )}
                    <button className="mods-delete-btn" onClick={() => handleDelete(mod)}>
                      删除
                    </button>
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
