import 'bootstrap/dist/css/bootstrap.min.css'
import './styles.css'

type RiskStatus = 'Offen' | 'In Bearbeitung' | 'Überwacht' | 'Geschlossen'

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

const elements = {
  tableBody: requireElement<HTMLTableSectionElement>('risk-table-body'),
  search: requireElement<HTMLInputElement>('risk-search'),
  refreshButton: requireElement<HTMLButtonElement>('refresh-button'),
  refreshSpinner: requireElement<HTMLSpanElement>('refresh-spinner'),
  errorAlert: requireElement<HTMLDivElement>('error-alert'),
  resultCount: requireElement<HTMLElement>('result-count'),
  totalCount: requireElement<HTMLElement>('total-count'),
  criticalCount: requireElement<HTMLElement>('critical-count'),
  activeCount: requireElement<HTMLElement>('active-count'),
  closedCount: requireElement<HTMLElement>('closed-count')
}

let risks: Risk[] = []

elements.search.addEventListener('input', render)
elements.refreshButton.addEventListener('click', () => { void loadRisks() })

void loadRisks()

/** Lädt die aktuelle Risikoliste vom gleichen Fastify-Ursprung und aktualisiert die Seite. */
async function loadRisks (): Promise<void> {
  setLoading(true)
  elements.errorAlert.classList.add('d-none')
  try {
    const response = await fetch('/api/risks')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    risks = await response.json() as Risk[]
    renderStatistics()
    render()
  } catch (error) {
    elements.errorAlert.textContent = `Die Risiken konnten nicht geladen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
    elements.errorAlert.classList.remove('d-none')
  } finally {
    setLoading(false)
  }
}

/** Filtert die lokal geladenen Risiken und baut den sicheren Tabellen-DOM neu auf. */
function render (): void {
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

/** Berechnet und schreibt die vier Kennzahlen aus dem aktuellen Datenbestand. */
function renderStatistics (): void {
  elements.totalCount.textContent = String(risks.length)
  elements.criticalCount.textContent = String(risks.filter((risk) => risk.currentScore >= 16).length)
  elements.activeCount.textContent = String(risks.filter((risk) => risk.status === 'In Bearbeitung').length)
  elements.closedCount.textContent = String(risks.filter((risk) => risk.status === 'Geschlossen').length)
}

/** Erstellt eine vollständige Tabellenzeile für ein Risiko ohne unsicheres innerHTML. */
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

/** Erstellt die zweizeilige Beschreibung aus Titel und Kategorie. */
function riskDescription (risk: Risk): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.append(text(risk.title, 'fw-semibold risk-title'), text(risk.category, 'd-block text-secondary small mt-1'))
  return wrapper
}

/** Erstellt die Darstellung einer verantwortlichen Person mit Initialen. */
function owner (name: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'd-flex align-items-center gap-2 text-nowrap'
  const avatar = text(name.split(' ').map((part) => part[0]).join(''), 'owner-avatar')
  wrapper.append(avatar, text(name))
  return wrapper
}

/** Erstellt Risikostufe und Fortschrittsanzeige für einen Wert von 1 bis 25. */
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

/** Übersetzt einen fachlichen Status in eine Bootstrap-Badge. */
function statusBadge (status: RiskStatus): HTMLElement {
  const colors: Record<RiskStatus, string> = {
    Offen: 'warning',
    'In Bearbeitung': 'primary',
    Überwacht: 'info',
    Geschlossen: 'success'
  }
  return badge(status, `text-bg-${colors[status]} bg-opacity-10 border border-${colors[status]}-subtle text-${colors[status]}-emphasis`)
}

/** Erzeugt eine Bootstrap-Badge mit sicher gesetztem Textinhalt. */
function badge (value: string, className: string): HTMLElement {
  return text(value, `badge ${className}`)
}

/** Verpackt einen DOM-Knoten in eine Tabellenzelle. */
function cellWith (content: Node): HTMLTableCellElement {
  const cell = document.createElement('td')
  cell.append(content)
  return cell
}

/** Erzeugt ein Span-Element und setzt ausschließlich Text sowie kontrollierte CSS-Klassen. */
function text (value: string, className?: string): HTMLSpanElement {
  const element = document.createElement('span')
  element.textContent = value
  if (className) element.className = className
  return element
}

/** Formatiert ein optionales ISO-Datum für die deutschsprachige Anzeige. */
function formatDate (date: string | null): string {
  if (!date) return 'Nicht geplant'
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T00:00:00`))
}

/** Schaltet während eines Requests Button und Fortschrittsanzeige synchron. */
function setLoading (loading: boolean): void {
  elements.refreshButton.disabled = loading
  elements.refreshSpinner.classList.toggle('d-none', !loading)
}

/** Liefert ein zwingend benötigtes DOM-Element oder bricht mit einer klaren Meldung ab. */
function requireElement<T extends HTMLElement> (id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Element #${id} fehlt.`)
  return element as T
}
