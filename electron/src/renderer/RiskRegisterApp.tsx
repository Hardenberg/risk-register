import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckCircleFilled,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  FilterOutlined,
  LogoutOutlined,
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
  App,
  Avatar,
  Badge,
  Button,
  Card,
  ConfigProvider,
  DatePicker,
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
  Table,
  Tag,
  theme,
  Typography,
  type TableProps
} from 'antd'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'

import { ActionsOverview, type MeasureOverviewPreset } from './ActionsOverview'
import { clearAuthToken, isAuthenticationRequiredError, readAuthSession } from './api/auth'
import {
  createMeasure as createMeasureRequest,
  deleteMeasure as deleteMeasureRequest,
  listMeasures,
  updateMeasure as updateMeasureRequest,
  type CreateMeasureInput,
  type Measure,
  type UpdateMeasureInput
} from './api/measures'
import {
  createRisk as createRiskRequest,
  deleteRisk as deleteRiskRequest,
  listRisks,
  updateRisk as updateRiskRequest,
  type ReviewCycle,
  type Risk,
  type RiskStatus,
  type UpdateRiskInput
} from './api/risks'
import { updateProfile as updateProfileRequest, type UpdateProfileInput, type User } from './api/users'
import { datePickerDisplayFormat, getDatePickerValue, normalizeDatePickerValue } from './datePickerFields'
import { LoginScreen } from './LoginScreen'
import { ReportsOverview } from './ReportsOverview'
import { RiskDetailDrawer } from './RiskDetailDrawer'
import { calculateReviewDate, reviewCycleOptions } from './riskOptions'
import { RisksOverview, type RiskOverviewPreset } from './RisksOverview'
import { SettingsManagement } from './SettingsManagement'
import {
  confirmDiscardChanges,
  createFormSnapshot,
  hasUnsavedFormChanges,
  type FormSnapshot
} from './unsavedChanges'
import { AppEmptyState, AppErrorState, LoadingStatistic, LoadingText, TableSkeleton } from './uiStates'
import { UsersManagement } from './UsersManagement'

const { Header, Content, Sider } = Layout
const { Text, Title } = Typography

interface NewRisk {
  title: string
  description: string
  category: string
  owner: string
  score: number
  dueDate?: string
  reviewDate?: string
  reviewCycle: ReviewCycle
}

interface ProfileFormValues {
  username: string
  name: string
  email: string
  department: string
  password?: string
}

type DashboardFilter = 'all' | 'critical' | 'open'
type ActiveView = 'overview' | 'risks' | 'actions' | 'reports' | 'team' | 'settings'

const newRiskInitialValues: Partial<NewRisk> = {
  score: 10,
  reviewCycle: 'Fix'
}

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

function getInitials (name: string): string {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')
  return initials.toUpperCase() || 'U'
}

