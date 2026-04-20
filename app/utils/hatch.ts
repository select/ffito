/**
 * hatch.ts — Hatch-fill engine.
 *
 * Each HatchLayer produces a set of parallel sweep lines at its own angle.
 * computeHatchLayers() iterates all layers and returns combined segments.
 * All coordinates are in SVG user units (mm→SVG conversion happens in the caller).
 */

import type { HatchLayer } from "~/composables/useFfitoStore";

export interface Seg { x1: number; y1: number; x2: number; y2: number }

// ── Public entry point ────────────────────────────────────────────────────

/**
 * Compute hatch lines for all layers, clipped to the polygon.
 * Returns one flat array of segments across all layers.
 */
export function computeHatchLayers(
  polygon: { x: number; y: number }[],
  layers: HatchLayer[],
): Seg[] {
  if (polygon.length < 3 || layers.length === 0) return [];
  const result: Seg[] = [];
  for (const layer of layers) {
    result.push(
      ...sweepLines(polygon, layer.angle, layer.spacing, layer.borderInset, layer.connectLines),
    );
  }
  return result;
}

// ── Core sweep-line engine ────────────────────────────────────────────────

function sweepLines(
  poly: { x: number; y: number }[],
  angleDeg: number,
  spacing: number,
  inset: number,
  connectLines: boolean,
): Seg[] {
  if (spacing <= 0) return [];
  const bbox = polyBbox(poly);
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Try to apply inset; fall back to original polygon if it collapses/escapes
  let innerPoly = poly;
  if (inset > 0) {
    const shrunk = shrinkPolygon(poly, inset);
    const valid =
      shrunk.length >= 3 &&
      signedArea(shrunk) * signedArea(poly) > 0 &&
      shrunk.every((v) => pointInPolygon(v.x, v.y, poly));
    if (valid) innerPoly = shrunk;
    // else: silently fall back to no inset so the shape is still hatched
  }

  const diag = Math.hypot(bbox.w, bbox.h) * 1.5;
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;

  const segments: Seg[] = [];
  const lineCount = Math.ceil(diag / spacing);

  for (let i = -lineCount; i <= lineCount; i++) {
    const offset = i * spacing;
    const px = cx + offset * (-sin);
    const py = cy + offset * cos;

    const lx1 = px + cos * (-diag);
    const ly1 = py + sin * (-diag);
    const lx2 = px + cos * diag;
    const ly2 = py + sin * diag;

    const clipped = clipLineToPolygon(lx1, ly1, lx2, ly2, innerPoly);
    segments.push(...clipped);
  }

  if (!connectLines || segments.length < 2) return segments;

  // Serpentine: reverse every other segment so adjacent ends meet on the same side
  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 1) {
      const s = segments[i]!;
      [s.x1, s.y1, s.x2, s.y2] = [s.x2, s.y2, s.x1, s.y1];
    }
  }

  const connected: Seg[] = [];
  for (let i = 0; i < segments.length; i++) {
    connected.push(segments[i]!);
    if (i < segments.length - 1) {
      const a = segments[i]!;
      const b = segments[i + 1]!;
      // Small semicircular bow connecting end of a to start of b
      connected.push(...arcBow(a.x2, a.y2, b.x1, b.y1, spacing));
    }
  }
  return connected;
}

// ── Geometry helpers ──────────────────────────────────────────────────────

const ARC_STEPS = 8; // segments per semicircle bow

/**
 * Generate a semicircular bow (arc) from (x1,y1) to (x2,y2).
 * The arc bulges outward perpendicular to the chord.
 * `spacing` caps the bow radius so tight hatches stay proportional.
 */
function arcBow(
  x1: number, y1: number, x2: number, y2: number,
  spacing: number,
): Seg[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return [];

  // Bow radius: half spacing, capped so it never overwhelms
  const radius = Math.min(dist * 0.5, spacing * 0.5);

  // Perpendicular unit vector (bulge direction — consistent outward side)
  const px = -dy / dist;
  const py = dx / dist;

  const segs: Seg[] = [];
  let prevX = x1;
  let prevY = y1;

  for (let s = 1; s <= ARC_STEPS; s++) {
    const t = s / ARC_STEPS;
    // Linear interpolation along chord + sinusoidal bulge outward
    const nx = x1 + dx * t + px * radius * Math.sin(Math.PI * t);
    const ny = y1 + dy * t + py * radius * Math.sin(Math.PI * t);
    segs.push({ x1: prevX, y1: prevY, x2: nx, y2: ny });
    prevX = nx;
    prevY = ny;
  }

  // Snap last point exactly to target
  if (segs.length > 0) {
    const last = segs[segs.length - 1]!;
    last.x2 = x2;
    last.y2 = y2;
  }
  return segs;
}

function polyBbox(poly: { x: number; y: number }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function clipLineToPolygon(
  x1: number, y1: number, x2: number, y2: number,
  poly: { x: number; y: number }[],
): Seg[] {
  const ts: number[] = [];
  const n = poly.length;
  const dx = x2 - x1;
  const dy = y2 - y1;

  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const t = lineSegmentIntersectT(x1, y1, dx, dy, a.x, a.y, b.x - a.x, b.y - a.y);
    if (t !== null) ts.push(t);
  }

  if (ts.length < 2) return [];
  ts.sort((a, b) => a - b);

  const unique: number[] = [ts[0]!];
  for (let i = 1; i < ts.length; i++) {
    if (Math.abs(ts[i]! - unique[unique.length - 1]!) > 1e-8) {
      unique.push(ts[i]!);
    }
  }
  if (unique.length < 2) return [];

  const result: Seg[] = [];
  for (let i = 0; i < unique.length - 1; i++) {
    const ta = unique[i]!;
    const tb = unique[i + 1]!;
    const mx = x1 + (ta + tb) / 2 * dx;
    const my = y1 + (ta + tb) / 2 * dy;
    if (pointInPolygon(mx, my, poly)) {
      result.push({
        x1: x1 + ta * dx, y1: y1 + ta * dy,
        x2: x1 + tb * dx, y2: y1 + tb * dy,
      });
    }
  }
  return result;
}

function pointInPolygon(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]!.x, yi = poly[i]!.y;
    const xj = poly[j]!.x, yj = poly[j]!.y;
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function lineSegmentIntersectT(
  px: number, py: number, dx: number, dy: number,
  qx: number, qy: number, ex: number, ey: number,
): number | null {
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((qx - px) * ey - (qy - py) * ex) / denom;
  const s = ((qx - px) * dy - (qy - py) * dx) / denom;
  if (s < 0 || s > 1) return null;
  return t;
}

function signedArea(poly: { x: number; y: number }[]): number {
  let area = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function shrinkPolygon(
  poly: { x: number; y: number }[],
  amount: number,
): { x: number; y: number }[] {
  const n = poly.length;
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n]!;
    const cur = poly[i]!;
    const next = poly[(i + 1) % n]!;
    const d1x = cur.x - prev.x, d1y = cur.y - prev.y;
    const len1 = Math.hypot(d1x, d1y) || 1;
    const n1x = d1y / len1, n1y = -d1x / len1;
    const d2x = next.x - cur.x, d2y = next.y - cur.y;
    const len2 = Math.hypot(d2x, d2y) || 1;
    const n2x = d2y / len2, n2y = -d2x / len2;
    const bx = n1x + n2x, by = n1y + n2y;
    const blen = Math.hypot(bx, by) || 1;
    result.push({ x: cur.x + (bx / blen) * amount, y: cur.y + (by / blen) * amount });
  }
  return result;
}

export { polyBbox, pointInPolygon };
