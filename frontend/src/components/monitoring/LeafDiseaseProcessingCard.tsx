import React from 'react';

export type LeafProcessingStep = 'idle' | 'uploading' | 'inferring';

export interface LeafProcessingPhaseInfo {
  title: string;
  detail: string;
  stepBadge: string;
}

export function getLeafProcessingPhase(step: LeafProcessingStep): LeafProcessingPhaseInfo {
  if (step === 'uploading') {
    return {
      stepBadge: 'Step 1 of 2 • Secure Upload',
      title: 'Uploading leaf image securely...',
      detail: 'Sending your crop leaf photograph to AgroAI field storage.',
    };
  }
  return {
    stepBadge: 'Step 2 of 2 • Model Inference',
    title: 'Running AI disease detection...',
    detail: 'Analyzing leaf patterns with the TensorFlow Lite disease classification model.',
  };
}

interface LeafDiseaseProcessingCardProps {
  imagePreview: string | null;
  fileName?: string;
  step: LeafProcessingStep;
}

export const LeafDiseaseProcessingCard: React.FC<LeafDiseaseProcessingCardProps> = ({
  imagePreview,
  fileName,
  step,
}) => {
  if (step === 'idle') return null;

  const phase = getLeafProcessingPhase(step);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative rounded-2xl p-5 bg-gradient-to-br from-[#0e3b24] via-[#12452b] to-[#0a2b1a] text-white border border-emerald-400/35 shadow-xl overflow-hidden space-y-4"
    >
      {/* Top Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-100 text-[11px] font-bold">
          <span className="material-symbols-outlined text-[15px] animate-spin">
            progress_activity
          </span>
          <span>{phase.stepBadge}</span>
        </span>
        {fileName && (
          <span className="font-mono text-[10px] text-emerald-200/80 truncate max-w-[200px]">
            {fileName}
          </span>
        )}
      </div>

      {/* Central Animated Leaf Image + Scanning Frame */}
      <div className="relative mx-auto w-full max-w-[340px] h-52 rounded-2xl p-2 bg-black/30 border border-emerald-400/30">
        {/* Outer Pulsing Glow Ring */}
        <div
          aria-hidden="true"
          className="agro-ring-pulse absolute -inset-1 rounded-2xl border-2 border-emerald-400/50 pointer-events-none"
        />

        <div className="relative w-full h-full rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Uploaded crop leaf being analyzed"
              className="agro-leaf-pulse max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="material-symbols-outlined text-[48px] text-emerald-300">eco</span>
          )}

          {/* Corner Scanning Brackets */}
          <div aria-hidden="true" className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-md pointer-events-none" />
          <div aria-hidden="true" className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-md pointer-events-none" />
          <div aria-hidden="true" className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-md pointer-events-none" />
          <div aria-hidden="true" className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-md pointer-events-none" />

          {/* Moving Horizontal Scanning Line */}
          <div
            aria-hidden="true"
            className="agro-scan-sweep absolute left-3 right-3 top-3 h-0.5 bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)] rounded-full pointer-events-none"
          />
        </div>
      </div>

      {/* Accurate Phase Text + Indeterminate Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-300 shrink-0">
            biotech
          </span>
          <p className="text-sm font-extrabold text-white">{phase.title}</p>
        </div>
        <p className="text-xs text-emerald-100/85 leading-relaxed">{phase.detail}</p>

        {/* Indeterminate Progress Bar (no fake percentage) */}
        <div
          aria-label="AI processing progress"
          className="w-full h-2 rounded-full bg-white/15 overflow-hidden relative"
        >
          <div className="agro-indeterminate-bar h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-400" />
        </div>
      </div>
    </div>
  );
};
