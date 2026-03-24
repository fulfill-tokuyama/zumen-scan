import { GoogleGenAI } from "@google/genai"
import type { AnalysisResult } from "@/types/analysis"

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません")
  }
  return new GoogleGenAI({ apiKey })
}

const ANALYSIS_SYSTEM_PROMPT = `あなたは建築図面の専門解析AIです。
1人親方・工務店が現場で使えるよう、図面から以下を正確に読み取ってください。

読み取る情報:
1. 縮尺（記載がある場合）
2. 各部位の寸法・長さ（壁長さ、天井高、開口幅など）
3. 各部屋・スペースの面積（㎡、畳換算）
4. ドア・窓の開口部サイズ（種別・場所・幅×高さ）
5. 部材・数量（読み取れる範囲で）

必ず以下のJSON形式のみを返し、説明文・Markdownコードブロックは一切含めないこと。

{
  "summary": "図面の概要を1〜2文で",
  "scale": "縮尺（例: 1/100）または null",
  "dimensions": [{"name":"","value":"","unit":"","note":""}],
  "areas": [{"name":"","value":"","unit":"㎡","tatami":""}],
  "openings": [{"type":"ドアまたは窓","location":"","width":"","height":"","unit":""}],
  "materials": [{"name":"","quantity":"","unit":"","note":""}],
  "notes": ["特記事項や注意事項"]
}`

type AnalysisPayload = Omit<AnalysisResult, "id" | "fileName" | "createdAt">

export async function analyzeBlueprint(
  imageBase64: string,
  mimeType: string
): Promise<AnalysisPayload> {
  const response = await getClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: "この建築図面を解析してJSON形式で結果を返してください。",
          },
        ],
      },
    ],
    config: {
      systemInstruction: ANALYSIS_SYSTEM_PROMPT,
      maxOutputTokens: 16000,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 1024 },
    },
  })

  const text = response.text
  if (!text) {
    throw new Error("Gemini APIからレスポンスがありませんでした")
  }

  let parsed: AnalysisPayload
  try {
    parsed = JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim())
    } else {
      throw new Error("JSONパース失敗。応答先頭200文字: " + text.substring(0, 200))
    }
  }

  return parsed
}

export async function askQuestion(
  imageBase64: string,
  mimeType: string,
  question: string
): Promise<string> {
  const response = await getClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: question,
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        "建築図面の専門家として、職人が現場で使えるよう具体的な数値を含めて日本語で回答してください。",
      maxOutputTokens: 1000,
    },
  })

  const text = response.text
  if (!text) {
    throw new Error("回答を取得できませんでした")
  }

  return text
}
