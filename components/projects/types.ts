export type CmTemplate = 'cosmetic' | 'standard' | 'gut'
export type CmScopeStatus = 'draft' | 'sent' | 'bid_received' | 'awarded' | 'declined'

export interface CmBudgetSummary {
  budget_id: string
  name: string
  status: string
  project_id: string | null
  owner_email: string
  purchase_price: number | null
  arv: number | null
  contingency_pct: number
  budget_subtotal: number
  contingency_amount: number
  budget_total: number
  actual_total: number
  variance: number
  projected_gross_profit: number | null
  line_count: number
}

export interface CmBudgetLine {
  id: string
  budget_id: string
  category: string
  description: string
  qty: number
  unit: string
  material_unit_cost: number
  labor_unit_cost: number
  line_total: number
  trade: string | null
  sort_order: number | null
  catalog_item_id: string | null
  created_at: string
  updated_at: string
}

export interface CmBudgetActual {
  id: string
  budget_id: string
  budget_line_id: string | null
  amount: number
  vendor: string | null
  memo: string | null
  paid_on: string | null
  receipt_url: string | null
  created_at: string
}

export interface CmScopeSummary {
  id: string
  budget_id: string
  name: string
  contractor_name: string | null
  contractor_email: string | null
  status: CmScopeStatus
  bid_amount: number | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface CmCategoryRollup {
  category: string
  lines: number
  subtotal: number
}

export interface CmBudgetDetail {
  budget: CmBudgetSummary
  lines: CmBudgetLine[]
  by_category: CmCategoryRollup[]
  actuals: CmBudgetActual[]
  scopes: CmScopeSummary[]
}

export interface CmCatalogItem {
  id: string
  item_code: string
  category: string
  description: string
  unit: string
  material_unit_cost: number
  labor_unit_cost: number
  trade: string | null
  region: string
  source: string
}

export interface CmScopeLine {
  scope_line_id: string
  budget_line_id: string
  category: string
  description: string
  qty: number
  unit: string
  budgeted: number
  bid_amount: number | null
}

export interface CmScopeDetail {
  scope: CmScopeSummary
  lines: CmScopeLine[]
  budgeted_total: number
}
