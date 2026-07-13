export const measureStatuses = ['Offen', 'In Arbeit', 'Erledigt'] as const
export type MeasureStatus = typeof measureStatuses[number]

export const measurePriorities = ['Kritisch', 'Hoch', 'Normal'] as const
export type MeasurePriority = typeof measurePriorities[number]

export interface MeasurePrimitives {
  id: string
  riskId: string | null
  title: string
  description: string
  owner: string
  dueDate: string | null
  priority: MeasurePriority
  status: MeasureStatus
  createdAt: string
  updatedAt: string
}

export interface CreateMeasureEntityInput {
  id: string
  riskId?: string | null
  title: string
  description: string
  owner: string
  dueDate?: string | null
  priority?: MeasurePriority
  status?: MeasureStatus
  timestamp: string
}

export type UpdateMeasureEntityInput = Partial<Pick<
MeasurePrimitives,
'riskId' | 'title' | 'description' | 'owner' | 'dueDate' | 'priority' | 'status'
>>

export class MeasureValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'MeasureValidationError'
  }
}

export class Measure {
  private constructor (private readonly props: MeasurePrimitives) {}

  static create (input: CreateMeasureEntityInput): Measure {
    return Measure.fromPrimitives({
      id: input.id,
      riskId: input.riskId ?? null,
      title: input.title,
      description: input.description,
      owner: input.owner,
      dueDate: input.dueDate ?? null,
      priority: input.priority ?? 'Normal',
      status: input.status ?? 'Offen',
      createdAt: input.timestamp,
      updatedAt: input.timestamp
    })
  }

  static fromPrimitives (props: MeasurePrimitives): Measure {
    return new Measure({
      ...props,
      riskId: validateOptionalId(props.riskId),
      title: validateText('Titel', props.title, 200),
      description: validateText('Beschreibung', props.description, 2000),
      owner: validateText('Verantwortlich', props.owner, 200),
      dueDate: validateOptionalDate(props.dueDate),
      priority: validatePriority(props.priority),
      status: validateStatus(props.status)
    })
  }

  update (changes: UpdateMeasureEntityInput, timestamp: string): Measure {
    return Measure.fromPrimitives({
      ...this.props,
      ...changes,
      updatedAt: timestamp
    })
  }

  toPrimitives (): MeasurePrimitives {
    return { ...this.props }
  }
}

function validateText (field: string, value: string, maxLength: number): string {
  const normalized = value.trim()
  if (normalized.length === 0) throw new MeasureValidationError(`${field} darf nicht leer sein.`)
  if (normalized.length > maxLength) throw new MeasureValidationError(`${field} darf höchstens ${maxLength} Zeichen lang sein.`)
  return normalized
}

function validateOptionalId (value: string | null): string | null {
  if (value === null) return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  return normalized
}

function validateOptionalDate (value: string | null): string | null {
  if (value === null) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new MeasureValidationError('Das Fälligkeitsdatum muss im Format YYYY-MM-DD angegeben werden.')
  }
  return value
}

function validatePriority (value: MeasurePriority): MeasurePriority {
  if (!measurePriorities.includes(value)) {
    throw new MeasureValidationError('Die Priorität ist ungültig.')
  }
  return value
}

function validateStatus (value: MeasureStatus): MeasureStatus {
  if (!measureStatuses.includes(value)) {
    throw new MeasureValidationError('Der Maßnahmenstatus ist ungültig.')
  }
  return value
}