function getFirstName (name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function isWithinDays (date: string, days: number): boolean {
  const today = new Date()
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(`${date}T00:00:00`).getTime()
  const diff = Math.ceil((target - start) / 86_400_000)
  return diff >= 0 && diff <= days
}

function isPastDue (date: string | null): boolean {
  if (!date) return false
  const today = new Date()
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(`${date}T00:00:00`).getTime()
  return target < start
}

function handleDashboardCardKey (event: KeyboardEvent<HTMLElement>, action: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  action()
}

/** Kapselt Zustand, Datenabruf und Interaktionen des Risk-Register-Arbeitsbereichs. */
function RiskRegisterContent (): React.JSX.Element {
  const { message, modal } = App.useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(() => readAuthSession()?.user ?? null)
  const [activeView, setActiveView] = useState<ActiveView>('overview')
  const [search, setSearch] = useState('')
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [measures, setMeasures] = useState<Measure[]>([])
  const [measuresLoading, setMeasuresLoading] = useState(true)
  const [measureError, setMeasureError] = useState<string | null>(null)
  const [form] = Form.useForm<NewRisk>()
  const [profileForm] = Form.useForm<ProfileFormValues>()
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [selectedDashboardRiskId, setSelectedDashboardRiskId] = useState<string | null>(null)
  const [riskOverviewPreset, setRiskOverviewPreset] = useState<RiskOverviewPreset | undefined>()
  const [measureOverviewPreset, setMeasureOverviewPreset] = useState<MeasureOverviewPreset | undefined>()
  const [riskFormSnapshot, setRiskFormSnapshot] = useState<FormSnapshot | null>(null)
  const [profileFormSnapshot, setProfileFormSnapshot] = useState<FormSnapshot | null>(null)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const selectedCreateReviewCycle = Form.useWatch('reviewCycle', form) ?? 'Fix'

  const resetSession = useCallback((showNotice = true): void => {
    clearAuthToken()
    setCurrentUser(null)
    setActiveView('overview')
    setSelectedDashboardRiskId(null)
    setModalOpen(false)
    setProfileModalOpen(false)
    setRiskFormSnapshot(null)
    setProfileFormSnapshot(null)
    setSettingsDirty(false)
    form.resetFields()
    profileForm.resetFields()
    if (showNotice) void message.warning('Bitte erneut anmelden.')
  }, [form, message, profileForm])

  /** Synchronisiert den lokalen UI-Zustand mit der Risiko-API. */
  const loadRisks = useCallback(async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      setRisks(await listRisks())
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setLoadError(null)
        resetSession()
        return
      }
      setLoadError(error instanceof Error ? error.message : 'Der Server ist nicht erreichbar.')
    } finally {
      setLoading(false)
    }
  }, [resetSession])

  const loadMeasures = useCallback(async (): Promise<void> => {
    setMeasuresLoading(true)
    setMeasureError(null)
    try {
      setMeasures(await listMeasures())
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setMeasureError(null)
        resetSession()
        return
      }
      setMeasureError(error instanceof Error ? error.message : 'Der Server ist nicht erreichbar.')
    } finally {
      setMeasuresLoading(false)
    }
  }, [resetSession])

  useEffect(() => {
    if (!currentUser) {
      setRisks([])
      setMeasures([])
      setLoading(false)
      setMeasuresLoading(false)
      setLoadError(null)
      setMeasureError(null)
      return
    }
    void loadRisks()
    void loadMeasures()
  }, [currentUser, loadMeasures, loadRisks])

  const filteredRisks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de')
    return risks.filter((risk) => {
      const matchesSearch = !term || [risk.reference, risk.title, risk.description, risk.category, risk.owner]
        .some((value) => value.toLocaleLowerCase('de').includes(term))
      const matchesFilter = dashboardFilter === 'all' ||
        (dashboardFilter === 'critical' && risk.currentScore >= 16) ||
        (dashboardFilter === 'open' && risk.status !== 'Geschlossen')
      return matchesSearch && matchesFilter
    })
  }, [dashboardFilter, risks, search])
  const selectedDashboardRisk = useMemo(
    () => risks.find((risk) => risk.id === selectedDashboardRiskId) ?? null,
    [risks, selectedDashboardRiskId]
  )
  const openMeasureCount = measures.filter((measure) => measure.status !== 'Erledigt').length
  const measuresDueThisWeek = measures.filter((measure) => measure.status !== 'Erledigt' && measure.dueDate && isWithinDays(measure.dueDate, 7)).length
  const overdueMeasureCount = measures.filter((measure) => measure.status !== 'Erledigt' && isPastDue(measure.dueDate)).length
  const dashboardError = loadError ?? measureError

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
      render: (_, risk) => (
        <Button
          type="text"
          shape="circle"
          icon={<MoreOutlined />}
          aria-label="Weitere Aktionen"
          onClick={(event) => {
            event.stopPropagation()
            setSelectedDashboardRiskId(risk.id)
          }}
        />
      )
    }
  ]

  const openRiskModal = (): void => {
    form.resetFields()
    form.setFieldsValue(newRiskInitialValues)
    setRiskFormSnapshot(createFormSnapshot(newRiskInitialValues))
    setModalOpen(true)
  }

  const discardRiskModal = (): void => {
    setModalOpen(false)
    form.resetFields()
    setRiskFormSnapshot(null)
  }

  const closeRiskModal = (): void => {
    confirmDiscardChanges(
      modal,
      hasUnsavedFormChanges(form, riskFormSnapshot),
      discardRiskModal
    )
  }

  /** Validiert das Erfassungsformular und speichert das neue Risiko über den Server. */
  const submitRisk = async (): Promise<void> => {
    const values = await form.validateFields()
    try {
      const created = await createRiskRequest({
        title: values.title,
        description: values.description,
        category: values.category,
        owner: values.owner,
        initialScore: values.score,
        dueDate: values.dueDate || null,
        reviewDate: values.reviewDate || null,
        reviewCycle: values.reviewCycle
      })
      setRisks((current) => [created, ...current])
      setModalOpen(false)
      form.resetFields()
      setRiskFormSnapshot(null)
      void message.success('Das neue Risiko wurde in SQLite gespeichert.')
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        resetSession()
        return
      }
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
      if (isAuthenticationRequiredError(error)) {
        resetSession()
        throw error
      }
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
      if (isAuthenticationRequiredError(error)) {
        resetSession()
        throw error
      }
      void message.error(error instanceof Error ? error.message : 'Das Risiko konnte nicht gelöscht werden.')
      throw error
    }
  }

  const createNewMeasure = async (input: CreateMeasureInput): Promise<void> => {
    try {
      const created = await createMeasureRequest(input)
      setMeasures((current) => [created, ...current])
      void message.success('Die Maßnahme wurde angelegt.')
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        resetSession()
        throw error
      }
      void message.error(error instanceof Error ? error.message : 'Die Maßnahme konnte nicht angelegt werden.')
      throw error
    }
  }

  const updateExistingMeasure = async (id: string, input: UpdateMeasureInput): Promise<void> => {
    try {
      const updated = await updateMeasureRequest(id, input)
      setMeasures((current) => current.map((measure) => measure.id === id ? updated : measure))
      void message.success('Die Maßnahme wurde aktualisiert.')
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        resetSession()
        throw error
      }
      void message.error(error instanceof Error ? error.message : 'Die Maßnahme konnte nicht aktualisiert werden.')
      throw error
    }
  }

  const removeExistingMeasure = async (id: string): Promise<void> => {
    try {
      await deleteMeasureRequest(id)
      setMeasures((current) => current.filter((measure) => measure.id !== id))
      void message.success('Die Maßnahme wurde gelöscht.')
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        resetSession()
        throw error
      }
      void message.error(error instanceof Error ? error.message : 'Die Maßnahme konnte nicht gelöscht werden.')
      throw error
    }
  }

  const openProfileModal = (): void => {
    if (!currentUser) return
    const profileValues: ProfileFormValues = {
      username: currentUser.username,
      name: currentUser.name,
      email: currentUser.email,
      department: currentUser.department,
      password: undefined
    }
    profileForm.setFieldsValue(profileValues)
    setProfileFormSnapshot(createFormSnapshot(profileValues))
    setProfileModalOpen(true)
  }

  const discardProfileModal = (): void => {
    setProfileModalOpen(false)
    profileForm.resetFields()
    setProfileFormSnapshot(null)
  }

  const closeProfileModal = (): void => {
    confirmDiscardChanges(
      modal,
      hasUnsavedFormChanges(profileForm, profileFormSnapshot),
      discardProfileModal
    )
  }

  const submitProfile = async (): Promise<void> => {
    const values = await profileForm.validateFields()
    const input: UpdateProfileInput = {
      username: values.username,
      name: values.name,
      email: values.email,
      department: values.department
    }
    if (values.password) input.password = values.password

    setProfileSaving(true)
    try {
      const updated = await updateProfileRequest(input)
      setCurrentUser(updated)
      setProfileModalOpen(false)
      profileForm.resetFields()
      setProfileFormSnapshot(null)
      void message.success('Dein Profil wurde aktualisiert.')
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        resetSession()
        return
      }
      void message.error(error instanceof Error ? error.message : 'Das Profil konnte nicht aktualisiert werden.')
    } finally {
      setProfileSaving(false)
    }
  }

  const criticalRiskCount = risks.filter((risk) => risk.currentScore >= 16).length
  const reducedRiskCount = risks.filter((risk) => risk.currentScore < risk.initialScore).length
  const portfolioExposure = risks.length === 0
    ? 0
    : Math.round(risks.reduce((sum, risk) => sum + risk.currentScore, 0) / (risks.length * 25) * 100)

  const runAfterSettingsGuard = (action: () => void): void => {
    confirmDiscardChanges(modal, activeView === 'settings' && settingsDirty, () => {
      setSettingsDirty(false)
      action()
    })
  }

  const navigateToView = (view: ActiveView): void => {
    if (view === activeView) return
    runAfterSettingsGuard(() => {
      setRiskOverviewPreset(undefined)
      setMeasureOverviewPreset(undefined)
      setActiveView(view)
    })
  }

  const logout = (): void => {
    runAfterSettingsGuard(() => resetSession(false))
  }

  const openAllRisks = (): void => {
    runAfterSettingsGuard(() => {
      setRiskOverviewPreset(undefined)
      setActiveView('risks')
    })
  }

  const openCriticalRisks = (): void => {
    runAfterSettingsGuard(() => {
      setRiskOverviewPreset({ id: Date.now(), criticalOnly: true })
      setActiveView('risks')
    })
  }

  const openMeasurePreset = (kind: MeasureOverviewPreset['kind']): void => {
    runAfterSettingsGuard(() => {
      setMeasureOverviewPreset({ id: Date.now(), kind })
      setActiveView('actions')
    })
  }

  const openOpenMeasures = (): void => openMeasurePreset('open')
  const openDueMeasures = (): void => openMeasurePreset('due-week')
  const openOverdueMeasures = (): void => openMeasurePreset('overdue')

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />
  }
  const isAdmin = currentUser.role === 'Admin'

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
            if (key === 'overview' || key === 'risks' || key === 'actions' || key === 'reports') {
              navigateToView(key)
            }
            if (isAdmin && (key === 'team' || key === 'settings')) {
              navigateToView(key)
            }
          }}
          className="nav-menu"
          items={[
            { key: 'overview', icon: <AppstoreOutlined />, label: 'Übersicht' },
            { key: 'risks', icon: <AlertOutlined />, label: 'Risiken' },
            { key: 'actions', icon: <CheckSquareOutlined />, label: 'Maßnahmen' },
            { key: 'reports', icon: <BarChartOutlined />, label: 'Berichte' },
            { type: 'divider' },
            ...(isAdmin
              ? [
                  { key: 'team', icon: <TeamOutlined />, label: 'Team' },
                  { key: 'settings', icon: <SettingOutlined />, label: 'Einstellungen' }
                ]
              : [])
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
            <Avatar className="profile-avatar">{getInitials(currentUser.name)}</Avatar>
            <div className="profile-copy">
              <Text strong>{currentUser.name}</Text>
              <Text type="secondary">{currentUser.department}</Text>
            </div>
            <Button
              type="text"
              icon={<EditOutlined />}
              className="header-icon"
              onClick={openProfileModal}
            >
              Profil
            </Button>
            <Button
              type="text"
              shape="circle"
              icon={<LogoutOutlined />}
              className="header-icon"
              aria-label="Abmelden"
              onClick={logout}
            />
          </Space>
        </Header>

        <Content className="content">
          {activeView === 'settings' && isAdmin ? (
            <SettingsManagement onAuthExpired={resetSession} onDirtyChange={setSettingsDirty} />
          ) : activeView === 'team' && isAdmin ? (
            <UsersManagement onAuthExpired={resetSession} />
          ) : activeView === 'actions' ? (
            <ActionsOverview
              measures={measures}
              risks={risks}
              loading={loading || measuresLoading}
              error={loadError ?? measureError}
              preset={measureOverviewPreset}
              onReload={() => {
                void loadRisks()
                void loadMeasures()
              }}
              onCreate={createNewMeasure}
              onUpdate={updateExistingMeasure}
              onDelete={removeExistingMeasure}
            />
          ) : activeView === 'reports' ? (
            <ReportsOverview
              risks={risks}
              loading={loading || measuresLoading}
              error={loadError ?? measureError}
              onReload={() => {
                void loadRisks()
                void loadMeasures()
              }}
              measuresView={(
                <ActionsOverview
                  measures={measures}
                  risks={risks}
                  loading={loading || measuresLoading}
                  error={loadError ?? measureError}
                  onReload={() => {
                    void loadRisks()
                    void loadMeasures()
                  }}
                  onCreate={createNewMeasure}
                  onUpdate={updateExistingMeasure}
                  onDelete={removeExistingMeasure}
                />
              )}
            />
          ) : activeView === 'risks' ? (
            <RisksOverview
              risks={risks}
              loading={loading}
              error={loadError}
              preset={riskOverviewPreset}
              onReload={() => { void loadRisks() }}
              onCreate={openRiskModal}
              onUpdate={updateExistingRisk}
              onDelete={removeExistingRisk}
            />
          ) : (
            <>
          <div className="welcome-row">
            <div>
              <Title level={2}>Guten Morgen, {getFirstName(currentUser.name)}.</Title>
              <Text type="secondary">Hier ist der aktuelle Risikoüberblick für dein Portfolio.</Text>
            </div>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openRiskModal}>
              Risiko erfassen
            </Button>
          </div>

          {dashboardError && (
            <AppErrorState
              title="Risiko-Server nicht erreichbar"
              description={dashboardError}
              onRetry={() => {
                void loadRisks()
                void loadMeasures()
              }}
            />
          )}

          <div className="stats-grid">
            <Card
              className="stat-card critical-card clickable-stat-card"
              bordered={false}
              role="button"
              tabIndex={0}
              aria-label="Kritische Risiken anzeigen"
              onClick={openCriticalRisks}
              onKeyDown={(event) => handleDashboardCardKey(event, openCriticalRisks)}
            >
              <Flex justify="space-between" align="start">
                <LoadingStatistic title="Kritische Risiken" value={criticalRiskCount} loading={loading} />
                <div className="stat-icon critical"><WarningFilled /></div>
              </Flex>
              <LoadingText loading={loading}><Tag color="error">+1 diese Woche</Tag></LoadingText>
            </Card>
            <Card
              className="stat-card clickable-stat-card"
              bordered={false}
              role="button"
              tabIndex={0}
              aria-label="Offene Maßnahmen anzeigen"
              onClick={openOpenMeasures}
              onKeyDown={(event) => handleDashboardCardKey(event, openOpenMeasures)}
            >
              <Flex justify="space-between" align="start">
                <LoadingStatistic title="Offene Maßnahmen" value={openMeasureCount} loading={measuresLoading} />
                <div className="stat-icon action"><CheckSquareOutlined /></div>
              </Flex>
              <Space direction="vertical" size={0} className="stat-links">
                <LoadingText loading={measuresLoading}>
                  <Button
                    type="link"
                    size="small"
                    className="stat-link"
                    icon={<ClockCircleOutlined />}
                    onClick={(event) => {
                      event.stopPropagation()
                      openDueMeasures()
                    }}
                  >
                    {measuresDueThisWeek} diese Woche fällig
                  </Button>
                </LoadingText>
                <LoadingText loading={measuresLoading}>
                  <Button
                    type="link"
                    size="small"
                    danger
                    className="stat-link"
                    icon={<AlertOutlined />}
                    onClick={(event) => {
                      event.stopPropagation()
                      openOverdueMeasures()
                    }}
                  >
                    {overdueMeasureCount} überfällig
                  </Button>
                </LoadingText>
              </Space>
            </Card>
            <Card className="stat-card" bordered={false}>
              <Flex justify="space-between" align="start">
                <LoadingStatistic title="Risiken gesamt" value={risks.length} loading={loading} />
                <div className="stat-icon total"><FileTextOutlined /></div>
              </Flex>
              <LoadingText loading={loading}><Text className="positive"><CheckCircleFilled /> {reducedRiskCount} Risiken reduziert</Text></LoadingText>
            </Card>
            <Card className="stat-card exposure-card" bordered={false}>
              <Flex justify="space-between" align="center">
                <div>
                  <Text className="exposure-title">Portfolio Exposure</Text>
                  <LoadingText loading={loading}><Title level={3}>Mittel</Title></LoadingText>
                  <LoadingText loading={loading}><Text className="positive">↓ 12% zum Vormonat</Text></LoadingText>
                </div>
                <Progress type="dashboard" percent={loading ? 0 : portfolioExposure} size={82} strokeWidth={9} strokeColor="#7c6ee6" trailColor="#e9e7fb" format={() => loading ? '' : String(portfolioExposure)} />
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

            {loading && risks.length === 0 ? (
              <TableSkeleton />
            ) : (
              <Table<Risk>
                rowKey="id"
                columns={columns}
                dataSource={filteredRisks}
                loading={loading}
                pagination={{ pageSize: 5, hideOnSinglePage: true }}
                className="risk-table"
                scroll={{ x: 1040 }}
                locale={{ emptyText: <AppEmptyState title="Keine Risiken gefunden" description={dashboardFilter === 'all' && search.trim().length === 0 ? 'Erfasse das erste Risiko, um das Dashboard zu füllen.' : 'Keine Risiken entsprechen den aktuellen Filtern.'} /> }}
                onRow={(risk) => ({
                  onClick: () => setSelectedDashboardRiskId(risk.id),
                  className: 'clickable-risk-row'
                })}
              />
            )}

            <Flex justify="space-between" align="center" className="table-footer">
              <Text type="secondary"><LoadingText loading={loading}>{filteredRisks.length} von {risks.length} Risiken</LoadingText></Text>
              <Button type="link" onClick={openAllRisks}>Alle Risiken anzeigen →</Button>
            </Flex>
          </Card>
            </>
          )}
        </Content>
      </Layout>

      <Modal
        title="Mein Profil bearbeiten"
        open={profileModalOpen}
        onCancel={closeProfileModal}
        onOk={() => { void submitProfile() }}
        okText="Profil speichern"
        cancelText="Abbrechen"
        confirmLoading={profileSaving}
        destroyOnHidden
        width={560}
        className="risk-edit-modal"
      >
        <Form form={profileForm} layout="vertical" className="risk-form risk-edit-form" requiredMark={false}>
          <Form.Item
            name="username"
            label="Benutzername"
            rules={[
              { required: true, message: 'Bitte einen Benutzernamen eingeben.' },
              { pattern: /^[a-zA-Z0-9._-]{3,80}$/, message: '3 bis 80 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich.' }
            ]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Bitte einen Namen eingeben.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="email"
            label="E-Mail"
            rules={[
              { required: true, message: 'Bitte eine E-Mail-Adresse eingeben.' },
              { type: 'email', message: 'Bitte eine gültige E-Mail-Adresse eingeben.' }
            ]}
          >
            <Input maxLength={254} />
          </Form.Item>
          <Form.Item name="department" label="Abteilung" rules={[{ required: true, message: 'Bitte eine Abteilung eingeben.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Neues Passwort"
            rules={[{ min: 8, message: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }]}
          >
            <Input.Password maxLength={200} placeholder="Leer lassen, wenn es unverändert bleiben soll" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Neues Risiko erfassen"
        open={modalOpen}
        onCancel={closeRiskModal}
        onOk={() => { void submitRisk() }}
        okText="Risiko speichern"
        cancelText="Abbrechen"
        destroyOnHidden
      >
        <Text type="secondary">Erfasse die wichtigsten Eckdaten inklusive Beschreibung und nächstem Review.</Text>
        <Form form={form} layout="vertical" className="risk-form" requiredMark={false}>
          <Form.Item name="title" label="Bezeichnung" rules={[{ required: true, message: 'Bitte eine Bezeichnung eingeben.' }]}>
            <Input placeholder="z. B. Ausfall eines Lieferanten" />
          </Form.Item>
          <Form.Item name="description" label="Beschreibung" rules={[{ required: true, message: 'Bitte eine Beschreibung eingeben.' }]}>
            <Input.TextArea maxLength={2000} rows={4} placeholder="Ursache, Auswirkung oder aktueller Kontext des Risikos" />
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
          <Form.Item
            name="dueDate"
            label="Fälligkeitsdatum"
            getValueProps={(value: string | undefined) => ({ value: getDatePickerValue(value) })}
            normalize={normalizeDatePickerValue}
          >
            <DatePicker className="full-width" format={datePickerDisplayFormat} placeholder="Datum auswählen" />
          </Form.Item>
          <Form.Item name="reviewCycle" label="Review-Rhythmus" initialValue="Fix" rules={[{ required: true, message: 'Bitte einen Review-Rhythmus wählen.' }]}>
            <Select<ReviewCycle>
              options={reviewCycleOptions}
              onChange={(value) => {
                if (value !== 'Fix') form.setFieldValue('reviewDate', calculateReviewDate(value))
              }}
            />
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
              disabled={selectedCreateReviewCycle !== 'Fix'}
              format={datePickerDisplayFormat}
              placeholder="Review-Datum auswählen"
            />
          </Form.Item>
        </Form>
      </Modal>

      {activeView === 'overview' && (
        <RiskDetailDrawer
          risk={selectedDashboardRisk}
          open={selectedDashboardRisk !== null}
          onClose={() => setSelectedDashboardRiskId(null)}
          onUpdate={updateExistingRisk}
          onDelete={removeExistingRisk}
        />
      )}
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
