import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined
} from '@ant-design/icons'
import {
  App,
  Avatar,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  type TablePaginationConfig,
  type TableProps
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { isAuthenticationRequiredError } from './api/auth'
import {
  createUser,
  listUsers,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
  type User
} from './api/users'
import { usePersistentState } from './persistentState'
import { ResizableColumnTitle, sumColumnWidths, useColumnResize } from './resizableColumns'
import {
  confirmDiscardChanges,
  createFormSnapshot,
  hasUnsavedFormChanges,
  type FormSnapshot
} from './unsavedChanges'
import { AppEmptyState, AppErrorState, TableSkeleton } from './uiStates'

const { Text, Title } = Typography

interface UserFormValues {
  username: string
  name: string
  email: string
  department: string
  role: User['role']
  password?: string
  active: boolean
}

interface UsersManagementProps {
  onAuthExpired?: () => void
}

const userTableStorageKey = 'risk-register:users-management:table-state:v1'
const userColumnDefaults = {
  name: 300,
  email: 260,
  department: 220,
  role: 120,
  active: 135,
  actions: 88
}

type TableSortOrder = 'ascend' | 'descend'
type UserColumnKey = keyof typeof userColumnDefaults
type UserSortField = Exclude<UserColumnKey, 'actions'>

interface UsersTableState {
  page: number
  pageSize: number
  sortField?: UserSortField
  sortOrder?: TableSortOrder
  columnWidths: Partial<Record<UserColumnKey, number>>
}

const initialUsersTableState: UsersTableState = {
  page: 1,
  pageSize: 10,
  columnWidths: userColumnDefaults
}

const newUserInitialValues: Partial<UserFormValues> = {
  role: 'User',
  active: true
}

export function UsersManagement ({ onAuthExpired }: UsersManagementProps): React.JSX.Element {
  const { message, modal } = App.useApp()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userFormSnapshot, setUserFormSnapshot] = useState<FormSnapshot | null>(null)
  const [form] = Form.useForm<UserFormValues>()
  const [tableState, setTableState] = usePersistentState(userTableStorageKey, initialUsersTableState)
  const columnWidths = useMemo(
    () => ({ ...userColumnDefaults, ...tableState.columnWidths }),
    [tableState.columnWidths]
  )
  const updateTableState = useCallback((patch: Partial<UsersTableState>): void => {
    setTableState((current) => ({ ...current, ...patch }))
  }, [setTableState])
  const setColumnWidth = useCallback((column: UserColumnKey, width: number): void => {
    setTableState((current) => ({
      ...current,
      columnWidths: { ...current.columnWidths, [column]: width }
    }))
  }, [setTableState])
  const startColumnResize = useColumnResize(columnWidths, setColumnWidth)
  const renderColumnTitle = useCallback((column: UserColumnKey, label: string): React.JSX.Element => (
    <ResizableColumnTitle label={label} onResizeStart={(event) => startColumnResize(column, event)} />
  ), [startColumnResize])

  const editingUser = useMemo(
    () => users.find((user) => user.id === editingUserId) ?? null,
    [editingUserId, users]
  )

  const loadUsers = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listUsers())
    } catch (loadError) {
      if (isAuthenticationRequiredError(loadError)) {
        onAuthExpired?.()
        return
      }
      setError(loadError instanceof Error ? loadError.message : 'Benutzer konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [onAuthExpired])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(users.length / tableState.pageSize))
    if (tableState.page > lastPage) updateTableState({ page: lastPage })
  }, [tableState.page, tableState.pageSize, updateTableState, users.length])

  useEffect(() => {
    if (!modalOpen) return
    if (editingUser) {
      const values: UserFormValues = {
        username: editingUser.username,
        name: editingUser.name,
        email: editingUser.email,
        department: editingUser.department,
        role: editingUser.role,
        active: editingUser.active,
        password: undefined
      }
      form.setFieldsValue(values)
      setUserFormSnapshot(createFormSnapshot(values))
    } else {
      form.setFieldsValue(newUserInitialValues)
      setUserFormSnapshot(createFormSnapshot(newUserInitialValues))
    }
  }, [editingUser, form, modalOpen])

  const handleTableChange: TableProps<User>['onChange'] = (pagination, _filters, sorter) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
    const sortOrder = activeSorter?.order === 'ascend' || activeSorter?.order === 'descend'
      ? activeSorter.order
      : undefined
    const sortField = sortOrder && typeof activeSorter?.field === 'string'
      ? activeSorter.field as UserSortField
      : undefined

    updateTableState({
      page: pagination.current ?? tableState.page,
      pageSize: pagination.pageSize ?? tableState.pageSize,
      sortField,
      sortOrder
    })
  }

  const pagination: TablePaginationConfig = {
    current: tableState.page,
    pageSize: tableState.pageSize,
    showSizeChanger: false
  }

  const columns: TableProps<User>['columns'] = [
    {
      title: renderColumnTitle('name', 'BENUTZER'),
      dataIndex: 'name',
      key: 'name',
      width: columnWidths.name,
      sorter: (left, right) => left.name.localeCompare(right.name, 'de'),
      sortOrder: tableState.sortField === 'name' ? tableState.sortOrder : null,
      render: (name: string, user) => (
        <Space size={10}>
          <Avatar icon={<UserOutlined />} className="owner-avatar" />
          <div>
            <Text strong>{name}</Text>
            <div><Text type="secondary" className="subline">@{user.username}</Text></div>
          </div>
        </Space>
      )
    },
    {
      title: renderColumnTitle('email', 'E-MAIL'),
      dataIndex: 'email',
      key: 'email',
      width: columnWidths.email,
      sorter: (left, right) => left.email.localeCompare(right.email),
      sortOrder: tableState.sortField === 'email' ? tableState.sortOrder : null
    },
    {
      title: renderColumnTitle('department', 'ABTEILUNG'),
      dataIndex: 'department',
      key: 'department',
      width: columnWidths.department,
      sorter: (left, right) => left.department.localeCompare(right.department, 'de'),
      sortOrder: tableState.sortField === 'department' ? tableState.sortOrder : null
    },
    {
      title: renderColumnTitle('role', 'ROLLE'),
      dataIndex: 'role',
      key: 'role',
      width: columnWidths.role,
      sorter: (left, right) => left.role.localeCompare(right.role, 'de'),
      sortOrder: tableState.sortField === 'role' ? tableState.sortOrder : null,
      render: (role: User['role']) => <Tag color={role === 'Admin' ? 'purple' : 'blue'}>{role}</Tag>
    },
    {
      title: renderColumnTitle('active', 'STATUS'),
      dataIndex: 'active',
      key: 'active',
      width: columnWidths.active,
      sorter: (left, right) => Number(left.active) - Number(right.active),
      sortOrder: tableState.sortField === 'active' ? tableState.sortOrder : null,
      render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? 'Aktiv' : 'Deaktiviert'}</Tag>
    },
    {
      key: 'actions',
      width: columnWidths.actions,
      render: (_, user) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          aria-label={`${user.name} bearbeiten`}
          onClick={() => openEditModal(user)}
        />
      )
    }
  ]

  const openCreateModal = (): void => {
    setEditingUserId(null)
    form.resetFields()
    form.setFieldsValue(newUserInitialValues)
    setUserFormSnapshot(createFormSnapshot(newUserInitialValues))
    setModalOpen(true)
  }

  const openEditModal = (user: User): void => {
    setEditingUserId(user.id)
    setModalOpen(true)
  }

  const discardUserModal = (): void => {
    setModalOpen(false)
    setEditingUserId(null)
    setUserFormSnapshot(null)
    form.resetFields()
  }

  const closeModal = (): void => {
    confirmDiscardChanges(
      modal,
      hasUnsavedFormChanges(form, userFormSnapshot),
      discardUserModal
    )
  }

  const saveUser = async (): Promise<void> => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editingUser) {
        const input: UpdateUserInput = {
          username: values.username,
          name: values.name,
          email: values.email,
          department: values.department,
          role: values.role,
          active: values.active
        }
        if (values.password) input.password = values.password
        const updated = await updateUser(editingUser.id, input)
        setUsers((current) => current.map((user) => user.id === updated.id ? updated : user))
        void message.success(`${updated.name} wurde aktualisiert.`)
      } else {
        const created = await createUser(values as CreateUserInput)
        setUsers((current) => [created, ...current])
        void message.success(`${created.name} wurde angelegt.`)
      }
      discardUserModal()
    } catch (saveError) {
      if (isAuthenticationRequiredError(saveError)) {
        onAuthExpired?.()
        return
      }
      void message.error(saveError instanceof Error ? saveError.message : 'Der Benutzer konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="users-management">
      <Flex justify="space-between" align="center" className="overview-heading">
        <div>
          <Text type="secondary" className="eyebrow">BENUTZERVERWALTUNG</Text>
          <Title level={2}>Team</Title>
          <Text type="secondary">Benutzer anlegen, bearbeiten und bei Bedarf deaktivieren.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { void loadUsers() }} loading={loading}>Aktualisieren</Button>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreateModal}>Benutzer anlegen</Button>
        </Space>
      </Flex>

      {error && (
        <AppErrorState title="Benutzer konnten nicht geladen werden" description={error} onRetry={() => { void loadUsers() }} />
      )}

      <Card bordered={false} className="overview-table-card">
        {loading && users.length === 0 ? (
          <TableSkeleton />
        ) : (
          <Table<User>
            rowKey="id"
            columns={columns}
            dataSource={users}
            loading={loading}
            pagination={pagination}
            scroll={{ x: sumColumnWidths(columnWidths) }}
            className="user-table"
            locale={{
              emptyText: error
                ? <AppEmptyState title="Keine Daten verfügbar" description="Prüfe die Verbindung und lade die Benutzer erneut." />
                : <AppEmptyState title="Keine Benutzer vorhanden" description="Lege den ersten Benutzer an, um das Team zu verwalten." />
            }}
            onChange={handleTableChange}
          />
        )}
      </Card>

      <Modal
        title={editingUser ? `${editingUser.name} bearbeiten` : 'Benutzer anlegen'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => { void saveUser() }}
        okText={editingUser ? 'Speichern' : 'Anlegen'}
        cancelText="Abbrechen"
        confirmLoading={saving}
        destroyOnHidden
        width={620}
        className="risk-edit-modal"
      >
        <Form form={form} layout="vertical" className="risk-form risk-edit-form" requiredMark={false}>
          <div className="risk-edit-grid">
            <Form.Item name="username" label="Benutzername" rules={[{ required: true, message: 'Bitte einen Benutzernamen eingeben.' }]}>
              <Input maxLength={80} />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Bitte einen Namen eingeben.' }]}>
              <Input maxLength={200} />
            </Form.Item>
          </div>
          <div className="risk-edit-grid">
            <Form.Item name="email" label="E-Mail" rules={[
              { required: true, message: 'Bitte eine E-Mail-Adresse eingeben.' },
              { type: 'email', message: 'Bitte eine gültige E-Mail-Adresse eingeben.' }
            ]}>
              <Input maxLength={254} />
            </Form.Item>
            <Form.Item name="department" label="Abteilung" rules={[{ required: true, message: 'Bitte eine Abteilung eingeben.' }]}>
              <Input maxLength={200} />
            </Form.Item>
          </div>
          <Form.Item name="role" label="Rolle" initialValue="User" rules={[{ required: true, message: 'Bitte eine Rolle auswählen.' }]}>
            <Select options={[
              { value: 'User', label: 'User' },
              { value: 'Admin', label: 'Admin' }
            ]} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? 'Neues Passwort' : 'Passwort'}
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (!editingUser && !value) throw new Error('Bitte ein Passwort eingeben.')
                  if (value && value.length < 8) throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.')
                }
              }
            ]}
          >
            <Input.Password maxLength={200} placeholder={editingUser ? 'Leer lassen, um es nicht zu ändern' : undefined} />
          </Form.Item>
          <Form.Item name="active" label="Benutzer aktiv" valuePropName="checked" initialValue>
            <Switch checkedChildren="Aktiv" unCheckedChildren="Aus" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
