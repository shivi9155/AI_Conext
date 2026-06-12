'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { groupService, expenseService } from '../../../../services/api';
import { AppHeader } from '../../../../components/AppHeader';
import { useSettings } from '../../../../contexts/SettingsContext';

interface Member {
  id: string;
  username: string;
}

type SplitType = 'equal' | 'unequal' | 'shares';

export default function AddExpensePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [shares, setShares] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { formatAmount } = useSettings();

  useEffect(() => {
    if (groupId) {
      fetchMembers();
    }
  }, [groupId]);

  const fetchMembers = async () => {
    try {
      const response = await groupService.getById(groupId!);
      setMembers(response.data.members);
      const initialShares: { [key: string]: number } = {};
      response.data.members.forEach((member: Member) => {
        initialShares[member.id] = 1;
      });
      setShares(initialShares);
    } catch (err: any) {
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const numericAmount = Number(amount || 0);

  const derivedShares = useMemo(() => {
    if (!members.length) return [];

    if (splitType === 'equal') {
      const perPerson = numericAmount / members.length;
      return members.map((member) => ({ userId: member.id, amount: perPerson }));
    }

    if (splitType === 'shares') {
      const totalShares = Object.values(shares).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
      return members.map((member) => ({
        userId: member.id,
        amount: (numericAmount * Number(shares[member.id] || 0)) / totalShares,
      }));
    }

    return members.map((member) => ({ userId: member.id, amount: Number(shares[member.id] || 0) }));
  }, [members, numericAmount, shares, splitType]);

  const splitTotal = derivedShares.reduce((sum, share) => sum + share.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) {
      setError('Please fill in all fields');
      return;
    }

    if (splitType === 'unequal' && Math.abs(splitTotal - numericAmount) > 0.01) {
      setError('Unequal split amounts must match the expense total');
      return;
    }

    try {
      await expenseService.create(groupId!, description, numericAmount, splitType, derivedShares);
      router.push(`/groups/${groupId}`);
    } catch (err: any) {
      setError('Failed to create expense');
    }
  };

  const handleSplitChange = (value: SplitType) => {
    setSplitType(value);
    const nextShares: { [key: string]: number } = {};
    members.forEach((member) => {
      nextShares[member.id] = value === 'unequal' ? 0 : 1;
    });
    setShares(nextShares);
    setError('');
  };

  if (loading) {
    return (
      <div className="page-shell">
        <AppHeader title="Add Expense" subtitle="Loading members" showBack />
        <main className="page-main max-w-3xl">
          <div className="skeleton h-96" />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <AppHeader title="Add Expense" subtitle="Choose how the bill should be split" showBack />

      <main className="page-main page-enter max-w-3xl">
        <section className="panel">
          <form onSubmit={handleSubmit} className="flex-col">
            <div>
              <label className="font-bold mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dinner at restaurant"
                className="control w-full"
              />
            </div>

            <div>
              <label className="font-bold mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="control w-full"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Split Type</label>
              <div className="login-tabs">
                {(['equal', 'unequal', 'shares'] as SplitType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSplitChange(type)}
                    className={`login-tab ${splitType === type ? 'active' : ''}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div >
              <div className="flex-between mb-4">
                <label className="font-bold">
                  {splitType === 'shares' ? 'Share Units' : splitType === 'unequal' ? 'Custom Amounts' : 'Equal Preview'}
                </label>
                <span className="font-bold text-accent">{formatAmount(splitTotal)}</span>
              </div>
              <div className="list-view">
                {members.map((member) => {
                  const calculated = derivedShares.find((share) => share.userId === member.id)?.amount || 0;
                  return (
                    <div key={member.id} className="flex-between">
                      <div>
                        <p className="font-bold">{member.username}</p>
                        <p className="header-subtitle">{formatAmount(calculated)}</p>
                      </div>
                      <input
                        type="number"
                        step={splitType === 'shares' ? '1' : '0.01'}
                        min="0"
                        value={splitType === 'equal' ? calculated.toFixed(2) : shares[member.id] || 0}
                        disabled={splitType === 'equal'}
                        onChange={(e) => setShares({ ...shares, [member.id]: Number(e.target.value) || 0 })}
                        className="control w-full disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="error-banner">
                {error}
              </div>
            )}

            <div className="flex-row mt-4">
              <button type="submit" className="btn primary-button w-full">
                Create Expense
              </button>
              <button type="button" onClick={() => router.push(`/groups/${groupId}`)} className="btn secondary-button w-full">
                Cancel
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};
