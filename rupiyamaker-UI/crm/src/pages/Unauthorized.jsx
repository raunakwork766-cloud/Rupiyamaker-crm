import React from 'react';

const Unauthorized = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000000',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px 32px',
        background: '#0a0a0a',
        border: '1px solid #1a1a1a',
        borderRadius: '12px',
        maxWidth: '380px',
        width: '100%',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#111',
          border: '2px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <p style={{ color: '#999', fontSize: '0.95rem', margin: 0, lineHeight: 1.6 }}>
          You don't have permission to access any page.
          <br />
          <span style={{ color: '#555', fontSize: '0.85rem' }}>Contact your administrator.</span>
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;
