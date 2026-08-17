export const VERTICAL = { width: 720, height: 1280, ratio: 9 / 16 };

export function coverCrop(srcW, srcH, destW = VERTICAL.width, destH = VERTICAL.height) {
  const sw = Math.max(1, srcW);
  const sh = Math.max(1, srcH);
  const srcRatio = sw / sh;
  const destRatio = destW / destH;

  let cropW = sw;
  let cropH = sh;

  if (srcRatio > destRatio) {
    cropW = sh * destRatio;
  } else {
    cropH = sw / destRatio;
  }

  const sx = (sw - cropW) / 2;
  const sy = (sh - cropH) / 2;

  return {
    sx,
    sy,
    sw: cropW,
    sh: cropH,
    dw: destW,
    dh: destH,
    isVertical: srcRatio <= 0.75,
  };
}

export function drawCover(ctx, video, destW, destH) {
  const crop = coverCrop(video.videoWidth || destW, video.videoHeight || destH, destW, destH);
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, destW, destH);
  return crop;
}
