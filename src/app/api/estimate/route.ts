import { NextRequest, NextResponse } from "next/server"
import { generateEstimate } from "@/lib/estimate-generator"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { analysisResults } = body

    if (!analysisResults || !Array.isArray(analysisResults) || analysisResults.length === 0) {
      return NextResponse.json(
        { success: false, error: "解析結果が必要です" },
        { status: 400 }
      )
    }

    const estimate = await generateEstimate(analysisResults)

    return NextResponse.json({ success: true, estimate })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Estimate error:", message, error)
    return NextResponse.json(
      {
        success: false,
        error: `見積り生成に失敗しました: ${message}`,
      },
      { status: 500 }
    )
  }
}
