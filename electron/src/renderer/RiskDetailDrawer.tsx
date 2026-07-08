import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import {
  Button,
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

import type { Risk, RiskStatus, UpdateRiskInput } from './api/risks'

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
  category: string
  owner: string
  initialScore: number
  currentScore: number
  status: RiskStatus
  dueDate?: string
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

/** Zeigt Risikodetails und kapselt Bearbeiten sowie bestätigtes Löschen. */
export function RiskDetailDrawer ({
  risk,
  open,
  onClose,
  onUpdate,
  onDelete
}: RiskDetailDrawerProps): React.JSX.Element | null {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form] = Form.useForm<EditRiskValues>()

  useEffect(() => {
    if (!risk) return
    form.setFieldsValue({
      title: risk.title,
      category: risk.category,
      owner: risk.owner,
      initialScore: risk.initialScore,
      currentScore: risk.currentScore,
      status: risk.status,
      dueDate: risk.dueDate ?? undefined
    })
  }, [form, risk])

  if (!risk) return null
  const meta = getRiskMeta(risk.currentScore)

  /** Validiert das Editierformular und übergibt nur API-relevante Felder. */
  const saveChanges = async (): Promise<void> => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await onUpdate(risk.id, { ...values, dueDate: values.dueDate || null })
      setEditing(false)
    } catch {
      // Die übergeordnete App zeigt die normalisierte API-Fehlermeldung an.
    } finally {
      setSaving(false)
    }
  }

  /** Löscht das ausgewählte Risiko nach der bereits erfolgten Benutzerbestätigung. */
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
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Bearbeiten</Button>
            <Popconfirm
              title="Risiko dauerhaft löschen?"
              description={`${risk.reference} · ${risk.title}`}
              icon={<ExclamationCircleOutlined style={{ color: '#e5484d' }} />}
              okText="Endgültig löschen"
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
            { key: 'category', label: 'Kategorie', children: risk.category },
            { key: 'owner', label: 'Verantwortlich', children: risk.owner },
            { key: 'dueDate', label: 'Fällig', children: risk.dueDate ?? 'Nicht geplant' },
            { key: 'createdAt', label: 'Erfasst', children: formatTimestamp(risk.createdAt) },
            { key: 'updatedAt', label: 'Geändert', children: formatTimestamp(risk.updatedAt) }
          ]}
        />
      </Drawer>

      <Modal
        title={`${risk.reference} bearbeiten`}
        open={editing}
        onCancel={() => setEditing(false)}
        onOk={() => { void saveChanges() }}
        okText="Änderungen speichern"
        cancelText="Abbrechen"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="risk-form" requiredMark={false}>
          <Form.Item name="title" label="Bezeichnung" rules={[{ required: true, message: 'Bitte eine Bezeichnung eingeben.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="category" label="Kategorie" rules={[{ required: true, message: 'Bitte eine Kategorie eingeben.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="owner" label="Verantwortlich" rules={[{ required: true, message: 'Bitte eine verantwortliche Person eingeben.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="initialScore" label="Initialwert" rules={[{ required: true }]} className="flex-field">
              <InputNumber min={1} max={25} className="full-width" />
            </Form.Item>
            <Form.Item name="currentScore" label="Aktueller Wert" rules={[{ required: true }]} className="flex-field">
              <InputNumber min={1} max={25} className="full-width" />
            </Form.Item>
          </Flex>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select<RiskStatus> options={Object.keys(statusColors).map((value) => ({ value: value as RiskStatus, label: value }))} />
          </Form.Item>
          <Form.Item name="dueDate" label="Fälligkeitsdatum">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
