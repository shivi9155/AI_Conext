'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { expenseService, groupService } from '../../services/api';

export default function ExpensesPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
        fetchExpenses(response.data[0].id);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchExpenses = async (groupIdValue: string) => {
    try {
      const response = await expenseService.list({ groupId: groupIdValue, search, currency, paidBy, startDate, endDate, limit: 20 });
      setExpenses(response.data.expenses || []);
    } catch (err) {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setGroupId(selected);
    fetchExpenses(selected);
  };

  const handleFilter = () => {
    if (groupId) {
      fetchExpenses(groupId);
    }
  };

  return (
    <div className="page-shell">
      <AppHeader title="Expenses" subtitle="Search, filter, and sort expense records" showViewToggle />
      <main className="page-main page-enter">
        <section className="panel mb-6">
          <h2 className="panel-header">Filters</h2>
          <div className="grid-cols" style={{ gap: '1rem' }}>
            <select value={groupId} onChange={handleGroupChange} className="control">
              <option value="">Select group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <input className="control" placeholder="Search description" value={search} onChange={(e) => setSearch(e.target.value)} />
            <input className="control" placeholder="Paid by user id" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
            <input className="control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input className="control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <input className="control" placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <button type="button" className="btn primary-button" onClick={handleFilter}>
              Apply
            </button>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-header">Expenses</h2>
          {loading ? (
            <p>Loading expenses…</p>
          ) : (
            <div className="list-panel">
              {expenses.map((expense) => (
                <div key={expense.id} className="list-item">
                  <div>
                    <strong>{expense.description}</strong>
                    <p className="panel-text">{expense.paid_by_username} · {expense.currency} {expense.amount.toFixed(2)}</p>
                  </div>
                  <span>{expense.date || ''}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
