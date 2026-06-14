import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Document, OCRResult, Annotation } from '../types'

export type AnnotationType = Annotation['type']

export const useOcrStore = defineStore('ocr', () => {
  const documents = ref<Document[]>([])
  const currentDoc = ref<Document | null>(null)
  const isLoading = ref(false)
  const searchQuery = ref('')
  const searchResults = ref<OCRResult[]>([])
  const annotationFilter = ref<AnnotationType | 'all'>('all')
  const selectedAnnotationId = ref<string | null>(null)

  const filteredAnnotations = computed(() => {
    const list = currentDoc.value?.annotations || []
    if (annotationFilter.value === 'all') return list
    return list.filter(a => a.type === annotationFilter.value)
  })

  const visibleAnnotations = computed(() => {
    const list = currentDoc.value?.annotations || []
    if (annotationFilter.value === 'all') return list
    const selId = selectedAnnotationId.value
    const filtered = list.filter(a => a.type === annotationFilter.value)
    if (!selId) return filtered
    const sel = list.find(a => a.id === selId)
    if (sel && !filtered.includes(sel)) return [...filtered, sel]
    return filtered
  })

  const annotationCounts = computed(() => {
    const list = currentDoc.value?.annotations || []
    return {
      all: list.length,
      region: list.filter(a => a.type === 'region').length,
      character: list.filter(a => a.type === 'character').length,
      note: list.filter(a => a.type === 'note').length,
    }
  })

  const MOCK_DOC_BASE: Document = {
    id: '1',
    name: '论语·学而篇',
    imageUrl: '',
    results: [
      { id: 'r1', text: '子曰', bbox: [50, 30, 80, 40], confidence: 0.95 },
      { id: 'r2', text: '学而', bbox: [50, 80, 80, 40], confidence: 0.88 },
      { id: 'r3', text: '时习之', bbox: [50, 130, 120, 40], confidence: 0.91 },
      { id: 'r4', text: '不亦说乎', bbox: [50, 180, 160, 40], confidence: 0.87 },
      { id: 'r5', text: '有朋', bbox: [200, 30, 80, 40], confidence: 0.93 },
      { id: 'r6', text: '自远方来', bbox: [200, 80, 160, 40], confidence: 0.85 },
      { id: 'r7', text: '不亦乐乎', bbox: [200, 130, 160, 40], confidence: 0.92 },
    ],
    annotations: [],
    createdAt: '2025-01-15'
  }

  const VARIANT_DICT: Record<string, string> = {
    '説': '说', '學': '学', '習': '习', '遠': '远', '樂': '乐', '書': '书',
    '國': '国', '東': '东', '長': '长', '門': '门', '馬': '马', '鳥': '鸟',
    '風': '风', '雲': '云', '龍': '龙', '車': '车', '萬': '万', '見': '见',
  }

  function loadMockDocument() {
    const clone: Document = JSON.parse(JSON.stringify(MOCK_DOC_BASE))
    clone.id = Date.now().toString()
    documents.value = [clone]
    currentDoc.value = clone
    selectedAnnotationId.value = null
    annotationFilter.value = 'all'
  }

  async function uploadAndOCR(file: File) {
    isLoading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch('/api/ocr', { method: 'POST', body: formData })
      if (resp.ok) {
        const data = await resp.json()
        const doc: Document = {
          id: Date.now().toString(),
          name: file.name,
          imageUrl: URL.createObjectURL(file),
          results: data.results || [],
          annotations: [],
          createdAt: new Date().toISOString()
        }
        documents.value.push(doc)
        currentDoc.value = doc
      }
    } catch {
      // Use mock data as fallback
      loadMockDocument()
    } finally {
      isLoading.value = false
    }
  }

  function addAnnotation(type: Annotation['type'], bbox: [number, number, number, number], label: string, content: string) {
    if (!currentDoc.value) return
    const id = Date.now().toString()
    const annotation: Annotation = { id, type, bbox, label, content }
    currentDoc.value.annotations.push(annotation)
    if (annotationFilter.value !== 'all' && annotationFilter.value !== type) {
      annotationFilter.value = 'all'
    }
    selectedAnnotationId.value = id
    return id
  }

  function removeAnnotation(id: string) {
    if (!currentDoc.value) return
    if (selectedAnnotationId.value === id) {
      selectedAnnotationId.value = null
    }
    currentDoc.value.annotations = currentDoc.value.annotations.filter(a => a.id !== id)
  }

  function convertVariant(text: string): string {
    return text.split('').map(c => VARIANT_DICT[c] || c).join('')
  }

  function searchInDocuments(query: string) {
    const q = query.toLowerCase()
    searchResults.value = documents.value.flatMap(d =>
      d.results.filter(r => r.text.includes(q) || (r.corrected || '').includes(q))
    )
  }

  function exportTEI(): string {
    if (!currentDoc.value) return ''
    let tei = '<?xml version="1.0" encoding="UTF-8"?>\n'
    tei += '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n'
    tei += `  <teiHeader><fileDesc><titleStmt><title>${currentDoc.value.name}</title></titleStmt></fileDesc></teiHeader>\n`
    tei += '  <text><body>\n'
    for (const r of currentDoc.value.results) {
      tei += `    <seg type="line" xml:id="${r.id}" cert="${r.confidence}">${r.corrected || r.text}</seg>\n`
    }
    tei += '  </body></text>\n</TEI>'
    return tei
  }

  function selectAnnotation(id: string | null) {
    selectedAnnotationId.value = id
  }

  return {
    documents, currentDoc, isLoading, searchQuery, searchResults,
    annotationFilter, selectedAnnotationId, filteredAnnotations, visibleAnnotations, annotationCounts,
    loadMockDocument, uploadAndOCR, addAnnotation, removeAnnotation,
    selectAnnotation, convertVariant, searchInDocuments, exportTEI
  }
})
