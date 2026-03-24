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
