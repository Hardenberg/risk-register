import type { Risk } from '../entities/risk.js'

export interface RiskRepository {
  findAll: (search?: string) => Promise<Risk[]>
  findById: (id: string) => Promise<Risk | null>
  nextReference: () => Promise<string>
  create: (risk: Risk) => Promise<void>
  update: (risk: Risk) => Promise<void>
  delete: (id: string) => Promise<boolean>
}
