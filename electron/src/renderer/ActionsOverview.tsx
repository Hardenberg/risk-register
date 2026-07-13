import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  type TablePaginationConfig,
  type TableProps
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { CreateMeasureInput, Measure, MeasurePriority, MeasureStatus, UpdateMeasureInput } from './api/measures'
import type { Risk } from './api/risks'
import { datePickerDisplayFormat, getDatePickerValue, normalizeDatePickerValue } from './datePickerFields'
import { usePersistentState } from './persistentState'
import { ResizableColumnTitle, sumColumnWidths, useColumnResize } from './resizableColumns'
import {
  confirmDiscardChanges,
  createFormSnapshot,
  hasUnsavedFormChanges,
  type FormSnapshot
} from './unsavedChanges'
import { AppEmptyState, AppErrorState, LoadingStatistic, LoadingText, TableSkeleton } from './uiStates'

const { Text, Title } = Typography

type DisplayMeasureStatus = MeasureStatus | 'Überfällig'
type RiskFilter = string | '__without_risk__'
export type MeasureOverviewPresetKind = 'open' | 'overdue' | 'due-week'

export interface MeasureOverviewPreset {
  id: number
  kind: MeasureOverviewPresetKind
}

interface MeasureFormValues {
  riskId?: string
  title: string
  description: string
  owner: string
  dueDate?: string
  priority: MeasurePriority
  status: MeasureStatus
}

