import {
  Alert,
  Button,
  Empty,
  Flex,
  Skeleton,
  Space,
  Statistic,
  Typography,
  type StatisticProps
} from 'antd'
import type { ReactNode } from 'react'

const { Text, Title } = Typography

interface AppErrorStateProps {
  title: string
  description: string
  onRetry: () => void
}

export function AppErrorState ({ title, description, onRetry }: AppErrorStateProps): React.JSX.Element {
  return (
    <Alert
      type="error"
      showIcon
      className="state-alert"
      message={title}
      description={description}
      action={<Button size="small" onClick={onRetry}>Erneut versuchen</Button>}
    />
  )
}

interface AppEmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function AppEmptyState ({ title, description, action }: AppEmptyStateProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={null}>
        <Space direction="vertical" align="center" size={8}>
          <Title level={5}>{title}</Title>
          <Text type="secondary">{description}</Text>
          {action}
        </Space>
      </Empty>
    </div>
  )
}

export function TableSkeleton (): React.JSX.Element {
  return (
    <div className="table-skeleton">
      <Skeleton active paragraph={{ rows: 5 }} title={false} />
    </div>
  )
}

interface LoadingStatisticProps extends StatisticProps {
  loading?: boolean
}

export function LoadingStatistic ({ loading = false, ...props }: LoadingStatisticProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="loading-statistic">
        <Text type="secondary" className="loading-statistic-title">{props.title}</Text>
        <Skeleton.Input active size="small" className="loading-statistic-value" />
      </div>
    )
  }

  return <Statistic {...props} />
}

interface LoadingTextProps {
  loading: boolean
  children: ReactNode
}

export function LoadingText ({ loading, children }: LoadingTextProps): React.JSX.Element {
  if (loading) return <Skeleton.Input active size="small" className="inline-loading-text" />
  return <>{children}</>
}

interface OfflineStateProps {
  message: string
  onRetry: () => void
}

export function OfflineState ({ message, onRetry }: OfflineStateProps): React.JSX.Element {
  return (
    <Flex justify="space-between" align="center" gap={12} wrap="wrap" className="offline-state">
      <Text>{message}</Text>
      <Button size="small" onClick={onRetry}>Erneut versuchen</Button>
    </Flex>
  )
}
