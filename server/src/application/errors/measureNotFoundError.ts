export class MeasureNotFoundError extends Error {
  constructor (id: string) {
    super(`Die Maßnahme mit der ID ${id} wurde nicht gefunden.`)
    this.name = 'MeasureNotFoundError'
  }
}
