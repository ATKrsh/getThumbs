import React from 'react';
import { Activity, FileVideo, CheckCircle2, XCircle } from 'lucide-react';

interface ProgressBarProps {
  isProcessing: boolean;
  totalFiles: number;
  processedCount: number;
  currentFileName?: string;
  currentStepLabel?: string;
  onCancel?: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  isProcessing,
  totalFiles,
  processedCount,
  currentFileName,
  currentStepLabel,
  onCancel,
}) => {
  if (!isProcessing && processedCount === 0) {
    return null;
  }

  const overallPercent = totalFiles > 0
    ? Math.min(100, Math.round((processedCount / totalFiles) * 100))
    : 0;

  return (
    <div className="w-full bg-surface-elevated/90 border border-white/[0.12] p-4 rounded-xl space-y-3 font-mono shadow-xl backdrop-blur-xl">
      {/* 1. Header & Controls */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-white font-semibold">
          {isProcessing ? (
            <Activity className="w-4 h-4 text-accent-cyan animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>
            {isProcessing ? 'Batch Processing Progress' : 'Batch Extraction Complete'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isProcessing && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 px-2.5 py-0.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-semibold rounded transition-all cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.2)]"
              title="Cancel batch processing"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
          <span className="px-2 py-0.5 bg-accent/20 border border-accent/40 text-accent-neon font-bold text-xs rounded shadow-glow-cyan">
            {overallPercent}%
          </span>
        </div>
      </div>

      {/* 2. Unified Master Gradient Progress Bar (Magenta -> Accent -> Cyan Gradient) */}
      <div className="h-2.5 w-full bg-black/70 border border-white/10 rounded-full overflow-hidden p-[1px] shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-accent-magenta via-accent to-accent-cyan rounded-full transition-all duration-200 shadow-[0_0_15px_rgba(255,0,128,0.5)]"
          style={{ width: `${overallPercent}%` }}
        />
      </div>

      {/* 3. Active File Details (No red sub-bar, No Step 1/1) */}
      {isProcessing && currentFileName && (
        <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-300">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-3">
            <FileVideo className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span className="truncate text-sky-200 font-medium font-mono" title={currentFileName}>
              {currentFileName}
            </span>
          </div>
          <span className="text-accent-cyan flex-shrink-0 font-mono text-[11px] font-semibold">
            {processedCount} / {totalFiles}
          </span>
        </div>
      )}
    </div>
  );
};
