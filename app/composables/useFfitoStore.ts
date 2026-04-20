/**
 * useFfitoStore — central state for the SVG hatch-fill editor.
 *
 * Singleton composable: all state lives at module scope so every
 * component that calls useFfitoStore() shares the same reactive refs.
 */

import { computeHatchLayers } from "~/utils/hatch";
import { pathToPolygon } from "~/utils/svgPath";

// ── Tool modes ────────────────────────────────────────────────────────────

export type ToolMode = "select" | "node";
export type ViewMode = "hatch" | "original";
export type GroupBy = "flat" | "color" | "group";

// ── Hatch layer ───────────────────────────────────────────────────────────

export interface HatchLayer {
  id: string;
  /** Hatch angle in degrees (0 = horizontal) */
  angle: number;
  /** Line spacing in mm */
  spacing: number;
  /** Minimum inset distance from shape border in mm */
  borderInset: number;
  /** Connect adjacent hatch lines end-to-end (no pen-lift) */
  connectLines: boolean;
}

let _layerUid = 0;
export function createLayer(overrides: Partial<Omit<HatchLayer, "id">> = {}): HatchLayer {
  return {
    id: `layer-${++_layerUid}-${Date.now()}`,
    angle: 45,
    spacing: 3,
    borderInset: 0.5,
    connectLines: false,
    ...overrides,
  };
}

// ── Presets — quick-add layer sets ────────────────────────────────────────

export interface LayerPreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  layers: Partial<Omit<HatchLayer, "id">>[];
}

export const LAYER_PRESETS: LayerPreset[] = [
  {
    id: "parallel",
    label: "Parallel",
    icon: "i-mdi-equal",
    description: "Single set of parallel lines",
    layers: [{ angle: 45 }],
  },
  {
    id: "cross",
    label: "Cross",
    icon: "i-mdi-close",
    description: "Two layers at 90° to each other",
    layers: [{ angle: 45 }, { angle: 135 }],
  },
  {
    id: "triple",
    label: "Triple",
    icon: "i-mdi-asterisk",
    description: "Three layers at 60° intervals",
    layers: [{ angle: 0 }, { angle: 60 }, { angle: 120 }],
  },
  {
    id: "horizontal",
    label: "Horizontal",
    icon: "i-mdi-minus",
    description: "Flat horizontal lines",
    layers: [{ angle: 0 }],
  },
];

// ── Per-shape hatch configuration ─────────────────────────────────────────

export interface HatchConfig {
  enabled: boolean;
  /** Stroke / line width in mm — shared across all layers */
  lineWidth: number;
  /** Draw the shape outline at lineWidth */
  strokePath: boolean;
  /** When true, use the shape's original fill color for hatch lines */
  useShapeFill: boolean;
  /** Fallback color when shape has no fill or useShapeFill is off */
  color: string;
  /** Hatch layers — each produces a set of parallel lines */
  layers: HatchLayer[];
}

export const DEFAULT_HATCH_CONFIG: HatchConfig = {
  enabled: true,
  lineWidth: 0.3,
  strokePath: false,
  useShapeFill: true,
  color: "#e6e6e6",
  layers: [createLayer({ angle: 45 })],
};

// ── SVG group info ────────────────────────────────────────────────────────

export interface SvgGroupInfo {
  id: string;
  label: string;
  depth: number;
}

// ── SVG shape ─────────────────────────────────────────────────────────────

export interface SvgShape {
  id: string;
  tag: string;
  pathData: string;
  bbox: { x: number; y: number; w: number; h: number };
  fill: string;
  stroke: string;
  hatch: HatchConfig | null;
  visible: boolean;
  group: SvgGroupInfo | null;
  groupChain: SvgGroupInfo[];
}

// ── Grouped shape view ────────────────────────────────────────────────────

export interface ShapeGroup {
  key: string;
  label: string;
  swatch: string;
  /** Multiple swatches when colors are merged */
  swatches: string[];
  icon: string;
  shapes: SvgShape[];
}

