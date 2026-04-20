<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  suffix?: string;
}>(), {
  decimals: 2,
  suffix: "",
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const pct = computed(() =>
  ((props.modelValue - props.min) / (props.max - props.min)) * 100,
);

const trackRef = ref<HTMLElement | null>(null);
const dragging = ref(false);

function valueFromX(clientX: number): number {
  const el = trackRef.value;
  if (!el) return props.modelValue;
  const { left, width } = el.getBoundingClientRect();
  const raw = (clientX - left) / width;
  const clamped = Math.max(0, Math.min(1, raw));
  const range = props.max - props.min;
  const stepped = Math.round((clamped * range) / props.step) * props.step;
  return parseFloat((props.min + stepped).toFixed(10));
}

function onTrackPointerDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  dragging.value = true;
  emit("update:modelValue", valueFromX(e.clientX));
}

function onTrackPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  emit("update:modelValue", valueFromX(e.clientX));
}

function onTrackPointerUp(e: PointerEvent) {
  dragging.value = false;
  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
}
</script>

<template>
  <div class="space-y-1.5">
    <!-- Label + value -->
    <div class="flex items-center justify-between px-0.5">
      <span class="text-[11px] text-[rgb(var(--text-secondary))] font-medium">{{ label }}</span>
      <span class="tabular-nums text-[10px] text-[rgb(var(--accent))] font-mono min-w-[42px] text-right">
        {{ modelValue.toFixed(decimals) }}{{ suffix }}
      </span>
    </div>

    <!-- Track -->
    <div
      ref="trackRef"
      class="relative h-[18px] flex items-center cursor-pointer select-none"
      @pointerdown="onTrackPointerDown"
      @pointermove="onTrackPointerMove"
      @pointerup="onTrackPointerUp"
      @pointercancel="dragging = false"
    >
      <!-- Track groove -->
      <div class="absolute inset-x-0 h-[5px] rounded-full
                  bg-[rgb(var(--bg-well))]
                  shadow-[inset_0_1px_3px_rgb(var(--clay-inset)),inset_0_0_0_1px_rgb(var(--border))]">
        <!-- Filled portion -->
        <div
          class="absolute left-0 top-0 h-full rounded-full
                 bg-[rgb(var(--accent))]
                 shadow-[0_0_6px_rgb(var(--accent-glow))]
                 transition-none"
          :style="{ width: `${pct}%` }"
        />
      </div>

      <!-- Thumb -->
      <div
        class="absolute w-[14px] h-[14px] -translate-x-1/2 rounded-full pointer-events-none
               bg-[rgb(var(--bg-elevated))]
               shadow-[0_1px_4px_rgb(var(--clay-dark)),0_2px_8px_rgb(var(--clay-dark)),inset_0_1px_0_rgb(var(--clay-light))]
               ring-2 ring-[rgb(var(--accent))] ring-opacity-60
               transition-transform duration-100"
        :class="dragging && 'scale-110'"
        :style="{ left: `${pct}%` }"
      />
    </div>
  </div>
</template>
