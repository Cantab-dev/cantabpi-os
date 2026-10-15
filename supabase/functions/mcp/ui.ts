import type { McpServer } from '@modelcontextprotocol/server'

// In-chat view for list (MCP Apps). Step 0 spike: proves render, data, tool calls from the view,
// theme variables and sizing in claude.ai. See docs/chat-ux-status.md §3.1.

export const LIST_VIEW_URI = 'ui://cantab-os/list'
const MCP_APP_MIME = 'text/html;profile=mcp-app'

// A minimal MCP Apps bridge over postMessage, written by hand instead of loading the 418 KB
// @modelcontextprotocol/ext-apps bundle. Method names and initialize params follow ext-apps 2.0.3.
const LIST_VIEW_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;padding:12px;font:14px/1.5 var(--font-sans,system-ui,sans-serif);color:var(--color-text-primary,#1f1f1f);background:transparent}
.h{display:flex;align-items:center;gap:10px;padding-bottom:8px;border-bottom:2px solid #A32D2D;margin-bottom:8px}
.l{width:28px;height:28px;border-radius:6px;background:#A32D2D;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:500}
.m{font-size:12px;color:var(--color-text-secondary,#666)}
.r{padding:4px 0;border-bottom:.5px solid var(--color-border-primary,#ddd)}
button{font:inherit;padding:4px 10px;margin-top:10px}
pre{font-size:11px;white-space:pre-wrap;color:var(--color-text-secondary,#666)}
</style></head><body>
<div class="h"><div class="l">π</div><div><div style="font-weight:500">Cantab OS · spike</div><div class="m" id="s">Connecting…</div></div></div>
<div id="b"></div>
<button id="t" hidden>Toggle first todo via edit</button>
<pre id="log"></pre>
<script>
const t0=performance.now(),ms=()=>Math.round(performance.now()-t0)+' ms';
const $=id=>document.getElementById(id),log=s=>{$('log').textContent+=s+'\\n'};
let n=0;const pend={};
const send=m=>parent.postMessage(Object.assign({jsonrpc:'2.0'},m),'*');
const req=(method,params)=>new Promise((res,rej)=>{const id=++n;pend[id]={res,rej};send({id,method,params})});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let first=null;
function show(sc){
  if(!sc||!Array.isArray(sc.rows)){$('s').textContent='Result without rows';return}
  $('s').textContent='hello · '+sc.entity+' · '+sc.rows.length+' rows (of '+sc.total+') · data at '+ms();
  $('b').innerHTML=sc.rows.map(r=>'<div class="r">'+esc(r.label)+' — '+esc(r.name||r.description||'')+(r.status===true?' ✓':'')+'</div>').join('');
  first=sc.entity==='todos'?sc.rows[0]:null;$('t').hidden=!first;
}
addEventListener('message',e=>{
  if(e.source!==parent)return;const m=e.data;if(!m||m.jsonrpc!=='2.0')return;
  if(m.id!=null&&!m.method){const p=pend[m.id];if(p){delete pend[m.id];m.error?p.rej(m.error):p.res(m.result)}return}
  if(m.id!=null){send({id:m.id,result:{}});log('host request '+m.method);return}
  if(m.method==='ui/notifications/tool-input')log('tool-input at '+ms()+': '+JSON.stringify(m.params&&m.params.arguments));
  else if(m.method==='ui/notifications/tool-result'){log('tool-result at '+ms());show(m.params&&m.params.structuredContent)}
  else if(m.method==='ui/notifications/host-context-changed')log('context changed: '+JSON.stringify(m.params).slice(0,200));
  else log('notification '+m.method);
});
$('t').onclick=async()=>{
  const want=!first.status,a=performance.now();
  try{const r=await req('tools/call',{name:'edit',arguments:{label:first.label,status:want}});
    const ok=!r.isError;if(ok)first.status=want;
    log('edit '+first.label+' status='+want+' -> '+(ok?'ok':'error: '+JSON.stringify(r.content))+' in '+Math.round(performance.now()-a)+' ms');
  }catch(err){log('edit failed: '+JSON.stringify(err))}
};
new ResizeObserver(()=>send({method:'ui/notifications/size-changed',params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}})).observe(document.documentElement);
req('ui/initialize',{appCapabilities:{availableDisplayModes:['inline']},appInfo:{name:'cantab-os-list',version:'0.0.1'},protocolVersion:'2026-01-26'})
  .then(r=>{const c=r.hostContext||{},v=(c.styles&&c.styles.variables)||{};
    for(const k in v)if(v[k])document.documentElement.style.setProperty(k,v[k]);
    log('initialized at '+ms()+' · host '+JSON.stringify(r.hostInfo)+' · theme '+c.theme+' · '+Object.keys(v).length+' style vars · serverTools '+!!(r.hostCapabilities&&r.hostCapabilities.serverTools));
    $('s').textContent='Waiting for data…';send({method:'ui/notifications/initialized'});})
  .catch(err=>{$('s').textContent='Initialize failed';log(JSON.stringify(err))});
</script></body></html>`

export function registerViews(server: McpServer): void {
  server.registerResource(
    'list-view',
    LIST_VIEW_URI,
    { title: 'Cantab OS list view', mimeType: MCP_APP_MIME },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: MCP_APP_MIME, text: LIST_VIEW_HTML }] }),
  )
}
