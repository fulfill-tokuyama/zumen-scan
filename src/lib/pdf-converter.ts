"use client"

import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  return pdf.numPages
}

export async function convertPdfPageToImage(
  file: File,
  pageNumber: number
): Promise<{ base64: string; mimeType: "image/png" }> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(pageNumber)

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

  return { base64, mimeType: "image/png" }
}

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
