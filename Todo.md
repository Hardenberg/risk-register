# Projekt-Todos

Stand: 8. Juli 2026

## Ausgangslage

Das Projekt besteht aus einer Electron-/React-/Ant-Design-Anwendung und einem lokalen
Fastify-Server mit Clean Architecture, SQLite, OpenAPI und einer Bootstrap-Übersicht.
Die Schichten `domain`, `application`, `infrastructure` und `interfaces` sind sinnvoll
getrennt. SQL-Werte werden parametrisiert, Electron verwendet bereits
`contextIsolation: true` und `nodeIntegration: false`, und externe UI-Ressourcen werden
lokal gebündelt.

Aktuell erfolgreich geprüft:

- TypeScript-Strict-Mode für Electron, Server und Server-Webseite
- Server-Build und Electron-Build
- sechs Server-/OpenAPI-/SQLite-Integrationstests
- `npm audit` im Root, in `electron` und in `server`: keine bekannten Schwachstellen

## P0 – vor einer produktiven oder netzwerkweiten Nutzung

- [ ] **Zugriff auf schreibende API-Endpunkte absichern.**
  Solange ausschließlich an `127.0.0.1` gebunden wird, ist das Risiko begrenzt, aber
  jeder lokale Prozess kann Risiken anlegen, ändern oder löschen. Vor einer Bindung an
  `0.0.0.0` sind Authentisierung und Autorisierung zwingend. Akzeptanz: POST, PUT und
  DELETE weisen nicht authentisierte Aufrufe mit 401/403 ab; das Security-Schema ist in
  OpenAPI dokumentiert; Secrets stehen nicht im Repository.

- [ ] **Electron-Navigation und Berechtigungen härten.**
  `sandbox: true` setzen, neue Fenster standardmäßig über `setWindowOpenHandler` ablehnen,
  fremde Navigation über `will-navigate` blockieren und einen restriktiven
  `session.setPermissionRequestHandler` einführen. Akzeptanz: Nur die gebündelte
  `file://`-Seite kann geladen werden; Pop-ups, Kamera, Mikrofon, Standort und
  Benachrichtigungen sind ohne explizite Freigabe blockiert.

- [ ] **Risikoreferenzen atomar vergeben.**
  `nextReference()` und `create()` sind derzeit zwei getrennte Schritte. Zwei parallele
  Requests können dieselbe Referenz berechnen. Vergabe in eine SQLite-Transaktion oder
  eine dedizierte Sequenz verschieben und Unique-Constraint-Konflikte kontrolliert
  wiederholen. Akzeptanz: Ein Paralleltest mit mindestens 50 POST-Requests erzeugt nur
  eindeutige Referenzen und keine 500-Antwort.

- [ ] **SQLite-Migrationen aus dem Repository-Code lösen.**
  Versionierte, einzeln nachvollziehbare Migrationen mit Transaktion, Rollback und
  automatischem Backup vor Schemaänderungen einführen. Demo-Daten dürfen nicht Teil der
  Produktionsmigration sein. Akzeptanz: Migration einer alten Testdatenbank sowie
  Wiederanlauf nach einem simulierten Fehler sind automatisiert getestet.

- [ ] **HTTP-Sicherheitsgrenzen explizit konfigurieren.**
  `@fastify/helmet`, Rate Limiting, ein dokumentiertes Body-Limit und eine konfigurierbare
  Origin-Allowlist ergänzen. Die aktuelle Freigabe für Origin `null` ist für Electron
  nötig, sollte aber mit einem lokalen App-Token kombiniert werden. Akzeptanz: Security-
  Header und Limits werden in Integrationstests geprüft.

## P1 – Stabilität, Wartbarkeit und Datenqualität

- [ ] **OpenAPI als einzige Quelle für Client-Typen verwenden.**
  `Risk` und `RiskStatus` sind in Server, Electron und Bootstrap-Client mehrfach definiert.
  Aus `openapi.yaml` einen typisierten Client generieren und Drift in CI erkennen.
  Akzeptanz: UI-Projekte enthalten keine manuell duplizierten API-DTOs mehr.

