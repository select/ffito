<script setup lang="ts">
/**
 * HatchCanvas — main canvas component.
 *
 * Renders imported SVG shapes, hatch fill lines, selection highlights.
 * Pan with Alt+drag or middle-drag, zoom with scroll wheel.
 */
import { useResizeObserver } from "@vueuse/core";
import { computeHatchLayers } from "~/utils/hatch";
import type { HatchLayer } from "~/composables/useFfitoStore";
import { pathToPolygon, parseSvgViewBox } from "~/utils/svgPath";
import { useCanvasTransform } from "~/composables/useCanvasTransform";
import type { SvgShape } from "~/composables/useFfitoStore";

const store = useFfitoStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);

const { transform, onPointerDown, onPointerMove, onPointerUp, panning, fitToView, canvasToSvg } =
  useCanvasTransform(canvasRef, {
    panSpeed: store.panSpeed,
    zoomFactor: store.zoomFactor,
  });

// ── Resize handling ───────────────────────────────────────────────────────

const canvasSize = ref({ w: 800, h: 600 });

useResizeObserver(canvasRef, (entries) => {
  const entry = entries[0];
  if (!entry) return;
  const { width, height } = entry.contentRect;
  canvasSize.value = { w: width, h: height };
  const canvas = canvasRef.value;
  if (canvas) {
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
  }
  requestRender();
});

// ── Fit-to-view when SVG source changes ──────────────────────────────────

watch(
  () => store.svgSource.value,
  (src) => {
    if (!src) return;
    const vb = parseSvgViewBox(src);
    store.svgViewBox.value = vb;
    // Clear caches for the new SVG
    path2dCache.clear();
    polygonCache.clear();
    nextTick(() => {
      fitToView(vb, canvasSize.value.w, canvasSize.value.h);
      requestRender();
    });
  },
);

// ── Path2D cache ──────────────────────────────────────────────────────────

const path2dCache = new Map<string, Path2D>();

function getPath2D(pathData: string): Path2D {
  let p = path2dCache.get(pathData);
  if (!p) {
    p = new Path2D(pathData);
    path2dCache.set(pathData, p);
  }
  return p;
}

// Hatch polygon cache: shape id → polygon points
const polygonCache = new Map<string, { x: number; y: number }[]>();

function getPolygon(shape: SvgShape) {
  let pts = polygonCache.get(shape.id);
  if (!pts) {
    pts = pathToPolygon(shape.pathData);
    polygonCache.set(shape.id, pts);
  }
  return pts;
}

// ── Render loop ───────────────────────────────────────────────────────────

let rafId = 0;
function requestRender() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(render);
}

