import type { StatementSync } from 'node:sqlite'

import { Risk, type RiskPrimitives, type RiskStatus } from '../../domain/entities/risk.js'
import type { RiskRepository } from '../../domain/repositories/riskRepository.js'
import type { SqliteDatabase } from '../database/sqliteDatabase.js'

interface RiskRow {
  id: string
  reference: string
  title: string
  category: string
  owner: string
  initial_score: number
  current_score: number
  status: RiskStatus
  due_date: string | null
  created_at: string
  updated_at: string
}

export class SqliteRiskRepository implements RiskRepository {
  private readonly findByIdStatement: StatementSync

  /** Bereitet häufig genutzte Statements für den SQLite-Adapter vor. */
  constructor (private readonly database: SqliteDatabase) {
    this.findByIdStatement = database.connection.prepare('SELECT * FROM risks WHERE id = ?')
  }

  /** Liest alle Risiken priorisiert und wendet optional eine parametrisierte Freitextsuche an. */
  async findAll (search?: string): Promise<Risk[]> {
    const normalizedSearch = search?.trim()
    const rows = normalizedSearch
      ? this.database.connection.prepare(`
          SELECT * FROM risks
          WHERE reference LIKE ? OR title LIKE ? OR category LIKE ? OR owner LIKE ?
          ORDER BY current_score DESC, created_at DESC
        `).all(...Array<string>(4).fill(`%${normalizedSearch}%`))
      : this.database.connection.prepare(
        'SELECT * FROM risks ORDER BY current_score DESC, created_at DESC'
      ).all()

    return (rows as unknown as RiskRow[]).map(toEntity)
  }

  /** Sucht ein Risiko anhand seiner technischen ID. */
  async findById (id: string): Promise<Risk | null> {
    const row = this.findByIdStatement.get(id) as unknown as RiskRow | undefined
    return row ? toEntity(row) : null
  }

  /** Berechnet die nächste menschenlesbare Referenz aus dem aktuellen Maximalwert. */
  async nextReference (): Promise<string> {
    const row = this.database.connection.prepare(`
      SELECT COALESCE(MAX(CAST(SUBSTR(reference, 3) AS INTEGER)), 0) AS maximum
      FROM risks
    `).get() as unknown as { maximum: number }
    return `R-${String(row.maximum + 1).padStart(3, '0')}`
  }

  /** Schreibt eine neue, bereits validierte Domain-Entität in SQLite. */
  async create (risk: Risk): Promise<void> {
    const value = risk.toPrimitives()
    this.database.connection.prepare(`
      INSERT INTO risks (
        id, reference, title, category, owner, initial_score, current_score,
        status, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...toDatabaseValues(value))
  }

  /** Persistiert alle änderbaren Felder und den Änderungszeitpunkt einer Entität. */
  async update (risk: Risk): Promise<void> {
    const value = risk.toPrimitives()
    this.database.connection.prepare(`
      UPDATE risks SET
        title = ?, category = ?, owner = ?, initial_score = ?, current_score = ?,
        status = ?, due_date = ?, updated_at = ?
      WHERE id = ?
    `).run(
      value.title,
      value.category,
      value.owner,
      value.initialScore,
      value.currentScore,
      value.status,
      value.dueDate,
      value.updatedAt,
      value.id
    )
  }

  /** Löscht eine Zeile und meldet, ob die ID tatsächlich vorhanden war. */
  async delete (id: string): Promise<boolean> {
    const result = this.database.connection.prepare('DELETE FROM risks WHERE id = ?').run(id)
    return result.changes > 0
  }
}

/** Übersetzt eine Datenbankzeile zurück in eine validierte Domain-Entität. */
function toEntity (row: RiskRow): Risk {
  return Risk.fromPrimitives({
    id: row.id,
    reference: row.reference,
    title: row.title,
    category: row.category,
    owner: row.owner,
    initialScore: row.initial_score,
    currentScore: row.current_score,
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

/** Ordnet Domain-Primitive in der Reihenfolge des INSERT-Statements an. */
function toDatabaseValues (risk: RiskPrimitives): Array<string | number | null> {
  return [
    risk.id,
    risk.reference,
    risk.title,
    risk.category,
    risk.owner,
    risk.initialScore,
    risk.currentScore,
    risk.status,
    risk.dueDate,
    risk.createdAt,
    risk.updatedAt
  ]
}
