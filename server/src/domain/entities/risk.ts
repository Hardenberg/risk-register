export const riskStatuses = ['Offen', 'In Bearbeitung', 'Überwacht', 'Geschlossen'] as const

export type RiskStatus = typeof riskStatuses[number]

export interface RiskPrimitives {
  id: string
  reference: string
  title: string
  category: string
  owner: string
  initialScore: number
  currentScore: number
  status: RiskStatus
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRiskEntityInput {
  id: string
  reference: string
  title: string
  category: string
  owner: string
  initialScore: number
  currentScore?: number
  status?: RiskStatus
  dueDate?: string | null
  timestamp: string
}

export type UpdateRiskEntityInput = Partial<Pick<
RiskPrimitives,
'title' | 'category' | 'owner' | 'initialScore' | 'currentScore' | 'status' | 'dueDate'
>>

export class RiskValidationError extends Error {
  /** Erzeugt einen fachlichen Validierungsfehler mit einer clienttauglichen Meldung. */
  constructor (message: string) {
    super(message)
    this.name = 'RiskValidationError'
  }
}

export class Risk {
  /** Verhindert direkte, unvalidierte Instanziierung außerhalb der Factory-Methoden. */
  private constructor (private readonly props: RiskPrimitives) {}

  /** Erzeugt ein neues, normalisiertes Risiko und setzt fachliche Standardwerte. */
  static create (input: CreateRiskEntityInput): Risk {
    return Risk.fromPrimitives({
      id: input.id,
      reference: input.reference,
      title: input.title,
      category: input.category,
      owner: input.owner,
      initialScore: input.initialScore,
      currentScore: input.currentScore ?? input.initialScore,
      status: input.status ?? 'Offen',
      dueDate: input.dueDate ?? null,
      createdAt: input.timestamp,
      updatedAt: input.timestamp
    })
  }

  /** Rekonstruiert eine Entität aus persistierten Primitiven und prüft ihre Invarianten. */
  static fromPrimitives (props: RiskPrimitives): Risk {
    const normalized: RiskPrimitives = {
      ...props,
      title: validateText('Bezeichnung', props.title),
      category: validateText('Kategorie', props.category),
      owner: validateText('Verantwortlich', props.owner),
      initialScore: validateScore('Initialer Risikowert', props.initialScore),
      currentScore: validateScore('Aktueller Risikowert', props.currentScore),
      dueDate: validateDueDate(props.dueDate)
    }

    if (!riskStatuses.includes(normalized.status)) {
      throw new RiskValidationError('Der angegebene Risikostatus ist ungültig.')
    }

    return new Risk(normalized)
  }

  /** Erzeugt eine aktualisierte, weiterhin valide Entität und erneuert den Änderungszeitpunkt. */
  update (changes: UpdateRiskEntityInput, timestamp: string): Risk {
    return Risk.fromPrimitives({
      ...this.props,
      ...changes,
      updatedAt: timestamp
    })
  }

  /** Gibt eine defensive Kopie für Repository- und Transportadapter zurück. */
  toPrimitives (): RiskPrimitives {
    return { ...this.props }
  }
}

/** Normalisiert ein Pflichttextfeld und erzwingt dessen fachliche Längengrenzen. */
function validateText (field: string, value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new RiskValidationError(`${field} darf nicht leer sein.`)
  }
  if (normalized.length > 200) {
    throw new RiskValidationError(`${field} darf höchstens 200 Zeichen lang sein.`)
  }
  return normalized
}

/** Prüft, dass ein Risikowert ganzzahlig im erlaubten Bereich von 1 bis 25 liegt. */
function validateScore (field: string, value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 25) {
    throw new RiskValidationError(`${field} muss eine ganze Zahl zwischen 1 und 25 sein.`)
  }
  return value
}

/** Validiert die äußere ISO-Datumsform eines optionalen Fälligkeitstermins. */
function validateDueDate (value: string | null): string | null {
  if (value === null) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new RiskValidationError('Das Fälligkeitsdatum muss im Format YYYY-MM-DD angegeben werden.')
  }
  return value
}
