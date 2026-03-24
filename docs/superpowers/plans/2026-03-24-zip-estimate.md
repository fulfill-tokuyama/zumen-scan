# ZIP解析 + 見積り生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ZIP upload for batch PDF analysis and AI-powered construction estimate generation with Excel export.

**Architecture:** Client-side ZIP extraction (JSZip) feeds existing PDF→PNG→Gemini pipeline. Second Gemini call generates estimates from analysis results. ExcelJS produces downloadable .xlsx. Custom hooks isolate batch/estimate logic from page component.

**Tech Stack:** Next.js 16, JSZip, ExcelJS, Gemini 2.5 Flash, pdfjs-dist, shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-24-zip-estimate-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/types/estimate.ts` | EstimateLineItem, EstimateCategorySummary, EstimateResult types |
| `src/lib/zip-extractor.ts` | JSZip extraction → PDF File[] with safety limits |
| `src/lib/estimate-generator.ts` | Gemini② call: AnalysisResult[] → EstimateResult |
| `src/lib/estimate-excel.ts` | ExcelJS workbook generation |
| `src/app/api/estimate/route.ts` | POST /api/estimate endpoint |
| `src/hooks/useBatchAnalysis.ts` | ZIP batch analysis state + orchestration |
| `src/hooks/useEstimate.ts` | Estimate generation state + API call |
| `src/components/analyzer/BatchProgress.tsx` | Progress bar + cancel button |
| `src/components/analyzer/ZipResultList.tsx` | PDF result cards with accordion |
| `src/components/analyzer/EstimateTab.tsx` | Estimate display with category accordions |

### Modified Files
| File | Change |
|------|--------|
| `src/components/analyzer/DropZone.tsx` | Add ZIP to accepted types |
| `src/app/(dashboard)/analyze/page.tsx` | Add ZIP branch + estimate flow using hooks |
| `src/lib/pdf-converter.ts` | Add canvas cleanup + batch conversion helper |
| `vercel.json` | Add maxDuration for estimate route |

### Known Type Issue
The existing `AnalysisResult.createdAt` is typed as `Date` but arrives as `string` from JSON API responses. Since `analysis.ts` must not be modified, hooks and components should treat `createdAt` as opaque (never call Date methods on it). This is a pre-existing issue not introduced by this plan.

### Do Not Modify
- `src/lib/gemini.ts`
- `src/types/analysis.ts`
- `src/app/api/analyze/route.ts`
- `src/components/analyzer/ResultTabs.tsx`

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install jszip and exceljs**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npm install jszip exceljs
```

- [ ] **Step 2: Verify installation**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
node -e "require('jszip'); require('exceljs'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add package.json package-lock.json
git commit -m "feat: add jszip and exceljs dependencies"
```

---

## Task 2: Estimate type definitions

**Files:**
- Create: `src/types/estimate.ts`

- [ ] **Step 1: Create estimate types**

```typescript
// src/types/estimate.ts

export interface EstimateLineItem {
  category: string
  subcategory: string
  item: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
  remarks: string
}

export interface EstimateCategorySummary {
  category: string
  subtotal: number
  items: EstimateLineItem[]
}

