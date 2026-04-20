<script setup lang="ts">
/**
 * ShapeItem — minimal single-line shape row.
 * swatch · label · visibility (on hover)
 */
import type { SvgShape } from "~/composables/useFfitoStore";

const props = defineProps<{
  shape: SvgShape;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [e: MouseEvent];
  toggleVisible: [];
}>();

const label = computed(() =>
  props.shape.id.split("-").slice(0, -1).join("-") || props.shape.id,
);
</script>

<template>
  <div
    class="flex items-center gap-1.5 px-1.5 h-[22px] rounded-md cursor-pointer transition-all duration-200 group/item"
    :class="selected
      ? 'bg-[rgb(var(--accent-soft))] shadow-[0_1px_3px_rgb(var(--clay-dark)),0_2px_8px_rgb(var(--accent-glow))]'
      : 'bg-transparent hover:bg-[rgb(var(--bg-elevated))]'"
    @click="emit('select', $event)"
  >
    <!-- Fill swatch -->
    <span
      class="w-3 h-3 rounded-sm shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
      :style="{ background: shape.fill === 'none' ? 'rgb(var(--bg-well))' : shape.fill }"
    />

    <!-- Label -->
    <span
      class="flex-1 min-w-0 text-[11px] font-medium truncate transition-colors duration-200"
      :class="selected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-primary))]'"
      :title="shape.id"
    >{{ label }}</span>

    <!-- Visibility (show on hover) -->
    <button
      class="shrink-0 p-0.5 rounded-lg cursor-pointer transition-all duration-200
             opacity-0 group-hover/item:opacity-100
             hover:bg-[rgb(var(--bg-well))]"
      :class="!shape.visible && 'opacity-40!'"
      @click.stop="emit('toggleVisible')"
    >
      <i
        :class="shape.visible ? 'i-mdi-eye-outline' : 'i-mdi-eye-off-outline'"
        class="text-xs text-[rgb(var(--text-muted))]"
      />
    </button>
  </div>
</template>
