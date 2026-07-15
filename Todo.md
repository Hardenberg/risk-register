# Produktivitäts-Roadmap

Stand: 13. Juli 2026

## Zielbild

Die App soll den Alltag im Risikomanagement beschleunigen: schneller erfassen, schneller priorisieren, schneller nachverfolgen und schneller berichten. Technische Aufgaben bleiben wichtig, werden hier aber danach sortiert, ob sie Nutzerzeit sparen, Fehler vermeiden oder Routinearbeit automatisieren.

## Bereits Produktivitätswirksam

- [x] Login, Rollen und Admin-Benutzerverwaltung
- [x] Risiken anlegen, bearbeiten und per Löschmarkierung entfernen
- [x] Risiko-Beschreibung, Review-Datum und konfigurierbarer Review-Rhythmus
- [x] Maßnahmen anlegen, suchen, filtern, ansehen, bearbeiten und löschen
- [x] Dashboard-Sprünge in vorgefilterte Risiko- und Maßnahmenansichten
- [x] Tabellenzustand je Ansicht speichern
- [x] Einheitliche Lade-, Leer- und Fehlerzustände
- [x] Ungespeicherte Änderungen absichern
- [x] DatePicker statt Freitext-Datum
- [x] Berichtslayout mit Maßnahmenbereich
- [x] Electron-Sicherheitsmodell gehärtet

Zuletzt erfolgreich geprüft:

- `npm.cmd --prefix server run typecheck`
- `npm.cmd --prefix server test`
- `npm.cmd --prefix server run docs:generate`
- `npm.cmd --prefix electron run typecheck`
- `npm.cmd --prefix electron run build`
- `npm.cmd --prefix electron run security:smoke`

Die Vite-Warnung zum großen Electron-Renderer-Chunk besteht weiterhin.

## P0 - Produktivität Ohne Datenverlust

- [x] **Backup, Restore und Export priorisieren.**
  Nutzer brauchen Sicherheit, bevor sie mehr Daten produktiv pflegen. SQLite-Backup, Restore-Test und manuellen Export für Risiken/Maßnahmen bereitstellen.
  Akzeptanz: Ein Admin kann ein Backup auslösen, ein Restore-Test stellt eine Beispiel-Datenbank wieder her, und CSV/JSON-Export nutzt aktuelle Filter.

- [x] **Risikoreferenzen atomar vergeben.**
  Doppelte Referenzen zerstören Vertrauen und Suchbarkeit. Referenzvergabe in Sequenz oder SQLite-Transaktion verschieben.
  Akzeptanz: Paralleltest mit mindestens 50 Risiko-Erstellungen erzeugt eindeutige Referenzen.

- [x] **Token- und Session-Verhalten produktionsfähig machen.**
  Abgelaufene/deaktivierte Sessions sollen klar und zuverlässig behandelt werden.
  Akzeptanz: Tokens laufen ab, deaktivierte Benutzer verlieren Zugriff, Logout ist konsistent, Tests decken diese Fälle ab.

- [x] **Migrationen von Demo-Daten trennen.**
  Produktivdaten dürfen nicht von Demo-Seeds oder impliziten Code-Migrationen abhängen.
  Akzeptanz: Versionierte Migrationen laufen transaktional; Demo-Daten sind optional und getrennt.

## P1 - Tägliche Arbeit Beschleunigen

- [ ] **Quick-Create für Maßnahmen aus Risiko heraus.**
  In der Risiko-Detailansicht direkt eine Maßnahme anlegen, mit vorausgewähltem Risiko, Owner-Vorschlag und Priorität aus Risikowert.
  Akzeptanz: Kritisches Risiko -> Maßnahme anlegen benötigt maximal drei Pflichtfelder.

- [ ] **Maßnahmen in Risiko-Detailansicht anzeigen.**
  Nutzer sollen nicht zwischen Tabs springen müssen, um offene Aufgaben zu einem Risiko zu sehen.
  Akzeptanz: Risiko-Drawer zeigt offene/überfällige Maßnahmen und erlaubt Sprung in die gefilterte Maßnahmenansicht.

- [ ] **Arbeitslisten einführen.**
  Eine Ansicht "Meine Aufgaben" bündelt Risiken und Maßnahmen, für die der aktuelle Nutzer verantwortlich ist.
  Akzeptanz: Filter nach "mir zugeordnet", "überfällig", "diese Woche", "kritisch" sind direkt erreichbar.

