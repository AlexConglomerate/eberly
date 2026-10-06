// The playground itself: spec editor on the left, the test and the generated
// client on the right. The spec is turned into a client right here in the
// browser (parseSpecText + buildClient from the library), on blur and on
// Cmd/Ctrl+S. Loaded lazily by Playground.tsx together with Monaco.

import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import { buildClient } from '../../../src/generator/pipeline'
import { parseSpecText } from '../../../src/generator/parse'
import { track } from '../lib/analytics'
import { countTestErrors, example, models, monaco, paths, setGeneratedSource } from './monaco'

type Tab = 'test' | 'generated'

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
} satisfies monaco.editor.IStandaloneEditorConstructionOptions

export function Workbench() {
  const [tab, setTab] = useState<Tab>('test')
  const [error, setError] = useState<string | null>(null)
  const [typeErrors, setTypeErrors] = useState<number | null>(null)
  const [theme, setTheme] = useState(currentTheme)
  const fileInput = useRef<HTMLInputElement>(null)
  // The spec text the current client was built from: blur without edits is a no-op.
  const builtFrom = useRef<string | null>(null)
  // Only the latest type check may update the counter.
  const checkId = useRef(0)

  async function refreshTypeErrors(): Promise<void> {
    const id = ++checkId.current
    setTypeErrors(null)
    const count = await countTestErrors()
    if (id !== checkId.current) return
    setTypeErrors(count)
    if (count > 0) trackTypeErrorOnce()
  }

  async function regenerate(args: { byUser: boolean }): Promise<void> {
    const text = models.spec.getValue()
    if (text === builtFrom.current) return
    try {
      const spec = await parseSpecText({ text, source: 'the editor' })
      const { source } = buildClient({ spec, mode: 'test', userStoreImport: 'eberly', configImport: './eberly' })
      setGeneratedSource({ source })
      builtFrom.current = text
      setError(null)
      void refreshTypeErrors()
      if (args.byUser) track({ name: 'playground_regenerate' })
    } catch (e) {
      // The right side keeps the last client that was built.
      builtFrom.current = text
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Builds the client of the example on load.
  useEffect(() => {
    void regenerate({ byUser: false })
  }, [])

  // Re-counts type errors after the test is edited (debounced like Monaco's own check).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const subscription = models.test.onDidChangeContent(() => {
      clearTimeout(timer)
      timer = setTimeout(() => void refreshTypeErrors(), 500)
    })
    return () => {
      clearTimeout(timer)
      subscription.dispose()
    }
  }, [])

  // Follows Starlight's light/dark switch.
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const onSpecMount: OnMount = (editor) => {
    editor.onDidBlurEditorText(() => void regenerate({ byUser: true }))
    editor.addAction({
      id: 'eberly.regenerate',
      label: 'Regenerate the client',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => regenerate({ byUser: true }),
    })
  }

  // Cmd/Ctrl+S in the test editor must not open the browser's "Save page".
  const onTestMount: OnMount = (editor) => {
    editor.addAction({
      id: 'eberly.save',
      label: 'Save',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {},
    })
  }

  function onUpload(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    // Read locally: the spec is never sent anywhere.
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result)
      setSpec({ text })
      track({ name: 'playground_upload_spec' })
      void regenerate({ byUser: false })
    }
    reader.readAsText(file)
  }

  function onReset(): void {
    setSpec({ text: example.spec })
    models.test.setValue(example.test)
    void regenerate({ byUser: false })
  }

  return (
    <div className="pg">
      <section className="pg-pane">
        <header className="pg-bar">
          <span className="pg-file">openapi.yaml</span>
          <span className="pg-hint">Edit, then click outside or press ⌘/Ctrl+S</span>
        </header>
        <div className="pg-editor">
          <Editor path={paths.spec} theme={theme} options={EDITOR_OPTIONS} onMount={onSpecMount} />
        </div>
        {error && (
          <p className="pg-error" role="alert">
            {error}
          </p>
        )}
        <footer className="pg-bar">
          <button type="button" onClick={() => fileInput.current?.click()}>
            Upload spec
          </button>
          <button type="button" onClick={onReset} title="Restore the example spec and test">
            Reset
          </button>
          <span className="pg-hint">Your spec never leaves the browser</span>
          <input ref={fileInput} type="file" accept=".json,.yaml,.yml" hidden onChange={onUpload} />
        </footer>
      </section>

      <section className="pg-pane">
        <header className="pg-bar" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'test'} onClick={() => setTab('test')}>
            example.test.ts
          </button>
          <button type="button" role="tab" aria-selected={tab === 'generated'} onClick={() => setTab('generated')}>
            generated.ts
          </button>
        </header>
        <div className="pg-editor">
          <Editor
            path={tab === 'test' ? paths.test : paths.generated}
            theme={theme}
            options={{ ...EDITOR_OPTIONS, readOnly: tab === 'generated' }}
            onMount={onTestMount}
          />
        </div>
        <footer className="pg-bar">
          <TypeErrors count={typeErrors} />
        </footer>
      </section>
    </div>
  )
}

function TypeErrors({ count }: { count: number | null }) {
  if (count === null) return <span className="pg-status">Checking types…</span>
  if (count === 0) return <span className="pg-status pg-ok">✓ No type errors</span>
  return (
    <span className="pg-status pg-bad">
      ● {count} type {count === 1 ? 'error' : 'errors'}
    </span>
  )
}

/** Replaces the spec text; JSON gets JSON highlighting, everything else YAML. */
function setSpec({ text }: { text: string }): void {
  models.spec.setValue(text)
  monaco.editor.setModelLanguage(models.spec, text.trim().startsWith('{') ? 'json' : 'yaml')
}

function currentTheme(): 'vs' | 'vs-dark' {
  if (typeof document === 'undefined') return 'vs-dark'
  return document.documentElement.dataset.theme === 'light' ? 'vs' : 'vs-dark'
}

const TYPE_ERROR_KEY = 'eberly:playground_type_error_shown'
let typeErrorTracked = false

/** `playground_type_error_shown` once per session. */
function trackTypeErrorOnce(): void {
  if (typeErrorTracked) return
  typeErrorTracked = true
  try {
    if (sessionStorage.getItem(TYPE_ERROR_KEY)) return
    sessionStorage.setItem(TYPE_ERROR_KEY, '1')
  } catch {
    // No sessionStorage (private mode, blocked storage): once per page load.
  }
  track({ name: 'playground_type_error_shown' })
}
