import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Tag,
  Typography
} from 'antd'
import { useEffect, useState } from 'react'

import type { ReviewCycle, Risk, RiskStatus, UpdateRiskInput } from './api/risks'
import { datePickerDisplayFormat, getDatePickerValue, normalizeDatePickerValue } from './datePickerFields'
import { calculateReviewDate, reviewCycleOptions } from './riskOptions'
import {
  confirmDiscardChanges,
  createFormSnapshot,
  getFormSnapshot,
  hasUnsavedFormChanges,
  type FormSnapshot
} from './unsavedChanges'

const { Text, Title } = Typography

interface RiskDetailDrawerProps {
  risk: Risk | null
  open: boolean
  onClose: () => void
  onUpdate: (id: string, input: UpdateRiskInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

interface EditRiskValues {
  title: string
  description: string
  category: string
  owner: string
  initialScore: number
  currentScore: number
  status: RiskStatus
  dueDate?: string
  reviewDate?: string
  reviewCycle: ReviewCycle
}

const statusColors: Record<RiskStatus, string> = {
  Offen: 'gold',
  'In Bearbeitung': 'blue',
  Überwacht: 'purple',
  Geschlossen: 'green'
}

/** Ordnet einen Risikowert einer visuellen Stufe für Drawer und Fortschrittsanzeige zu. */
function getRiskMeta (score: number): { color: string, label: string } {
  if (score >= 16) return { color: '#e5484d', label: 'Kritisch' }
  if (score >= 10) return { color: '#f59e0b', label: 'Hoch' }
  if (score >= 5) return { color: '#7c6ee6', label: 'Mittel' }
  return { color: '#35a56f', label: 'Niedrig' }
}

/** Formatiert einen ISO-Zeitpunkt für die deutschsprachige Detailansicht. */
function formatTimestamp (value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

/** Formatiert ein ISO-Datum für die deutschsprachige Detailansicht. */
function formatDate (value: string | null): string {
  if (!value) return 'Nicht geplant'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00`))
}

function toEditRiskValues (risk: Risk): EditRiskValues {
  return {
    title: risk.title,
    description: risk.description,
    category: risk.category,
    owner: risk.owner,
    initialScore: risk.initialScore,
    currentScore: risk.currentScore,
    status: risk.status,
    dueDate: risk.dueDate ?? undefined,
    reviewDate: risk.reviewDate ?? undefined,
    reviewCycle: risk.reviewCycle
  }
}

/** Zeigt Risikodetails und kapselt Bearbeiten sowie bestätigte Löschmarkierung. */
export function RiskDetailDrawer ({
  risk,
  open,
  onClose,
  onUpdate,
  onDelete
}: RiskDetailDrawerProps): React.JSX.Element | null {
  const { modal } = App.useApp()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editSnapshot, setEditSnapshot] = useState<FormSnapshot | null>(null)
  const [form] = Form.useForm<EditRiskValues>()
  const selectedEditReviewCycle = Form.useWatch('reviewCycle', form) ?? risk?.reviewCycle ?? 'Fix'

  useEffect(() => {
    if (!risk) return
    const values = toEditRiskValues(risk)
    form.setFieldsValue(values)
    setEditSnapshot(createFormSnapshot(values))
  }, [form, risk])

  if (!risk) return null
  const meta = getRiskMeta(risk.currentScore)

  /** Validiert das Editierformular und übergibt nur API-relevante Felder. */
  const saveChanges = async (): Promise<void> => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await onUpdate(risk.id, { ...values, dueDate: values.dueDate || null, reviewDate: values.reviewDate || null })
      setEditing(false)
      setEditSnapshot(null)
    } catch {
      // Die übergeordnete App zeigt die normalisierte API-Fehlermeldung an.
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (): void => {
    setEditSnapshot(getFormSnapshot(form))
    setEditing(true)
  }

  const discardEditModal = (): void => {
    const values = toEditRiskValues(risk)
    form.setFieldsValue(values)
    setEditSnapshot(createFormSnapshot(values))
    setEditing(false)
  }

  const closeEditModal = (): void => {
    confirmDiscardChanges(
      modal,
      hasUnsavedFormChanges(form, editSnapshot),
      discardEditModal
    )
  }

  /** Markiert das ausgewählte Risiko nach der bereits erfolgten Benutzerbestätigung als gelöscht. */
  const removeRisk = async (): Promise<void> => {
    setDeleting(true)
    try {
      await onDelete(risk.id)
      onClose()
    } catch {
      // Bei einem API-Fehler bleibt der Drawer für einen erneuten Versuch geöffnet.
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Drawer
        title={<Space><Text code>{risk.reference}</Text><Tag color={statusColors[risk.status]}>{risk.status}</Tag></Space>}
        open={open}
        onClose={onClose}
        width={520}
        destroyOnHidden
        extra={(
          <Space>
            <Button icon={<EditOutlined />} onClick={openEditModal}>Bearbeiten</Button>
            <Popconfirm
              title="Risiko löschen?"
              description={`${risk.reference} · ${risk.title}`}
              icon={<ExclamationCircleOutlined style={{ color: '#e5484d' }} />}
              okText="Löschen"
              cancelText="Abbrechen"
              okButtonProps={{ danger: true, loading: deleting }}
              onConfirm={() => { void removeRisk() }}
            >
              <Button danger icon={<DeleteOutlined />}>Löschen</Button>
            </Popconfirm>
          </Space>
        )}
      >
        <div className="detail-score-card">
          <Flex justify="space-between" align="start">
            <div>
              <Text type="secondary">Aktueller Risikowert</Text>
              <Title level={2} style={{ color: meta.color }}>{risk.currentScore}/25</Title>
            </div>
            <Tag color={meta.color}>{meta.label}</Tag>
          </Flex>
          <Progress percent={risk.currentScore / 25 * 100} showInfo={false} strokeColor={meta.color} />
          <Text type="secondary">Initialer Wert: {risk.initialScore}/25</Text>
        </div>

        <Descriptions
          column={1}
          bordered
          size="small"
          items={[
            { key: 'title', label: 'Risiko', children: risk.title },
            { key: 'description', label: 'Beschreibung', children: risk.description },
            { key: 'category', label: 'Kategorie', children: risk.category },
            { key: 'owner', label: 'Verantwortlich', children: risk.owner },
            { key: 'dueDate', label: 'Fällig', children: formatDate(risk.dueDate) },
            { key: 'reviewDate', label: 'Review', children: formatDate(risk.reviewDate) },
            { key: 'reviewCycle', label: 'Review-Rhythmus', children: risk.reviewCycle },
            { key: 'createdAt', label: 'Erfasst', children: formatTimestamp(risk.createdAt) },
            { key: 'updatedAt', label: 'Geändert', children: formatTimestamp(risk.updatedAt) }
          ]}
        />
      </Drawer>

      <Modal
        title={<Space size={8}><Text code>{risk.reference}</Text><span>Risiko bearbeiten</span></Space>}
        open={editing}
        onCancel={closeEditModal}
        onOk={() => { void saveChanges() }}
        okText="Speichern"
        cancelText="Abbrechen"
        confirmLoading={saving}
        destroyOnHidden
        width={640}
        className="risk-edit-modal"
      >
        <Form form={form} layout="vertical" className="risk-form risk-edit-form" requiredMark={false}>
          <Form.Item name="title" label="Bezeichnung" rules={[{ required: true, message: 'Bitte eine Bezeichnung eingeben.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="Beschreibung" rules={[{ required: true, message: 'Bitte eine Beschreibung eingeben.' }]}>
            <Input.TextArea maxLength={2000} rows={4} />
          </Form.Item>
          <div className="risk-edit-grid">
            <Form.Item name="category" label="Kategorie" rules={[{ required: true, message: 'Bitte eine Kategorie eingeben.' }]}>
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item name="owner" label="Verantwortlich" rules={[{ required: true, message: 'Bitte eine verantwortliche Person eingeben.' }]}>
              <Input maxLength={200} />
            </Form.Item>
          </div>
          <div className="risk-edit-grid">
            <Form.Item name="initialScore" label="Initialwert" rules={[{ required: true }]}>
              <InputNumber min={1} max={25} className="full-width" />
            </Form.Item>
            <Form.Item name="currentScore" label="Aktueller Wert" rules={[{ required: true }]}>
              <InputNumber min={1} max={25} className="full-width" />
            </Form.Item>
          </div>
          <div className="risk-edit-grid">
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select<RiskStatus> options={Object.keys(statusColors).map((value) => ({ value: value as RiskStatus, label: value }))} />
            </Form.Item>
            <Form.Item
              name="reviewDate"
              label="Review-Datum"
              dependencies={['reviewCycle']}
              getValueProps={(value: string | undefined) => ({ value: getDatePickerValue(value) })}
              normalize={normalizeDatePickerValue}
              rules={[
                ({ getFieldValue }) => ({
                  validator: async (_, value: string | undefined) => {
                    if (getFieldValue('reviewCycle') === 'Fix' && !value) {
                      throw new Error('Bitte ein Review-Datum angeben.')
                    }
                  }
                })
              ]}
            >
              <DatePicker
                className="full-width"
                disabled={selectedEditReviewCycle !== 'Fix'}
                format={datePickerDisplayFormat}
                placeholder="Review-Datum auswählen"
              />
            </Form.Item>
          </div>
          <Form.Item name="reviewCycle" label="Review-Rhythmus" rules={[{ required: true, message: 'Bitte einen Review-Rhythmus wählen.' }]}>
            <Select<ReviewCycle>
              options={reviewCycleOptions}
              onChange={(value) => {
                if (value !== 'Fix') form.setFieldValue('reviewDate', calculateReviewDate(value))
              }}
            />
          </Form.Item>
          <Form.Item
            name="dueDate"
            label="Fälligkeitsdatum"
            getValueProps={(value: string | undefined) => ({ value: getDatePickerValue(value) })}
            normalize={normalizeDatePickerValue}
          >
            <DatePicker className="full-width" format={datePickerDisplayFormat} placeholder="Datum auswählen" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
