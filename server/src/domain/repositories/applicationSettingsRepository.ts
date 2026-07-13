import type { ApplicationSettings } from '../entities/applicationSettings.js'

export interface ApplicationSettingsRepository {
  get: () => Promise<ApplicationSettings>
  save: (settings: ApplicationSettings) => Promise<void>
}
