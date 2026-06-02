import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMe } from '../services/api';
import api from '../services/api';
import BilibiliLoginModal from './BilibiliLoginModal';
import './NavBar.css';

export default function NavBar() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const fetchCookieStatus = () =>
    api.get('/cookie-status').then(r => setCookieStatus(r.data)).catch(() => {});

  useEffect(() => {
    getMe().then(r => setMe(r.data)).catch(() => {});
    fetchCookieStatus();
    const timer = setInterval(fetchCookieStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">Unia Admin</div>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>弹幕控制台</NavLink>
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
      <div className="navbar-user">
        {me && <span className="nav-username">{me.username}</span>}
        <button className="nav-logout" onClick={handleLogout}>登出</button>
      </div>
    </nav>
  );
}
