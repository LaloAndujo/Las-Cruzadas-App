import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import Navigation from './Navigation';
import { Heart, MessageSquare, Send, Plus, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Feed = () => {
  const { user, updateUserPoints } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`${API}/posts`);
      setPosts(response.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setPosting(true);
    try {
      const response = await axios.post(`${API}/posts`, {
        content: newPost.trim()
      });

      setPosts([response.data, ...posts]);
      setNewPost('');
      setShowNewPost(false);

      // Update user points
      updateUserPoints(user.points + 10);

      // Show success feedback
      showToast('¡Publicación creada! +10 puntos', 'success');
    } catch (error) {
      console.error('Error creating post:', error);
      showToast('Error al crear la publicación', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      const response = await axios.post(`${API}/posts/${postId}/like`);
      
      // Update posts state
      setPosts(posts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              is_liked: response.data.action === 'like',
              like_count: response.data.like_count
            }
          : post
      ));

      // Update user points if liked
      if (response.data.points_awarded > 0) {
        updateUserPoints(user.points + response.data.points_awarded);
        showToast(`+${response.data.points_awarded} puntos por dar like`, 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const showToast = (message, type) => {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      font-weight: 500;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
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

  if (loading) {
    return (
      <div className="main-container">
        <Navigation />
        <div className="main-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando feed...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container">
      <Navigation />
      <div className="main-content">
        <div className="feed-container">
          {/* Header */}
          <div className="feed-header">
            <h1>Feed de Las Cruzadas</h1>
            <p>Comparte lo que está pasando</p>
          </div>

          {/* New Post Button */}
          {!showNewPost && (
            <div className="new-post-trigger">
              <button 
                className="btn btn-primary"
                onClick={() => setShowNewPost(true)}
              >
                <Plus size={20} />
                Nueva Publicación
              </button>
            </div>
          )}

          {/* New Post Form */}
          {showNewPost && (
            <div className="post new-post-form">
              <div className="post-header">
                <div className="post-avatar">
                  {user.profile_picture ? (
                    <img src={user.profile_picture} alt={user.nickname} />
                  ) : (
                    user.nickname.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="post-author-info">
                  <h4>{user.nickname}</h4>
                  <p>¿Qué está pasando?</p>
                </div>
              </div>
              
              <form onSubmit={handleCreatePost}>
                <div className="post-content">
                  <textarea
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    placeholder="Comparte algo con Las Cruzadas..."
                    className="post-textarea"
                    rows="4"
                    maxLength="500"
                    autoFocus
                  />
                  <div className="post-meta">
                    <span className="char-count">
                      {newPost.length}/500
                    </span>
                  </div>
                </div>

                <div className="post-actions">
                  <div className="post-options">
                    <button type="button" className="option-btn" disabled>
                      <ImageIcon size={18} />
                      <span>Imagen</span>
                    </button>
                  </div>
                  
                  <div className="post-buttons">
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowNewPost(false);
                        setNewPost('');
                      }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary btn-sm"
                      disabled={!newPost.trim() || posting}
                    >
                      {posting ? (
                        <div className="loading-spinner small"></div>
                      ) : (
                        <>
                          <Send size={16} />
                          Publicar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Posts List */}
          <div className="posts-list">
            {posts.length > 0 ? (
              posts.map((post) => (
                <div key={post.id} className="post fade-in">
                  <div className="post-header">
                    <div className="post-avatar">
                      {post.profile_picture ? (
                        <img src={post.profile_picture} alt={post.nickname} />
                      ) : (
                        post.nickname.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="post-author-info">
                      <h4>{post.nickname}</h4>
                      <p>@{post.username} · {formatTimeAgo(post.created_at)}</p>
                    </div>
                  </div>

                  <div className="post-content">
                    <p>{post.content}</p>
                    {post.image && (
                      <div className="post-image">
                        <img src={post.image} alt="Post image" />
                      </div>
                    )}
                  </div>

                  <div className="post-actions">
                    <button 
                      className={`like-btn ${post.is_liked ? 'liked' : ''}`}
                      onClick={() => handleToggleLike(post.id)}
                    >
                      <Heart 
                        size={18} 
                        fill={post.is_liked ? 'currentColor' : 'none'}
                      />
                      <span>{post.like_count}</span>
                    </button>

                    <button className="comment-btn" disabled>
                      <MessageSquare size={18} />
                      <span>Comentar</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-feed">
                <MessageSquare size={64} />
                <h3>¡El feed está vacío!</h3>
                <p>Sé el primero en compartir algo con Las Cruzadas</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowNewPost(true)}
                >
                  <Plus size={20} />
                  Crear Primera Publicación
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .feed-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }
        .feed-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .feed-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }
        .feed-header p {
          color: var(--text-secondary);
        }
        .new-post-trigger {
          margin-bottom: 2rem;
        }
        .new-post-form {
          border: 2px solid var(--primary-light);
          box-shadow: var(--shadow-md);
        }
        .post-textarea {
          width: 100%;
          border: none;
          resize: none;
          font-size: 1rem;
          line-height: 1.5;
          padding: 0;
          background: transparent;
          font-family: inherit;
        }
        .post-textarea:focus { outline: none; }
        .post-textarea::placeholder { color: var(--text-muted); }
        .post-meta { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
        .char-count { font-size: 0.8rem; color: var(--text-muted); }
        .post-options { display: flex; gap: 1rem; }
        .option-btn {
          display: flex; align-items: center; gap: 0.5rem;
          background: none; border: none; color: var(--text-secondary);
          cursor: pointer; padding: 0.5rem; border-radius: var(--radius-sm);
          transition: all 0.2s ease; font-size: 0.875rem;
        }
        .option-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--primary); }
        .option-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .post-buttons { display: flex; gap: 0.75rem; }
        .posts-list { display: flex; flex-direction: column; gap: 1rem; }
        .post {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        .post:hover { box-shadow: var(--shadow-md); }
        .post-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 600; font-size: 1.125rem;
        }
        .post-avatar img {
          width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
        }
        .post-author-info h4 { font-weight: 600; color: var(--text-primary); margin-bottom: 0.125rem; }
        .post-author-info p { color: var(--text-secondary); font-size: 0.8rem; }
        .post-content p { color: var(--text-primary); line-height: 1.6; margin-bottom: 1rem; }
        .post-image { margin-top: 1rem; border-radius: var(--radius-sm); overflow: hidden; }
        .post-image img { width: 100%; height: auto; display: block; }
        .comment-btn {
          display: flex; align-items: center; gap: 0.5rem;
          background: none; border: none; color: var(--text-secondary);
          cursor: pointer; padding: 0.5rem 1rem; border-radius: var(--radius-sm);
          transition: all 0.2s ease; font-size: 0.875rem;
        }
        .comment-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--primary); }
        .comment-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .empty-feed { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
        .empty-feed svg { margin-bottom: 1rem; opacity: 0.5; }
        .empty-feed h3 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
        .empty-feed p { margin-bottom: 2rem; }
        .loading-spinner.small { width: 16px; height: 16px; border-width: 2px; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @media (max-width: 768px) {
          .feed-container { padding: 1rem 0.5rem; }
          .post-header { padding: 1rem; }
          .post-content { padding: 0 1rem 1rem; }
          .post-actions { padding: 0.75rem 1rem; }
        }
      `}</style>
    </div>
  );
};

export default Feed;
