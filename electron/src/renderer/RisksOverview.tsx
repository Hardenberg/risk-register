import {
  AlertOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Card,
  Flex,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TablePaginationConfig,
  type TableProps
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Risk, RiskStatus, UpdateRiskInput } from './api/risks'
import { usePersistentState } from './persistentState'
import { ResizableColumnTitle, sumColumnWidths, useColumnResize } from './resizableColumns'
import { RiskDetailDrawer } from './RiskDetailDrawer'
import { AppEmptyState, AppErrorState, LoadingStatistic, LoadingText, TableSkeleton } from './uiStates'

const { Text, Title } = Typography

export interface RiskOverviewPreset {
  id: number
  criticalOnly?: boolean
  status?: RiskStatus
}

interface RisksOverviewProps {
  risks: Risk[]
  loading: boolean
  error: string | null
  preset?: RiskOverviewPreset
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

const riskTableStorageKey = 'risk-register:risks-overview:table-state:v1'
const riskColumnDefaults = {
  reference: 110,
  title: 360,
  owner: 230,
  currentScore: 170,
  status: 150,
  dueDate: 145,
  reviewDate: 155,
  actions: 56
}

type TableSortOrder = 'ascend' | 'descend'
type RiskColumnKey = keyof typeof riskColumnDefaults
type RiskSortField = Exclude<RiskColumnKey, 'actions'>

interface RisksTableState {
  search: string
  status?: RiskStatus
  category?: string
  criticalOnly: boolean
  page: number
  pageSize: number
  sortField?: RiskSortField
  sortOrder?: TableSortOrder
  columnWidths: Partial<Record<RiskColumnKey, number>>
}

const initialRisksTableState: RisksTableState = {
  search: '',
  criticalOnly: false,
  page: 1,
  pageSize: 10,
  sortField: 'currentScore',
  sortOrder: 'descend',
  columnWidths: riskColumnDefaults
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

/** Kürzt lange Beschreibungen für die kompakte Tabellenzeile. */
function summarizeDescription (description: string): string {
  return description.length > 96 ? `${description.slice(0, 93)}...` : description
}

function getSingleFilterValue<T extends string> (value: unknown): T | undefined {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] as T : undefined
}

/** Rendert die filter- und sortierbare Gesamtübersicht der vom Server geladenen Risiken. */
export function RisksOverview ({
  risks,
  loading,
  error,
  preset,
  onReload,
  onCreate,
  onUpdate,
  onDelete
}: RisksOverviewProps): React.JSX.Element {
  const [tableState, setTableState] = usePersistentState(riskTableStorageKey, initialRisksTableState)
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null)
  const columnWidths = useMemo(
    () => ({ ...riskColumnDefaults, ...tableState.columnWidths }),
    [tableState.columnWidths]
  )
  const updateTableState = useCallback((patch: Partial<RisksTableState>): void => {
    setTableState((current) => ({ ...current, ...patch }))
  }, [setTableState])
  const setColumnWidth = useCallback((column: RiskColumnKey, width: number): void => {
    setTableState((current) => ({
      ...current,
      columnWidths: { ...current.columnWidths, [column]: width }
    }))
  }, [setTableState])
  const startColumnResize = useColumnResize(columnWidths, setColumnWidth)
  const renderColumnTitle = useCallback((column: RiskColumnKey, label: string): React.JSX.Element => (
    <ResizableColumnTitle label={label} onResizeStart={(event) => startColumnResize(column, event)} />
  ), [startColumnResize])

  useEffect(() => {
    if (!preset) return
    setTableState((current) => ({
      ...current,
      search: '',
      status: preset.status,
      category: undefined,
      criticalOnly: Boolean(preset.criticalOnly),
      page: 1
    }))
  }, [preset, setTableState])

