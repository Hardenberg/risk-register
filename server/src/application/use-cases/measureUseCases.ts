import { randomUUID } from 'node:crypto'

import { Measure, type MeasurePrimitives, type UpdateMeasureEntityInput } from '../../domain/entities/measure.js'
import type { MeasureListQuery, MeasureRepository } from '../../domain/repositories/measureRepository.js'
import type { PaginatedResult } from '../../domain/repositories/pagination.js'
import { MeasureNotFoundError } from '../errors/measureNotFoundError.js'

export interface CreateMeasureInput {
  riskId?: string | null
  title: string
  description: string
  owner: string
  dueDate?: string | null
  priority?: MeasurePrimitives['priority']
  status?: MeasurePrimitives['status']
}

export interface MeasureUseCaseDependencies {
  repository: MeasureRepository
  generateId?: () => string
  now: () => Date
}

export class ListMeasures {
  constructor (private readonly repository: MeasureRepository) {}

  async execute (query: MeasureListQuery): Promise<PaginatedResult<MeasurePrimitives>> {
    const result = await this.repository.findAll(query)
    return {
      ...result,
      items: result.items.map((measure) => measure.toPrimitives())
    }
  }
}

export class GetMeasure {
  constructor (private readonly repository: MeasureRepository) {}

  async execute (id: string): Promise<MeasurePrimitives> {
    return (await requireMeasure(this.repository, id)).toPrimitives()
  }
}

export class CreateMeasure {
  constructor (private readonly dependencies: MeasureUseCaseDependencies) {}

  async execute (input: CreateMeasureInput): Promise<MeasurePrimitives> {
    const timestamp = this.dependencies.now().toISOString()
    const measure = Measure.create({
      ...input,
      id: (this.dependencies.generateId ?? randomUUID)(),
      timestamp
    })
    await this.dependencies.repository.create(measure)
    return measure.toPrimitives()
  }
}

export class UpdateMeasure {
  constructor (
    private readonly repository: MeasureRepository,
    private readonly now: () => Date
  ) {}

  async execute (id: string, input: UpdateMeasureEntityInput): Promise<MeasurePrimitives> {
    const current = await requireMeasure(this.repository, id)
    const updated = current.update(input, this.now().toISOString())
    await this.repository.update(updated)
    return updated.toPrimitives()
  }
}

export class DeleteMeasure {
  constructor (private readonly repository: MeasureRepository) {}

  async execute (id: string): Promise<void> {
    const deleted = await this.repository.delete(id)
    if (!deleted) throw new MeasureNotFoundError(id)
  }
}

async function requireMeasure (repository: MeasureRepository, id: string): Promise<Measure> {
  const measure = await repository.findById(id)
  if (!measure) throw new MeasureNotFoundError(id)
  return measure
}