- [ ] **API um Pagination, Filter und Sortierung erweitern.**
  `GET /api/risks` lädt aktuell alle Datensätze. Parameter für Seite, Seitengröße,
  Status, Kategorie und Sortierung ergänzen und Obergrenzen setzen. Akzeptanz: Große
  Register werden seitenweise geladen; Query-Parameter und Responses sind in OpenAPI
  dokumentiert und getestet.

- [x] **Ändern und Löschen in der Electron-App implementieren.**
  Die API unterstützt PUT und DELETE, die UI bisher nur Lesen und Anlegen. Bestätigungs-
  dialog, Editierformular und nachvollziehbare Fehlermeldungen sind umgesetzt.

- [ ] **Fachliche Datumsprüfung korrigieren.**
  `Date.parse` akzeptiert normalisierte, aber kalendarisch ungültige Werte wie den
  30. Februar. Jahr, Monat und Tag strikt validieren. Akzeptanz: Schaltjahre und
  Monatsgrenzen sind durch Domain-Unit-Tests abgedeckt.

- [ ] **Fehlerantworten vervollständigen.**
  SQLite-Constraint-Konflikte als 409 statt 500 abbilden und ein konsistentes
  Problem-Details-Format verwenden. Interne Fehler dürfen keine vertraulichen Details
  an Clients senden; Logs sollen die technische Ursache dennoch enthalten.

- [ ] **Health und Readiness trennen.**
  `/health` prüft derzeit nur den Prozess, obwohl die Beschreibung SQLite erwähnt.
  Liveness und Readiness separat anbieten; Readiness soll eine harmlose Datenbankabfrage
  ausführen und bei Fehlern 503 liefern.

- [ ] **Tests isolieren und ausbauen.**
  Der CRUD-Test hängt derzeit von fünf Seed-Datensätzen und `R-025` ab. Für jeden Test
  eine eigene In-Memory-Datenbank verwenden. Zusätzlich Domain-/Use-Case-Unit-Tests,
  Parallelitäts-, CORS-, CSP-, Electron- und Browser-End-to-End-Tests ergänzen.

- [ ] **CI-Pipeline einrichten.**
  Auf jedem Pull Request Installation per `npm ci`, Typecheck, Tests, Builds,
  `npm audit`, OpenAPI-Driftprüfung und Artefaktprüfung ausführen. Akzeptanz: Ein
  veraltetes `openapi.yaml` oder ein fehlerhafter Build blockiert den Merge.

- [ ] **Linting und Formatierung standardisieren.**
  ESLint mit TypeScript-/React-Regeln und Prettier oder eine gleichwertige Lösung
  ergänzen. Regeln für Floating Promises, unsichere Typen, React Hooks und Importreihenfolge
  aktivieren. Root-Skripte `lint`, `typecheck`, `test` und `build` sollen beide Teilprojekte
  ausführen.

- [ ] **npm-Workspaces prüfen.**
  Derzeit existieren drei Lockfiles und separate Installationen. Electron und Server als
  Workspaces verwalten oder die bewusste Trennung dokumentieren. Akzeptanz: reproduzierbare
  Installation mit einem dokumentierten Root-Befehl.

- [ ] **Konfiguration validieren.**
  `PORT`, `HOST`, `DATABASE_PATH` und `VITE_API_URL` beim Start gegen ein Schema prüfen.
  Ungültige Ports oder unsichere Netzwerkbindungen sollen mit einer klaren Meldung
  abbrechen.

- [ ] **Logging und Korrelation verbessern.**
  Request-ID bis in Use Cases/Fehlerlogs übernehmen, sensible Felder redigieren und
  Log-Level konfigurierbar machen. Keine personenbezogenen Risikodaten ungefiltert loggen.

## UI/UX – konkrete Elemente

- [x] **[P1] Risiko-Detailansicht als Drawer ergänzen.**
  Ein Klick auf eine Tabellenzeile öffnet Referenz, Beschreibung, Kategorie,
  Verantwortliche, Initial-/Aktuellwert, Status, Fälligkeit und Zeitstempel. Der Drawer
  besitzt klar getrennte Aktionen für Bearbeiten und Löschen und ist per Escape sowie
  Tastaturfokus vollständig bedienbar.

