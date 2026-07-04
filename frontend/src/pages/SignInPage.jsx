import React, { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function SignInPage() {
  const { login, isSignedIn } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already signed in
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
      setError(err.message || 'Login failed');
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
      background: '#ffffff',
      padding: '20px',
      position: 'relative'
    }}>
      <div style={{ zIndex: 1, width: '100%', maxWidth: '440px' }} className="animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '8px',
            background: '#000000', border: '1px solid #000000',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '1.5rem', color: '#ffffff',
            marginBottom: '16px', boxShadow: '2px 2px 0px 0px #000000'
          }}>
            Ω
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#000000' }}>Welcome Back</h2>
          <p style={{ color: '#404040', marginTop: '8px' }}>Log in to access your Odoo HR portal</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '32px', background: '#ffffff', border: '2px solid #000000', boxShadow: '4px 4px 0px 0px #000000' }}>
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
              background: '#ffffff', border: '1px solid #000000',
              color: '#000000', fontSize: '0.875rem', fontWeight: '600'
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', color: '#000000' }}>
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
                background: '#ffffff', border: '1px solid #000000',
                color: '#000000', fontSize: '0.95rem', outline: 'none'
              }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', color: '#000000' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                background: '#ffffff', border: '1px solid #000000',
                color: '#000000', fontSize: '0.95rem', outline: 'none'
              }}
            />
          </div>

          <button
            type="button"
            onClick={async () => {
              await login('soumyajit.roy@gmail.com');
              navigate('/');
            }}
            className="btn btn-secondary"
            style={{
              width: '100%', padding: '12px', fontSize: '0.9rem', fontWeight: '700',
              cursor: 'pointer', justifyContent: 'center', marginBottom: '12px',
              background: '#ffffff', border: '1px solid #000000', color: '#000000',
              boxShadow: '2px 2px 0px 0px #000000'
            }}
          >
            ⚡ Log in as Soumyajit Roy (HR Manager)
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', fontSize: '1rem', fontWeight: '700',
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              justifyContent: 'center', background: '#000000', color: '#ffffff',
              border: '1px solid #000000', boxShadow: '2px 2px 0px 0px #000000'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.875rem', color: '#404040' }}>
            Don't have an account?{' '}
            <Link to="/sign-up" style={{ color: '#000000', fontWeight: '700', textDecoration: 'underline' }}>Sign Up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
