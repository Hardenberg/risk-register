export class RiskNotFoundError extends Error {
  /** Erzeugt den anwendungsweiten Fehler für eine unbekannte Risiko-ID. */
  constructor (id: string) {
    super(`Das Risiko mit der ID "${id}" wurde nicht gefunden.`)
    this.name = 'RiskNotFoundError'
  }
}
