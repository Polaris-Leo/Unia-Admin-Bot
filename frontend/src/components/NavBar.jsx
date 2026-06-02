import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMe } from '../services/api';
import './NavBar.css';

export default function NavBar() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);

  useEffect(() => {
    getMe().then(r => setMe(r.data)).catch(() => {});
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
      <div className="navbar-user">
        {me && <span className="nav-username">{me.username}</span>}
        <button className="nav-logout" onClick={handleLogout}>登出</button>
      </div>
    </nav>
  );
}
