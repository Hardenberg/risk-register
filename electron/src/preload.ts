/** Ersetzt den Text eines optional vorhandenen Elements, ohne bei fehlenden Elementen abzubrechen. */
function replaceText (selector: string, text: string): void {
  const element = document.getElementById(selector)
  if (element) element.innerText = text
}

/** Überträgt ausschließlich nicht-sensitive Laufzeitversionen in dafür vorgesehene DOM-Felder. */
function renderRuntimeVersions (): void {
  for (const type of ['chrome', 'node', 'electron'] as const) {
    replaceText(`${type}-version`, process.versions[type])
  }
}

window.addEventListener('DOMContentLoaded', renderRuntimeVersions)
