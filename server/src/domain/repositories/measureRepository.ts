import type { Measure, MeasurePriority, MeasureStatus } from '../entities/measure.js'
import type { PaginatedResult, SortDirection } from './pagination.js'

export type MeasureSortField = 'title' | 'owner' | 'dueDate' | 'priority' | 'status' | 'createdAt' | 'updatedAt'

export interface MeasureListQuery {
  page: number
  pageSize: number
  search?: string
  status?: MeasureStatus
  priority?: MeasurePriority
  owner?: string
  riskId?: string
  sortBy: MeasureSortField
  sortDirection: SortDirection
  overdue?: boolean
}

export interface MeasureRepository {
  findAll: (query: MeasureListQuery) => Promise<PaginatedResult<Measure>>
  findById: (id: string) => Promise<Measure | null>
  create: (measure: Measure) => Promise<void>
  update: (measure: Measure) => Promise<void>
  delete: (id: string) => Promise<boolean>
}
