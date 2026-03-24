export type Dimension = {
  name: string
  value: string
  unit: string
  note: string
}

export type Area = {
  name: string
  value: string
  unit: string
  tatami: string
}

export type Opening = {
  type: string
  location: string
  width: string
  height: string
  unit: string
}

export type Material = {
  name: string
  quantity: string
  unit: string
  note: string
}

export type AnalysisResult = {
  id: string
  fileName: string
  scale: string | null
  summary: string
  dimensions: Dimension[]
  areas: Area[]
  openings: Opening[]
  materials: Material[]
  notes: string[]
  createdAt: Date
}
