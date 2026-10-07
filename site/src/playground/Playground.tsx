// The playground island. The server renders a placeholder; in the browser
// the workbench and Monaco (~MBs) are fetched with a dynamic import, so the
// page around it does not wait for them.
//
// Monaco's own styles come as `import './x.css'` inside its modules, and the
// Astro build drops CSS that is reachable only through a dynamic import (in
// `astro dev` it works, in production the editor breaks). So the bundled
// stylesheet is linked here by hand, also lazily: ~130 KB gzip with the icon
// font, the landing page does not pay for it until the editor is visible.

import { useEffect, useState, type ComponentType } from 'react'

// Not in the package's `exports`, hence the path through node_modules.
import monacoCssUrl from '../../node_modules/monaco-editor/min/vs/editor/editor.main.css?url'
import './playground.css'

export default function Playground() {
  const [Workbench, setWorkbench] = useState<ComponentType | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Monaco measures fonts and lays out on mount: the CSS must be there first.
    Promise.all([import('./Workbench'), loadStylesheet({ href: monacoCssUrl })]).then(
      ([module]) => setWorkbench(() => module.Workbench),
      () => setFailed(true),
    )
  }, [])

  if (Workbench) return <Workbench />
  return (
    <div className="pg pg-loading" aria-busy={!failed}>
      {failed ? 'The playground failed to load. Reload the page to try again.' : 'Loading the editor…'}
    </div>
  )
}

/** Adds `<link rel="stylesheet">` once (two playgrounds on a page share it). */
function loadStylesheet({ href }: { href: string }): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-playground-css]`)
  if (existing?.sheet) return Promise.resolve()
  const link = existing ?? document.createElement('link')
  const loaded = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => reject(new Error(`Failed to load ${href}`)), { once: true })
  })
  if (!existing) {
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.playgroundCss = ''
    document.head.append(link)
  }
  return loaded
}
