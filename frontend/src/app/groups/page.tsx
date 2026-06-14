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
  const [newGroupMember, setNewGroupMember] = useState('');
  const [createdGroupId, setCreatedGroupId] = useState('');
  const [createdGroupName, setCreatedGroupName] = useState('');
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
    setError('');
    if (!newGroupName.trim()) return;

    try {
      const response = await groupService.create(newGroupName.trim());
      setGroups([...groups, response.data]);
      setNewGroupName('');
      setCreatedGroupId(response.data.id);
      setCreatedGroupName(response.data.name);
      setNewGroupMember('');
      setToast('Group created. Add members next.');
      window.setTimeout(() => setToast(''), 2200);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdGroupId || !newGroupMember.trim()) return;
    try {
      await groupService.addMember(createdGroupId, newGroupMember.trim());
      setNewGroupMember('');
      setToast('Member added successfully');
      window.setTimeout(() => setToast(''), 2200);
    } catch (err: any) {
      setToast(err.response?.data?.error || 'Failed to add member');
      window.setTimeout(() => setToast(''), 2200);
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
          <form onSubmit={handleCreateGroup} className="flex-col w-full" style={{ gap: '0.9rem' }}>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="control w-full"
            />
            <div className="flex-row" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn primary-button"
              >
                Create Group
              </button>
              <span className="panel-text" style={{ alignSelf: 'center', fontSize: '0.95rem' }}>
                Create the group first, then add members like Splitwise.
              </span>
            </div>
          </form>
          {error && <p className="error-banner">{error}</p>}
        </section>

        {createdGroupId && (
          <section className="panel mb-8">
            <h2 className="panel-header">Add Member to "{createdGroupName}"</h2>
            <form onSubmit={handleAddMemberToGroup} className="flex-col w-full" style={{ gap: '0.85rem' }}>
              <input
                type="text"
                value={newGroupMember}
                onChange={(e) => setNewGroupMember(e.target.value)}
                placeholder="Enter member username"
                className="control w-full"
              />
              <div className="flex-row" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn primary-button">Add Member</button>
                <button type="button" className="btn secondary-button" onClick={() => { setCreatedGroupId(''); setCreatedGroupName(''); setNewGroupMember(''); }}>
                  Done
                </button>
              </div>
              <p className="panel-text" style={{ margin: 0 }}>
                You can add members now or return to the group list and update later.
              </p>
            </form>
          </section>
        )}

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