- [ ] **[P1] Erfassungs- und Bearbeitungsformular vervollständigen.**
  Status, aktueller Risikowert, Fälligkeitsdatum und eine optionale Beschreibung ergänzen.
  Ant-Design-DatePicker statt Freitext verwenden, Feldfehler direkt am Eingabefeld zeigen
  und das Speichern während des Requests sperren. Ungespeicherte Änderungen müssen vor
  dem Schließen bestätigt werden.

- [x] **[P1] Löschen mit sicherem Bestätigungsdialog umsetzen.**
  Dialog zeigt Referenz und Titel des betroffenen Risikos, verwendet eine destruktive
  Primäraktion und verhindert Doppelklicks. Nach Erfolg Tabelle und Kennzahlen
  aktualisieren; bei 404/409 einen verständlichen Konflikthinweis zeigen.

- [x] **[P1] Dashboard-Filter funktionsfähig machen.**
  Der sichtbare Filter-Button im Dashboard enthält derzeit nur statische Menüeinträge.
  Status, Kritikalität, Kategorie, Verantwortliche und Fälligkeit tatsächlich anwenden;
  aktive Filter als entfernbare Chips darstellen und eine Aktion „Alle zurücksetzen“
  anbieten.

- [ ] **[P1] Navigation ehrlich abbilden.**
  „Maßnahmen“, „Berichte“, „Team“ und „Einstellungen“ führen derzeit zu keiner Ansicht.
  Bis zur Implementierung als „Demnächst“ markieren oder deaktivieren; anschließend
  echtes Routing mit wiederherstellbarer aktiver Seite einführen.

- [ ] **[P1] Verbindungsstatus zum Server anzeigen.**
  Einen unaufdringlichen Online-/Offline-Indikator auf Basis von Readiness ergänzen.
  Bei Verbindungsverlust letzte erfolgreiche Daten sichtbar lassen, Zeitpunkt der letzten
  Synchronisierung nennen und eine manuelle Wiederholung anbieten.

- [ ] **[P1] Lade-, Leer- und Fehlerzustände vereinheitlichen.**
  Tabellen-Skeleton, echte leere Ansicht mit „Erstes Risiko erfassen“, Offline-Zustand und
  Retry-Komponente als gemeinsame UI-Bausteine verwenden. Keine Kennzahl darf während des
  Ladens irreführend `0` anzeigen.

- [ ] **[P1] Tabellenbedienung erweitern.**
  Serverseitige Pagination, Sortierung und Filter anbinden; Spalten ein-/ausblendbar und
  Breiten persistent machen. Die aktuelle Auswahl und Seite sollen nach Bearbeitung oder
  Refresh erhalten bleiben.

- [ ] **[P1] Erfolgs- und Fehlermeldungen standardisieren.**
  Gemeinsame Toast-Texte für Erstellen, Ändern und Löschen definieren. Technische
  Fehlermeldungen nicht ungefiltert anzeigen; bei Fehlern eine korrelierbare Request-ID
  und eine sinnvolle nächste Aktion anbieten.

- [ ] **[P2] 5×5-Risikomatrix visualisieren.**
  Eintrittswahrscheinlichkeit und Auswirkung als eigene fachliche Werte modellieren und
  Risiken in einer barrierefreien Heatmap darstellen. Jede Zelle benötigt neben Farbe
  auch Text/Zahl, Tooltip und Tastaturzugriff.

- [ ] **[P2] Maßnahmenansicht implementieren.**
  Pro Risiko Maßnahmen mit Verantwortlichen, Termin und Status anzeigen. Überfällige
  Maßnahmen hervorheben und vom Dashboard direkt in die gefilterte Maßnahmenliste
  navigieren.

- [ ] **[P2] Risikoentwicklung und Audit-Timeline darstellen.**
  Änderungen an Wert, Status, Owner und Termin chronologisch anzeigen. Ein kleines
  Trenddiagramm visualisiert die Wertentwicklung, ohne historische Daten zu überschreiben.

- [ ] **[P2] Berichts-Dashboard ergänzen.**
  Verteilung nach Kategorie/Status, Top-Risiken, überfällige Risiken und zeitliche Trends
  mit zugänglichen Diagrammen anzeigen. Diagramme benötigen Tabellenalternative und
  dürfen nicht nur über Farbe kommunizieren.

