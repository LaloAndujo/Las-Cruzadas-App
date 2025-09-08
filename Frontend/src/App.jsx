// Frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import '../style.css';

// Components
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';

// === API base (Vite) ===
const API_BASE = import.meta.env.VITE_BACKEND_URL || ''; // mismo dominio si está vacío
const API = `${API_BASE}/api`;

// === Axios global config ===
axios.defaults.baseURL = API_BASE;
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // usamos la misma key que ya tenías
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Context
const AuthContext = React.createContext();
export const useAuth = () => React.useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si ya hay token, intenta traer el perfil
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data } = await axios.get(`${API}/users/me`);
      setUser(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const login = async (username, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/login`, { username, password });
      const { access_token, user: userData } = data;
      localStorage.setItem('token', access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al iniciar sesión'
      };
    }
  };

  const register = async (username, nickname, password, email) => {
    try {
      const { data } = await axios.post(`${API}/auth/register`, {
        username,
        nickname,
        password,
        email
      });
      const { access_token, user: userData } = data;
      localStorage.setItem('token', access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al registrarse'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUserPoints = (newPoints) => {
    setUser((prev) => (prev ? { ...prev, points: newPoints } : prev));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando Las Cruzadas...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        updateUserPoints,
        refreshUser: fetchUserProfile
      }}
    >
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/dashboard" /> : <LoginPage />}
            />
            <Route
              path="/dashboard"
              element={user ? <Dashboard /> : <Navigate to="/login" />}
            />
            <Route
              path="/feed"
              element={user ? <Feed /> : <Navigate to="/login" />}
            />
            <Route
              path="/profile"
              element={user ? <Profile /> : <Navigate to="/login" />}
            />
            <Route
              path="/leaderboard"
              element={user ? <Leaderboard /> : <Navigate to="/login" />}
            />
            <Route
              path="/"
              element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
            />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthContext.Provider>
  );
}

export default App;
