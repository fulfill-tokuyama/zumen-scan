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
