# risk-register
A risk register 

## Anwendung starten

Im Projektordner werden Server und Electron-App gemeinsam gestartet:

```powershell
npm.cmd install
npm.cmd run dev
```


## Node.js ohne Adminrechte einrichten

Für die Entwicklung wird Node.js benötigt. Wenn keine Adminrechte vorhanden sind, kann die ZIP-Version von Node.js verwendet und manuell in den Benutzer- bzw. Projektpfad eingebunden werden.

### 1. Node.js entpacken

Die Node.js ZIP-Version wurde nach folgendem Pfad entpackt:

```text
C:\_src\node\node
```

In diesem Ordner muss die Datei `node.exe` liegen:

```text
C:\_src\node\node\node.exe
```

### 2. Node.js temporär zum PATH hinzufügen

Für das aktuelle PowerShell-Fenster kann Node.js temporär eingebunden werden:

```powershell
$env:Path += ";C:\_src\node\node"
```

Anschließend prüfen:

```powershell
node -v
```

### 3. Node.js dauerhaft für den Benutzer eintragen

Ohne Adminrechte kann der Pfad dauerhaft in den Benutzer-PATH geschrieben werden:

```powershell
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\_src\node\node",
  "User"
)
```

Danach PowerShell vollständig schließen und neu öffnen.

Prüfen:

```powershell
where.exe node
node -v
```

### 4. npm in PowerShell verwenden

Falls bei `npm -v` folgende Meldung erscheint:

```text
npm.ps1 kann nicht geladen werden, da die Datei nicht digital signiert ist.
```

liegt das an der PowerShell Execution Policy.

Sofortlösung:

```powershell
npm.cmd -v
```

Auch weitere npm-Befehle können dann mit `npm.cmd` ausgeführt werden:

```powershell
npm.cmd install
npm.cmd run dev
```

Alternativ kann die Ausführungsrichtlinie nur für das aktuelle PowerShell-Fenster gelockert werden:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Danach funktioniert in diesem Fenster auch:

```powershell
npm -v
```

### Empfehlung

Für dieses Projekt reicht ohne Adminrechte folgende Nutzung aus:

```powershell
node -v
npm.cmd -v
npm.cmd install
npm.cmd run dev
```
