import { assert, assertEquals } from 'jsr:@std/assert@1'
import { LIST_VIEW_HASH, LIST_VIEW_HTML } from './ui_html.ts'

Deno.test('ui_html.ts is in step with ui/list.html (run node scripts/build-ui.mjs)', async () => {
  const html = (await Deno.readTextFile(new URL('./ui/list.html', import.meta.url))).replace(/\r\n/g, '\n')
  assertEquals(LIST_VIEW_HTML, html)
})

Deno.test('the view fetches nothing from outside and uses no icon font', () => {
  assert(!/<(script|link)[^>]+(src|href)=/i.test(LIST_VIEW_HTML))
  assert(!/\bti ti-/.test(LIST_VIEW_HTML))
})

Deno.test('the view address hash matches the HTML', async () => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(LIST_VIEW_HTML))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  assertEquals(LIST_VIEW_HASH, hex.slice(0, 8))
})
