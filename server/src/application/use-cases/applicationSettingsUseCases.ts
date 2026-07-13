import type {
  ApplicationSettingsPrimitives,
  UpdateApplicationSettingsInput
} from '../../domain/entities/applicationSettings.js'
import type { ApplicationSettingsRepository } from '../../domain/repositories/applicationSettingsRepository.js'

export class GetApplicationSettings {
  constructor (private readonly repository: ApplicationSettingsRepository) {}

  async execute (): Promise<ApplicationSettingsPrimitives> {
    return (await this.repository.get()).toPrimitives()
  }
}

export class UpdateApplicationSettings {
  constructor (private readonly repository: ApplicationSettingsRepository) {}

  async execute (input: UpdateApplicationSettingsInput): Promise<ApplicationSettingsPrimitives> {
    const current = await this.repository.get()
    const updated = current.update(input)
    await this.repository.save(updated)
    return updated.toPrimitives()
  }
}
