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
import { EstimateTab } from "@/components/analyzer/EstimateTab"
import { useEstimate } from "@/hooks/useEstimate"
import { downloadEstimateExcel } from "@/lib/estimate-excel"

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
  const estimate = useEstimate()

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
    estimate.resetEstimate()
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
            onGenerateIndividualEstimate={(results) => estimate.generateEstimate(results)}
          />

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
                if (estimate.estimateResult) {
                  downloadEstimateExcel(estimate.estimateResult)
                }
              }}
            />
          )}

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
                if (estimate.estimateResult) {
                  downloadEstimateExcel(estimate.estimateResult)
                }
              }}
            />
          )}

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
