"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { AnalysisResult } from "@/types/analysis"

type ResultTabsProps = {
  result: AnalysisResult
}

function EmptyState() {
  return (
    <div className="py-8 text-center text-slate-400">
      読み取れませんでした
    </div>
  )
}

export function ResultTabs({ result }: ResultTabsProps) {
  const totalArea = result.areas.reduce(
    (sum, a) => sum + (parseFloat(a.value) || 0),
    0
  )

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg bg-slate-800/50 p-4 text-sm text-slate-300">
        {result.summary}
      </div>

      {/* Scale badge */}
      {result.scale && (
        <Badge variant="outline" className="border-amber-500 text-amber-500">
          縮尺: {result.scale}
        </Badge>
      )}

      <Tabs defaultValue="dimensions" className="w-full">
        <TabsList className="w-full grid grid-cols-5 bg-slate-800">
          <TabsTrigger value="dimensions" className="text-xs">📐 寸法</TabsTrigger>
          <TabsTrigger value="areas" className="text-xs">⬜ 面積</TabsTrigger>
          <TabsTrigger value="openings" className="text-xs">🚪 開口部</TabsTrigger>
          <TabsTrigger value="materials" className="text-xs">🪵 部材</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">⚠️ 特記</TabsTrigger>
        </TabsList>

        {/* Dimensions */}
        <TabsContent value="dimensions">
          {result.dimensions.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">項目名</TableHead>
                  <TableHead className="text-slate-400">値</TableHead>
                  <TableHead className="text-slate-400">単位</TableHead>
                  <TableHead className="text-slate-400">備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.dimensions.map((d, i) => (
                  <TableRow key={i} className="border-slate-700">
                    <TableCell className="text-slate-200">{d.name}</TableCell>
                    <TableCell className="font-mono text-lg text-amber-500">
                      {d.value}
                    </TableCell>
                    <TableCell className="text-slate-300">{d.unit}</TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {d.note}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Areas */}
        <TabsContent value="areas">
          {result.areas.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">スペース名</TableHead>
                    <TableHead className="text-slate-400">面積</TableHead>
                    <TableHead className="text-slate-400">畳数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.areas.map((a, i) => (
                    <TableRow key={i} className="border-slate-700">
                      <TableCell className="text-slate-200">{a.name}</TableCell>
                      <TableCell className="font-mono text-lg text-amber-500">
                        {a.value} {a.unit}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {a.tatami && `${a.tatami}畳`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 text-right text-sm text-slate-300">
                合計面積:{" "}
                <span className="font-mono text-lg text-amber-500">
                  {totalArea.toFixed(2)} ㎡
                </span>
              </div>
            </>
          )}
        </TabsContent>

        {/* Openings */}
        <TabsContent value="openings">
          {result.openings.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">種別</TableHead>
                  <TableHead className="text-slate-400">場所</TableHead>
                  <TableHead className="text-slate-400">幅×高さ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.openings.map((o, i) => (
                  <TableRow key={i} className="border-slate-700">
                    <TableCell className="text-slate-200">{o.type}</TableCell>
                    <TableCell className="text-slate-300">{o.location}</TableCell>
                    <TableCell className="font-mono text-lg text-amber-500">
                      {o.width} x {o.height} {o.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Materials */}
        <TabsContent value="materials">
          {result.materials.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">部材名</TableHead>
                  <TableHead className="text-slate-400">数量</TableHead>
                  <TableHead className="text-slate-400">単位</TableHead>
                  <TableHead className="text-slate-400">備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.materials.map((m, i) => (
                  <TableRow key={i} className="border-slate-700">
                    <TableCell className="text-slate-200">{m.name}</TableCell>
                    <TableCell className="font-mono text-lg text-amber-500">
                      {m.quantity}
                    </TableCell>
                    <TableCell className="text-slate-300">{m.unit}</TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {m.note}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes">
          {result.notes.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2 py-4">
              {result.notes.map((note, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <span className="shrink-0">⚠️</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

    </div>
  )
}
