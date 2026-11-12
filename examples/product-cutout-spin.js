import { Capacitor } from '@capacitor/core';
import { ProductCutout } from '../src/product-cutout.js';

export async function makeSpinFrames(videoPath, viewer, onProgress = () => {}) {
  const progressHandle = await ProductCutout.addListener('progress', ({ done, total }) => {
    onProgress(Math.round((done / total) * 100));
  });

  try {
    const { frames } = await ProductCutout.processVideo({
      path: videoPath,
      count: 36,
      width: 720,
    });
    const webViewFrames = frames.map(path => Capacitor.convertFileSrc(path));
    await viewer.setFrames(webViewFrames);
    return webViewFrames;
  } finally {
    await progressHandle.remove();
  }
}
