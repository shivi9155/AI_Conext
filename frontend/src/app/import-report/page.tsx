'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { importService, groupService } from '../../services/api';

export default function ImportReportPage() {
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    fetchGroups();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const paramGroupId = searchParams.get('groupId') || '';
      if (paramGroupId) setGroupId(paramGroupId);
    }
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchHistory(groupId);
    }
  }, [groupId]);

  const fetchGroups = async () => {
    try {
      const response = await groupService.getAll();
      setGroups(response.data);
      if (response.data.length > 0 && !groupId) {
        setGroupId(response.data[0].id);
      }
    } catch (err: any) {
      setError('Unable to load groups');
    }
  };

  const fetchHistory = async (groupIdValue: string) => {
    try {
      const response = await importService.getHistory(groupIdValue);
      setHistory(response.data.history || []);
      if (response.data.history?.length > 0) {
        setSelectedImportId(response.data.history[0].id);
      }
    } catch (err: any) {
      setError('Unable to load import history');
    }
  };

  const selectedImport = useMemo(() => {
    return history.find((item) => item.id === selectedImportId) || history[0] || null;
  }, [history, selectedImportId]);

  return (
    <div className="page-shell">
      <AppHeader title="Import Report" subtitle="Review import results and validation details" showViewToggle />
      <main className="page-main page-enter">
        <section className="panel mb-6">
          <h2 className="panel-header">Import report</h2>
          {error && <div className="error-banner">{error}</div>}
          <p className="panel-text">Review imported rows, skipped entries, duplicates, and settlement detection.</p>
          <div className="flex-row" style={{ gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="font-bold">Select Group</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="control">
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="panel mb-6">
          <h3 className="panel-header">Imported batches</h3>
          {history.length === 0 ? (
            <p className="panel-text">No import history available yet.</p>
          ) : (
            <div className="list-panel">
              {history.map((item) => (
                <button
                  key={item.id}
                  className={`list-item ${selectedImportId === item.id ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedImportId(item.id)}
                >
                  <div>
                    <strong>{new Date(item.imported_at).toLocaleString()}</strong>
                    <p className="panel-text">Rows: {item.total_rows}, Imported: {item.imported_rows}, Skipped: {item.skipped_rows}</p>
                  </div>
                  <span>{item.imported_by_username || 'Unknown'}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedImport && (
          <section className="panel">
            <h3 className="panel-header">Batch details</h3>
            <div className="panel-text" style={{ marginBottom: '1rem' }}>
              <p><strong>Imported at:</strong> {new Date(selectedImport.imported_at).toLocaleString()}</p>
              <p><strong>Imported by:</strong> {selectedImport.imported_by_username || 'Unknown'}</p>
              <p><strong>Total rows:</strong> {selectedImport.total_rows}</p>
              <p><strong>Imported:</strong> {selectedImport.imported_rows}</p>
              <p><strong>Skipped:</strong> {selectedImport.skipped_rows}</p>
              <p><strong>Duplicates:</strong> {selectedImport.duplicates}</p>
              <p><strong>Settlements:</strong> {selectedImport.settlement_rows}</p>
            </div>
            <div className="panel-text" style={{ marginBottom: '1rem' }}>
              <strong>Validation errors:</strong>
              {selectedImport.validation_errors?.length ? (
                <ul>
                  {selectedImport.validation_errors.map((errorItem: any, index: number) => (
                    <li key={index}>{`Row ${errorItem.rowNumber}${errorItem.field ? ` (${errorItem.field})` : ''}: ${errorItem.message}`}</li>
                  ))}
                </ul>
              ) : (
                <p>No validation errors.</p>
              )}
            </div>
            <div className="panel-text" style={{ marginBottom: '1rem' }}>
              <strong>Alias corrections:</strong>
              {selectedImport.report?.aliasCorrections?.length ? (
                <ul>
                  {selectedImport.report.aliasCorrections.map((alias: any, index: number) => (
                    <li key={index}>{`${alias.original} → ${alias.resolved}`}</li>
                  ))}
                </ul>
              ) : (
                <p>No alias corrections.</p>
              )}
            </div>
            <div className="panel-text">
              <strong>Row details:</strong>
              {selectedImport.report?.rows?.length ? (
                <div className="list-panel">
                  {selectedImport.report.rows.map((row: any) => (
                    <div key={row.rowNumber} className="list-item">
                      <div>
                        <strong>Row {row.rowNumber}</strong> - <span>{row.status}</span>
                        <p className="panel-text">{row.description}</p>
                        {row.messages?.length > 0 && (
                          <ul>
                            {row.messages.map((message: string, index: number) => (
                              <li key={index}>{message}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No row-level details available.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
