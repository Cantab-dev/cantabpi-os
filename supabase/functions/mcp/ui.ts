import type { McpServer } from '@modelcontextprotocol/server'
import { LIST_VIEW_HTML } from './ui_html.ts'

// In-chat view for list (MCP Apps): todos, leads and files views in one resource. The HTML lives in
// ui/list.html (built into ui_html.ts by scripts/build-ui.mjs). See docs/chat-ux-status.md §3.

export const LIST_VIEW_URI = 'ui://cantab-os/list'
const MCP_APP_MIME = 'text/html;profile=mcp-app'

export function registerViews(server: McpServer): void {
  server.registerResource(
    'list-view',
    LIST_VIEW_URI,
    { title: 'Cantab OS list view', mimeType: MCP_APP_MIME },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: MCP_APP_MIME, text: LIST_VIEW_HTML }] }),
  )
}