// Watch all sources that should trigger a re-render:
// - transform (pan/zoom)
// - shapesVersion (shapes added/removed/mutated, hatch config changed, visibility toggled)
// - selectedIds (selection changed)
// - globalHatch (global defaults changed — affects un-overridden shapes)
watch(
  [
    transform,
    () => store.shapesVersion.value,
    () => store.selectedIds.value,
    () => store.globalHatch,
    () => store.viewMode.value,
  ],
  requestRender,
  { deep: true },
);

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = devicePixelRatio;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(dpr, dpr);

  const { x: tx, y: ty, scale } = transform.value;

  // ── SVG page background ─────────────────────────────────────────────
  const vb = store.svgViewBox.value;
  const vbX = tx + vb.x * scale;
  const vbY = ty + vb.y * scale;
  const vbW = vb.w * scale;
  const vbH = vb.h * scale;

  ctx.fillStyle = "rgb(22 21 26)";
  ctx.fillRect(vbX, vbY, vbW, vbH);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.strokeRect(vbX, vbY, vbW, vbH);

  // ── Draw shapes ─────────────────────────────────────────────────────
  if (store.shapes.length === 0) {
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);

  const isOriginalView = store.viewMode.value === "original";

  for (const shape of store.shapes) {
    if (!shape.visible) continue;

    const p2d = getPath2D(shape.pathData);
    const isSelected = store.selectedIds.value.has(shape.id);

    if (isOriginalView) {
      // ── Original view: render fills and strokes as-is ──────────
      if (shape.fill !== "none" && shape.fill !== "") {
        ctx.fillStyle = shape.fill;
        ctx.fill(p2d, "evenodd");
      }
      if (shape.stroke !== "none" && shape.stroke !== "") {
        ctx.strokeStyle = shape.stroke;
        ctx.lineWidth = 1 / scale;
        ctx.stroke(p2d);
      }
    } else {
      // ── Hatch view ─────────────────────────────────────────────

      // Subtle shape outline so you can see boundaries
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5 / scale;
      ctx.stroke(p2d);
      ctx.restore();

      // Draw hatch layers
      const hatch = store.effectiveHatch(shape);
      if (hatch.enabled && hatch.layers.length > 0) {
        const polygon = getPolygon(shape);
        if (polygon.length >= 3) {
          const mm = store.mmToSvg.value;

          // Convert all layers from mm to SVG units
          const svgLayers: HatchLayer[] = hatch.layers.map((l) => ({
            ...l,
            spacing: l.spacing * mm,
            borderInset: l.borderInset * mm,
          }));

          const segs = computeHatchLayers(polygon, svgLayers);

          // Resolve color
          let lineColor = hatch.color;
          if (hatch.useShapeFill && shape.fill !== "none" && shape.fill !== "") {
            lineColor = shape.fill;
          }

          const lw = hatch.lineWidth * mm;

          ctx.save();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = lw;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          // No clip — bows/connections may extend outside shape for realistic preview

          ctx.beginPath();
          for (const seg of segs) {
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw shape outline at hatch lineWidth when strokePath is on
      const hatch2 = store.effectiveHatch(shape);
      if (hatch2.strokePath) {
        const mm = store.mmToSvg.value;
        const lw = hatch2.lineWidth * mm;
        let lineColor = hatch2.color;
        if (hatch2.useShapeFill && shape.fill !== "none" && shape.fill !== "") {
          lineColor = shape.fill;
        }
        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke(p2d);
        ctx.restore();
      }
    }

    // ── Selection highlight (both modes) ──
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = "rgb(140 110 230)";
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([4 / scale, 3 / scale]);
      ctx.stroke(p2d);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  ctx.restore();
  ctx.restore();
}

onMounted(() => {
  requestRender();
});

// ── Click to select ───────────────────────────────────────────────────────

function onCanvasClick(e: PointerEvent) {
  if (store.toolMode.value !== "select") return;
  if (e.button !== 0 || e.altKey) return;

  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const svgPt = canvasToSvg(e.clientX - rect.left, e.clientY - rect.top);

  // Hit-test shapes in reverse order (top-most first)
  const allShapes = [...store.shapes].reverse();
  let hit: string | null = null;

  for (const shape of allShapes) {
    if (!shape.visible) continue;
    const p2d = getPath2D(shape.pathData);
    const testCtx = getTestContext();
    if (testCtx.isPointInPath(p2d, svgPt.x, svgPt.y, "evenodd")) {
      hit = shape.id;
      break;
    }
  }

  if (hit) {
    store.selectShape(hit, e.shiftKey);
  } else {
    store.deselectAll();
  }
}

// Reuse a tiny offscreen canvas for hit-testing
let _testCtx: CanvasRenderingContext2D | null = null;
function getTestContext(): CanvasRenderingContext2D {
  if (!_testCtx) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    _testCtx = c.getContext("2d")!;
  }
  return _testCtx;
}
</script>

<template>
  <canvas
    ref="canvasRef"
    class="w-full h-full block"
    :style="{ cursor: panning() ? 'grabbing' : store.toolMode.value === 'select' ? 'default' : 'crosshair' }"
    @pointerdown="(e) => { onPointerDown(e); onCanvasClick(e); }"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  />
</template>
