export interface EstimateLineItem {
  category: string
  subcategory: string
  item: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
  remarks: string
}

export interface EstimateCategorySummary {
  category: string
  subtotal: number
  items: EstimateLineItem[]
}

export interface EstimateResult {
  projectName: string
  buildingType: string
  totalArea: number
  categories: EstimateCategorySummary[]
  subtotal: number
  managementFee: number
  totalAmount: number
  taxAmount: number
  grandTotal: number
  assumptions: string[]
  generatedAt: string
}
