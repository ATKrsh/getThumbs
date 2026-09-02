import React, { useState } from 'react';
import { ExtractedThumb } from '../utils/thumbExtractor';
import { Trash2, Image as ImageIcon, ExternalLink, RefreshCw, XCircle, Lock, Download, X, FileVideo, ChevronUp, ChevronDown } from 'lucide-react';

interface ThumbDashboardProps {
  thumbs: ExtractedThumb[];
  onRemoveThumb: (id: string) => void;
  onClearAll: () => void;
  onReprocessAll: () => void;
  hasLoadedFiles: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ThumbDashboard: React.FC<ThumbDashboardProps> = ({
  thumbs,
  onRemoveThumb,
  onClearAll,
  onReprocessAll,
  hasLoadedFiles,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = onToggleCollapse ? isCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  const [lightboxThumb, setLightboxThumb] = useState<{ path: string; name: string } | null>(null);
  const [zipPassword, setZipPassword] = useState('');
  const [isZipping, setIsZipping] = useState(false);

  const handleCreateZip = async () => {
    if (!zipPassword || thumbs.length === 0 || !window.electronAPI?.createProtectedZip) return;
    setIsZipping(true);
    try {
      const paths = thumbs.map(t => t.thumbPath.replace('file:///', '').replace('file://', ''));
      await window.electronAPI.createProtectedZip(zipPassword, paths);
    } catch (err) {
      console.error(err);
    } finally {
      setIsZipping(false);
      setZipPassword('');
    }
  };

  return (
    <div className={`flex flex-col bg-surface border border-white/5 rounded-xl overflow-hidden shadow-2xl relative transition-all duration-300 ${
      collapsed ? 'flex-initial h-auto' : 'flex-1 min-h-0'
    }`}>
      {/* Header Bar with Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.01] gap-2">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 rounded bg-white/[0.05] hover:bg-white/15 text-slate-300 hover:text-accent-cyan transition-all cursor-pointer"
            title={collapsed ? "Expand Thumbnails Window" : "Collapse Thumbnails Window"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4 text-accent-neon" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <FileVideo className="w-4 h-4 text-accent-cyan" />
          <span className="font-semibold text-white">Extracted Thumbnails</span>
          <span className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] text-accent-cyan">
            {thumbs.length}
          </span>
          {collapsed && (
            <span className="text-[10px] text-slate-500 italic hidden sm:inline">
              (Click arrow to expand grid)
            </span>
          )}
        </div>
        
        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {hasLoadedFiles && (
            <>
              <div className="flex items-center gap-1.5 ml-2 mr-2">
                <input
                  type="password"
                  placeholder="Zip Password..."
                  value={zipPassword}
                  onChange={(e) => setZipPassword(e.target.value)}
                  className="w-28 px-2 py-1 bg-surface-elevated border border-white/10 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-neon font-mono"
                />
                <button
                  onClick={handleCreateZip}
                  disabled={isZipping || !zipPassword}
                  className="flex items-center gap-1.5 px-3 py-1 bg-accent-neon/10 hover:bg-accent-neon/20 border border-accent-neon/20 text-accent-neon text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-mono"
                  title="Create password protected zip in dump folder"
                >
                  {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Protect ZIP</span>
                </button>
              </div>
              <button
                onClick={onReprocessAll}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/50 hover:bg-slate-700/80 border border-white/5 text-slate-300 text-xs rounded transition-colors cursor-pointer font-mono"
                title="Discard all and extract new thumbnails"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reprocess</span>
              </button>
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs rounded transition-colors cursor-pointer font-mono"
                title="Clear all generated thumbnails"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Thumbnails Grid View (Collapsible) */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {thumbs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono">
              <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No video thumbnails generated yet.</p>
              <p className="text-xs opacity-60 mt-1">Drop video files above to begin extraction.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {thumbs.map((thumb) => (
                <div
                  key={thumb.id}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '220px' }}
                  onDoubleClick={() => setLightboxThumb({ path: thumb.thumbPath, name: thumb.fileName })}
                  className="group relative flex flex-col bg-slate-800/40 rounded-lg overflow-hidden border border-white/5 hover:border-accent/50 transition-colors cursor-pointer"
                  title={`Double click to view full resolution • ${thumb.fileName}`}
                >
                  <div className="aspect-video w-full bg-black relative">
                    <img
                      src={thumb.thumbPath}
                      alt={thumb.fileName}
                      className="w-full h-full object-contain pointer-events-none"
                      loading="lazy"
                    />
                    
                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveThumb(thumb.id);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-10 cursor-pointer"
                      title="Remove thumbnail"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-2 truncate text-xs text-slate-300 font-mono" title={thumb.fileName}>
                    {thumb.fileName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* High-Resolution In-App Lightbox Modal */}
      {lightboxThumb && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md cursor-zoom-out animate-in fade-in"
          onClick={() => setLightboxThumb(null)}
        >
          <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none">
            <span className="text-xs font-mono text-slate-300 bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 truncate max-w-xl">
              {lightboxThumb.name}
            </span>
            <button 
              className="p-2 bg-white/10 hover:bg-white/25 rounded-full text-white transition-colors pointer-events-auto cursor-pointer"
              onClick={() => setLightboxThumb(null)}
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img 
            src={lightboxThumb.path} 
            className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg border border-white/10" 
            alt={lightboxThumb.name} 
          />
        </div>
      )}
    </div>
  );
};
