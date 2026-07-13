import type { PaginatedResult } from '../../domain/repositories/pagination.js'
import type { RiskListQuery, RiskRepository } from '../../domain/repositories/riskRepository.js'
import {
  Risk,
  type ReviewCycle,
  type RiskPrimitives,
  type RiskStatus,
  type UpdateRiskEntityInput
} from '../../domain/entities/risk.js'
import { RiskNotFoundError } from '../errors/riskNotFoundError.js'

export interface CreateRiskInput {
  title: string
  description: string
  category: string
  owner: string
  initialScore: number
  currentScore?: number
  status?: RiskStatus
  dueDate?: string | null
  reviewDate?: string | null
  reviewCycle?: ReviewCycle
}

export interface RiskUseCaseDependencies {
  repository: RiskRepository
  generateId: () => string
  now: () => Date
}

export class ListRisks {
  /** Bindet den Use Case ausschließlich an den abstrakten Repository-Port. */
  constructor (private readonly repository: RiskRepository) {}

  /** Listet Risiken gefiltert, sortiert, paginiert und als transportfähige Primitive auf. */
  async execute (query: RiskListQuery): Promise<PaginatedResult<RiskPrimitives>> {
    const result = await this.repository.findAll(query)
    return {
      ...result,
      items: result.items.map((risk) => risk.toPrimitives())
    }
  }
}

export class GetRisk {
  /** Bindet den Lese-Use-Case an den Repository-Port. */
  constructor (private readonly repository: RiskRepository) {}

  /** Liefert genau ein Risiko oder wirft einen definierten Not-Found-Fehler. */
  async execute (id: string): Promise<RiskPrimitives> {
    const risk = await requireRisk(this.repository, id)
    return risk.toPrimitives()
  }
}

export class CreateRisk {
  /** Injiziert Persistenz, ID-Erzeugung und Uhr für deterministisch testbares Verhalten. */
  constructor (private readonly dependencies: RiskUseCaseDependencies) {}

  /** Vergibt Identität und Referenz, validiert die Entität und persistiert sie. */
  async execute (input: CreateRiskInput): Promise<RiskPrimitives> {
    const timestamp = this.dependencies.now()
    const reviewSchedule = resolveReviewSchedule(input.reviewCycle ?? 'Fix', input.reviewDate ?? null, timestamp)
    const risk = Risk.create({
      ...input,
      ...reviewSchedule,
      id: this.dependencies.generateId(),
      reference: await this.dependencies.repository.nextReference(),
      timestamp: timestamp.toISOString()
    })
    await this.dependencies.repository.create(risk)
    return risk.toPrimitives()
  }
}

export class UpdateRisk {
  /** Injiziert Repository und Uhr für die Aktualisierung vorhandener Risiken. */
  constructor (
    private readonly repository: RiskRepository,
    private readonly now: () => Date
  ) {}

  /** Wendet eine partielle Änderung auf ein vorhandenes Risiko an und speichert das Ergebnis. */
  async execute (id: string, input: UpdateRiskEntityInput): Promise<RiskPrimitives> {
    const current = await requireRisk(this.repository, id)
    const timestamp = this.now()
    const currentValue = current.toPrimitives()
    const reviewCycle = input.reviewCycle ?? currentValue.reviewCycle
    const hasReviewChange = input.reviewCycle !== undefined || input.reviewDate !== undefined
    const requestedReviewDate = input.reviewCycle === 'Fix' && input.reviewDate === undefined
      ? null
      : input.reviewDate ?? currentValue.reviewDate
    const reviewSchedule = hasReviewChange
      ? resolveReviewSchedule(reviewCycle, requestedReviewDate, timestamp)
      : {}
    const updated = current.update({ ...input, ...reviewSchedule }, timestamp.toISOString())
    await this.repository.update(updated)
    return updated.toPrimitives()
  }
}

export class DeleteRisk {
  /** Bindet den Lösch-Use-Case an den Repository-Port und die Uhr. */
  constructor (
    private readonly repository: RiskRepository,
    private readonly now: () => Date
  ) {}

  /** Markiert ein Risiko als gelöscht oder signalisiert eine unbekannte ID konsistent. */
  async execute (id: string): Promise<void> {
    const deleted = await this.repository.delete(id, this.now().toISOString())
    if (!deleted) throw new RiskNotFoundError(id)
  }
}

/** Lädt eine Entität und vereinheitlicht das Not-Found-Verhalten mehrerer Use Cases. */
async function requireRisk (repository: RiskRepository, id: string): Promise<Risk> {
  const risk = await repository.findById(id)
  if (!risk) throw new RiskNotFoundError(id)
  return risk
}

/** Erzwingt berechnete Review-Daten für wiederkehrende Rhythmen. */
function resolveReviewSchedule (
  reviewCycle: ReviewCycle,
  requestedReviewDate: string | null,
  timestamp: Date
): Pick<RiskPrimitives, 'reviewCycle' | 'reviewDate'> {
  if (reviewCycle === 'Fix') {
    return { reviewCycle, reviewDate: requestedReviewDate }
  }

  return {
    reviewCycle,
    reviewDate: addMonths(timestamp, reviewCycleMonths(reviewCycle))
  }
}

/** Liefert die Monatsdistanz eines wiederkehrenden Review-Rhythmus. */
function reviewCycleMonths (reviewCycle: Exclude<ReviewCycle, 'Fix'>): number {
  const months: Record<Exclude<ReviewCycle, 'Fix'>, number> = {
    Monatlich: 1,
    Quartalsweise: 3,
    Halbjährlich: 6,
    Jährlich: 12,
    '2-jährlich': 24
  }
  return months[reviewCycle]
}

/** Addiert Kalendermonate und erhält bei Monatsenden den letzten gültigen Tag. */
function addMonths (date: Date, months: number): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const targetMonthIndex = month + months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastTargetDay)
  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10)
}
