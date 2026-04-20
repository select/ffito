<script setup lang="ts">
// Keyboard shortcuts
function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  const store = useFfitoStore();

  if (e.key === "s" || e.key === "S") store.toolMode.value = "select";
  if (e.key === "n" || e.key === "N") store.toolMode.value = "node";
  if ((e.ctrlKey || e.metaKey) && e.key === "a") {
    e.preventDefault();
    store.selectAll();
  }
  if (e.key === "Escape") store.deselectAll();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="h-full">
    <NuxtPage class="h-full" />
  </div>
</template>
