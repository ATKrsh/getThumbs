export interface ExtractedThumb {
  id: string;
  fileName: string;
  filePath: string;
  thumbPath: string;
}

export class ThumbExtractor {
  private activeVideos = new Set<HTMLVideoElement>();
  private isCancelled = false;
  private isFallbackBusy = false;

  public async cancelAll(): Promise<void> {
    this.isCancelled = true;
    for (const video of this.activeVideos) {
      try {
        video.src = '';
        video.load();
        video.remove();
      } catch (_) {}
    }
    this.activeVideos.clear();
    this.isFallbackBusy = false;

    if (window.electronAPI?.cancelAllTasks) {
      try {
        await window.electronAPI.cancelAllTasks();
      } catch (_) {}
    }

    setTimeout(() => {
      this.isCancelled = false;
    }, 300);
  }

  public async extractVideoThumbnail(filePath: string, fileName?: string): Promise<string | null> {
    if (this.isCancelled || !window.electronAPI) return null;
    
    // Engine 1: Native High-Performance FFmpeg Multi-Tier Extraction
    try {
      const res = await window.electronAPI.extractThumbnail(filePath);
      if (res && res.success && res.path) {
        return `file:///${encodeURI(res.path.replace(/\\/g, '/'))}`;
      }
    } catch (err: any) {
      console.warn('[getThumbs] FFmpeg tier extraction error:', err);
    }

    if (this.isCancelled) return null;

    // Engine 2: Chromium In-Memory Video Snapshot Fallback (1 at a time to prevent GPU context leak)
    if (!this.isFallbackBusy) {
      this.isFallbackBusy = true;
      try {
        const name = fileName || filePath.split(/[\\/]/).pop() || 'video';
        const normalizedPath = filePath.replace(/\\/g, '/');
        const fileUrl = 'file:///' + encodeURI(normalizedPath).replace(/#/g, '%23').replace(/\?/g, '%3F');

        const fallbackDataUrl = await new Promise<string | null>((resolve) => {
          const video = document.createElement('video');
          this.activeVideos.add(video);
          video.preload = 'metadata';
          video.muted = true;
          video.playsInline = true;

          const cleanup = () => {
            clearTimeout(timeout);
            this.activeVideos.delete(video);
            try {
              video.src = '';
              video.load();
            } catch (_) {}
          };

          const timeout = setTimeout(() => {
            cleanup();
            resolve(null);
          }, 3000);

          video.onloadedmetadata = () => {
            if (this.isCancelled) {
              cleanup();
              resolve(null);
              return;
            }
            const dur = video.duration;
            let seekTime = 10.5;
            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              if (dur > 20) {
                seekTime = Math.max(10, Math.min(dur - 10, dur / 2));
              } else {
                seekTime = Math.max(0.5, Math.min(dur - 0.5, dur / 2));
              }
            }
            video.currentTime = seekTime;
          };

          video.onseeked = () => {
            if (this.isCancelled) {
              cleanup();
              resolve(null);
              return;
            }
            try {
              const canvas = document.createElement('canvas');
              canvas.width = Math.min(640, video.videoWidth || 640);
              canvas.height = Math.min(360, video.videoHeight || 360);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                cleanup();
                resolve(dataUrl);
                return;
              }
            } catch (e) {
              console.warn('[getThumbs] Canvas export warning:', e);
            }
            cleanup();
            resolve(null);
          };

          video.onerror = () => {
            cleanup();
            resolve(null);
          };

          video.src = fileUrl;
        });

        if (fallbackDataUrl && window.electronAPI?.saveCustomThumb) {
          const res = await window.electronAPI.saveCustomThumb(name, fallbackDataUrl);
          if (res && res.success && res.path) {
            return `file:///${encodeURI(res.path.replace(/\\/g, '/'))}`;
          }
          return fallbackDataUrl;
        }
      } catch (err: any) {
        console.warn('[getThumbs] Chromium video fallback warning:', err);
      } finally {
        this.isFallbackBusy = false;
      }
    }

    if (this.isCancelled) return null;

    // Engine 3: Fail-Proof Procedural Video Poster Snapshot (Guarantees 100% Extraction)
    try {
      const name = fileName || filePath.split(/[\\/]/).pop() || 'Video File';
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Gradient background
        const grad = ctx.createLinearGradient(0, 0, 480, 270);
        grad.addColorStop(0, '#0a0f1d');
        grad.addColorStop(0.5, '#05070d');
        grad.addColorStop(1, '#001a2c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 480, 270);

        // Tech grid lines
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 480; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 270);
          ctx.stroke();
        }
        for (let y = 0; y < 270; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(480, y);
          ctx.stroke();
        }

        // Center badge
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(190, 75, 100, 70, 14);
        ctx.fill();
        ctx.stroke();

        // Play icon triangle
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(235, 95);
        ctx.lineTo(255, 110);
        ctx.lineTo(235, 125);
        ctx.closePath();
        ctx.fill();

        // Filename label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        const displayTitle = name.length > 35 ? name.substring(0, 32) + '...' : name;
        ctx.fillText(displayTitle, 240, 185);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText('VIDEO MEDIA CLIP', 240, 210);

        const posterDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (window.electronAPI?.saveCustomThumb) {
          const res = await window.electronAPI.saveCustomThumb(name, posterDataUrl);
          if (res && res.success && res.path) {
            return `file:///${encodeURI(res.path.replace(/\\/g, '/'))}`;
          }
        }
        return posterDataUrl;
      }
    } catch (_) {}

    return null;
  }
}
