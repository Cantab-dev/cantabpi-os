import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { pipeline } from '@supabase/middleware'
import { type SupabaseContext, withOAuthProtectedResource, withSupabase } from '@supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registerProjectDataTools } from './project_data.ts'
import { registerTools } from './tools.ts'
import { registerViews } from './ui.ts'
import { registerViewTool } from './views.ts'

// As in Supabase's MCP block:
//   withOAuthProtectedResource  OAuth discovery for MCP clients (RFC 9728) and the WWW-Authenticate
//                               challenge on 401, so claude.ai can find Supabase Auth and sign in.
//   withSupabase                Checks the user's access token and gives the tools a client that acts
//                               as that user, so RLS decides which rows they see.
//   handleMcp                   A fresh MCP server per request, bound to that user's client.

const INSTRUCTIONS =
  'Cantab OS stores todos, leads, skills and pointers to Google sheets, docs and slides, grouped in projects. ' +
  'The user works in one project at a time, chosen with select_project; todos, sheets, docs and slides belong to ' +
  'one project each, and every reply names the selected one. Without a selected project only project calls work. ' +
  'Leads and skills are shared by all projects. ' +
  'Every tool acts as the signed-in user and sees only their records. ' +
  'Call list before get, edit, delete or note to find labels; never invent one. ' +
  'view shows something in the user\'s live view page, only when the user asks or clearly benefits: a slide PDF, a ' +
  'dashboard, or one of the agent views. The contract, query, write and log tools read and change the selected ' +
  'project\'s data (the ten agents\' data); call contract first, as the agent you act as.'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
}

function handleMcp(request: Request, ctx: SupabaseContext): Promise<Response> {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'cantab-os', version: '0.11.0' }, { instructions: INSTRUCTIONS })
    registerTools(server, ctx.supabase as unknown as SupabaseClient)
    registerViewTool(server, ctx.supabase as unknown as SupabaseClient)
    registerProjectDataTools(
      server, ctx.supabase as unknown as SupabaseClient, ctx.supabaseAdmin as unknown as SupabaseClient,
      ctx.userClaims?.id ?? null,
    )
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
