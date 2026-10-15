import type { McpServer } from '@modelcontextprotocol/server'
import { LIST_VIEW_HASH, LIST_VIEW_HTML } from './ui_html.ts'

// In-chat view for list (MCP Apps): todos, leads and files views in one resource. The HTML lives in
// ui/list.html (built into ui_html.ts by scripts/build-ui.mjs). See docs/chat-ux-status.md §3.

// The hash changes with the HTML, so hosts that cache views by address fetch a changed view.
export const LIST_VIEW_URI = `ui://cantab-os/list/${LIST_VIEW_HASH}`
const MCP_APP_MIME = 'text/html;profile=mcp-app'

export function registerViews(server: McpServer): void {
  server.registerResource(
    'list-view',
    LIST_VIEW_URI,
    { title: 'Cantab OS list view', mimeType: MCP_APP_MIME },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: MCP_APP_MIME, text: LIST_VIEW_HTML }] }),
  )
}