// ══════════════════════════════════════════════════════════════════════════
// Module-scope singleton state
// ══════════════════════════════════════════════════════════════════════════

const toolMode = ref<ToolMode>("select");
const viewMode = ref<ViewMode>("hatch");
const groupBy = ref<GroupBy>("flat");
const svgSource = ref<string | null>(null);
const svgViewBox = ref({ x: 0, y: 0, w: 800, h: 600 });
const svgWidthMM = ref(210);
const shapes = reactive<SvgShape[]>([]);
const selectedIds = ref<Set<string>>(new Set());
const globalHatch = reactive<HatchConfig>({
  ...DEFAULT_HATCH_CONFIG,
  layers: [createLayer({ angle: 45 })],
});
const shapesVersion = ref(0);
const collapsedGroups = ref<Set<string>>(new Set());

// Color group ordering and merges
/** Custom display order of color group keys (normalized colors). Empty = default. */
const colorGroupOrder = ref<string[]>([]);
/** Maps a color → the color it's been merged into */
const colorMerges = ref<Map<string, string>>(new Map());

const mmToSvg = computed(() => svgViewBox.value.w / svgWidthMM.value);

// ── Computed ──────────────────────────────────────────────────────────────

const hasSelection = computed(() => selectedIds.value.size > 0);

const selectedShapes = computed(() =>
  shapes.filter((s) => selectedIds.value.has(s.id)),
);

const activeShape = computed<SvgShape | null>(() =>
  selectedShapes.value.length === 1 ? selectedShapes.value[0]! : null,
);

function effectiveHatch(shape: SvgShape): HatchConfig {
  return shape.hatch ?? globalHatch;
}

const panelHatch = computed<HatchConfig>(() => {
  if (activeShape.value) return effectiveHatch(activeShape.value);
  if (hasSelection.value) {
    const first = selectedShapes.value[0]!;
    return effectiveHatch(first);
  }
  return globalHatch;
});

const panelIsOverride = computed(() =>
  activeShape.value ? activeShape.value.hatch !== null : false,
);

// ── Unique colors / groups ────────────────────────────────────────────────

const uniqueColors = computed(() => {
  const set = new Set<string>();
  for (const s of shapes) set.add(normalizeColor(s.fill));
  return [...set].sort();
});

