import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, isFirebaseClientConfigured } from '../services/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { userService } from '../services/userService';

export const RegistrationPage: React.FC = () => {
  const { isAuthenticated, mockLogin } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'bn'>('en');
  const [rolePreference, setRolePreference] = useState<'owner' | 'farmer'>('owner');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the terms of service and security standards.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!auth || !isFirebaseClientConfigured) {
      if (import.meta.env.DEV) {
        mockLogin(rolePreference);
        navigate(rolePreference === 'farmer' ? '/farmer/dashboard' : '/dashboard', { replace: true });
        return;
      }
      setError('Registration is unavailable because Firebase is not configured.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Create account in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      // 2. Set display name in Firebase Auth
      await updateProfile(fbUser, { displayName: fullName });

      // 3. Send email verification
      try {
        await sendEmailVerification(fbUser);
      } catch (mailErr) {
        console.warn('Could not dispatch verification email:', mailErr);
      }

      // 4. Initialize canonical profile in Spring Boot backend & Firestore
      try {
        await userService.initializeProfile({
          fullName,
          phoneNumber: phoneNumber.trim() || undefined,
          bio: bio.trim() || undefined,
          preferredLanguage,
        });
      } catch (backendErr) {
        try {
          await fbUser.delete();
          console.warn('Cleaned up orphaned Firebase Auth user after backend initialization failure');
        } catch (cleanupErr) {
          console.error('Failed to clean up orphaned Firebase Auth account:', cleanupErr);
        }
        throw backendErr;
      }

      setSuccessMessage('Registration successful! Redirecting to workspace...');
      setTimeout(() => {
        navigate(rolePreference === 'farmer' ? '/farmer/dashboard' : '/dashboard', { replace: true });
      }, 1500);

    } catch (err: unknown) {
      let msg = 'Registration failed. Please try again.';
      const axiosErr = err as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { message?: string } };
      };

      if (axiosErr.response?.data?.message) {
        msg = axiosErr.response.data.message;
      } else if (axiosErr.code === 'ERR_NETWORK' || axiosErr.message === 'Network Error') {
        msg = 'Network Error: Unable to reach the AgroAI backend server (http://localhost:8080). Please ensure the backend is running.';
      } else if (axiosErr.message?.includes('auth/email-already-in-use')) {
        msg = 'This email address is already registered. Please sign in instead.';
      } else if (axiosErr.message?.includes('auth/weak-password')) {
        msg = 'Password is too weak. Please use a stronger password.';
      } else if (axiosErr.message?.includes('auth/invalid-email')) {
        msg = 'Please enter a valid email address.';
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-8 md:py-12 flex flex-col justify-center">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between mb-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Home</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold uppercase tracking-wider">
          Enterprise Multi-Tenant Onboarding
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
              Account Provisioning
            </span>
            <span className="text-on-surface-variant text-xs">v4.12 Telemetry Core</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Create Your AgroAI Account
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 mb-6 leading-relaxed">
            Register as a Farm Owner or Agricultural Worker to access telemetry monitoring, field assignments, and AI services.
          </p>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-medium border border-secondary/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}

          <form className="flex flex-col gap-4" onSubmit={handleRegister}>
            {/* Primary Role Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">Primary Operational Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRolePreference('owner')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    rolePreference === 'owner'
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">warehouse</span>
                  <div>
                    <div className="text-xs font-bold text-on-surface">Farm Owner / Manager</div>
                    <div className="text-[10px] text-on-surface-variant">Register farms, fields, jobs, and IoT devices</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRolePreference('farmer')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    rolePreference === 'farmer'
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">grass</span>
                  <div>
                    <div className="text-xs font-bold text-on-surface">Field Farmer / Specialist</div>
                    <div className="text-[10px] text-on-surface-variant">Accept field assignments and record activities</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Full Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="full-name">
                  Full Name *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </span>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Marcus Vance"
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="phone-number">
                  Phone Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">call</span>
                  </span>
                  <input
                    id="phone-number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+880 1712 345678"
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* Email & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="reg-email">
                  Operations Email *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">mail</span>
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marcus@pacific-agro.com"
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="pref-lang">
                  Preferred Language
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">language</span>
                  </span>
                  <select
                    id="pref-lang"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'bn')}
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
                  >
                    <option value="en">English (Global Precision Standard)</option>
                    <option value="bn">বাংলা (Bengali / Localized)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bio / Agricultural Specialization */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="reg-bio">
                Agricultural Background / Bio (Optional)
              </label>
              <textarea
                id="reg-bio"
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Briefly describe your farming experience, soil specialization, or agribusiness..."
                className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="reg-password">
                  Password *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">key</span>
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full h-11 pl-10 pr-10 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 h-8 w-8 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface" htmlFor="reg-confirm-password">
                  Confirm Password *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                  </span>
                  <input
                    id="reg-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* Terms of Service Checkbox */}
            <div className="flex items-start gap-2 py-1">
              <input
                id="accept-terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-primary focus:ring-primary bg-surface-container-low accent-primary cursor-pointer"
              />
              <label htmlFor="accept-terms" className="text-xs text-on-surface-variant leading-relaxed cursor-pointer select-none">
                I agree to the <a href="#terms" className="text-primary font-semibold hover:underline">Terms of Service</a> and acknowledge the <a href="#security" className="text-primary font-semibold hover:underline">Security Standards</a> governing agronomic telemetry data.
              </label>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 bg-primary hover:bg-secondary active:scale-[0.99] text-on-primary font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                  <span>Provisioning Account & Generating Keys...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration & Open Workspace</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>

            {/* Quick Link to Sign In */}
            <div className="mt-2 text-center text-xs text-on-surface-variant">
              Already have an AgroAI workspace?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Sign In
              </Link>
            </div>
          </form>
        </div>

        {/* Right Column: Platform Information */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
            <h3 className="text-base font-bold text-on-surface">What Happens After Registration</h3>
            <ul className="space-y-3 text-xs text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">check_circle</span>
                <span>An authorized Firebase Authentication identity is created with encrypted credentials.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">check_circle</span>
                <span>A canonical profile is initialized in the Spring Boot backend and synchronized with Cloud Firestore.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">check_circle</span>
                <span>Owners can immediately register farms and configure fields; Farmers can browse marketplace listings.</span>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-[24px]">support_agent</span>
            <div>
              <div className="font-bold text-on-surface">Need Agronomist Assistance?</div>
              <div className="text-[11px]">Contact enterprise onboarding support at support@agroai.internal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
