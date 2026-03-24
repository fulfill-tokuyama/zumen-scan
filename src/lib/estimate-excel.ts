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
