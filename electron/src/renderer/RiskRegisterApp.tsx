import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckCircleFilled,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DownOutlined,
  FileTextOutlined,
  FilterOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PlusOutlined,
  SafetyCertificateFilled,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  WarningFilled
} from '@ant-design/icons'
import {
  Alert,
  App,
  Avatar,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Dropdown,
  Flex,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  theme,
  Typography,
  type TableProps
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createRisk as createRiskRequest,
  deleteRisk as deleteRiskRequest,
  listRisks,
  updateRisk as updateRiskRequest,
  type Risk,
  type RiskStatus,
  type UpdateRiskInput
} from './api/risks'
import { RisksOverview } from './RisksOverview'

const { Header, Content, Sider } = Layout
const { Text, Title } = Typography

interface NewRisk {
  title: string
  category: string
  owner: string
  score: number
  dueDate?: string
}

type DashboardFilter = 'all' | 'critical' | 'open'

const statusColors: Record<RiskStatus, string> = {
  Offen: 'gold',
  'In Bearbeitung': 'blue',
  Überwacht: 'purple',
  Geschlossen: 'green'
}

/** Liefert Farbe und Bezeichnung für die vier fachlichen Risikostufen. */
function getRiskMeta (score: number): { color: string, label: string } {
  if (score >= 16) return { color: '#e5484d', label: 'Kritisch' }
  if (score >= 10) return { color: '#f59e0b', label: 'Hoch' }
  if (score >= 5) return { color: '#7c6ee6', label: 'Mittel' }
  return { color: '#35a56f', label: 'Niedrig' }
}

