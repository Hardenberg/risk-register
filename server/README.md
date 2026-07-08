# Risk Register Server

Der Server basiert auf Fastify und TypeScript und läuft direkt mit Node.js, ohne Docker.

Die Risiko-API folgt Clean Architecture: `domain` enthält Entitäten und Repository-Ports,
`application` die Use Cases, `infrastructure` die SQLite-Implementierung und `interfaces`
die Fastify-HTTP-Adapter. Die SQLite-Datei wird unter `data/risk-register.db` angelegt.

## Installation und Start

```powershell
npm.cmd install
npm.cmd run dev
```

Für den normalen Start ohne automatischen Neustart:

```powershell
npm.cmd start
```

Danach sind folgende Endpunkte verfügbar:

- Bootstrap-Übersicht: http://localhost:8000/
- Health Check: http://localhost:8000/health
- API-Dokumentation: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/docs/json
- OpenAPI YAML: http://localhost:8000/docs/yaml

Das versionierbare OpenAPI-Dokument neu erzeugen:

```powershell
npm.cmd run docs:generate
```

## Risiko-Endpunkte

- `GET /api/risks`
- `GET /api/risks/:id`
- `POST /api/risks`
- `PUT /api/risks/:id`
- `DELETE /api/risks/:id`

Ein anderer Port kann über die Umgebungsvariable `PORT` gesetzt werden:

```powershell
$env:PORT = 8080
npm.cmd start
```

Tests ausführen:

```powershell
npm.cmd test
```
