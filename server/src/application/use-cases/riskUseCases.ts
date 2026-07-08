import type { RiskRepository } from '../../domain/repositories/riskRepository.js'
import {
  Risk,
  type RiskPrimitives,
  type RiskStatus,
  type UpdateRiskEntityInput
} from '../../domain/entities/risk.js'
import { RiskNotFoundError } from '../errors/riskNotFoundError.js'

export interface CreateRiskInput {
  title: string
  category: string
  owner: string
  initialScore: number
  currentScore?: number
  status?: RiskStatus
  dueDate?: string | null
}

export interface RiskUseCaseDependencies {
  repository: RiskRepository
  generateId: () => string
  now: () => Date
}

export class ListRisks {
  /** Bindet den Use Case ausschließlich an den abstrakten Repository-Port. */
  constructor (private readonly repository: RiskRepository) {}

  /** Listet Risiken optional gefiltert und als transportfähige Primitive auf. */
  async execute (search?: string): Promise<RiskPrimitives[]> {
    const risks = await this.repository.findAll(search)
    return risks.map((risk) => risk.toPrimitives())
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
    const risk = Risk.create({
      ...input,
      id: this.dependencies.generateId(),
      reference: await this.dependencies.repository.nextReference(),
      timestamp: this.dependencies.now().toISOString()
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
    const updated = current.update(input, this.now().toISOString())
    await this.repository.update(updated)
    return updated.toPrimitives()
  }
}

export class DeleteRisk {
  /** Bindet den Lösch-Use-Case an den Repository-Port. */
  constructor (private readonly repository: RiskRepository) {}

  /** Löscht ein Risiko oder signalisiert eine unbekannte ID konsistent. */
  async execute (id: string): Promise<void> {
    const deleted = await this.repository.delete(id)
    if (!deleted) throw new RiskNotFoundError(id)
  }
}

/** Lädt eine Entität und vereinheitlicht das Not-Found-Verhalten mehrerer Use Cases. */
async function requireRisk (repository: RiskRepository, id: string): Promise<Risk> {
  const risk = await repository.findById(id)
  if (!risk) throw new RiskNotFoundError(id)
  return risk
}
