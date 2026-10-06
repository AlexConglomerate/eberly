// The playground island. The server renders a placeholder; in the browser
// the workbench and Monaco (~MBs) are fetched with a dynamic import, so the
// page around it does not wait for them.

import { useEffect, useState, type ComponentType } from 'react'

import './playground.css'

export default function Playground() {
  const [Workbench, setWorkbench] = useState<ComponentType | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    import('./Workbench').then(
      (module) => setWorkbench(() => module.Workbench),
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
