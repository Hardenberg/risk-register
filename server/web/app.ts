import 'bootstrap/dist/css/bootstrap.min.css'
import './styles.css'

type RiskStatus = 'Offen' | 'In Bearbeitung' | 'Überwacht' | 'Geschlossen'
type View = 'risks' | 'users' | 'settings'

interface Risk {
  id: string
  reference: string
  title: string
  category: string
  owner: string
  currentScore: number
  status: RiskStatus
  dueDate: string | null
}

interface User {
  id: string
  username: string
  name: string
  email: string
  department: string
  role: 'Admin' | 'User'
  active: boolean
  createdAt: string
  updatedAt: string
}

interface LoginResponse {
  user: User
  token: string
}

interface PaginatedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Session {
  user: User
  token: string
}

interface ApplicationSettings {
  organizationName: string
  defaultReviewCycle: string
  reviewReminderDays: number
  highRiskThreshold: number
  criticalRiskThreshold: number
}

const storageKey = 'risk-register.server-session'

const elements = {
  loginView: requireElement<HTMLElement>('login-view'),
  appView: requireElement<HTMLElement>('app-view'),
  loginForm: requireElement<HTMLFormElement>('login-form'),
  loginUsername: requireElement<HTMLInputElement>('login-username'),
  loginPassword: requireElement<HTMLInputElement>('login-password'),
  loginButton: requireElement<HTMLButtonElement>('login-button'),
  loginSpinner: requireElement<HTMLSpanElement>('login-spinner'),
  loginAlert: requireElement<HTMLDivElement>('login-alert'),
  logoutButton: requireElement<HTMLButtonElement>('logout-button'),
  sessionUser: requireElement<HTMLSpanElement>('session-user'),
  showRisksButton: requireElement<HTMLButtonElement>('show-risks-button'),
  showUsersButton: requireElement<HTMLButtonElement>('show-users-button'),
  showSettingsButton: requireElement<HTMLButtonElement>('show-settings-button'),
  risksView: requireElement<HTMLElement>('risks-view'),
  usersView: requireElement<HTMLElement>('users-view'),
  settingsView: requireElement<HTMLElement>('settings-view'),
  tableBody: requireElement<HTMLTableSectionElement>('risk-table-body'),
  search: requireElement<HTMLInputElement>('risk-search'),
  refreshButton: requireElement<HTMLButtonElement>('refresh-button'),
  refreshSpinner: requireElement<HTMLSpanElement>('refresh-spinner'),
  errorAlert: requireElement<HTMLDivElement>('error-alert'),
  resultCount: requireElement<HTMLElement>('result-count'),
  totalCount: requireElement<HTMLElement>('total-count'),
  criticalCount: requireElement<HTMLElement>('critical-count'),
  activeCount: requireElement<HTMLElement>('active-count'),
  closedCount: requireElement<HTMLElement>('closed-count'),
  userTableBody: requireElement<HTMLTableSectionElement>('user-table-body'),
  userForm: requireElement<HTMLFormElement>('user-form'),
  userFormTitle: requireElement<HTMLElement>('user-form-title'),
  userId: requireElement<HTMLInputElement>('user-id'),
  userUsername: requireElement<HTMLInputElement>('user-username'),
  userName: requireElement<HTMLInputElement>('user-name'),
  userEmail: requireElement<HTMLInputElement>('user-email'),
  userDepartment: requireElement<HTMLInputElement>('user-department'),
  userRole: requireElement<HTMLSelectElement>('user-role'),
  userPassword: requireElement<HTMLInputElement>('user-password'),
  userActive: requireElement<HTMLInputElement>('user-active'),
  passwordHelp: requireElement<HTMLElement>('password-help'),
  resetUserFormButton: requireElement<HTMLButtonElement>('reset-user-form-button'),
  saveUserButton: requireElement<HTMLButtonElement>('save-user-button'),
  settingsForm: requireElement<HTMLFormElement>('settings-form'),
  settingOrganizationName: requireElement<HTMLInputElement>('setting-organization-name'),
  settingDefaultReviewCycle: requireElement<HTMLSelectElement>('setting-default-review-cycle'),
  settingReviewReminderDays: requireElement<HTMLInputElement>('setting-review-reminder-days'),
  settingHighRiskThreshold: requireElement<HTMLInputElement>('setting-high-risk-threshold'),
  settingCriticalRiskThreshold: requireElement<HTMLInputElement>('setting-critical-risk-threshold'),
  saveSettingsButton: requireElement<HTMLButtonElement>('save-settings-button')
}

