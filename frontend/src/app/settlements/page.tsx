'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { settlementService, groupService } from '../../services/api';

export default function SettlementsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState('');
  const [balances, setBalances] = useState<any[]>([]);
  const [actualDebts, setActualDebts] = useState<any[]>([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState<any[]>([]);
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
        setGroupId(response.data[0].id);
        fetchBalances(response.data[0].id);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchBalances = async (groupIdValue: string) => {
    try {
      const response = await settlementService.getBalances(groupIdValue);
      setBalances(response.data.balances || []);
      setActualDebts(response.data.actualDebts || []);
      setSimplifiedDebts(response.data.simplifiedDebts || []);
    } catch (err) {
      setBalances([]);
      setActualDebts([]);
      setSimplifiedDebts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setGroupId(selected);
    fetchBalances(selected);
  };

  return (
    <div className="page-shell">
      <AppHeader title="Settlements" subtitle="View group balances and suggested payments" showViewToggle />
      <main className="page-main page-enter">
        <section className="panel mb-6">
          <div className="flex-between">
            <h2 className="panel-header">Group balances</h2>
            <select value={groupId} onChange={handleGroupChange} className="control">
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <p>Loading balances…</p>
          ) : (
            <div className="list-panel">
              {balances.map((balance) => (
                <div key={balance.id} className="list-item">
                  <div>
                    <strong>{balance.username}</strong>
                    <p className="panel-text">Paid: {balance.total_paid.toFixed(2)} · Owed: {balance.total_owed.toFixed(2)}</p>
                  </div>
                  <span>{balance.balance.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel mb-6">
          <h2 className="panel-header">Suggested settlements</h2>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <div className="list-panel">
              {simplifiedDebts.map((debt) => (
                <div key={`${debt.fromUser.id}-${debt.toUser.id}`} className="list-item">
                  <div>
                    <strong>{debt.fromUser.username} → {debt.toUser.username}</strong>
                    <p className="panel-text">Amount to settle</p>
                  </div>
                  <span>{debt.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