- [ ] **Review-Queue bauen.**
  Anstehende und überfällige Reviews als eigene Arbeitsliste anzeigen.
  Akzeptanz: Nutzer kann aus der Queue ein Risiko öffnen, Review-Datum/Rhythmus aktualisieren und zur Queue zurückkehren.

- [ ] **Massenaktionen für Routinepflege.**
  Mehrere Risiken oder Maßnahmen auswählen und Status, Owner, Fälligkeit oder Export gesammelt ändern.
  Akzeptanz: Auswahl bleibt nach Aktion nachvollziehbar; destruktive Aktionen brauchen Bestätigung.

- [ ] **Profil-UX abrunden.**
  Aktuelles Passwort vor Passwortänderung abfragen, Passwortbestätigung ergänzen und nach Änderung optional andere Sessions invalidieren.
  Akzeptanz: Passwortänderung ist fehlersicher und erklärt dem Nutzer den Session-Effekt.

## P1 - Orientierung Und Entscheidungsfähigkeit

- [ ] **Server-Verbindungsstatus anzeigen.**
  Online-/Offline-Indikator mit letzter erfolgreicher Synchronisierung und Retry anbieten.
  Akzeptanz: Nutzer sieht, ob Daten aktuell sind, und kann ohne Kontextverlust neu laden.

- [ ] **Dashboard produktiver machen.**
  Dashboard auf echte Arbeitsprioritäten ausrichten: überfällige Maßnahmen, Reviews diese Woche, kritische offene Risiken, eigene Aufgaben.
  Akzeptanz: Jede Kennzahl führt in eine passende, gefilterte Arbeitsliste.

- [ ] **Berichte entscheidungsreif machen.**
  Bericht "Management-Übersicht" mit Top-Risiken, überfälligen Maßnahmen, Review-Lage und Export.
  Akzeptanz: Bericht ist druck-/PDF-freundlich und braucht keine manuelle Nachbearbeitung für ein Statusmeeting.

- [ ] **Benachrichtigungen und Erinnerungen planen.**
  Fällige Reviews und Maßnahmen als lokale Hinweise oder Inbox-Liste anbieten.
  Akzeptanz: Nutzer kann sehen, was Aufmerksamkeit braucht, ohne alle Tabellen zu durchsuchen.

- [ ] **Audit-Timeline nutzbar anzeigen.**
  Änderungen an Risiko, Maßnahme, Benutzer und Einstellungen chronologisch sichtbar machen.
  Akzeptanz: "Wer hat was wann geändert?" ist ohne Datenbankzugriff beantwortbar.

## P1 - Eingabefehler Reduzieren

- [ ] **Strikte Kalenderdatumsvalidierung ergänzen.**
  Server soll echte Kalenderdaten prüfen, nicht nur `YYYY-MM-DD`.
  Akzeptanz: Schaltjahre, Monatsgrenzen und ungültige Daten sind durch Domain-Tests abgedeckt.

- [ ] **Fehlerantworten verständlicher machen.**
  Konflikte wie doppelte E-Mail, Benutzername oder Referenz als klare 409-Antworten mit stabiler Meldung ausgeben.
  Akzeptanz: UI kann Fehler feldnah oder als konkrete Handlungsanweisung anzeigen.

- [ ] **Pflichtfelder und Defaults fachlich nachschärfen.**
  Defaults für Owner, Review-Rhythmus, Priorität und Status aus Einstellungen/aktuellem Nutzer ableiten.
  Akzeptanz: Häufige Erfassung braucht weniger manuelle Eingaben.

- [ ] **Barrierefreiheit prüfen.**
  Tastaturbedienung, Fokusführung, Screenreader-Texte, Kontraste und Tabellenbeschriftungen prüfen.
  Akzeptanz: Risiko- und Maßnahmenworkflow ist ohne Maus bedienbar.

## P2 - Automatisierung Und Skalierung

- [ ] **OpenAPI als Quelle für Client-Typen nutzen.**
  DTO-Duplikate zwischen Server, Electron und Bootstrap-Webseite reduzieren.
  Akzeptanz: API-Drift wird in CI erkannt.

