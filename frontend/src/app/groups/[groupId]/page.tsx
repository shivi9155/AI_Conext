'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { expenseService, groupService, settlementService, authService } from '../../../services/api';
import { AppHeader } from '../../../components/AppHeader';
import { useSettings } from '../../../contexts/SettingsContext';
import { useAuth } from '../../../contexts/AuthContext';

interface Member {
  id: string;
  username: string;
}

interface ExpenseShare {
  userId: string;
  username: string;
  amount: number;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  paid_by_username: string;
  category: string;
  notes: string;
  split_type: string;
  created_at: string;
  shares: ExpenseShare[];
  comments: Comment[];
}

interface Balance {
  id: string;
  username: string;
  total_paid: number;
  total_owed: number;
  balance: number;
}

interface DebtRelation {
  fromUser: { id: string; username: string };
  toUser: { id: string; username: string };
  amount: number;
}

interface Activity {
  id: string;
  action: string;
  created_at: string;
  user_id: string;
  username: string | null;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onUndo?: () => void;
}

// --- SVG Donut Chart ---
const DonutChart: React.FC<{
  categoryTotals: Record<string, number>;
  totalAmount: number;
  formatAmount: (v: number) => string;
}> = ({ categoryTotals, totalAmount, formatAmount }) => {
  const categoryColors: Record<string, string> = {
    Food: '#f59e0b',
    Transport: '#3b82f6',
    Shopping: '#ec4899',
    Bills: '#ef4444',
    Entertainment: '#8b5cf6',
    Other: '#6b7280',
  };

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  if (totalAmount === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
        <svg width="160" height="160" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="70" fill="none" stroke="var(--border-color)" strokeWidth="20" />
        </svg>
        <p className="panel-text" style={{ marginTop: '1rem' }}>No expenses recorded yet.</p>
      </div>
    );
  }

  let accumulatedPercent = 0;
  const slices = Object.entries(categoryTotals)
    .filter(([, val]) => val > 0)
    .map(([cat, val]) => {
      const percentage = val / totalAmount;
      const startPercent = accumulatedPercent;
      accumulatedPercent += percentage;
      return { category: cat, value: val, percentage, startPercent, color: categoryColors[cat] || '#6b7280' };
    });

  const getCoords = (percent: number) => [
    Math.cos(2 * Math.PI * percent - Math.PI / 2),
    Math.sin(2 * Math.PI * percent - Math.PI / 2),
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-around', gap: '1.5rem', padding: '1rem' }}>
      <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0 }}>
        <svg width="180" height="180" viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          {slices.map((slice, i) => {
            const [sx, sy] = getCoords(slice.startPercent);
            const [ex, ey] = getCoords(slice.startPercent + slice.percentage);
            const large = slice.percentage > 0.5 ? 1 : 0;
            return (
              <path
                key={i}
                d={`M 0 0 L ${sx} ${sy} A 1 1 0 ${large} 1 ${ex} ${ey} Z`}
                fill={slice.color}
                style={{ cursor: 'pointer', opacity: hoveredCategory && hoveredCategory !== slice.category ? 0.6 : 1, transition: 'opacity 0.2s ease' }}
                onMouseEnter={() => setHoveredCategory(slice.category)}
                onMouseLeave={() => setHoveredCategory(null)}
              />
            );
          })}
          <circle cx="0" cy="0" r="0.58" fill="var(--bg-secondary)" />
        </svg>
        {/* Center label — pointer-events: none so it never blocks SVG clicks */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', textAlign: 'center', padding: '10px',
        }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            {hoveredCategory || 'Total'}
          </span>
          <span style={{ fontSize: '1rem', fontWeight: 900, background: 'linear-gradient(90deg, var(--accent-primary), #ff66ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {hoveredCategory ? formatAmount(categoryTotals[hoveredCategory]) : formatAmount(totalAmount)}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {slices.map((slice, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.4rem 0.6rem', borderRadius: '8px', cursor: 'default',
              backgroundColor: hoveredCategory === slice.category ? 'rgba(255,255,255,0.07)' : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={() => setHoveredCategory(slice.category)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: slice.color, flexShrink: 0 }} />
              <span className="font-bold" style={{ fontSize: '0.85rem' }}>{slice.category}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="text-accent font-black" style={{ fontSize: '0.85rem', marginRight: '0.3rem' }}>{formatAmount(slice.value)}</span>
              <span className="panel-text" style={{ fontSize: '0.7rem' }}>({(slice.percentage * 100).toFixed(0)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main Group Detail Page ---
export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { formatAmount } = useSettings();

  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [actualDebts, setActualDebts] = useState<DebtRelation[]>([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState<DebtRelation[]>([]);
  const [activityLog, setActivityLog] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastStack, setToastStack] = useState<Toast[]>([]);

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'breakdown' | 'activity' | 'settings'>('expenses');

  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<{ [key: string]: string }>({});
  const [settlementDraft, setSettlementDraft] = useState({ fromUserId: '', toUserId: '', amount: '' });
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    if (groupId) fetchGroupData();
  }, [groupId]);

  const showToast = (message: string, type: Toast['type'] = 'success', onUndo?: () => void) => {
    const id = String(Math.random());
    setToastStack(prev => [...prev, { id, message, type, onUndo }]);
    setTimeout(() => setToastStack(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const fetchGroupData = async () => {
    setLoading(true);
    try {
      const res = await groupService.getById(groupId!);
      setGroupName(res.data.name);
      setMembers(res.data.members);
      setExpenses(res.data.expenses);
      setActivityLog(res.data.activityLog || []);
      await fetchBalances();
    } catch {
      showToast('Failed to load group data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = async () => {
    try {
      const bRes = await settlementService.getBalances(groupId!);
      setBalances(bRes.data.balances || []);
      setActualDebts(bRes.data.actualDebts || []);
      setSimplifiedDebts(bRes.data.simplifiedDebts || []);
    } catch { /* silent */ }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUsername.trim()) return;
    setSubmitting(true);
    try {
      await groupService.addMember(groupId!, newMemberUsername.trim());
      setNewMemberUsername('');
      showToast('Member added!', 'success');
      fetchGroupData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to add member', 'error');
    } finally { setSubmitting(false); }
  };

  const saveUserRename = async (memberId: string) => {
    if (!editingUsername.trim()) return;
    try {
      await authService.renameUser(memberId, editingUsername.trim());
      setEditingUserId(null);
      showToast('Username updated!', 'success');
      fetchGroupData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to rename', 'error');
    }
  };

  const deleteUserRecord = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Delete user "${memberName}"? This removes all their data.`)) return;
    try {
      await authService.deleteUser(memberId);
      showToast('User deleted', 'warning');
      if (currentUser?.userId === memberId) { localStorage.clear(); router.push('/'); }
      else fetchGroupData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const submitComment = async (expenseId: string) => {
    const content = commentDrafts[expenseId]?.trim();
    if (!content) return;
    const mockComment: Comment = {
      id: String(Math.random()), content,
      created_at: new Date().toISOString(),
      user_id: currentUser?.userId || '',
      username: currentUser?.username || 'Guest',
    };
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, comments: [...e.comments, mockComment] } : e));
    setCommentDrafts(prev => ({ ...prev, [expenseId]: '' }));
    try {
      await expenseService.addComment(expenseId, content);
      showToast('Comment posted', 'success');
      const res = await groupService.getById(groupId!);
      setExpenses(res.data.expenses);
      setActivityLog(res.data.activityLog || []);
    } catch {
      showToast('Failed to post comment', 'error');
      fetchGroupData();
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const target = expenses.find(e => e.id === expenseId);
    if (!target) return;
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
    try {
      const res = await expenseService.delete(expenseId);
      const deleted = res.data.deletedExpense;
      showToast(`Deleted "${target.description}"`, 'warning', () => handleUndoDelete(deleted));
      fetchBalances();
    } catch {
      fetchGroupData();
      showToast('Failed to delete expense', 'error');
    }
  };

  const handleUndoDelete = async (old: any) => {
    try {
      await expenseService.create(groupId!, old.description, old.amount, old.split_type, old.shares, old.category, old.notes);
      showToast('Expense restored!', 'success');
      fetchGroupData();
    } catch {
      showToast('Failed to restore expense', 'error');
    }
  };

  const handleQuickSettle = (debt: DebtRelation) => {
    setSettlementDraft({ fromUserId: debt.fromUser.id, toUserId: debt.toUser.id, amount: String(debt.amount) });
    setShowSettlementModal(true);
  };

  const submitSettlement = async () => {
    if (!settlementDraft.fromUserId || !settlementDraft.toUserId || !settlementDraft.amount) {
      showToast('Fill in all settlement fields', 'warning'); return;
    }
    setSubmitting(true);
    try {
      await settlementService.settle(groupId!, settlementDraft.fromUserId, settlementDraft.toUserId, Number(settlementDraft.amount));
      setShowSettlementModal(false);
      setSettlementDraft({ fromUserId: '', toUserId: '', amount: '' });
      showToast('Settlement recorded!', 'success');
      fetchGroupData();
    } catch {
      showToast('Failed to record settlement', 'error');
    } finally { setSubmitting(false); }
  };

  const exportCSV = (rows: string[][], filename: string) => {
    const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('CSV exported!', 'success');
  };

  const exportExpensesCSV = () => {
    if (!expenses.length) { showToast('No expenses to export', 'warning'); return; }
    exportCSV(
      [
        ['Description', 'Amount', 'Paid By', 'Category', 'Split Type', 'Date', 'Notes'],
        ...expenses.map(e => [
          `"${e.description}"`, String(e.amount),
          `"${e.paid_by_username || 'Unknown'}"`, `"${e.category || 'Other'}"`,
          e.split_type, new Date(e.created_at).toLocaleDateString(),
          `"${e.notes || ''}"`,
        ]),
      ],
      `${groupName}_expenses.csv`
    );
  };

  const exportBalancesCSV = () => {
    if (!balances.length) { showToast('No balances to export', 'warning'); return; }
    exportCSV(
      [
        ['User', 'Total Paid', 'Total Owed', 'Net Balance'],
        ...balances.map(b => [b.username, String(b.total_paid), String(b.total_owed), String(b.balance)]),
      ],
      `${groupName}_balances.csv`
    );
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const q = searchQuery.toLowerCase();
      if (q && !e.description.toLowerCase().includes(q) && !(e.paid_by_username || '').toLowerCase().includes(q)) return false;
      if (selectedCategory !== 'All' && e.category !== selectedCategory) return false;
      if (dateFilter !== 'All') {
        const d = new Date(e.created_at), now = new Date();
        if (dateFilter === 'Week') { const w = new Date(); w.setDate(now.getDate() - 7); if (d < w) return false; }
        if (dateFilter === 'Month') { const m = new Date(); m.setMonth(now.getMonth() - 1); if (d < m) return false; }
        if (dateFilter === 'Custom') {
          if (startDate && d < new Date(startDate)) return false;
          if (endDate) { const end = new Date(endDate); end.setHours(23,59,59); if (d > end) return false; }
        }
      }
      return true;
    });
  }, [expenses, searchQuery, selectedCategory, dateFilter, startDate, endDate]);

  const paginatedExpenses = useMemo(() => filteredExpenses.slice(0, currentPage * itemsPerPage), [filteredExpenses, currentPage]);

  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = { Food: 0, Transport: 0, Shopping: 0, Bills: 0, Entertainment: 0, Other: 0 };
    filteredExpenses.forEach(e => { acc[e.category || 'Other'] = (acc[e.category || 'Other'] || 0) + Number(e.amount); });
    return acc;
  }, [filteredExpenses]);

  const totalSpent = useMemo(() => Object.values(categoryTotals).reduce((s, v) => s + v, 0), [categoryTotals]);

  const myBalance = useMemo(() => {
    const me = balances.find(b => b.username === currentUser?.username);
    const activeDebts = simplifyDebts ? simplifiedDebts : actualDebts;
    let owe = 0, getBack = 0;
    activeDebts.forEach(d => {
      if (d.fromUser.username === currentUser?.username) owe += d.amount;
      if (d.toUser.username === currentUser?.username) getBack += d.amount;
    });
    return { balance: me?.balance || 0, owe, getBack };
  }, [balances, simplifiedDebts, actualDebts, simplifyDebts, currentUser]);

  const membersWithBalance = useMemo(() => {
    return members.map(member => {
      const balanceRow = balances.find(b => b.username === member.username);
      return {
        ...member,
        balance: balanceRow?.balance ?? 0,
        total_paid: balanceRow?.total_paid ?? 0,
        total_owed: balanceRow?.total_owed ?? 0,
      };
    });
  }, [members, balances]);

  const TABS: { key: typeof activeTab; label: string; icon: string }[] = [
    { key: 'expenses', label: 'Expenses', icon: '📑' },
    { key: 'balances', label: 'Balances', icon: '📊' },
    { key: 'breakdown', label: 'Breakdown', icon: '📈' },
    { key: 'activity', label: 'Activity', icon: '📝' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  if (loading) {
    return (
      <div className="page-shell">
        <AppHeader title="Group Details" subtitle="Loading..." showBack />
        <main className="page-main">
          <div className="grid-stats">
            <div className="skeleton h-32" />
            <div className="skeleton h-32" />
            <div className="skeleton h-32" />
          </div>
          <div className="skeleton h-64 mb-4 mt-6" />
        </main>
      </div>
    );
  }

  const activeDebts = simplifyDebts ? simplifiedDebts : actualDebts;

  return (
    <div className="page-shell" style={{ paddingBottom: '5rem' }}>
      <AppHeader title={groupName || 'Group Details'} subtitle="Shared expenses & settlements" showBack />

      <main className="page-main page-enter">

        {/* Toast Stack */}
        <div style={{ position: 'fixed', bottom: '5rem', right: '1.5rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '380px', width: 'calc(100% - 3rem)' }}>
          {toastStack.map(toast => (
            <div key={toast.id} className={`toast-card toast-${toast.type}`}>
              <span style={{ flex: 1 }}>{toast.message}</span>
              {toast.onUndo && (
                <button
                  type="button"
                  className="toast-undo-btn"
                  onClick={() => { toast.onUndo?.(); setToastStack(prev => prev.filter(t => t.id !== toast.id)); }}
                >
                  Undo ↩️
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Summary Cards */}
        <section className="grid-stats" style={{ marginBottom: '1.5rem' }}>
          <div className="panel balance-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
            <p className="panel-text">Current Balance</p>
            <p className="font-black" style={{ fontSize: '2.25rem', lineHeight: 1, color: myBalance.balance > 0.01 ? 'var(--accent-success)' : myBalance.balance < -0.01 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
              {myBalance.balance > 0.01 ? '+' : ''}{formatAmount(myBalance.balance)}
            </p>
            <p className="panel-text" style={{ marginTop: '0.65rem' }}>
              Your current owed position updates automatically when expenses or settlements change.
            </p>
          </div>
          <div className="panel" style={{ borderLeft: '4px solid var(--accent-danger)' }}>
            <p className="panel-text">You Owe</p>
            <p className="font-black" style={{ fontSize: '1.75rem', color: 'var(--accent-danger)' }}>{formatAmount(myBalance.owe)}</p>
          </div>
          <div className="panel" style={{ borderLeft: '4px solid var(--accent-success)' }}>
            <p className="panel-text">Owed to You</p>
            <p className="font-black" style={{ fontSize: '1.75rem', color: 'var(--accent-success)' }}>{formatAmount(myBalance.getBack)}</p>
          </div>
          <div className="panel" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
            <p className="panel-text">Members</p>
            <p className="font-black" style={{ fontSize: '1.75rem', color: 'var(--accent-primary)' }}>{members.length}</p>
          </div>
        </section>

        {/* Desktop Tab Navigation */}
        <div className="login-tabs" style={{ marginBottom: '1.5rem' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`login-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span style={{ marginRight: '0.35rem' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: EXPENSES ── */}
        {activeTab === 'expenses' && (
          <div className="fade-slide-in">
            <div className="panel" style={{ marginBottom: '1.5rem' }}>
              {/* Header row */}
              <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 className="panel-header" style={{ margin: 0 }}>Expenses</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={exportExpensesCSV} className="btn secondary-button" style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}>
                    Export CSV 📥
                  </button>
                  <button type="button" onClick={() => router.push(`/groups/${groupId}/add-expense`)} className="btn success-button" style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}>
                    + Add Expense
                  </button>
                </div>
              </div>

              {/* Filter Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="font-bold" style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', color: 'var(--text-muted)' }}>Search</label>
                  <input type="text" className="control" placeholder="Description or person..." value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
                </div>
                <div>
                  <label className="font-bold" style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', color: 'var(--text-muted)' }}>Category</label>
                  <select className="control" value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setCurrentPage(1); }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                    <option value="All">All Categories</option>
                    {['Food','Transport','Shopping','Bills','Entertainment','Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold" style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', color: 'var(--text-muted)' }}>Date Range</label>
                  <select className="control" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                    <option value="All">All Time</option>
                    <option value="Week">This Week</option>
                    <option value="Month">This Month</option>
                    <option value="Custom">Custom Range</option>
                  </select>
                </div>
                {dateFilter === 'Custom' && (
                  <>
                    <div>
                      <label className="font-bold" style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', color: 'var(--text-muted)' }}>Start Date</label>
                      <input type="date" className="control" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label className="font-bold" style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block', color: 'var(--text-muted)' }}>End Date</label>
                      <input type="date" className="control" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} />
                    </div>
                  </>
                )}
              </div>

              {/* Expenses list */}
              {paginatedExpenses.length === 0 ? (
                <p className="panel-text" style={{ textAlign: 'center', padding: '2rem' }}>No expenses match the current filters.</p>
              ) : (
                <div className="list-view">
                  {paginatedExpenses.map(expense => (
                    <div key={expense.id} className="panel" style={{ position: 'relative', margin: 0 }}>
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(expense.id)}
                        style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        🗑️ Delete
                      </button>

                      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem', paddingRight: '5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 className="font-bold" style={{ fontSize: '1rem', margin: 0 }}>{expense.description}</h3>
                            <span className="category-chip">{expense.category || 'Other'}</span>
                          </div>
                          <p className="panel-text" style={{ fontSize: '0.78rem' }}>
                            Paid by <strong style={{ color: 'var(--accent-primary)' }}>{expense.paid_by_username || 'Unknown'}</strong>
                            {' · '}{new Date(expense.created_at).toLocaleDateString()}
                          </p>
                          {expense.notes && (
                            <p style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '0.25rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>
                              📝 {expense.notes}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p className="text-accent font-black" style={{ fontSize: '1.4rem', margin: 0 }}>{formatAmount(expense.amount)}</p>
                          <p className="panel-text" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>Split: {expense.split_type}</p>
                        </div>
                      </div>

                      {/* Shares */}
                      {expense.shares && expense.shares.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                          <p className="panel-text" style={{ fontSize: '0.72rem', marginBottom: '0.4rem' }}>Split breakdown:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {expense.shares.map((s, i) => (
                              <span key={i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{s.username}: </span>
                                <strong style={{ color: 'var(--accent-primary)' }}>{formatAmount(s.amount)}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comments */}
                      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                        <p className="panel-text" style={{ fontSize: '0.72rem', marginBottom: '0.4rem' }}>
                          Comments ({expense.comments?.length || 0}):
                        </p>
                        {expense.comments && expense.comments.length > 0 && (
                          <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem' }}>
                            {expense.comments.map(c => (
                              <div key={c.id} style={{ marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                                <strong style={{ color: 'var(--accent-primary)' }}>{c.username}: </strong>
                                <span style={{ color: 'var(--text-secondary)' }}>{c.content}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
                                  {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            className="control"
                            value={commentDrafts[expense.id] || ''}
                            onChange={ev => setCommentDrafts(prev => ({ ...prev, [expense.id]: ev.target.value }))}
                            onKeyDown={ev => ev.key === 'Enter' && submitComment(expense.id)}
                            placeholder="Write a comment..."
                            style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                          />
                          <button type="button" onClick={() => submitComment(expense.id)} className="btn primary-button" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredExpenses.length > paginatedExpenses.length && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setCurrentPage(p => p + 1)} className="btn primary-button">
                    Load More ⬇️
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: BALANCES ── */}
        {activeTab === 'balances' && (
          <div className="fade-slide-in grid-cards">
            {/* Net Balances */}
            <div className="panel">
              <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 className="panel-header" style={{ margin: 0 }}>Net Balances</h2>
                <button type="button" onClick={exportBalancesCSV} className="btn secondary-button" style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}>
                  Export CSV 📥
                </button>
              </div>
              <div className="list-view">
                {balances.map(b => (
                  <div key={b.id} className="flex-between" style={{ padding: '0.5rem 0.25rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="font-bold">{b.username}</span>
                      {currentUser?.username === b.username && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(155,0,204,0.2)', color: 'var(--accent-primary)', borderRadius: '9999px', padding: '0.1rem 0.4rem', fontWeight: 700 }}>YOU</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="font-black" style={{ color: b.balance > 0.01 ? 'var(--accent-success)' : b.balance < -0.01 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                        {b.balance > 0.01 ? '+' : ''}{formatAmount(b.balance)}
                      </span>
                      <p className="panel-text" style={{ fontSize: '0.7rem' }}>
                        Paid: {formatAmount(b.total_paid)} · Owed: {formatAmount(b.total_owed)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Settlement */}
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1.25rem' }}>
                <h3 className="font-bold" style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Record Settlement</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <select className="control" value={settlementDraft.fromUserId} onChange={e => setSettlementDraft(p => ({ ...p, fromUserId: e.target.value }))} style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem' }}>
                    <option value="">Payer</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                  </select>
                  <select className="control" value={settlementDraft.toUserId} onChange={e => setSettlementDraft(p => ({ ...p, toUserId: e.target.value }))} style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem' }}>
                    <option value="">Recipient</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Amount" className="control" value={settlementDraft.amount}
                    onChange={e => setSettlementDraft(p => ({ ...p, amount: e.target.value }))} style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem' }} />
                </div>
                <button type="button" disabled={submitting} onClick={submitSettlement} className="btn primary-button w-full">
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </div>

            {/* Debts */}
            <div className="panel">
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <h2 className="panel-header" style={{ margin: 0 }}>Who Owes Who</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={simplifyDebts} onChange={e => setSimplifyDebts(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                  Simplify Debts
                </label>
              </div>
              <div className="list-view">
                {activeDebts.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--accent-success)', fontWeight: 700 }}>🎉 All settled up!</p>
                ) : (
                  activeDebts.map((debt, i) => (
                    <div key={i} className="flex-between panel" style={{ margin: 0, padding: '0.85rem 1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.88rem', margin: 0 }}>
                          <strong style={{ color: '#f87171' }}>{debt.fromUser.username}</strong>
                          <span style={{ color: 'var(--text-muted)', margin: '0 0.3rem' }}>owes</span>
                          <strong style={{ color: '#34d399' }}>{debt.toUser.username}</strong>
                        </p>
                        <p className="text-accent font-black" style={{ fontSize: '1.2rem', margin: '0.1rem 0 0' }}>{formatAmount(debt.amount)}</p>
                      </div>
                      <button type="button" onClick={() => handleQuickSettle(debt)} className="btn success-button" style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}>
                        Settle 💵
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: BREAKDOWN ── */}
        {activeTab === 'breakdown' && (
          <div className="panel fade-slide-in">
            <h2 className="panel-header">Spending by Category</h2>
            <DonutChart categoryTotals={categoryTotals} totalAmount={totalSpent} formatAmount={formatAmount} />
          </div>
        )}

        {/* ── TAB: ACTIVITY ── */}
        {activeTab === 'activity' && (
          <div className="panel fade-slide-in">
            <h2 className="panel-header">Activity Log</h2>
            {activityLog.length === 0 ? (
              <p className="panel-text" style={{ textAlign: 'center', padding: '2rem' }}>No activity recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {activityLog.map(log => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <p style={{ fontSize: '0.87rem', margin: 0, color: 'var(--text-primary)' }}>{log.action}</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {log.username || 'System'} · {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: SETTINGS ── */}
        {activeTab === 'settings' && (
          <div className="grid-cards fade-slide-in">
            {/* Members Management */}
            <div className="panel">
              <h2 className="panel-header">Manage Members</h2>
              <div className="member-table">
                <div className="member-table-row member-table-header">
                  <span>Member</span>
                  <span>Status</span>
                  <span>Balance</span>
                  <span>Actions</span>
                </div>
                {membersWithBalance.map(m => (
                  <div key={m.id} className="member-table-row">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="font-bold">{m.username}</span>
                        {currentUser?.userId === m.id && (
                          <span className="status-chip">YOU</span>
                        )}
                      </div>
                      <p className="panel-text" style={{ margin: '0.25rem 0 0' }}>
                        Paid {formatAmount(m.total_paid)} · Owed {formatAmount(m.total_owed)}
                      </p>
                    </div>
                    <span className="panel-text" style={{ fontWeight: 700, color: m.balance > 0.01 ? 'var(--accent-success)' : m.balance < -0.01 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                      {m.balance > 0.01 ? '+' : ''}{formatAmount(m.balance)}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {editingUserId === m.id ? (
                        <>
                          <input type="text" className="control" value={editingUsername} onChange={e => setEditingUsername(e.target.value)}
                            style={{ minWidth: '180px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
                          <button type="button" onClick={() => saveUserRename(m.id)} className="btn primary-button" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Save</button>
                          <button type="button" onClick={() => setEditingUserId(null)} className="btn secondary-button" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => { setEditingUserId(m.id); setEditingUsername(m.username); }}
                            className="btn secondary-button" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                            Rename
                          </button>
                          <button type="button" onClick={() => deleteUserRecord(m.id, m.username)}
                            className="btn secondary-button" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add member */}
            <div className="panel" style={{ alignSelf: 'flex-start' }}>
              <h2 className="panel-header">Add Member</h2>
              <form onSubmit={handleAddMember} className="flex-row">
                <input type="text" className="control" value={newMemberUsername} onChange={e => setNewMemberUsername(e.target.value)}
                  placeholder="Registered username..." style={{ flex: 1 }} />
                <button type="submit" disabled={submitting} className="btn primary-button">
                  {submitting ? 'Adding...' : 'Add'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-bottom-nav" style={{ display: 'flex' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`mobile-nav-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Settlement Confirm Modal */}
      {showSettlementModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 className="panel-header">Confirm Settlement</h3>
            <p className="panel-text" style={{ marginTop: '0.5rem' }}>
              Record payment of <strong>{formatAmount(settlementDraft.amount || 0)}</strong>?
            </p>
            <div className="flex-row" style={{ marginTop: '1.25rem' }}>
              <button type="button" onClick={() => setShowSettlementModal(false)} className="btn secondary-button w-full">Cancel</button>
              <button type="button" disabled={submitting} onClick={submitSettlement} className="btn primary-button w-full">
                {submitting ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
