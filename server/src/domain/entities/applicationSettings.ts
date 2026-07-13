import { reviewCycles, type ReviewCycle } from './risk.js'

export interface ApplicationSettingsPrimitives {
  organizationName: string
  defaultReviewCycle: ReviewCycle
  reviewReminderDays: number
  highRiskThreshold: number
  criticalRiskThreshold: number
}

export type UpdateApplicationSettingsInput = Partial<ApplicationSettingsPrimitives>

export class ApplicationSettingsValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'ApplicationSettingsValidationError'
  }
}

export class ApplicationSettings {
  private constructor (private readonly props: ApplicationSettingsPrimitives) {}

  static fromPrimitives (props: ApplicationSettingsPrimitives): ApplicationSettings {
    const normalized: ApplicationSettingsPrimitives = {
      organizationName: validateText('Organisationsname', props.organizationName, 120),
      defaultReviewCycle: validateReviewCycle(props.defaultReviewCycle),
      reviewReminderDays: validateInteger('Review-Erinnerung', props.reviewReminderDays, 0, 365),
      highRiskThreshold: validateInteger('Schwelle Hoch', props.highRiskThreshold, 1, 25),
      criticalRiskThreshold: validateInteger('Schwelle Kritisch', props.criticalRiskThreshold, 1, 25)
    }

    if (normalized.highRiskThreshold >= normalized.criticalRiskThreshold) {
      throw new ApplicationSettingsValidationError('Die Schwelle Hoch muss kleiner als die Schwelle Kritisch sein.')
    }

    return new ApplicationSettings(normalized)
  }

  update (changes: UpdateApplicationSettingsInput): ApplicationSettings {
    return ApplicationSettings.fromPrimitives({ ...this.props, ...changes })
  }

  toPrimitives (): ApplicationSettingsPrimitives {
    return { ...this.props }
  }
}

export const defaultApplicationSettings: ApplicationSettingsPrimitives = {
  organizationName: 'Risk Register',
  defaultReviewCycle: 'Fix',
  reviewReminderDays: 14,
  highRiskThreshold: 10,
  criticalRiskThreshold: 16
}

function validateText (field: string, value: string, maxLength: number): string {
  const normalized = value.trim()
  if (normalized.length === 0) throw new ApplicationSettingsValidationError(`${field} darf nicht leer sein.`)
  if (normalized.length > maxLength) throw new ApplicationSettingsValidationError(`${field} darf höchstens ${maxLength} Zeichen lang sein.`)
  return normalized
}

function validateReviewCycle (value: ReviewCycle): ReviewCycle {
  if (!reviewCycles.includes(value)) {
    throw new ApplicationSettingsValidationError('Der Standard-Review-Rhythmus ist ungültig.')
  }
  return value
}

function validateInteger (field: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApplicationSettingsValidationError(`${field} muss zwischen ${min} und ${max} liegen.`)
  }
  return value
}
