import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import Navigation from './Navigation';
import { Trophy, Calendar, MessageSquare, Star, TrendingUp, Award } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { user, refreshUser } = useAuth();
  const [pointsHistory, setPointsHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [pointsResponse, leaderboardResponse] = await Promise.all([
        axios.get(`${API}/users/${user.id}/points/history`),
        axios.get(`${API}/leaderboard`)
      ]);
      
      setPointsHistory(pointsResponse.data.slice(0, 5)); // Last 5 activities
      setLeaderboard(leaderboardResponse.data.slice(0, 5)); // Top 5
      await refreshUser(); // Update user points
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'welcome':
        return <Star className="action-icon welcome" />;
      case 'post':
        return <MessageSquare className="action-icon post" />;
      case 'like':
        return <Trophy className="action-icon like" />;
      default:
        return <Award className="action-icon default" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'welcome':
        return '#f59e0b';
      case 'post':
        return '#3b82f6';
      case 'like':
        return '#ef4444';
      default:
        return '#10b981';
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const getUserRank = () => {
    const userRank = leaderboard.findIndex(u => u.nickname === user.nickname) + 1;
    return userRank || 'N/A';
  };

  if (loading) {
    return (
      <div className="main-container">
        <Navigation />
        <div className="main-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container">
      <Navigation />
      <div className="main-content">
        <div className="dashboard-container">
          {/* Header */}
          <div className="dashboard-header">
            <div className="welcome-section">
              <div className="user-avatar-large">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt={user.nickname} />
                ) : (
                  user.nickname.charAt(0).toUpperCase()
                )}
              </div>
              <div className="welcome-text">
                <h1>¡Hola, {user.nickname}! 👋</h1>
                <p>Bienvenido de vuelta a Las Cruzadas</p>
              </div>
            </div>
            <div className="header-stats">
              <div className="header-stat">
                <div className="stat-icon">
                  <Trophy />
                </div>
                <div className="stat-info">
                  <div className="stat-value">{user.points}</div>
                  <div className="stat-label">Puntos</div>
                </div>
              </div>
              <div className="header-stat">
                <div className="stat-icon">
                  <TrendingUp />
                </div>
                <div className="stat-info">
                  <div className="stat-value">#{getUserRank()}</div>
                  <div className="stat-label">Ranking</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <Trophy className="stat-icon-large" />
                <div>
                  <div className="stat-value">{user.points}</div>
                  <div className="stat-label">Puntos Totales</div>
                </div>
              </div>
              <div className="stat-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${Math.min((user.points / 1000) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {1000 - user.points > 0 ? `${1000 - user.points} para el próximo nivel` : '¡Nivel máximo!'}
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Award className="stat-icon-large" />
                <div>
                  <div className="stat-value">#{getUserRank()}</div>
                  <div className="stat-label">Posición</div>
                </div>
              </div>
              <div className="stat-description">
                {getUserRank() <= 3 ? '🏆 ¡En el podio!' : '¡Sigue escalando!'}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Calendar className="stat-icon-large" />
                <div>
                  <div className="stat-value">0</div>
                  <div className="stat-label">Eventos</div>
                </div>
              </div>
              <div className="stat-description">
                Próximamente disponible
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="dashboard-grid">
            {/* Recent Activity */}
            <div className="card">
              <div className="card-header">
                <h3>Actividad Reciente</h3>
              </div>
              <div className="card-content">
                {pointsHistory.length > 0 ? (
                  <div className="activity-list">
                    {pointsHistory.map((activity) => (
                      <div key={activity.id} className="activity-item">
                        {getActionIcon(activity.action)}
                        <div className="activity-content">
                          <div className="activity-description">
                            {activity.description}
                          </div>
                          <div className="activity-meta">
                            <span 
                              className="activity-points"
                              style={{ color: getActionColor(activity.action) }}
                            >
                              +{activity.points} puntos
                            </span>
                            <span className="activity-time">
                              {formatTimeAgo(activity.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <MessageSquare size={48} />
                    <p>¡Empieza a participar para ver tu actividad!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="card">
              <div className="card-header">
                <h3>Top Cruzados</h3>
              </div>
              <div className="card-content">
                {leaderboard.length > 0 ? (
                  <div className="leaderboard-list">
                    {leaderboard.map((player, index) => (
                      <div 
                        key={index} 
                        className={`leaderboard-item ${player.nickname === user.nickname ? 'current-user' : ''}`}
                      >
                        <div className="rank">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `#${index + 1}`}
                        </div>
                        <div className="player-avatar">
                          {player.profile_picture ? (
                            <img src={player.profile_picture} alt={player.nickname} />
                          ) : (
                            player.nickname.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="player-info">
                          <div className="player-name">{player.nickname}</div>
                          <div className="player-points">{player.points} puntos</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Trophy size={48} />
                    <p>¡Sé el primero en el ranking!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          background: var(--surface);
          padding: 2rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }

        .welcome-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-avatar-large {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 2rem;
          font-weight: 700;
          box-shadow: var(--shadow-md);
        }

        .user-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .welcome-text h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .welcome-text p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .header-stats {
          display: flex;
          gap: 2rem;
        }

        .header-stat {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          background: var(--primary);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .stat-info .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
        }

        .stat-info .stat-label {
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
        }

        .stat-card {
          background: var(--surface);
          padding: 1.5rem;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }

        .stat-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .stat-icon-large {
          width: 48px;
          height: 48px;
          padding: 12px;
          background: var(--primary);
          color: white;
          border-radius: var(--radius-sm);
        }

        .stat-progress {
          margin-top: 1rem;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: var(--background);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--primary-light));
          transition: width 0.3s ease;
        }

        .progress-text {
          color: var(--text-secondary);
          font-size: 0.8rem;
        }

        .stat-description {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--background);
          border-radius: var(--radius-sm);
        }

        .action-icon {
          width: 32px;
          height: 32px;
          padding: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .action-icon.welcome {
          background: #fef3c7;
          color: #f59e0b;
        }

        .action-icon.post {
          background: #dbeafe;
          color: #3b82f6;
        }

        .action-icon.like {
          background: #fee2e2;
          color: #ef4444;
        }

        .action-icon.default {
          background: #d1fae5;
          color: #10b981;
        }

        .activity-content {
          flex: 1;
        }

        .activity-description {
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .activity-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
        }

        .activity-points {
          font-weight: 600;
        }

        .activity-time {
          color: var(--text-muted);
        }

        .leaderboard-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .leaderboard-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--background);
          border-radius: var(--radius-sm);
          transition: all 0.2s ease;
        }

        .leaderboard-item.current-user {
          background: linear-gradient(135deg, #dbeafe, #e0f2fe);
          border: 1px solid var(--primary-light);
        }

        .rank {
          font-size: 1.25rem;
          font-weight: 700;
          min-width: 40px;
          text-align: center;
        }

        .player-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary-light);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .player-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .player-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .player-points {
          color: var(--text-secondary);
          font-size: 0.8rem;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--text-muted);
        }

        .empty-state svg {
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .dashboard-container {
            padding: 1rem;
          }

          .dashboard-header {
            flex-direction: column;
            gap: 1.5rem;
            text-align: center;
          }

          .header-stats {
            justify-content: center;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
