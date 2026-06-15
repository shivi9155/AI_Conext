'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { groupService, importService } from '../../services/api';

export default function ImportExpensesPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      }
    } catch (err: any) {
      setError('Unable to load groups');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setReport(null);
    if (!groupId) {
      setError('Please choose a group');
      return;
    }
    if (!csvText.trim()) {
      setError('Please paste or upload CSV content');
      return;
    }

    setLoading(true);
    try {
      const response = await importService.uploadCsv(groupId, csvText);
      setReport(response.data.report);
      router.push(`/import-report?groupId=${encodeURIComponent(groupId)}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  return (
    <div className="page-shell">
      <AppHeader title="Import Expenses" subtitle="Upload a CSV file to import expense records" showViewToggle />
      <main className="page-main page-enter">
        <section className="panel mb-6">
          <h2 className="panel-header">Import CSV</h2>
          <form onSubmit={handleSubmit} className="flex-col" style={{ gap: '1rem' }}>
            <div className="flex-row" style={{ gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="font-bold">Select Group</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="control">
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold">Upload CSV</label>
              <input type="file" accept=".csv" onChange={handleFileChange} className="control" />
            </div>
            <div>
              <label className="font-bold">Or paste CSV text</label>
              <textarea
                className="control h-48"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="date,description,paid_by,amount,currency,split_type,split_with,split_details,notes"
              />
            </div>
            {error && <div className="error-banner">{error}</div>}
            <button type="submit" className="btn primary-button" disabled={loading}>
              {loading ? 'Importing…' : 'Import CSV'}
            </button>
          </form>
        </section>
        {report && (
          <section className="panel">
            <h2 className="panel-header">Import Completed</h2>
            <p className="panel-text">Rows: {report.totalRows}, Imported: {report.importedRows}, Skipped: {report.skippedRows}</p>
          </section>
        )}
      </main>
    </div>
  );
}
