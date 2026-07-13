export class UserNotFoundError extends Error {
  constructor (id: string) {
    super(`Der Benutzer mit der ID ${id} wurde nicht gefunden.`)
    this.name = 'UserNotFoundError'
  }
}
