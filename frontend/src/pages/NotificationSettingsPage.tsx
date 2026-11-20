import React, { useState } from 'react';

export const NotificationSettingsPage: React.FC = () => {
  const [telemetryAlerts, setTelemetryAlerts] = useState(true);
  const [jobApplications, setJobApplications] = useState(true);
  const [paymentReceipts, setPaymentReceipts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Alerts & Messaging</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Notification Preferences
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
          Configure real-time in-app alerts and email notifications for field operations.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>Notification preferences successfully saved.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-6">
        <h2 className="text-base font-bold text-on-surface">Event Notification Channels</h2>

        <div className="space-y-4 text-xs">
          <label className="flex items-start gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={telemetryAlerts}
              onChange={(e) => setTelemetryAlerts(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <div>
              <div className="font-bold text-sm text-on-surface">Critical Soil Moisture & Dielectric Alerts</div>
              <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                Receive notifications when sensor probe VWC drops below the 35% wilting point or temperatures exceed heat stress levels.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={jobApplications}
              onChange={(e) => setJobApplications(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <div>
              <div className="font-bold text-sm text-on-surface">Candidate Application Alerts</div>
              <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                Receive alerts immediately when a verified field agronomist applies to an open job vacancy.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={paymentReceipts}
              onChange={(e) => setPaymentReceipts(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <div>
              <div className="font-bold text-sm text-on-surface">Payment Ledger & Disbursement Confirmations</div>
              <p className="text-on-surface-variant mt-0.5 leading-relaxed">
                Log receipts and ledger updates whenever labor payments are recorded or reversed.
              </p>
            </div>
          </label>
        </div>

        <div className="pt-4 border-t border-outline-variant/20 flex justify-end">
          <button
            type="submit"
            className="h-11 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
