'use client';

import { useState, useEffect } from 'react';
import { supabase, supabaseUrl, isSupabaseConfigured } from '@/lib/supabase';

export default function DiagnosePage() {
  const [results, setResults] = useState<any>({
    env: {
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : "(empty)",
      isSupabaseConfigured,
      browserType: typeof window !== "undefined" ? "Browser" : "Server",
    },
    clientFetch: 'Testing...',
    healthFetch: 'Testing...',
    dbQuery: 'Testing...',
  });

  useEffect(() => {
    async function runDiagnostics() {
      const newResults = { ...results };

      if (!supabaseUrl) {
        newResults.clientFetch = 'Skipped (No URL configured)';
        newResults.healthFetch = 'Skipped (No URL configured)';
        newResults.dbQuery = 'Skipped (No URL configured)';
        setResults(newResults);
        return;
      }

      // 1. Test fetch to Supabase URL directly from browser
      try {
        const res = await fetch(supabaseUrl);
        newResults.clientFetch = `Success (Status: ${res.status})`;
      } catch (err: any) {
        newResults.clientFetch = `Failed: ${err.message || err}`;
      }

      // 2. Test fetch to Supabase Auth Health URL directly from browser
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/health`);
        newResults.healthFetch = `Success (Status: ${res.status})`;
      } catch (err: any) {
        newResults.healthFetch = `Failed: ${err.message || err}`;
      }

      // 3. Test Supabase Client DB query
      try {
        const { data, error } = await supabase.from('dcmms_profiles').select('id').limit(1);
        if (error) {
          newResults.dbQuery = `Error: ${error.message} (${error.code})`;
        } else {
          newResults.dbQuery = `Success (Data count: ${data?.length})`;
        }
      } catch (err: any) {
        newResults.dbQuery = `Failed: ${err.message || err}`;
      }

      setResults(newResults);
    }

    runDiagnostics();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', color: '#000', backgroundColor: '#fff', minHeight: '100vh' }}>
      <h1>Supabase Client-Side Diagnostics</h1>
      <h2>Environment Variables</h2>
      <pre>{JSON.stringify(results.env, null, 2)}</pre>
      
      <h2>Diagnostic Results</h2>
      <ul>
        <li><strong>Direct URL Fetch:</strong> {results.clientFetch}</li>
        <li><strong>Auth Health Fetch:</strong> {results.healthFetch}</li>
        <li><strong>Supabase DB Query:</strong> {results.dbQuery}</li>
      </ul>
      <p style={{ marginTop: '20px' }}>
        <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>Back to Login</a>
      </p>
    </div>
  );
}
