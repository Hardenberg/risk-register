import {
  BarChartOutlined,
  DownloadOutlined,
  ReloadOutlined,
  WarningFilled
} from '@ant-design/icons'
import {
  Button,
  Card,
  Flex,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TableProps
} from 'antd'
import { useMemo, useState, type ReactNode } from 'react'

import type { Risk, RiskStatus } from './api/risks'
import { AppEmptyState, AppErrorState, LoadingStatistic, TableSkeleton } from './uiStates'

const { Text, Title } = Typography

interface ReportsOverviewProps {
  risks: Risk[]
  loading: boolean
  error: string | null
  onReload: () => void
  measuresView?: ReactNode
}

const statusColors: Record<RiskStatus, string> = {
  Offen: 'gold',
  'In Bearbeitung': 'blue',
  Überwacht: 'purple',
  Geschlossen: 'green'
}

type ReportPeriod = 'Aktuell' | '30 Tage' | 'Quartal' | 'Jahr'
type ReportSection = 'Portfolio' | 'Maßnahmen'

export function ReportsOverview ({
  risks,
  loading,
  error,
  onReload,
  measuresView
}: ReportsOverviewProps): React.JSX.Element {
  const [period, setPeriod] = useState<ReportPeriod>('Aktuell')
  const [section, setSection] = useState<ReportSection>('Portfolio')
  const report = useMemo(() => buildReport(risks), [risks])

  const topRiskColumns: TableProps<Risk>['columns'] = [
    {
      title: 'REFERENZ',
      dataIndex: 'reference',
      width: 100,
      render: (reference: string) => <Text code>{reference}</Text>
    },
    {
      title: 'RISIKO',
      dataIndex: 'title',
      render: (title: string, risk) => (
        <div>
          <Text strong>{title}</Text>
          <div><Text type="secondary" className="subline">{risk.category} · {risk.owner}</Text></div>
        </div>
      )
    },
    {
      title: 'WERT',
      dataIndex: 'currentScore',
      width: 110,
      sorter: (left, right) => left.currentScore - right.currentScore,
      defaultSortOrder: 'descend',
      render: (score: number) => <Text strong style={{ color: score >= 16 ? '#e5484d' : '#f59e0b' }}>{score}/25</Text>
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      width: 140,
      render: (status: RiskStatus) => <Tag color={statusColors[status]}>{status}</Tag>
    }
  ]

  return (
    <div className="reports-overview">
      <Flex justify="space-between" align="center" className="overview-heading">
        <div>
          <Text type="secondary" className="eyebrow">BERICHTE</Text>
          <Title level={2}>Berichtslayout</Title>
          <Text type="secondary">Portfolio, Statusverteilung, Kategorien und Review-Lage.</Text>
        </div>
        <Space>
          <Segmented<ReportSection>
            value={section}
            onChange={setSection}
            options={['Portfolio', 'Maßnahmen']}
          />
          {section === 'Portfolio' && (
            <Select<ReportPeriod>
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'Aktuell', label: 'Aktuell' },
                { value: '30 Tage', label: '30 Tage' },
                { value: 'Quartal', label: 'Quartal' },
                { value: 'Jahr', label: 'Jahr' }
              ]}
              className="report-period-select"
            />
          )}
          <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading}>Aktualisieren</Button>
          <Button icon={<DownloadOutlined />} disabled>Export</Button>
        </Space>
      </Flex>

      {error && (
        <AppErrorState title="Berichtsdaten konnten nicht geladen werden" description={error} onRetry={onReload} />
      )}

      {section === 'Maßnahmen' && measuresView ? (
        <div className="report-measures-view">
          {measuresView}
        </div>
      ) : (
        <>
      <div className="overview-summary-grid">
        <Card bordered={false}>
          <LoadingStatistic title="Risiken gesamt" value={risks.length} loading={loading} prefix={<BarChartOutlined />} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Kritisch" value={report.criticalCount} loading={loading} valueStyle={{ color: '#e5484d' }} prefix={<WarningFilled />} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Ø Risikowert" value={report.averageScore} precision={1} loading={loading} />
        </Card>
        <Card bordered={false}>
          <LoadingStatistic title="Review überfällig" value={report.overdueReviews} loading={loading} valueStyle={{ color: '#d94348' }} />
        </Card>
      </div>

      {loading && risks.length === 0 ? (
        <Card bordered={false} className="report-panel">
          <TableSkeleton />
        </Card>
      ) : (
      <div className="report-grid">
        <Card bordered={false} className="report-panel report-panel-large">
          <Flex justify="space-between" align="center" className="report-panel-heading">
            <div>
              <Title level={4}>Top-Risiken</Title>
              <Text type="secondary">Zeitraum: {period}</Text>
            </div>
            <Tag color={report.portfolioExposure >= 60 ? 'red' : report.portfolioExposure >= 35 ? 'orange' : 'green'}>
              Exposure {report.portfolioExposure}%
            </Tag>
          </Flex>
          {loading && risks.length === 0 ? (
            <TableSkeleton />
          ) : (
            <Table<Risk>
              rowKey="id"
              columns={topRiskColumns}
              dataSource={report.topRisks}
              loading={loading}
              pagination={false}
              scroll={{ x: 720 }}
              locale={{
                emptyText: error
                  ? <AppEmptyState title="Keine Daten verfügbar" description="Prüfe die Verbindung und lade den Bericht erneut." />
                  : <AppEmptyState title="Keine Risiken vorhanden" description="Der Bericht füllt sich, sobald Risiken erfasst wurden." />
              }}
            />
          )}
        </Card>

        <Card bordered={false} className="report-panel">
          <Title level={4}>Statusverteilung</Title>
          <div className="distribution-list">
            {report.statusDistribution.map((entry) => (
              <DistributionRow key={entry.label} label={entry.label} value={entry.value} total={risks.length} color={entry.color} />
            ))}
          </div>
        </Card>

        <Card bordered={false} className="report-panel">
          <Title level={4}>Kategorien</Title>
          <div className="distribution-list">
            {report.categoryDistribution.map((entry) => (
              <DistributionRow key={entry.label} label={entry.label} value={entry.value} total={risks.length} color="#6658d9" />
            ))}
          </div>
        </Card>

        <Card bordered={false} className="report-panel">
          <Title level={4}>Review-Lage</Title>
          <div className="review-report-stack">
            <MetricLine label="In 30 Tagen" value={report.reviewsIn30Days} />
            <MetricLine label="Überfällig" value={report.overdueReviews} danger />
            <MetricLine label="Ohne Termin" value={report.withoutReviewDate} />
          </div>
        </Card>
      </div>
      )}
        </>
      )}
    </div>
  )
}

