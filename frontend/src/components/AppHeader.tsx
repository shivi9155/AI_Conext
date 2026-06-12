'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { CurrencyCode, useSettings } from '../contexts/SettingsContext';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showViewToggle?: boolean;
}

const currencies: CurrencyCode[] = ['USD', 'EUR', 'INR', 'GBP'];

export const AppHeader: React.FC<AppHeaderProps> = ({ title = 'FairShare Lite', subtitle, showBack, showViewToggle }) => {
  const router = useRouter();
  const { logout, user } = useAuth();
  const {
    theme,
    setTheme,
    resolvedTheme,
    currency,
    setCurrency,
    viewMode,
    setViewMode,
    compactMode,
    setCompactMode,
    requireSettlementConfirmation,
    setRequireSettlementConfirmation,
  } = useSettings();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="app-header">
      <div className="app-header-content">
        <div className="header-title-group">
          {showBack && (
            <button type="button" className="btn icon-button" onClick={() => router.back()} aria-label="Go back">
              &lt;
            </button>
          )}
          <div>
            <h1 className="header-title">{title}</h1>
            {subtitle && <p className="header-subtitle">{subtitle}</p>}
          </div>
        </div>

        <div className="header-actions">
          {showViewToggle && (
            <button
              type="button"
              className="btn icon-button"
              onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')}
              title={viewMode === 'card' ? 'Switch to list view' : 'Switch to card view'}
              aria-label="Toggle view"
            >
              {viewMode === 'card' ? 'Grid' : 'List'}
            </button>
          )}

          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            className="control"
            aria-label="Currency"
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="theme-toggle-btn"
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

          <label className="settings-chip">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(event) => setCompactMode(event.target.checked)}
            />
            Compact
          </label>

          <label className="settings-chip">
            <input
              type="checkbox"
              checked={requireSettlementConfirmation}
              onChange={(event) => setRequireSettlementConfirmation(event.target.checked)}
            />
            Confirm
          </label>

          {user && <span className="header-subtitle">{user.username}</span>}
          {user && (
            <button type="button" className="btn secondary-button" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
