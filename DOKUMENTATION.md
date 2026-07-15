# System-Dokumentation & Design-System

Diese Dokumentation beschreibt die Software-Architektur, das Datenmodell, das Sicherheitsmodell, die Betriebskonfiguration, Backup-Verfahren sowie die Token- und Session-Logik der Risk-Register Anwendung. Am Ende werden die Design-System-Tokens festgehalten.

---

## 1. Software-Architektur

Die Anwendung ist als modernisiertes Monorepo organisiert und nutzt **NPM Workspaces** zur Trennung von Server (Backend) und Electron (Frontend-Desktop-Shell).

```
[ Root Workspace ]
  ├── server/        <-- Fastify REST-API & SQLite-Datenbank
  └── electron/      <-- Electron-Shell & React/Ant-Design-Renderer (Vite-Bundle)
```

### 1.1 Backend (Server)
Das Backend folgt den Prinzipien der **Clean Architecture** (oder Onion Architecture):
- **Domain Layer (`server/src/domain/`)**: Enthält reine Geschäftslogik und Validierungsregeln ohne externe Abhängigkeiten (Entitäten wie `Risk`, `Measure`, `User` sowie abstrakte Repository-Interfaces).
- **Application Layer (`server/src/application/`)**: Beinhaltet die fachlichen Anwendungsfälle (Use Cases), z. B. `CreateRisk`, `UpdateUser`, `ListMeasures`.
- **Infrastructure Layer (`server/src/infrastructure/`)**: Adapter für externe Technologien (SQLite-Datenbank, Verschlüsselungsalgorithmen, Session-Management).
- **Interfaces Layer (`server/src/interfaces/`)**: HTTP-Schnittstellen (Fastify-Routen, Request/Response-Validierungs-Schemas und OpenAPI-Spezifikationen).

### 1.2 Frontend (Electron Desktop Client)
- **Electron Main-Prozess (`electron/src/main.ts`)**: Konfiguriert das native Anwendungsfenster und setzt restriktive Sicherheitsregeln (Sandbox, CSP, Berechtigungsblockierung).
- **Preload Script (`electron/src/preload.ts`)**: Bietet eine isolierte Brücke (`contextBridge`) für die Kommunikation zwischen Renderer und Main-Prozess, bereinigt von unsicheren Node.js-APIs.
- **Renderer-Prozess (`electron/src/renderer/`)**: Basiert auf **React 19** und **Ant Design 6**. Zur Reduzierung der Initialladezeit und Vermeidung großer Vite-Chunks sind alle Hauptseiten (`Settings`, `Users`, `Actions`, `Reports`, `Risks`) über **React lazy** und **Suspense** asynchron aufgeteilt.

---

## 2. Datenmodell (SQLite)

Das relationale Datenmodell wird transaktional und versioniert in SQLite verwaltet (`server/src/infrastructure/database/sqliteDatabase.ts`).

```
                              ┌─────────────────┐
                              │    sequences    │
                              ├─────────────────┤
                              │ name (PK)  TEXT │
                              │ value   INTEGER │
                              └─────────────────┘

  ┌────────────────────────┐                ┌────────────────────────┐
  │         risks          │                │        measures        │
  ├────────────────────────┤                ├────────────────────────┤
  │ id (PK)           TEXT │◄───────────────┤ id (PK)           TEXT │
  │ reference (UQ)    TEXT │                │ risk_id (FK)      TEXT │
  │ title             TEXT │                │ title             TEXT │
  │ description       TEXT │                │ description       TEXT │
  │ category          TEXT │                │ owner             TEXT │
  │ owner             TEXT │                │ due_date          TEXT │
  │ initial_score  INTEGER │                │ priority          TEXT │
  │ current_score  INTEGER │                │ status            TEXT │
  │ status            TEXT │                │ created_at        TEXT │
  │ due_date          TEXT │                │ updated_at        TEXT │
  │ review_date       TEXT │                └────────────────────────┘
  │ review_cycle      TEXT │
  │ created_at        TEXT │                ┌────────────────────────┐
  │ updated_at        TEXT │                │         users          │
  │ deleted_at        TEXT │                ├────────────────────────┤
  └────────────────────────┘                │ id (PK)           TEXT │
                                            │ username (UQ)     TEXT │
  ┌────────────────────────┐                │ name              TEXT │
  │      app_settings      │                │ email (UQ)        TEXT │
  ├────────────────────────┤                │ department        TEXT │
  │ key (PK)          TEXT │                │ password_hash     TEXT │
  │ value             TEXT │                │ active         INTEGER │
  └────────────────────────┘                │ role              TEXT │
                                            │ created_at        TEXT │
                                            │ updated_at        TEXT │
                                            └────────────────────────┘
```

