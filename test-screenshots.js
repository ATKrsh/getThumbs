import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const filePath = 'test.mp4';
// Create a fake video file for testing
fs.writeFileSync(filePath, Buffer.from([])); // Empty file

const parsed = path.parse(filePath);
const outName = `${parsed.name}.jpg`;
const dumpPath = path.join(process.cwd(), 'dump');
if (!fs.existsSync(dumpPath)) {
  fs.mkdirSync(dumpPath, { recursive: true });
}

console.log('Running ffmpeg...');
ffmpeg(filePath)
  .screenshots({
      timestamps: ['50%'],
      filename: outName,
      folder: dumpPath
  })
  .on('end', () => {
      console.log('Success');
  })
  .on('error', (err) => {
      console.error('Error:', err.message);
  });
