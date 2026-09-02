import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';

console.log('ffmpegStatic path:', ffmpegStatic);
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Generate a dummy file to test
import fs from 'fs';
fs.writeFileSync('test.txt', 'dummy');

ffmpeg()
  .input('test.txt')
  .on('error', (err) => {
    console.error('Expected error:', err.message);
  })
  .save('out.mp4');
