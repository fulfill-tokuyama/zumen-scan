"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropZone } from "@/components/analyzer/DropZone"
import { PdfPageSelector } from "@/components/analyzer/PdfPageSelector"
import { ResultTabs } from "@/components/analyzer/ResultTabs"
import type { AnalysisResult } from "@/types/analysis"
import { Loader2 } from "lucide-react"

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null)
  const [pdfPages, setPdfPages] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setResult(null)
    setPdfPages(0)
    setSelectedPage(1)

    if (selectedFile.type === "application/pdf") {
      try {
        const { getPdfPageCount } = await import("@/lib/pdf-converter")
        const count = await getPdfPageCount(selectedFile)
        setPdfPages(count)
      } catch {
        toast.error("PDFの読み込みに失敗しました")
      }
    } else {
      // Image preview
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
        // Create preview from converted image
        setPreviewUrl(`data:${mimeType};base64,${base64}`)
      } else {
        // Read image as base64
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

      // Send to API
      const formData = new FormData()
      // Convert base64 to blob for upload
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

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setPdfPages(0)
    setSelectedPage(1)
    setPreviewUrl(null)
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-100">📐 図面解析</h1>

      {!result ? (
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
      ) : (
        <div className="space-y-6">
          {/* Preview */}
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
