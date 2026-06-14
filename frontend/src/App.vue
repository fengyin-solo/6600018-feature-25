<template>
  <div class="flex h-screen">
    <!-- Left: Document list -->
    <div class="w-64 bg-gray-900 p-4 flex flex-col gap-3 border-r border-gray-800">
      <h1 class="text-lg font-bold text-amber-400">古籍 OCR 标注平台</h1>

      <div>
        <label class="block bg-amber-500 text-black text-center py-2 rounded cursor-pointer hover:bg-amber-400 text-sm font-medium">
          上传古籍图片
          <input type="file" accept="image/*" @change="onUpload" class="hidden" />
        </label>
      </div>

      <button @click="store.loadMockDocument()" class="bg-gray-800 py-2 rounded text-sm hover:bg-gray-700">
        加载示例文档
      </button>

      <!-- Search -->
      <div>
        <input v-model="store.searchQuery" @input="store.searchInDocuments(store.searchQuery)"
          placeholder="全文检索..." class="w-full bg-gray-800 rounded px-3 py-2 text-sm" />
        <div v-if="store.searchResults.length" class="mt-1 space-y-1">
          <div v-for="r in store.searchResults" :key="r.id" class="bg-gray-800 rounded p-1 text-xs">
            {{ r.text }} <span class="text-gray-500">{{ (r.confidence * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>

      <!-- Document list -->
      <div class="flex-1 overflow-y-auto space-y-1">
        <div v-for="d in store.documents" :key="d.id" @click="store.currentDoc = d"
          class="bg-gray-800 rounded p-2 cursor-pointer text-sm"
          :class="store.currentDoc?.id === d.id ? 'ring-1 ring-amber-500' : ''">
          {{ d.name }}
          <div class="text-xs text-gray-500">{{ d.results.length }} 行识别</div>
        </div>
      </div>

      <!-- Export -->
      <button @click="doExport" class="bg-green-700 py-2 rounded text-sm hover:bg-green-600">
        导出 TEI/XML
      </button>
    </div>

    <!-- Center: Image + OCR overlay -->
    <div class="flex-1 relative bg-gray-950 overflow-hidden">
      <ImageCanvas v-if="store.currentDoc" />
      <div v-else class="flex items-center justify-center h-full text-gray-600">
        请上传古籍图片或加载示例文档
      </div>
    </div>

    <!-- Right: OCR results & annotations -->
    <div class="w-80 bg-gray-900 p-4 flex flex-col gap-3 border-l border-gray-800 overflow-y-auto">
      <h3 class="text-amber-300 font-bold text-sm">OCR 识别结果</h3>
      <div v-if="store.currentDoc" class="space-y-2">
        <div v-for="r in store.currentDoc.results" :key="r.id"
          class="bg-gray-800 rounded p-2 text-sm">
          <div class="flex justify-between">
            <span class="text-white font-medium">{{ r.text }}</span>
            <span class="text-xs px-2 py-0.5 rounded"
              :class="r.confidence > 0.9 ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'">
              {{ (r.confidence * 100).toFixed(0) }}%
            </span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            简体: {{ store.convertVariant(r.text) }}
          </div>
          <input v-model="r.corrected" placeholder="人工校正..."
            class="w-full bg-gray-700 rounded px-2 py-1 text-xs mt-1" />
        </div>
      </div>

      <h3 class="text-amber-300 font-bold text-sm mt-4">标注列表</h3>
      <div class="flex gap-1 flex-wrap">
        <button v-for="f in filterOptions" :key="f.value"
          @click="store.annotationFilter = f.value"
          class="px-2 py-1 rounded text-xs font-medium transition-colors"
          :class="store.annotationFilter === f.value
            ? 'bg-amber-500 text-black'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'">
          {{ f.label }}
        </button>
      </div>
      <div v-if="store.currentDoc" class="space-y-1">
        <div v-for="a in store.filteredAnnotations" :key="a.id"
          @click="store.selectAnnotation(store.selectedAnnotationId === a.id ? null : a.id)"
          class="rounded p-2 text-xs flex justify-between cursor-pointer transition-colors"
          :class="store.selectedAnnotationId === a.id
            ? 'ring-2 ring-offset-1 ring-offset-gray-900 ' + typeRingClass(a.type) + ' ' + typeBgActiveClass(a.type)
            : 'bg-gray-800 hover:bg-gray-750'">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full" :class="typeDotClass(a.type)"></span>
            <span class="px-1 rounded text-[10px] font-medium" :class="typeBadgeClass(a.type)">{{ typeLabel(a.type) }}</span>
            <span class="text-gray-300">{{ a.label }}: {{ a.content }}</span>
          </span>
          <button @click.stop="store.removeAnnotation(a.id)" class="text-red-400 hover:underline shrink-0">删除</button>
        </div>
        <div v-if="!store.currentDoc.annotations.length" class="text-gray-600 text-xs">
          在图片上拖拽框选区域添加标注
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOcrStore } from './store/ocr'
import type { Annotation } from './types'
import ImageCanvas from './components/ImageCanvas.vue'

const store = useOcrStore()

const filterOptions = [
  { label: '全部', value: 'all' as const },
  { label: '区域', value: 'region' as const },
  { label: '异体字', value: 'character' as const },
  { label: '批注', value: 'note' as const },
]

const TYPE_LABELS: Record<Annotation['type'], string> = {
  region: '区域',
  character: '异体字',
  note: '批注',
}

function typeLabel(type: Annotation['type']): string {
  return TYPE_LABELS[type]
}

function typeDotClass(type: Annotation['type']): string {
  const map: Record<Annotation['type'], string> = {
    region: 'bg-blue-500',
    character: 'bg-amber-500',
    note: 'bg-emerald-500',
  }
  return map[type]
}

function typeBadgeClass(type: Annotation['type']): string {
  const map: Record<Annotation['type'], string> = {
    region: 'bg-blue-900/60 text-blue-300',
    character: 'bg-amber-900/60 text-amber-300',
    note: 'bg-emerald-900/60 text-emerald-300',
  }
  return map[type]
}

function typeRingClass(type: Annotation['type']): string {
  const map: Record<Annotation['type'], string> = {
    region: 'ring-blue-500',
    character: 'ring-amber-500',
    note: 'ring-emerald-500',
  }
  return map[type]
}

function typeBgActiveClass(type: Annotation['type']): string {
  const map: Record<Annotation['type'], string> = {
    region: 'bg-blue-950',
    character: 'bg-amber-950',
    note: 'bg-emerald-950',
  }
  return map[type]
}

function onUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) store.uploadAndOCR(file)
}

function doExport() {
  const tei = store.exportTEI()
  if (!tei) return
  const blob = new Blob([tei], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${store.currentDoc?.name || 'export'}.xml`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
