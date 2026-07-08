import {
  AlertOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined
} from '@ant-design/icons'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Flex,
  Input,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  type TableProps
} from 'antd'
import { useMemo, useState } from 'react'

import type { Risk, RiskStatus, UpdateRiskInput } from './api/risks'
import { RiskDetailDrawer } from './RiskDetailDrawer'

const { Text, Title } = Typography

interface RisksOverviewProps {
  risks: Risk[]
  loading: boolean
  error: string | null
  onReload: () => void
  onCreate: () => void
  onUpdate: (id: string, input: UpdateRiskInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const statusColors: Record<RiskStatus, string> = {
  Offen: 'gold',
  'In Bearbeitung': 'blue',
  Überwacht: 'purple',
  Geschlossen: 'green'
}

/** Ordnet einem numerischen Risikowert die gemeinsame visuelle Priorität zu. */
function getRiskMeta (score: number): { color: string, label: string } {
  if (score >= 16) return { color: '#e5484d', label: 'Kritisch' }
  if (score >= 10) return { color: '#f59e0b', label: 'Hoch' }
  if (score >= 5) return { color: '#7c6ee6', label: 'Mittel' }
  return { color: '#35a56f', label: 'Niedrig' }
}

/** Formatiert ein optionales ISO-Datum für die deutsche Tabellenansicht. */
function formatDate (date: string | null): string {
  if (!date) return 'Nicht geplant'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`))
}

/** Rendert die filter- und sortierbare Gesamtübersicht der vom Server geladenen Risiken. */
export function RisksOverview ({
  risks,
  loading,
  error,
  onReload,
  onCreate,
  onUpdate,
  onDelete
}: RisksOverviewProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RiskStatus | undefined>()
  const [category, setCategory] = useState<string | undefined>()
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null)

  const categories = useMemo(() => [...new Set(risks.map((risk) => risk.category))].sort(), [risks])
  const selectedRisk = useMemo(
    () => risks.find((risk) => risk.id === selectedRiskId) ?? null,
    [risks, selectedRiskId]
  )
  const filteredRisks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de')
    return risks.filter((risk) => {
      const matchesSearch = !term || [risk.reference, risk.title, risk.owner, risk.category]
        .some((value) => value.toLocaleLowerCase('de').includes(term))
      return matchesSearch && (!status || risk.status === status) && (!category || risk.category === category)
    })
  }, [category, risks, search, status])

  const columns: TableProps<Risk>['columns'] = [
    {
      title: 'REFERENZ',
      dataIndex: 'reference',
      width: 100,
      sorter: (left, right) => left.reference.localeCompare(right.reference),
      render: (reference: string) => <Text code>{reference}</Text>
    },
    {
      title: 'RISIKO',
      dataIndex: 'title',
      width: '29%',
      sorter: (left, right) => left.title.localeCompare(right.title, 'de'),
      render: (title: string, risk) => (
        <div>
          <Text strong>{title}</Text>
          <div><Text type="secondary" className="subline">{risk.category}</Text></div>
        </div>
      )
    },
    {
      title: 'VERANTWORTLICH',
      dataIndex: 'owner',
      render: (owner: string) => (
        <Space size={8}>
          <Avatar size={28} icon={<UserOutlined />} className="owner-avatar" />
          <Text>{owner}</Text>
        </Space>
      )
    },
    {
      title: 'RISIKOWERT',
      dataIndex: 'currentScore',
      width: 155,
      sorter: (left, right) => left.currentScore - right.currentScore,
      defaultSortOrder: 'descend',
      render: (score: number) => {
        const meta = getRiskMeta(score)
        return (
          <div className="overview-score">
            <Flex justify="space-between">
              <Text strong style={{ color: meta.color }}>{score}/25</Text>
              <Text type="secondary" className="subline">{meta.label}</Text>
            </Flex>
            <Progress percent={score / 25 * 100} showInfo={false} strokeColor={meta.color} size="small" />
          </div>
        )
      }
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      filters: Object.keys(statusColors).map((value) => ({ text: value, value })),
      onFilter: (value, risk) => risk.status === value,
      render: (value: RiskStatus) => <Tag color={statusColors[value]}>{value}</Tag>
    },
    {
      title: 'FÄLLIG',
      dataIndex: 'dueDate',
      width: 130,
      render: (value: string | null) => <Text type="secondary">{formatDate(value)}</Text>
    }
  ]

  return (
    <div className="risks-overview">
      <Flex justify="space-between" align="center" className="overview-heading">
        <div>
          <Text type="secondary" className="eyebrow">RISIKOMANAGEMENT</Text>
          <Title level={2}>Risikoübersicht</Title>
          <Text type="secondary">Alle Risiken aus der zentralen SQLite-Datenbank.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading}>Aktualisieren</Button>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={onCreate}>Risiko erfassen</Button>
        </Space>
      </Flex>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Risiken konnten nicht geladen werden"
          description={error}
          action={<Button size="small" onClick={onReload}>Erneut versuchen</Button>}
        />
      )}

      <div className="overview-summary-grid">
        <Card bordered={false}>
          <Statistic title="Risiken gesamt" value={risks.length} loading={loading} prefix={<AlertOutlined />} />
        </Card>
        <Card bordered={false}>
          <Statistic title="Kritisch" value={risks.filter((risk) => risk.currentScore >= 16).length} loading={loading} valueStyle={{ color: '#e5484d' }} />
        </Card>
        <Card bordered={false}>
          <Statistic title="In Bearbeitung" value={risks.filter((risk) => risk.status === 'In Bearbeitung').length} loading={loading} valueStyle={{ color: '#3980d8' }} />
        </Card>
        <Card bordered={false}>
          <Statistic title="Geschlossen" value={risks.filter((risk) => risk.status === 'Geschlossen').length} loading={loading} valueStyle={{ color: '#269261' }} />
        </Card>
      </div>

      <Card bordered={false} className="overview-table-card">
        <Flex justify="space-between" align="center" gap={12} wrap="wrap" className="overview-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Referenz, Risiko oder Verantwortliche suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="overview-search"
          />
          <Space wrap>
            <Select<RiskStatus>
              allowClear
              placeholder="Status"
              value={status}
              onChange={setStatus}
              options={Object.keys(statusColors).map((value) => ({ value: value as RiskStatus, label: value }))}
              className="overview-filter"
            />
            <Select<string>
              allowClear
              placeholder="Kategorie"
              value={category}
              onChange={setCategory}
              options={categories.map((value) => ({ value, label: value }))}
              className="overview-filter"
            />
          </Space>
        </Flex>

        <Table<Risk>
          rowKey="id"
          columns={columns}
          dataSource={filteredRisks}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: error ? 'Keine Daten verfügbar' : 'Keine Risiken entsprechen den Filtern' }}
          onRow={(risk) => ({
            onClick: () => setSelectedRiskId(risk.id),
            className: 'clickable-risk-row'
          })}
        />
        <Text type="secondary" className="overview-result-count">
          {filteredRisks.length} von {risks.length} Risiken
        </Text>
      </Card>

      <RiskDetailDrawer
        risk={selectedRisk}
        open={selectedRisk !== null}
        onClose={() => setSelectedRiskId(null)}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  )
}
