import { NextRequest, NextResponse } from "next/server"
import { analyzeBlueprint } from "@/lib/gemini"
import { randomUUID } from "crypto"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File | null
    const mimeType = formData.get("mimeType") as string | null

    if (!imageFile || !mimeType) {
      return NextResponse.json(
        { success: false, error: "画像ファイルとmimeTypeが必要です" },
        { status: 400 }
      )
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    const analysisResult = await analyzeBlueprint(base64, mimeType)

    const result = {
      id: randomUUID(),
      fileName: imageFile.name,
      createdAt: new Date(),
      ...analysisResult,
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Analysis error:", message, error)
    return NextResponse.json(
      {
        success: false,
        error: `解析に失敗しました: ${message}`,
      },
      { status: 500 }
    )
  }
}
