import React, { useEffect, useState } from 'react';
import { Lock, Shield } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { AdminUser } from '../types';

export function AdminLoginPage() {
  const { navigate, showToast, setPageMeta } = useStore();
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageMeta('Administrator Sign In — DIAMOND STORE');
    const existing = sessionStorage.getItem('dmnd_admin_token');
    if (existing) {
      apiFetch('/api/admin/me', { adminToken: existing })
        .then(() => navigate('/admin'))
        .catch(() => sessionStorage.removeItem('dmnd_admin_token'));
    }
  }, [navigate, setPageMeta]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; admin: AdminUser }>(
        '/api/admin/login',
        {
          method: 'POST',
          body: JSON.stringify({ identifier, password }),
        }
      );
      sessionStorage.setItem('dmnd_admin_token', res.token);
      showToast(`Signed in as ${res.admin.fullName}`);
      navigate('/admin');
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Invalid administrator credentials.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      showToast(res.message);
      setMode('reset');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Request failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      showToast(res.message);
      setMode('login');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Reset failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex flex-col justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 border border-[#D4AF37]/50 text-[#D4AF37]">
            <Shield className="w-5 h-5" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-[0.12em]">
            DIAMOND STORE
          </h1>
          <p className="text-xs tracking-[0.16em] text-white/55 uppercase">
            Administrator Operations Portal
          </p>
        </div>

        <div className="bg-white text-[#111111] p-8 border border-white/15 space-y-6">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <h2 className="font-display text-2xl font-semibold">
              {mode === 'login'
                ? 'Authorized Sign In'
                : mode === 'forgot'
                  ? 'Reset Admin Password'
                  : 'Complete Password Reset'}
            </h2>
            <Lock className="w-4 h-4 text-[#8C6D14]" />
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Email or Username
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@diamondstore.ng"
                  className="w-full px-3.5 py-2.5 border border-black/20 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/20 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#111111] text-white text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#222222] disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Enter Dashboard'}
              </button>
              <div className="flex justify-between items-center text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-[#111111]/65 hover:text-[#111111] underline"
                >
                  Forgot password?
                </button>
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/');
                  }}
                  className="text-[#8C6D14] hover:underline"
                >
                  Return to Storefront
                </a>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/20 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
              >
                Send Reset Token
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs underline text-[#111111]/65"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/20 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                  New Password (8+ characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-black/20 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
              >
                Reset Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