- [ ] **[P2] Export-UI anbieten.**
  Aktuelle Filterauswahl als CSV/JSON exportieren und vor dem Export Anzahl sowie Umfang
  bestätigen. Dateiname enthält Datum, Export darf keine intern nicht sichtbaren Felder
  oder Secrets enthalten.

- [ ] **[P2] Responsive Verhalten verbessern.**
  Für schmale Fenster Karten stapeln, Toolbar umbrechen und Tabellen optional als
  kompakte Karten darstellen. Zielgrößen: mindestens 1024×700 in Electron sowie
  Bootstrap-Seite ab 360 px ohne horizontales Abschneiden zentraler Aktionen.

- [ ] **[P2] Design-System dokumentieren.**
  Farben, Abstände, Typografie, Risikostufen, Statusfarben, Fokuszustände und Komponenten-
  Varianten als Tokens definieren. Ant Design und Bootstrap sollen dieselbe fachliche
  Farbbedeutung verwenden; Dark Mode erst nach geprüften Kontrastwerten ergänzen.

- [ ] **[P2] Tastaturkürzel und Fokusmanagement ergänzen.**
  Beispielsweise `Strg+N` für neues Risiko und `/` für Suche. Nach Modal-/Drawer-Schließen
  Fokus zum auslösenden Element zurückgeben; Kürzel dokumentieren und in Eingabefeldern
  keine Browser-/Systemkürzel überschreiben.

- [ ] **[P2] Funktionsumfang der Bootstrap-Seite festlegen.**
  Entscheiden, ob sie bewusst read-only bleibt oder Erstellen/Bearbeiten unterstützen
  soll. Bei read-only diesen Zustand sichtbar kennzeichnen; bei Schreibzugriff dieselben
  Authentisierungs-, Validierungs- und Bestätigungsregeln wie in Electron verwenden.

## P2 – Betrieb und Produktreife

- [ ] **Backup, Restore und Export anbieten.**
  Dokumentierte SQLite-Backups, Integritätsprüfung und Export nach CSV/JSON ergänzen.
  Wiederherstellung regelmäßig automatisiert testen.

- [ ] **Synchrones SQLite bei wachsender Last bewerten.**
  `node:sqlite` blockiert synchron den Event Loop. Für die lokale Einzelplatznutzung ist
  das vertretbar; bei Mehrbenutzerbetrieb Worker Thread oder externes DBMS evaluieren.

- [ ] **Electron paketieren und signieren.**
  Reproduzierbare Installer, Code Signing, Update-Strategie und sichere Release-Pipeline
  definieren. Produktions-Builds dürfen keine DevTools oder unnötigen Debug-Schalter
  aktivieren.

- [ ] **Preload-Skript bereinigen.**
  Das aktuelle Preload-Skript aktualisiert nicht mehr vorhandene Versionsfelder. Entweder
  entfernen oder ausschließlich eine minimale, versionierte API über `contextBridge`
  bereitstellen; keine generischen IPC-Kanäle exponieren.

- [ ] **Barrierefreiheit testen.**
  Tastaturnavigation, sichtbare Fokuszustände, Tabellenbeschriftungen, Kontraste,
  Screenreader-Texte und reduzierte Animationen für Electron und Bootstrap-Seite prüfen.

- [ ] **UI-Zustände und Datenaktualisierung vereinheitlichen.**
  Dashboard und Risikoübersicht verwenden teilweise eigene Filter-/Darstellungslogik.
  Gemeinsame Präsentationsfunktionen und einen Query-Cache mit kontrollierter
  Revalidierung einführen.

- [ ] **Electron-Renderer aufteilen.**
  Der aktuelle Vite-Produktionsbuild erzeugt ein JavaScript-Bundle von rund 1,10 MB
  (ca. 344 KB gzip). Seiten und schwere Ant-Design-Bereiche per Dynamic Import laden und
  Bundlegrößen in CI begrenzen. Akzeptanz: kein initialer Chunk überschreitet das bewusst
  festgelegte Budget; die Vite-Warnung wird durch echte Aufteilung beseitigt.

- [ ] **Dokumentation vervollständigen.**
  Architekturdiagramm, Threat Model, Datenmodell, Konfigurationsreferenz, Backup-Anleitung,
  Entwicklungsworkflow und Release-Prozess ergänzen.