let session: Session | null = readSession()
let activeView: View = 'risks'
let risks: Risk[] = []
let users: User[] = []
let settingsLoaded = false

elements.loginForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void login()
})
elements.logoutButton.addEventListener('click', () => logout())
elements.showRisksButton.addEventListener('click', () => { void showView('risks') })
elements.showUsersButton.addEventListener('click', () => { void showView('users') })
elements.showSettingsButton.addEventListener('click', () => { void showView('settings') })
elements.search.addEventListener('input', renderRisks)
elements.refreshButton.addEventListener('click', () => {
  if (activeView === 'risks') void loadRisks()
  else void loadUsers()
})
elements.userForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void saveUser()
})
elements.resetUserFormButton.addEventListener('click', resetUserForm)
elements.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void saveSettings()
})

if (session) {
  showApp()
  void loadRisks()
} else {
  showLogin()
}

async function login (): Promise<void> {
  elements.loginButton.disabled = true
  elements.loginSpinner.classList.remove('d-none')
  hideLoginError()

  try {
    const response = await fetchJson<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: elements.loginUsername.value.trim(),
        password: elements.loginPassword.value
      })
    }, false)
    session = response
    window.localStorage.setItem(storageKey, JSON.stringify(response))
    elements.loginPassword.value = ''
    showApp()
    await loadRisks()
  } catch (error) {
    showLoginError(error instanceof Error ? error.message : 'Die Anmeldung ist fehlgeschlagen.')
  } finally {
    elements.loginButton.disabled = false
    elements.loginSpinner.classList.add('d-none')
  }
}

function logout (message?: string): void {
  session = null
  risks = []
  users = []
  window.localStorage.removeItem(storageKey)
  resetUserForm()
  resetRiskStatistics()
  showLogin(message)
}

function showLogin (message?: string): void {
  elements.loginView.classList.remove('d-none')
  elements.appView.classList.add('d-none')
  elements.logoutButton.classList.add('d-none')
  elements.sessionUser.classList.add('d-none')
  if (message) showLoginError(message)
}

function showApp (): void {
  if (!session) return
  elements.loginView.classList.add('d-none')
  elements.appView.classList.remove('d-none')
  elements.logoutButton.classList.remove('d-none')
  elements.sessionUser.classList.remove('d-none')
  elements.sessionUser.textContent = `${session.user.name} · ${session.user.role}`
  elements.showUsersButton.classList.toggle('d-none', !isAdmin())
  elements.showSettingsButton.classList.toggle('d-none', !isAdmin())
  if (!isAdmin() && (activeView === 'users' || activeView === 'settings')) activeView = 'risks'
  hideLoginError()
  void showView(activeView)
}

async function showView (view: View): Promise<void> {
  if ((view === 'users' || view === 'settings') && !isAdmin()) view = 'risks'
  activeView = view
  elements.risksView.classList.toggle('d-none', view !== 'risks')
  elements.usersView.classList.toggle('d-none', view !== 'users')
  elements.settingsView.classList.toggle('d-none', view !== 'settings')
  elements.showRisksButton.className = view === 'risks' ? 'btn btn-primary' : 'btn btn-outline-primary'
  elements.showUsersButton.className = view === 'users' ? 'btn btn-primary' : 'btn btn-outline-primary'
  elements.showSettingsButton.className = view === 'settings' ? 'btn btn-primary' : 'btn btn-outline-primary'
  elements.errorAlert.classList.add('d-none')

  if (view === 'risks' && risks.length === 0) await loadRisks()
  if (view === 'users' && users.length === 0) await loadUsers()
  if (view === 'settings' && !settingsLoaded) await loadSettings()
}

