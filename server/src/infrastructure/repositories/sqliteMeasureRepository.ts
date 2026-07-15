import type { StatementSync } from 'node:sqlite'

import { Measure } from '../../domain/entities/measure.js'
import type { PaginatedResult } from '../../domain/repositories/pagination.js'
import type { MeasureListQuery, MeasureRepository, MeasureSortField } from '../../domain/repositories/measureRepository.js'
import type { SqliteDatabase } from '../database/sqliteDatabase.js'

interface MeasureRow {
  id: string
  risk_id: string | null
  title: string
  description: string
  owner: string
  due_date: string | null
  priority: 'Kritisch' | 'Hoch' | 'Normal'
  status: 'Offen' | 'In Arbeit' | 'Erledigt'
  created_at: string
  updated_at: string
}

export class SqliteMeasureRepository implements MeasureRepository {
  private readonly findByIdStatement: StatementSync

  constructor (private readonly database: SqliteDatabase) {
    this.findByIdStatement = database.connection.prepare('SELECT * FROM measures WHERE id = ?')
  }

  async findAll (query: MeasureListQuery): Promise<PaginatedResult<Measure>> {
    const { whereClause, params } = buildMeasureWhere(query)
    const totalRow = this.database.connection.prepare(`
      SELECT COUNT(*) AS total
      FROM measures
      ${whereClause}
    `).get(...params) as unknown as { total: number }
    const rows = this.database.connection.prepare(`
      SELECT * FROM measures
      ${whereClause}
      ORDER BY
        ${measureSortColumn(query.sortBy)} ${query.sortDirection.toUpperCase()},
        CASE status WHEN 'Erledigt' THEN 1 ELSE 0 END,
        COALESCE(due_date, '9999-12-31'),
        created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, query.pageSize, (query.page - 1) * query.pageSize)
    return {
      items: (rows as unknown as MeasureRow[]).map(toEntity),
      page: query.page,
      pageSize: query.pageSize,
      total: totalRow.total,
      totalPages: Math.max(1, Math.ceil(totalRow.total / query.pageSize))
    }
  }

  async findById (id: string): Promise<Measure | null> {
    const row = this.findByIdStatement.get(id) as unknown as MeasureRow | undefined
    return row ? toEntity(row) : null
  }

  async create (measure: Measure): Promise<void> {
    const value = measure.toPrimitives()
    this.database.connection.prepare(`
      INSERT INTO measures (
        id, risk_id, title, description, owner, due_date, priority, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id,
      value.riskId,
      value.title,
      value.description,
      value.owner,
      value.dueDate,
      value.priority,
      value.status,
      value.createdAt,
      value.updatedAt
    )
  }

  async update (measure: Measure): Promise<void> {
    const value = measure.toPrimitives()
    this.database.connection.prepare(`
      UPDATE measures SET
        risk_id = ?, title = ?, description = ?, owner = ?, due_date = ?,
        priority = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      value.riskId,
      value.title,
      value.description,
      value.owner,
      value.dueDate,
      value.priority,
      value.status,
      value.updatedAt,
      value.id
    )
  }

  async delete (id: string): Promise<boolean> {
    const result = this.database.connection.prepare('DELETE FROM measures WHERE id = ?').run(id)
    return result.changes > 0
  }
}

function buildMeasureWhere (query: MeasureListQuery): { whereClause: string, params: Array<string | number> } {
  const conditions: string[] = []
  const params: Array<string | number> = []
  const normalizedSearch = query.search?.trim()

  if (normalizedSearch) {
    conditions.push('(title LIKE ? OR description LIKE ? OR owner LIKE ?)')
    params.push(...Array<string>(3).fill(`%${normalizedSearch}%`))
  }
  if (query.status) {
    conditions.push('status = ?')
    params.push(query.status)
  }
  if (query.overdue) {
    conditions.push('status != \'Erledigt\'')
    conditions.push('due_date IS NOT NULL AND due_date < ?')
    params.push(new Date().toISOString().slice(0, 10))
  }
  if (query.priority) {
    conditions.push('priority = ?')
    params.push(query.priority)
  }
  if (query.owner?.trim()) {
    conditions.push('owner = ?')
    params.push(query.owner.trim())
  }
  if (query.riskId?.trim()) {
    conditions.push('risk_id = ?')
    params.push(query.riskId.trim())
  }

  return { whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params }
}

function measureSortColumn (field: MeasureSortField): string {
  const columns: Record<MeasureSortField, string> = {
    title: 'title',
    owner: 'owner',
    dueDate: "COALESCE(due_date, '9999-12-31')",
    priority: "CASE priority WHEN 'Kritisch' THEN 0 WHEN 'Hoch' THEN 1 ELSE 2 END",
    status: "CASE status WHEN 'Erledigt' THEN 1 ELSE 0 END",
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
  return columns[field]
}

function toEntity (row: MeasureRow): Measure {
  return Measure.fromPrimitives({
    id: row.id,
    riskId: row.risk_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}
