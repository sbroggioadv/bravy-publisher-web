/**
 * Pintura de um SceneSlide num <canvas> via o MESMO paintSlide do scene-engine
 * (glyph-a-glyph). Garante paridade pixel com o render skia do server: preview,
 * thumbnail e export usam exatamente esta função.
 */
import { paintSlide, type Ctx2D, type MetricsProvider, type SceneSlide } from '@publisher/scene-engine'

// ---- cache global de imagens da cena (user image nodes) ----
const imageCache = new Map<string, HTMLImageElement>()
const imagePending = new Set<string>()
const imageListeners = new Set<() => void>()

/** Resolve um src em HTMLImageElement; inicia o load e notifica quando chegar. */
export function resolveSceneImage(src: string): HTMLImageElement | undefined {
  const hit = imageCache.get(src)
  if (hit) return hit
  if (!imagePending.has(src) && typeof Image !== 'undefined') {
    imagePending.add(src)
    const img = new Image()
    img.crossOrigin = 'anonymous' // evita taint do canvas no export
    img.onload = () => {
      imageCache.set(src, img)
      imagePending.delete(src)
      imageListeners.forEach((l) => l())
    }
    img.onerror = () => imagePending.delete(src)
    img.src = src
  }
  return undefined
}

/** Re-pinta quando alguma imagem da cena terminar de carregar. */
export function onSceneImageLoad(listener: () => void): () => void {
  imageListeners.add(listener)
  return () => {
    imageListeners.delete(listener)
  }
}

export function paintToCanvas(
  canvas: HTMLCanvasElement,
  slide: SceneSlide,
  metrics: MetricsProvider,
  pixelRatio = 1,
): void {
  canvas.width = Math.round(slide.width * pixelRatio)
  canvas.height = Math.round(slide.height * pixelRatio)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, slide.width, slide.height)
  paintSlide(ctx as unknown as Ctx2D, slide, metrics, { resolveImage: resolveSceneImage })
}

/** Export offscreen em alta (2x default → 2160²). Slide-a-slide p/ poupar memória. */
export async function exportSlideBlob(
  slide: SceneSlide,
  metrics: MetricsProvider,
  pixelRatio = 2,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  paintToCanvas(canvas, slide, metrics, pixelRatio)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob falhou'))), 'image/png')
  })
}