### 2.1 Tabellenbeschreibungen
- **`risks`**: Erfasst alle Risikodatensätze. Löschungen erfolgen logisch über die Markierung des Felds `deleted_at`, um Datenverlust zu vermeiden.
- **`measures`**: Maßnahmen zur Risikominderung, verknüpft per Foreign Key mit Kaskadierung (`ON DELETE SET NULL`) auf `risks`.
- **`users`**: Stammdaten für das Benutzermanagement und Authentifizierung.
- **`app_settings`**: Globale Key-Value Konfigurationen (z. B. Organisation, Schwellenwerte, Token-Geheimnisse).
- **`sequences`**: Verwaltet atomare, thread-sichere Generierungswerte (z. B. für die eindeutige Vergabe von `risk_reference` im Format `R-XXX`).

---

## 3. Rollen- & Berechtigungskonzept

Anwendungsweit wird zwischen zwei festen Benutzerrollen unterschieden:

1. **User (Mitarbeiter)**
   - Eigene Profilpflege (Profil ansehen, Name/E-Mail/Abteilung/Passwort ändern).
   - Risiken ansehen, suchen, erfassen und bearbeiten.
   - Maßnahmen ansehen, suchen, anlegen, bearbeiten und löschen.
   - Berichte exportieren (CSV / JSON) mit aktuellen Filtern.
   - *Gesperrt*: Zugriff auf administrative Tabellen (`/api/users`, `/api/settings`), Backup-Erstellung, Restore-Tests.

2. **Admin (Risikomanager / Administrator)**
   - Voller Zugriff auf alle User-Ressourcen.
   - Benutzerverwaltung (Benutzer anlegen, Stammdaten bearbeiten, Passwörter zurücksetzen, Benutzer aktivieren/deaktivieren).
   - Systemeinstellungen verwalten (Sicherheits-Schwellenwerte für Risiko-Scores anpassen).
   - Backups manuell auslösen und herunterladen.
   - Restore-Integritätstests durchführen.

---

## 4. REST-API & OpenAPI Spezifikation

Die REST-API ist vollständig über **OpenAPI 3.0.3** dokumentiert und direkt unter `/docs` (Swagger-Oberfläche) bzw. `/docs/json` (maschinenlesbare Spezifikation) einsehbar.

### Wichtige administrative Endpunkte:
- `POST /api/settings/backup`: Erstellt ein lokales Server-Backup der SQLite-Datei und sendet dieses im binären Datenstrom (`application/octet-stream`) zum UI-Download.
- `POST /api/settings/restore-test`: Validiert hochgeladene `.db`-Dateien oder das neueste Server-Backup auf Vorhandensein aller Kern-Tabellen.
- `GET /api/risks/export`: Exportiert gefilterte Risiken basierend auf den aktuellen Query-Parametern im JSON- oder CSV-Format.
- `GET /api/measures/export`: Exportiert gefilterte Maßnahmen basierend auf den aktuellen Query-Parametern im JSON- oder CSV-Format.

---

## 5. Konfiguration (Umgebungsvariablen)

Sowohl Server als auch Electron-Client lassen sich flexibel über Umgebungsvariablen anpassen:

| Variable | Beschreibung | Standardwert (Fallback) |
| :--- | :--- | :--- |
| `PORT` | Server-Port für die REST-API | `8000` |
| `HOST` | Bind-Adresse des Backends | `127.0.0.1` |
| `DATABASE_PATH` | Pfad zur produktiven SQLite-Datenbankdatei | `data/risk-register.db` |
| `BACKUP_DIR` | Speicherverzeichnis für SQLite-Server-Backups | `backups/` (im Serverordner) |
| `AUTH_TOKEN_SECRET` | Signaturschlüssel für Authentifizierungstokens | Wird aus `app_settings` gelesen oder generiert |
| `SEED_DEMO_DATA` | Schalter zum optionalen Laden von Demodaten beim Start | `false` (in Produktivumgebung) |
| `VITE_API_URL` | API-Basisadresse für den Electron-Client | `http://127.0.0.1:8000/api` |

---

## 6. Backup & Restore-Verfahren

### 6.1 Backups
- Ein Klick auf "Backup erstellen" löst serverseitig ein atomares Kopieren der aktuellen SQLite-Datei in das Backup-Verzeichnis (`BACKUP_DIR`) aus.
- Die Backup-Datei wird mit einem Zeitstempel versehen (z. B. `backup-2026-07-13T12-00-00.db`).
- Gleichzeitig wird das Backup als Download an die UI übergeben, so dass Admins lokale Kopien speichern können.

### 6.2 Restore-Test (Integritätsprüfung)
Um fehlerhafte Backups oder Datenverlust zu vermeiden, wird ein transaktionaler Restore-Test durchgeführt:
1. Eine temporäre SQLite-Verbindung wird im isolierten Pfad geöffnet (`restore-test-<uuid>.db`).
2. Es wird geprüft, ob die Datei eine valide SQLite-Struktur besitzt.
3. Das Vorhandensein der Pflicht-Tabellen (`risks`, `measures`, `users`, `app_settings`) wird validiert.
4. Es wird ein detaillierter Statusbericht mit Erfolgsmeldung und genutzter Quelle zurückgeliefert.

---

## 7. Sicherheit, Token- & Session-Verhalten

