export const userRoles = ['Admin', 'User'] as const
export type UserRole = typeof userRoles[number]

export interface UserPrimitives {
  id: string
  username: string
  name: string
  email: string
  department: string
  role: UserRole
  passwordHash: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface UserPublicPrimitives {
  id: string
  username: string
  name: string
  email: string
  department: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserEntityInput {
  id: string
  username: string
  name: string
  email: string
  department: string
  role?: UserRole
  passwordHash: string
  active?: boolean
  timestamp: string
}

export type UpdateUserEntityInput = Partial<Pick<
UserPrimitives,
'username' | 'name' | 'email' | 'department' | 'role' | 'passwordHash' | 'active'
>>

export class UserValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'UserValidationError'
  }
}

export class User {
  private constructor (private readonly props: UserPrimitives) {}

  static create (input: CreateUserEntityInput): User {
    return User.fromPrimitives({
      id: input.id,
      username: input.username,
      name: input.name,
      email: input.email,
      department: input.department,
      role: input.role ?? 'User',
      passwordHash: input.passwordHash,
      active: input.active ?? true,
      createdAt: input.timestamp,
      updatedAt: input.timestamp
    })
  }

  static fromPrimitives (props: UserPrimitives): User {
    const normalized: UserPrimitives = {
      ...props,
      username: validateUsername(props.username),
      name: validateText('Name', props.name),
      email: validateEmail(props.email),
      department: validateText('Abteilung', props.department),
      role: validateRole(props.role),
      passwordHash: validatePasswordHash(props.passwordHash)
    }

    return new User(normalized)
  }

  update (changes: UpdateUserEntityInput, timestamp: string): User {
    return User.fromPrimitives({
      ...this.props,
      ...changes,
      updatedAt: timestamp
    })
  }

  toPrimitives (): UserPrimitives {
    return { ...this.props }
  }

  toPublicPrimitives (): UserPublicPrimitives {
    const { passwordHash: _passwordHash, ...publicProps } = this.props
    return { ...publicProps }
  }
}

function validateUsername (value: string): string {
  const normalized = value.trim()
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(normalized)) {
    throw new UserValidationError('Der Benutzername muss 3 bis 80 Zeichen lang sein und darf Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich enthalten.')
  }
  return normalized
}

function validateText (field: string, value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new UserValidationError(`${field} darf nicht leer sein.`)
  }
  if (normalized.length > 200) {
    throw new UserValidationError(`${field} darf höchstens 200 Zeichen lang sein.`)
  }
  return normalized
}

function validateEmail (value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new UserValidationError('Die E-Mail-Adresse ist ungültig.')
  }
  return normalized
}

function validateRole (value: UserRole): UserRole {
  if (!userRoles.includes(value)) {
    throw new UserValidationError('Die Benutzerrolle ist ungültig.')
  }
  return value
}

function validatePasswordHash (value: string): string {
  if (!value.startsWith('scrypt$')) {
    throw new UserValidationError('Der Passwort-Hash ist ungültig.')
  }
  return value
}
