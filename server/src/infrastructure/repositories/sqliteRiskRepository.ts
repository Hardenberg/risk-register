import type { StatementSync } from 'node:sqlite'

import { Risk, type ReviewCycle, type RiskPrimitives, type RiskStatus } from '../../domain/entities/risk.js'
import type { PaginatedResult } from '../../domain/repositories/pagination.js'
import type { RiskListQuery, RiskRepository, RiskSortField } from '../../domain/repositories/riskRepository.js'
import type { SqliteDatabase } from '../database/sqliteDatabase.js'

interface RiskRow {
  id: string
  reference: string
  title: string
  description: string
  category: string
  owner: string
  initial_score: number
  current_score: number
  status: RiskStatus
  due_date: string | null
  review_date: string | null
  review_cycle: ReviewCycle
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export class SqliteRiskRepository implements RiskRepository {
  private readonly findByIdStatement: StatementSync

  /** Bereitet häufig genutzte Statements für den SQLite-Adapter vor. */
  constructor (private readonly database: SqliteDatabase) {
    this.findByIdStatement = database.connection.prepare('SELECT * FROM risks WHERE id = ? AND deleted_at IS NULL')
  }

  /** Liest Risiken serverseitig gefiltert, sortiert und paginiert. */
  async findAll (query: RiskListQuery): Promise<PaginatedResult<Risk>> {
    const { whereClause, params } = buildRiskWhere(query)
    const totalRow = this.database.connection.prepare(`
      SELECT COUNT(*) AS total
      FROM risks
      ${whereClause}
    `).get(...params) as unknown as { total: number }
    const rows = this.database.connection.prepare(`
      SELECT * FROM risks
      ${whereClause}
      ORDER BY ${riskSortColumn(query.sortBy)} ${query.sortDirection.toUpperCase()}, created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, query.pageSize, (query.page - 1) * query.pageSize)

    return {
      items: (rows as unknown as RiskRow[]).map(toEntity),
      page: query.page,
      pageSize: query.pageSize,
      total: totalRow.total,
      totalPages: Math.max(1, Math.ceil(totalRow.total / query.pageSize))
    }
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
        id, reference, title, description, category, owner, initial_score,
        current_score, status, due_date, review_date, review_cycle, created_at,
        updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...toDatabaseValues(value))
  }

  /** Persistiert alle änderbaren Felder und den Änderungszeitpunkt einer Entität. */
  async update (risk: Risk): Promise<void> {
    const value = risk.toPrimitives()
    this.database.connection.prepare(`
      UPDATE risks SET
        title = ?, description = ?, category = ?, owner = ?, initial_score = ?,
        current_score = ?, status = ?, due_date = ?, review_date = ?, review_cycle = ?,
        updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(
      value.title,
      value.description,
      value.category,
      value.owner,
      value.initialScore,
      value.currentScore,
      value.status,
      value.dueDate,
      value.reviewDate,
      value.reviewCycle,
      value.updatedAt,
      value.id
    )
  }

  /** Markiert eine Zeile als gelöscht und meldet, ob eine aktive ID vorhanden war. */
  async delete (id: string, deletedAt: string): Promise<boolean> {
    const result = this.database.connection.prepare(`
      UPDATE risks SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(deletedAt, deletedAt, id)
    return result.changes > 0
  }
}

/** Übersetzt eine Datenbankzeile zurück in eine validierte Domain-Entität. */
function buildRiskWhere (query: RiskListQuery): { whereClause: string, params: Array<string | number> } {
  const conditions = ['deleted_at IS NULL']
  const params: Array<string | number> = []
  const normalizedSearch = query.search?.trim()

  if (normalizedSearch) {
    conditions.push('(reference LIKE ? OR title LIKE ? OR description LIKE ? OR category LIKE ? OR owner LIKE ?)')
    params.push(...Array<string>(5).fill(`%${normalizedSearch}%`))
  }
  if (query.status) {
    conditions.push('status = ?')
    params.push(query.status)
  }
  if (query.category?.trim()) {
    conditions.push('category = ?')
    params.push(query.category.trim())
  }
  if (query.owner?.trim()) {
    conditions.push('owner = ?')
    params.push(query.owner.trim())
  }

  return { whereClause: `WHERE ${conditions.join(' AND ')}`, params }
}

function riskSortColumn (field: RiskSortField): string {
  const columns: Record<RiskSortField, string> = {
    reference: 'reference',
    title: 'title',
    category: 'category',
    owner: 'owner',
    currentScore: 'current_score',
    status: 'status',
    dueDate: "COALESCE(due_date, '9999-12-31')",
    reviewDate: "COALESCE(review_date, '9999-12-31')",
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
  return columns[field]
}

function toEntity (row: RiskRow): Risk {
  return Risk.fromPrimitives({
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description,
    category: row.category,
    owner: row.owner,
    initialScore: row.initial_score,
    currentScore: row.current_score,
    status: row.status,
    dueDate: row.due_date,
    reviewDate: row.review_date,
    reviewCycle: row.review_cycle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  })
}

/** Ordnet Domain-Primitive in der Reihenfolge des INSERT-Statements an. */
function toDatabaseValues (risk: RiskPrimitives): Array<string | number | null> {
  return [
    risk.id,
    risk.reference,
    risk.title,
    risk.description,
    risk.category,
    risk.owner,
    risk.initialScore,
    risk.currentScore,
    risk.status,
    risk.dueDate,
    risk.reviewDate,
    risk.reviewCycle,
    risk.createdAt,
    risk.updatedAt,
    risk.deletedAt
  ]
}
