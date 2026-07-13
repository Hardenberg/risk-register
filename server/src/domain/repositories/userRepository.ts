import type { User } from '../entities/user.js'

export interface UserRepository {
  findAll: () => Promise<User[]>
  findById: (id: string) => Promise<User | null>
  findByUsernameOrEmail: (login: string) => Promise<User | null>
  findByUsername: (username: string) => Promise<User | null>
  findByEmail: (email: string) => Promise<User | null>
  create: (user: User) => Promise<void>
  update: (user: User) => Promise<void>
}
