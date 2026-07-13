import type { FormInstance } from 'antd'

export type FormSnapshot = string

interface DiscardChangesModal {
  confirm: (config: {
    title: string
    content: string
    okText: string
    cancelText: string
    okButtonProps: { danger: boolean }
    onOk: () => void
  }) => unknown
}

export function createFormSnapshot (values: unknown): FormSnapshot {
  return JSON.stringify(normalizeFormValue(values))
}

export function getFormSnapshot<T> (form: FormInstance<T>): FormSnapshot {
  return createFormSnapshot(form.getFieldsValue(true))
}

export function hasUnsavedFormChanges<T> (form: FormInstance<T>, snapshot: FormSnapshot | null): boolean {
  return snapshot !== null && getFormSnapshot(form) !== snapshot
}

export function confirmDiscardChanges (
  modal: DiscardChangesModal,
  hasChanges: boolean,
  onDiscard: () => void
): void {
  if (!hasChanges) {
    onDiscard()
    return
  }

  modal.confirm({
    title: 'Ungespeicherte Änderungen verwerfen?',
    content: 'Deine Eingaben gehen verloren, wenn du ohne Speichern fortfährst.',
    okText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten',
    okButtonProps: { danger: true },
    onOk: onDiscard
  })
}

function normalizeFormValue (value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (Array.isArray(value)) return value.map(normalizeFormValue)
  if (typeof value !== 'object') return value

  if ('format' in value && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD')
  }

  return Object.entries(value)
    .map(([key, entry]) => [key, normalizeFormValue(entry)] as const)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((normalized, [key, entry]) => {
      normalized[key] = entry
      return normalized
    }, {})
}
