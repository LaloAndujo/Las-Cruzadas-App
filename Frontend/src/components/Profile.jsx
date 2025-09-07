import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import Navigation from './Navigation';
import { 
  User, 
  Trophy, 
  Calendar, 
  Star, 
  Award, 
  TrendingUp,
  Settings,
  QrCode
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Profile = () => {
  const { user } = useAuth();
  const [pointsHistory, setPointsHistory] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const [pointsResponse, leaderboardResponse] = await Promise.all([
        axios.get(`${API}/users/${user.id}/points/history`),
        axios.get(`${API}/leaderboard`)
      ]);
      
      setPointsHistory(pointsResponse.data);
      
      // Find user rank
      const rank = leaderboardResponse.data.findIndex(u => u.nickname === user.nickname) + 1;
      setUserRank(rank || 'N/A');
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = () => {
    // Placeholder QR. En producción usa una librería local o tu propio endpoint.
    const qrData = `CRUZADAS_USER:${user.id}:${user.nickname}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'welcome':
        return <Star className="history-icon welcome" />;
      case 'post':
        return <Award className="history-icon post" />;
      case 'like':
        return <Trophy className="history-icon like" />;
      default:
        return <Award className="history-icon default" />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalPointsThisWeek = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return pointsHistory
      .filter(p => new Date(p.created_at) >= oneWeekAgo)
      .reduce((total, p) => total + p.points, 0);
  };

  const getMemberSince = () => {
    const date = new Date(user.created_at);
    return date.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="main-container">
        <Navigation />
        <div className="main-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando perfil...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container">
      <Navigation />
      <div className="main-content">
        <div className="profile-container">
          {/* Profile Header */}
          <div className="profile-header">
            <div className="profile-cover">
              <div className="profile-avatar-large">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt={user.nickname} />
                ) : (
                  user.nickname.charAt(0).toUpperCase()
                )}
              </div>
            </div>
            
            <div className="profile-info">
              <h1>{user.nickname}</h1>
              <p>@{user.username}</p>
              <div className="profile-meta">
                <div className="meta-item">
                  <Calendar size={16} />
                  <span>Miembro desde {getMemberSince()}</span>
                </div>
                {user.is_admin && (
                  <div className="meta-item admin">
                    <Settings size={16} />
                    <span>Administrador</span>
                  </div>
                )}
              </div>
            </div>

            <div className="profile-actions">
              <button 
                className="btn btn-primary"
                onClick={() => setShowQR(!showQR)}
              >
                <QrCode size={18} />
                {showQR ? 'Ocultar QR' : 'Mostrar QR'}
              </button>
            </div>
          </div>

          {/* QR Code Modal */}
          {showQR && (
            <div className="qr-modal">
              <div className="qr-content">
                <div className="qr-header">
                  <h3>Tu Código QR</h3>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowQR(false)}
                  >
                    Cerrar
                  </button>
                </div>
                <div className="qr-code">
                  <img 
                    src={generateQRCode()} 
                    alt="QR Code"
                    className="qr-image"
                  />
                  <p>Escanea este código en eventos</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="profile-stats">
            <div className="stat-card highlight">
              <div className="stat-icon">
                <Trophy />
              </div>
              <div className="stat-content">
                <div className="stat-value">{user.points}</div>
                <div className="stat-label">Puntos Totales</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <TrendingUp />
              </div>
              <div className="stat-content">
                <div className="stat-value">#{userRank}</div>
                <div className="stat-label">Ranking</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Star />
              </div>
              <div className="stat-content">
                <div className="stat-value">{getTotalPointsThisWeek()}</div>
                <div className="stat-label">Esta Semana</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Award />
              </div>
              <div className="stat-content">
                <div className="stat-value">{pointsHistory.length}</div>
                <div className="stat-label">Actividades</div>
              </div>
            </div>
          </div>

          {/* Points History */}
          <div className="card">
            <div className="card-header">
              <h3>Historial de Puntos</h3>
            </div>
            <div className="card-content">
              {pointsHistory.length > 0 ? (
                <div className="points-history">
                  {pointsHistory.map((activity) => (
                    <div key={activity.id} className="history-item">
                      {getActionIcon(activity.action)}
                      <div className="history-content">
                        <div className="history-description">
                          {activity.description}
                        </div>
                        <div className="history-date">
                          {formatDate(activity.created_at)}
                        </div>
                      </div>
                      <div className="history-points">
                        <span className="points-value">
                          +{activity.points}
                        </span>
                        <span className="points-label">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-history">
                  <Trophy size={48} />
                  <p>¡Empieza a participar para ganar puntos!</p>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Section */}
          <div className="card">
            <div className="card-header">
              <h3>Logros</h3>
            </div>
            <div className="card-content">
              <div className="achievements-grid">
                {user.points >= 50 && (
                  <div className="achievement earned">
                    <div className="achievement-icon">🎉</div>
                    <div className="achievement-info">
                      <div className="achievement-title">Bienvenido</div>
                      <div className="achievement-desc">Únete a Las Cruzadas</div>
                    </div>
                  </div>
                )}
                
                {user.points >= 100 && (
                  <div className="achievement earned">
                    <div className="achievement-icon">⭐</div>
                    <div className="achievement-info">
                      <div className="achievement-title">Primera Estrella</div>
                      <div className="achievement-desc">Alcanza 100 puntos</div>
                    </div>
                  </div>
                )}
                
                {user.points >= 500 && (
                  <div className="achievement earned">
                    <div className="achievement-icon">🏆</div>
                    <div className="achievement-info">
                      <div className="achievement-title">Veterano</div>
                      <div className="achievement-desc">Alcanza 500 puntos</div>
                    </div>
                  </div>
                )}

                {user.points < 500 && (
                  <div className="achievement locked">
                    <div className="achievement-icon">🔒</div>
                    <div className="achievement-info">
                      <div className="achievement-title">Veterano</div>
                      <div className="achievement-desc">Alcanza 500 puntos</div>
                    </div>
                  </div>
                )}

                {userRank <= 3 && userRank !== 'N/A' && (
                  <div className="achievement earned">
                    <div className="achievement-icon">🥇</div>
                    <div className="achievement-info">
                      <div className="achievement-title">Top 3</div>
                      <div className="achievement-desc">Entra al podio</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .profile-container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
        .profile-header { position: relative; margin-bottom: 2rem; }
        .profile-cover {
          height: 200px;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          border-radius: var(--radius-lg);
          position: relative; display: flex; align-items: center; justify-content: center;
          margin-bottom: 1rem;
        }
        .profile-avatar-large {
          width: 120px; height: 120px; border-radius: 50%;
          background: var(--surface); border: 4px solid var(--surface);
          display: flex; align-items: center; justify-content: center;
          color: var(--primary); font-size: 3rem; font-weight: 700; box-shadow: var(--shadow-lg);
        }
        .profile-avatar-large img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .profile-info { text-align: center; margin-bottom: 1.5rem; }
        .profile-info h1 { font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .profile-info p { color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 1rem; }
        .profile-meta { display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.9rem; }
        .meta-item.admin { color: var(--secondary); font-weight: 600; }
        .profile-actions { display: flex; justify-content: center; margin-bottom: 2rem; }
        .qr-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .qr-content { background: var(--surface); border-radius: var(--radius-lg); padding: 2rem; box-shadow: var(--shadow-lg); text-align: center; max-width: 300px; width: 90%; }
        .qr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .qr-header h3 { color: var(--text-primary); font-weight: 600; }
        .qr-code { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .qr-image { border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); }
        .qr-code p { color: var(--text-secondary); font-size: 0.9rem; }
        .profile-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; display: flex; align-items: center; gap: 1rem; box-shadow: var(--shadow-sm); transition: all 0.2s ease; }
        .stat-card:hover { box-shadow: var(--shadow-md); }
        .stat-card.highlight { background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border: none; }
        .stat-icon { width: 48px; height: 48px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; }
        .stat-card:not(.highlight) .stat-icon { background: var(--background); color: var(--primary); }
        .stat-value { font-size: 1.5rem; font-weight: 700; line-height: 1; margin-bottom: 0.25rem; }
        .stat-label { font-size: 0.8rem; opacity: 0.8; font-weight: 500; }
        .points-history { display: flex; flex-direction: column; gap: 1rem; }
        .history-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--background); border-radius: var(--radius-sm); border: 1px solid var(--border-light); }
        .history-icon { width: 32px; height: 32px; padding: 6px; border-radius: 50%; flex-shrink: 0; }
        .history-icon.welcome { background: #fef3c7; color: #f59e0b; }
        .history-icon.post { background: #dbeafe; color: #3b82f6; }
        .history-icon.like { background: #fee2e2; color: #ef4444; }
        .history-icon.default { background: #d1fae5; color: #10b981; }
        .history-content { flex: 1; }
        .history-description { font-weight: 500; color: var(--text-primary); margin-bottom: 0.25rem; }
        .history-date { font-size: 0.8rem; color: var(--text-muted); }
        .history-points { text-align: right; }
        .points-value { font-size: 1.25rem; font-weight: 700; color: var(--success); }
        .points-label { font-size: 0.8rem; color: var(--text-muted); margin-left: 0.25rem; }
        .achievements-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
        .achievement { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-light); transition: all 0.2s ease; }
        .achievement.earned { background: var(--background); border-color: var(--success); }
        .achievement.locked { background: var(--surface-hover); opacity: 0.6; }
        .achievement-icon { font-size: 1.5rem; width: 40px; text-align: center; }
        .achievement-title { font-weight: 600; color: var(--text-primary); margin-bottom: 0.125rem; }
        .achievement-desc { font-size: 0.8rem; color: var(--text-secondary); }
        .empty-history { text-align: center; padding: 2rem; color: var(--text-muted); }
        .empty-history svg { margin-bottom: 1rem; opacity: 0.5; }
        @media (max-width: 768px) {
          .profile-container { padding: 1rem 0.5rem; }
          .profile-meta { flex-direction: column; gap: 0.75rem; }
          .profile-stats { grid-template-columns: 1fr; }
          .qr-content { margin: 1rem; padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
};

export default Profile;
