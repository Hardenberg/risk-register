import type { StatementSync } from 'node:sqlite'

import { User } from '../../domain/entities/user.js'
import type { UserRepository } from '../../domain/repositories/userRepository.js'
import type { SqliteDatabase } from '../database/sqliteDatabase.js'

interface UserRow {
  id: string
  username: string
  name: string
  email: string
  department: string
  role: 'Admin' | 'User'
  password_hash: string
  active: 0 | 1
  created_at: string
  updated_at: string
}

export class SqliteUserRepository implements UserRepository {
  private readonly findByIdStatement: StatementSync
  private readonly findByUsernameStatement: StatementSync
  private readonly findByEmailStatement: StatementSync
  private readonly findByUsernameOrEmailStatement: StatementSync

  constructor (private readonly database: SqliteDatabase) {
    this.findByIdStatement = database.connection.prepare('SELECT * FROM users WHERE id = ?')
    this.findByUsernameStatement = database.connection.prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
    this.findByEmailStatement = database.connection.prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
    this.findByUsernameOrEmailStatement = database.connection.prepare(`
      SELECT * FROM users
      WHERE lower(username) = lower(?) OR lower(email) = lower(?)
      ORDER BY username
      LIMIT 1
    `)
  }

  async findAll (): Promise<User[]> {
    const rows = this.database.connection.prepare('SELECT * FROM users ORDER BY active DESC, name COLLATE NOCASE').all()
    return (rows as unknown as UserRow[]).map(toEntity)
  }

  async findById (id: string): Promise<User | null> {
    const row = this.findByIdStatement.get(id) as unknown as UserRow | undefined
    return row ? toEntity(row) : null
  }

  async findByUsernameOrEmail (login: string): Promise<User | null> {
    const normalized = login.trim()
    const row = this.findByUsernameOrEmailStatement.get(normalized, normalized) as unknown as UserRow | undefined
    return row ? toEntity(row) : null
  }

  async findByUsername (username: string): Promise<User | null> {
    const row = this.findByUsernameStatement.get(username.trim()) as unknown as UserRow | undefined
    return row ? toEntity(row) : null
  }

  async findByEmail (email: string): Promise<User | null> {
    const row = this.findByEmailStatement.get(email.trim()) as unknown as UserRow | undefined
    return row ? toEntity(row) : null
  }

  async create (user: User): Promise<void> {
    const value = user.toPrimitives()
    this.database.connection.prepare(`
      INSERT INTO users (
        id, username, name, email, department, role, password_hash, active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id,
      value.username,
      value.name,
      value.email,
      value.department,
      value.role,
      value.passwordHash,
      value.active ? 1 : 0,
      value.createdAt,
      value.updatedAt
    )
  }

  async update (user: User): Promise<void> {
    const value = user.toPrimitives()
    this.database.connection.prepare(`
      UPDATE users SET
        username = ?, name = ?, email = ?, department = ?, role = ?, password_hash = ?,
        active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      value.username,
      value.name,
      value.email,
      value.department,
      value.role,
      value.passwordHash,
      value.active ? 1 : 0,
      value.updatedAt,
      value.id
    )
  }
}

function toEntity (row: UserRow): User {
  return User.fromPrimitives({
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    department: row.department,
    role: row.role,
    passwordHash: row.password_hash,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}
