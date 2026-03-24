import { GoogleGenAI } from "@google/genai"
import type { AnalysisResult } from "@/types/analysis"
import type { EstimateResult } from "@/types/estimate"

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません")
  }
  return new GoogleGenAI({ apiKey })
}

const ESTIMATE_SYSTEM_PROMPT = `あなたは日本の飲食店舗の建築工事に精通した積算のプロフェッショナルです。
建築図面の解析結果から、工事見積りを作成してください。

## 対象工事カテゴリ（この4つに分類すること）
1. 内装工事（床・壁・天井の仕上げ、造作家具、建具）
2. 設備工事（電気設備、給排水設備、空調・換気設備、ガス設備）
3. 厨房設備（厨房機器、シンク、作業台、冷蔵庫、フード）
4. 外装・看板（外壁、エントランス、看板・サイン、外構）

## 相場単価の基準（2024〜2025年の関西圏の相場を基準とすること）
- 内装仕上げ: 坪単価 30〜50万円が目安
- 設備工事: 坪単価 15〜30万円が目安
- 厨房設備: 業態・規模により大きく変動（ラーメン店: 300〜500万円、居酒屋: 500〜1000万円、レストラン: 800〜2000万円）
- 外装・看板: 100〜500万円が目安

## 重要なルール
- 数量は図面解析結果の面積・寸法から合理的に算出すること
- 単価は上記相場を参考にしつつ、仕様のグレードに応じて調整すること
- 金額 = 数量 × 単価 を必ず正しく計算すること
- 諸経費は小計の8〜12%とすること
- 消費税は10%で計算すること
- 推定の前提条件（例: "居抜きではなくスケルトン渡しを想定"）を必ず明記すること
- 図面から読み取れない情報は合理的に仮定し、その旨をassumptionsに記載すること

以下のJSON形式で出力してください。他のテキストは一切含めないこと。

{
  "projectName": "工事名称",
  "buildingType": "飲食店",
  "totalArea": 0,
  "categories": [
    {
      "category": "カテゴリ名",
      "subtotal": 0,
      "items": [
        {
          "category": "カテゴリ名",
          "subcategory": "小分類",
          "item": "工事項目名",
          "specification": "仕様・グレード",
          "quantity": 0,
          "unit": "単位",
          "unitPrice": 0,
          "amount": 0,
          "remarks": "備考"
        }
      ]
    }
  ],
  "subtotal": 0,
  "managementFee": 0,
  "totalAmount": 0,
  "taxAmount": 0,
  "grandTotal": 0,
  "assumptions": ["前提条件"],
  "generatedAt": "ISO日時"
}`

export async function generateEstimate(
  analysisResults: AnalysisResult[]
): Promise<EstimateResult> {
  const response = await getClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `以下の図面解析結果をもとに、飲食店の工事見積りを作成してください。

## 図面解析結果
${JSON.stringify(analysisResults, null, 2)}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: ESTIMATE_SYSTEM_PROMPT,
      maxOutputTokens: 32000,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 2048 },
    },
  })

  const text = response.text
  if (!text) {
    throw new Error("Gemini APIからレスポンスがありませんでした")
  }

  let parsed: EstimateResult
  try {
    parsed = JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim())
    } else {
      throw new Error("JSONパース失敗。応答先頭200文字: " + text.substring(0, 200))
    }
  }

  return parsed
}
