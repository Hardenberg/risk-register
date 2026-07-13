import {
  ApplicationSettings,
  defaultApplicationSettings,
  type ApplicationSettingsPrimitives
} from '../../domain/entities/applicationSettings.js'
import type { ApplicationSettingsRepository } from '../../domain/repositories/applicationSettingsRepository.js'
import type { SqliteDatabase } from '../database/sqliteDatabase.js'

const settingKeys = {
  organizationName: 'organization_name',
  defaultReviewCycle: 'default_review_cycle',
  reviewReminderDays: 'review_reminder_days',
  highRiskThreshold: 'high_risk_threshold',
  criticalRiskThreshold: 'critical_risk_threshold'
} as const

export class SqliteApplicationSettingsRepository implements ApplicationSettingsRepository {
  constructor (private readonly database: SqliteDatabase) {}

  async get (): Promise<ApplicationSettings> {
    const rows = this.database.connection.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string, value: string }>
    const values = new Map(rows.map((row) => [row.key, row.value]))

    return ApplicationSettings.fromPrimitives({
      organizationName: values.get(settingKeys.organizationName) ?? defaultApplicationSettings.organizationName,
      defaultReviewCycle: (values.get(settingKeys.defaultReviewCycle) ?? defaultApplicationSettings.defaultReviewCycle) as ApplicationSettingsPrimitives['defaultReviewCycle'],
      reviewReminderDays: toInteger(values.get(settingKeys.reviewReminderDays), defaultApplicationSettings.reviewReminderDays),
      highRiskThreshold: toInteger(values.get(settingKeys.highRiskThreshold), defaultApplicationSettings.highRiskThreshold),
      criticalRiskThreshold: toInteger(values.get(settingKeys.criticalRiskThreshold), defaultApplicationSettings.criticalRiskThreshold)
    })
  }

  async save (settings: ApplicationSettings): Promise<void> {
    const value = settings.toPrimitives()
    const statement = this.database.connection.prepare(`
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)

    statement.run(settingKeys.organizationName, value.organizationName)
    statement.run(settingKeys.defaultReviewCycle, value.defaultReviewCycle)
    statement.run(settingKeys.reviewReminderDays, String(value.reviewReminderDays))
    statement.run(settingKeys.highRiskThreshold, String(value.highRiskThreshold))
    statement.run(settingKeys.criticalRiskThreshold, String(value.criticalRiskThreshold))
  }
}

function toInteger (value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}
