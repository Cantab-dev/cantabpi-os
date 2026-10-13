import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { createClient } from '@supabase/supabase-js'
import { authorised } from './lib.ts'
import { registerTools } from './tools.ts'

// Temporary access for the build phase: a shared development key and one acting user.
const devKey = Deno.env.get('CANTAB_DEV_KEY') ?? ''
const actingUserId = Deno.env.get('CANTAB_ACTING_USER_ID') || null

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'cantab-os', version: '0.1.0' })
  registerTools(server, db, actingUserId)
  return server
})

Deno.serve((req) => {
  if (!authorised(req.headers.get('authorization'), devKey)) {
    return new Response(JSON.stringify({ error: 'Missing or wrong development key.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return handler.fetch(req)
})