- [ ] **CI-Pipeline einrichten.**
  `npm ci`, Typecheck, Tests, Builds, Security-Smoke, OpenAPI-Driftprüfung und `npm audit` auf Pull Requests ausführen.
  Akzeptanz: fehlerhafte Builds oder veraltete OpenAPI blockieren Merge.

- [ ] **Tests nach Nutzerflows strukturieren.**
  Neben technischen Tests gezielte Flow-Tests für Login, Risikoanlage, Maßnahme, Bericht, Benutzerverwaltung und Einstellungen ergänzen.
  Akzeptanz: Kritische Arbeitsabläufe sind vor Regression geschützt.

- [ ] **Konfiguration validieren.**
  `PORT`, `HOST`, `DATABASE_PATH`, `AUTH_TOKEN_SECRET` und `VITE_API_URL` beim Start prüfen.
  Akzeptanz: Fehlkonfiguration bricht mit verständlicher Meldung ab.

- [ ] **Logging und Support-Fähigkeit verbessern.**
  Request-ID, Log-Level und Redaction für Passwörter/Tokens/personenbezogene Daten ergänzen.
  Akzeptanz: Support kann Fehler korrelieren, ohne sensible Daten offenzulegen.

- [ ] **HTTP-Sicherheitsgrenzen konfigurieren.**
  `@fastify/helmet`, Rate Limiting, Body-Limits und Origin-Allowlist ergänzen.
  Akzeptanz: Header, Limits und 429-Fälle sind getestet.

## P2 - Fachliche Erweiterungen

- [ ] **Risikohistorie und Trenddiagramme ergänzen.**
  Historische Werte für Score, Status und Review speichern und visualisieren.
  Akzeptanz: Entwicklung eines Risikos ist über Zeit nachvollziehbar.

- [ ] **5x5-Risikomatrix modellieren.**
  Eintrittswahrscheinlichkeit und Auswirkung als eigene Werte führen und daraus Score berechnen.
  Akzeptanz: Matrix ist barrierefrei und erlaubt Drilldown in betroffene Risiken.

- [ ] **Export und Berichtspakete ausbauen.**
  Filterbasierte Exporte, Management-PDF und datenschutzbewusste Feldauswahl anbieten.
  Akzeptanz: Statusmeeting kann ohne manuelle Tabellenaufbereitung vorbereitet werden.

- [ ] **Bootstrap-Serverseite fachlich festlegen.**
  Entscheiden, ob sie read-only bleibt oder Login/Schreibzugriff erhält.
  Akzeptanz: Verhalten ist sichtbar, dokumentiert und konsistent mit Electron.

## P3 - Wartbarkeit Und Release-Reife

- [x] **Renderer-Bundle aufteilen.**
  Views dynamisch laden und Bundle-Budget in CI prüfen.
  Akzeptanz: Vite-Chunk-Warnung ist behoben oder bewusst mit Budget dokumentiert.

- [x] **Electron paketieren, signieren und Release-Prozess definieren.**
  Installer, Code Signing, Update-Strategie und sichere Release-Pipeline festlegen.
  Akzeptanz: reproduzierbarer Release ohne DevTools/Debug-Schalter.

- [x] **Preload-Skript bereinigen.**
  Aktuelles Versionen-DOM-Skript entfernen oder auf minimale `contextBridge`-API reduzieren.
  Akzeptanz: Preload enthält nur fachlich benötigte, versionierte Oberfläche.

- [x] **Projektstruktur und Paketverwaltung entscheiden.**
  npm-Workspaces einführen oder getrennte Teilprojekte bewusst dokumentieren.
  Akzeptanz: reproduzierbare Installation mit einem dokumentierten Root-Befehl.

- [x] **Linting und Formatierung standardisieren.**
  ESLint/Prettier oder gleichwertige Regeln einführen.
  Akzeptanz: `lint`, `typecheck`, `test`, `build` sind im Root ausführbar.

- [x] **Dokumentation vervollständigen.**
  Architektur, Datenmodell, Rollen, API, Konfiguration, Backup/Restore, Sicherheit und Entwicklungsworkflow dokumentieren.

- [x] **Design-System dokumentieren.**
  Farben, Abstände, Typografie, Risikostufen, Statusfarben und Fokuszustände als Tokens festhalten.
