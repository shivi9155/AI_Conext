'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';

export default function LoginRegisterPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { theme, setTheme, resolvedTheme } = useSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await authService.login(username, password);
        localStorage.setItem('token', response.data.token);
        login({ userId: response.data.userId, username: response.data.username });
        router.push('/groups');
      } else {
        if (!email) {
          setError('Email is required for registration');
          return;
        }
        const response = await authService.register(username, email, password);
        localStorage.setItem('token', response.data.token);
        login({ userId: response.data.userId, username: response.data.username });
        router.push('/groups');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await authService.demoLogin('guest');
      localStorage.setItem('token', response.data.token);
      login({ userId: response.data.userId, username: response.data.username });
      router.push('/groups');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to start guest session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell page-shell-center">
      <button
        type="button"
        className="theme-toggle-btn"
        style={{ position: 'absolute', right: '1.25rem', top: '1.25rem' }}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle dark mode"
        title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="theme-toggle-track">
          <span className={`theme-toggle-thumb ${resolvedTheme === 'dark' ? 'dark' : 'light'}`}>
            {resolvedTheme === 'dark' ? '🌙' : '☀️'}
          </span>
        </span>
      </button>

      <div className="page-enter login-card">
        <div className="mb-6 text-center">
          <div className="logo-icon">
            F
          </div>
          <h1 className="text-3xl font-bold text-accent">FairShare Lite</h1>
          <p className="text-muted">Easy expense sharing</p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`login-tab ${isLogin ? 'active' : ''}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`login-tab ${!isLogin ? 'active' : ''}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-col">
          <div>
            <label className="font-bold mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="control w-full"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="font-bold mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="control w-full"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="control w-full"
              required
            />
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn primary-button w-full"
          >
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
          </button>
          <button type="button" onClick={handleGuestMode} className="btn secondary-button w-full">
            Continue as Guest
          </button>
        </form>
      </div>
    </div>
  );
};
