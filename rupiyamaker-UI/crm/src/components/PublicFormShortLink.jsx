import React, { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";

const API_BASE_URL = '/api';

/**
 * Resolves a short form link code (e.g. /f/xK9mP2) and transparently
 * redirects to the public login form.  The shared URL stays clean:
 *   https://rupiyamaker.com/f/xK9mP2
 */
export default function PublicFormShortLink() {
  const { code } = useParams();
  const [resolved, setResolved] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) { setNotFound(true); return; }
    fetch(`${API_BASE_URL}/share-links/resolve-form/${code}`)
      .then(r => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(data => setResolved(data))
      .catch(() => setNotFound(true));
  }, [code]);

  if (notFound) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0b1220', color: '#f87171',
        flexDirection: 'column', gap: 12, fontFamily: 'sans-serif'
      }}>
        <div style={{ fontSize: 48 }}>🔗</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Link not found</div>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>This link may have expired or is invalid.</div>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0b1220', color: '#fff',
        flexDirection: 'column', gap: 16, fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #3b82f6',
          borderTop: '3px solid transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading form…</div>
      </div>
    );
  }

  const { lead_id, form_type, mobile } = resolved;
  const restrictTo = form_type === 'coApplicant' ? 'coApplicant' : 'applicant';
  const coParam  = form_type === 'coApplicant' ? '&coApplicant=true' : '';
  const target = `/public/login-form/${mobile || 'guest'}?leadId=${lead_id}&restrictTo=${restrictTo}${coParam}`;

  return <Navigate to={target} replace />;
}
