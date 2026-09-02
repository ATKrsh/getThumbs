import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, Minus, Square, X, FileVideo } from 'lucide-react';

interface HeaderProps {
  totalFiles: number;
  uniqueTagsCount: number;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ totalFiles, uniqueTagsCount, isProcessing }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
    }

    if (window.electronAPI?.onWindowStateChange) {
      const cleanup = window.electronAPI.onWindowStateChange((state) => {
        setIsMaximized(Boolean(state.isMaximized));
      });
      return cleanup;
    }
  }, []);

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI?.minimizeWindow?.();
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.electronAPI?.maximizeWindow) {
      const res = await window.electronAPI.maximizeWindow();
      setIsMaximized(Boolean(res));
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI?.closeWindow?.();
  };

  return (
    <header className="h-14 px-4 bg-surface/95 border-b border-white/[0.1] backdrop-blur-xl flex items-center justify-between app-drag-region flex-shrink-0 z-50 select-none">
      {/* App Logo & Title */}
      <div className="flex items-center gap-3 app-no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-accent to-accent-cyan flex items-center justify-center p-[1px] shadow-glow-cyan">
          <div className="w-full h-full bg-surface rounded-[7px] flex items-center justify-center">
            <Tag className="w-4 h-4 text-accent-neon pointer-events-none" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-white font-mono">
              get<span className="text-accent-neon">Thumbs</span>
            </h1>
            <span className="px-1.5 py-0.2 bg-accent/20 border border-accent/40 text-[9px] font-mono text-accent-cyan rounded">
              v42.0
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-400">
            Video Thumbnail Generator (300 Workers)
          </p>
        </div>
      </div>

      {/* Center Status Telemetry */}
      <div className="flex items-center gap-4 text-xs font-mono app-no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {isProcessing ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-full animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin pointer-events-none" />
            <span className="text-[11px] font-medium">Processing Media Files...</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-3 text-slate-400 text-[11px]">
            <span className="flex items-center gap-1">
              <FileVideo className="w-3 h-3 text-sky-400 pointer-events-none" />
              <strong className="text-slate-200">{totalFiles}</strong> files analyzed
            </span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-accent-neon pointer-events-none" />
              <strong className="text-accent-neon">{uniqueTagsCount}</strong> thumbnails generated
            </span>
          </div>
        )}
      </div>

      {/* Right Controls: Frameless Window Buttons */}
      <div 
        className="flex items-center bg-surface-elevated/90 border border-white/[0.15] shadow-md rounded overflow-hidden app-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={handleMinimize}
          title="Minimize Window"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center justify-center w-9 h-8 text-slate-400 hover:text-white hover:bg-white/15 transition-colors cursor-pointer app-no-drag"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          title={isMaximized ? "Restore Window" : "Maximize Window"}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center justify-center w-9 h-8 text-slate-400 hover:text-white hover:bg-white/15 transition-colors cursor-pointer app-no-drag"
        >
          <Square className="w-3 h-3 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleClose}
          title="Close Application"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center justify-center w-9 h-8 text-slate-400 hover:text-white hover:bg-red-600 transition-colors cursor-pointer app-no-drag"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </header>
  );
};
