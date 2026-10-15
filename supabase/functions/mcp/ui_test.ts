import { assert, assertEquals } from 'jsr:@std/assert@1'
import { LIST_VIEW_HTML } from './ui_html.ts'

Deno.test('ui_html.ts is in step with ui/list.html (run node scripts/build-ui.mjs)', async () => {
  const html = (await Deno.readTextFile(new URL('./ui/list.html', import.meta.url))).replace(/\r\n/g, '\n')
  assertEquals(LIST_VIEW_HTML, html)
})

Deno.test('the view fetches nothing from outside and uses no icon font', () => {
  assert(!/<(script|link)[^>]+(src|href)=/i.test(LIST_VIEW_HTML))
  assert(!/\bti ti-/.test(LIST_VIEW_HTML))
})