export interface EstimateResult {
  projectName: string
  buildingType: string
  totalArea: number
  categories: EstimateCategorySummary[]
  subtotal: number
  managementFee: number
  totalAmount: number
  taxAmount: number
  grandTotal: number
  assumptions: string[]
  generatedAt: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/types/estimate.ts 2>&1 | head -5
```

Expected: No errors (or empty output).

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/types/estimate.ts
git commit -m "feat: add EstimateResult type definitions"
```

---

## Task 3: ZIP extractor

**Files:**
- Create: `src/lib/zip-extractor.ts`

- [ ] **Step 1: Implement zip-extractor**

```typescript
// src/lib/zip-extractor.ts
import JSZip from "jszip"

const MAX_DECOMPRESSED_SIZE = 500 * 1024 * 1024 // 500MB
const MAX_FILE_COUNT = 100

export async function extractPdfsFromZip(file: File): Promise<File[]> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const pdfEntries: { entry: JSZip.JSZipObject; relativePath: string }[] = []

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return
    if (relativePath.endsWith(".zip")) return // skip nested zips
    if (!relativePath.toLowerCase().endsWith(".pdf")) return
    pdfEntries.push({ entry, relativePath })
  })

  if (pdfEntries.length === 0) {
    throw new Error("ZIP内にPDFファイルが見つかりませんでした")
  }

  if (pdfEntries.length > MAX_FILE_COUNT) {
    throw new Error(`ZIP内のファイル数が上限(${MAX_FILE_COUNT})を超えています`)
  }

  const files: File[] = []
  const nameCount = new Map<string, number>()
  let totalSize = 0

  for (const { entry, relativePath } of pdfEntries) {
    const blob = await entry.async("blob")
    totalSize += blob.size

    if (totalSize > MAX_DECOMPRESSED_SIZE) {
      throw new Error("ZIP展開後の合計サイズが上限(500MB)を超えています")
    }

    // Deduplicate filenames from different subdirectories
    let fileName = relativePath.split("/").pop() || relativePath
    const count = nameCount.get(fileName) || 0
    if (count > 0) {
      const ext = fileName.lastIndexOf(".")
      fileName = ext >= 0
        ? `${fileName.slice(0, ext)}_${count}${fileName.slice(ext)}`
        : `${fileName}_${count}`
    }
    nameCount.set(relativePath.split("/").pop() || relativePath, count + 1)

    const pdfFile = new File([blob], fileName, { type: "application/pdf" })
    files.push(pdfFile)
  }

  // Sort by filename for consistent ordering
  files.sort((a, b) => a.name.localeCompare(b.name, "ja"))

  return files
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/lib/zip-extractor.ts 2>&1 | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/lib/zip-extractor.ts
git commit -m "feat: add ZIP extractor with safety limits"
```

---

## Task 4: DropZone ZIP support

**Files:**
- Modify: `src/components/analyzer/DropZone.tsx`

The existing `ACCEPTED_TYPES` and UI text need to include ZIP. The `maxSize` stays 20MB for images/PDFs but we'll bump it for ZIP. Since ZIP files can be large (up to 100MB per spec), we change the max size to 100MB and let the zip-extractor enforce safety limits.

- [ ] **Step 1: Add ZIP to DropZone accepted types**

In `src/components/analyzer/DropZone.tsx`, make these changes:

Add ZIP MIME types to `ACCEPTED_TYPES`:
```typescript
const ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
}
```

Change max size from 20MB to 100MB:
```typescript
const MAX_SIZE = 100 * 1024 * 1024 // 100MB
```

Update the help text from `JPG / PNG / PDF 対応` to `JPG / PNG / PDF / ZIP 対応`:
```tsx
<p className="text-xs text-slate-400">JPG / PNG / PDF / ZIP 対応</p>
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx next build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/components/analyzer/DropZone.tsx
git commit -m "feat: add ZIP support to DropZone upload"
```

---

## Task 5: PDF converter — canvas cleanup + batch helper

**Files:**
- Modify: `src/lib/pdf-converter.ts`

The existing `convertPdfPageToImage` creates a canvas per call without cleanup, causing memory accumulation in batch mode. Also, it re-parses the entire PDF for every page. Add canvas cleanup and a batch helper that opens the PDF once.

- [ ] **Step 1: Add canvas cleanup and batch conversion**

Add the following to the end of `src/lib/pdf-converter.ts` (after the existing `convertPdfPageToImage` function). Also modify `convertPdfPageToImage` to clean up the canvas after use.

In the existing `convertPdfPageToImage`, add canvas cleanup before the return statement:

```typescript
  // After: const base64 = dataUrl.split(",")[1]
  // Add canvas cleanup for memory management
  canvas.width = 0
  canvas.height = 0
```

Then add this new function at the end of the file:

```typescript
export async function convertAllPdfPages(
  file: File
): Promise<{ base64: string; mimeType: "image/png" }[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const results: { base64: string; mimeType: "image/png" }[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const scale = 2.0
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Canvas contextの取得に失敗しました")
    }

    await page.render({ canvas, viewport }).promise

    const dataUrl = canvas.toDataURL("image/png")
    const base64 = dataUrl.split(",")[1]

    // Canvas cleanup for memory management
    canvas.width = 0
    canvas.height = 0

    results.push({ base64, mimeType: "image/png" })
  }

  return results
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/lib/pdf-converter.ts 2>&1 | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/lib/pdf-converter.ts
git commit -m "feat: add canvas cleanup and batch PDF conversion helper"
```

---

## Task 6: BatchProgress component

**Files:**
- Create: `src/components/analyzer/BatchProgress.tsx`

- [ ] **Step 1: Implement BatchProgress**

```tsx
// src/components/analyzer/BatchProgress.tsx
"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type BatchProgressProps = {
  current: number
  total: number
  currentFileName: string
  onCancel: () => void
}

export function BatchProgress({
  current,
  total,
  currentFileName,
  onCancel,
}: BatchProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="space-y-4 py-8 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
      <p className="text-sm text-slate-400">
        {current}/{total} ページ解析中...
      </p>
      <p className="text-xs text-slate-500 truncate px-4">
        {currentFileName}
      </p>
      <div className="mx-auto w-3/4 h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        className="border-slate-600 text-slate-400 hover:bg-slate-800"
      >
        キャンセル
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/components/analyzer/BatchProgress.tsx 2>&1 | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/components/analyzer/BatchProgress.tsx
git commit -m "feat: add BatchProgress component for ZIP analysis"
```

---

## Task 7: useBatchAnalysis hook

**Files:**
- Create: `src/hooks/useBatchAnalysis.ts`

This is the core orchestration for ZIP batch analysis. It handles:
- ZIP extraction via `zip-extractor.ts`
- Sequential PDF page conversion via existing `pdf-converter.ts`
- Sequential API calls to `/api/analyze`
- Progress tracking, error accumulation, AbortController for cancellation
- Canvas memory cleanup after each page conversion

- [ ] **Step 1: Implement useBatchAnalysis**

```typescript
// src/hooks/useBatchAnalysis.ts
"use client"

import { useState, useRef, useCallback } from "react"
import type { AnalysisResult } from "@/types/analysis"

const MAX_TOTAL_PAGES = 50

interface BatchError {
  fileName: string
  page: number
  error: string
}

interface BatchProgress {
  current: number
  total: number
  currentFileName: string
}

interface UseBatchAnalysisReturn {
  zipPdfFiles: File[]
  batchResults: Map<string, AnalysisResult[]>
  batchProgress: BatchProgress | null
  batchErrors: BatchError[]
  isBatchAnalyzing: boolean
  handleZipFile: (file: File) => Promise<void>
  startBatchAnalysis: () => Promise<void>
  cancelBatchAnalysis: () => void
  resetBatch: () => void
}

export function useBatchAnalysis(): UseBatchAnalysisReturn {
  const [zipPdfFiles, setZipPdfFiles] = useState<File[]>([])
  const [batchResults, setBatchResults] = useState<Map<string, AnalysisResult[]>>(new Map())
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [batchErrors, setBatchErrors] = useState<BatchError[]>([])
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleZipFile = useCallback(async (file: File) => {
    const { extractPdfsFromZip } = await import("@/lib/zip-extractor")
    const pdfs = await extractPdfsFromZip(file)
    setZipPdfFiles(pdfs)
    setBatchResults(new Map())
    setBatchErrors([])
  }, [])

  const startBatchAnalysis = useCallback(async () => {
    if (zipPdfFiles.length === 0) return

    const { getPdfPageCount, convertAllPdfPages } = await import("@/lib/pdf-converter")

    // Count total pages first
    const pdfPageCounts: { file: File; pageCount: number }[] = []
    let totalPages = 0

    for (const pdf of zipPdfFiles) {
      const count = await getPdfPageCount(pdf)
      totalPages += count
      pdfPageCounts.push({ file: pdf, pageCount: count })
    }

    if (totalPages > MAX_TOTAL_PAGES) {
      throw new Error(`合計ページ数(${totalPages})が上限(${MAX_TOTAL_PAGES})を超えています`)
    }

    setIsBatchAnalyzing(true)
    setBatchResults(new Map())
    setBatchErrors([])

    const controller = new AbortController()
    abortRef.current = controller

    let currentPage = 0
    const results = new Map<string, AnalysisResult[]>()
    const errors: BatchError[] = []

    for (const { file, pageCount } of pdfPageCounts) {
      if (controller.signal.aborted) break

      const fileResults: AnalysisResult[] = []

      // Convert all pages at once (opens PDF only once, includes canvas cleanup)
      let convertedPages: { base64: string; mimeType: "image/png" }[]
      try {
        convertedPages = await convertAllPdfPages(file)
      } catch (err) {
        errors.push({
          fileName: file.name,
          page: 0,
          error: err instanceof Error ? err.message : "PDF変換失敗",
        })
        continue
      }

      for (let page = 0; page < convertedPages.length; page++) {
        if (controller.signal.aborted) break

        currentPage++
        setBatchProgress({
          current: currentPage,
          total: totalPages,
          currentFileName: `${file.name} (${page + 1}/${pageCount}ページ)`,
        })

        try {
          const converted = convertedPages[page]

          // Send to API
          const byteChars = atob(converted.base64)
          const byteNumbers = new Uint8Array(byteChars.length)
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i)
          }
          const blob = new Blob([byteNumbers], { type: converted.mimeType })
          const formData = new FormData()
          formData.append("image", blob, `${file.name}_p${page + 1}.png`)
          formData.append("mimeType", converted.mimeType)

          const res = await fetch("/api/analyze", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          })
          const data = await res.json()

          if (data.success) {
            fileResults.push(data.result)
          } else {
            errors.push({
              fileName: file.name,
              page: page + 1,
              error: data.error || "解析失敗",
            })
          }
        } catch (err) {
          if (controller.signal.aborted) break
          errors.push({
            fileName: file.name,
            page: page + 1,
            error: err instanceof Error ? err.message : "不明なエラー",
          })
        }
      }

      if (fileResults.length > 0) {
        results.set(file.name, fileResults)
      }
    }

    setBatchResults(new Map(results))
    setBatchErrors(errors)
    setBatchProgress(null)
    setIsBatchAnalyzing(false)
    abortRef.current = null
  }, [zipPdfFiles])

  const cancelBatchAnalysis = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const resetBatch = useCallback(() => {
    abortRef.current?.abort()
    setZipPdfFiles([])
    setBatchResults(new Map())
    setBatchProgress(null)
    setBatchErrors([])
    setIsBatchAnalyzing(false)
  }, [])

  return {
    zipPdfFiles,
    batchResults,
    batchProgress,
    batchErrors,
    isBatchAnalyzing,
    handleZipFile,
    startBatchAnalysis,
    cancelBatchAnalysis,
    resetBatch,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/hooks/useBatchAnalysis.ts 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/hooks/useBatchAnalysis.ts
git commit -m "feat: add useBatchAnalysis hook for ZIP batch processing"
```

---

## Task 8: ZipResultList component

**Files:**
- Create: `src/components/analyzer/ZipResultList.tsx`

Displays analysis results per PDF as expandable cards. Uses existing `ResultTabs` for detail view. Accordion behavior: only one expanded at a time.

- [ ] **Step 1: Implement ZipResultList**

```tsx
// src/components/analyzer/ZipResultList.tsx
"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResultTabs } from "@/components/analyzer/ResultTabs"
import type { AnalysisResult } from "@/types/analysis"

type BatchError = {
  fileName: string
  page: number
  error: string
}

type ZipResultListProps = {
  batchResults: Map<string, AnalysisResult[]>
  batchErrors: BatchError[]
  onGenerateIndividualEstimate?: (results: AnalysisResult[]) => void
}

export function ZipResultList({ batchResults, batchErrors, onGenerateIndividualEstimate }: ZipResultListProps) {
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const togglePdf = (name: string) => {
    setExpandedPdf((prev) => (prev === name ? null : name))
  }

  return (
    <div className="space-y-4">
      {/* Error summary */}
      {batchErrors.length > 0 && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-3">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="flex w-full items-center gap-2 text-sm text-red-400"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>{batchErrors.length}件の解析に失敗しました</span>
            {showErrors ? (
              <ChevronDown className="ml-auto h-4 w-4" />
            ) : (
              <ChevronRight className="ml-auto h-4 w-4" />
            )}
          </button>
          {showErrors && (
            <ul className="mt-2 space-y-1 text-xs text-red-300">
              {batchErrors.map((err, i) => (
                <li key={i}>
                  {err.fileName} ({err.page}ページ): {err.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* PDF result cards */}
      {Array.from(batchResults.entries()).map(([fileName, results]) => {
        const isExpanded = expandedPdf === fileName
        const firstResult = results[0]
        const summary = firstResult?.summary || "解析結果"

        return (
          <Card key={fileName} className="border-slate-700 bg-slate-800/50">
            <CardHeader
              className="cursor-pointer py-3 px-4"
              onClick={() => togglePdf(fileName)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium text-slate-200 truncate">
                    {fileName}
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-1">
                    {results.length}ページ — {summary}
                  </p>
                </div>
                {onGenerateIndividualEstimate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onGenerateIndividualEstimate(results)
                    }}
                    className="shrink-0 text-xs text-amber-500 hover:text-amber-400 px-2 py-1 rounded border border-amber-500/30 hover:border-amber-500/60"
                  >
                    💰 個別見積り
                  </button>
                )}
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0 space-y-4">
                {results.map((result, i) => (
                  <div key={result.id}>
                    {results.length > 1 && (
                      <p className="text-xs text-slate-500 mb-2">
                        {i + 1}ページ目
                      </p>
                    )}
                    <ResultTabs result={result} />
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/components/analyzer/ZipResultList.tsx 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/components/analyzer/ZipResultList.tsx
git commit -m "feat: add ZipResultList component for batch results display"
```

---

## Task 9: Integrate ZIP flow into analyze page

**Files:**
- Modify: `src/app/(dashboard)/analyze/page.tsx`

This integrates the ZIP flow into the existing page. The page remains the thin routing layer — all logic is in hooks. Key changes:
- Import and use `useBatchAnalysis` hook
- Add ZIP detection in `handleFileSelect`
- Add batch analysis trigger + progress display
- Add ZIP result display
- Keep all existing single-file flow intact

- [ ] **Step 1: Rewrite analyze page with ZIP support**

Read the current `src/app/(dashboard)/analyze/page.tsx` first, then replace its full contents with the following. This preserves all existing single-file logic and adds the ZIP branch:

```tsx
// src/app/(dashboard)/analyze/page.tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropZone } from "@/components/analyzer/DropZone"
import { PdfPageSelector } from "@/components/analyzer/PdfPageSelector"
import { ResultTabs } from "@/components/analyzer/ResultTabs"
import { BatchProgress } from "@/components/analyzer/BatchProgress"
import { ZipResultList } from "@/components/analyzer/ZipResultList"
import { useBatchAnalysis } from "@/hooks/useBatchAnalysis"
import type { AnalysisResult } from "@/types/analysis"
import { Loader2 } from "lucide-react"

function isZipFile(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  )
}

export default function AnalyzePage() {
  // Single file state (existing)
  const [file, setFile] = useState<File | null>(null)
  const [pdfPages, setPdfPages] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // ZIP batch state
  const [isZip, setIsZip] = useState(false)
  const batch = useBatchAnalysis()

  const handleFileSelect = async (selectedFile: File) => {
    // Reset all state
    setFile(selectedFile)
    setResult(null)
    setPdfPages(0)
    setSelectedPage(1)
    setPreviewUrl(null)
    batch.resetBatch()

    if (isZipFile(selectedFile)) {
      setIsZip(true)
      try {
        await batch.handleZipFile(selectedFile)
        toast.success(`${selectedFile.name} からPDFを抽出しました`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ZIPの展開に失敗しました")
      }
      return
    }

    setIsZip(false)

    if (selectedFile.type === "application/pdf") {
      try {
        const { getPdfPageCount } = await import("@/lib/pdf-converter")
        const count = await getPdfPageCount(selectedFile)
        setPdfPages(count)
      } catch {
        toast.error("PDFの読み込みに失敗しました")
      }
    } else {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
    }
  }

  const handleAnalyze = async () => {
    if (!file) return

    setIsLoading(true)
    setResult(null)

    try {
      let base64: string
      let mimeType: string

      if (file.type === "application/pdf") {
        const { convertPdfPageToImage } = await import("@/lib/pdf-converter")
        const converted = await convertPdfPageToImage(file, selectedPage)
        base64 = converted.base64
        mimeType = converted.mimeType
        setPreviewUrl(`data:${mimeType};base64,${base64}`)
      } else {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            resolve(dataUrl.split(",")[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        mimeType = file.type
      }

      const formData = new FormData()
      const byteChars = atob(base64)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })
      formData.append("image", blob, file.name)
      formData.append("mimeType", mimeType)

      const res = await fetch("/api/analyze", { method: "POST", body: formData })
      const data = await res.json()

      if (data.success) {
        setResult(data.result)
      } else {
        toast.error(data.error || "解析に失敗しました。もう一度お試しください")
      }
    } catch {
      toast.error("解析に失敗しました。もう一度お試しください")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBatchAnalyze = async () => {
    try {
      await batch.startBatchAnalysis()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "バッチ解析に失敗しました")
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setPdfPages(0)
    setSelectedPage(1)
    setPreviewUrl(null)
    setIsZip(false)
    batch.resetBatch()
  }

  const hasZipResults = batch.batchResults.size > 0

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-100">📐 図面解析</h1>

      {/* === ZIP: Batch analyzing === */}
      {isZip && batch.isBatchAnalyzing && batch.batchProgress && (
        <div className="space-y-6">
          <BatchProgress
            current={batch.batchProgress.current}
            total={batch.batchProgress.total}
            currentFileName={batch.batchProgress.currentFileName}
            onCancel={batch.cancelBatchAnalysis}
          />
        </div>
      )}

      {/* === ZIP: Results === */}
      {isZip && hasZipResults && !batch.isBatchAnalyzing && (
        <div className="space-y-6">
          <ZipResultList
            batchResults={batch.batchResults}
            batchErrors={batch.batchErrors}
          />
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            別の図面を解析する
          </Button>
        </div>
      )}

      {/* === ZIP: File selected, not yet analyzing === */}
      {isZip && !batch.isBatchAnalyzing && !hasZipResults && (
        <div className="space-y-6">
          <DropZone onFileSelect={handleFileSelect} isLoading={false} />

          {batch.zipPdfFiles.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                {batch.zipPdfFiles.length}個のPDFが見つかりました:
              </p>
              <ul className="space-y-1 text-xs text-slate-400">
                {batch.zipPdfFiles.map((pdf) => (
                  <li key={pdf.name}>📄 {pdf.name}</li>
                ))}
              </ul>
              <Button
                onClick={handleBatchAnalyze}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3"
                size="lg"
              >
                全PDFを解析する
              </Button>
            </div>
          )}
        </div>
      )}

      {/* === Single file: No result yet === */}
      {!isZip && !result && (
        <div className="space-y-6">
          <DropZone onFileSelect={handleFileSelect} isLoading={isLoading} />

          {pdfPages > 1 && (
            <PdfPageSelector
              totalPages={pdfPages}
              selectedPage={selectedPage}
              onPageChange={setSelectedPage}
            />
          )}

          {file && !isLoading && (
            <Button
              onClick={handleAnalyze}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3"
              size="lg"
            >
              図面を解析する
            </Button>
          )}

          {isLoading && (
            <div className="space-y-4 py-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-slate-400">
                AIが図面を読み取っています...
              </p>
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4 mx-auto bg-slate-700" />
                <Skeleton className="h-4 w-1/2 mx-auto bg-slate-700" />
                <Skeleton className="h-4 w-2/3 mx-auto bg-slate-700" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* === Single file: Result === */}
      {!isZip && result && (
        <div className="space-y-6">
          {previewUrl && (
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <img
                src={previewUrl}
                alt="図面プレビュー"
                className="max-h-48 w-full object-contain bg-white"
              />
            </div>
          )}

          <ResultTabs result={result} />

          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            別の図面を解析する
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx next build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/app/\(dashboard\)/analyze/page.tsx
git commit -m "feat: integrate ZIP batch analysis flow into analyze page"
```

---

## Task 10: Manual test — ZIP upload flow

- [ ] **Step 1: Start dev server and test**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npm run dev
```

Open http://localhost:3000 in browser. Test:
1. Single image upload still works (existing flow unchanged)
2. Single PDF upload still works
3. ZIP file upload → shows PDF list → "全PDFを解析する" button appears
4. Click analyze → progress bar shows → results display in cards
5. Cards expand/collapse with accordion behavior
6. Cancel button works during analysis
7. "別の図面を解析する" resets everything

- [ ] **Step 2: Commit any fixes needed**

If fixes are needed, commit them individually with descriptive messages.

---

## Task 11: Estimate generator (server-side)

**Files:**
- Create: `src/lib/estimate-generator.ts`

This makes the second Gemini call using the analysis results as input. Follows the same pattern as existing `src/lib/gemini.ts` — reads GEMINI_API_KEY, uses GoogleGenAI, returns typed JSON.

- [ ] **Step 1: Implement estimate-generator**

```typescript
// src/lib/estimate-generator.ts
import { GoogleGenAI } from "@google/genai"
import type { AnalysisResult } from "@/types/analysis"
import type { EstimateResult } from "@/types/estimate"

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません")
  }
  return new GoogleGenAI({ apiKey })
}

