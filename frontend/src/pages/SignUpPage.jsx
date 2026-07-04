import React from 'react';
import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #0e0d16, #08080c 60%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Blur Orbs */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0) 70%)',
        filter: 'blur(40px)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '50vw',
        height: '50vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0) 70%)',
        filter: 'blur(40px)',
        zIndex: 0
      }} />

      <div style={{ zIndex: 1, width: '100%', maxWidth: '440px' }} className="animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--primary-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.5rem',
            color: '#fff',
            marginBottom: '16px',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)'
          }}>
            Ω
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#fff' }}>Create Account</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Sign up to request access to the portal</p>
        </div>

        <SignUp 
          signInUrl="/sign-in" 
          redirectUrl="/"
          appearance={{
            elements: {
              card: 'cl-card',
              headerTitle: 'cl-headerTitle',
              headerSubtitle: 'cl-headerSubtitle',
              formLabelTrue: 'cl-formLabelTrue',
              formButtonPrimary: 'cl-formButtonPrimary',
              formInputSimple: 'cl-formInputSimple',
              footerActionLink: 'cl-footerActionLink',
            }
          }}
        />
      </div>
    </div>
  );
}
