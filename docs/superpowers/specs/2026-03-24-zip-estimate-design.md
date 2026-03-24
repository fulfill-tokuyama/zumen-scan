# ZIP解析 + 見積り生成機能 設計書

## 概要

ZIPファイルで複数PDF図面を一括アップロードし、全ページ自動解析 → 見積り生成する機能を追加する。
対象は飲食店の店舗建築図面。特定1社向けツール。

## 全体フロー

```
ZIPアップロード (DropZone拡張)
  ↓
ブラウザ内展開 (JSZip) → PDF一覧抽出(.pdfのみ、サブフォルダ含む)
  ↓
全PDFの全ページをPNG変換 (既存 pdfjs-dist, scale 2.0)
  ↓
「全部解析」ボタン → 順次 POST /api/analyze → 進捗表示（キャンセル可）
  ↓
解析結果一覧画面
  ├── PDFごとにサマリーカード + 展開で既存5タブ詳細（アコーディオン、1つずつ展開）
  ├── 各PDF横に「個別見積り生成」ボタン → 1件のAnalysisResult[]をGemini②
  └── 一覧下部に「統合見積り生成」ボタン → 全AnalysisResult[]をGemini②
  ↓
見積り表示（4カテゴリアコーディオン + 合計 + 前提条件）
  ↓
Excelダウンロード (.xlsx)
```

### 単体PDF/画像アップロード時

既存フローのまま変更なし。解析結果画面（ResultTabs の下）に「見積り生成」ボタンを配置。
ボタン押下 → EstimateTab がResultTabsの下にインライン表示される。

## 新規依存パッケージ

- `jszip` — ZIP展開（クライアント側）
- `exceljs` — Excel生成（クライアント側、MIT License）

## ファイル構成

### 新規ファイル

| ファイル | 責務 |
|---------|------|
| `src/types/estimate.ts` | EstimateLineItem, EstimateCategorySummary, EstimateResult 型定義 |
| `src/lib/zip-extractor.ts` | JSZipでZIP展開 → `.pdf`のみフィルタ → `File[]`返却 |
| `src/lib/estimate-generator.ts` | Gemini②で見積り生成 (AnalysisResult[] → EstimateResult) |
| `src/lib/estimate-excel.ts` | ExcelJSでExcelワークブック生成 |
| `src/app/api/estimate/route.ts` | POST /api/estimate エンドポイント |
| `src/hooks/useBatchAnalysis.ts` | ZIP解析のstate管理・バッチ実行ロジック（AbortController含む） |
| `src/hooks/useEstimate.ts` | 見積り生成のstate管理・API呼び出し |
| `src/components/analyzer/ZipResultList.tsx` | ZIP解析結果一覧UI |
| `src/components/analyzer/EstimateTab.tsx` | 見積り表示UI |
| `src/components/analyzer/BatchProgress.tsx` | バッチ解析進捗表示 |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/analyzer/DropZone.tsx` | `application/zip` を受付形式に追加 |
| `src/app/(dashboard)/analyze/page.tsx` | ZIP分岐（フック呼び出しのみ、ロジックはフックへ委譲） |

### 変更しないファイル

- `src/lib/gemini.ts` — 既存の `analyzeBlueprint()` は一切変更しない
- `src/types/analysis.ts` — 既存型定義は変更しない
- `src/app/api/analyze/route.ts` — 既存APIは変更しない
- `src/components/analyzer/ResultTabs.tsx` — 単体表示用として維持

## 型定義

### `types/estimate.ts`

```typescript
export interface EstimateLineItem {
  category: string;        // "内装工事" | "設備工事" | "厨房設備" | "外装・看板"
  subcategory: string;     // 例: "床仕上げ", "壁仕上げ", "電気工事"
  item: string;            // 例: "フローリング張り", "クロス張り"
  specification: string;   // 例: "複合フローリング t=12mm"
  quantity: number;
  unit: string;            // "㎡", "m", "箇所", "式" など
  unitPrice: number;       // 円
  amount: number;          // quantity × unitPrice
  remarks: string;
}

export interface EstimateCategorySummary {
  category: string;
  subtotal: number;
  items: EstimateLineItem[];
}

