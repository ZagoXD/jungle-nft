/** Responsive lossless WebP derivatives of the original Figma PNGs; originals remain the fallback. */
export function responsiveImage(source: string, sizes: string) {
  if (!/^\/images\/artwork\/[a-f\d]{40}\.png$/.test(source)) return {}
  const base = source.slice(0, -4)
  return {
    srcSet: `${base}-192.webp 192w, ${base}-384.webp 384w, ${base}-640.webp 640w, ${source} 1254w`,
    sizes,
  }
}
