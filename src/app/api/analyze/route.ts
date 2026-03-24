import { NextRequest, NextResponse } from "next/server"
import { analyzeBlueprint, askQuestion } from "@/lib/gemini"
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

// PUT for question chat
export async function PUT(request: NextRequest) {
  try {
    const { imageBase64, mimeType, question } = await request.json()

    if (!imageBase64 || !mimeType || !question) {
      return NextResponse.json(
        { error: "imageBase64, mimeType, questionが必要です" },
        { status: 400 }
      )
    }

    const answer = await askQuestion(imageBase64, mimeType, question)
    return NextResponse.json({ answer })
  } catch (error) {
    console.error("Question error:", error)
    return NextResponse.json(
      { error: "回答の取得に失敗しました" },
      { status: 500 }
    )
  }
}
