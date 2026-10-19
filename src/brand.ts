// Official Westpac logomark from the GEL design system
// (github.com/WestpacGEL/GEL-next packages/ui/src/components/symbol/components/logos/wbc-logo.tsx).
export const WESTPAC_RED = '#DA1710';
export const LOGO_VIEWBOX = { width: 69, height: 28 };
export const LOGO_PATHS = [
  'M24.0303 25.0896L17.3333 4.1147C16.447 0.903226 14.7727 0 12.4091 0H0C0.984848 0.401434 1.57576 2.91039 1.57576 2.91039L7.58333 23.9857C8.27273 26.595 10.4394 28 12.9015 28H26C25.0152 27.8996 24.0303 25.0896 24.0303 25.0896Z',
  'M44.9697 25.0896L51.6667 4.1147C52.553 0.903226 54.2273 0 56.5909 0H69C68.0152 0.401434 67.4242 2.91039 67.4242 2.91039L61.4167 23.9857C60.7273 26.595 58.5606 28 56.0985 28H43C43.9848 27.8996 44.9697 25.0896 44.9697 25.0896Z',
  'M42 0H27V28H42V0Z',
];

/** Draws the logomark onto a 2D canvas, `width` pixels wide with its top-left at (x, y), with a white cartoon outline. */
export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  const scale = width / LOGO_VIEWBOX.width;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const paths = LOGO_PATHS.map((d) => new Path2D(d));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  for (const p of paths) ctx.stroke(p);
  ctx.fillStyle = WESTPAC_RED;
  for (const p of paths) ctx.fill(p);
  ctx.restore();
}

export const LOGO_SVG = `<svg viewBox="0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}" role="img" aria-label="Westpac">${LOGO_PATHS.map(
  (d) => `<path d="${d}" fill="${WESTPAC_RED}"/>`,
).join('')}</svg>`;
