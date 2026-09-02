import { contextBridge, ipcRenderer } from 'electron';

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
  openVideoFiles: () => Promise<FileItem[]>;
  openFolder: () => Promise<FileItem[]>;
  scanFolders: (paths: string[]) => Promise<FileItem[]>;
  revealInExplorer: (filePath: string) => Promise<boolean>;
  openFile: (filePath: string) => Promise<boolean>;
  createProtectedZip: (password: string, filePaths: string[]) => Promise<{ success: boolean; path?: string; error?: string }>;
  logCrash?: (info: string) => Promise<boolean>;
  extractThumbnail: (filePath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  saveCustomThumb?: (fileName: string, dataUrl: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  isElectron: boolean;
}

const electronAPI: ElectronAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setCompactMode: (isCompact: boolean) => ipcRenderer.invoke('window:setCompactMode', isCompact),
  openVideoFiles: () => ipcRenderer.invoke('dialog:openVideoFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolders: (paths: string[]) => ipcRenderer.invoke('fs:scanFolders', paths),
  revealInExplorer: (filePath: string) => ipcRenderer.invoke('fs:reveal', filePath),
  openFile: (filePath: string) => ipcRenderer.invoke('fs:openFile', filePath),
  createProtectedZip: (password: string, filePaths: string[]) => ipcRenderer.invoke('fs:createProtectedZip', password, filePaths),
  logCrash: (info: string) => ipcRenderer.invoke('crash:log', info),
  extractThumbnail: (filePath: string) => ipcRenderer.invoke('media:extractThumbnail', filePath),
  saveCustomThumb: (fileName: string, dataUrl: string) => ipcRenderer.invoke('media:saveCustomThumb', fileName, dataUrl),
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
