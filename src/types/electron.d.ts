export interface FileItem {
  name: string;
  path: string;
  size: number;
}

export interface ElectronAPI {
  minimizeWindow: () => Promise<boolean>;
  maximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  setCompactMode?: (isCompact: boolean) => Promise<boolean>;
  onWindowStateChange?: (callback: (state: { isMaximized: boolean }) => void) => () => void;
  openVideoFiles: () => Promise<FileItem[]>;
  openFolder: () => Promise<FileItem[]>;
  scanFolders: (paths: string[]) => Promise<FileItem[]>;
  revealInExplorer: (filePath: string) => Promise<boolean>;
  openFile: (filePath: string) => Promise<boolean>;
  createProtectedZip: (password: string, filePaths: string[]) => Promise<{ success: boolean; path?: string; error?: string }>;
  logCrash: (info: string) => Promise<boolean>;
  extractThumbnail: (filePath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  saveCustomThumb?: (fileName: string, dataUrl: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  cancelAllTasks?: () => Promise<{ success: boolean }>;
  isElectron?: boolean;
}

declare module 'ffprobe-static' {
  const ffprobeStatic: { path: string };
  export default ffprobeStatic;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
