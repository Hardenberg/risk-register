import type { Risk, RiskStatus } from '../entities/risk.js'
import type { PaginatedResult, SortDirection } from './pagination.js'

export type RiskSortField =
  'reference' | 'title' | 'category' | 'owner' | 'currentScore' | 'status' | 'dueDate' | 'reviewDate' | 'createdAt' | 'updatedAt'

export interface RiskListQuery {
  page: number
  pageSize: number
  search?: string
  status?: RiskStatus
  category?: string
  owner?: string
  sortBy: RiskSortField
  sortDirection: SortDirection
}

export interface RiskRepository {
  findAll: (query: RiskListQuery) => Promise<PaginatedResult<Risk>>
  findById: (id: string) => Promise<Risk | null>
  nextReference: () => Promise<string>
  create: (risk: Risk) => Promise<void>
  update: (risk: Risk) => Promise<void>
  delete: (id: string, deletedAt: string) => Promise<boolean>
}
