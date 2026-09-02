import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
// @ts-ignore
import ffprobeStatic from 'ffprobe-static';

const require = createRequire(import.meta.url);

// Robust stability and memory flags for Windows
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function getDumpDirectory(): string {
  if (isDev) {
    return path.join(__dirname, '..', 'dump');
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'dump');
  }
  // First try next to the executable (ideal for standalone multi-folder package)
  const exeDir = path.dirname(app.getPath('exe'));
  const exeDump = path.join(exeDir, 'dump');
  try {
    if (!fs.existsSync(exeDump)) {
      fs.mkdirSync(exeDump, { recursive: true });
    }
    // Test write capability
    const testFile = path.join(exeDump, '.probe_write');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return exeDump;
  } catch (_) {
    // If installed in Program Files or non-writable path, fallback to AppData userData/dump
    const userDataDump = path.join(app.getPath('userData'), 'dump');
    try {
      if (!fs.existsSync(userDataDump)) {
        fs.mkdirSync(userDataDump, { recursive: true });
      }
    } catch (_) {}
    return userDataDump;
  }
}

const dumpPath = getDumpDirectory();

function cleanAllPreviousCaches() {
  try {
    if (fs.existsSync(dumpPath)) {
      const items = fs.readdirSync(dumpPath);
      for (const item of items) {
        if (item === '.probe_write') continue;
        const full = path.join(dumpPath, item);
        try {
          if (fs.statSync(full).isDirectory()) {
            fs.rmSync(full, { recursive: true, force: true });
          } else {
            fs.unlinkSync(full);
          }
        } catch (_) {}
      }
      console.log('[getThumbs] Cleaned previous dump cache on launch.');
    } else {
      fs.mkdirSync(dumpPath, { recursive: true });
    }
  } catch (err) {
    console.warn('[getThumbs] Failed to clean previous dump cache:', err);
  }
}

try {
  if (!fs.existsSync(dumpPath)) {
    fs.mkdirSync(dumpPath, { recursive: true });
  }
} catch (err) {
  console.error('[getThumbs] Failed to create dump path:', err);
}

function getBinaryPath(binaryName: 'ffmpeg' | 'ffprobe'): string {
  const resourcesPath = (process as any).resourcesPath || path.join(path.dirname(app.getPath('exe')), 'resources');
  const appPath = app.getAppPath();
  const exeDir = path.dirname(app.getPath('exe'));

  const possiblePaths = [
    // 1. Unpacked resources directory (Standard Electron Windows Multi-folder package / Portable Temp)
    binaryName === 'ffmpeg'
      ? path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
      : path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe'),
    binaryName === 'ffmpeg'
      ? path.join(appPath, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
      : path.join(appPath, 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe'),
    path.join(resourcesPath, `${binaryName}.exe`),
    path.join(exeDir, `${binaryName}.exe`),
    path.join(resourcesPath, 'bin', `${binaryName}.exe`),
    path.join(exeDir, 'bin', `${binaryName}.exe`),
    // 2. Static module fallbacks
    binaryName === 'ffmpeg'
      ? (typeof ffmpegStatic === 'string' ? ffmpegStatic : (ffmpegStatic as any)?.path)
      : (typeof ffprobeStatic === 'string' ? ffprobeStatic : (ffprobeStatic as any)?.path),
    // 3. Dev / working directory paths
    path.join(process.cwd(), 'node_modules', `${binaryName}-static`, `${binaryName}.exe`),
    path.join(process.cwd(), 'node_modules', `${binaryName}-static`, 'bin', 'win32', 'x64', `${binaryName}.exe`),
    path.join(__dirname, '..', 'node_modules', `${binaryName}-static`, `${binaryName}.exe`),
    path.join(__dirname, '..', 'node_modules', `${binaryName}-static`, 'bin', 'win32', 'x64', `${binaryName}.exe`),
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    const unpacked = p.replace(/app\.asar(?=[\\/]|$)/g, 'app.asar.unpacked');
    if (fs.existsSync(unpacked)) return unpacked;
    if (fs.existsSync(p)) return p;
  }
  return binaryName;
}

function writeCrashLog(type: string, message: string, stack?: string) {
  try {
    const logPath = path.join(dumpPath, 'crash.log');
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] [${type}] ${message}\n${stack || ''}\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write crash log:', err);
  }
}

// Global exception handling
process.on('uncaughtException', (error) => {
  console.error('[getThumbs] Uncaught Exception:', error);
  writeCrashLog('MainProcess_UncaughtException', error.message, error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[getThumbs] Unhandled Rejection:', reason);
  writeCrashLog('MainProcess_UnhandledRejection', String(reason), reason instanceof Error ? reason.stack : undefined);
});

app.on('render-process-gone', (_event, _webContents, details) => {
  writeCrashLog('RenderProcessGone', `Reason: ${details.reason}, ExitCode: ${details.exitCode}`);
});

app.on('child-process-gone', (_event, details) => {
  writeCrashLog('ChildProcessGone', `Type: ${details.type}, Reason: ${details.reason}, ExitCode: ${details.exitCode}, Name: ${details.name}`);
});

const SYSTEM_FILES_TO_IGNORE = new Set([
  'thumbs.db', '.ds_store', 'desktop.ini', 'folder.jpg', 'icon\r'
]);

function shouldIgnoreFile(filename: string): boolean {
  if (!filename) return true;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return true; // Completely ignore PDFs
  return lower.startsWith('.') || SYSTEM_FILES_TO_IGNORE.has(lower);
}

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.3gp', 
  '.mpeg', '.mpg', '.vob', '.ogv', '.m2ts', '.mts', '.divx', '.f4v', '.rmvb', '.rm', 
  '.asf', '.mxf', '.dv', '.m2v', '.mpv', '.m4p', '.qt', '.yuv', '.264', '.hevc', '.h265', '.h264'
]);

