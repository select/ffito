/**
 * svgPath.ts — Rasterize an SVG path string into a polygon
 * using the browser's built-in SVGPathElement.getTotalLength /
 * getPointAtLength API.
 *
 * Returns an array of {x, y} points suitable for hatch clipping.
 * The resolution (number of sample points) scales with path length.
 */

export function pathToPolygon(
  d: string,
  samplesPerUnit = 0.5,
  minSamples = 32,
): { x: number; y: number }[] {
  if (!d) return [];

  // Create an off-screen SVG to host the path element
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg") as SVGSVGElement;
  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  svg.style.pointerEvents = "none";
  svg.style.width = "0";
  svg.style.height = "0";
  document.body.appendChild(svg);

  const path = document.createElementNS(ns, "path") as SVGPathElement;
  path.setAttribute("d", d);
  svg.appendChild(path);

  const len = path.getTotalLength();
  const nSamples = Math.max(minSamples, Math.ceil(len * samplesPerUnit));
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i < nSamples; i++) {
    const pt = path.getPointAtLength((i / nSamples) * len);
    pts.push({ x: pt.x, y: pt.y });
  }

  document.body.removeChild(svg);
  return pts;
}

/**
 * Get the SVG viewport transform for a given SVG string.
 * Returns viewBox values, or {x:0, y:0, w:800, h:600} as fallback.
 */
export function parseSvgViewBox(svgText: string): { x: number; y: number; w: number; h: number } {
  const match = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (match) {
    const parts = match[1]!.trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      return { x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
    }
  }
  // Fall back to width/height attributes
  const wm = svgText.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const hm = svgText.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  const w = wm ? parseFloat(wm[1]!) : 800;
  const h = hm ? parseFloat(hm[1]!) : 600;
  return { x: 0, y: 0, w: isNaN(w) ? 800 : w, h: isNaN(h) ? 600 : h };
}
