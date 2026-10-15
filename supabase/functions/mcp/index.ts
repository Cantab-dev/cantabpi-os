import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { pipeline } from '@supabase/middleware'
import { type SupabaseContext, withOAuthProtectedResource, withSupabase } from '@supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registerTools } from './tools.ts'
import { registerViews } from './ui.ts'

// As in Supabase's MCP block:
//   withOAuthProtectedResource  OAuth discovery for MCP clients (RFC 9728) and the WWW-Authenticate
//                               challenge on 401, so claude.ai can find Supabase Auth and sign in.
//   withSupabase                Checks the user's access token and gives the tools a client that acts
//                               as that user, so RLS decides which rows they see.
//   handleMcp                   A fresh MCP server per request, bound to that user's client.

const INSTRUCTIONS =
  'Cantab OS stores todos, leads, skills and pointers to Google sheets, docs and slides. ' +
  'Every tool acts as the signed-in user and sees only their records. ' +
  'Call list before get, edit, delete or note to find labels; never invent one.'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
}

function handleMcp(request: Request, ctx: SupabaseContext): Promise<Response> {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'cantab-os', version: '0.5.5' }, { instructions: INSTRUCTIONS })
    registerTools(server, ctx.supabase as unknown as SupabaseClient)
    registerViews(server)
    return server
  })
  return handler.fetch(request)
}

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: 'user', cors: { headers: CORS_HEADERS } })],
    (request, ctx) => handleMcp(request, ctx),
  ),
)
