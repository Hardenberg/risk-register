# Projekt-Todos

Stand: 13. Juli 2026

## Aktuelle Ausgangslage

Das Projekt besteht aus einer Electron-/React-/Ant-Design-Anwendung und einem lokalen
Fastify-Server mit SQLite, OpenAPI, Bootstrap-Übersicht und klar getrennten Schichten
für Domain, Use Cases, Infrastruktur und HTTP. Die Kernfunktionen sind inzwischen
deutlich weiter als im ursprünglichen Stand:

- Risiken können angelegt, bearbeitet und mit Löschmarkierung entfernt werden.
- Risiken besitzen Beschreibung, Fälligkeit, Review-Datum und Review-Rhythmus.
- Wiederkehrende Review-Daten werden serverseitig berechnet; bei `Fix` ist ein Datum Pflicht.
- Anmeldung mit Benutzername/E-Mail und Passwort ist vorhanden.
- Benutzerverwaltung, Einstellungen und Rollenprüfung sind für Admins umgesetzt.
- Nutzer können ihr eigenes Profil bearbeiten.
- Maßnahmen sind eigene persistierte Datensätze mit API, Suche, Filtern, Detailansicht, Bearbeiten und Löschen.
- Berichte und Maßnahmenbericht sind in der Electron-App erreichbar.
- Schreibende API-Endpunkte sind per Bearer-Token geschützt.

Zuletzt erfolgreich geprüft:

- `npm.cmd --prefix server run typecheck`
- `npm.cmd --prefix server test` mit 12 Integrationstests
- `npm.cmd --prefix server run docs:generate`
- `npm.cmd --prefix electron run typecheck`
- `npm.cmd --prefix electron run build`

Die Vite-Warnung zum großen Electron-Renderer-Chunk besteht weiterhin.

## Erledigt und vorerst nicht mehr als Todo führen

- [x] Authentisierung für API-Schreibzugriffe
- [x] Login in der Electron-App
- [x] Admin-Benutzerverwaltung inklusive Deaktivieren von Benutzern
- [x] Minimales Admin-Einstellungsset
- [x] Eigenes Profil bearbeiten
- [x] Risiko bearbeiten und löschen mit Nachfrage
- [x] Löschung von Risiken als Löschmarkierung
- [x] Risiko-Beschreibung und Review-Datum
- [x] Konfigurierbarer Review-Rhythmus
- [x] Umschalten aus der Übersicht in die Risikoübersicht
- [x] Maßnahmen-API und Maßnahmen-Tab
- [x] Maßnahmen suchen, filtern, ansehen, bearbeiten und löschen
- [x] Berichtslayout mit Maßnahmenbereich

## P0 - notwendig vor produktiver oder netzwerkweiter Nutzung

- [x] **Electron-Sicherheitsmodell härten.**
  `sandbox: true` ist aktiv, Pop-ups/Webviews werden abgelehnt, Navigation ist auf die
  gebündelte Renderer-Datei begrenzt und Berechtigungsanfragen werden verweigert.
  Ein Electron-Security-Smoke-Test prüft diese Schutzschalter automatisiert.

- [ ] **Token- und Session-Sicherheit nachschärfen.**
  Ablaufzeit für Tokens, Rotation/Logout-Verhalten, sichere Speicherung und Fehlerfälle
  festlegen. Für Netzwerkbetrieb zusätzlich HTTPS/Reverse-Proxy-Annahmen dokumentieren.
  Akzeptanz: Tokens laufen ab, deaktivierte Benutzer verlieren Zugriff zuverlässig,
  und ein Security-Test deckt abgelaufene/deaktivierte Sessions ab.

- [ ] **HTTP-Sicherheitsgrenzen konfigurieren.**
  `@fastify/helmet`, Rate Limiting, Body-Limits und eine konfigurierbare Origin-Allowlist
  ergänzen. Die Freigabe für Electron-Origin `null` bleibt bewusst, sollte aber klar
  dokumentiert und begrenzt sein. Akzeptanz: Header, Limits und 429-Fälle sind getestet.

- [ ] **Risikoreferenzen atomar vergeben.**
  Die Referenzvergabe darf bei parallelen Requests keine doppelte `R-xxx` erzeugen.
  Sequenz oder SQLite-Transaktion verwenden und Konflikte kontrolliert wiederholen.
  Akzeptanz: Paralleltest mit mindestens 50 POST-Requests erzeugt eindeutige Referenzen.

- [ ] **Migrationen und Seed-Daten trennen.**
  Die aktuelle Migration ist funktionsfähig, aber weiter im Code gebündelt. Versionierte
  Migrationen, Backup vor Schemaänderungen und getrennte Demo-/Produktionsdaten einführen.
  Akzeptanz: Migration einer alten Testdatenbank und Fehler-Rollback sind automatisiert
  geprüft.