const uniqueGroups = computed(() => {
  const map = new Map<string, SvgGroupInfo>();
  for (const s of shapes) {
    if (s.group && !map.has(s.group.id)) map.set(s.group.id, s.group);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
});

const groupedShapes = computed<ShapeGroup[]>(() => {
  if (groupBy.value === "flat") {
    return [{
      key: "__all__",
      label: "All Shapes",
      swatch: "",
      swatches: [],
      icon: "i-mdi-layers-triple-outline",
      shapes: [...shapes],
    }];
  }

  if (groupBy.value === "color") {
    const merges = colorMerges.value;
    const map = new Map<string, SvgShape[]>();
    // Track which colors were merged into each key
    const mergedInto = new Map<string, Set<string>>();
    for (const s of shapes) {
      const raw = normalizeColor(s.fill);
      // Follow merge chain (max 1 hop)
      const key = merges.get(raw) ?? raw;
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
      // Track sub-colors
      if (raw !== key) {
        const set = mergedInto.get(key) ?? new Set();
        set.add(raw);
        mergedInto.set(key, set);
      }
    }

    const groups = [...map.entries()].map(([color, items]) => {
      const subs = mergedInto.get(color);
      const label = color === "none" ? "No Fill" : color;
      return {
        key: `color:${color}`,
        label: subs ? `${label} +${subs.size}` : label,
        swatch: color === "none" ? "" : color,
        swatches: subs ? [color, ...subs] : [],
        icon: "i-mdi-palette",
        shapes: items,
      };
    });

    // Apply custom order if set
    const order = colorGroupOrder.value;
    if (order.length > 0) {
      const pos = new Map(order.map((k, i) => [`color:${k}`, i]));
      groups.sort((a, b) => {
        const pa = pos.get(a.key) ?? 9999;
        const pb = pos.get(b.key) ?? 9999;
        return pa - pb;
      });
    }
    return groups;
  }

  const map = new Map<string, SvgShape[]>();
  const UNGROUPED = "__ungrouped__";
  for (const s of shapes) {
    const key = s.group?.id ?? UNGROUPED;
    const arr = map.get(key);
    if (arr) arr.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()].map(([key, items]) => ({
    key: `group:${key}`,
    label: key === UNGROUPED
      ? "Ungrouped"
      : (items[0]?.group?.label ?? key),
    swatch: "",
    swatches: [],
    icon: key === UNGROUPED ? "i-mdi-ungroup" : "i-mdi-folder-outline",
    shapes: items,
  }));
});

// ── Actions ──────────────────────────────────────────────────────────────

// ── Project serialisation ────────────────────────────────────────────────

interface ShapeOverride {
  id: string;
  visible: boolean;
  hatch: HatchConfig | null;
}

interface ProjectData {
  version: 1;
  svgSource: string;
  globalHatch: HatchConfig;
  shapeOverrides: ShapeOverride[];
  colorMerges: [string, string][];
  colorGroupOrder: string[];
}

function exportProject(): ProjectData {
  return {
    version: 1,
    svgSource: svgSource.value ?? "",
    globalHatch: JSON.parse(JSON.stringify(globalHatch)) as HatchConfig,
    shapeOverrides: shapes
      .filter((s) => !s.visible || s.hatch !== null)
      .map((s) => ({ id: s.id, visible: s.visible, hatch: s.hatch })),
    colorMerges: [...colorMerges.value.entries()],
    colorGroupOrder: colorGroupOrder.value,
  };
}

function importProject(data: ProjectData) {
  loadSvgText(data.svgSource);
  Object.assign(globalHatch, data.globalHatch);
  const overrideMap = new Map(data.shapeOverrides.map((o) => [o.id, o]));
  for (const s of shapes) {
    const ov = overrideMap.get(s.id);
    if (ov) {
      s.visible = ov.visible;
      s.hatch = ov.hatch;
    }
  }
  colorMerges.value = new Map(data.colorMerges);
  colorGroupOrder.value = data.colorGroupOrder;
  shapesVersion.value++;
}

function importSvg() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".svg,image/svg+xml,.ffito.svg";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Check for embedded ffito project data
      const match = text.match(/<ffito-data>([\s\S]*?)<\/ffito-data>/);
      if (match) {
        try {
          const data = JSON.parse(match[1]!) as ProjectData;
          if (data.version === 1 && data.svgSource) {
            importProject(data);
            return;
          }
        } catch { /* fall through to plain SVG load */ }
      }
      loadSvgText(text);
    };
    reader.readAsText(file);
  };
  input.click();
}

function loadSvgText(text: string) {
  svgSource.value = text;
  svgWidthMM.value = parseSvgPhysicalWidthMM(text);
  const parsed = parseSvgShapes(text);
  shapes.splice(0, shapes.length, ...parsed);
  selectedIds.value = new Set();
  collapsedGroups.value = new Set();
  colorGroupOrder.value = [];
  colorMerges.value = new Map();
  shapesVersion.value++;
}

function selectShape(id: string, additive = false) {
  if (!additive) {
    selectedIds.value = new Set(id ? [id] : []);
  } else {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  }
}

function selectAll() {
  selectedIds.value = new Set(shapes.map((s) => s.id));
}

function deselectAll() {
  selectedIds.value = new Set();
}

function selectByColor(fill: string, additive = false) {
  const normalized = normalizeColor(fill);
  const ids = shapes
    .filter((s) => normalizeColor(s.fill) === normalized)
    .map((s) => s.id);
  if (additive) {
    const next = new Set(selectedIds.value);
    for (const id of ids) next.add(id);
    selectedIds.value = next;
  } else {
    selectedIds.value = new Set(ids);
  }
}

