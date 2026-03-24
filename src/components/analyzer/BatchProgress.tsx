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
