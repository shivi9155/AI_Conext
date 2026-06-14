'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { expenseService, groupService, settlementService } from '../../../services/api';
import { AppHeader } from '../../../components/AppHeader';
import { useSettings } from '../../../contexts/SettingsContext';

interface Member {
  id: string;
  username: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
}

interface Balance {
  id: string;
  username: string;
  balance: number;
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [balancesError, setBalancesError] = useState('');
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<{ [key: string]: string }>({});
  const [settlementDraft, setSettlementDraft] = useState({ fromUserId: '', toUserId: '', amount: '' });
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { formatAmount, viewMode, requireSettlementConfirmation } = useSettings();

  useEffect(() => {
    if (groupId) {
      fetchGroupData();
    }
  }, [groupId]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };

  const fetchGroupData = async () => {
    try {
      const groupResponse = await groupService.getById(groupId!);
      setMembers(groupResponse.data.members);
      setExpenses(groupResponse.data.expenses);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load group data');
      setLoading(false);
      return;
    }

    try {
      const balancesResponse = await settlementService.getBalances(groupId!);
      setBalances(balancesResponse.data);
      setBalancesError('');
    } catch (err: any) {
      setBalancesError(err.response?.data?.error || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUsername.trim()) return;

    try {
      await groupService.addMember(groupId!, newMemberUsername);
      setNewMemberUsername('');
      fetchGroupData();
      showToast('Member added');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const submitComment = async (expenseId: string) => {
    const content = commentDrafts[expenseId]?.trim();
    if (!content) return;

    try {
      await expenseService.addComment(expenseId, content);
      setCommentDrafts({ ...commentDrafts, [expenseId]: '' });
      showToast('Comment added');
    } catch (err: any) {
      setError('Failed to add comment');
    }
  };

  const submitSettlement = async () => {
    if (!settlementDraft.fromUserId || !settlementDraft.toUserId || !settlementDraft.amount) {
      setError('Choose who paid, who received, and an amount');
      return;
    }

    try {
      await settlementService.settle(
        groupId!,
        settlementDraft.fromUserId,
        settlementDraft.toUserId,
        Number(settlementDraft.amount)
      );
      setShowSettlementModal(false);
      setSettlementDraft({ fromUserId: '', toUserId: '', amount: '' });
      showToast('Settlement recorded');
      fetchGroupData();
    } catch (err: any) {
      setError('Failed to record settlement');
    }
  };

  const handleSettlementClick = () => {
    if (requireSettlementConfirmation) {
      setShowSettlementModal(true);
    } else {
      submitSettlement();
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <AppHeader title="Group Details" subtitle="Loading balances" showBack />
        <main className="page-main">
          <div className="grid-cards">
            <div className="skeleton h-56" />
            <div className="skeleton h-56" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <AppHeader title="Group Details" subtitle="Members, expenses, and settlements" showBack showViewToggle />

      <main className="page-main page-enter">
        <div className="grid-cards">
          <div>
            <section className="panel mb-6">
              <h2 className="panel-header">Members</h2>
              <ul className="list-view">
                {members.map((member) => (
                  <li key={member.id} className="panel-text padding-1">
                    {member.username}
                  </li>
                ))}
              </ul>
              <form onSubmit={handleAddMember} className="flex-row mt-4">
                <input
                  type="text"
                  value={newMemberUsername}
                  onChange={(e) => setNewMemberUsername(e.target.value)}
                  placeholder="Add member by username..."
                  className="control flex-1 text-sm"
                />
                <button type="submit" className="btn primary-button">
                  Add
                </button>
              </form>
            </section>

            <section className="panel">
              <h2 className="panel-header">Balances</h2>
              {balancesError ? (
                <p className="text-red-400">{balancesError}</p>
              ) : (
                <div className="list-view">
                  {balances.map((balance) => (
                    <div key={balance.id} className="flex-between">
                      <span className="font-bold">{balance.username}</span>
                      <span className="font-bold">
                        {formatAmount(balance.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div>
            <section className="panel mb-6">
              <div className="flex-between mb-4">
                <h2 className="panel-header">Recent Expenses</h2>
                <button type="button" onClick={() => router.push(`/groups/${groupId}/add-expense`)} className="btn success-button">
                  Add Expense
                </button>
              </div>
              {expenses.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No expenses yet</p>
              ) : (
                <ul className={viewMode === 'card' ? 'grid-cards' : 'list-view'}>
                  {expenses.slice(0, 6).map((expense) => (
                    <li key={expense.id} className="panel">
                      <div className="flex-between">
                        <div>
                          <p className="font-bold">{expense.description}</p>
                          <p className="header-subtitle">Shared expense</p>
                        </div>
                        <p className="font-black text-accent text-xl">{formatAmount(expense.amount)}</p>
                      </div>
                      <div className="flex-row mt-4">
                        <input
                          value={commentDrafts[expense.id] || ''}
                          onChange={(event) => setCommentDrafts({ ...commentDrafts, [expense.id]: event.target.value })}
                          placeholder="Add comment..."
                          className="control min-w-0 flex-1 py-2 text-sm"
                        />
                        <button type="button" onClick={() => submitComment(expense.id)} className="secondary-button px-3">
                          Send
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h2 className="panel-header">Record Settlement</h2>
              <div className="flex-row">
                <select
                  value={settlementDraft.fromUserId}
                  onChange={(event) => setSettlementDraft({ ...settlementDraft, fromUserId: event.target.value })}
                  className="control"
                >
                  <option value="">From</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.username}
                    </option>
                  ))}
                </select>
                <select
                  value={settlementDraft.toUserId}
                  onChange={(event) => setSettlementDraft({ ...settlementDraft, toUserId: event.target.value })}
                  className="control"
                >
                  <option value="">To</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.username}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={settlementDraft.amount}
                  onChange={(event) => setSettlementDraft({ ...settlementDraft, amount: event.target.value })}
                  placeholder="Amount"
                  className="control"
                />
              </div>
              <button type="button" onClick={handleSettlementClick} className="btn primary-button mt-4 w-full">
                Settle Up
              </button>
            </section>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}
      </main>

      {showSettlementModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 className="panel-header">Confirm Settlement</h3>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              Record this payment for {formatAmount(settlementDraft.amount || 0)}?
            </p>
            <div className="flex-row mt-4">
              <button type="button" className="btn secondary-button w-full" onClick={() => setShowSettlementModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn primary-button w-full" onClick={submitSettlement}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};
