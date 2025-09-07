import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  Home, 
  MessageSquare, 
  User, 
  Trophy, 
  LogOut, 
  Crown
} from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/feed', label: 'Feed', icon: MessageSquare },
    { path: '/profile', label: 'Perfil', icon: User },
    { path: '/leaderboard', label: 'Ranking', icon: Trophy }
  ];

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
    }
  };

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="nav-header">
        <div className="nav-logo">
          <Crown size={24} />
        </div>
        <div className="nav-title">
          <h1>Las Cruzadas</h1>
          <p>Red Social Privada</p>
        </div>
      </div>

      {/* User Profile */}
      <div className="nav-profile">
        <div className="profile-avatar">
          {user.profile_picture ? (
            <img src={user.profile_picture} alt={user.nickname} />
          ) : (
            user.nickname.charAt(0).toUpperCase()
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user.nickname}</div>
          <div className="profile-points">{user.points} puntos</div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="nav-menu">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="nav-footer">
        <button className="nav-item nav-logout" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      <style jsx>{`
        .nav-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-light);
        }
        .nav-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          border-radius: var(--radius-sm);
          color: white;
        }
        .nav-title h1 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.125rem;
        }
        .nav-title p {
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .nav-profile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--background);
          border-radius: var(--radius-sm);
          margin-bottom: 1.5rem;
          border: 1px solid var(--border-light);
        }
        .profile-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 1.125rem;
          box-shadow: var(--shadow-sm);
        }
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .profile-name {
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.125rem;
        }
        .profile-points {
          font-size: 0.8rem;
          color: var(--primary);
          font-weight: 600;
        }
        .nav-menu {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }
        .nav-item:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
          transform: translateX(4px);
        }
        .nav-item.active {
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          color: white;
          box-shadow: var(--shadow-md);
        }
        .nav-item.active:hover {
          transform: translateX(0);
        }
        .nav-item svg {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        .nav-footer {
          padding-top: 1rem;
          border-top: 1px solid var(--border-light);
        }
        .nav-logout {
          color: var(--danger) !important;
        }
        .nav-logout:hover {
          background: #fef2f2 !important;
          color: var(--danger) !important;
        }
        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            flex-direction: row;
            padding: 1rem;
            height: auto;
            border-right: none;
            border-bottom: 1px solid var(--border);
          }
          .nav-header {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }
          .nav-title {
            display: none;
          }
          .nav-profile {
            margin-bottom: 0;
            padding: 0.5rem;
          }
          .profile-info {
            display: none;
          }
          .nav-menu {
            flex-direction: row;
            gap: 0.25rem;
            overflow-x: auto;
          }
          .nav-item {
            min-width: auto;
            padding: 0.5rem;
            justify-content: center;
          }
          .nav-item span {
            display: none;
          }
          .nav-footer {
            padding-top: 0;
            border-top: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Navigation;
