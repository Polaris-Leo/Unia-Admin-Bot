import { useState, useEffect } from 'react';
import { getMods, deleteMod, getInvites, createInvite, deleteInvite } from '../services/api';
import './ModsPage.css';

function formatTs(ms) {
  return new Date(ms).toLocaleString();
}

export default function ModsPage() {
  const [mods, setMods] = useState([]);
  const [invites, setInvites] = useState([]);
  const [expiresHours, setExpiresHours] = useState(24);
  const [newInvite, setNewInvite] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [tab, setTab] = useState('mods');

  const load = async () => {
    const [m, i] = await Promise.all([getMods(), getInvites()]);
    setMods(m.data);
    setInvites(i.data);
  };

  useEffect(() => { load(); }, []);

  const handleCreateInvite = async () => {
    const res = await createInvite(expiresHours);
    setNewInvite(res.data);
    setInvites(prev => [res.data, ...prev]);
  };

  const handleDeleteInvite = async (id) => {
    await deleteInvite(id);
    setInvites(prev => prev.filter(i => i.id !== id));
  };

  const handleDisable = async (modId, username) => {
    if (!confirm(`确定禁用房管 "${username}" 的账户？`)) return;
    await deleteMod(modId);
    setMods(prev => prev.map(m => m.id === modId ? { ...m, disabled_at: Date.now() } : m));
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
        <span className="mods-title">房管管理</span>
        <div className="mods-tabs">
          <button className={tab === 'mods' ? 'mods-tab active' : 'mods-tab'} onClick={() => setTab('mods')}>
            房管列表
          </button>
          <button className={tab === 'invites' ? 'mods-tab active' : 'mods-tab'} onClick={() => setTab('invites')}>
            邀请码
          </button>
        </div>
      </div>

      {tab === 'mods' && (
        <div className="mods-content">
          <table className="mods-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>角色</th>
                <th>注册时间</th>
                <th>邀请人</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {mods.map(mod => (
                <tr key={mod.id} className={mod.disabled_at ? 'mods-row-disabled' : ''}>
                  <td className="mods-username">{mod.username}</td>
                  <td>
                    <span className={`mods-role-badge ${mod.role}`}>{mod.role === 'admin' ? '管理员' : '房管'}</span>
                  </td>
                  <td className="mods-time">{formatTs(mod.created_at)}</td>
                  <td className="mods-invitedby">{mod.invited_by_name || '—'}</td>
                  <td>
                    {mod.disabled_at
                      ? <span className="mods-status-disabled">已禁用</span>
                      : <span className="mods-status-active">正常</span>
                    }
                  </td>
                  <td>
                    {!mod.disabled_at && mod.role !== 'admin' && (
                      <button className="mods-disable-btn" onClick={() => handleDisable(mod.id, mod.username)}>
                        禁用
                      </button>
                    )}
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
                      <button className="mods-disable-btn" onClick={() => handleDeleteInvite(inv.id)}>
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
