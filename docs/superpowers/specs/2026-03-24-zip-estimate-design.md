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
「全部解析」ボタン → 順次 POST /api/analyze → 進捗表示
  ↓
解析結果一覧画面
  ├── PDFごとにサマリーカード + 展開で既存5タブ詳細
  ├── 各PDF横に「個別見積り生成」ボタン → 1件のAnalysisResult[]をGemini②
  └── 一覧下部に「統合見積り生成」ボタン → 全AnalysisResult[]をGemini②
  ↓
見積り表示（4カテゴリアコーディオン + 合計 + 前提条件）
  ↓
Excelダウンロード (.xlsx)
```

単体PDF/画像アップロード時は既存フローのまま変更なし。
解析結果画面の下に「見積り生成」ボタンを配置。

## 新規依存パッケージ

- `jszip` — ZIP展開（クライアント側）
- `xlsx` — Excel生成（クライアント側）

## ファイル構成

### 新規ファイル

| ファイル | 責務 |
|---------|------|
| `src/types/estimate.ts` | EstimateLineItem, EstimateCategorySummary, EstimateResult 型定義 |
| `src/lib/zip-extractor.ts` | JSZipでZIP展開 → `.pdf`のみフィルタ → `File[]`返却 |
| `src/lib/estimate-generator.ts` | Gemini②で見積り生成 (AnalysisResult[] → EstimateResult) |
| `src/lib/estimate-excel.ts` | SheetJSでExcelワークブック生成 |
| `src/app/api/estimate/route.ts` | POST /api/estimate エンドポイント |
| `src/components/analyzer/ZipResultList.tsx` | ZIP解析結果一覧UI |
| `src/components/analyzer/EstimateTab.tsx` | 見積り表示UI |
| `src/components/analyzer/BatchProgress.tsx` | バッチ解析進捗表示 |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/analyzer/DropZone.tsx` | `application/zip` を受付形式に追加 |
| `src/app/(dashboard)/analyze/page.tsx` | ZIP分岐、バッチ解析ロジック、見積りstate追加 |

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

### `analyze/page.tsx` の状態追加

```typescript
// ZIP関連
const [zipPdfFiles, setZipPdfFiles] = useState<File[]>([])
const [batchResults, setBatchResults] = useState<Map<string, AnalysisResult[]>>(new Map())
const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)

// 見積り関連
const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null)
const [isEstimating, setIsEstimating] = useState(false)
```

ファイル判定ロジック:
- `application/zip` or `.zip`拡張子 → ZIP展開フロー
- `application/pdf` → 既存PDFフロー
- 画像 → 既存画像フロー

### `BatchProgress.tsx`

- 「3/12ページ解析中...」テキスト
- Loader2アニメーション
- プログレスバー（完了数/総数）

### `ZipResultList.tsx`

- PDFごとにカード表示（ファイル名、ページ数、概要サマリー）
- カードタップで展開 → 既存 `ResultTabs` で5タブ詳細表示
- 各PDFカードに「個別見積り生成」ボタン
- 一覧下部に「統合見積り生成」ボタン（全PDFの解析結果をまとめて送信）

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

- Gemini 2.5 Flash、thinkingBudget: 2048、maxOutputTokens: 32000
- responseMimeType: "application/json"
- `AnalysisResult[]`を受け取り、統合/個別どちらにも対応
- システムプロンプト: 仕様書記載の積算プロフェッショナル向けプロンプトをそのまま使用
- ユーザープロンプト: 解析結果をJSON.stringifyして埋め込み

### `/api/estimate/route.ts`

- `POST` body: `{ analysisResults: AnalysisResult[] }`
- 統合時: 全解析結果の配列
- 個別時: 1件の配列
- `generateEstimate()` を呼び出し、結果を返却
- エラーハンドリングは既存 `/api/analyze` と同パターン

### `estimate-excel.ts`

シート1「見積書」:
- 行1: タイトル「工事見積書」（セル結合、太字）
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
- ZIP内トータルページ上限: 50ページ（超過時はエラーメッセージ表示）
- Gemini APIは順次呼び出し（並列禁止、レートリミット対策）
- 1ページ解析失敗時: その件はスキップして続行、失敗分はエラー表示
- 見積り生成はユーザーがボタンで明示的に実行（自動実行しない）

## 実装順序

1. **Phase 1a**: ZIP展開 — `jszip`導入、`zip-extractor.ts`、`DropZone.tsx`変更
2. **Phase 1b**: バッチ解析 — `analyze/page.tsx`にZIPフロー追加、`BatchProgress.tsx`、`ZipResultList.tsx`
3. **Phase 2a**: 見積り生成API — `types/estimate.ts`、`estimate-generator.ts`、`/api/estimate/route.ts`
4. **Phase 2b**: 見積りUI — `EstimateTab.tsx`、page.tsxに見積りstate・ボタン追加
5. **Phase 3**: Excelダウンロード — `xlsx`導入、`estimate-excel.ts`、ダウンロードボタン

各Phaseごとに動作確認してから次に進む。