function buildReport (risks: Risk[]) {
  const topRisks = [...risks].sort((left, right) => right.currentScore - left.currentScore).slice(0, 5)
  const averageScore = risks.length === 0
    ? 0
    : risks.reduce((sum, risk) => sum + risk.currentScore, 0) / risks.length
  const portfolioExposure = risks.length === 0
    ? 0
    : Math.round(risks.reduce((sum, risk) => sum + risk.currentScore, 0) / (risks.length * 25) * 100)

  return {
    topRisks,
    averageScore,
    portfolioExposure,
    criticalCount: risks.filter((risk) => risk.currentScore >= 16).length,
    reviewsIn30Days: risks.filter((risk) => risk.reviewDate && daysUntil(risk.reviewDate) >= 0 && daysUntil(risk.reviewDate) <= 30).length,
    overdueReviews: risks.filter((risk) => risk.reviewDate && daysUntil(risk.reviewDate) < 0 && risk.status !== 'Geschlossen').length,
    withoutReviewDate: risks.filter((risk) => !risk.reviewDate).length,
    statusDistribution: Object.entries(statusColors).map(([status, color]) => ({
      label: status,
      color,
      value: risks.filter((risk) => risk.status === status).length
    })),
    categoryDistribution: Object.entries(groupByCategory(risks))
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))
  }
}

function DistributionRow ({ label, value, total, color }: { label: string, value: number, total: number, color: string }): React.JSX.Element {
  const percent = total === 0 ? 0 : Math.round(value / total * 100)
  return (
    <div className="distribution-row">
      <Flex justify="space-between">
        <Text>{label}</Text>
        <Text type="secondary">{value}</Text>
      </Flex>
      <Progress percent={percent} showInfo={false} strokeColor={color} trailColor="#ececf3" />
    </div>
  )
}

function MetricLine ({ label, value, danger = false }: { label: string, value: number, danger?: boolean }): React.JSX.Element {
  return (
    <Flex justify="space-between" align="center" className="metric-line">
      <Text type="secondary">{label}</Text>
      <Text strong style={{ color: danger ? '#d94348' : undefined }}>{value}</Text>
    </Flex>
  )
}

function groupByCategory (risks: Risk[]): Record<string, number> {
  return risks.reduce<Record<string, number>>((groups, risk) => {
    groups[risk.category] = (groups[risk.category] ?? 0) + 1
    return groups
  }, {})
}

function daysUntil (date: string): number {
  const today = new Date()
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(`${date}T00:00:00`).getTime()
  return Math.ceil((target - start) / 86_400_000)
}