function selectByGroup(groupId: string | null, additive = false) {
  const ids = shapes
    .filter((s) => (s.group?.id ?? null) === groupId)
    .map((s) => s.id);
  if (additive) {
    const next = new Set(selectedIds.value);
    for (const id of ids) next.add(id);
    selectedIds.value = next;
  } else {
    selectedIds.value = new Set(ids);
  }
}

function selectGroup(group: ShapeGroup, additive = false) {
  const ids = group.shapes.map((s) => s.id);
  if (additive) {
    const next = new Set(selectedIds.value);
    for (const id of ids) next.add(id);
    selectedIds.value = next;
  } else {
    selectedIds.value = new Set(ids);
  }
}

function toggleGroupCollapsed(key: string) {
  const next = new Set(collapsedGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsedGroups.value = next;
}

// ── Color group ordering & merging ───────────────────────────────────

/** Ensure colorGroupOrder is populated from current groups */
function _ensureColorOrder(): string[] {
  if (colorGroupOrder.value.length === 0) {
    const colors = new Set<string>();
    for (const s of shapes) {
      const raw = normalizeColor(s.fill);
      const key = colorMerges.value.get(raw) ?? raw;
      colors.add(key);
    }
    colorGroupOrder.value = [...colors];
  }
  return colorGroupOrder.value;
}

/** Move a color group to a new position (by color keys, not group keys) */
function reorderColorGroup(fromColor: string, toColor: string, position: "before" | "after") {
  const order = _ensureColorOrder();
  const fromIdx = order.indexOf(fromColor);
  if (fromIdx < 0) return;
  // Remove from current position
  order.splice(fromIdx, 1);
  // Find target
  let toIdx = order.indexOf(toColor);
  if (toIdx < 0) toIdx = order.length;
  if (position === "after") toIdx++;
  order.splice(toIdx, 0, fromColor);
  colorGroupOrder.value = [...order];
}

/** Merge sourceColor into targetColor group */
function mergeColorGroups(sourceColor: string, targetColor: string) {
  if (sourceColor === targetColor) return;
  const merges = new Map(colorMerges.value);
  // Also re-merge anything that was previously merged into source
  for (const [k, v] of merges) {
    if (v === sourceColor) merges.set(k, targetColor);
  }
  merges.set(sourceColor, targetColor);
  colorMerges.value = merges;
  // Remove source from order
  const order = _ensureColorOrder();
  const idx = order.indexOf(sourceColor);
  if (idx >= 0) order.splice(idx, 1);
  colorGroupOrder.value = [...order];
  shapesVersion.value++;
}

/** Unmerge all colors from a group (split back to individual color groups) */
function unmergeColorGroup(targetColor: string) {
  const merges = new Map(colorMerges.value);
  const restored: string[] = [];
  for (const [k, v] of merges) {
    if (v === targetColor) {
      merges.delete(k);
      restored.push(k);
    }
  }
  colorMerges.value = merges;
  // Add restored colors back to order after target
  if (restored.length > 0) {
    const order = _ensureColorOrder();
    const idx = order.indexOf(targetColor);
    order.splice(idx + 1, 0, ...restored);
    colorGroupOrder.value = [...order];
  }
  shapesVersion.value++;
}

/** Sort color groups by HSL hue */
function sortColorGroupsByHue() {
  const order = _ensureColorOrder();
  order.sort((a, b) => hexToHue(a) - hexToHue(b));
  colorGroupOrder.value = [...order];
}

/** Convert a hex/named color to HSL hue (0–360). Achromatic → 999 (sort last). */
function hexToHue(color: string): number {
  if (color === "none" || !color) return 1000;
  const hex = color.replace(/^#/, "");
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0]! + hex[0]!, 16) / 255;
    g = parseInt(hex[1]! + hex[1]!, 16) / 255;
    b = parseInt(hex[2]! + hex[2]!, 16) / 255;
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  } else { return 999; }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 999 - l;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return h * 360;
}

// ── Hatch layer mutations ────────────────────────────────────────────────