- [ ] **Backup- und Restore-Konzept erstellen.**
  SQLite-Backups, Integritätsprüfung, Restore-Prozess und Exportumfang festlegen.
  Akzeptanz: Ein automatisierter Restore-Test stellt eine Beispiel-Datenbank wieder her.

## P1 - Stabilität, Datenqualität und Wartbarkeit

- [x] **Serverseitige Pagination, Suche, Filter und Sortierung einführen.**
  `GET /api/risks` und `GET /api/measures` liefern paginierte Ergebnisobjekte mit
  `items`, `page`, `pageSize`, `total` und `totalPages`. Suche, Filter und Sortierung
  sind in OpenAPI dokumentiert und durch Integrationstests abgedeckt.

- [ ] **OpenAPI als Quelle für Client-Typen nutzen.**
  DTOs werden in Server, Electron und Bootstrap-Webseite mehrfach definiert. Einen
  generierten TypeScript-Client oder zumindest generierte DTOs einführen.
  Akzeptanz: API-Drift zwischen `openapi.yaml` und Renderer-Typen wird in CI erkannt.

- [ ] **Strikte Kalenderdatumsvalidierung ergänzen.**
  Datumsfelder sollten nicht nur Format `YYYY-MM-DD`, sondern echte Kalenderdaten prüfen.
  Akzeptanz: Schaltjahre, Monatsgrenzen und ungültige Daten sind durch Domain-Tests
  abgedeckt.

- [ ] **Fehlerantworten vereinheitlichen.**
  Constraint-Konflikte wie doppelte Benutzername/E-Mail/Referenz als 409 statt 400/500
  abbilden und ein konsistentes Problem-Details-Format einführen.
  Akzeptanz: Clients erhalten stabile Fehlercodes; technische Details bleiben in Logs.

- [ ] **Health und Readiness trennen.**
  `/health` bleibt Liveness; ein Readiness-Endpunkt prüft SQLite und liefert bei Problemen
  503. Akzeptanz: Integrationstest simuliert eine nicht verfügbare Datenbank.

- [ ] **Tests isolieren und fachlich ausbauen.**
  Integrationstests hängen noch an Seed-Daten und teilen sich teils App-Zustand.
  Pro Test isolierte Datenbank, Domain-/Use-Case-Unit-Tests, Parallelitätstests und
  UI-Smoke-Tests ergänzen.

- [ ] **CI-Pipeline einrichten.**
  `npm ci`, Typecheck, Tests, Builds, OpenAPI-Driftprüfung, `npm audit` und Artefaktprüfung
  auf Pull Requests ausführen. Akzeptanz: veraltete OpenAPI oder fehlerhafte Builds
  blockieren den Merge.

- [ ] **Linting und Formatierung standardisieren.**
  ESLint/Prettier oder gleichwertige Regeln für TypeScript, React Hooks, Floating Promises,
  Imports und unsichere Typen einführen. Root-Skripte für `lint`, `typecheck`, `test`,
  `build` ergänzen.

- [ ] **Projektstruktur und Paketverwaltung entscheiden.**
  Aktuell existieren getrennte Teilprojekte. Entweder npm-Workspaces einführen oder die
  bewusste Trennung samt Installationsworkflow dokumentieren.

- [ ] **Konfiguration validieren.**
  `PORT`, `HOST`, `DATABASE_PATH`, `AUTH_TOKEN_SECRET` und `VITE_API_URL` beim Start gegen
  ein Schema prüfen. Unsichere Netzwerkbindung ohne passende Sicherheitskonfiguration soll
  mit klarer Meldung abbrechen.

- [ ] **Logging und Korrelation verbessern.**
  Request-ID, Log-Level-Konfiguration und Redaction für Passwörter/Tokens/personenbezogene
  Felder ergänzen. Akzeptanz: Fehlerantwort enthält eine korrelierbare ID, Logs bleiben
  intern aussagekräftig.

## P1 - UI/UX mit unmittelbarem Nutzen

- [x] **Ungespeicherte Änderungen absichern.**
  Risiko-, Maßnahmen-, Benutzer-, Einstellungen- und Profilformulare fragen beim Verwerfen
  geänderter Werte nach. Einstellungen schützen zusätzlich Reload, Navigation und Fenster-Reload.

- [x] **DatePicker statt Freitext-Datum verwenden.**
  Risiko- und Maßnahmenformulare nutzen Ant-Design-DatePicker mit deutscher Anzeige
  und API-konformer Speicherung als `YYYY-MM-DD`.

- [ ] **Server-Verbindungsstatus anzeigen.**
  Einen unaufdringlichen Online-/Offline-Indikator auf Basis von Readiness ergänzen.
  Letzte erfolgreiche Synchronisierung anzeigen und Retry anbieten.

- [x] **Lade-, Leer- und Fehlerzustände vereinheitlichen.**
  Gemeinsame Komponenten für Skeleton, leere Ansicht, Retry/Offline-Hinweise und
  Lade-Kennzahlen sind in Dashboard, Risiken, Maßnahmen, Berichten und Admin-Ansichten im Einsatz.

