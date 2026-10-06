// Analytics events of the site. A no-op for now: task 05 wires it to Umami.
// Events carry a name only: never the spec, its file name or the test code.

export type EventName = 'playground_regenerate' | 'playground_upload_spec' | 'playground_type_error_shown'

export function track({ name }: { name: EventName }): void {
  void name
}