### 7.1 Passwortschutz
- Passwörter werden niemals im Klartext gespeichert. Die Anwendung nutzt sichere kryptografische Hashes über PBKDF2 mit individuellem Salt (`server/src/infrastructure/security/passwordHasher.ts`).

### 7.2 Session-Gültigkeit (8 Stunden)
- Die Authentifizierung erfolgt über signierte JWT-ähnliche Tokens mit einer festen Lebensdauer von **8 Stunden** (`defaultMaxAgeMs = 28.800.000 ms`).
- Nach Ablauf der 8 Stunden wird das Token automatisch ungültig.

### 7.3 Sofortiger Zugriffsentzug bei Deaktivierung
- Bei jedem einzelnen API-Aufruf prüft die Autorisierungs-Zwischensoftware (`preHandler` in `app.ts`), ob das Token valide ist und der zugeordnete Benutzer den Status `active = 1` hat.
- Wird ein Benutzer durch einen Administrator deaktiviert (`active = 0`), verliert sein Token **sofort** jegliche Gültigkeit. Bei der nächsten Aktion wird der Request mit der Meldung `Ihr Benutzerkonto wurde deaktiviert.` und HTTP Status `401 Unauthorized` abgewiesen.

### 7.4 Clientseitiger automatischer Logout
- Tritt im Electron-Client ein Autorisierungsfehler (401) auf, wird die Sitzung sofort gelöscht (`clearAuthToken()`).
- Die Benutzeroberfläche leitet den Benutzer augenblicklich auf den Login-Bildschirm zurück und zeigt eine präzise Benachrichtigung an (z. B. „Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.“ oder „Ihr Benutzerkonto wurde deaktiviert.“).

---

## 8. Entwicklungsworkflow

Im Monorepo-Root können alle Entwickler-Workflows über standardisierte, globale NPM-Befehle gesteuert werden:

```bash
# Abhängigkeiten für alle Workspaces gleichzeitig installieren
npm install

# Anwendung im kombinierten Entwicklungsmodus (Server + Electron) starten
npm run dev

# Gesamtes Projekt kompilieren und builden (Production)
npm run build

# TypeScript-Typprüfung für alle Workspaces ausführen
npm run typecheck

# Code-Qualitätsprüfung über ESLint starten
npm run lint

# Backend- und API-Tests ausführen
npm run test
```

---

## 9. Design System & UI-Tokens

Das UI der Risk-Register Anwendung basiert auf einer klaren, visuell flachen Farb- und Layoutsprache unter Verwendung von Ant Design.

### 9.1 Farbpalette (Color Tokens)

| Token | Wert | Beschreibung |
| :--- | :--- | :--- |
| `@primary-color` | `#6658d9` | Markenfarbe für Hauptaktionen, Fokusrahmen und Navigation |
| `@layout-bg` | `#f4f5fa` | Neutraler, kühler Hintergrund für den gesamten Anwendungsbereich |
| `@text-color` | `#202033` | Primäre Textfarbe (hoher Kontrast für exzellente Lesbarkeit) |
| `@border-radius` | `10px` | Einheitliche Abrundung für Buttons, Inputs und Panels |
| `@font-family` | `Inter, sans-serif` | Moderne Systemschriftart für perfekte Übersichtlichkeit |

### 9.2 Risiko-Scores & Ampelfarben

Risiken werden basierend auf ihrem aktuellen Risikowert (Score) in vier Gefahrenstufen eingeteilt und farblich signalisiert:

- **Kritisch** (Score `16 - 25`): `#e5484d` (Leuchtendes Rot für sofortigen Handlungsbedarf)
- **Hoch** (Score `10 - 15`): `#f59e0b` (Kräftiges Orange für aktive Risikominderung)
- **Mittel** (Score `5 - 9`): `#7c6ee6` (Violett für kontinuierliche Überwachung)
- **Niedrig** (Score `1 - 4`): `#35a56f` (Smaragdgrün für akzeptierte Restrisiken)

### 9.3 Bearbeitungsstatus (Status Colors)

Sowohl Risiken als auch Maßnahmen zeigen ihren Status über farbliche Tags:

- **Offen**: `gold` (Anstehend)
- **In Bearbeitung / In Arbeit**: `blue` (Aktiv gesteuert)
- **Überwacht**: `purple` (Periodische Kontrolle)
- **Geschlossen / Erledigt**: `green` (Risiko gelöst / Maßnahme umgesetzt)
- **Überfällig** (Maßnahmen): `red` (Fälligkeitsdatum überschritten)

### 9.4 Layout & Abstände (Spacings)
- Die Anwendung basiert auf einem konsistenten **8px-Layout-Grid**.
- Komponenten-Abstände (Gaps, Margins, Paddings) nutzen standardmäßig folgende Abstufungen:
  - `8px` (Kompakt / Sub-Elemente)
  - `12px` / `16px` (Standard für Cards und Toolbars)
  - `24px` (Abstand zwischen großen Sektionen und Titeln)
- Fokuszustände und Tastaturbedienung verwenden standardmäßig einen scharf abgegrenzten, blauen Rahmen (`#6658d9` mit `rgba` Glow) für Barrierefreiheit.