function _ensureOverride(shape: SvgShape): HatchConfig {
  if (!shape.hatch) {
    shape.hatch = {
      ...globalHatch,
      layers: globalHatch.layers.map((l) => ({ ...l, id: createLayer().id })),
    };
  }
  return shape.hatch;
}

function patchSelectedHatch(patch: Partial<HatchConfig>) {
  for (const shape of selectedShapes.value) {
    const h = _ensureOverride(shape);
    Object.assign(h, patch);
  }
  shapesVersion.value++;
}

function resetSelectedHatch() {
  for (const shape of selectedShapes.value) {
    shape.hatch = null;
  }
  shapesVersion.value++;
}

function toggleSelectedHatch(enabled: boolean) {
  patchSelectedHatch({ enabled });
}

function setPanelHatch(patch: Partial<HatchConfig>) {
  if (hasSelection.value) {
    patchSelectedHatch(patch);
  } else {
    Object.assign(globalHatch, patch);
    shapesVersion.value++;
  }
}

/** Get the target HatchConfig for panel edits (shape override or global) */
function _panelTarget(): HatchConfig {
  if (hasSelection.value) {
    // Ensure all selected shapes have overrides, return first
    for (const shape of selectedShapes.value) {
      _ensureOverride(shape);
    }
    return selectedShapes.value[0]!.hatch!;
  }
  return globalHatch;
}

function addLayer(overrides: Partial<Omit<HatchLayer, "id">> = {}) {
  if (hasSelection.value) {
    for (const shape of selectedShapes.value) {
      const h = _ensureOverride(shape);
      h.layers.push(createLayer(overrides));
    }
  } else {
    globalHatch.layers.push(createLayer(overrides));
  }
  shapesVersion.value++;
}

function removeLayer(layerIndex: number) {
  if (hasSelection.value) {
    for (const shape of selectedShapes.value) {
      const h = _ensureOverride(shape);
      if (h.layers.length > 1) h.layers.splice(layerIndex, 1);
    }
  } else {
    if (globalHatch.layers.length > 1) globalHatch.layers.splice(layerIndex, 1);
  }
  shapesVersion.value++;
}

function patchLayer(layerIndex: number, patch: Partial<Omit<HatchLayer, "id">>) {
  if (hasSelection.value) {
    for (const shape of selectedShapes.value) {
      const h = _ensureOverride(shape);
      const layer = h.layers[layerIndex];
      if (layer) Object.assign(layer, patch);
    }
  } else {
    const layer = globalHatch.layers[layerIndex];
    if (layer) Object.assign(layer, patch);
  }
  shapesVersion.value++;
}

function applyPreset(preset: LayerPreset) {
  const newLayers = preset.layers.map((l) => createLayer(l));
  if (hasSelection.value) {
    for (const shape of selectedShapes.value) {
      const h = _ensureOverride(shape);
      h.layers.splice(0, h.layers.length, ...newLayers.map((l) => ({ ...l, id: createLayer().id })));
    }
  } else {
    globalHatch.layers.splice(0, globalHatch.layers.length, ...newLayers);
  }
  shapesVersion.value++;
}

function duplicateLayer(layerIndex: number) {
  if (hasSelection.value) {
    for (const shape of selectedShapes.value) {
      const h = _ensureOverride(shape);
      const src = h.layers[layerIndex];
      if (src) h.layers.splice(layerIndex + 1, 0, createLayer({ ...src }));
    }
  } else {
    const src = globalHatch.layers[layerIndex];
    if (src) globalHatch.layers.splice(layerIndex + 1, 0, createLayer({ ...src }));
  }
  shapesVersion.value++;
}

function toggleShapeVisible(id: string) {
  const s = shapes.find((x) => x.id === id);
  if (s) {
    s.visible = !s.visible;
    shapesVersion.value++;
  }
}

function toggleGroupVisible(group: ShapeGroup) {
  // If all visible → hide all; otherwise show all
  const allVisible = group.shapes.every((s) => s.visible);
  for (const s of group.shapes) s.visible = !allVisible;
  shapesVersion.value++;
}

