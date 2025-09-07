import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import Navigation from './Navigation';
import { Trophy, Crown, Medal, TrendingUp, Award } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Leaderboard = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API}/leaderboard`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return <Crown className="rank-icon gold" />;
      case 2: return <Medal className="rank-icon silver" />;
      case 3: return <Award className="rank-icon bronze" />;
      default: return <Trophy className="rank-icon default" />;
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return '#fbbf24'; // Gold
      case 2: return '#94a3b8'; // Silver
      case 3: return '#f97316'; // Bronze
      default: return '#6b7280'; // Gray
    }
  };

  const getMedalEmoji = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getPointsRange = () => {
    if (leaderboard.length === 0) return { min: 0, max: 100 };
    const points = leaderboard.map(p => p.points);
    return { min: Math.min(...points), max: Math.max(...points) };
  };

  const getProgressPercentage = (points) => {
    const { min, max } = getPointsRange();
    if (max === min) return 100;
    return ((points - min) / (max - min)) * 100;
  };

  const getUserPosition = () => {
    return leaderboard.findIndex(p => p.nickname === user.nickname) + 1 || 'N/A';
  };

  if (loading) {
    return (
      <div className="main-container">
        <Navigation />
        <div className="main-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando ranking...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container">
      <Navigation />
      <div className="main-content">
        <div className="leaderboard-container">
          {/* Header */}
          <div className="leaderboard-header">
            <div className="header-content">
              <div className="header-icon">
                <Trophy size={32} />
              </div>
              <div className="header-text">
                <h1>Ranking de Las Cruzadas</h1>
                <p>Los mejores cruzados del momento</p>
              </div>
            </div>
            
            <div className="my-position">
              <div className="position-card">
                <TrendingUp className="position-icon" />
                <div className="position-info">
                  <div className="position-rank">#{getUserPosition()}</div>
                  <div className="position-label">Tu posición</div>
                </div>
              </div>
            </div>
          </div>

          {/* Podium - Top 3 */}
          {leaderboard.length >= 3 && (
            <div className="podium">
              <div className="podium-container">
                {/* Second Place */}
                <div className="podium-position second">
                  <div className="podium-avatar">
                    {leaderboard[1].profile_picture ? (
                      <img src={leaderboard[1].profile_picture} alt={leaderboard[1].nickname} />
                    ) : (
                      leaderboard[1].nickname.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="podium-info">
                    <div className="podium-rank">🥈</div>
                    <div className="podium-name">{leaderboard[1].nickname}</div>
                    <div className="podium-points">{leaderboard[1].points} pts</div>
                  </div>
                  <div className="podium-base second-base">2</div>
                </div>

                {/* First Place */}
                <div className="podium-position first">
                  <div className="podium-crown">
                    <Crown size={24} />
                  </div>
                  <div className="podium-avatar">
                    {leaderboard[0].profile_picture ? (
                      <img src={leaderboard[0].profile_picture} alt={leaderboard[0].nickname} />
                    ) : (
                      leaderboard[0].nickname.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="podium-info">
                    <div className="podium-rank">🥇</div>
                    <div className="podium-name">{leaderboard[0].nickname}</div>
                    <div className="podium-points">{leaderboard[0].points} pts</div>
                  </div>
                  <div className="podium-base first-base">1</div>
                </div>

                {/* Third Place */}
                <div className="podium-position third">
                  <div className="podium-avatar">
                    {leaderboard[2].profile_picture ? (
                      <img src={leaderboard[2].profile_picture} alt={leaderboard[2].nickname} />
                    ) : (
                      leaderboard[2].nickname.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="podium-info">
                    <div className="podium-rank">🥉</div>
                    <div className="podium-name">{leaderboard[2].nickname}</div>
                    <div className="podium-points">{leaderboard[2].points} pts</div>
                  </div>
                  <div className="podium-base third-base">3</div>
                </div>
              </div>
            </div>
          )}

          {/* Full Leaderboard */}
          <div className="leaderboard-list">
            <div className="list-header">
              <h3>Ranking Completo</h3>
              <p>{leaderboard.length} cruzados registrados</p>
            </div>

            <div className="ranking-list">
              {leaderboard.map((player, index) => {
                const rank = index + 1;
                const isCurrentUser = player.nickname === user.nickname;
                const progressPercentage = getProgressPercentage(player.points);

                return (
                  <div 
                    key={index} 
                    className={`ranking-item ${isCurrentUser ? 'current-user' : ''} ${rank <= 3 ? 'top-three' : ''}`}
                  >
                    <div className="ranking-position">
                      <div className="rank-display">
                        {getMedalEmoji(rank)}
                      </div>
                    </div>

                    <div className="player-info">
                      <div className="player-avatar">
                        {player.profile_picture ? (
                          <img src={player.profile_picture} alt={player.nickname} />
                        ) : (
                          player.nickname.charAt(0).toUpperCase()
                        )}
                      </div>
                      
                      <div className="player-details">
                        <div className="player-name">
                          {player.nickname}
                          {isCurrentUser && <span className="you-badge">Tú</span>}
                        </div>
                        <div className="player-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ 
                                width: `${progressPercentage}%`,
                                background: rank <= 3 ? getRankColor(rank) : '#3b82f6'
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="player-score">
                      <div className="score-value">{player.points}</div>
                      <div className="score-label">puntos</div>
                    </div>

                    {rank <= 3 && (
                      <div className="ranking-badge">
                        {getRankIcon(rank)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {leaderboard.length === 0 && (
              <div className="empty-leaderboard">
                <Trophy size={64} />
                <h3>¡Aún no hay rankings!</h3>
                <p>Sé el primero en ganar puntos y lidera la tabla</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .leaderboard-container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
        .leaderboard-header {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem;
          background: var(--surface); padding: 2rem; border-radius: var(--radius-lg);
          border: 1px solid var(--border); box-shadow: var(--shadow-sm);
        }
        .header-content { display: flex; align-items: center; gap: 1rem; }
        .header-icon {
          width: 64px; height: 64px; background: linear-gradient(135deg, var(--primary), var(--primary-light));
          border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: var(--shadow-md);
        }
        .header-text h1 { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .header-text p { color: var(--text-secondary); }
        .my-position { text-align: center; }
        .position-card {
          display: flex; align-items: center; gap: 0.75rem; background: var(--background);
          padding: 1rem 1.5rem; border-radius: var(--radius); border: 1px solid var(--border-light);
        }
        .position-icon { color: var(--primary); }
        .position-rank { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); line-height: 1; }
        .position-label { font-size: 0.8rem; color: var(--text-secondary); }
        .podium {
          margin-bottom: 3rem; background: var(--surface); border-radius: var(--radius-lg);
          padding: 2rem; border: 1px solid var(--border); box-shadow: var(--shadow-sm);
        }
        .podium-container { display: flex; justify-content: center; align-items: end; gap: 2rem; max-width: 600px; margin: 0 auto; }
        .podium-position { display: flex; flex-direction: column; align-items: center; position: relative; }
        .podium-crown { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); color: #fbbf24; animation: bounce 2s infinite; }
        .podium-avatar {
          width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: 700;
          margin-bottom: 1rem; border: 4px solid var(--surface); box-shadow: var(--shadow-lg);
        }
        .first .podium-avatar { width: 100px; height: 100px; font-size: 2.5rem; }
        .podium-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .podium-info { text-align: center; margin-bottom: 1rem; }
        .podium-rank { font-size: 2rem; margin-bottom: 0.5rem; }
        .podium-name { font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; }
        .podium-points { color: var(--text-secondary); font-size: 0.9rem; font-weight: 500; }
        .podium-base { width: 120px; height: 60px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: 700; border-radius: var(--radius-sm) var(--radius-sm) 0 0; }
        .first-base { background: linear-gradient(135deg, #fbbf24, #f59e0b); height: 80px; }
        .second-base { background: linear-gradient(135deg, #94a3b8, #64748b); height: 65px; }
        .third-base { background: linear-gradient(135deg, #f97316, #ea580c); height: 50px; }
        .leaderboard-list { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: var(--shadow-sm); overflow: hidden; }
        .list-header { padding: 1.5rem; border-bottom: 1px solid var(--border-light); background: var(--background); }
        .list-header h3 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; }
        .list-header p { color: var(--text-secondary); font-size: 0.9rem; }
        .ranking-list { display: flex; flex-direction: column; }
        .ranking-item { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-light); transition: all 0.2s ease; position: relative; }
        .ranking-item:hover { background: var(--surface-hover); }
        .ranking-item.current-user { background: linear-gradient(135deg, #dbeafe, #e0f2fe); border-left: 4px solid var(--primary); }
        .ranking-item.top-three { background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.1)); }
        .ranking-item:last-child { border-bottom: none; }
        .ranking-position { min-width: 60px; text-align: center; }
        .rank-display { font-size: 1.25rem; font-weight: 700; }
        .player-info { display: flex; align-items: center; gap: 1rem; flex: 1; }
        .player-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.125rem;
        }
        .player-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .player-details { flex: 1; }
        .player-name { font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
        .you-badge { background: var(--primary); color: white; font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: 500; }
        .player-progress { width: 100%; }
        .progress-bar { width: 100%; height: 6px; background: var(--background); border-radius: 3px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
        .player-score { text-align: right; min-width: 80px; }
        .score-value { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); line-height: 1; }
        .score-label { font-size: 0.8rem; color: var(--text-secondary); }
        .ranking-badge { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); }
        .rank-icon { width: 24px; height: 24px; }
        .rank-icon.gold { color: #fbbf24; } .rank-icon.silver { color: #94a3b8; } .rank-icon.bronze { color: #f97316; } .rank-icon.default { color: var(--text-muted); }
        .empty-leaderboard { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
        .empty-leaderboard svg { margin-bottom: 1rem; opacity: 0.5; }
        .empty-leaderboard h3 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
          40% { transform: translateX(-50%) translateY(-10px); }
          60% { transform: translateX(-50%) translateY(-5px); }
        }
        @media (max-width: 768px) {
          .leaderboard-container { padding: 1rem 0.5rem; }
          .leaderboard-header { flex-direction: column; gap: 1.5rem; }
          .podium-container { flex-direction: column; gap: 1rem; }
          .podium-position { width: 100%; }
          .podium-base { width: 100%; }
          .ranking-item { padding: 1rem; }
          .player-info { gap: 0.75rem; }
          .ranking-badge { display: none; }
        }
      `}</style>
    </div>
  );
};

export default Leaderboard;
