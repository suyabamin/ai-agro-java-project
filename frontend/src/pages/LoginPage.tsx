import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isFirebaseClientConfigured, auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export const LoginPage: React.FC = () => {
  const { mockLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleFirebaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !isFirebaseClientConfigured) {
      if (import.meta.env.DEV) {
        mockLogin('owner');
        navigate(from, { replace: true });
        return;
      }
      setError('Authentication is unavailable because Firebase is not configured.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      await signInWithEmailAndPassword(auth, email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      let msg = 'Authentication failed';
      const axiosErr = err as {
        code?: string;
        message?: string;
        response?: { data?: { message?: string } };
      };
      if (axiosErr.response?.data?.message) {
        msg = axiosErr.response.data.message;
      } else if (axiosErr.code === 'ERR_NETWORK' || axiosErr.message === 'Network Error') {
        msg = 'Network Error: Unable to reach the authentication service. Please check your network connection.';
      } else if (axiosErr.message?.includes('auth/invalid-credential')) {
        msg = 'Invalid email address or password.';
      } else if (axiosErr.message?.includes('auth/user-not-found')) {
        msg = 'No account found with this email address.';
      } else if (axiosErr.message?.includes('auth/wrong-password')) {
        msg = 'Incorrect password.';
      } else if (axiosErr.message?.includes('auth/network-request-failed')) {
        msg = 'Network Error: Failed to reach Firebase Authentication service. Please check your network connection.';
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-8 md:py-12 flex flex-col justify-center">
      {/* Top Live Telemetry Ribbon */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-8 bg-surface-container-lowest/80 backdrop-blur-md rounded-xl p-3.5 shadow-sm border border-outline-variant/30">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
            AgroAI Multi-Tenant Gateway v4.12
          </span>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <span className="text-xs text-on-surface-variant hidden sm:inline">
            256-Bit Encrypted Telemetry Link
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface text-xs">
            <span className="material-symbols-outlined text-[15px] text-primary">sensors</span>
            <span>Mesh Status: <strong className="text-primary font-semibold">148 Nodes Active</strong></span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs">
            <span className="material-symbols-outlined text-[15px]">satellite_alt</span>
            <span>Sentinel-2 Orbit Sync: <strong className="font-semibold">18m ago</strong></span>
          </div>
        </div>
      </div>

      {/* Main Asymmetric Bento Shell */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Primary Auth Gateway Form */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                Workspace Identity
              </span>
              <span className="text-on-surface-variant text-xs hidden sm:inline">
                Precision Agronomic Intelligence
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Sign In to Your Workspace
            </h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-xl leading-relaxed">
              Access real-time in-situ telemetry, crop disease diagnostics, and automated irrigation management.
            </p>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="mt-4 p-3 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-medium border border-secondary/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{message}</span>
              </div>
            )}

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleFirebaseLogin}>
              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface flex items-center justify-between" htmlFor="work-email">
                  <span>Work / Farm Operations Email</span>
                  <span className="text-on-surface-variant font-normal">SSO Auto-Detect</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none flex items-center">
                    <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                  </span>
                  <input
                    id="work-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., elena.vance@greenvalleyranch.com"
                    required
                    className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary/20 shadow-inner"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface" htmlFor="auth-password">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary hover:text-secondary hover:underline transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-on-surface-variant pointer-events-none flex items-center">
                    <span className="material-symbols-outlined text-[20px]">key</span>
                  </span>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your security credential"
                    required
                    className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline text-sm focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary/20 shadow-inner"
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 h-8 w-8 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 py-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary bg-surface-container-low accent-primary cursor-pointer"
                />
                <label htmlFor="remember-me" className="text-xs text-on-surface cursor-pointer select-none">
                  Keep me signed in on this device
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-1 bg-primary hover:bg-secondary active:scale-[0.99] text-on-primary font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    <span>Verifying Security Token...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to AgroAI</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>

              {/* SSO Splitter */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-[1px] bg-surface-container-highest" />
                </div>
                <span className="relative bg-surface-container-lowest px-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Development & Enterprise Sign-In
                </span>
              </div>

              {/* Fast Sign-In Helpers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    mockLogin('owner');
                    navigate(from, { replace: true });
                  }}
                  className="h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center gap-2 transition-all text-xs font-semibold border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">warehouse</span>
                  <span>Owner Workspace Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    mockLogin('farmer');
                    navigate('/farmer/dashboard', { replace: true });
                  }}
                  className="h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center gap-2 transition-all text-xs font-semibold border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-secondary text-[18px]">grass</span>
                  <span>Farmer Workdesk Demo</span>
                </button>
              </div>

              {/* Register Callout */}
              <div className="mt-3 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-outline-variant/20">
                <span className="text-on-surface-variant">Don't have an AgroAI account?</span>
                <Link
                  to="/register"
                  className="text-primary hover:text-secondary font-bold hover:underline inline-flex items-center gap-1"
                >
                  <span>Create Account / Request Access</span>
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </Link>
              </div>
            </form>

            <div className="mt-6 p-3 rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2 text-on-surface-variant text-xs border border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">verified_user</span>
                <span className="text-on-surface font-semibold">SOC 2 Type II Certified Infrastructure</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>Regional Clusters: <strong className="text-on-surface font-semibold">14ms latency</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Agronomic Telemetry Preview */}
        <div className="lg:col-span-5 flex flex-col gap-4 justify-between">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">satellite_alt</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant">Telemetry Target</span>
                  <div className="text-sm font-bold text-on-surface">GreenValley Ranch</div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold">
                Sector 4A Online
              </span>
            </div>

            <div className="relative w-full h-44 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-900 to-green-950 p-4 flex flex-col justify-between text-white shadow-inner">
              <div className="flex justify-between items-center text-[11px]">
                <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md">
                  NDVI Index: 0.84 (Optimal)
                </span>
                <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded backdrop-blur-md text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE LORAWAN
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-gray-300">Canopy Transpiration</p>
                  <p className="text-2xl font-bold leading-none">94.2%</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-300">Active Soil Moisture</p>
                  <p className="text-lg font-semibold text-emerald-300">32.8 kPa</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-primary">water_drop</span>
                  VPD Deficit
                </span>
                <span className="text-base font-bold text-on-surface mt-0.5">1.18 kPa</span>
                <span className="text-[10px] text-secondary font-medium">Automatic Valve Closed</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-tertiary">nest_thermostat</span>
                  Root Zone (40cm)
                </span>
                <span className="text-base font-bold text-on-surface mt-0.5">21.4°C</span>
                <span className="text-[10px] text-primary font-medium">Nominal Range</span>
              </div>
            </div>
          </div>

          {/* Testimonial Quote */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm">
                MV
              </div>
              <div>
                <div className="text-xs font-bold text-on-surface">Dr. Marcus Vance</div>
                <div className="text-[11px] text-on-surface-variant">VP of Agronomy, Pacific Agro Operations</div>
              </div>
            </div>
            <blockquote className="text-xs text-on-surface-variant italic pl-3 border-l-2 border-secondary leading-relaxed">
              "AgroAI securely protects proprietary soil telemetry and harvest analytics across 420,000+ hectares worldwide with zero sensor packet loss."
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  );
};
