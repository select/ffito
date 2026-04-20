<script setup lang="ts">
/**
 * ShapeList — grouped shape browser with drag-and-drop reorder/merge.
 */
import type { ShapeGroup, SvgShape } from "~/composables/useFfitoStore";

const store = useFfitoStore();

const expandedSelections = ref<Set<string>>(new Set());

// ── Drag state ───────────────────────────────────────────────────────────

const dragKey = ref<string | null>(null);
const dropTarget = ref<{ key: string; mode: "before" | "after" | "merge" } | null>(null);

function colorFromKey(key: string): string {
  return key.replace(/^color:/, "");
}

function onDragStart(e: DragEvent, group: ShapeGroup) {
  if (store.groupBy.value !== "color") return;
  dragKey.value = group.key;
  e.dataTransfer!.effectAllowed = "move";
  e.dataTransfer!.setData("text/plain", group.key);
}

function onDragOver(e: DragEvent, group: ShapeGroup) {
  if (!dragKey.value || dragKey.value === group.key) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = "move";
  // Determine drop zone: top 25% = before, bottom 25% = after, center = merge
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;
  if (ratio < 0.25) dropTarget.value = { key: group.key, mode: "before" };
  else if (ratio > 0.75) dropTarget.value = { key: group.key, mode: "after" };
  else dropTarget.value = { key: group.key, mode: "merge" };
}

function onDragLeave(e: DragEvent, group: ShapeGroup) {
  if (dropTarget.value?.key === group.key) dropTarget.value = null;
}

function onDrop(e: DragEvent, group: ShapeGroup) {
  e.preventDefault();
  if (!dragKey.value || dragKey.value === group.key) { resetDrag(); return; }
  const srcColor = colorFromKey(dragKey.value);
  const tgtColor = colorFromKey(group.key);
  const mode = dropTarget.value?.mode ?? "after";
  if (mode === "merge") {
    store.mergeColorGroups(srcColor, tgtColor);
  } else {
    store.reorderColorGroup(srcColor, tgtColor, mode);
  }
  resetDrag();
}

function onDragEnd() { resetDrag(); }

