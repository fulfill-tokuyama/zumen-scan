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
