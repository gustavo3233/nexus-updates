type BackgroundTone = "dark" | "light";

const NEUTRAL_CHROMA_LIMIT = 14;
const DARK_BACKGROUND_MAX = 36;
const LIGHT_BACKGROUND_MIN = 220;

function channels(data: Uint8ClampedArray, point: number) {
  const index = point * 4;
  return { red: data[index], green: data[index + 1], blue: data[index + 2], alpha: data[index + 3] };
}

function isNeutral({ red, green, blue, alpha }: ReturnType<typeof channels>) {
  return alpha > 0 && Math.max(red, green, blue) - Math.min(red, green, blue) <= NEUTRAL_CHROMA_LIMIT;
}

function toneOf(pixel: ReturnType<typeof channels>): BackgroundTone | null {
  if (!isNeutral(pixel)) return null;
  const brightness = (pixel.red + pixel.green + pixel.blue) / 3;
  if (brightness <= DARK_BACKGROUND_MAX) return "dark";
  if (brightness >= LIGHT_BACKGROUND_MIN) return "light";
  return null;
}

function boundaryPoints(width: number, height: number) {
  const points: number[] = [];
  for (let x = 0; x < width; x += 1) points.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) points.push(y * width, y * width + width - 1);
  return points;
}

/**
 * Remove somente preto ou branco neutro que esteja ligado à borda da imagem.
 * Isso cobre fundos sólidos e seus tons de anti-alias sem apagar cores do logo.
 */
export async function removeNeutralLogoBackground(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem para remoção do fundo.");
  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const points = boundaryPoints(canvas.width, canvas.height);
  const tones = points.reduce<Record<BackgroundTone, number>>((totals, point) => {
    const tone = toneOf(channels(pixels.data, point));
    if (tone) totals[tone] += 1;
    return totals;
  }, { dark: 0, light: 0 });
  const targetTone: BackgroundTone | null = tones.dark || tones.light ? (tones.dark > tones.light ? "dark" : "light") : null;
  if (!targetTone) return source;

  const isTargetBackground = (point: number) => toneOf(channels(pixels.data, point)) === targetTone;
  const seen = new Uint8Array(canvas.width * canvas.height);
  const queue = [...points];

  while (queue.length) {
    const point = queue.pop()!;
    if (seen[point] || !isTargetBackground(point)) continue;
    seen[point] = 1;
    pixels.data[point * 4 + 3] = 0;

    const x = point % canvas.width;
    const y = Math.floor(point / canvas.width);
    if (x > 0) queue.push(point - 1);
    if (x < canvas.width - 1) queue.push(point + 1);
    if (y > 0) queue.push(point - canvas.width);
    if (y < canvas.height - 1) queue.push(point + canvas.width);
  }

  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}