interface ActionsOverviewProps {
  measures: Measure[]
  risks: Risk[]
  loading: boolean
  error: string | null
  preset?: MeasureOverviewPreset
  onReload: () => void
  onCreate: (input: CreateMeasureInput) => Promise<void>
  onUpdate: (id: string, input: UpdateMeasureInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const priorityColors: Record<MeasurePriority, string> = {
  Kritisch: 'red',
  Hoch: 'orange',
  Normal: 'blue'
}

const statusColors: Record<DisplayMeasureStatus, string> = {
  Offen: 'gold',
  'In Arbeit': 'blue',
  Erledigt: 'green',
  Überfällig: 'red'
}

const priorityOptions: Array<{ value: MeasurePriority, label: MeasurePriority }> = [
  { value: 'Kritisch', label: 'Kritisch' },
  { value: 'Hoch', label: 'Hoch' },
  { value: 'Normal', label: 'Normal' }
]

const statusOptions: Array<{ value: MeasureStatus, label: MeasureStatus }> = [
  { value: 'Offen', label: 'Offen' },
  { value: 'In Arbeit', label: 'In Arbeit' },
  { value: 'Erledigt', label: 'Erledigt' }
]

const displayStatusOptions: Array<{ value: DisplayMeasureStatus, label: DisplayMeasureStatus }> = [
  { value: 'Offen', label: 'Offen' },
  { value: 'In Arbeit', label: 'In Arbeit' },
  { value: 'Erledigt', label: 'Erledigt' },
  { value: 'Überfällig', label: 'Überfällig' }
]

const measureTableStorageKey = 'risk-register:actions-overview:table-state:v1'
const measureColumnDefaults = {
  title: 350,
  riskId: 260,
  owner: 190,
  priority: 130,
  status: 140,
  dueDate: 145,
  actions: 56
}

type TableSortOrder = 'ascend' | 'descend'
type MeasureColumnKey = keyof typeof measureColumnDefaults
type MeasureSortField = Exclude<MeasureColumnKey, 'actions'>

interface MeasuresTableState {
  search: string
  statusFilter?: DisplayMeasureStatus
  priorityFilter?: MeasurePriority
  riskFilter?: RiskFilter
  quickFilter?: MeasureOverviewPresetKind
  page: number
  pageSize: number
  sortField?: MeasureSortField
  sortOrder?: TableSortOrder
  columnWidths: Partial<Record<MeasureColumnKey, number>>
}

const initialMeasuresTableState: MeasuresTableState = {
  search: '',
  page: 1,
  pageSize: 10,
  columnWidths: measureColumnDefaults
}

const newMeasureInitialValues: Partial<MeasureFormValues> = {
  priority: 'Normal',
  status: 'Offen'
}

export function isMeasureOpen (measure: Measure): boolean {
  return measure.status !== 'Erledigt'
}

export function ActionsOverview ({
  measures,
  risks,
  loading,
  error,
  preset,
  onReload,
  onCreate,
  onUpdate,
  onDelete
}: ActionsOverviewProps): React.JSX.Element {
  const { modal } = App.useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMeasureId, setSelectedMeasureId] = useState<string | null>(null)
  const [editingMeasureId, setEditingMeasureId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [measureFormSnapshot, setMeasureFormSnapshot] = useState<FormSnapshot | null>(null)
  const [tableState, setTableState] = usePersistentState(measureTableStorageKey, initialMeasuresTableState)
  const [form] = Form.useForm<MeasureFormValues>()
  const columnWidths = useMemo(
    () => ({ ...measureColumnDefaults, ...tableState.columnWidths }),
    [tableState.columnWidths]
  )
  const updateTableState = useCallback((patch: Partial<MeasuresTableState>): void => {
    setTableState((current) => ({ ...current, ...patch }))
  }, [setTableState])
  const setColumnWidth = useCallback((column: MeasureColumnKey, width: number): void => {
    setTableState((current) => ({
      ...current,
      columnWidths: { ...current.columnWidths, [column]: width }
    }))
  }, [setTableState])
  const startColumnResize = useColumnResize(columnWidths, setColumnWidth)
  const renderColumnTitle = useCallback((column: MeasureColumnKey, label: string): React.JSX.Element => (
    <ResizableColumnTitle label={label} onResizeStart={(event) => startColumnResize(column, event)} />
  ), [startColumnResize])

  useEffect(() => {
    if (!preset) return
    setTableState((current) => ({
      ...current,
      search: '',
      statusFilter: undefined,
      priorityFilter: undefined,
      riskFilter: undefined,
      quickFilter: preset.kind,
      page: 1
    }))
  }, [preset, setTableState])

  const riskById = useMemo(() => new Map(risks.map((risk) => [risk.id, risk])), [risks])
  const riskOptions = useMemo(
    () => risks.map((risk) => ({ value: risk.id, label: `${risk.reference} · ${risk.title}` })),
    [risks]
  )
  const riskFilterOptions = useMemo(
    () => [{ value: '__without_risk__' as const, label: 'Ohne Risiko' }, ...riskOptions],
    [riskOptions]
  )
  const selectedMeasure = useMemo(
    () => measures.find((measure) => measure.id === selectedMeasureId) ?? null,
    [measures, selectedMeasureId]
  )
  const editingMeasure = useMemo(
    () => measures.find((measure) => measure.id === editingMeasureId) ?? null,
    [editingMeasureId, measures]
  )
  const filteredMeasures = useMemo(() => {
    const term = tableState.search.trim().toLocaleLowerCase('de')
    return measures.filter((measure) => {
      const risk = measure.riskId ? riskById.get(measure.riskId) : undefined
      const displayStatus = getDisplayStatus(measure)
      const matchesSearch = !term || [
        measure.title,
        measure.description,
        measure.owner,
        measure.priority,
        measure.status,
        displayStatus,
        measure.dueDate ?? '',
        risk?.reference ?? '',
        risk?.title ?? '',
        risk ? '' : 'Ohne Risiko'
      ].some((value) => value.toLocaleLowerCase('de').includes(term))
      const matchesStatus = !tableState.statusFilter || displayStatus === tableState.statusFilter
      const matchesPriority = !tableState.priorityFilter || measure.priority === tableState.priorityFilter
      const matchesRisk = !tableState.riskFilter ||
        (tableState.riskFilter === '__without_risk__' ? !measure.riskId : measure.riskId === tableState.riskFilter)
      const matchesQuick = matchesQuickFilter(measure, tableState.quickFilter)
      return matchesSearch && matchesQuick && matchesStatus && matchesPriority && matchesRisk
    })
  }, [
    measures,
    riskById,
    tableState.priorityFilter,
    tableState.quickFilter,
    tableState.riskFilter,
    tableState.search,
    tableState.statusFilter
  ])

  const openMeasures = measures.filter(isMeasureOpen)
  const overdueMeasures = measures.filter((measure) => isMeasureOpen(measure) && isOverdue(measure.dueDate))
  const criticalMeasures = measures.filter((measure) => measure.priority === 'Kritisch')
  const completion = measures.length === 0
    ? 0
    : Math.round((measures.length - openMeasures.length) / measures.length * 100)
  const hasActiveFilters = tableState.search.trim().length > 0 ||
    Boolean(tableState.statusFilter) ||
    Boolean(tableState.priorityFilter) ||
    Boolean(tableState.riskFilter) ||
    Boolean(tableState.quickFilter)

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filteredMeasures.length / tableState.pageSize))
    if (tableState.page > lastPage) updateTableState({ page: lastPage })
  }, [filteredMeasures.length, tableState.page, tableState.pageSize, updateTableState])

  const resetFilters = (): void => {
    updateTableState({
      search: '',
      statusFilter: undefined,
      priorityFilter: undefined,
      riskFilter: undefined,
      quickFilter: undefined,
      page: 1
    })
  }

  const handleTableChange: TableProps<Measure>['onChange'] = (pagination, filters, sorter) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
    const sortOrder = activeSorter?.order === 'ascend' || activeSorter?.order === 'descend'
      ? activeSorter.order
      : undefined
    const sortField = sortOrder && typeof activeSorter?.field === 'string'
      ? activeSorter.field as MeasureSortField
      : undefined

    updateTableState({
      page: pagination.current ?? tableState.page,
      pageSize: pagination.pageSize ?? tableState.pageSize,
      statusFilter: getSingleFilterValue<DisplayMeasureStatus>(filters.status),
      priorityFilter: getSingleFilterValue<MeasurePriority>(filters.priority),
      sortField,
      sortOrder
    })
  }

  const pagination: TablePaginationConfig = {
    current: tableState.page,
    pageSize: tableState.pageSize,
    showSizeChanger: false
  }

  const columns: TableProps<Measure>['columns'] = [
    {
      title: renderColumnTitle('title', 'MASSNAHME'),
      dataIndex: 'title',
      key: 'title',
      width: columnWidths.title,
      sorter: (left, right) => left.title.localeCompare(right.title, 'de'),
      sortOrder: tableState.sortField === 'title' ? tableState.sortOrder : null,
      render: (title: string, measure) => (
        <div>
          <Text strong>{title}</Text>
          <div><Text type="secondary" className="subline">{summarizeDescription(measure.description)}</Text></div>
        </div>
      )
    },
    {
      title: renderColumnTitle('riskId', 'RISIKO'),
      dataIndex: 'riskId',
      key: 'riskId',
      width: columnWidths.riskId,
      sorter: (left, right) => formatRisk(left.riskId, riskById).localeCompare(formatRisk(right.riskId, riskById), 'de'),
      sortOrder: tableState.sortField === 'riskId' ? tableState.sortOrder : null,
      render: (riskId: string | null) => {
        const risk = riskId ? riskById.get(riskId) : undefined
        return risk ? (
          <div>
            <Text code>{risk.reference}</Text>
            <div><Text type="secondary" className="subline">{risk.title}</Text></div>
          </div>
        ) : <Text type="secondary">Ohne Risiko</Text>
      }
    },
    {
      title: renderColumnTitle('owner', 'VERANTWORTLICH'),
      dataIndex: 'owner',
      key: 'owner',
      width: columnWidths.owner,
      sorter: (left, right) => left.owner.localeCompare(right.owner, 'de'),
      sortOrder: tableState.sortField === 'owner' ? tableState.sortOrder : null
    },
    {
      title: renderColumnTitle('priority', 'PRIORITÄT'),
      dataIndex: 'priority',
      key: 'priority',
      width: columnWidths.priority,
      filters: priorityOptions.map((option) => ({ text: option.label, value: option.value })),
      filteredValue: tableState.priorityFilter ? [tableState.priorityFilter] : null,
      onFilter: (value, measure) => measure.priority === value,
      sorter: (left, right) => priorityRank(left.priority) - priorityRank(right.priority),
      sortOrder: tableState.sortField === 'priority' ? tableState.sortOrder : null,
      render: (priority: MeasurePriority) => <Tag color={priorityColors[priority]}>{priority}</Tag>
    },
    {
      title: renderColumnTitle('status', 'STATUS'),
      dataIndex: 'status',
      key: 'status',
      width: columnWidths.status,
      filters: Object.keys(statusColors).map((value) => ({ text: value, value })),
      filteredValue: tableState.statusFilter ? [tableState.statusFilter] : null,
      onFilter: (value, measure) => getDisplayStatus(measure) === value,
      sorter: (left, right) => statusRank(getDisplayStatus(left)) - statusRank(getDisplayStatus(right)),
      sortOrder: tableState.sortField === 'status' ? tableState.sortOrder : null,
      render: (_, measure) => {
        const status = getDisplayStatus(measure)
        return <Tag color={statusColors[status]}>{status}</Tag>
      }
    },
    {
      title: renderColumnTitle('dueDate', 'FÄLLIG'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: columnWidths.dueDate,
      sorter: (left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''),
      sortOrder: tableState.sortField === 'dueDate' ? tableState.sortOrder : null,
      render: (date: string | null) => <Text type="secondary">{formatDate(date)}</Text>
    },
    {
      key: 'actions',
      width: columnWidths.actions,
      render: (_, measure) => (
        <Tooltip title="Details ansehen">
          <Button
            type="text"
            shape="circle"
            icon={<EyeOutlined />}
            aria-label="Maßnahme ansehen"
            onClick={(event) => {
              event.stopPropagation()
              setSelectedMeasureId(measure.id)
            }}
          />
        </Tooltip>
      )
    }
  ]

  const openCreateModal = (): void => {
    setEditingMeasureId(null)
    form.resetFields()
    form.setFieldsValue(newMeasureInitialValues)
    setMeasureFormSnapshot(createFormSnapshot(newMeasureInitialValues))
    setModalOpen(true)
  }

  const openEditModal = (measure: Measure): void => {
    setEditingMeasureId(measure.id)
    const values: MeasureFormValues = {
      riskId: measure.riskId ?? undefined,
      title: measure.title,
      description: measure.description,
      owner: measure.owner,
      dueDate: measure.dueDate ?? undefined,
      priority: measure.priority,
      status: measure.status
    }
    form.setFieldsValue(values)
    setMeasureFormSnapshot(createFormSnapshot(values))
    setModalOpen(true)
  }

  const discardMeasureModal = (): void => {
    setModalOpen(false)
    setEditingMeasureId(null)
    setMeasureFormSnapshot(null)
    form.resetFields()
  }

  const closeMeasureModal = (): void => {
    confirmDiscardChanges(
      modal,
      hasUnsavedFormChanges(form, measureFormSnapshot),
      discardMeasureModal
    )
  }

  const submitMeasure = async (): Promise<void> => {
    const values = await form.validateFields()
    const payload = toPayload(values)
    setSaving(true)
    try {
      if (editingMeasureId) {
        await onUpdate(editingMeasureId, payload)
      } else {
        await onCreate(payload)
      }
      setModalOpen(false)
      setEditingMeasureId(null)
      setMeasureFormSnapshot(null)
      form.resetFields()
    } catch {
      // Die App-Ebene zeigt die normalisierte API-Fehlermeldung an.
    } finally {
      setSaving(false)
    }
  }

  const removeMeasure = async (measure: Measure): Promise<void> => {
    setDeleting(true)
    try {
      await onDelete(measure.id)
      setSelectedMeasureId(null)
      if (editingMeasureId === measure.id) {
        setModalOpen(false)
        setEditingMeasureId(null)
        setMeasureFormSnapshot(null)
      }
    } catch {
      // Bei Fehler bleibt der Drawer offen, damit der Nutzer erneut handeln kann.
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="actions-overview">
      <Flex justify="space-between" align="center" className="overview-heading" gap={16} wrap="wrap">
        <div>
          <Text type="secondary" className="eyebrow">RISIKOSTEUERUNG</Text>
          <Title level={2}>Maßnahmen</Title>
          <Text type="secondary">Gespeicherte Maßnahmen mit Verantwortlichkeit, Status und Fälligkeit.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading}>Aktualisieren</Button>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreateModal}>Maßnahme anlegen</Button>
        </Space>
      </Flex>

      {error && (
        <AppErrorState title="Maßnahmen konnten nicht geladen werden" description={error} onRetry={onReload} />
      )}

      <div className="overview-summary-grid">
        <Card bordered={false}>
          <LoadingStatistic title="Offene Maßnahmen" value={openMeasures.length} loading={loading} prefix={<ClockCircleOutlined />} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Überfällig" value={overdueMeasures.length} loading={loading} valueStyle={{ color: '#e5484d' }} prefix={<ExclamationCircleOutlined />} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Kritisch priorisiert" value={criticalMeasures.length} loading={loading} valueStyle={{ color: '#e5484d' }} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Erledigungsgrad" value={completion} suffix="%" loading={loading} prefix={<CheckCircleOutlined />} />
        </Card>
      </div>

      <Card bordered={false} className="overview-table-card">
        <Flex justify="space-between" align="center" gap={12} wrap="wrap" className="overview-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Maßnahmen durchsuchen"
            value={tableState.search}
            onChange={(event) => updateTableState({ search: event.target.value, page: 1 })}
            className="overview-search"
          />
          <Space wrap>
            {tableState.quickFilter && (
              <Tag
                color="blue"
                closable
                onClose={(event) => {
                  event.preventDefault()
                  updateTableState({ quickFilter: undefined, page: 1 })
                }}
              >
                {getQuickFilterLabel(tableState.quickFilter)}
              </Tag>
            )}
            <Select<DisplayMeasureStatus>
              allowClear
              placeholder="Status"
              value={tableState.statusFilter}
              onChange={(value) => updateTableState({ statusFilter: value, page: 1 })}
              options={displayStatusOptions}
              className="overview-filter"
            />
            <Select<MeasurePriority>
              allowClear
              placeholder="Priorität"
              value={tableState.priorityFilter}
              onChange={(value) => updateTableState({ priorityFilter: value, page: 1 })}
              options={priorityOptions}
              className="overview-filter"
            />
            <Select<RiskFilter>
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Risiko"
              value={tableState.riskFilter}
              onChange={(value) => updateTableState({ riskFilter: value, page: 1 })}
              options={riskFilterOptions}
              className="overview-filter"
            />
            {hasActiveFilters && (
              <Button onClick={resetFilters}>
                Zurücksetzen
              </Button>
            )}
          </Space>
        </Flex>
        <div className="actions-progress">
          <Flex justify="space-between" align="center">
            <Text strong>Maßnahmenfortschritt</Text>
            <LoadingText loading={loading}><Text type="secondary">{completion}%</Text></LoadingText>
          </Flex>
          <Progress percent={loading ? 0 : completion} showInfo={false} strokeColor="#35a56f" trailColor="#ececf3" />
        </div>
        {loading && measures.length === 0 ? (
          <TableSkeleton />
        ) : (
          <Table<Measure>
            rowKey="id"
            columns={columns}
            dataSource={filteredMeasures}
            loading={loading}
            pagination={pagination}
            scroll={{ x: sumColumnWidths(columnWidths) }}
            locale={{
              emptyText: error
                ? <AppEmptyState title="Keine Daten verfügbar" description="Prüfe die Verbindung und lade die Ansicht erneut." />
                : <AppEmptyState title="Keine Maßnahmen gefunden" description={hasActiveFilters ? 'Keine Maßnahmen entsprechen den aktuellen Filtern.' : 'Lege die erste Maßnahme an, um die Steuerung zu starten.'} />
            }}
            onChange={handleTableChange}
            onRow={(measure) => ({
              onClick: () => setSelectedMeasureId(measure.id),
              className: 'clickable-risk-row'
            })}
          />
        )}
        <Text type="secondary" className="overview-result-count">
          <LoadingText loading={loading}>{filteredMeasures.length} von {measures.length} Maßnahmen</LoadingText>
        </Text>
      </Card>

      {selectedMeasure && (
        <Drawer
          title={<Space><Tag color={statusColors[getDisplayStatus(selectedMeasure)]}>{getDisplayStatus(selectedMeasure)}</Tag><span>Maßnahme ansehen</span></Space>}
          open={selectedMeasure !== null}
          onClose={() => setSelectedMeasureId(null)}
          width={520}
          destroyOnHidden
          extra={(
            <Space>
              <Button icon={<EditOutlined />} onClick={() => openEditModal(selectedMeasure)}>Bearbeiten</Button>
              <Popconfirm
                title="Maßnahme löschen?"
                description={selectedMeasure.title}
                icon={<ExclamationCircleOutlined style={{ color: '#e5484d' }} />}
                okText="Löschen"
                cancelText="Abbrechen"
                okButtonProps={{ danger: true, loading: deleting }}
                onConfirm={() => { void removeMeasure(selectedMeasure) }}
              >
                <Button danger icon={<DeleteOutlined />}>Löschen</Button>
              </Popconfirm>
            </Space>
          )}
        >
          <Descriptions
            column={1}
            bordered
            size="small"
            items={[
              { key: 'title', label: 'Maßnahme', children: selectedMeasure.title },
              { key: 'description', label: 'Beschreibung', children: selectedMeasure.description },
              { key: 'risk', label: 'Risiko', children: formatRisk(selectedMeasure.riskId, riskById) },
              { key: 'owner', label: 'Verantwortlich', children: selectedMeasure.owner },
              { key: 'priority', label: 'Priorität', children: <Tag color={priorityColors[selectedMeasure.priority]}>{selectedMeasure.priority}</Tag> },
              { key: 'status', label: 'Status', children: <Tag color={statusColors[getDisplayStatus(selectedMeasure)]}>{getDisplayStatus(selectedMeasure)}</Tag> },
              { key: 'dueDate', label: 'Fällig', children: formatDate(selectedMeasure.dueDate) },
              { key: 'createdAt', label: 'Erfasst', children: formatTimestamp(selectedMeasure.createdAt) },
              { key: 'updatedAt', label: 'Geändert', children: formatTimestamp(selectedMeasure.updatedAt) }
            ]}
          />
        </Drawer>
      )}

      <Modal
        title={editingMeasure ? 'Maßnahme bearbeiten' : 'Maßnahme anlegen'}
        open={modalOpen}
        onCancel={closeMeasureModal}
        onOk={() => { void submitMeasure() }}
        okText={editingMeasure ? 'Speichern' : 'Anlegen'}
        cancelText="Abbrechen"
        confirmLoading={saving}
        destroyOnHidden
        width={640}
        className="risk-edit-modal"
      >
        <Form form={form} layout="vertical" className="risk-form risk-edit-form" requiredMark={false}>
          <Form.Item name="riskId" label="Risiko">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Optionales Risiko auswählen"
              options={riskOptions}
            />
          </Form.Item>
          <Form.Item name="title" label="Titel" rules={[{ required: true, message: 'Bitte einen Titel eingeben.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="Beschreibung" rules={[{ required: true, message: 'Bitte eine Beschreibung eingeben.' }]}>
            <Input.TextArea maxLength={2000} rows={4} />
          </Form.Item>
          <div className="risk-edit-grid">
            <Form.Item name="owner" label="Verantwortlich" rules={[{ required: true, message: 'Bitte eine verantwortliche Person eingeben.' }]}>
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item
              name="dueDate"
              label="Fälligkeitsdatum"
              getValueProps={(value: string | undefined) => ({ value: getDatePickerValue(value) })}
              normalize={normalizeDatePickerValue}
            >
              <DatePicker className="full-width" format={datePickerDisplayFormat} placeholder="Datum auswählen" />
            </Form.Item>
          </div>
          <div className="risk-edit-grid">
            <Form.Item name="priority" label="Priorität" initialValue="Normal" rules={[{ required: true }]}>
              <Select<MeasurePriority> options={priorityOptions} />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="Offen" rules={[{ required: true }]}>
              <Select<MeasureStatus> options={statusOptions} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

function toPayload (values: MeasureFormValues): CreateMeasureInput {
  return {
    riskId: values.riskId || null,
    title: values.title,
    description: values.description,
    owner: values.owner,
    dueDate: values.dueDate || null,
    priority: values.priority,
    status: values.status
  }
}

function getDisplayStatus (measure: Measure): DisplayMeasureStatus {
  if (measure.status !== 'Erledigt' && isOverdue(measure.dueDate)) return 'Überfällig'
  return measure.status
}

function isOverdue (date: string | null): boolean {
  if (!date) return false
  const today = new Date()
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(`${date}T00:00:00`).getTime()
  return target < start
}

function isWithinDays (date: string | null, days: number): boolean {
  if (!date) return false
  const today = new Date()
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(`${date}T00:00:00`).getTime()
  const diff = Math.ceil((target - start) / 86_400_000)
  return diff >= 0 && diff <= days
}

function matchesQuickFilter (measure: Measure, quickFilter: MeasureOverviewPresetKind | undefined): boolean {
  if (!quickFilter) return true
  if (quickFilter === 'open') return isMeasureOpen(measure)
  if (quickFilter === 'overdue') return isMeasureOpen(measure) && isOverdue(measure.dueDate)
  return isMeasureOpen(measure) && isWithinDays(measure.dueDate, 7)
}

function getQuickFilterLabel (quickFilter: MeasureOverviewPresetKind): string {
  if (quickFilter === 'open') return 'Offene Maßnahmen'
  if (quickFilter === 'overdue') return 'Überfällige Maßnahmen'
  return 'Diese Woche fällig'
}

function getSingleFilterValue<T extends string> (value: unknown): T | undefined {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] as T : undefined
}

function priorityRank (priority: MeasurePriority): number {
  if (priority === 'Kritisch') return 0
  if (priority === 'Hoch') return 1
  return 2
}

function statusRank (status: DisplayMeasureStatus): number {
  if (status === 'Überfällig') return 0
  if (status === 'Offen') return 1
  if (status === 'In Arbeit') return 2
  return 3
}

function summarizeDescription (description: string): string {
  return description.length > 96 ? `${description.slice(0, 93)}...` : description
}

function formatRisk (riskId: string | null, riskById: Map<string, Risk>): string {
  if (!riskId) return 'Ohne Risiko'
  const risk = riskById.get(riskId)
  return risk ? `${risk.reference} · ${risk.title}` : 'Nicht gefunden'
}

function formatTimestamp (value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatDate (date: string | null): string {
  if (!date) return 'Nicht geplant'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`))
}