async function loadRisks (): Promise<void> {
  setLoading(true)
  hideError()
  try {
    risks = (await fetchJson<PaginatedResponse<Risk>>('/api/risks?pageSize=500')).items
    renderStatistics()
    renderRisks()
  } catch (error) {
    if (error instanceof AuthError) return
    showError(`Die Risiken konnten nicht geladen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  } finally {
    setLoading(false)
  }
}

async function loadUsers (): Promise<void> {
  setLoading(true)
  hideError()
  try {
    users = await fetchJson<User[]>('/api/users')
    renderUsers()
  } catch (error) {
    if (error instanceof AuthError) return
    showError(`Die Benutzer konnten nicht geladen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  } finally {
    setLoading(false)
  }
}

async function loadSettings (): Promise<void> {
  setLoading(true)
  hideError()
  try {
    const settings = await fetchJson<ApplicationSettings>('/api/settings')
    fillSettingsForm(settings)
    settingsLoaded = true
  } catch (error) {
    if (error instanceof AuthError) return
    showError(`Die Einstellungen konnten nicht geladen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  } finally {
    setLoading(false)
  }
}

function renderRisks (): void {
  const term = elements.search.value.trim().toLocaleLowerCase('de')
  const filtered = risks.filter((risk) => !term || [risk.reference, risk.title, risk.category, risk.owner]
    .some((value) => value.toLocaleLowerCase('de').includes(term)))

  elements.tableBody.replaceChildren(...filtered.map(createRiskRow))
  elements.resultCount.textContent = `${filtered.length} von ${risks.length} Risiken`

  if (filtered.length === 0) {
    const row = document.createElement('tr')
    const cell = document.createElement('td')
    cell.colSpan = 6
    cell.className = 'empty-state text-center text-secondary py-5'
    cell.textContent = 'Keine Risiken gefunden.'
    row.append(cell)
    elements.tableBody.append(row)
  }
}

function renderStatistics (): void {
  elements.totalCount.textContent = String(risks.length)
  elements.criticalCount.textContent = String(risks.filter((risk) => risk.currentScore >= 16).length)
  elements.activeCount.textContent = String(risks.filter((risk) => risk.status === 'In Bearbeitung').length)
  elements.closedCount.textContent = String(risks.filter((risk) => risk.status === 'Geschlossen').length)
}

function resetRiskStatistics (): void {
  elements.totalCount.textContent = '-'
  elements.criticalCount.textContent = '-'
  elements.activeCount.textContent = '-'
  elements.closedCount.textContent = '-'
  elements.resultCount.textContent = 'Bitte anmelden.'
  elements.tableBody.replaceChildren()
}

function createRiskRow (risk: Risk): HTMLTableRowElement {
  const row = document.createElement('tr')
  row.append(
    cellWith(badge(risk.reference, 'text-bg-light reference-badge')),
    cellWith(riskDescription(risk)),
    cellWith(owner(risk.owner)),
    cellWith(score(risk.currentScore)),
    cellWith(statusBadge(risk.status)),
    cellWith(text(formatDate(risk.dueDate), 'text-secondary text-nowrap'))
  )
  return row
}

function renderUsers (): void {
  elements.userTableBody.replaceChildren(...users.map(createUserRow))

  if (users.length === 0) {
    const row = document.createElement('tr')
    const cell = document.createElement('td')
    cell.colSpan = 5
    cell.className = 'empty-state text-center text-secondary py-5'
    cell.textContent = 'Keine Benutzer gefunden.'
    row.append(cell)
    elements.userTableBody.append(row)
  }
}

function createUserRow (user: User): HTMLTableRowElement {
  const row = document.createElement('tr')
  row.append(
    cellWith(userDescription(user)),
    cellWith(text(user.email, 'text-secondary')),
    cellWith(text(user.department)),
    cellWith(badge(user.active ? 'Aktiv' : 'Deaktiviert', user.active ? 'text-bg-success' : 'text-bg-secondary')),
    cellWith(userActions(user))
  )
  return row
}

function userDescription (user: User): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'd-flex align-items-center gap-2'
  const avatar = text(initials(user.name), 'owner-avatar')
  const copy = document.createElement('div')
  copy.append(text(user.name, 'd-block fw-semibold'), text(`@${user.username}`, 'd-block text-secondary small'))
  wrapper.append(avatar, copy)
  return wrapper
}

function userActions (user: User): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'd-flex justify-content-end gap-2'
  const editButton = document.createElement('button')
  editButton.type = 'button'
  editButton.className = 'btn btn-sm btn-outline-primary'
  editButton.textContent = 'Bearbeiten'
  editButton.addEventListener('click', () => editUser(user))

  const activeButton = document.createElement('button')
  activeButton.type = 'button'
  activeButton.className = user.active ? 'btn btn-sm btn-outline-secondary' : 'btn btn-sm btn-outline-success'
  activeButton.textContent = user.active ? 'Deaktivieren' : 'Aktivieren'
  activeButton.addEventListener('click', () => { void toggleUserActive(user) })

  wrapper.append(editButton, activeButton)
  return wrapper
}

function editUser (user: User): void {
  elements.userFormTitle.textContent = `${user.name} bearbeiten`
  elements.userId.value = user.id
  elements.userUsername.value = user.username
  elements.userName.value = user.name
  elements.userEmail.value = user.email
  elements.userDepartment.value = user.department
  elements.userRole.value = user.role
  elements.userPassword.value = ''
  elements.userPassword.required = false
  elements.userActive.checked = user.active
  elements.passwordHelp.textContent = 'Leer lassen, um das Passwort nicht zu ändern.'
  elements.userUsername.focus()
}

function resetUserForm (): void {
  elements.userForm.reset()
  elements.userFormTitle.textContent = 'Benutzer anlegen'
  elements.userId.value = ''
  elements.userActive.checked = true
  elements.userRole.value = 'User'
  elements.userPassword.required = true
  elements.passwordHelp.textContent = 'Pflicht beim Anlegen, beim Bearbeiten optional.'
}

async function saveUser (): Promise<void> {
  if (!elements.userForm.reportValidity()) return

  elements.saveUserButton.disabled = true
  const id = elements.userId.value
  const payload: Record<string, string | boolean> = {
    username: elements.userUsername.value.trim(),
    name: elements.userName.value.trim(),
    email: elements.userEmail.value.trim(),
    department: elements.userDepartment.value.trim(),
    role: elements.userRole.value,
    active: elements.userActive.checked
  }
  if (elements.userPassword.value) payload.password = elements.userPassword.value

  try {
    const saved = id
      ? await fetchJson<User>(`/api/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson<User>('/api/users', { method: 'POST', body: JSON.stringify(payload) })

    users = id
      ? users.map((user) => user.id === saved.id ? saved : user)
      : [saved, ...users]
    renderUsers()
    resetUserForm()
    showError(`${saved.name} wurde gespeichert.`, 'success')
  } catch (error) {
    if (error instanceof AuthError) return
    showError(`Der Benutzer konnte nicht gespeichert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  } finally {
    elements.saveUserButton.disabled = false
  }
}

async function toggleUserActive (user: User): Promise<void> {
  try {
    const saved = await fetchJson<User>(`/api/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ active: !user.active })
    })
    users = users.map((current) => current.id === saved.id ? saved : current)
    renderUsers()
    showError(`${saved.name} wurde ${saved.active ? 'aktiviert' : 'deaktiviert'}.`, 'success')
  } catch (error) {
    if (error instanceof AuthError) return
    showError(`Der Status konnte nicht geändert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  }
}

async function saveSettings (): Promise<void> {
  if (!elements.settingsForm.reportValidity()) return
  const highRiskThreshold = Number(elements.settingHighRiskThreshold.value)
  const criticalRiskThreshold = Number(elements.settingCriticalRiskThreshold.value)
  if (highRiskThreshold >= criticalRiskThreshold) {
    showError('Die Schwelle Kritisch muss größer als die Schwelle Hoch sein.')
    return
  }

  elements.saveSettingsButton.disabled = true
  try {
    const saved = await fetchJson<ApplicationSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        organizationName: elements.settingOrganizationName.value.trim(),
        defaultReviewCycle: elements.settingDefaultReviewCycle.value,
        reviewReminderDays: Number(elements.settingReviewReminderDays.value),
        highRiskThreshold,
        criticalRiskThreshold
      })
    })
    fillSettingsForm(saved)
    showError('Einstellungen wurden gespeichert.', 'success')
  } catch (error) {
    if (error instanceof AuthError) return
    showError(`Die Einstellungen konnten nicht gespeichert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  } finally {
    elements.saveSettingsButton.disabled = false
  }
}

