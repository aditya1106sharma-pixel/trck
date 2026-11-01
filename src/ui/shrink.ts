import { fitSize } from '../lib/photo'

/** Draws a photo at most 1024 px on its long side and returns JPEG base64. Nothing is written to storage. */
export async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const { w, h } = fitSize(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const url = c.toDataURL('image/jpeg', 0.8)
  c.width = c.height = 0
  return url.slice(url.indexOf(',') + 1)
}
