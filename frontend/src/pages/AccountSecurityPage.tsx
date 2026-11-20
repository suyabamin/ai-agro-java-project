import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';

export const AccountSecurityPage: React.FC = () => {
  const { user } = useAuth();
  const [resetSent, setResetSent] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordReset = async () => {
    if (!auth || !user?.email) {
      setError('Firebase authentication client is unconfigured or user email is missing.');
      return;
    }
    setError(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email');
    }
  };

  const handleVerifyEmail = async () => {
    if (!auth?.currentUser) return;
    setError(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setVerifySent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send email verification');
    }
  };

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Security & Access</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Account Security & Credentials
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
          Cryptographic session verification, token claims, and credential protection.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Security Cards */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-6">
        <h2 className="text-base font-bold text-on-surface">Authentication Credentials</h2>

        <div className="divide-y divide-outline-variant/20 text-xs">
          {/* Email Verification */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm text-on-surface">Email Address Verification</div>
              <p className="text-on-surface-variant mt-0.5">
                Current email: <strong className="text-on-surface font-mono">{user?.email}</strong>
              </p>
              <div className="mt-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    user?.emailVerified
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {user?.emailVerified ? 'Verified ID Token Claim' : 'Unverified'}
                </span>
              </div>
            </div>

            {!user?.emailVerified && (
              <button
                type="button"
                onClick={handleVerifyEmail}
                disabled={verifySent}
                className="h-9 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs cursor-pointer shadow-sm disabled:opacity-60 transition-all shrink-0"
              >
                {verifySent ? 'Verification Dispatched' : 'Send Verification'}
              </button>
            )}
          </div>

          {/* Password Reset */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm text-on-surface">Account Password</div>
              <p className="text-on-surface-variant mt-0.5">
                Managed securely through Firebase Authentication JWT protocol.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetSent}
              className="h-9 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs cursor-pointer transition-colors shrink-0"
            >
              {resetSent ? 'Reset Link Sent to Email' : 'Change Password'}
            </button>
          </div>

          {/* User ID Claim */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm text-on-surface">Unique Subject Identifier (UID)</div>
              <p className="text-on-surface-variant mt-0.5 font-mono text-[11px] break-all">
                {user?.uid || 'Unknown'}
              </p>
            </div>
            <span className="px-2 py-1 rounded bg-surface-container text-on-surface-variant font-mono text-[11px] shrink-0">
              SHA-256 Claim
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