function fillSettingsForm (settings: ApplicationSettings): void {
  elements.settingOrganizationName.value = settings.organizationName
  elements.settingDefaultReviewCycle.value = settings.defaultReviewCycle
  elements.settingReviewReminderDays.value = String(settings.reviewReminderDays)
  elements.settingHighRiskThreshold.value = String(settings.highRiskThreshold)
  elements.settingCriticalRiskThreshold.value = String(settings.criticalRiskThreshold)
}

async function fetchJson<T> (path: string, init: RequestInit = {}, withAuth = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (withAuth && session) headers.set('Authorization', `Bearer ${session.token}`)

  const response = await fetch(path, { ...init, headers })
  if (response.status === 401) {
    if (!withAuth) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string }
      throw new Error(error.message ?? 'Die Anmeldung ist fehlgeschlagen.')
    }
    logout('Die Sitzung ist abgelaufen. Bitte erneut anmelden.')
    throw new AuthError()
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string }
    throw new Error(error.message ?? `HTTP ${response.status}`)
  }
  return await response.json() as T
}

function readSession (): Session | null {
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<Session>
    if (!value.token || !value.user) return null
    return { token: value.token, user: value.user }
  } catch {
    window.localStorage.removeItem(storageKey)
    return null
  }
}

function isAdmin (): boolean {
  return session?.user.role === 'Admin'
}

