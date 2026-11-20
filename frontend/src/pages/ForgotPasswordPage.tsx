import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, isFirebaseClientConfigured } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (!auth || !isFirebaseClientConfigured) {
      if (import.meta.env.DEV) {
        setMessage(`Development mode: Password reset email simulated for ${email}.`);
        return;
      }
      setError('Password reset is unavailable because Firebase is not configured.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      await sendPasswordResetEmail(auth, email.trim());
      setMessage(`Security recovery instructions have been dispatched to ${email}. Please check your inbox.`);
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr.code === 'auth/user-not-found') {
        setError('No AgroAI account was found associated with this email address.');
      } else if (fbErr.code === 'auth/invalid-email') {
        setError('Please enter a valid operations email address.');
      } else {
        setError(fbErr.message || 'Failed to dispatch password recovery email.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[560px] mx-auto px-4 py-12 flex flex-col justify-center">
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-secondary" />

        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lock_reset</span>
            Credential Recovery
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-on-surface tracking-tight mb-2">
          Forgot Your Password?
        </h1>
        <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
          Enter your registered work or farm operations email. We will send you an authorized link to reset your workspace security credentials.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-medium border border-secondary/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handlePasswordReset} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="reset-email">
              Work / Farm Operations Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-on-surface-variant pointer-events-none">
                <span className="material-symbols-outlined text-[18px]">mail</span>
              </span>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. operator@agroai.internal"
                required
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary hover:bg-secondary text-on-primary font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                <span>Dispatching Security Token...</span>
              </>
            ) : (
              <>
                <span>Send Reset Link</span>
                <span className="material-symbols-outlined text-[18px]">send</span>
              </>
            )}
          </button>

          <div className="mt-2 text-center text-xs text-on-surface-variant">
            Remembered your password?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
