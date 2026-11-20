import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { auth } from '../services/firebase';
import { sendEmailVerification } from 'firebase/auth';
import type { PublicProfile } from '../types/api';

export const ProfilePage: React.FC = () => {
  const { user, profileUninitialized, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || '');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'bn'>(user?.preferredLanguage || 'en');

  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      userService.getPublicProfile(user.uid)
        .then(res => setPublicProfile(res.data))
        .catch(() => setPublicProfile(null));
    }
  }, [user]);

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setStatusMessage(null);
      await userService.initializeProfile({
        fullName,
        phoneNumber: phoneNumber || undefined,
        bio: bio || undefined,
        preferredLanguage,
      });
      await refreshProfile();
      setStatusMessage({ type: 'success', text: 'Profile initialized successfully!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Initialization failed';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.emailVerified) {
      setStatusMessage({
        type: 'error',
        text: 'Email verification is required before updating profile details. Please verify your email address.'
      });
      return;
    }
    const currentVersion = user?.profileVersion || 1;

    try {
      setLoading(true);
      setStatusMessage(null);
      const res = await userService.updateProfile({
        fullName,
        phoneNumber: phoneNumber || undefined,
        bio: bio || undefined,
        profileImageUrl: profileImageUrl || undefined,
        preferredLanguage,
        expectedVersion: currentVersion,
      });
      if (res.data) {
        await refreshProfile();
        setStatusMessage({ type: 'success', text: `Profile updated successfully! Now at version ${res.data.profileVersion}` });
        if (user?.uid) {
          userService.getPublicProfile(user.uid).then(p => setPublicProfile(p.data));
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const msg = axiosErr.response?.data?.message || (err instanceof Error ? err.message : 'Update failed');
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!user?.emailVerified) {
      setStatusMessage({
        type: 'error',
        text: 'Email verification is required before reconciling profile projections.'
      });
      return;
    }
    try {
      setLoading(true);
      setStatusMessage(null);
      await userService.reconcileProfile();
      await refreshProfile();
      if (user?.uid) {
        const p = await userService.getPublicProfile(user.uid);
        setPublicProfile(p.data);
      }
      setStatusMessage({ type: 'success', text: 'Public projection successfully reconciled with canonical profile.' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const msg = axiosErr.response?.data?.message || (err instanceof Error ? err.message : 'Reconciliation failed');
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerification = async () => {
    if (auth?.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        setVerificationSent(true);
      } catch (err) {
        console.warn('Email verification error:', err);
      }
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Identity & Security</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Account & Profile Management
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Manage your personal credentials, contact parameters, and verified domain identity.
            </p>
          </div>

          {user?.profileVersion !== undefined && (
            <div className="px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              <span>Schema v{user.profileVersion}</span>
            </div>
          )}
        </div>
      </div>

      {profileUninitialized && (
        <div className="p-4 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0">warning</span>
          <div>
            <strong className="block font-bold mb-0.5">Onboarding Notice</strong>
            Your identity is authenticated with Firebase, but your AgroAI domain profile is not initialized. Please complete the form below to initialize your canonical profile.
          </div>
        </div>
      )}

      {!profileUninitialized && !user?.emailVerified && (
        <div className="p-4 rounded-xl bg-error-container text-error border border-error/20 text-xs leading-relaxed flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[20px] shrink-0">mark_email_unread</span>
          <div>
            <strong className="block font-bold mb-0.5">Email Verification Required</strong>
            Your email address is unverified. Saving profile updates and performing farm operations require a verified email address.
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-secondary-container text-on-secondary-container border-secondary/20'
              : 'bg-error-container text-error border-error/20'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {statusMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Form */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-6">
          <h2 className="text-base font-bold text-on-surface">Canonical Profile Details</h2>

          <form onSubmit={profileUninitialized ? handleInitialize : handleUpdate} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="prof-name">
                Full Name *
              </label>
              <input
                id="prof-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="prof-email">
                Registered Email (Verified ID Token Claim)
              </label>
              <input
                id="prof-email"
                type="email"
                disabled
                value={user?.email || 'unregistered@agroai.org'}
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface-variant text-sm border border-transparent shadow-inner opacity-70 cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="prof-phone">
                  Phone Number (Private)
                </label>
                <input
                  id="prof-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+8801700000000"
                  className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="prof-lang">
                  Preferred Language
                </label>
                <select
                  id="prof-lang"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'bn')}
                  className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
                >
                  <option value="en">English (Default)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="prof-img">
                Profile Avatar URL
              </label>
              <input
                id="prof-img"
                type="url"
                value={profileImageUrl}
                onChange={(e) => setProfileImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="prof-bio">
                Agricultural Bio & Operations
              </label>
              <textarea
                id="prof-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Overview of your agricultural holdings, crops, or farming experience..."
                className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-outline-variant/30">
              <button
                type="submit"
                disabled={loading}
                className="h-11 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>{profileUninitialized ? 'Initialize Profile' : 'Save Changes'}</span>
                  </>
                )}
              </button>

              {!profileUninitialized && (
                <button
                  type="button"
                  onClick={handleReconcile}
                  disabled={loading}
                  title="Re-synchronize public projection with canonical profile"
                  className="h-11 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer transition-colors"
                >
                  Sync Public Projection
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Account Standing & Public Preview */}
        <div className="space-y-6">
          {/* Security & Standing Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">security</span>
              <span>Security & Standing</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span className="text-on-surface-variant">Platform Standing</span>
                <span className="px-2 py-0.5 rounded-md bg-secondary-container text-on-secondary-container font-bold text-[11px]">
                  {user?.accountStatus || 'ACTIVE'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span className="text-on-surface-variant">Email Verification</span>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    user?.emailVerified
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {user?.emailVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            </div>

            {!user?.emailVerified && !verificationSent && (
              <button
                type="button"
                onClick={handleSendVerification}
                className="w-full h-10 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer shadow-sm transition-all"
              >
                Send Verification Email
              </button>
            )}

            {verificationSent && (
              <p className="text-xs text-secondary font-semibold text-center mt-1">
                Verification link dispatched. Please check your inbox.
              </p>
            )}
          </div>

          {/* Public Projection Preview */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 space-y-3">
            <h3 className="text-sm font-bold text-on-surface">Public Directory Projection</h3>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              This projection is publicly inspectable by agronomists, farm owners, and recruiters.
            </p>

            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
                  {(publicProfile?.fullName || fullName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-on-surface">
                    {publicProfile?.fullName || fullName || 'Anonymous Farmer'}
                  </h4>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    UID: {user?.uid?.substring(0, 10)}...
                  </span>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3">
                {publicProfile?.bio || bio || 'No agricultural bio provided.'}
              </p>

              <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold">
                  Lang: {publicProfile?.preferredLanguage || preferredLanguage}
                </span>
                <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
                  Phone Protected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
