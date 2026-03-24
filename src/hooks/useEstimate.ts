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