/** Formatiert ein ISO-Fälligkeitsdatum oder zeigt einen verständlichen Ersatztext. */
function formatDueDate (date: string | null): string {
  if (!date) return 'Noch nicht geplant'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`))
}

/** Kapselt Zustand, Datenabruf und Interaktionen des Risk-Register-Arbeitsbereichs. */
function RiskRegisterContent (): React.JSX.Element {
  const { message } = App.useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<'overview' | 'risks'>('overview')
  const [search, setSearch] = useState('')
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form] = Form.useForm<NewRisk>()

  /** Synchronisiert den lokalen UI-Zustand mit der Risiko-API. */
  const loadRisks = useCallback(async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      setRisks(await listRisks())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Der Server ist nicht erreichbar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRisks()
  }, [loadRisks])

  const filteredRisks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de')
    return risks.filter((risk) => {
      const matchesSearch = !term || [risk.reference, risk.title, risk.category, risk.owner]
        .some((value) => value.toLocaleLowerCase('de').includes(term))
      const matchesFilter = dashboardFilter === 'all' ||
        (dashboardFilter === 'critical' && risk.currentScore >= 16) ||
        (dashboardFilter === 'open' && risk.status !== 'Geschlossen')
      return matchesSearch && matchesFilter
    })
  }, [dashboardFilter, risks, search])

  const columns: TableProps<Risk>['columns'] = [
    {
      title: 'RISIKO',
      dataIndex: 'title',
      key: 'title',
      width: '34%',
      render: (title: string, risk) => (
        <Flex gap={12} align="center">
          <div className="risk-icon" style={{ background: `${getRiskMeta(risk.currentScore).color}16` }}>
            <WarningFilled style={{ color: getRiskMeta(risk.currentScore).color }} />
          </div>
          <div>
            <Text strong className="risk-title">{title}</Text>
            <div><Text type="secondary" className="subline">{risk.reference} · {risk.category}</Text></div>
          </div>
        </Flex>
      )
    },
    {
      title: 'VERANTWORTLICH',
      dataIndex: 'owner',
      key: 'owner',
      render: (owner: string) => (
        <Space size={8}>
          <Avatar size={28} className="owner-avatar">{owner.split(' ').map((part) => part[0]).join('')}</Avatar>
          <Text>{owner}</Text>
        </Space>
      )
    },
    {
      title: 'RISIKOWERT',
      dataIndex: 'currentScore',
      key: 'currentScore',
      width: 170,
      render: (score: number, risk) => {
        const meta = getRiskMeta(score)
        return (
          <div className="score-cell">
            <Flex justify="space-between" align="center">
              <Text strong style={{ color: meta.color }}>{score}/25</Text>
              <Text type="secondary" className="subline">{meta.label}</Text>
            </Flex>
            <Progress percent={(score / 25) * 100} showInfo={false} strokeColor={meta.color} trailColor="#ececf3" size="small" />
            {risk.initialScore !== score && <Text type="secondary" className="trend">zuvor {risk.initialScore}</Text>}
          </div>
        )
      }
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: (status: RiskStatus) => <Tag color={statusColors[status]}>{status}</Tag>
    },
    {
      title: 'FÄLLIG',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string | null) => <Text type="secondary">{formatDueDate(date)}</Text>
    },
    {
      key: 'actions',
      width: 44,
      render: () => <Button type="text" shape="circle" icon={<MoreOutlined />} aria-label="Weitere Aktionen" />
    }
  ]

  /** Validiert das Erfassungsformular und speichert das neue Risiko über den Server. */
  const submitRisk = async (): Promise<void> => {
    const values = await form.validateFields()
    try {
      const created = await createRiskRequest({
        title: values.title,
        category: values.category,
        owner: values.owner,
        initialScore: values.score,
        dueDate: values.dueDate || null
      })
      setRisks((current) => [created, ...current])
      setModalOpen(false)
      form.resetFields()
      void message.success('Das neue Risiko wurde in SQLite gespeichert.')
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Das Risiko konnte nicht gespeichert werden.')
    }
  }

  /** Persistiert Änderungen und ersetzt anschließend exakt den betroffenen UI-Datensatz. */
  const updateExistingRisk = async (id: string, input: UpdateRiskInput): Promise<void> => {
    try {
      const updated = await updateRiskRequest(id, input)
      setRisks((current) => current.map((risk) => risk.id === id ? updated : risk))
      void message.success(`${updated.reference} wurde aktualisiert.`)
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Das Risiko konnte nicht aktualisiert werden.')
      throw error
    }
  }

  /** Löscht ein Risiko über die API und entfernt es konsistent aus allen Ansichten. */
  const removeExistingRisk = async (id: string): Promise<void> => {
    try {
      const removed = risks.find((risk) => risk.id === id)
      await deleteRiskRequest(id)
      setRisks((current) => current.filter((risk) => risk.id !== id))
      void message.success(`${removed?.reference ?? 'Das Risiko'} wurde gelöscht.`)
    } catch (error) {
      void message.error(error instanceof Error ? error.message : 'Das Risiko konnte nicht gelöscht werden.')
      throw error
    }
  }

  const criticalRiskCount = risks.filter((risk) => risk.currentScore >= 16).length
  const reducedRiskCount = risks.filter((risk) => risk.currentScore < risk.initialScore).length
  const portfolioExposure = risks.length === 0
    ? 0
    : Math.round(risks.reduce((sum, risk) => sum + risk.currentScore, 0) / (risks.length * 25) * 100)

  return (
    <Layout className="app-shell">
      <Sider width={244} collapsedWidth={76} collapsed={collapsed} className="sidebar" trigger={null}>
        <div className={`brand ${collapsed ? 'brand-collapsed' : ''}`}>
          <div className="brand-mark"><SafetyCertificateFilled /></div>
          {!collapsed && <span>risk<span>wise</span></span>}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeView]}
          onClick={({ key }) => {
            if (key === 'overview' || key === 'risks') setActiveView(key)
          }}
          className="nav-menu"
          items={[
            { key: 'overview', icon: <AppstoreOutlined />, label: 'Übersicht' },
            { key: 'risks', icon: <AlertOutlined />, label: 'Risiken' },
            { key: 'actions', icon: <CheckSquareOutlined />, label: 'Maßnahmen' },
            { key: 'reports', icon: <BarChartOutlined />, label: 'Berichte' },
            { type: 'divider' },
            { key: 'team', icon: <TeamOutlined />, label: 'Team' },
            { key: 'settings', icon: <SettingOutlined />, label: 'Einstellungen' }
          ]}
        />

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="risk-health">
              <Flex justify="space-between"><Text>Risk Health</Text><Text strong>72%</Text></Flex>
              <Progress percent={72} showInfo={false} strokeColor="#8b7cf6" trailColor="#30304c" size="small" />
              <Text className="health-copy">+8% seit letztem Monat</Text>
            </div>
          )}
          <Button
            type="text"
            className="collapse-button"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((current) => !current)}
          >
            {!collapsed && 'Navigation einklappen'}
          </Button>
        </div>
      </Sider>

      <Layout>
        <Header className="topbar">
          <div>
            <Text type="secondary" className="eyebrow">ARBEITSBEREICH</Text>
            <Title level={4}>Risk Register</Title>
          </div>
          <Space size={18}>
            <Badge dot offset={[-3, 4]}>
              <Button type="text" shape="circle" icon={<BellOutlined />} className="header-icon" />
            </Badge>
            <div className="header-divider" />
            <Avatar className="profile-avatar">AS</Avatar>
            <div className="profile-copy">
              <Text strong>Alex Schmidt</Text>
              <Text type="secondary">Risk Manager</Text>
            </div>
            <DownOutlined className="profile-chevron" />
          </Space>
        </Header>

        <Content className="content">
          {activeView === 'risks' ? (
            <RisksOverview
              risks={risks}
              loading={loading}
              error={loadError}
              onReload={() => { void loadRisks() }}
              onCreate={() => setModalOpen(true)}
              onUpdate={updateExistingRisk}
              onDelete={removeExistingRisk}
            />
          ) : (
            <>
          <div className="welcome-row">
            <div>
              <Title level={2}>Guten Morgen, Alex.</Title>
              <Text type="secondary">Hier ist der aktuelle Risikoüberblick für dein Portfolio.</Text>
            </div>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Risiko erfassen
            </Button>
          </div>

          {loadError && (
            <Alert
              type="error"
              showIcon
              className="api-alert"
              message="Risiko-Server nicht erreichbar"
              description={loadError}
              action={<Button size="small" onClick={() => { void loadRisks() }}>Erneut versuchen</Button>}
            />
          )}

          <div className="stats-grid">
            <Card className="stat-card critical-card" bordered={false}>
              <Flex justify="space-between" align="start">
                <Statistic title="Kritische Risiken" value={criticalRiskCount} loading={loading} />
                <div className="stat-icon critical"><WarningFilled /></div>
              </Flex>
              <Tag color="error">+1 diese Woche</Tag>
            </Card>
            <Card className="stat-card" bordered={false}>
              <Flex justify="space-between" align="start">
                <Statistic title="Offene Maßnahmen" value={18} />
                <div className="stat-icon action"><CheckSquareOutlined /></div>
              </Flex>
              <Text type="secondary"><ClockCircleOutlined /> 5 werden diese Woche fällig</Text>
            </Card>
            <Card className="stat-card" bordered={false}>
              <Flex justify="space-between" align="start">
                <Statistic title="Risiken gesamt" value={risks.length} loading={loading} />
                <div className="stat-icon total"><FileTextOutlined /></div>
              </Flex>
              <Text className="positive"><CheckCircleFilled /> {reducedRiskCount} Risiken reduziert</Text>
            </Card>
            <Card className="stat-card exposure-card" bordered={false}>
              <Flex justify="space-between" align="center">
                <div>
                  <Text className="exposure-title">Portfolio Exposure</Text>
                  <Title level={3}>Mittel</Title>
                  <Text className="positive">↓ 12% zum Vormonat</Text>
                </div>
                <Progress type="dashboard" percent={portfolioExposure} size={82} strokeWidth={9} strokeColor="#7c6ee6" trailColor="#e9e7fb" format={() => String(portfolioExposure)} />
              </Flex>
            </Card>
          </div>

          <Card className="risk-card" bordered={false}>
            <Flex justify="space-between" align="center" className="table-heading" wrap="wrap" gap={16}>
              <div>
                <Title level={4}>Aktuelle Risiken</Title>
                <Text type="secondary">Nach aktuellem Risikowert priorisiert</Text>
              </div>
              <Space>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Risiken durchsuchen"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="search-input"
                />
                <Dropdown menu={{
                  selectedKeys: [dashboardFilter],
                  onClick: ({ key }) => setDashboardFilter(key as DashboardFilter),
                  items: [
                    { key: 'all', label: 'Alle Risiken' },
                    { key: 'critical', label: 'Nur kritische' },
                    { key: 'open', label: 'Nur offene' }
                  ]
                }}>
                  <Button icon={<FilterOutlined />}>
                    {dashboardFilter === 'all' ? 'Filter' : dashboardFilter === 'critical' ? 'Kritisch' : 'Offen'} <DownOutlined />
                  </Button>
                </Dropdown>
              </Space>
            </Flex>

            <Table<Risk>
              rowKey="id"
              columns={columns}
              dataSource={filteredRisks}
              loading={loading}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              className="risk-table"
              scroll={{ x: 1040 }}
            />

            <Flex justify="space-between" align="center" className="table-footer">
              <Text type="secondary">{filteredRisks.length} von {risks.length} Risiken</Text>
              <Button type="link">Alle Risiken anzeigen →</Button>
            </Flex>
          </Card>
            </>
          )}
        </Content>
      </Layout>

      <Modal
        title="Neues Risiko erfassen"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => { void submitRisk() }}
        okText="Risiko speichern"
        cancelText="Abbrechen"
        destroyOnHidden
      >
        <Text type="secondary">Erfasse die wichtigsten Eckdaten. Details und Maßnahmen können später ergänzt werden.</Text>
        <Form form={form} layout="vertical" className="risk-form" requiredMark={false}>
          <Form.Item name="title" label="Bezeichnung" rules={[{ required: true, message: 'Bitte eine Bezeichnung eingeben.' }]}>
            <Input placeholder="z. B. Ausfall eines Lieferanten" />
          </Form.Item>
          <Form.Item name="category" label="Kategorie" rules={[{ required: true, message: 'Bitte eine Kategorie wählen.' }]}>
            <Select placeholder="Kategorie auswählen" options={[
              { value: 'Technologie', label: 'Technologie' },
              { value: 'Lieferkette', label: 'Lieferkette' },
              { value: 'Compliance', label: 'Compliance' },
              { value: 'Finanzen', label: 'Finanzen' },
              { value: 'Organisation', label: 'Organisation' }
            ]} />
          </Form.Item>
          <Form.Item name="owner" label="Verantwortlich" rules={[{ required: true, message: 'Bitte eine verantwortliche Person angeben.' }]}>
            <Input placeholder="Vor- und Nachname" />
          </Form.Item>
          <Form.Item name="score" label="Initialer Risikowert (1–25)" initialValue={10} rules={[{ required: true }]}>
            <InputNumber min={1} max={25} className="full-width" />
          </Form.Item>
          <Form.Item name="dueDate" label="Fälligkeitsdatum">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

/** Stellt Ant-Design-Theme und App-Kontext für die komplette Electron-Oberfläche bereit. */
export function RiskRegisterApp (): React.JSX.Element {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6658d9',
          colorInfo: '#6658d9',
          colorBgLayout: '#f4f5fa',
          colorText: '#202033',
          borderRadius: 10,
          fontFamily: 'Inter, Segoe UI, system-ui, sans-serif'
        },
        components: {
          Button: { controlHeightLG: 44, fontWeight: 600 },
          Card: { borderRadiusLG: 16 },
          Table: { headerBg: '#fafafd', headerColor: '#77768a', headerBorderRadius: 0 }
        }
      }}
    >
      <App>
        <RiskRegisterContent />
      </App>
    </ConfigProvider>
  )
}
