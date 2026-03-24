"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, X, FileText } from "lucide-react"

type DropZoneProps = {
  onFileSelect: (file: File) => void
  isLoading: boolean
}

const ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
}

const MAX_SIZE = 100 * 1024 * 1024 // 100MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DropZone({ onFileSelect, isLoading }: DropZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setSelectedFile(file)
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: isLoading,
  })

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
  }

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive ? "border-amber-500 bg-amber-500/10" : "border-slate-600 hover:border-amber-500"}
        ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input {...getInputProps()} />

      {selectedFile ? (
        <div className="flex items-center justify-center gap-3">
          <FileText className="h-8 w-8 text-amber-500" />
          <div className="text-left">
            <p className="text-sm font-medium text-slate-200">
              {selectedFile.name}
            </p>
            <p className="text-xs text-slate-400">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          {!isLoading && (
            <button
              onClick={clearFile}
              className="ml-2 p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-slate-400" />
          <p className="text-sm font-medium text-slate-200">
            図面をアップロード
          </p>
          <p className="text-xs text-slate-400">JPG / PNG / PDF / ZIP 対応</p>
        </div>
      )}
    </div>
  )
}