function riskDescription (risk: Risk): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.append(text(risk.title, 'fw-semibold risk-title'), text(risk.category, 'd-block text-secondary small mt-1'))
  return wrapper
}

function owner (name: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'd-flex align-items-center gap-2 text-nowrap'
  const avatar = text(initials(name), 'owner-avatar')
  wrapper.append(avatar, text(name))
  return wrapper
}

function score (value: number): HTMLElement {
  const meta = value >= 16
    ? { color: 'danger', label: 'Kritisch' }
    : value >= 10
      ? { color: 'warning', label: 'Hoch' }
      : value >= 5
        ? { color: 'primary', label: 'Mittel' }
        : { color: 'success', label: 'Niedrig' }
  const wrapper = document.createElement('div')
  wrapper.className = 'score-column'
  const header = document.createElement('div')
  header.className = 'd-flex justify-content-between small mb-1'
  header.append(text(`${value}/25`, `fw-bold text-${meta.color}`), text(meta.label, 'text-secondary score-label'))
  const progress = document.createElement('div')
  progress.className = 'progress'
  progress.setAttribute('role', 'progressbar')
  progress.setAttribute('aria-valuenow', String(value))
  progress.setAttribute('aria-valuemin', '0')
  progress.setAttribute('aria-valuemax', '25')
  const bar = document.createElement('div')
  bar.className = `progress-bar bg-${meta.color}`
  bar.style.width = `${value / 25 * 100}%`
  progress.append(bar)
  wrapper.append(header, progress)
  return wrapper
}

function statusBadge (status: RiskStatus): HTMLElement {
  const colors: Record<RiskStatus, string> = {
    Offen: 'warning',
    'In Bearbeitung': 'primary',
    Überwacht: 'info',
    Geschlossen: 'success'
  }
  return badge(status, `text-bg-${colors[status]} bg-opacity-10 border border-${colors[status]}-subtle text-${colors[status]}-emphasis`)
}

function badge (value: string, className: string): HTMLElement {
  return text(value, `badge ${className}`)
}

function cellWith (content: Node): HTMLTableCellElement {
  const cell = document.createElement('td')
  cell.append(content)
  return cell
}

function text (value: string, className?: string): HTMLSpanElement {
  const element = document.createElement('span')
  element.textContent = value
  if (className) element.className = className
  return element
}

function initials (name: string): string {
  const value = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('')
  return value.toUpperCase() || 'U'
}

function formatDate (date: string | null): string {
  if (!date) return 'Nicht geplant'
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T00:00:00`))
}

function setLoading (loading: boolean): void {
  elements.refreshButton.disabled = loading
  elements.refreshSpinner.classList.toggle('d-none', !loading)
}

function showError (message: string, type: 'danger' | 'success' = 'danger'): void {
  elements.errorAlert.className = `alert alert-${type}`
  elements.errorAlert.textContent = message
}

function hideError (): void {
  elements.errorAlert.classList.add('d-none')
}

function showLoginError (message: string): void {
  elements.loginAlert.textContent = message
  elements.loginAlert.classList.remove('d-none')
}

function hideLoginError (): void {
  elements.loginAlert.classList.add('d-none')
}

function requireElement<T extends HTMLElement> (id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Element #${id} fehlt.`)
  return element as T
}

class AuthError extends Error {}
