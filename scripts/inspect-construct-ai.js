// Step 1: Inspect Construct AI schema to understand table structure
const CONSTRUCT_URL = 'https://udkjqtyespiaxpscgyhx.supabase.co'
const CONSTRUCT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVka2pxdHllc3BpYXhwc2NneWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1NjExOTEsImV4cCI6MjA2MzEzNzE5MX0.4bfSLAP6ImSy2QKX-PVyFbItXwIy7U5piLEDk4NKTBs'

async function inspectSchema() {
  // Use PostgREST OpenAPI endpoint to discover tables
  const res = await fetch(`${CONSTRUCT_URL}/rest/v1/`, {
    headers: {
      'apikey': CONSTRUCT_ANON_KEY,
      'Authorization': `Bearer ${CONSTRUCT_ANON_KEY}`,
    }
  })
  
  if (!res.ok) {
    console.log('[v0] OpenAPI endpoint failed:', res.status, await res.text())
    return
  }
  
  const schema = await res.json()
  
  // List all tables (paths)
  const paths = Object.keys(schema.paths || {}).filter(p => p !== '/')
  console.log('[v0] === CONSTRUCT AI TABLES ===')
  console.log('[v0] Total tables:', paths.length)
  
  for (const path of paths.sort()) {
    const tableName = path.replace('/', '')
    console.log(`\n[v0] --- Table: ${tableName} ---`)
    
    // Get columns from the definitions
    const def = schema.definitions?.[tableName]
    if (def && def.properties) {
      const cols = Object.entries(def.properties).map(([name, info]) => {
        return `  ${name}: ${info.type || info.format || 'unknown'}${info.description ? ` (${info.description})` : ''}`
      })
      console.log(cols.join('\n'))
    } else {
      console.log('  (no column info available)')
    }
  }
  
  // Also try to read existing data counts
  console.log('\n\n[v0] === EXISTING DATA IN CONSTRUCT AI ===')
  const tablesToCheck = ['conversations', 'messages', 'attachments', 'profiles', 'agents', 'soumissions', 'invitations', 'projects', 'chats']
  
  for (const table of tablesToCheck) {
    try {
      const countRes = await fetch(`${CONSTRUCT_URL}/rest/v1/${table}?select=*&limit=0`, {
        method: 'HEAD',
        headers: {
          'apikey': CONSTRUCT_ANON_KEY,
          'Authorization': `Bearer ${CONSTRUCT_ANON_KEY}`,
          'Prefer': 'count=exact',
        }
      })
      const count = countRes.headers.get('content-range')
      if (countRes.ok) {
        console.log(`[v0] ${table}: ${count || 'exists (no count)'}`)
      } else {
        console.log(`[v0] ${table}: HTTP ${countRes.status} (table may not exist or no access)`)
      }
    } catch (e) {
      console.log(`[v0] ${table}: error - ${e.message}`)
    }
  }
}

inspectSchema().catch(e => console.error('[v0] Fatal error:', e.message))
