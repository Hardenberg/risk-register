import { randomUUID } from 'node:crypto'

import { InvalidCredentialsError } from '../errors/invalidCredentialsError.js'
import { UserNotFoundError } from '../errors/userNotFoundError.js'
import { User, UserValidationError, type UserPublicPrimitives, type UserRole, type UpdateUserEntityInput } from '../../domain/entities/user.js'
import type { UserRepository } from '../../domain/repositories/userRepository.js'
import { hashPassword, verifyPassword } from '../../infrastructure/security/passwordHasher.js'

export interface LoginInput {
  username: string
  password: string
}

export interface CreateUserInput {
  username: string
  name: string
  email: string
  department: string
  role?: UserRole
  password: string
  active?: boolean
}

export interface UpdateUserInput {
  username?: string
  name?: string
  email?: string
  department?: string
  role?: UserRole
  password?: string
  active?: boolean
}

export interface UpdateProfileInput {
  username?: string
  name?: string
  email?: string
  department?: string
  password?: string
}

export interface UserUseCaseDependencies {
  repository: UserRepository
  generateId?: () => string
  now: () => Date
}

export class AuthenticateUser {
  constructor (private readonly repository: UserRepository) {}

  async execute (input: LoginInput): Promise<UserPublicPrimitives> {
    const user = await this.repository.findByUsernameOrEmail(input.username)
    if (!user) throw new InvalidCredentialsError()

    const value = user.toPrimitives()
    if (!value.active || !verifyPassword(input.password, value.passwordHash)) {
      throw new InvalidCredentialsError()
    }

    return user.toPublicPrimitives()
  }
}

export class ListUsers {
  constructor (private readonly repository: UserRepository) {}

  async execute (): Promise<UserPublicPrimitives[]> {
    const users = await this.repository.findAll()
    return users.map((user) => user.toPublicPrimitives())
  }
}

export class GetUser {
  constructor (private readonly repository: UserRepository) {}

  async execute (id: string): Promise<UserPublicPrimitives> {
    return (await requireUser(this.repository, id)).toPublicPrimitives()
  }
}

export class CreateUser {
  constructor (private readonly dependencies: UserUseCaseDependencies) {}

  async execute (input: CreateUserInput): Promise<UserPublicPrimitives> {
    await ensureUsernameAvailable(this.dependencies.repository, input.username)
    await ensureEmailAvailable(this.dependencies.repository, input.email)

    const timestamp = this.dependencies.now().toISOString()
    const user = User.create({
      id: (this.dependencies.generateId ?? randomUUID)(),
      username: input.username,
      name: input.name,
      email: input.email,
      department: input.department,
      role: input.role,
      passwordHash: hashUserPassword(input.password),
      active: input.active ?? true,
      timestamp
    })

    await this.dependencies.repository.create(user)
    return user.toPublicPrimitives()
  }
}

export class UpdateUser {
  constructor (private readonly dependencies: UserUseCaseDependencies) {}

  async execute (id: string, input: UpdateUserInput): Promise<UserPublicPrimitives> {
    const current = await requireUser(this.dependencies.repository, id)
    const currentValue = current.toPrimitives()

    if (input.username !== undefined && input.username.trim().toLowerCase() !== currentValue.username.toLowerCase()) {
      await ensureUsernameAvailable(this.dependencies.repository, input.username)
    }
    if (input.email !== undefined && input.email.trim().toLowerCase() !== currentValue.email.toLowerCase()) {
      await ensureEmailAvailable(this.dependencies.repository, input.email)
    }

    const { password, ...profileChanges } = input
    const changes: UpdateUserEntityInput = { ...profileChanges }
    if (password !== undefined) changes.passwordHash = hashUserPassword(password)

    const updated = current.update(changes, this.dependencies.now().toISOString())
    await this.dependencies.repository.update(updated)
    return updated.toPublicPrimitives()
  }
}

async function requireUser (repository: UserRepository, id: string): Promise<User> {
  const user = await repository.findById(id)
  if (!user) throw new UserNotFoundError(id)
  return user
}

async function ensureUsernameAvailable (repository: UserRepository, username: string): Promise<void> {
  if (await repository.findByUsername(username)) {
    throw new UserValidationError('Der Benutzername wird bereits verwendet.')
  }
}

async function ensureEmailAvailable (repository: UserRepository, email: string): Promise<void> {
  if (await repository.findByEmail(email)) {
    throw new UserValidationError('Die E-Mail-Adresse wird bereits verwendet.')
  }
}

function hashUserPassword (password: string): string {
  try {
    return hashPassword(password)
  } catch (error) {
    throw new UserValidationError(error instanceof Error ? error.message : 'Das Passwort ist ungültig.')
  }
}