  const categories = useMemo(() => [...new Set(risks.map((risk) => risk.category))].sort(), [risks])
  const selectedRisk = useMemo(
    () => risks.find((risk) => risk.id === selectedRiskId) ?? null,
    [risks, selectedRiskId]
  )
  const filteredRisks = useMemo(() => {
    const term = tableState.search.trim().toLocaleLowerCase('de')
    return risks.filter((risk) => {
      const matchesSearch = !term || [risk.reference, risk.title, risk.description, risk.owner, risk.category]
        .some((value) => value.toLocaleLowerCase('de').includes(term))
      const matchesCritical = !tableState.criticalOnly || risk.currentScore >= 16
      return matchesSearch &&
        matchesCritical &&
        (!tableState.status || risk.status === tableState.status) &&
        (!tableState.category || risk.category === tableState.category)
    })
  }, [risks, tableState.category, tableState.criticalOnly, tableState.search, tableState.status])

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filteredRisks.length / tableState.pageSize))
    if (tableState.page > lastPage) updateTableState({ page: lastPage })
  }, [filteredRisks.length, tableState.page, tableState.pageSize, updateTableState])

  const resetFilters = (): void => {
    updateTableState({
      search: '',
      status: undefined,
      category: undefined,
      criticalOnly: false,
      page: 1
    })
  }

  const handleTableChange: TableProps<Risk>['onChange'] = (pagination, filters, sorter) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
    const sortOrder = activeSorter?.order === 'ascend' || activeSorter?.order === 'descend'
      ? activeSorter.order
      : undefined
    const sortField = sortOrder && typeof activeSorter?.field === 'string'
      ? activeSorter.field as RiskSortField
      : undefined
    const filteredStatus = getSingleFilterValue<RiskStatus>(filters.status)

    updateTableState({
      page: pagination.current ?? tableState.page,
      pageSize: pagination.pageSize ?? tableState.pageSize,
      status: filteredStatus,
      sortField,
      sortOrder
    })
  }

  const hasActiveFilters = tableState.search.trim().length > 0 ||
    Boolean(tableState.status) ||
    Boolean(tableState.category) ||
    tableState.criticalOnly
  const pagination: TablePaginationConfig = {
    current: tableState.page,
    pageSize: tableState.pageSize,
    showSizeChanger: false
  }

  const columns: TableProps<Risk>['columns'] = [
    {
      title: renderColumnTitle('reference', 'REFERENZ'),
      dataIndex: 'reference',
      key: 'reference',
      width: columnWidths.reference,
      sorter: (left, right) => left.reference.localeCompare(right.reference),
      sortOrder: tableState.sortField === 'reference' ? tableState.sortOrder : null,
      render: (reference: string) => <Text code>{reference}</Text>
    },
    {
      title: renderColumnTitle('title', 'RISIKO'),
      dataIndex: 'title',
      key: 'title',
      width: columnWidths.title,
      sorter: (left, right) => left.title.localeCompare(right.title, 'de'),
      sortOrder: tableState.sortField === 'title' ? tableState.sortOrder : null,
      render: (title: string, risk) => (
        <div>
          <Text strong>{title}</Text>
          <div><Text type="secondary" className="subline">{risk.category} · {summarizeDescription(risk.description)}</Text></div>
        </div>
      )
    },
    {
      title: renderColumnTitle('owner', 'VERANTWORTLICH'),
      dataIndex: 'owner',
      key: 'owner',
      width: columnWidths.owner,
      sorter: (left, right) => left.owner.localeCompare(right.owner, 'de'),
      sortOrder: tableState.sortField === 'owner' ? tableState.sortOrder : null,
      render: (owner: string) => (
        <Space size={8}>
          <Avatar size={28} icon={<UserOutlined />} className="owner-avatar" />
          <Text>{owner}</Text>
        </Space>
      )
    },
    {
      title: renderColumnTitle('currentScore', 'RISIKOWERT'),
      dataIndex: 'currentScore',
      key: 'currentScore',
      width: columnWidths.currentScore,
      sorter: (left, right) => left.currentScore - right.currentScore,
      sortOrder: tableState.sortField === 'currentScore' ? tableState.sortOrder : null,
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
      title: renderColumnTitle('status', 'STATUS'),
      dataIndex: 'status',
      key: 'status',
      width: columnWidths.status,
      filters: Object.keys(statusColors).map((value) => ({ text: value, value })),
      filteredValue: tableState.status ? [tableState.status] : null,
      onFilter: (value, risk) => risk.status === value,
      sorter: (left, right) => left.status.localeCompare(right.status, 'de'),
      sortOrder: tableState.sortField === 'status' ? tableState.sortOrder : null,
      render: (value: RiskStatus) => <Tag color={statusColors[value]}>{value}</Tag>
    },
    {
      title: renderColumnTitle('dueDate', 'FÄLLIG'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: columnWidths.dueDate,
      sorter: (left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''),
      sortOrder: tableState.sortField === 'dueDate' ? tableState.sortOrder : null,
      render: (value: string | null) => <Text type="secondary">{formatDate(value)}</Text>
    },
    {
      title: renderColumnTitle('reviewDate', 'REVIEW'),
      dataIndex: 'reviewDate',
      key: 'reviewDate',
      width: columnWidths.reviewDate,
      sorter: (left, right) => (left.reviewDate ?? '').localeCompare(right.reviewDate ?? ''),
      sortOrder: tableState.sortField === 'reviewDate' ? tableState.sortOrder : null,
      render: (value: string | null, risk) => (
        <div>
          <Text type="secondary">{formatDate(value)}</Text>
          <div><Text type="secondary" className="subline">{risk.reviewCycle}</Text></div>
        </div>
      )
    },
    {
      key: 'actions',
      width: columnWidths.actions,
      render: (_, risk) => (
        <Button
          type="text"
          shape="circle"
          icon={<MoreOutlined />}
          aria-label="Weitere Aktionen"
          onClick={(event) => {
            event.stopPropagation()
            setSelectedRiskId(risk.id)
          }}
        />
      )
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
        <AppErrorState title="Risiken konnten nicht geladen werden" description={error} onRetry={onReload} />
      )}

      <div className="overview-summary-grid">
        <Card bordered={false}>
          <LoadingStatistic title="Risiken gesamt" value={risks.length} loading={loading} prefix={<AlertOutlined />} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Kritisch" value={risks.filter((risk) => risk.currentScore >= 16).length} loading={loading} valueStyle={{ color: '#e5484d' }} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="In Bearbeitung" value={risks.filter((risk) => risk.status === 'In Bearbeitung').length} loading={loading} valueStyle={{ color: '#3980d8' }} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Geschlossen" value={risks.filter((risk) => risk.status === 'Geschlossen').length} loading={loading} valueStyle={{ color: '#269261' }} />
        </Card>
      </div>

      <Card bordered={false} className="overview-table-card">
        <Flex justify="space-between" align="center" gap={12} wrap="wrap" className="overview-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Referenz, Risiko oder Verantwortliche suchen"
            value={tableState.search}
            onChange={(event) => updateTableState({ search: event.target.value, page: 1 })}
            className="overview-search"
          />
          <Space wrap>
            {tableState.criticalOnly && (
              <Tag
                color="error"
                closable
                onClose={(event) => {
                  event.preventDefault()
                  updateTableState({ criticalOnly: false, page: 1 })
                }}
              >
                Kritisch
              </Tag>
            )}
            <Select<RiskStatus>
              allowClear
              placeholder="Status"
              value={tableState.status}
              onChange={(value) => updateTableState({ status: value, page: 1 })}
              options={Object.keys(statusColors).map((value) => ({ value: value as RiskStatus, label: value }))}
              className="overview-filter"
            />
            <Select<string>
              allowClear
              placeholder="Kategorie"
              value={tableState.category}
              onChange={(value) => updateTableState({ category: value, page: 1 })}
              options={categories.map((value) => ({ value, label: value }))}
              className="overview-filter"
            />
            {hasActiveFilters && (
              <Button onClick={resetFilters}>Zurücksetzen</Button>
            )}
          </Space>
        </Flex>

        {loading && risks.length === 0 ? (
          <TableSkeleton />
        ) : (
          <Table<Risk>
            rowKey="id"
            columns={columns}
            dataSource={filteredRisks}
            loading={loading}
            pagination={pagination}
            scroll={{ x: sumColumnWidths(columnWidths) }}
            locale={{
              emptyText: error
                ? <AppEmptyState title="Keine Daten verfügbar" description="Prüfe die Verbindung und lade die Ansicht erneut." />
                : <AppEmptyState title="Keine Risiken gefunden" description={hasActiveFilters ? 'Keine Risiken entsprechen den aktuellen Filtern.' : 'Erfasse das erste Risiko, um die Übersicht zu füllen.'} />
            }}
            onChange={handleTableChange}
            onRow={(risk) => ({
              onClick: () => setSelectedRiskId(risk.id),
              className: 'clickable-risk-row'
            })}
          />
        )}
        <Text type="secondary" className="overview-result-count">
          <LoadingText loading={loading}>{filteredRisks.length} von {risks.length} Risiken</LoadingText>
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
