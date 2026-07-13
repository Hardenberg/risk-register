export class InvalidCredentialsError extends Error {
  constructor () {
    super('Benutzername oder Passwort ist ungültig.')
    this.name = 'InvalidCredentialsError'
  }
}
