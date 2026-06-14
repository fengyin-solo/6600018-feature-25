<template>
  <div class="relative w-full h-full overflow-auto" ref="scrollContainer"
    @mousedown="startDrag" @mousemove="onDrag" @mouseup="endDrag">
    <div class="relative" :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }" ref="contentRef">
      <!-- Image -->
      <img v-if="store.currentDoc?.imageUrl" :src="store.currentDoc.imageUrl"
        class="absolute inset-0 w-full h-full object-contain" ref="imgRef" />
      <!-- Placeholder canvas for mock -->
      <canvas v-else ref="mockCanvas" class="absolute inset-0 block" />

      <!-- OCR Bounding Boxes -->
      <svg class="absolute inset-0 w-full h-full pointer-events-none">
        <g v-for="r in store.currentDoc?.results || []" :key="r.id">
          <rect :x="r.bbox[0]" :y="r.bbox[1]" :width="r.bbox[2]" :height="r.bbox[3]"
            fill="none" stroke="rgba(251,191,36,0.6)" stroke-width="2" />
          <text :x="r.bbox[0]" :y="r.bbox[1] - 5" fill="#fbbf24" font-size="12">{{ r.text }}</text>
        </g>
        <!-- Annotations (visible = filtered + selected) -->
        <g v-for="a in store.visibleAnnotations" :key="a.id"
          class="cursor-pointer pointer-events-auto"
          @click.stop="store.selectAnnotation(store.selectedAnnotationId === a.id ? null : a.id)"
          @mouseenter="onAnnotationEnter(a.id)"
          @mouseleave="onAnnotationLeave()">
          <rect :x="a.bbox[0]" :y="a.bbox[1]" :width="a.bbox[2]" :height="a.bbox[3]"
            :fill="isSelected(a.id) ? typeHighlightColor(a.type, 0.3) : typeHighlightColor(a.type, 0.1)"
            :stroke="typeStrokeColor(a.type)"
            :stroke-width="isSelected(a.id) ? 3 : 2"
            :stroke-dasharray="isSelected(a.id) ? 'none' : '5,5'"
            rx="2" />
          <text :x="a.bbox[0]" :y="a.bbox[1] - 5"
            :fill="typeStrokeColor(a.type)" font-size="11" font-weight="bold">
            {{ a.label }}
          </text>
          <circle v-if="isSelected(a.id)"
            :cx="a.bbox[0] + a.bbox[2] / 2" :cy="a.bbox[1] + a.bbox[3] / 2" r="4"
            :fill="typeStrokeColor(a.type)" />
        </g>
        <!-- Drag selection -->
        <rect v-if="dragging" :x="dragRect.x" :y="dragRect.y" :width="dragRect.w" :height="dragRect.h"
          fill="rgba(16,185,129,0.1)" stroke="#10b981" stroke-width="2" stroke-dasharray="4,4" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch, nextTick } from 'vue'
import { useOcrStore } from '../store/ocr'
import type { Annotation } from '../types'

const store = useOcrStore()
const mockCanvas = ref<HTMLCanvasElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })
const dragRect = reactive({ x: 0, y: 0, w: 0, h: 0 })
const canvasWidth = ref(900)
const canvasHeight = ref(700)
let hoverPinnedId: string | null = null

const TYPE_COLORS: Record<Annotation['type'], string> = {
  region: '#3b82f6',
  character: '#f59e0b',
  note: '#10b981',
}

function typeStrokeColor(type: Annotation['type']): string {
  return TYPE_COLORS[type]
}