function resetDrag() {
  dragKey.value = null;
  dropTarget.value = null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const allCollapsed = computed(() => {
  const groups = store.groupedShapes.value;
  if (groups.length <= 1) return false;
  return groups.every((g) => store.collapsedGroups.value.has(g.key));
});

function toggleAllCollapsed() {
  const groups = store.groupedShapes.value;
  if (allCollapsed.value) store.collapsedGroups.value = new Set();
  else store.collapsedGroups.value = new Set(groups.map((g) => g.key));
}

function toggleSelExpanded(key: string) {
  const next = new Set(expandedSelections.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedSelections.value = next;
}

function selCount(g: ShapeGroup): number {
  return g.shapes.filter((s) => store.selectedIds.value.has(s.id)).length;
}

function selShapes(g: ShapeGroup): SvgShape[] {
  return g.shapes.filter((s) => store.selectedIds.value.has(s.id));
}

function isFull(g: ShapeGroup): boolean {
  return g.shapes.length > 0 && selCount(g) === g.shapes.length;
}

function isPartial(g: ShapeGroup): boolean {
  const c = selCount(g);
  return c > 0 && c < g.shapes.length;
}

function hasMerges(g: ShapeGroup): boolean {
  return g.swatches.length > 1;
}

function groupAllVisible(g: ShapeGroup): boolean {
  return g.shapes.every((s) => s.visible);
}

function groupAnyVisible(g: ShapeGroup): boolean {
  return g.shapes.some((s) => s.visible);
}
</script>

<template>
  <div class="flex flex-col gap-0.5">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-1 mb-1 gap-1">
      <div class="flex items-center gap-1.5">
        <i class="i-mdi-layers-triple-outline text-sm text-[rgb(var(--text-muted))]" />
        <span class="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--text-secondary))]">
          Shapes
        </span>
        <span v-if="store.shapes.length" class="clay-pill tabular-nums text-[9px]">
          {{ store.shapes.length }}
        </span>
      </div>

      <div class="flex items-center gap-0.5">
        <!-- Sort by hue -->
        <button
          v-if="store.groupBy.value === 'color' && store.groupedShapes.value.length > 1"
          class="clay-btn !w-6 !h-6 !rounded-lg"
          title="Sort by hue"
          @click="store.sortColorGroupsByHue()"
        >
          <i class="i-mdi-sort-variant text-xs" />
        </button>

        <!-- Fold/unfold all -->
        <button
          v-if="store.groupBy.value !== 'flat' && store.groupedShapes.value.length > 1"
          class="clay-btn !w-6 !h-6 !rounded-lg"
          :title="allCollapsed ? 'Expand all groups' : 'Collapse all groups'"
          @click="toggleAllCollapsed"
        >
          <i :class="allCollapsed ? 'i-mdi-unfold-more-horizontal' : 'i-mdi-unfold-less-horizontal'" class="text-xs" />
        </button>

        <button
          class="clay-btn !w-6 !h-6 !rounded-lg"
          :class="store.groupBy.value === 'flat' && 'clay-btn-on'"
          title="Flat list"
          @click="store.groupBy.value = 'flat'"
        >
          <i class="i-mdi-format-list-bulleted text-xs" />
        </button>
        <button
          class="clay-btn !w-6 !h-6 !rounded-lg"
          :class="store.groupBy.value === 'color' && 'clay-btn-on'"
          title="Group by color"
          @click="store.groupBy.value = 'color'"
        >
          <i class="i-mdi-palette-outline text-xs" />
        </button>
        <button
          class="clay-btn !w-6 !h-6 !rounded-lg"
          :class="store.groupBy.value === 'group' && 'clay-btn-on'"
          title="Group by SVG group"
          @click="store.groupBy.value = 'group'"
        >
          <i class="i-mdi-folder-outline text-xs" />
        </button>
      </div>
    </div>

    <!-- ── Empty state ─────────────────────────────────────────── -->
    <div v-if="store.shapes.length === 0" class="clay-well text-center py-4">
      <span class="text-[11px] text-[rgb(var(--text-muted))]">No shapes loaded</span>
    </div>

    <!-- ── Groups ──────────────────────────────────────────────── -->
    <template v-for="group in store.groupedShapes.value" :key="group.key">

      <!-- ── Group header ──────────────────────────────────────── -->
      <div
        v-if="store.groupBy.value !== 'flat'"
        class="group/header relative flex items-center gap-1.5 px-1.5 h-[24px] rounded-lg transition-all duration-200 select-none"
        :class="[
          // Selection state
          isFull(group)
            ? 'bg-[rgb(var(--accent-soft))] shadow-[0_1px_3px_rgb(var(--clay-dark)),0_2px_8px_rgb(var(--accent-glow)),inset_0_1px_0_rgb(var(--clay-light))]'
            : isPartial(group)
              ? 'bg-[rgb(var(--bg-elevated))] shadow-[0_1px_2px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]'
              : 'hover:bg-[rgb(var(--bg-elevated))] hover:shadow-[0_1px_2px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]',
          // Drag state
          dragKey && dragKey !== group.key && dropTarget?.key === group.key && dropTarget.mode === 'merge'
            ? 'ring-2 ring-[rgb(var(--accent))] ring-opacity-60'
            : '',
          dragKey === group.key ? 'opacity-40' : '',
          // Cursor
          store.groupBy.value === 'color' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        ]"
        :draggable="store.groupBy.value === 'color'"
        @click="(e: MouseEvent) => store.selectGroup(group, e.shiftKey)"
        @dragstart="(e: DragEvent) => onDragStart(e, group)"
        @dragover="(e: DragEvent) => onDragOver(e, group)"
        @dragleave="(e: DragEvent) => onDragLeave(e, group)"
        @drop="(e: DragEvent) => onDrop(e, group)"
        @dragend="onDragEnd"
      >
        <!-- Drop indicator: before -->
        <div
          v-if="dragKey && dropTarget?.key === group.key && dropTarget.mode === 'before'"
          class="absolute left-0 right-0 -top-[1px] h-[2px] bg-[rgb(var(--accent))] rounded-full"
        />

        <!-- Collapse chevron -->
        <button
          class="shrink-0 w-4 h-4 flex items-center justify-center transition-transform duration-200 text-[rgb(var(--text-muted))]"
          :class="store.collapsedGroups.value.has(group.key) && '-rotate-90'"
          @click.stop="store.toggleGroupCollapsed(group.key)"
        >
          <i class="i-mdi-chevron-down text-xs" />
        </button>

        <!-- Swatch(es) -->
        <div v-if="group.swatches.length > 1" class="flex -space-x-1 shrink-0">
          <span
            v-for="sw in group.swatches.slice(0, 4)"
            :key="sw"
            class="w-2.5 h-2.5 rounded-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] ring-1 ring-[rgb(var(--bg-surface))]"
            :style="{ background: sw }"
          />
          <span
            v-if="group.swatches.length > 4"
            class="w-2.5 h-2.5 rounded-sm bg-[rgb(var(--bg-well))] flex items-center justify-center text-[6px] text-[rgb(var(--text-muted))] ring-1 ring-[rgb(var(--bg-surface))]"
          >+{{ group.swatches.length - 4 }}</span>
        </div>
        <span
          v-else-if="group.swatch"
          class="w-3 h-3 rounded-sm shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3),0_0.5px_0_rgb(var(--clay-light))]"
          :style="{ background: group.swatch }"
        />
        <i v-else :class="[group.icon, 'text-xs text-[rgb(var(--text-muted))]']" />

        <!-- Label -->
        <span
          class="flex-1 text-[10px] font-semibold uppercase tracking-wide truncate transition-colors duration-200"
          :class="isFull(group) ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-secondary))]'"
        >{{ group.label }}</span>

        <!-- Unmerge button (for merged groups) -->
        <button
          v-if="hasMerges(group) && store.groupBy.value === 'color'"
          class="shrink-0 p-0.5 rounded text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))]
                 cursor-pointer transition-colors duration-150"
          title="Unmerge colors"
          @click.stop="store.unmergeColorGroup(colorFromKey(group.key))"
        >
          <i class="i-mdi-call-split text-xs" />
        </button>

        <!-- Visibility toggle -->
        <button
          class="shrink-0 p-0.5 rounded transition-all duration-150 cursor-pointer
                 opacity-0 group-hover/header:opacity-100"
          :class="groupAllVisible(group)
            ? 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-secondary))]'
            : 'text-[rgb(var(--accent))] opacity-100'"
          :title="groupAllVisible(group) ? 'Hide group' : 'Show group'"
          @click.stop="store.toggleGroupVisible(group)"
        >
          <i :class="groupAllVisible(group) ? 'i-mdi-eye-outline' : 'i-mdi-eye-off-outline'" class="text-xs" />
        </button>

        <!-- Count badge -->
        <span class="clay-pill text-[8px] tabular-nums">
          <template v-if="selCount(group)">
            <span class="text-[rgb(var(--accent))]">{{ selCount(group) }}</span>/</template>{{ group.shapes.length }}
        </span>

        <!-- Drop indicator: after -->
        <div
          v-if="dragKey && dropTarget?.key === group.key && dropTarget.mode === 'after'"
          class="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[rgb(var(--accent))] rounded-full"
        />
      </div>

      <!-- ── Expanded: shape list ──────────────────────────────── -->
      <div
        v-if="!store.collapsedGroups.value.has(group.key)"
        class="flex flex-col"
        :class="store.groupBy.value !== 'flat' ? 'ml-2 pl-2 border-l border-[rgb(var(--border))]' : ''"
      >
        <ShapeItem
          v-for="shape in group.shapes"
          :key="shape.id"
          :shape="shape"
          :selected="store.selectedIds.value.has(shape.id)"
          @select="(e: MouseEvent) => store.selectShape(shape.id, e.shiftKey)"
          @toggle-visible="store.toggleShapeVisible(shape.id)"
        />
      </div>

      <!-- ── Collapsed: selected sub-list only ─────────────────── -->
      <div
        v-else-if="store.groupBy.value !== 'flat' && isPartial(group)"
        class="ml-2 pl-2 border-l border-[rgb(var(--border))]"
      >
        <div class="flex items-center gap-1.5 px-1.5 h-[22px]">
          <button
            class="flex items-center gap-0.5 text-[9px] text-[rgb(var(--accent))] font-medium
                   cursor-pointer hover:underline transition-colors duration-150"
            @click.stop="toggleSelExpanded(group.key)"
          >
            <i
              class="i-mdi-chevron-down text-[10px] transition-transform duration-200"
              :class="!expandedSelections.has(group.key) && '-rotate-90'"
            />
            {{ selCount(group) }} selected
          </button>
        </div>

        <Transition name="sel-list">
          <div
            v-if="expandedSelections.has(group.key)"
            class="flex flex-col"
          >
            <ShapeItem
              v-for="shape in selShapes(group)"
              :key="shape.id"
              :shape="shape"
              :selected="true"
              @select="(e: MouseEvent) => store.selectShape(shape.id, e.shiftKey)"
              @toggle-visible="store.toggleShapeVisible(shape.id)"
            />
          </div>
        </Transition>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sel-list-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.sel-list-leave-active { transition: all 0.12s ease; }
.sel-list-enter-from   { opacity: 0; transform: translateY(-4px); }
.sel-list-leave-to     { opacity: 0; transform: translateY(-2px); }
</style>