- [x] **Tabellenzustand persistieren.**
  Risiko-, Maßnahmen- und Benutzer-Tabellen behalten Suche/Filter, Sortierung, Seite und
  geänderte Spaltenbreiten je Ansicht in `localStorage`.

- [x] **Dashboard-Verknüpfungen vertiefen.**
  Kritische Risiken, offene Maßnahmen sowie fällige/überfällige Maßnahmen springen aus dem
  Dashboard in die passende Übersicht und setzen dort einen sichtbaren Filter.

- [ ] **Profil-UX abrunden.**
  Aktuelles Passwort vor Passwortänderung abfragen, Passwortbestätigung ergänzen und nach
  Änderung optional alle anderen Sessions invalidieren.

- [ ] **Barrierefreiheit prüfen.**
  Tastaturbedienung, sichtbarer Fokus, Drawer-/Modal-Fokusführung, Screenreader-Texte,
  Kontraste und Tabellenbeschriftungen prüfen.

- [ ] **Bootstrap-Serverseite fachlich festlegen.**
  Entscheiden, ob sie bewusst read-only bleibt oder Login/Schreibzugriff erhält.
  Bei read-only klar kennzeichnen; bei Schreibzugriff dieselben Auth- und Validierungsregeln
  wie in Electron verwenden.

## P2 - Fachliche Erweiterungen

- [ ] **Maßnahmen enger an Risiken koppeln.**
  Optional automatische Vorschläge aus kritischen Risiken erzeugen, Maßnahmenstatus in der
  Risiko-Detailansicht anzeigen und direkte Navigation Risiko -> Maßnahmen ermöglichen.

- [ ] **Audit-Timeline einführen.**
  Änderungen an Risiko, Maßnahme, Benutzer und Einstellungen chronologisch speichern und
  anzeigen. Akzeptanz: Wer/Was/Wann ist nachvollziehbar, ohne nur `updatedAt` zu nutzen.

- [ ] **Risikohistorie und Trenddiagramme ergänzen.**
  Historische Werte für `currentScore`, Status und Review speichern und als Trend darstellen.

- [ ] **5x5-Risikomatrix modellieren.**
  Eintrittswahrscheinlichkeit und Auswirkung als eigene Werte führen und daraus Score
  berechnen. Matrix barrierefrei mit Text, Tooltip und Tastaturzugriff darstellen.

- [ ] **Berichte ausbauen.**
  Zeitraumfilter mit echten historischen Daten, überfällige Reviews/Maßnahmen, Top-Risiken,
  Kategorien und Export vorbereiten. Diagramme brauchen Tabellenalternative.

- [ ] **Export anbieten.**
  CSV/JSON-Export für Risiken, Maßnahmen und Berichte mit aktueller Filterauswahl,
  Umfangsbestätigung und datenschutzbewusster Feldauswahl.

- [ ] **Benachrichtigungen und Erinnerungen planen.**
  Review- und Maßnahmenfälligkeiten als lokale App-Hinweise oder Berichtsliste anbieten.
  Spätere E-Mail/Teams-Integration nur mit klarer Konfiguration.

## P2 - Betrieb und Produktreife

- [ ] **Electron paketieren, signieren und Release-Prozess definieren.**
  Installer, Code Signing, Update-Strategie und sichere Release-Pipeline festlegen.
  Produktions-Builds dürfen keine DevTools oder unnötigen Debug-Schalter aktivieren.

- [ ] **Preload-Skript bereinigen.**
  Das aktuelle Preload-Skript schreibt Versionen in DOM-Elemente, die im Renderer kaum noch
  fachlichen Nutzen haben. Entfernen oder auf eine minimale, versionierte `contextBridge`-API
  reduzieren.

- [ ] **Renderer-Bundle aufteilen.**
  Der Electron-Build erzeugt weiterhin einen großen initialen Chunk. Views dynamisch laden
  und ein bewusstes Bundle-Budget in CI prüfen.

- [ ] **Synchrones SQLite bei Mehrbenutzerlast bewerten.**
  `node:sqlite` blockiert synchron den Event Loop. Für lokale Einzelplatznutzung vertretbar;
  bei Netzwerk-/Mehrbenutzerbetrieb Worker Thread oder anderes DBMS evaluieren.

- [ ] **Dokumentation vervollständigen.**
  Architektur, Datenmodell, Rollenmodell, API-Nutzung, Konfiguration, Backup/Restore,
  Sicherheitsannahmen, Entwicklungsworkflow und Release-Prozess dokumentieren.

- [ ] **Design-System dokumentieren.**
  Farben, Abstände, Typografie, Risikostufen, Statusfarben, Fokuszustände und Komponenten-
  Varianten als Tokens definieren. Ant Design und Bootstrap sollen dieselbe fachliche
  Farbbedeutung verwenden.