function typeHighlightColor(type: Annotation['type'], alpha: number): string {
  const hex = TYPE_COLORS[type].replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function isSelected(id: string): boolean {
  return store.selectedAnnotationId === id
}

function onAnnotationEnter(id: string) {
  hoverPinnedId = store.selectedAnnotationId
  store.selectAnnotation(id)
}

function onAnnotationLeave() {
  if (hoverPinnedId !== null) {
    store.selectAnnotation(hoverPinnedId)
    hoverPinnedId = null
  }
}

function scrollToAnnotation(id: string | null) {
  if (!id || !scrollContainer.value || !contentRef.value) return
  const a = store.currentDoc?.annotations.find(a => a.id === id)
  if (!a) return
  nextTick(() => {
    if (!scrollContainer.value) return
    const container = scrollContainer.value
    const cx = a.bbox[0] + a.bbox[2] / 2
    const cy = a.bbox[1] + a.bbox[3] / 2
    container.scrollTo({
      left: Math.max(0, cx - container.clientWidth / 2),
      top: Math.max(0, cy - container.clientHeight / 2),
      behavior: 'smooth',
    })
  })
}

watch(() => store.selectedAnnotationId, scrollToAnnotation)

onMounted(() => {
  if (scrollContainer.value) {
    canvasWidth.value = Math.max(900, scrollContainer.value.clientWidth * 2)
    canvasHeight.value = Math.max(700, scrollContainer.value.clientHeight * 2)
  }
  nextTick(() => {
    if (mockCanvas.value) {
      const ctx = mockCanvas.value.getContext('2d')!
      const w = mockCanvas.value.width = canvasWidth.value
      const h = mockCanvas.value.height = canvasHeight.value

      ctx.fillStyle = '#f5e6c8'
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < 8000; i++) {
        ctx.fillStyle = `rgba(139,90,43,${Math.random() * 0.1})`
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
      }

      ctx.fillStyle = '#2d1810'
      ctx.font = 'bold 48px serif'
      const columns = [
        ['子', '曰', '學', '而', '時', '習', '之', '不', '亦', '説', '乎'],
        ['有', '朋', '自', '遠', '方', '來', '不', '亦', '樂', '乎'],
        ['人', '不', '知', '而', '不', '慍', '不', '亦', '君', '子', '乎'],
      ]
      columns.forEach((col, ci) => {
        const x = w - 200 - ci * 220
        col.forEach((ch, ri) => {
          ctx.fillText(ch, x, 120 + ri * 75)
        })
      })
    }
  })
})

function startDrag(e: MouseEvent) {
  if (!contentRef.value) return
  const rect = contentRef.value.getBoundingClientRect()
  dragStart.x = e.clientX - rect.left
  dragStart.y = e.clientY - rect.top
  dragging.value = true
  dragRect.x = dragStart.x
  dragRect.y = dragStart.y
  dragRect.w = 0
  dragRect.h = 0
}

function onDrag(e: MouseEvent) {
  if (!dragging.value || !contentRef.value) return
  const rect = contentRef.value.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  dragRect.x = Math.min(dragStart.x, cx)
  dragRect.y = Math.min(dragStart.y, cy)
  dragRect.w = Math.abs(cx - dragStart.x)
  dragRect.h = Math.abs(cy - dragStart.y)
}

function endDrag(e: MouseEvent) {
  if (!dragging.value || dragRect.w < 10 || dragRect.h < 10) { dragging.value = false; return }
  dragging.value = false
  const typeInput = prompt('标注类型：region (区域) / character (异体字) / note (批注)', 'region') || 'region'
  const trimmed = typeInput.trim()
  const type = (['region', 'character', 'note'].includes(trimmed) ? trimmed : 'region') as Annotation['type']
  const labelInput = prompt('标注标签（如：学而篇、异体字「說」、批注）', '')
  const label = labelInput && labelInput.trim() ? labelInput.trim() : TYPE_LABELS[type]
  const contentInput = prompt('标注内容', '')
  const content = contentInput ? contentInput.trim() : ''
  store.addAnnotation(type, [dragRect.x, dragRect.y, dragRect.w, dragRect.h], label, content)
}

const TYPE_LABELS: Record<Annotation['type'], string> = {
  region: '区域',
  character: '异体字',
  note: '批注',
}
</script>
