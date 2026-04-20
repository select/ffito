/**
 * useCanvasTransform — pan & zoom for the hatch canvas.
 *
 * Inkscape-style controls:
 *   Zoom:         Scroll wheel (around cursor)
 *   Pan vertical: Shift+scroll (or plain scroll when not zooming)
 *   Pan horiz:    Shift+scroll with deltaX / tilt-wheel
 *   Drag pan:     Middle-mouse drag  OR  Alt+left drag
 *
 * Speed is tunable via panSpeed / zoomFactor.
 */

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface TransformOptions {
  /** Multiplier for scroll-based panning. Default: 1 */
  panSpeed?: MaybeRef<number>;
  /** Zoom factor per scroll step. Default: 1.12 */
  zoomFactor?: MaybeRef<number>;
  /** Minimum zoom. Default: 0.02 */
  minZoom?: number;
  /** Maximum zoom. Default: 80 */
  maxZoom?: number;
}

export function useCanvasTransform(
  canvasRef: Ref<HTMLCanvasElement | null>,
  options: TransformOptions = {},
) {
  const panSpeedRef = isRef(options.panSpeed) ? options.panSpeed : ref(options.panSpeed ?? 1);
  const zoomFactorRef = isRef(options.zoomFactor) ? options.zoomFactor : ref(options.zoomFactor ?? 1.12);
  const minZoom = options.minZoom ?? 0.02;
  const maxZoom = options.maxZoom ?? 80;

  const transform = ref<Transform>({ x: 0, y: 0, scale: 1 });

  // ── Drag-pan state ────────────────────────────────────────────────────

  let isPanning = false;
  let panStartMouse = { x: 0, y: 0 };
  let panStartOffset = { x: 0, y: 0 };

  function onPointerDown(e: PointerEvent) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning = true;
      panStartMouse = { x: e.clientX, y: e.clientY };
      panStartOffset = { x: transform.value.x, y: transform.value.y };
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning) return;
    transform.value = {
      ...transform.value,
      x: panStartOffset.x + (e.clientX - panStartMouse.x),
      y: panStartOffset.y + (e.clientY - panStartMouse.y),
    };
  }

  function onPointerUp(_e: PointerEvent) {
    isPanning = false;
  }

  function panning() { return isPanning; }

  // ── Zoom helper ───────────────────────────────────────────────────────

  function applyZoom(factor: number, pivotX: number, pivotY: number) {
    const { x, y, scale } = transform.value;
    const newScale = Math.max(minZoom, Math.min(maxZoom, scale * factor));
    if (newScale === scale) return;
    const ratio = newScale / scale;
    transform.value = {
      x: pivotX + (x - pivotX) * ratio,
      y: pivotY + (y - pivotY) * ratio,
      scale: newScale,
    };
  }

  // ── Wheel handler (Inkscape-style) ────────────────────────────────────

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const canvas = canvasRef.value;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (e.shiftKey) {
      // Shift+scroll → pan horizontally (deltaY becomes X)
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const dy = e.deltaX !== 0 ? e.deltaY : 0;
      transform.value = {
        ...transform.value,
        x: transform.value.x - dx * panSpeedRef.value,
        y: transform.value.y - dy * panSpeedRef.value,
      };
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+scroll → zoom (also catches trackpad pinch which sends ctrlKey)
      const factor = e.deltaY < 0 ? zoomFactorRef.value : 1 / zoomFactorRef.value;
      applyZoom(factor, mx, my);
    } else {
      // Plain scroll → zoom around cursor (Inkscape default)
      const factor = e.deltaY < 0 ? zoomFactorRef.value : 1 / zoomFactorRef.value;
      applyZoom(factor, mx, my);
    }
  }

  // ── Fit to view ───────────────────────────────────────────────────────

  function fitToView(
    viewBox: { x: number; y: number; w: number; h: number },
    canvasWidth: number,
    canvasHeight: number,
    padding = 40,
  ) {
    const scaleX = (canvasWidth - padding * 2) / viewBox.w;
    const scaleY = (canvasHeight - padding * 2) / viewBox.h;
    const scale = Math.min(scaleX, scaleY);
    const x = (canvasWidth - viewBox.w * scale) / 2 - viewBox.x * scale;
    const y = (canvasHeight - viewBox.h * scale) / 2 - viewBox.y * scale;
    transform.value = { x, y, scale };
  }

  // ── Coord conversion ──────────────────────────────────────────────────

  function canvasToSvg(cx: number, cy: number): { x: number; y: number } {
    const { x, y, scale } = transform.value;
    return { x: (cx - x) / scale, y: (cy - y) / scale };
  }

  // ── Attach wheel listener (non-passive) ───────────────────────────────

  watchEffect((onCleanup) => {
    const el = canvasRef.value;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    onCleanup(() => el.removeEventListener("wheel", onWheel));
  });

  return {
    transform,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    panning,
    applyZoom,
    fitToView,
    canvasToSvg,
  };
}
