"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PdfPageSelectorProps = {
  totalPages: number
  selectedPage: number
  onPageChange: (page: number) => void
}

export function PdfPageSelector({
  totalPages,
  selectedPage,
  onPageChange,
}: PdfPageSelectorProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-slate-300">解析するページ:</label>
      <Select
        value={String(selectedPage)}
        onValueChange={(v) => onPageChange(Number(v))}
      >
        <SelectTrigger className="w-[140px] bg-slate-800 border-slate-600 text-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-600">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <SelectItem
              key={page}
              value={String(page)}
              className="text-slate-200"
            >
              {page}ページ目を解析
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
