"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2, LogIn, UserPlus } from 'lucide-react';

type Mode = 'login' | 'register';

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Could not create account.');
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(
          mode === 'login'
            ? 'Invalid email or password.'
            : 'Account created, but sign-in failed. Try logging in.'
        );
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-logo">Judy</h1>
      <p className="auth-tagline">Be gay while away</p>

      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => { setMode('login'); setError(''); }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => { setMode('register'); setError(''); }}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {mode === 'register' && (
          <div className="auth-field">
            <label htmlFor="auth-name">Name</label>
            <input
              id="auth-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              autoComplete="name"
            />
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
          {mode === 'register' && (
            <span className="auth-hint">At least 8 characters.</span>
          )}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? (
            <Loader2 size={16} className="spinner" />
          ) : mode === 'login' ? (
            <LogIn size={16} />
          ) : (
            <UserPlus size={16} />
          )}
          {busy ? 'Working…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
