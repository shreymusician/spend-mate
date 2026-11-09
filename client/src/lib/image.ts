const SIZE = 256;

/**
 * Turns a photo chosen on the phone into a small square JPEG (256 × 256, a few tens of KB) so it uploads
 * fast on slow data and fits the server's limit. The picture is centre-cropped; phone camera rotation is respected.
 */
export async function photoToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('That photo couldn’t be opened. Please try another one.');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser can’t resize photos.');
  ctx.fillStyle = '#fff'; // JPEG has no transparency
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  let q = 0.85;
  let out = canvas.toDataURL('image/jpeg', q);
  while (out.length > 80_000 && q > 0.4) { q -= 0.15; out = canvas.toDataURL('image/jpeg', q); }
  return out;
}