const ESTIMATE_SYSTEM_PROMPT = `あなたは日本の飲食店舗の建築工事に精通した積算のプロフェッショナルです。
建築図面の解析結果から、工事見積りを作成してください。

## 対象工事カテゴリ（この4つに分類すること）
1. 内装工事（床・壁・天井の仕上げ、造作家具、建具）
2. 設備工事（電気設備、給排水設備、空調・換気設備、ガス設備）
3. 厨房設備（厨房機器、シンク、作業台、冷蔵庫、フード）
4. 外装・看板（外壁、エントランス、看板・サイン、外構）

## 相場単価の基準（2024〜2025年の関西圏の相場を基準とすること）
- 内装仕上げ: 坪単価 30〜50万円が目安
- 設備工事: 坪単価 15〜30万円が目安
- 厨房設備: 業態・規模により大きく変動（ラーメン店: 300〜500万円、居酒屋: 500〜1000万円、レストラン: 800〜2000万円）
- 外装・看板: 100〜500万円が目安

## 重要なルール
- 数量は図面解析結果の面積・寸法から合理的に算出すること
- 単価は上記相場を参考にしつつ、仕様のグレードに応じて調整すること
- 金額 = 数量 × 単価 を必ず正しく計算すること
- 諸経費は小計の8〜12%とすること
- 消費税は10%で計算すること
- 推定の前提条件（例: "居抜きではなくスケルトン渡しを想定"）を必ず明記すること
- 図面から読み取れない情報は合理的に仮定し、その旨をassumptionsに記載すること

以下のJSON形式で出力してください。他のテキストは一切含めないこと。

{
  "projectName": "工事名称",
  "buildingType": "飲食店",
  "totalArea": 0,
  "categories": [
    {
      "category": "カテゴリ名",
      "subtotal": 0,
      "items": [
        {
          "category": "カテゴリ名",
          "subcategory": "小分類",
          "item": "工事項目名",
          "specification": "仕様・グレード",
          "quantity": 0,
          "unit": "単位",
          "unitPrice": 0,
          "amount": 0,
          "remarks": "備考"
        }
      ]
    }
  ],
  "subtotal": 0,
  "managementFee": 0,
  "totalAmount": 0,
  "taxAmount": 0,
  "grandTotal": 0,
  "assumptions": ["前提条件"],
  "generatedAt": "ISO日時"
}`

