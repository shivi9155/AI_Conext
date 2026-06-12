'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { groupService } from '../../services/api';
import { AppHeader } from '../../components/AppHeader';
import { useSettings } from '../../contexts/SettingsContext';

interface Group {
  id: string;
  name: string;
}

export default function GroupListPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { viewMode } = useSettings();

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
    } catch (err: any) {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const response = await groupService.create(newGroupName);
      setGroups([...groups, response.data]);
      setNewGroupName('');
      setToast('Group created');
      window.setTimeout(() => setToast(''), 2200);
    } catch (err: any) {
      setError('Failed to create group');
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <AppHeader title="FairShare Lite" subtitle="Loading your groups" />
        <main className="page-main">
          <div className="grid-stats">
            <div className="skeleton h-32" />
            <div className="skeleton h-32" />
            <div className="skeleton h-32" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <AppHeader title="FairShare Lite" subtitle="Groups, balances, and shared costs" showViewToggle />

      <main className="page-main page-enter">
        <section className="grid-stats">
          <div className="panel">
            <p className="panel-text">Active groups</p>
            <p className="text-4xl font-black">{groups.length}</p>
          </div>
          <div className="panel">
            <p className="panel-text">Preferred layout</p>
            <p className="text-3xl font-black text-accent capitalize">{viewMode}</p>
          </div>
          <div className="panel">
            <p className="panel-text">Status</p>
            <p className="text-3xl font-black text-success">Ready</p>
          </div>
        </section>

        <section className="panel mb-8">
          <h2 className="panel-header">Create New Group</h2>
          <form onSubmit={handleCreateGroup} className="flex-row w-full">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="control w-full"
            />
            <button
              type="submit"
              className="btn primary-button"
            >
              Create
            </button>
          </form>
          {error && <p className="error-banner">{error}</p>}
        </section>

        <section>
          <div className="flex-between mb-4">
            <h2 className="panel-header">Your Groups</h2>
            <span className="panel-text">{viewMode === 'card' ? 'Card view' : 'List view'}</span>
          </div>
          {groups.length === 0 ? (
            <div className="panel text-center panel-text">No groups yet. Create one to get started.</div>
          ) : (
            <div className={viewMode === 'card' ? 'grid-cards' : 'list-view'}>
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className={`panel cursor-pointer ${viewMode === 'list' ? 'flex-between' : ''}`}
                >
                  <div>
                    <h3 className="text-xl font-bold text-accent mb-2">{group.name}</h3>
                    <p className="panel-text">Open details and balances</p>
                  </div>
                  <span className="icon-button">
                    &gt;
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};
