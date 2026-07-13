import {
  LockOutlined,
  SafetyCertificateFilled,
  UserOutlined
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Typography
} from 'antd'
import { useState } from 'react'

import { loginUser, type LoginInput, type User } from './api/users'

const { Text, Title } = Typography

interface LoginScreenProps {
  onLogin: (user: User) => void
}

export function LoginScreen ({ onLogin }: LoginScreenProps): React.JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm<LoginInput>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitLogin = async (): Promise<void> => {
    const values = await form.validateFields()
    setLoading(true)
    setError(null)
    try {
      const user = await loginUser(values)
      onLogin(user)
      void message.success(`Angemeldet als ${user.name}.`)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Die Anmeldung ist fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="login-brand">
          <div className="brand-mark"><SafetyCertificateFilled /></div>
          <span>risk<span>wise</span></span>
        </div>
        <div className="login-copy-block">
          <Text className="eyebrow">SERVERANMELDUNG</Text>
          <Title level={1}>Risk Register</Title>
          <Text>Bitte mit Benutzername oder E-Mail anmelden.</Text>
        </div>
      </section>

      <section className="login-panel" aria-label="Anmeldung">
        <div className="login-form-card">
          <div className="login-form-heading">
            <Title level={2}>Anmelden</Title>
            <Text type="secondary">Zugang zum lokalen Risiko-Arbeitsbereich</Text>
          </div>

          {error && (
            <Alert
              type="error"
              showIcon
              message="Anmeldung nicht möglich"
              description={error}
              className="login-alert"
            />
          )}

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            className="login-form"
            onFinish={() => { void submitLogin() }}
          >
            <Form.Item
              name="username"
              label="Benutzername oder E-Mail"
              rules={[{ required: true, message: 'Bitte Benutzername oder E-Mail eingeben.' }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item
              name="password"
              label="Passwort"
              rules={[{ required: true, message: 'Bitte Passwort eingeben.' }]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" loading={loading} block>
              Anmelden
            </Button>
          </Form>
        </div>
      </section>
    </main>
  )
}
