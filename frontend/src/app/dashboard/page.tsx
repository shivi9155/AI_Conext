'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { expenseService, importService, settlementService } from '../../services/api';
import { groupService } from '../../services/api';

export default function DashboardPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    fetchGroups();
  }, [isAuthenticated, router]);

  const fetchGroups = async () => {
    try {
      const response = await groupService.getAll();
      setGroups(response.data);
      if (response.data.length > 0) {
        setSelectedGroupId(response.data[0].id);
        fetchGroupDetails(response.data[0].id);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const expenseResponse = await expenseService.list({ groupId, limit: 5, sort: 'date_desc' });
      const importResponse = await importService.getHistory(groupId);
      setRecentExpenses(expenseResponse.data.expenses || []);
      setImportHistory(importResponse.data.history || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const groupId = event.target.value;
    setSelectedGroupId(groupId);
    fetchGroupDetails(groupId);
  };

  return (
    <div className="page-shell">
      <AppHeader title="Dashboard" subtitle="Overview and import history" showViewToggle />
      <main className="page-main page-enter">
        <section className="panel mb-6">
          <div className="flex-between">
            <h2 className="panel-header">Overview</h2>
            <button className="btn secondary-button" type="button" onClick={() => router.push('/import-expenses')}>
              Import Expenses
            </button>
          </div>
          <div className="flex-row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
            <div className="panel w-full" style={{ minWidth: '280px' }}>
              <p className="panel-text">Groups</p>
              <p className="text-4xl font-black">{groups.length}</p>
            </div>
            <div className="panel w-full" style={{ minWidth: '280px' }}>
              <p className="panel-text">Recent imports</p>
              <p className="text-4xl font-black">{importHistory.length}</p>
            </div>
            <div className="panel w-full" style={{ minWidth: '280px' }}>
              <p className="panel-text">Recent expenses</p>
              <p className="text-4xl font-black">{recentExpenses.length}</p>
            </div>
          </div>
        </section>

        <section className="panel mb-6">
          <h2 className="panel-header">Quick actions</h2>
          <div className="grid-cards" style={{ gap: '1rem' }}>
            <button type="button" className="panel btn secondary-button" onClick={() => router.push('/expenses')}>
              View expenses
            </button>
            <button type="button" className="panel btn secondary-button" onClick={() => router.push('/settlements')}>
              View settlements
            </button>
            <button type="button" className="panel btn secondary-button" onClick={() => router.push('/groups')}>
              Manage groups
            </button>
          </div>
        </section>

        <section className="panel mb-6">
          <div className="flex-between mb-4">
            <h2 className="panel-header">Active group</h2>
            <select value={selectedGroupId} onChange={handleGroupChange} className="control">
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2">Latest expenses</h3>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <ul className="list-panel">
                {recentExpenses.map((expense) => (
                  <li key={expense.id} className="list-item">
                    <div>
                      <strong>{expense.description}</strong>
                      <p className="panel-text">{expense.paid_by_username} · {expense.currency} {expense.amount.toFixed(2)}</p>
                    </div>
                    <span>{expense.date || ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-header">Import history</h2>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="list-panel">
              {importHistory.slice(0, 4).map((item) => (
                <div key={item.id} className="list-item">
                  <div>
                    <strong>Imported {new Date(item.imported_at).toLocaleDateString()}</strong>
                    <p className="panel-text">Rows: {item.total_rows}, Imported: {item.imported_rows}, Skipped: {item.skipped_rows}</p>
                  </div>
                  <span>{item.imported_by_username || 'Unknown'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
