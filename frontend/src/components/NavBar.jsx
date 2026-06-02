import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMe } from '../services/api';
import api from '../services/api';
import './NavBar.css';

export default function NavBar() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [cookieStatus, setCookieStatus] = useState(null);

  useEffect(() => {
    getMe().then(r => setMe(r.data)).catch(() => {});
    const fetchStatus = () =>
      api.get('/cookie-status').then(r => setCookieStatus(r.data)).catch(() => {});
    fetchStatus();
    const timer = setInterval(fetchStatus, 30000);
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
          <NavLink to="/mods" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>房管管理</NavLink>
        )}
      </div>
      {cookieStatus && (
        <div
          className={`navbar-cookie-status ${cookieStatus.connected ? 'connected' : cookieStatus.configured ? 'error' : 'local'}`}
          title={
            cookieStatus.connected
              ? `Cookie 服务已连接 (UID: ${cookieStatus.uid || '?'})`
              : cookieStatus.configured
                ? `Cookie 服务无法连接 (${cookieStatus.url})`
                : '使用本地 cookies.json'
          }
        >
          <span className="navbar-cookie-dot" />
          <span className="navbar-cookie-label">
            {cookieStatus.connected
              ? `Cookie UID:${cookieStatus.uid || '?'}`
              : cookieStatus.configured ? 'Cookie 离线' : 'Cookie 本地'}
          </span>
        </div>
      )}
      <div className="navbar-user">
        {me && <span className="nav-username">{me.username}</span>}
        <button className="nav-logout" onClick={handleLogout}>登出</button>
      </div>
    </nav>
  );
}