function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

async function scanDirectoryRecursive(dirPath: string): Promise<Array<{ name: string; path: string; size: number }>> {
  const results: Array<{ name: string; path: string; size: number }> = [];

  async function walk(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      // Sort entries alphabetically to preserve physical sector locality on HDDs
      entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== '$RECYCLE.BIN' && entry.name !== 'System Volume Information' && entry.name !== 'node_modules') {
            await walk(fullPath);
          }
        } else if (entry.isFile() && !shouldIgnoreFile(entry.name) && isVideoFile(entry.name)) {
          try {
            const stat = await fs.promises.stat(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              size: stat.size,
            });
          } catch (_) {
            results.push({
              name: entry.name,
              path: fullPath,
              size: 0,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[getThumbs] Failed to read dir: ${dir}`, err);
    }
  }

  try {
    await walk(dirPath);
  } catch (_) {}
  return results;
}

function getIndexHtmlPath(): string {
  const possiblePaths = [
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, '..', 'dist', 'index.html');
}

function getPreloadPath(): string {
  const cjsPath = path.join(__dirname, 'preload.cjs');
  if (fs.existsSync(cjsPath)) return cjsPath;
  return path.join(__dirname, 'preload.js');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 840,
    minHeight: 310,
    frame: false,
    show: false,
    backgroundColor: '#05070d',
    title: 'getThumbs',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174').catch(() => {
      mainWindow?.loadFile(getIndexHtmlPath());
    });
  } else {
    mainWindow.loadFile(getIndexHtmlPath());
  }

  mainWindow.once('ready-to-show', () => {
    // Purge any persistent Chromium cache and storage partitions on fresh start
    if (mainWindow?.webContents?.session) {
      mainWindow.webContents.session.clearCache().catch(() => {});
      mainWindow.webContents.session.clearStorageData({
        storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      }).catch(() => {});
    }
    mainWindow?.show();
  });

  mainWindow.on('restore', () => {
    mainWindow?.webContents.invalidate();
  });

  mainWindow.on('focus', () => {
    mainWindow?.webContents.invalidate();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: true });
    mainWindow?.webContents.invalidate();
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: false });
    mainWindow?.webContents.invalidate();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// High-Performance Bounded Extraction Queue configured for 300 parallel workers
class ExtractionQueue {
  private concurrency: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = () => {
        this.running++;
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.running--;
            this.next();
          });
      };

      if (this.running < this.concurrency) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private next() {
    if (this.running < this.concurrency && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) nextTask();
    }
  }

  clear() {
    this.queue = [];
  }
}

// 300 Parallel Extraction Workers
const MAX_CONCURRENT_EXTRACTIONS = 300;
const extractionQueue = new ExtractionQueue(MAX_CONCURRENT_EXTRACTIONS);

function setupIPC() {
  ipcMain.handle('crash:log', (_event, errorInfo: string) => {
    writeCrashLog('RendererProcessError', errorInfo);
    return true;
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      win?.minimize();
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('window:maximize', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
          return false;
        } else {
          win.maximize();
          return true;
        }
      }
    } catch (_) {}
    return false;
  });

  ipcMain.handle('window:close', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      win?.close();
      return true;
    } catch (_) {
      return false;
    }
  });

  let lastExpandedHeight = 760;

  ipcMain.handle('window:setCompactMode', (_event, isCompact: boolean) => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (!win) return false;
      if (win.isMaximized()) return true;

      const bounds = win.getBounds();
      if (isCompact) {
        if (bounds.height > 400) {
          lastExpandedHeight = bounds.height;
        }
        win.setMinimumSize(840, 310);
        win.setSize(bounds.width, 340, true);
      } else {
        win.setMinimumSize(840, 580);
        win.setSize(bounds.width, Math.max(lastExpandedHeight, 720), true);
      }
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('window:isMaximized', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      return win ? win.isMaximized() : false;
    } catch (_) {
      return false;
    }
  });

  // Dialog: Select Video Files
  ipcMain.handle('dialog:openVideoFiles', async () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const res = win 
        ? await dialog.showOpenDialog(win, {
            title: 'Select Video Files',
            properties: ['openFile', 'multiSelections'],
            filters: [
              { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts', '3gp', 'mpeg', 'mpg'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          })
        : await dialog.showOpenDialog({
            title: 'Select Video Files',
            properties: ['openFile', 'multiSelections'],
            filters: [
              { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts', '3gp', 'mpeg', 'mpg'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) return [];
      return res.filePaths.map(filePath => ({
        name: path.basename(filePath),
        path: filePath,
        size: 0
      }));
    } catch (err) {
      console.error('[getThumbs] Error in dialog:openVideoFiles:', err);
      return [];
    }
  });

  // Dialog: Select Folder
  ipcMain.handle('dialog:openFolder', async () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const res = win
        ? await dialog.showOpenDialog(win, {
            title: 'Select Video Folder to Scan',
            properties: ['openDirectory', 'multiSelections'],
          })
        : await dialog.showOpenDialog({
            title: 'Select Video Folder to Scan',
            properties: ['openDirectory', 'multiSelections'],
          });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) return [];
      const allResults: Array<{ name: string; path: string; size: number }> = [];
      for (const dirPath of res.filePaths) {
        const found = await scanDirectoryRecursive(dirPath);
        for (let i = 0; i < found.length; i++) {
          allResults.push(found[i]);
        }
      }
      return allResults;
    } catch (err) {
      console.error('[getThumbs] Error in dialog:openFolder:', err);
      return [];
    }
  });

  // Scan Specific Folder Paths or Files
  ipcMain.handle('fs:scanFolders', async (_event, folderPaths: string[]) => {
    const allResults: Array<{ name: string; path: string; size: number }> = [];
    if (!Array.isArray(folderPaths)) return allResults;
    for (const fPath of folderPaths) {
      try {
        const stats = await fs.promises.stat(fPath).catch(() => null);
        if (stats?.isDirectory()) {
          const found = await scanDirectoryRecursive(fPath);
          for (let i = 0; i < found.length; i++) {
            allResults.push(found[i]);
          }
        } else if (stats?.isFile() && isVideoFile(fPath)) {
          allResults.push({
            name: path.basename(fPath),
            path: fPath,
            size: stats.size
          });
        }
      } catch (_) {}
    }
    return allResults;
  });

  // Reveal in Windows Explorer
  ipcMain.handle('fs:reveal', async (_event, filePath: string) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
      }
    } catch (_) {}
    return false;
  });

  // Open file natively
  ipcMain.handle('fs:openFile', async (_event, filePath: string) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return true;
      }
    } catch (_) {}
    return false;
  });

  // Create password protected zip from extracted thumbnails
  ipcMain.handle('fs:createProtectedZip', async (_event, password: string, filePaths: string[]) => {
    try {
      if (!fs.existsSync(dumpPath)) fs.mkdirSync(dumpPath, { recursive: true });
      
      const zipPath = path.join(dumpPath, `protected_thumbs_${Date.now()}.zip`);
      const output = fs.createWriteStream(zipPath);
      
      // On-demand load archiver and plugin
      const archiver = require('archiver');
      const archiverZipEncrypted = require('archiver-zip-encrypted');
      if (archiver && typeof archiver.registerFormat === 'function') {
        try {
          archiver.registerFormat('zip-encrypted', archiverZipEncrypted);
        } catch (_) {}
      }

      return new Promise<{success: boolean; path?: string; error?: string}>((resolve) => {
        // @ts-ignore
        const archive = archiver('zip-encrypted', {
          zlib: { level: 9 },
          encryptionMethod: 'aes256',
          password: password
        });

        output.on('close', () => {
          try {
            if (fs.existsSync(zipPath)) {
              shell.showItemInFolder(zipPath);
            }
          } catch (_) {}
          resolve({ success: true, path: zipPath });
        });
        archive.on('error', (err: any) => resolve({ success: false, error: err.message }));

        archive.pipe(output);

        for (const file of filePaths) {
          if (fs.existsSync(file)) {
            archive.file(file, { name: path.basename(file) });
          }
        }

        archive.finalize();
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Active process registry and cancellation state for instantaneous task elimination
  const activeProcesses = new Set<any>();
  let isCancellationRequested = false;

  ipcMain.handle('process:cancelAll', async () => {
    isCancellationRequested = true;
    extractionQueue.clear();

    // 1. Immediately terminate all registered in-memory child processes
    for (const child of activeProcesses) {
      try {
        if (child && !child.killed) {
          child.kill('SIGKILL');
        }
      } catch (_) {}
    }
    activeProcesses.clear();

    // 2. Windows emergency cleanup for any lingering ffmpeg/ffprobe tasks
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/F', '/IM', 'ffmpeg.exe', '/T'], { windowsHide: true, stdio: 'ignore' });
        spawn('taskkill', ['/F', '/IM', 'ffprobe.exe', '/T'], { windowsHide: true, stdio: 'ignore' });
      } catch (_) {}
    }

    setTimeout(() => {
      isCancellationRequested = false;
    }, 300);

    return { success: true };
  });

  // High-Performance Zero-Freeze Video Thumbnail Extractor
  ipcMain.handle('media:extractThumbnail', async (_event, filePath: string) => {
    if (isCancellationRequested) {
      return { success: false, error: 'Operation cancelled by user' };
    }

    // Wrap execution inside bounded 300-worker queue
    return extractionQueue.run(async () => {
      if (isCancellationRequested) {
        return { success: false, error: 'Operation cancelled by user' };
      }

      try {
        const parsed = path.parse(filePath);
        const fileHash = crypto.createHash('md5').update(filePath).digest('hex').substring(0, 8);
        const outName = `${parsed.name}_${fileHash}.jpg`;
        const outputPath = path.join(dumpPath, outName);

        // Instant Cache Check
        try {
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            if (stats.size > 200) {
              return { success: true, path: outputPath };
            }
          }
        } catch (_) {}

        if (isCancellationRequested) {
          return { success: false, error: 'Operation cancelled by user' };
        }

        const ffmpegBin = getBinaryPath('ffmpeg');
        const ffprobeBin = getBinaryPath('ffprobe');

        // Helper: Safe atomic write to disk with retry
        const safeWriteFile = async (dest: string, data: Buffer): Promise<boolean> => {
          for (let attempt = 0; attempt < 3; attempt++) {
            if (isCancellationRequested) return false;
            try {
              await fs.promises.writeFile(dest, data);
              return true;
            } catch (err) {
              await new Promise(r => setTimeout(r, 40 * (attempt + 1)));
            }
          }
          return false;
        };

        const killChild = (child: any) => {
          try {
            if (child) {
              activeProcesses.delete(child);
              if (!child.killed) {
                child.kill('SIGKILL');
              }
            }
          } catch (_) {}
        };

        // Probe video duration with ffprobe using lightweight 1MB probe to prevent HDD seek stall
        const getVideoDuration = (targetFile: string, timeoutMs = 2000): Promise<number | null> => {
          if (isCancellationRequested) return Promise.resolve(null);
          return new Promise((resolve) => {
            try {
              const child = spawn(ffprobeBin, [
                '-v', 'error',
                '-probesize', '1048576',
                '-analyzeduration', '1000000',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                targetFile
              ], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });

              activeProcesses.add(child);
              let out = '';
              let finished = false;

              child.stdout?.on('data', (chunk: Buffer) => {
                if (!isCancellationRequested) out += chunk.toString('utf8');
              });

              child.on('close', () => {
                activeProcesses.delete(child);
                if (finished) return;
                finished = true;
                const parsedDur = parseFloat(out.trim());
                if (!isNaN(parsedDur) && parsedDur > 0) {
                  resolve(parsedDur);
                } else {
                  resolve(null);
                }
              });

              child.on('error', () => {
                activeProcesses.delete(child);
                if (finished) return;
                finished = true;
                resolve(null);
              });

              setTimeout(() => {
                if (finished) return;
                finished = true;
                killChild(child);
                resolve(null);
              }, timeoutMs);
            } catch (_) {
              resolve(null);
            }
          });
        };

        // Extract via stdout pipe directly into memory buffer (scaled to 480px width for 10x speed & minimal RAM)
        const runFfmpegBuffer = (args: string[], timeoutMs = 3000): Promise<Buffer | null> => {
          if (isCancellationRequested) return Promise.resolve(null);
          return new Promise((resolve) => {
            try {
              const child = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
              activeProcesses.add(child);
              const chunks: Buffer[] = [];
              let finished = false;

              child.stdout?.on('data', (chunk: Buffer) => {
                if (!isCancellationRequested) chunks.push(chunk);
              });

              child.on('close', () => {
                activeProcesses.delete(child);
                if (finished) return;
                finished = true;
                const result = Buffer.concat(chunks);
                if (result.length > 200) resolve(result);
                else resolve(null);
              });

              child.on('error', () => {
                activeProcesses.delete(child);
                if (finished) return;
                finished = true;
                resolve(null);
              });

              setTimeout(() => {
                if (finished) return;
                finished = true;
                killChild(child);
                const result = Buffer.concat(chunks);
                if (result.length > 200) resolve(result);
                else resolve(null);
              }, timeoutMs);
            } catch (_) {
              resolve(null);
            }
          });
        };

        // Fallback: Direct file output
        const runFfmpegFile = (args: string[], timeoutMs = 3500): Promise<boolean> => {
          if (isCancellationRequested) return Promise.resolve(false);
          return new Promise((resolve) => {
            try {
              const child = spawn(ffmpegBin, args, { stdio: 'ignore', windowsHide: true });
              activeProcesses.add(child);
              let finished = false;

              child.on('close', (code) => {
                activeProcesses.delete(child);
                if (finished) return;
                finished = true;
                const ok = (code === 0 || fs.existsSync(outputPath)) && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 200;
                resolve(ok);
              });

              child.on('error', () => {
                activeProcesses.delete(child);
                if (finished) return;
                finished = true;
                resolve(false);
              });

              setTimeout(() => {
                if (finished) return;
                finished = true;
                killChild(child);
                resolve(fs.existsSync(outputPath) && fs.statSync(outputPath).size > 200);
              }, timeoutMs);
            } catch (_) {
              resolve(false);
            }
          });
        };

        // 1. Probe video duration to avoid first 10s and last 10s
        const videoDuration = await getVideoDuration(filePath, 2000);

        // 2. Calculate safe thumbnail extraction timestamp
        let seekTimeSec = 10.5;
        if (videoDuration && videoDuration > 0) {
          if (videoDuration > 20) {
            // Strictly exclude first 10s & last 10s, pick optimal midpoint frame
            seekTimeSec = Math.max(10, Math.min(videoDuration - 10, videoDuration / 2));
          } else {
            // Short video fallback (<= 20s): Proportional midpoint fallback avoiding edge boundaries
            seekTimeSec = Math.max(0.5, Math.min(videoDuration - 0.5, videoDuration / 2));
          }
        }
        const seekTimeStr = seekTimeSec.toFixed(2);

        if (isCancellationRequested) return { success: false, error: 'Cancelled' };

        // Tier 1: Fast Seek at calculated safe offset (excludes first & last 10s + fastseek on HDD)
        try {
          const buf = await runFfmpegBuffer([
            '-y',
            '-noaccurate_seek',
            '-fflags', '+fastseek+nobuffer',
            '-probesize', '1048576',
            '-analyzeduration', '1000000',
            '-ss', seekTimeStr,
            '-i', filePath,
            '-map', '0:v:0?',
            '-an', '-sn',
            '-threads', '1',
            '-vf', "scale='min(480,iw)':-2,format=yuvj420p",
            '-vframes', '1',
            '-f', 'image2pipe',
            '-vcodec', 'mjpeg',
            '-q:v', '3',
            'pipe:1'
          ], 2500);
          if (buf) {
            const written = await safeWriteFile(outputPath, buf);
            if (written) return { success: true, path: outputPath };
          }
        } catch (_) {}

        if (isCancellationRequested) return { success: false, error: 'Cancelled' };

        // Tier 2: Accurate Seek Fallback at calculated safe offset
        try {
          const buf = await runFfmpegBuffer([
            '-y',
            '-fflags', '+fastseek+nobuffer',
            '-probesize', '2097152',
            '-analyzeduration', '1000000',
            '-ss', seekTimeStr,
            '-i', filePath,
            '-map', '0:v:0?',
            '-an', '-sn',
            '-threads', '1',
            '-vf', "scale='min(480,iw)':-2,format=yuvj420p",
            '-vframes', '1',
            '-f', 'image2pipe',
            '-vcodec', 'mjpeg',
            '-q:v', '3',
            'pipe:1'
          ], 3000);
          if (buf) {
            const written = await safeWriteFile(outputPath, buf);
            if (written) return { success: true, path: outputPath };
          }
        } catch (_) {}

        if (isCancellationRequested) return { success: false, error: 'Cancelled' };

        // Tier 3: Direct File Output Fallback at calculated safe offset
        try {
          const ok = await runFfmpegFile([
            '-y',
            '-err_detect', 'ignore_err',
            '-fflags', '+genpts+discardcorrupt+fastseek',
            '-probesize', '2097152',
            '-analyzeduration', '1000000',
            '-ss', seekTimeStr,
            '-i', filePath,
            '-an', '-sn',
            '-threads', '1',
            '-vf', "scale='min(480,iw)':-2,format=yuvj420p",
            '-vframes', '1',
            '-q:v', '3',
            outputPath
          ], 3500);
          if (ok) return { success: true, path: outputPath };
        } catch (_) {}

        return { success: false, error: 'FFmpeg extraction failed' };
      } catch (err: any) {
        writeCrashLog('VideoExtractionError', `Exception extracting ${filePath}: ${err?.message || String(err)}`);
        return { success: false, error: err?.message || String(err) };
      }
    });
  });

  // Save custom thumbnail (for HTML5 video / canvas fallback)
  ipcMain.handle('media:saveCustomThumb', async (_event, fileName: string, dataUrl: string) => {
    try {
      const parsed = path.parse(fileName);
      const fileHash = crypto.createHash('md5').update(fileName).digest('hex').substring(0, 8);
      const outName = `${parsed.name}_${fileHash}.jpg`;
      const outputPath = path.join(dumpPath, outName);
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.promises.writeFile(outputPath, buffer);
      return { success: true, path: outputPath };
    } catch (err: any) {
      writeCrashLog('SaveCustomThumbError', `Failed saving custom thumb for ${fileName}: ${err?.message}`);
      return { success: false, error: err.message };
    }
  });
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    cleanAllPreviousCaches();

    const ffmpegPath = getBinaryPath('ffmpeg');
    const ffprobePath = getBinaryPath('ffprobe');
        
    try {
      ffmpeg.setFfmpegPath(ffmpegPath);
      ffmpeg.setFfprobePath(ffprobePath);
    } catch (e) {
      console.error('[getThumbs] Failed setting ffmpeg/ffprobe paths:', e);
    }

    setupIPC();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