export async function generateEstimate(
  analysisResults: AnalysisResult[]
): Promise<EstimateResult> {
  const response = await getClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `以下の図面解析結果をもとに、飲食店の工事見積りを作成してください。

## 図面解析結果
${JSON.stringify(analysisResults, null, 2)}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: ESTIMATE_SYSTEM_PROMPT,
      maxOutputTokens: 32000,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 2048 },
    },
  })

  const text = response.text
  if (!text) {
    throw new Error("Gemini APIからレスポンスがありませんでした")
  }

  let parsed: EstimateResult
  try {
    parsed = JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim())
    } else {
      throw new Error("JSONパース失敗。応答先頭200文字: " + text.substring(0, 200))
    }
  }

  return parsed
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/lib/estimate-generator.ts 2>&1 | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/lib/estimate-generator.ts
git commit -m "feat: add estimate generator with Gemini 2.5 Flash"
```

---

## Task 12: Estimate API route

**Files:**
- Create: `src/app/api/estimate/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create estimate API route**

```typescript
// src/app/api/estimate/route.ts
import { NextRequest, NextResponse } from "next/server"
import { generateEstimate } from "@/lib/estimate-generator"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { analysisResults } = body

    if (!analysisResults || !Array.isArray(analysisResults) || analysisResults.length === 0) {
      return NextResponse.json(
        { success: false, error: "解析結果が必要です" },
        { status: 400 }
      )
    }

    const estimate = await generateEstimate(analysisResults)

    return NextResponse.json({ success: true, estimate })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Estimate error:", message, error)
    return NextResponse.json(
      {
        success: false,
        error: `見積り生成に失敗しました: ${message}`,
      },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Add maxDuration for estimate route in vercel.json**

Read `vercel.json` first, then update to add the estimate route. The estimate generation takes longer than analysis due to the larger output, so set maxDuration to 120 seconds:

```json
{
  "functions": {
    "src/app/api/analyze/route.ts": {
      "maxDuration": 60
    },
    "src/app/api/estimate/route.ts": {
      "maxDuration": 120
    }
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx next build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/app/api/estimate/route.ts vercel.json
git commit -m "feat: add POST /api/estimate endpoint"
```

---

## Task 13: useEstimate hook

**Files:**
- Create: `src/hooks/useEstimate.ts`

- [ ] **Step 1: Implement useEstimate**

```typescript
// src/hooks/useEstimate.ts
"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import type { AnalysisResult } from "@/types/analysis"
import type { EstimateResult } from "@/types/estimate"

interface UseEstimateReturn {
  estimateResult: EstimateResult | null
  isEstimating: boolean
  generateEstimate: (analysisResults: AnalysisResult[]) => Promise<void>
  resetEstimate: () => void
}

export function useEstimate(): UseEstimateReturn {
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  const generateEstimate = useCallback(async (analysisResults: AnalysisResult[]) => {
    setIsEstimating(true)
    setEstimateResult(null)

    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisResults }),
      })
      const data = await res.json()

      if (data.success) {
        setEstimateResult(data.estimate)
      } else {
        toast.error(data.error || "見積り生成に失敗しました")
      }
    } catch {
      toast.error("見積り生成に失敗しました。もう一度お試しください")
    } finally {
      setIsEstimating(false)
    }
  }, [])

  const resetEstimate = useCallback(() => {
    setEstimateResult(null)
    setIsEstimating(false)
  }, [])

  return {
    estimateResult,
    isEstimating,
    generateEstimate,
    resetEstimate,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/hooks/useEstimate.ts 2>&1 | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/hooks/useEstimate.ts
git commit -m "feat: add useEstimate hook for estimate generation"
```

---

## Task 14: EstimateTab component

**Files:**
- Create: `src/components/analyzer/EstimateTab.tsx`

The main estimate display with category accordions, totals, and assumptions. All amounts use `font-mono text-lg text-amber-500` to match existing style.

- [ ] **Step 1: Implement EstimateTab**

```tsx
// src/components/analyzer/EstimateTab.tsx
"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EstimateResult, EstimateCategorySummary } from "@/types/estimate"

type EstimateTabProps = {
  estimate: EstimateResult
  onDownloadExcel: () => void
}

const CATEGORY_ICONS: Record<string, string> = {
  "内装工事": "🏠",
  "設備工事": "⚡",
  "厨房設備": "🍳",
  "外装・看板": "🏪",
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`
}

function CategoryAccordion({ category }: { category: EstimateCategorySummary }) {
  const [isOpen, setIsOpen] = useState(true)
  const icon = CATEGORY_ICONS[category.category] || "📋"

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          {icon} {category.category}
        </span>
        <span className="font-mono text-lg text-amber-500">
          {formatYen(category.subtotal)}
        </span>
      </button>
      {isOpen && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400 text-xs">項目</TableHead>
                <TableHead className="text-slate-400 text-xs">仕様</TableHead>
                <TableHead className="text-slate-400 text-xs text-right">数量</TableHead>
                <TableHead className="text-slate-400 text-xs">単位</TableHead>
                <TableHead className="text-slate-400 text-xs text-right">単価</TableHead>
                <TableHead className="text-slate-400 text-xs text-right">金額</TableHead>
                <TableHead className="text-slate-400 text-xs">備考</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {category.items.map((item, i) => (
                <TableRow key={i} className="border-slate-700">
                  <TableCell className="text-slate-200 text-sm">
                    <div>{item.item}</div>
                    <div className="text-xs text-slate-500">{item.subcategory}</div>
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs">{item.specification}</TableCell>
                  <TableCell className="font-mono text-right text-slate-300">{item.quantity}</TableCell>
                  <TableCell className="text-slate-400 text-xs">{item.unit}</TableCell>
                  <TableCell className="font-mono text-right text-slate-300">
                    {formatYen(item.unitPrice)}
                  </TableCell>
                  <TableCell className="font-mono text-lg text-right text-amber-500">
                    {formatYen(item.amount)}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">{item.remarks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export function EstimateTab({ estimate, onDownloadExcel }: EstimateTabProps) {
  const managementFeePercent =
    estimate.subtotal > 0
      ? Math.round((estimate.managementFee / estimate.subtotal) * 100)
      : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-slate-100">{estimate.projectName}</h3>
          <p className="text-sm text-slate-400">
            {estimate.buildingType} | 延べ面積: {estimate.totalArea}㎡
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadExcel}
          className="border-slate-600 text-slate-300 hover:bg-slate-800 shrink-0"
        >
          <Download className="h-4 w-4 mr-1" />
          Excel
        </Button>
      </div>

      {/* Category accordions */}
      <div className="space-y-3">
        {estimate.categories.map((cat) => (
          <CategoryAccordion key={cat.category} category={cat} />
        ))}
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-2">
        <div className="flex justify-between text-sm text-slate-300">
          <span>小計</span>
          <span className="font-mono">{formatYen(estimate.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-300">
          <span>諸経費（{managementFeePercent}%）</span>
          <span className="font-mono">{formatYen(estimate.managementFee)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-300">
          <span>合計（税抜）</span>
          <span className="font-mono">{formatYen(estimate.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-300">
          <span>消費税（10%）</span>
          <span className="font-mono">{formatYen(estimate.taxAmount)}</span>
        </div>
        <div className="border-t border-slate-600 pt-2 flex justify-between">
          <span className="text-base font-medium text-slate-100">税込合計</span>
          <span className="font-mono text-2xl font-bold text-amber-500">
            {formatYen(estimate.grandTotal)}
          </span>
        </div>
      </div>

      {/* Assumptions */}
      {estimate.assumptions.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
          <p className="text-sm font-medium text-slate-300 mb-2">⚠️ 前提条件・注意事項</p>
          <ul className="space-y-1">
            {estimate.assumptions.map((note, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-400">
                <span className="shrink-0">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/components/analyzer/EstimateTab.tsx 2>&1 | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/components/analyzer/EstimateTab.tsx
git commit -m "feat: add EstimateTab component with category accordions"
```

---

## Task 15: Integrate estimate into analyze page

**Files:**
- Modify: `src/app/(dashboard)/analyze/page.tsx`

Add estimate buttons and EstimateTab to both single-file and ZIP flows.

- [ ] **Step 1: Add estimate imports and hook to page**

At the top of `src/app/(dashboard)/analyze/page.tsx`, add these imports (after the existing ones):

```typescript
import { EstimateTab } from "@/components/analyzer/EstimateTab"
import { useEstimate } from "@/hooks/useEstimate"
```

Inside the component, after the `batch` hook:

```typescript
const estimate = useEstimate()
```

Update `handleReset` to also reset estimate:

```typescript
const handleReset = () => {
  setFile(null)
  setResult(null)
  setPdfPages(0)
  setSelectedPage(1)
  setPreviewUrl(null)
  setIsZip(false)
  batch.resetBatch()
  estimate.resetEstimate()
}
```

- [ ] **Step 2: Add individual estimate callback to ZipResultList**

In the ZIP results section, update the `ZipResultList` component to pass the individual estimate callback:

```tsx
<ZipResultList
  batchResults={batch.batchResults}
  batchErrors={batch.batchErrors}
  onGenerateIndividualEstimate={(results) => estimate.generateEstimate(results)}
/>
```

- [ ] **Step 3: Add estimate buttons and display to ZIP results section**

In the ZIP results section (`{isZip && hasZipResults && !batch.isBatchAnalyzing && (...)}`), add estimate buttons and display between `ZipResultList` and the reset button:

```tsx
{/* Estimate buttons */}
{!estimate.isEstimating && !estimate.estimateResult && (
  <div className="space-y-2">
    <Button
      onClick={() => {
        const allResults = Array.from(batch.batchResults.values()).flat()
        estimate.generateEstimate(allResults)
      }}
      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3"
      size="lg"
    >
      💰 統合見積りを生成する
    </Button>
  </div>
)}

{/* Estimate loading */}
{estimate.isEstimating && (
  <div className="space-y-4 py-8 text-center">
    <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
    <p className="text-sm text-slate-400">
      見積りを作成中...（30秒程度かかります）
    </p>
  </div>
)}

{/* Estimate result */}
{estimate.estimateResult && (
  <EstimateTab
    estimate={estimate.estimateResult}
    onDownloadExcel={() => {
      // Excel download will be implemented in Task 17
      toast.error("Excel出力は準備中です")
    }}
  />
)}
```

- [ ] **Step 4: Add estimate button and display to single-file results section**

In the single-file result section (`{!isZip && result && (...)}`), add between `ResultTabs` and the reset button:

```tsx
{/* Estimate button */}
{!estimate.isEstimating && !estimate.estimateResult && (
  <Button
    onClick={() => estimate.generateEstimate([result])}
    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3"
    size="lg"
  >
    💰 見積りを生成する
  </Button>
)}

{/* Estimate loading */}
{estimate.isEstimating && (
  <div className="space-y-4 py-8 text-center">
    <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
    <p className="text-sm text-slate-400">
      見積りを作成中...（30秒程度かかります）
    </p>
  </div>
)}

{/* Estimate result */}
{estimate.estimateResult && (
  <EstimateTab
    estimate={estimate.estimateResult}
    onDownloadExcel={() => {
      toast.error("Excel出力は準備中です")
    }}
  />
)}
```

- [ ] **Step 5: Verify build**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx next build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/app/\(dashboard\)/analyze/page.tsx
git commit -m "feat: integrate estimate generation into analyze page"
```

---

## Task 16: Manual test — Estimate flow

- [ ] **Step 1: Test single-file estimate**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npm run dev
```

1. Upload a single blueprint image/PDF
2. Analyze it
3. Click "💰 見積りを生成する" button
4. Verify loading spinner appears with "見積りを作成中..."
5. Verify EstimateTab displays with 4 categories, totals, assumptions
6. Verify amounts use yen formatting with commas
7. Verify grand total is large and amber

- [ ] **Step 2: Test ZIP estimate**

1. Upload a ZIP with multiple PDFs
2. Analyze all
3. Click "💰 統合見積りを生成する"
4. Verify estimate covers all PDFs
5. "Excel" button shows toast "Excel出力は準備中です"

- [ ] **Step 3: Commit any fixes**

---

## Task 17: Excel download

**Files:**
- Create: `src/lib/estimate-excel.ts`

Uses ExcelJS to generate a styled .xlsx workbook with 2 sheets: 見積書 (estimate) and 前提条件 (assumptions).

- [ ] **Step 1: Implement estimate-excel**

```typescript
// src/lib/estimate-excel.ts
import ExcelJS from "exceljs"
import type { EstimateResult } from "@/types/estimate"

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}/${m}/${d}`
}

export async function downloadEstimateExcel(estimate: EstimateResult): Promise<void> {
  const wb = new ExcelJS.Workbook()

  // === Sheet 1: 見積書 ===
  const ws = wb.addWorksheet("見積書")

  // Column widths
  ws.columns = [
    { width: 5 },   // A: No.
    { width: 12 },  // B: カテゴリ
    { width: 12 },  // C: 小分類
    { width: 20 },  // D: 工事項目
    { width: 20 },  // E: 仕様
    { width: 8 },   // F: 数量
    { width: 6 },   // G: 単位
    { width: 12 },  // H: 単価
    { width: 14 },  // I: 金額
    { width: 15 },  // J: 備考
  ]

  // Row 1: Title
  ws.mergeCells("A1:J1")
  const titleCell = ws.getCell("A1")
  titleCell.value = "工事見積書"
  titleCell.font = { bold: true, size: 18 }
  titleCell.alignment = { horizontal: "center" }

  // Row 3-4: Project info
  ws.getCell("A3").value = `工事名称: ${estimate.projectName}`
  ws.getCell("F3").value = `作成日: ${formatDate(new Date())}`
  ws.getCell("A4").value = `建物用途: ${estimate.buildingType}`
  ws.getCell("F4").value = `延べ面積: ${estimate.totalArea}㎡`

  // Row 6: Header
  const headerRow = ws.getRow(6)
  const headers = ["No.", "カテゴリ", "小分類", "工事項目", "仕様", "数量", "単位", "単価", "金額", "備考"]
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true }
    cell.border = {
      bottom: { style: "thin" },
    }
  })

  // Data rows
  let rowNum = 7
  let itemNo = 1

  for (const category of estimate.categories) {
    for (const item of category.items) {
      const row = ws.getRow(rowNum)
      row.getCell(1).value = itemNo
      row.getCell(2).value = item.category
      row.getCell(3).value = item.subcategory
      row.getCell(4).value = item.item
      row.getCell(5).value = item.specification
      row.getCell(6).value = item.quantity
      row.getCell(6).alignment = { horizontal: "right" }
      row.getCell(7).value = item.unit
      row.getCell(8).value = item.unitPrice
      row.getCell(8).numFmt = "#,##0"
      row.getCell(8).alignment = { horizontal: "right" }
      row.getCell(9).value = item.amount
      row.getCell(9).numFmt = "#,##0"
      row.getCell(9).alignment = { horizontal: "right" }
      row.getCell(10).value = item.remarks
      rowNum++
      itemNo++
    }

    // Category subtotal row
    const subtotalRow = ws.getRow(rowNum)
    subtotalRow.getCell(4).value = `${category.category} 小計`
    subtotalRow.getCell(4).font = { bold: true }
    subtotalRow.getCell(9).value = category.subtotal
    subtotalRow.getCell(9).numFmt = "#,##0"
    subtotalRow.getCell(9).font = { bold: true }
    subtotalRow.getCell(9).alignment = { horizontal: "right" }
    subtotalRow.getCell(9).border = { top: { style: "thin" } }
    rowNum++
    rowNum++ // blank row between categories
  }

  // Summary rows
  const managementPercent =
    estimate.subtotal > 0
      ? Math.round((estimate.managementFee / estimate.subtotal) * 100)
      : 0

  const summaryItems = [
    { label: "小計", value: estimate.subtotal },
    { label: `諸経費（${managementPercent}%）`, value: estimate.managementFee },
    { label: "合計（税抜）", value: estimate.totalAmount },
    { label: "消費税（10%）", value: estimate.taxAmount },
    { label: "税込合計", value: estimate.grandTotal, bold: true },
  ]

  rowNum++ // blank row before summary
  for (const s of summaryItems) {
    const row = ws.getRow(rowNum)
    row.getCell(8).value = s.label
    row.getCell(8).font = { bold: s.bold || false }
    row.getCell(8).alignment = { horizontal: "right" }
    row.getCell(9).value = s.value
    row.getCell(9).numFmt = "#,##0"
    row.getCell(9).font = { bold: s.bold || false }
    row.getCell(9).alignment = { horizontal: "right" }
    rowNum++
  }

  // === Sheet 2: 前提条件 ===
  const ws2 = wb.addWorksheet("前提条件")
  ws2.columns = [{ width: 5 }, { width: 80 }]

  ws2.getCell("A1").value = "前提条件・注意事項"
  ws2.getCell("A1").font = { bold: true, size: 14 }

  estimate.assumptions.forEach((note, i) => {
    const row = ws2.getRow(i + 3)
    row.getCell(1).value = i + 1
    row.getCell(2).value = note
  })

  // Download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const dateStr = formatDate(new Date()).replace(/\//g, "")
  a.href = url
  a.download = `見積書_${estimate.projectName}_${dateStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx tsc --noEmit src/lib/estimate-excel.ts 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/lib/estimate-excel.ts
git commit -m "feat: add Excel estimate download with ExcelJS"
```

---

## Task 18: Wire up Excel download in page

**Files:**
- Modify: `src/app/(dashboard)/analyze/page.tsx`

Replace the placeholder `toast.error("Excel出力は準備中です")` calls with the actual download.

- [ ] **Step 1: Add Excel download handler**

Add import at top of `src/app/(dashboard)/analyze/page.tsx`:

```typescript
import { downloadEstimateExcel } from "@/lib/estimate-excel"
```

Replace both `onDownloadExcel` callbacks (in ZIP and single-file sections) from:
```typescript
onDownloadExcel={() => {
  toast.error("Excel出力は準備中です")
}}
```
to:
```typescript
onDownloadExcel={() => {
  if (estimate.estimateResult) {
    downloadEstimateExcel(estimate.estimateResult)
  }
}}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npx next build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
git add src/app/\(dashboard\)/analyze/page.tsx
git commit -m "feat: wire up Excel download for estimates"
```

---

## Task 19: Final manual test — Full flow

- [ ] **Step 1: Start dev server**

```bash
cd C:/Users/tokuc/AI/claude/zumen-scan
npm run dev
```

- [ ] **Step 2: Test single-file flow end-to-end**

1. Upload a blueprint image → Analyze → Verify 5-tab results (unchanged)
2. Click "💰 見積りを生成する" → Verify estimate display
3. Click "Excel" → Verify .xlsx downloads
4. Open .xlsx → Verify: title, project info, data rows, category subtotals, summary totals, assumptions sheet

- [ ] **Step 3: Test ZIP flow end-to-end**

1. Upload ZIP with multiple PDFs → See PDF list → "全PDFを解析する"
2. Verify progress bar with page count → Results display in cards
3. Expand a card → Verify 5-tab detail
4. "💰 統合見積りを生成する" → Verify combined estimate
5. Excel download → Verify combined data

- [ ] **Step 4: Test error cases**

1. Upload empty ZIP (no PDFs) → Should show error toast
2. Upload ZIP during analysis → Cancel → Should stop cleanly
3. "別の図面を解析する" → Should reset all state

- [ ] **Step 5: Commit any final fixes**
