/**
 * useCanvasTransform — pan & zoom for the hatch canvas.
 * Uses pointer events so it works with mouse and touch.
 */
import { useEventListener } from "@vueuse/core";

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export function useCanvasTransform(canvasRef: Ref<HTMLCanvasElement | null>) {
  const transform = ref<Transform>({ x: 0, y: 0, scale: 1 });

  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  function onPointerDown(e: PointerEvent) {
    // Middle-button or space+left-button panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    transform.value = {
      ...transform.value,
      x: transform.value.x + dx,
      y: transform.value.y + dy,
    };
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onPointerUp(e: PointerEvent) {
    isPanning = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const canvas = canvasRef.value;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.min(50, Math.max(0.05, transform.value.scale * zoomFactor));

    // Zoom toward mouse position
    const scaleDelta = newScale / transform.value.scale;
    transform.value = {
      x: mx + (transform.value.x - mx) * scaleDelta,
      y: my + (transform.value.y - my) * scaleDelta,
      scale: newScale,
    };
  }

  /** Fit the SVG viewBox into the canvas with padding */
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

  /** Convert canvas pixel coords to SVG user-unit coords */
  function canvasToSvg(cx: number, cy: number): { x: number; y: number } {
    const { x, y, scale } = transform.value;
    return { x: (cx - x) / scale, y: (cy - y) / scale };
  }

  // Attach wheel listener (non-passive so we can preventDefault)
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
    fitToView,
    canvasToSvg,
  };
}
