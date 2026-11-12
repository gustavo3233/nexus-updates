export async function extractBrandColors(source: string, limit = 6): Promise<string[]> {
  const image = new Image(); image.src = source; await image.decode();
  const max = 120; const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return [];
  context.drawImage(image, 0, 0, canvas.width, canvas.height); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 16) {
    const [r, g, b, alpha] = [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
    if (alpha < 180) continue;
    const high = Math.max(r, g, b); const low = Math.min(r, g, b);
    if (high > 245 && low > 245) continue;
    const quantize = (value: number) => Math.min(255, Math.round(value / 32) * 32);
    const key = [quantize(r), quantize(g), quantize(b)].map((value) => value.toString(16).padStart(2, "0")).join("");
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([hex]) => `#${hex}`);
}
