import React, { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function SignUpPage() {
  const { login, isSignedIn } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isSignedIn) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #1c1117, #0f0a0d 60%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%',
        width: '50vw', height: '50vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(244, 114, 182, 0.12) 0%, rgba(244, 114, 182, 0) 70%)',
        filter: 'blur(40px)', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%',
        width: '50vw', height: '50vw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251, 113, 133, 0.1) 0%, rgba(251, 113, 133, 0) 70%)',
        filter: 'blur(40px)', zIndex: 0
      }} />

      <div style={{ zIndex: 1, width: '100%', maxWidth: '440px' }} className="animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'var(--primary-gradient)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '1.5rem', color: '#fff',
            marginBottom: '16px', boxShadow: '0 4px 20px rgba(244, 114, 182, 0.35)'
          }}>
            Ω
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#fff' }}>Create Account</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Sign up to access your Odoo HR portal</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '32px' }}>
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
              background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)',
              color: '#fda4af', fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="form-input"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)',
                color: '#fff', fontSize: '0.95rem', outline: 'none',
                transition: 'border-color 0.2s'
              }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)',
                color: '#fff', fontSize: '0.95rem', outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', fontSize: '1rem', fontWeight: '600',
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              justifyContent: 'center'
            }}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/sign-in" style={{ color: 'var(--primary)', fontWeight: '500' }}>Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
