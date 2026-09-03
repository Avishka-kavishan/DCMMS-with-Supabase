'use client';

import { useState, useEffect } from 'react';
import { checkDatabaseConnection } from '@/lib/db-actions';

export default function DiagnosePage() {
  const [results, setResults] = useState<any>({
    status: 'Checking PostgreSQL Connection...',
    connected: false,
    error: null,
    mode: 'Local PostgreSQL via Prisma (Pure Offline / Intranet)',
    timestamp: new Date().toISOString(),
  });

  useEffect(() => {
    async function runDiagnostics() {
      try {
        const res = await checkDatabaseConnection();
        setResults({
          status: res.connected ? 'Connected to PostgreSQL successfully' : 'Connection failed',
          connected: res.connected,
          error: res.error || null,
          mode: 'Local PostgreSQL via Prisma (Pure Offline / Intranet)',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        setResults({
          status: 'Connection error',
          connected: false,
          error: err.message || String(err),
          mode: 'Local PostgreSQL via Prisma (Pure Offline / Intranet)',
          timestamp: new Date().toISOString(),
        });
      }
    }

    runDiagnostics();
  }, []);

  return (
    <div style={{ padding: '30px', fontFamily: 'monospace', color: '#1e293b', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ color: '#0f172a', borderBottom: '2px solid #cbd5e1', paddingBottom: '10px' }}>
        DCMMS PostgreSQL Database Diagnostics
      </h1>
      
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2>System Database Status</h2>
        <p><strong>Database Engine:</strong> {results.mode}</p>
        <p><strong>Status:</strong> <span style={{ color: results.connected ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>{results.status}</span></p>
        {results.error && (
          <p style={{ color: '#dc2626' }}><strong>Error Details:</strong> {results.error}</p>
        )}
        <p><strong>Checked At:</strong> {results.timestamp}</p>
      </div>

      <p style={{ marginTop: '20px' }}>
        <a href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>Back to Login</a>
      </p>
    </div>
  );
}
