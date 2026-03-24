@AGENTS.md

# ZumenScan — 建築図面解析SaaS

## プロジェクト概要
建築業・1人親方向けの図面解析ツール。
PDF/画像の図面をアップロードするとClaude APIが
寸法・面積・開口部・部材数量を自動読み取りする。

## 技術スタック
- Next.js 16 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Google Gemini API（gemini-2.5-pro / gemini-2.5-flash）
- pdfjs-dist（PDF→PNG変換）
- Vercel（デプロイ）

## 設計方針
- モバイルファースト（スマホ現場使用を想定）
- 解析数値は大きく・見やすく（font-mono, text-xl以上）
- PDF対応: pdfjs-distでページをPNG変換→Claude APIに送信
- "use client" / Server Component を明確に分離
- エラー表示はsonner toast.error()を使用
- anyは使わず型を厳密に

## 環境変数
GEMINI_API_KEY
