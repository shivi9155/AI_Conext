'use client';
import React, { createContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type CurrencyCode = 'USD' | 'EUR' | 'INR' | 'GBP';
export type ViewMode = 'card' | 'list';

interface SettingsContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  viewMode: ViewMode;
  setViewMode: (viewMode: ViewMode) => void;
  compactMode: boolean;
  setCompactMode: (enabled: boolean) => void;
  requireSettlementConfirmation: boolean;
  setRequireSettlementConfirmation: (enabled: boolean) => void;
  formatAmount: (amount: number | string) => string;
  convertAmount: (amount: number | string) => number;
}

const currencyRates: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  INR: 83.4,
  GBP: 0.79,
};

const storageKeys = {
  theme: 'fairshare-theme',
  currency: 'fairshare-currency',
  viewMode: 'fairshare-view-mode',
  compactMode: 'fairshare-compact-mode',
  requireSettlementConfirmation: 'fairshare-require-settlement-confirmation',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const readStorage = <T extends string>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  const value = localStorage.getItem(key);
  return (value || fallback) as T;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStorage(storageKeys.theme, 'system'));
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => readStorage(storageKeys.currency, 'USD'));
  const [viewMode, setViewModeState] = useState<ViewMode>(() => readStorage(storageKeys.viewMode, 'card'));
  const [compactMode, setCompactModeState] = useState(() => typeof window !== 'undefined' && localStorage.getItem(storageKeys.compactMode) === 'true');
  const [requireSettlementConfirmation, setRequireSettlementConfirmationState] = useState(
    () => typeof window !== 'undefined' ? localStorage.getItem(storageKeys.requireSettlementConfirmation) !== 'false' : true
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const nextTheme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      setResolvedTheme(nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('compact', compactMode);
  }, [compactMode]);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    localStorage.setItem(storageKeys.theme, nextTheme);
  };

  const setCurrency = (nextCurrency: CurrencyCode) => {
    setCurrencyState(nextCurrency);
    localStorage.setItem(storageKeys.currency, nextCurrency);
  };

  const setViewMode = (nextViewMode: ViewMode) => {
    setViewModeState(nextViewMode);
    localStorage.setItem(storageKeys.viewMode, nextViewMode);
  };

  const setCompactMode = (enabled: boolean) => {
    setCompactModeState(enabled);
    localStorage.setItem(storageKeys.compactMode, String(enabled));
  };

  const setRequireSettlementConfirmation = (enabled: boolean) => {
    setRequireSettlementConfirmationState(enabled);
    localStorage.setItem(storageKeys.requireSettlementConfirmation, String(enabled));
  };

  const convertAmount = (amount: number | string) => Number(amount || 0) * currencyRates[currency];

  const formatAmount = (amount: number | string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
    }).format(convertAmount(amount));

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      currency,
      setCurrency,
      viewMode,
      setViewMode,
      compactMode,
      setCompactMode,
      requireSettlementConfirmation,
      setRequireSettlementConfirmation,
      formatAmount,
      convertAmount,
    }),
    [theme, resolvedTheme, currency, viewMode, compactMode, requireSettlementConfirmation]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
