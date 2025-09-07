import React, { useState } from 'react';
import { useAuth } from '../App';
import { Eye, EyeOff, Users, Crown } from 'lucide-react';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    nickname: '',
    password: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (isLogin) {
        result = await login(formData.username, formData.password);
      } else {
        if (!formData.nickname.trim()) {
          setError('El nickname es requerido');
          setLoading(false);
          return;
        }
        result = await register(
          formData.username,
          formData.nickname,
          formData.password,
          formData.email
        );
      }

      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Crown size={32} />
          </div>
          <h1>Las Cruzadas</h1>
          <p>Tu red social privada</p>
        </div>

        <div className="login-tabs">
          <button
            className={`tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Iniciar Sesión
          </button>
          <button
            className={`tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Tu nombre de usuario"
              required
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label className="form-label">Nickname</label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Tu apodo en Las Cruzadas"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (opcional)</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="tu@email.com"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Tu contraseña"
                required
                minLength="6"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              isLogin ? 'Entrar' : 'Crear Cuenta'
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="login-feature">
            <Users size={20} />
            <span>Red social privada para el grupo</span>
          </div>
          <div className="login-feature">
            <Crown size={20} />
            <span>Sistema de puntos y rankings</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
