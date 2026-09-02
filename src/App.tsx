import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';
import { StatsBar } from './components/StatsBar';
import { ThumbDashboard } from './components/ThumbDashboard';
import { ThumbExtractor, ExtractedThumb } from './utils/thumbExtractor';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[getThumbs UI Error]:', error, errorInfo);
    if (window.electronAPI?.logCrash) {
      window.electronAPI.logCrash(`React Boundary: ${error.message}\n${error.stack}\n${errorInfo.componentStack}`);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-background flex flex-col items-center justify-center p-6 text-center font-mono">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-lg">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-xs text-slate-400 max-w-md mb-6 font-light">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset & Reload App</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  const extractorRef = useRef<ThumbExtractor>(new ThumbExtractor());
  const loadedFilesRef = useRef<Array<{ name: string; path?: string }>>([]);
  const [thumbs, setThumbs] = useState<ExtractedThumb[]>([]);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);

  // Telemetry & Batch Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalFilesProcessed, setTotalFilesProcessed] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentStepLabel, setCurrentStepLabel] = useState('');
  const [processingTimeSec, setProcessingTimeSec] = useState(0);

  const isProcessingRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  const processFilesBatch = async (files: Array<{ name: string; path?: string }>) => {
    if (!files || !Array.isArray(files) || files.length === 0 || isProcessingRef.current) return;

    loadedFilesRef.current = files;
    isProcessingRef.current = true;
    setIsProcessing(true);
    startTimeRef.current = Date.now();
    
    // Filter exclusively to video formats, explicitly ignoring PDFs and non-video files
    const validFiles = files.filter(f => {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.pdf')) return false;
      const ext = lower.split('.').pop();
      return ['mp4', 'mkv', 'avi', 'webm', 'mov', 'wmv', 'flv', 'm4v', 'ts', '3gp', 'mpeg', 'mpg', 'vob', 'ogv', 'm2ts', 'mts', 'divx', 'f4v', 'rmvb', 'rm', 'asf', 'mxf', 'dv', 'm2v', 'mpv', 'm4p', 'qt', 'yuv', '264', 'hevc', 'h265', 'h264'].includes(ext || '');
    });

    const count = validFiles.length;
    setBatchTotal(count);
    setProcessedCount(0);
    setCurrentFileName('');
    setProcessingTimeSec(0);
    setFailedFiles([]);

    const timerInterval = setInterval(() => {
      if (isProcessingRef.current) {
        setProcessingTimeSec((Date.now() - startTimeRef.current) / 1000);
      }
    }, 100);

    // High-throughput parallel concurrency: 300 simultaneous workers
    const CONCURRENCY = 300;

    const newThumbs: ExtractedThumb[] = [];
    const failedList: string[] = [];
    let completedCount = 0;
    let nextIndex = 0;
    let lastUiFlush = Date.now();

    const worker = async () => {
      while (isProcessingRef.current) {
        if (nextIndex >= count) break;
        const i = nextIndex++;
        const file = validFiles[i];
        if (!file || !file.path) continue;

        setCurrentFileName(file.name);

        const thumbPath = await extractorRef.current.extractVideoThumbnail(file.path, file.name);

        if (!isProcessingRef.current) break;

        if (thumbPath) {
          const thumb: ExtractedThumb = {
            id: `thumb-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            fileName: file.name,
            filePath: file.path,
            thumbPath,
          };
          newThumbs.push(thumb);
        } else {
          failedList.push(file.name);
        }

        completedCount++;
        setProcessedCount(completedCount);
        setTotalFilesProcessed(completedCount);

        // Smooth throttled React state dispatch to maintain 60fps rendering without lag
        const now = Date.now();
        if (now - lastUiFlush > 150 || completedCount === count || newThumbs.length % 6 === 0) {
          lastUiFlush = now;
          setThumbs([...newThumbs]);
          if (failedList.length > 0) {
            setFailedFiles([...failedList]);
          }
        }

        // Fast event loop yield
        await new Promise(r => setTimeout(r, 0));
      }
    };

    try {
      const activeWorkerCount = Math.min(CONCURRENCY, count);
      const workers = Array.from({ length: activeWorkerCount }, () => worker());
      await Promise.all(workers);
    } catch (err) {
      console.error('[getThumbs] Batch processing error:', err);
    } finally {
      clearInterval(timerInterval);
      setThumbs([...newThumbs]);
      setFailedFiles([...failedList]);
      isProcessingRef.current = false;
      setProcessingTimeSec((Date.now() - startTimeRef.current) / 1000);
      setIsProcessing(false);
      setCurrentFileName('');
      setCurrentStepLabel('Batch extraction complete.');
    }
  };

  const handleDiscardAndReprocess = () => {
    const activeFiles = [...loadedFilesRef.current];
    if (activeFiles.length === 0) return;
    setThumbs([]);
    setFailedFiles([]);
    setTotalFilesProcessed(0);
    setBatchTotal(activeFiles.length);
    setProcessedCount(0);
    setProcessingTimeSec(0);
    processFilesBatch(activeFiles);
  };

  const handleRemoveThumb = (id: string) => {
    setThumbs(prev => prev.filter(t => t.id !== id));
  };

  const handleClearAll = async () => {
    isProcessingRef.current = false;
    setIsProcessing(false);
    loadedFilesRef.current = [];
    setThumbs([]);
    setFailedFiles([]);
    setTotalFilesProcessed(0);
    setBatchTotal(0);
    setProcessedCount(0);
    setProcessingTimeSec(0);
    setCurrentFileName('');
    setCurrentStepLabel('');

    if (extractorRef.current) {
      await extractorRef.current.cancelAll();
    }
  };

  const handleCancelProcessing = async () => {
    isProcessingRef.current = false;
    setIsProcessing(false);
    setCurrentFileName('');
    setCurrentStepLabel('Terminating processes & releasing resources...');

    if (extractorRef.current) {
      await extractorRef.current.cancelAll();
    }

    setCurrentStepLabel('All background tasks terminated.');
  };

  const hasLoadedFiles = loadedFilesRef.current.length > 0;
  const [isDashboardCollapsed, setIsDashboardCollapsed] = useState(false);

  const handleToggleDashboardCollapse = () => {
    const nextCollapsed = !isDashboardCollapsed;
    setIsDashboardCollapsed(nextCollapsed);
    if (window.electronAPI?.setCompactMode) {
      window.electronAPI.setCompactMode(nextCollapsed).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-slate-100 overflow-hidden font-sans border border-white/10 select-none">
      <Header
        totalFiles={totalFilesProcessed}
        uniqueTagsCount={thumbs.length}
        isProcessing={isProcessing}
      />
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-w-0">
        <DropZone
          onAddFiles={processFilesBatch}
          isProcessing={isProcessing}
        />
        <ProgressBar
          isProcessing={isProcessing}
          totalFiles={batchTotal}
          processedCount={processedCount}
          currentFileName={currentFileName}
          currentStepLabel={currentStepLabel}
          onCancel={handleCancelProcessing}
        />
        <StatsBar
          totalFiles={totalFilesProcessed}
          videoCount={thumbs.length}
          failedFiles={failedFiles}
          processingTimeSec={processingTimeSec}
        />
        <ThumbDashboard
          thumbs={thumbs}
          onRemoveThumb={handleRemoveThumb}
          onClearAll={handleClearAll}
          onReprocessAll={handleDiscardAndReprocess}
          hasLoadedFiles={hasLoadedFiles}
          isCollapsed={isDashboardCollapsed}
          onToggleCollapse={handleToggleDashboardCollapse}
        />
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
