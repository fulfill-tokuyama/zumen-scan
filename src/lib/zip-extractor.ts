import JSZip from "jszip"

const MAX_DECOMPRESSED_SIZE = 500 * 1024 * 1024 // 500MB
const MAX_FILE_COUNT = 100

export async function extractPdfsFromZip(file: File): Promise<File[]> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const pdfEntries: { entry: JSZip.JSZipObject; relativePath: string }[] = []

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return
    if (relativePath.endsWith(".zip")) return // skip nested zips
    if (!relativePath.toLowerCase().endsWith(".pdf")) return
    pdfEntries.push({ entry, relativePath })
  })

  if (pdfEntries.length === 0) {
    throw new Error("ZIP内にPDFファイルが見つかりませんでした")
  }

  if (pdfEntries.length > MAX_FILE_COUNT) {
    throw new Error(`ZIP内のファイル数が上限(${MAX_FILE_COUNT})を超えています`)
  }

  const files: File[] = []
  const nameCount = new Map<string, number>()
  let totalSize = 0

  for (const { entry, relativePath } of pdfEntries) {
    const blob = await entry.async("blob")
    totalSize += blob.size

    if (totalSize > MAX_DECOMPRESSED_SIZE) {
      throw new Error("ZIP展開後の合計サイズが上限(500MB)を超えています")
    }

    // Deduplicate filenames from different subdirectories
    let fileName = relativePath.split("/").pop() || relativePath
    const count = nameCount.get(fileName) || 0
    if (count > 0) {
      const ext = fileName.lastIndexOf(".")
      fileName = ext >= 0
        ? `${fileName.slice(0, ext)}_${count}${fileName.slice(ext)}`
        : `${fileName}_${count}`
    }
    nameCount.set(relativePath.split("/").pop() || relativePath, count + 1)

    const pdfFile = new File([blob], fileName, { type: "application/pdf" })
    files.push(pdfFile)
  }

  // Sort by filename for consistent ordering
  files.sort((a, b) => a.name.localeCompare(b.name, "ja"))

  return files
}
