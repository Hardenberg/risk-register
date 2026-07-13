import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Upload
} from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { isAuthenticationRequiredError } from './api/auth'
import {
  getApplicationSettings,
  updateApplicationSettings,
  triggerBackupDownload,
  runRestoreTest,
  type RestoreTestResponse,
  type ApplicationSettings
} from './api/settings'
import { reviewCycleOptions } from './riskOptions'
import {
  confirmDiscardChanges,
  createFormSnapshot,
  hasUnsavedFormChanges,
  type FormSnapshot
} from './unsavedChanges'
import { AppErrorState } from './uiStates'

const { Text, Title } = Typography

interface SettingsManagementProps {
  onAuthExpired?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function SettingsManagement ({ onAuthExpired, onDirtyChange }: SettingsManagementProps): React.JSX.Element {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<ApplicationSettings>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreTestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settingsSnapshot, setSettingsSnapshot] = useState<FormSnapshot | null>(null)
  const [dirty, setDirty] = useState(false)

  const handleBackup = async (): Promise<void> => {
    setBackupLoading(true)
    try {
      await triggerBackupDownload()
      void message.success('Backup wurde erfolgreich erstellt und heruntergeladen.')
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Backup fehlgeschlagen.')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestoreTestLatest = async (): Promise<void> => {
    setRestoreLoading(true)
    setRestoreResult(null)
    try {
      const result = await runRestoreTest()
      setRestoreResult(result)
      if (result.success) {
        void message.success('Restore-Test erfolgreich: Die Datenbank-Struktur ist valide.')
      } else {
        void message.error(`Restore-Test fehlgeschlagen: ${result.message}`)
      }
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Restore-Test fehlgeschlagen.')
    } finally {
      setRestoreLoading(false)
    }
  }

  const handleRestoreTestUpload = async (file: File): Promise<void> => {
    setRestoreLoading(true)
    setRestoreResult(null)
    try {
      const result = await runRestoreTest(file)
      setRestoreResult(result)
      if (result.success) {
        void message.success('Restore-Test der hochgeladenen Datei erfolgreich!')
      } else {
        void message.error(`Restore-Test der hochgeladenen Datei fehlgeschlagen: ${result.message}`)
      }
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Restore-Test fehlgeschlagen.')
    } finally {
      setRestoreLoading(false)
    }
  }

  const updateDirtyState = useCallback((nextDirty: boolean): void => {
    setDirty(nextDirty)
    onDirtyChange?.(nextDirty)
  }, [onDirtyChange])

  const loadSettings = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const settings = await getApplicationSettings()
      form.setFieldsValue(settings)
      setSettingsSnapshot(createFormSnapshot(settings))
      updateDirtyState(false)
    } catch (loadError) {
      if (isAuthenticationRequiredError(loadError)) {
        onAuthExpired?.()
        return
      }
      setError(loadError instanceof Error ? loadError.message : 'Einstellungen konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [form, onAuthExpired, updateDirtyState])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => () => {
    onDirtyChange?.(false)
  }, [onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const refreshDirtyState = (): void => {
    updateDirtyState(hasUnsavedFormChanges(form, settingsSnapshot))
  }

  const reloadSettings = (): void => {
    confirmDiscardChanges(modal, dirty, () => { void loadSettings() })
  }

  const saveSettings = async (): Promise<void> => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const saved = await updateApplicationSettings(values)
      form.setFieldsValue(saved)
      setSettingsSnapshot(createFormSnapshot(saved))
      updateDirtyState(false)
      void message.success('Einstellungen wurden gespeichert.')
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        onAuthExpired?.()
        return
      }
      void message.error(saveError instanceof Error ? saveError.message : 'Einstellungen konnten nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-management">
      <Flex justify="space-between" align="center" className="overview-heading">
        <div>
          <Text type="secondary" className="eyebrow">ADMIN-EINSTELLUNGEN</Text>
          <Title level={2}>Einstellungen</Title>
          <Text type="secondary">Minimale Server-Konfiguration für Organisation, Review und Risikoschwellen.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={reloadSettings} loading={loading}>Aktualisieren</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => { void saveSettings() }} loading={saving}>Speichern</Button>
        </Space>
      </Flex>

      {error && (
        <AppErrorState title="Einstellungen konnten nicht geladen werden" description={error} onRetry={reloadSettings} />
      )}

      <Card bordered={false} className="settings-card">
        <Form form={form} layout="vertical" className="risk-form risk-edit-form" requiredMark={false} onValuesChange={refreshDirtyState}>
          <div className="risk-edit-grid">
            <Form.Item name="organizationName" label="Organisation" rules={[{ required: true, message: 'Bitte eine Organisation eingeben.' }]}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item name="defaultReviewCycle" label="Standard-Review" rules={[{ required: true, message: 'Bitte einen Standard-Review wählen.' }]}>
              <Select options={reviewCycleOptions} />
            </Form.Item>
          </div>
          <div className="risk-edit-grid">
            <Form.Item name="reviewReminderDays" label="Review-Erinnerung in Tagen" rules={[{ required: true, type: 'number', min: 0, max: 365 }]}>
              <InputNumber min={0} max={365} className="full-width" />
            </Form.Item>
            <Form.Item
              name="highRiskThreshold"
              label="Schwelle Hoch"
              rules={[{ required: true, type: 'number', min: 1, max: 25 }]}
            >
              <InputNumber min={1} max={25} className="full-width" />
            </Form.Item>
          </div>
          <Form.Item
            name="criticalRiskThreshold"
            label="Schwelle Kritisch"
            dependencies={['highRiskThreshold']}
            rules={[
              { required: true, type: 'number', min: 1, max: 25 },
              ({ getFieldValue }) => ({
                validator: async (_, value: number | undefined) => {
                  const high = getFieldValue('highRiskThreshold') as number | undefined
                  if (value !== undefined && high !== undefined && high >= value) {
                    throw new Error('Kritisch muss größer als Hoch sein.')
                  }
                }
              })
            ]}
          >
            <InputNumber min={1} max={25} className="full-width" />
          </Form.Item>
        </Form>
      </Card>

      <Card bordered={false} className="settings-card" title="Daten-Backup & Restore-Test" style={{ marginTop: 24 }}>
        <Text type="secondary">
          Erstelle Backups der aktuellen SQLite-Datenbank oder führe einen kontrollierten Restore-Test durch, um die Integrität deiner Backups zu verifizieren.
        </Text>
        <div style={{ marginTop: 16 }}>
          <Space size={16} wrap>
            <Button type="primary" onClick={() => { void handleBackup() }} loading={backupLoading}>
              Backup erstellen & herunterladen
            </Button>
            <Button onClick={() => { void handleRestoreTestLatest() }} loading={restoreLoading}>
              Server-Backup validieren
            </Button>
            <Upload
              accept=".db"
              showUploadList={false}
              beforeUpload={(file) => {
                void handleRestoreTestUpload(file)
                return false
              }}
            >
              <Button loading={restoreLoading}>Backup-Datei hochladen & validieren</Button>
            </Upload>
          </Space>
        </div>
        {restoreResult && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: restoreResult.success ? '#f6ffed' : '#fff2f0', border: `1px solid ${restoreResult.success ? '#b7eb8f' : '#ffccc7'}` }}>
            <Text strong style={{ color: restoreResult.success ? '#389e0d' : '#cf1322' }}>
              {restoreResult.success ? '✓ Restore-Test erfolgreich' : '✗ Restore-Test fehlgeschlagen'}
            </Text>
            <div>
              <Text type="secondary">{restoreResult.message} (Quelle: {restoreResult.source})</Text>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