export interface EstimateResult {
  projectName: string;
  buildingType: string;
  totalArea: number;         // ㎡
  categories: EstimateCategorySummary[];
  subtotal: number;
  managementFee: number;     // 小計の8〜12%
  totalAmount: number;       // 税抜合計
  taxAmount: number;         // 消費税10%
  grandTotal: number;        // 税込合計
  assumptions: string[];
  generatedAt: string;
}
```

## コンポーネント設計

### `zip-extractor.ts`

- JSZipでArrayBuffer展開
- `.pdf`拡張子のみフィルタ（大文字小文字無視、サブフォルダ含む）
- 各エントリをBlobに変換し`File`オブジェクトとして返却
- 返り値: `File[]`（既存PDF処理パイプラインにそのまま渡せる）
- 安全制限:
  - 展開後の合計サイズ上限: 500MB（超過時エラー）
  - ZIP内ファイル数上限: 100ファイル
  - ネストZIPは無視（展開しない）

### `useBatchAnalysis.ts` — カスタムフック

page.tsxの肥大化を防ぐため、ZIP解析のstate管理とバッチ実行ロジックを抽出。

```typescript
interface UseBatchAnalysisReturn {
  zipPdfFiles: File[]
  batchResults: Map<string, AnalysisResult[]>  // PDF名 → 解析結果(全ページ分)
  batchProgress: { current: number; total: number } | null
  batchErrors: { fileName: string; page: number; error: string }[]
  isBatchAnalyzing: boolean
  handleZipFile: (file: File) => Promise<void>  // ZIP展開→PDF一覧セット
  startBatchAnalysis: () => Promise<void>       // 全ページ順次解析
  cancelBatchAnalysis: () => void               // AbortControllerでキャンセル
  resetBatch: () => void
}
```

- AbortControllerで途中キャンセル対応
- 各PDF→全ページをpdfjs-distでPNG変換→順次POST /api/analyze
- Canvas変換後に明示的クリーンアップ（canvas.width = 0; canvas.height = 0）でメモリ管理
- 1ページ失敗時: batchErrorsに蓄積して続行
- 解析完了後のbatchResultsはAPIレスポンスそのまま格納（createdAtはstring型として扱う）

### `useEstimate.ts` — カスタムフック

```typescript
interface UseEstimateReturn {
  estimateResult: EstimateResult | null
  isEstimating: boolean
  generateEstimate: (analysisResults: AnalysisResult[]) => Promise<void>
  resetEstimate: () => void
}
```

### `analyze/page.tsx` の変更

ロジックはフックに委譲し、page.tsxは表示の分岐のみ担当:

```
handleFileSelect 分岐:
  - ZIP → useBatchAnalysis.handleZipFile()
  - PDF → 既存フロー
  - 画像 → 既存フロー

表示分岐:
  - ZIP解析中 → BatchProgress
  - ZIP解析完了 → ZipResultList + 見積りボタン群 + EstimateTab
  - 単体解析完了 → ResultTabs + 見積りボタン + EstimateTab
```

DropZoneの`handleFileSelect`でのZIP判定:
- `file.type === "application/zip"` or `file.type === "application/x-zip-compressed"` or `.zip`拡張子
- ZIP選択時: DropZoneにはZIPファイル名を表示、既存のpreviewUrl/pdfPages stateは使わない

### `BatchProgress.tsx`

- 「3/12ページ解析中...」テキスト
- 現在処理中のPDFファイル名表示
- Loader2アニメーション
- プログレスバー（完了数/総数）
- 「キャンセル」ボタン

### `ZipResultList.tsx`

- PDFごとにカード表示（ファイル名、ページ数、概要サマリー）
- カードタップで展開 → 既存 `ResultTabs` で5タブ詳細表示
- アコーディオン動作: 1つずつ展開（他は閉じる）
- 各PDFカードに「個別見積り生成」ボタン
- 一覧下部に「統合見積り生成」ボタン（全PDFの解析結果をまとめて送信）
- エラーがあった場合: 一覧上部にエラーサマリー表示（「2件の解析に失敗しました」+ 展開で詳細）

### `EstimateTab.tsx`

UIレイアウト:
```
ヘッダー部
  ├── 工事名称 / 建物用途 / 延べ面積
  └── [Excel ダウンロード] ボタン

カテゴリごとのアコーディオン（デフォルト展開）
  ├── 🏠 内装工事  ──── 小計: ¥X,XXX,XXX
  │   └── テーブル（項目名 / 仕様 / 数量 / 単位 / 単価 / 金額 / 備考）
  ├── ⚡ 設備工事  ──── 小計: ¥X,XXX,XXX
  ├── 🍳 厨房設備  ──── 小計: ¥X,XXX,XXX
  └── 🏪 外装・看板 ──── 小計: ¥X,XXX,XXX

