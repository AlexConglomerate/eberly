// Analytics events of the site, sent to Umami Cloud (the script is added in
// `astro.config.mjs` and only tracks on eberly.dev). Events carry a name only:
// never the spec, its file name or the test code.

export type EventName =
  | 'playground_regenerate'
  | 'playground_upload_spec'
  | 'playground_type_error_shown'
  | 'copy_install'

declare global {
  interface Window {
    umami?: { track: (name: string) => void }
  }
}

export function track({ name }: { name: EventName }): void {
  window.umami?.track(name)
}
