const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setCompactMode: (isCompact) => ipcRenderer.invoke('window:setCompactMode', isCompact),
  onWindowStateChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('window:state-changed', handler);
    return () => {
      ipcRenderer.removeListener('window:state-changed', handler);
    };
  },
  openVideoFiles: () => ipcRenderer.invoke('dialog:openVideoFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolders: (paths) => ipcRenderer.invoke('fs:scanFolders', paths),
  revealInExplorer: (filePath) => ipcRenderer.invoke('fs:reveal', filePath),
  openFile: (filePath) => ipcRenderer.invoke('fs:openFile', filePath),
  createProtectedZip: (password, filePaths) => ipcRenderer.invoke('fs:createProtectedZip', password, filePaths),
  logCrash: (info) => ipcRenderer.invoke('crash:log', info),
  extractThumbnail: (filePath) => ipcRenderer.invoke('media:extractThumbnail', filePath),
  saveCustomThumb: (fileName, dataUrl) => ipcRenderer.invoke('media:saveCustomThumb', fileName, dataUrl),
  cancelAllTasks: () => ipcRenderer.invoke('process:cancelAll'),
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
