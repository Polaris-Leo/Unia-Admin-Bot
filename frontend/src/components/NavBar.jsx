import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getMe, updateMyProfile } from '../services/api';
import api from '../services/api';
import BilibiliLoginModal from './BilibiliLoginModal';
import './NavBar.css';
import '../pages/ModsPage.css';

function ProfileModal({ me, onClose, onSaved }) {
  const [form, setForm] = useState({ username: me.username, password: '', confirm: '' });
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
    if (form.username !== me.username) payload.username = form.username;
    if (form.password) payload.password = form.password;
    if (!Object.keys(payload).length) { onClose(); return; }
    setSaving(true);
    try {
      const res = await updateMyProfile(payload);
      onSaved(res.data);
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
          <span className="modal-title">修改账户信息</span>
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

export default function NavBar() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const dropdownRef = useRef(null);

  const fetchCookieStatus = () =>
    api.get('/cookie-status').then(r => setCookieStatus(r.data)).catch(() => {});

  const refreshMe = () => getMe().then(r => setMe(r.data)).catch(() => {});

  useEffect(() => {
    refreshMe();
    fetchCookieStatus();
    const timer = setInterval(fetchCookieStatus, 30000);
    window.addEventListener('user-profile-updated', refreshMe);
    return () => {
      clearInterval(timer);
      window.removeEventListener('user-profile-updated', refreshMe);
    };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleProfileSaved = (updated) => {
    setMe(updated);
    window.dispatchEvent(new CustomEvent('user-profile-updated'));
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">Unia Admin</div>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>弹幕控制台</NavLink>
        <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>历史记录</NavLink>
        <NavLink to="/ban-logs" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>禁言日志</NavLink>
        {me?.role === 'admin' && (
          <NavLink to="/mods" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>用户管理</NavLink>
        )}
      </div>

      {cookieStatus && (() => {
        const src = cookieStatus.activeSource;
        const cls = src === 'remote' ? 'connected' : src === 'local' ? 'local' : 'error';
        const label = src === 'remote'
          ? `Cookie UID:${cookieStatus.remote?.uid || '?'}`
          : src === 'local'
            ? `Cookie UID:${cookieStatus.local?.uid || '本地'}`
            : 'Cookie 未登录';
        const tip = src === 'remote'
          ? `BiliCookie 服务 (UID: ${cookieStatus.remote?.uid})`
          : src === 'local'
            ? `本地扫码登录 (UID: ${cookieStatus.local?.uid || '?'})`
            : '未登录，点击扫码';
        return (
          <div
            className={`navbar-cookie-status ${cls}`}
            title={tip}
            onClick={() => setShowLoginModal(true)}
          >
            <span className="navbar-cookie-dot" />
            <span className="navbar-cookie-label">{label}</span>
          </div>
        );
      })()}

      {showLoginModal && (
        <BilibiliLoginModal
          cookieStatus={cookieStatus}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => { fetchCookieStatus(); setShowLoginModal(false); }}
        />
      )}

      {me && (
        <div className="nav-user-wrap" ref={dropdownRef}>
          <button
            className={`nav-user-btn ${dropdownOpen ? 'open' : ''}`}
            onClick={() => setDropdownOpen(v => !v)}
          >
            <span className="nav-user-name">{me.username}</span>
            <span className="nav-user-arrow">▾</span>
          </button>
          {dropdownOpen && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-item" onClick={() => {
                setDropdownOpen(false);
                setShowProfileModal(true);
              }}>
                修改账户信息
              </button>
              <div className="nav-dropdown-sep" />
              <button className="nav-dropdown-item nav-dropdown-danger" onClick={handleLogout}>
                退出登录
              </button>
            </div>
          )}
        </div>
      )}

      {showProfileModal && me && (
        <ProfileModal
          me={me}
          onClose={() => setShowProfileModal(false)}
          onSaved={handleProfileSaved}
        />
      )}
    </nav>
  );
}