function exportSvg() {
  if (!svgSource.value || shapes.length === 0) return;

  const vb = svgViewBox.value;
  const mm = mmToSvg.value;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"
  width="${svgWidthMM.value}mm"
  height="${(svgWidthMM.value * vb.h / vb.w).toFixed(2)}mm">
`;

  // Embed project data (escape for XML)
  const projectJson = JSON.stringify(exportProject())
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  svg += `  <metadata><ffito-data>${projectJson}</ffito-data></metadata>
`;

  for (const shape of shapes) {
    if (!shape.visible) continue;
    const hatch = effectiveHatch(shape);

    svg += `  <g id="${shape.id}">
`;

    // Shape outline (stroke path)
    if (hatch.strokePath) {
      let lineColor = hatch.color;
      if (hatch.useShapeFill && shape.fill !== "none" && shape.fill !== "") lineColor = shape.fill;
      const lw = (hatch.lineWidth * mm).toFixed(4);
      svg += `    <path d="${shape.pathData}" fill="none" stroke="${lineColor}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>
`;
    }

    // Hatch lines
    if (hatch.enabled && hatch.layers.length > 0) {
      const polygon = pathToPolygon(shape.pathData, 64);
      if (polygon.length >= 3) {
        const svgLayers = hatch.layers.map((l) => ({
          ...l,
          spacing: l.spacing * mm,
          borderInset: l.borderInset * mm,
        }));
        const segs = computeHatchLayers(polygon, svgLayers);
        if (segs.length > 0) {
          let lineColor = hatch.color;
          if (hatch.useShapeFill && shape.fill !== "none" && shape.fill !== "") lineColor = shape.fill;
          const lw = (hatch.lineWidth * mm).toFixed(4);
          const d = segs.map((s) =>
            `M${s.x1.toFixed(3)},${s.y1.toFixed(3)} L${s.x2.toFixed(3)},${s.y2.toFixed(3)}`
          ).join(" ");
          svg += `    <path d="${d}" fill="none" stroke="${lineColor}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>
`;
        }
      }
    }

    svg += `  </g>
`;
  }

  svg += `</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ffito-${Date.now()}.ffito.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
// ══════════════════════════════════════════════════════════════════════════
// Composable
// ══════════════════════════════════════════════════════════════════════════

export const useFfitoStore = () => ({
  toolMode,
  viewMode,
  groupBy,
  svgSource,
  svgViewBox,
  svgWidthMM,
  mmToSvg,
  shapes,
  selectedIds,
  globalHatch,
  shapesVersion,
  collapsedGroups,
  // computed
  hasSelection,
  selectedShapes,
  activeShape,
  panelHatch,
  panelIsOverride,
  uniqueColors,
  uniqueGroups,
  groupedShapes,
  // actions
  importSvg,
  loadSvgText,
  selectShape,
  selectAll,
  deselectAll,
  selectByColor,
  selectByGroup,
  selectGroup,
  toggleGroupCollapsed,
  reorderColorGroup,
  mergeColorGroups,
  unmergeColorGroup,
  sortColorGroupsByHue,
  colorGroupOrder,
  colorMerges,
  effectiveHatch,
  patchSelectedHatch,
  setPanelHatch,
  resetSelectedHatch,
  toggleSelectedHatch,
  toggleShapeVisible,
  toggleGroupVisible,
  exportSvg,
  // layer actions
  addLayer,
  removeLayer,
  patchLayer,
  duplicateLayer,
  applyPreset,
});

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function normalizeColor(c: string): string {
  return (c || "none").trim().toLowerCase();
}

function parseSvgPhysicalWidthMM(svgText: string): number {
  const match = svgText.match(/<svg[^>]*\bwidth\s*=\s*["']([^"']+)["']/i);
  if (!match) return 210;
  const raw = match[1]!.trim();
  const numMatch = raw.match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/i);
  if (!numMatch) return 210;
  const val = parseFloat(numMatch[1]!);
  const unit = (numMatch[2] || "px").toLowerCase();
  switch (unit) {
    case "mm": return val;
    case "cm": return val * 10;
    case "in": return val * 25.4;
    case "pt": return val * (25.4 / 72);
    case "px":
    default:   return val * (25.4 / 96);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SVG parser
// ══════════════════════════════════════════════════════════════════════════

function parseSvgShapes(svgText: string): SvgShape[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return [];

  // ── Build CSS class → property map from <style> blocks ──────────────
  const cssProps = new Map<string, Map<string, string>>();
  for (const styleEl of svgEl.querySelectorAll("style")) {
    const text = styleEl.textContent ?? "";
    // Match rules like  .cls-0 {fill:#183F5E;stroke:#000;stroke-width:1;}
    const ruleRe = /([^{}]+)\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(text)) !== null) {
      const selector = m[1]!.trim();
      const body = m[2]!;
      const props = new Map<string, string>();
      for (const decl of body.split(";")) {
        const colon = decl.indexOf(":");
        if (colon < 0) continue;
        const key = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (key) props.set(key, val);
      }
      if (props.size > 0) cssProps.set(selector, props);
    }
  }

  /** Resolve a CSS property for an element — checks classes against parsed <style> */
  function resolveCssProp(el: Element, prop: string): string {
    const classes = el.getAttribute("class")?.split(/\s+/) ?? [];
    for (const cls of classes) {
      const rule = cssProps.get(`.${cls}`);
      if (rule?.has(prop)) return rule.get(prop)!;
    }
    return "";
  }

  const SHAPE_TAGS = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);
  const result: SvgShape[] = [];
  let index = 0;
  const groupIdMap = new Map<Element, SvgGroupInfo>();
  let groupCounter = 0;

  function getGroupInfo(el: Element): SvgGroupInfo {
    let info = groupIdMap.get(el);
    if (!info) {
      const label =
        el.getAttribute("inkscape:label") ||
        el.getAttribute("id") ||
        `Group ${++groupCounter}`;
      const id = el.getAttribute("id") || `g-${groupCounter}`;
      let depth = 0;
      let p: Element | null = el.parentElement;
      while (p && p !== (svgEl as Element)) {
        if (p.tagName.toLowerCase() === "g") depth++;
        p = p.parentElement;
      }
      info = { id, label, depth };
      groupIdMap.set(el, info);
    }
    return info;
  }

  function getGroupChain(el: Element): SvgGroupInfo[] {
    const chain: SvgGroupInfo[] = [];
    let p: Element | null = el.parentElement;
    while (p && p !== (svgEl as Element)) {
      if (p.tagName.toLowerCase() === "g") {
        chain.unshift(getGroupInfo(p));
      }
      p = p.parentElement;
    }
    return chain;
  }

  const allElements = svgEl.querySelectorAll("*");
  allElements.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!SHAPE_TAGS.has(tag)) return;

    const pathData = elementToPathData(el as SVGElement);
    if (!pathData) return;

    const fill = resolveInheritedProp(el as SVGElement, "fill", svgEl)
      || resolveCssProp(el, "fill")
      || "none";
    const stroke = resolveInheritedProp(el as SVGElement, "stroke", svgEl)
      || resolveCssProp(el, "stroke")
      || "none";
    const elementId = el.getAttribute("id") || el.getAttribute("inkscape:label") || `shape-${index}`;
    const bbox = approximateBbox(pathData);

    const groupChain = getGroupChain(el);
    const group = groupChain.length > 0 ? groupChain[groupChain.length - 1]! : null;

    result.push({
      id: `${elementId}-${index}`,
      tag, pathData, bbox, fill, stroke,
      hatch: null, visible: true, group, groupChain,
    });
    index++;
  });

  return result;
}