合計部
  ├── 小計
  ├── 諸経費（○%）
  ├── 合計（税抜）
  ├── 消費税（10%）
  └── 税込合計 ← text-2xl font-bold text-amber-500

⚠️ 前提条件・注意事項
  └── assumptions[] をリスト表示
```

金額フォーマット: `toLocaleString('ja-JP')` で3桁カンマ区切り
金額スタイル: `font-mono text-lg text-amber-500`（既存スタイル踏襲）

### `estimate-generator.ts`

- モデル: Gemini 2.5 Flash
- thinkingBudget: 2048（見積りは推論が重要なので分析時の1024より多め）
- maxOutputTokens: 32000（見積りは項目数が多いため）
- responseMimeType: "application/json"
- `AnalysisResult[]`を受け取り、統合/個別どちらにも対応

**システムプロンプト（そのまま使用）:**

```
あなたは日本の飲食店舗の建築工事に精通した積算のプロフェッショナルです。
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
```

**ユーザープロンプト:**

```
以下の図面解析結果をもとに、飲食店の工事見積りを作成してください。

## 図面解析結果
${JSON.stringify(analysisResults, null, 2)}
```

**JSONパース:** 既存の `gemini.ts` と同じ2段構え（直接parse → コードブロック抽出）

### `/api/estimate/route.ts`

- `POST` body: `{ analysisResults: AnalysisResult[] }`
- 統合時: 全解析結果の配列
- 個別時: 1件の配列
- `generateEstimate()` を呼び出し、結果を返却
- エラーハンドリングは既存 `/api/analyze` と同パターン
- Note: 50ページ統合時の入力JSONは最大200KB程度。Gemini 2.5 Flashのコンテキスト(1M tokens)に十分収まる。Vercelのbody上限(4MB)にも問題なし。

### `estimate-excel.ts`

ExcelJSを使用（MIT License、スタイリング対応）。

シート1「見積書」:
- 行1: タイトル「工事見積書」（セル結合、太字、18pt）
- 行3-4: 工事名称、建物用途、延べ面積、作成日
- 行6: ヘッダー行（No. / カテゴリ / 小分類 / 工事項目 / 仕様 / 数量 / 単位 / 単価 / 金額 / 備考）
- データ行: カテゴリごとにグルーピング、小計行挿入
- 最終部: 小計→諸経費→税抜合計→消費税→税込合計（太字）
- 列幅: No.(5) | カテゴリ(12) | 小分類(12) | 工事項目(20) | 仕様(20) | 数量(8) | 単位(6) | 単価(12) | 金額(14) | 備考(15)
- 金額列: 右寄せ、#,##0

シート2「前提条件」:
- assumptions[] を箇条書き表示

ファイル名: `見積書_${projectName}_${yyyyMMdd}.xlsx`

## 制約

- ZIP最大サイズ: 100MB
- 展開後合計サイズ上限: 500MB（ZIP爆弾対策）
- ZIP内ファイル数上限: 100ファイル
- ZIP内トータルページ上限: 50ページ（超過時はエラーメッセージ表示）
- Gemini APIは順次呼び出し（並列禁止、レートリミット対策）
- 1ページ解析失敗時: その件はスキップして続行、エラーは蓄積して一覧上部にサマリー表示
- 見積り生成はユーザーがボタンで明示的に実行（自動実行しない）
- Canvas変換後は明示的にサイズを0にしてメモリ解放

## 実装順序

1. **Phase 1a**: ZIP展開 — `jszip`導入、`zip-extractor.ts`、`DropZone.tsx`変更
2. **Phase 1b**: バッチ解析 — `useBatchAnalysis.ts`、`BatchProgress.tsx`、`ZipResultList.tsx`、`analyze/page.tsx`変更
3. **Phase 2a**: 見積り生成API — `types/estimate.ts`、`estimate-generator.ts`、`/api/estimate/route.ts`
4. **Phase 2b**: 見積りUI — `useEstimate.ts`、`EstimateTab.tsx`、page.tsxに見積りボタン追加
5. **Phase 3**: Excelダウンロード — `exceljs`導入、`estimate-excel.ts`、ダウンロードボタン

各Phaseごとに動作確認してから次に進む。
