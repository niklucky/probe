/**
 * Crop an image using canvas
 * @param imageSrc - URL or data URL of the image
 * @param pixelCrop - Cropped area pixels { x, y, width, height }
 * @param rotation - Rotation in degrees
 * @param outputWidth - Desired output width
 * @param outputHeight - Desired output height
 * @returns Blob of the cropped image
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation: number = 0,
  outputWidth: number = 100,
  outputHeight: number = 100
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Set canvas size to output size
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  // Calculate center of canvas
  const centerX = outputWidth / 2;
  const centerY = outputHeight / 2;

  // Draw rotated and cropped image
  ctx.translate(centerX, centerY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);

  // Draw the cropped area of the image scaled to fit output size
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob conversion failed'));
        }
      },
      'image/jpeg',
      0.9
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}