function resolveInheritedProp(el: SVGElement, prop: string, root: Element): string {
  let current: Element | null = el;
  while (current && current !== root.parentElement) {
    const style = current.getAttribute("style") ?? "";
    const match = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`));
    if (match) return match[1]!.trim();
    const attr = current.getAttribute(prop);
    if (attr) return attr;
    current = current.parentElement;
  }
  return "";
}

function elementToPathData(el: SVGElement): string | null {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "path":
      return el.getAttribute("d") ?? null;
    case "rect": {
      const x = parseFloat(el.getAttribute("x") ?? "0");
      const y = parseFloat(el.getAttribute("y") ?? "0");
      const w = parseFloat(el.getAttribute("width") ?? "0");
      const h = parseFloat(el.getAttribute("height") ?? "0");
      const rx = parseFloat(el.getAttribute("rx") ?? "0");
      const ry = parseFloat(el.getAttribute("ry") ?? el.getAttribute("rx") ?? "0");
      if (w <= 0 || h <= 0) return null;
      if (rx === 0 && ry === 0) return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
      return (
        `M${x + rx},${y} H${x + w - rx} A${rx},${ry} 0 0 1 ${x + w},${y + ry}` +
        ` V${y + h - ry} A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}` +
        ` H${x + rx} A${rx},${ry} 0 0 1 ${x},${y + h - ry}` +
        ` V${y + ry} A${rx},${ry} 0 0 1 ${x + rx},${y} Z`
      );
    }
    case "circle": {
      const cx = parseFloat(el.getAttribute("cx") ?? "0");
      const cy = parseFloat(el.getAttribute("cy") ?? "0");
      const r = parseFloat(el.getAttribute("r") ?? "0");
      if (r <= 0) return null;
      const k = 0.5523 * r;
      return (
        `M${cx},${cy - r} C${cx + k},${cy - r} ${cx + r},${cy - k} ${cx + r},${cy}` +
        ` C${cx + r},${cy + k} ${cx + k},${cy + r} ${cx},${cy + r}` +
        ` C${cx - k},${cy + r} ${cx - r},${cy + k} ${cx - r},${cy}` +
        ` C${cx - r},${cy - k} ${cx - k},${cy - r} ${cx},${cy - r} Z`
      );
    }
    case "ellipse": {
      const cx = parseFloat(el.getAttribute("cx") ?? "0");
      const cy = parseFloat(el.getAttribute("cy") ?? "0");
      const rx = parseFloat(el.getAttribute("rx") ?? "0");
      const ry = parseFloat(el.getAttribute("ry") ?? "0");
      if (rx <= 0 || ry <= 0) return null;
      const kx = 0.5523 * rx, ky = 0.5523 * ry;
      return (
        `M${cx},${cy - ry} C${cx + kx},${cy - ry} ${cx + rx},${cy - ky} ${cx + rx},${cy}` +
        ` C${cx + rx},${cy + ky} ${cx + kx},${cy + ry} ${cx},${cy + ry}` +
        ` C${cx - kx},${cy + ry} ${cx - rx},${cy + ky} ${cx - rx},${cy}` +
        ` C${cx - rx},${cy - ky} ${cx - kx},${cy - ry} ${cx},${cy - ry} Z`
      );
    }
    case "polygon":
    case "polyline": {
      const pts = (el.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
      if (pts.length < 4) return null;
      let d = `M${pts[0]},${pts[1]}`;
      for (let i = 2; i < pts.length - 1; i += 2) d += ` L${pts[i]},${pts[i + 1]}`;
      if (tag === "polygon") d += " Z";
      return d;
    }
    case "line": {
      return `M${el.getAttribute("x1") ?? 0},${el.getAttribute("y1") ?? 0} L${el.getAttribute("x2") ?? 0},${el.getAttribute("y2") ?? 0}`;
    }
    default: return null;
  }
}

function approximateBbox(d: string): { x: number; y: number; w: number; h: number } {
  const numbers = d.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)?.map(Number) ?? [];
  if (numbers.length < 2) return { x: 0, y: 0, w: 0, h: 0 };
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < numbers.length - 1; i += 2) {
    xs.push(numbers[i]!);
    ys.push(numbers[i + 1]!);
  }
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}
