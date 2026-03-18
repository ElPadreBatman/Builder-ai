/**
 * Migration Script: Builder -> Construct AI
 * 
 * Transfers data from Builder (anguhsngugdltkjcpnfh) to Construct AI (udkjqtyespiaxpscgyhx)
 * 
 * Mapping:
 *   conversations -> chats (UUID PK -> integer auto-increment)
 *   messages -> messages (UUID PK -> integer auto-increment)
 *   profiles -> users (UUID PK, same auth IDs)
 *   attachments -> message_attachments (UUID PK)
 *   soumissions -> submissions (UUID PK -> integer auto-increment)
 */

// === Configuration ===
const BUILDER_URL = 'https://anguhsngugdltkjcpnfh.supabase.co'
const BUILDER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // Builder's service_role key (read, bypasses RLS)

const CONSTRUCT_URL = 'https://udkjqtyespiaxpscgyhx.supabase.co'
const CONSTRUCT_KEY = process.env.CONSTRUCT_AI_SERVICE_ROLE_KEY // Construct AI service_role (write)

if (!BUILDER_KEY) {
  console.error('[v0] ERROR: SUPABASE_SERVICE_ROLE_KEY is not set')
  process.exit(1)
}
if (!CONSTRUCT_KEY) {
  console.error('[v0] ERROR: CONSTRUCT_AI_SERVICE_ROLE_KEY is not set')
  process.exit(1)
}

// Helper: fetch from Builder (read)
async function builderGet(table, query = '') {
  const url = `${BUILDER_URL}/rest/v1/${table}?${query}`
  const res = await fetch(url, {
    headers: {
      'apikey': BUILDER_KEY,
      'Authorization': `Bearer ${BUILDER_KEY}`,
    }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Builder GET ${table} failed: ${res.status} - ${text}`)
  }
  return res.json()
}

// Helper: insert into Construct AI (write)
async function constructInsert(table, rows, options = {}) {
  if (!rows || rows.length === 0) {
    console.log(`[v0] Skipping ${table}: no rows to insert`)
    return []
  }

  // Insert in batches of 50
  const batchSize = 50
  const allResults = []
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const res = await fetch(`${CONSTRUCT_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': CONSTRUCT_KEY,
        'Authorization': `Bearer ${CONSTRUCT_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(batch),
    })
    
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Construct INSERT ${table} batch ${i / batchSize + 1} failed: ${res.status} - ${text}`)
    }
    
    let result = []
    const contentType = res.headers.get('content-type')
    if (contentType && contentType.includes('json')) {
      result = await res.json()
      if (!Array.isArray(result)) result = [result]
    }
    allResults.push(...result)
    console.log(`[v0] ${table}: inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`)
  }
  
  return allResults
}

// === Main Migration ===
async function migrate() {
  console.log('[v0] ====================================')
  console.log('[v0] Starting Builder -> Construct AI Migration')
  console.log('[v0] ====================================\n')

  // ==========================================
  // Step 1: Export all data from Builder
  // ==========================================
  console.log('[v0] Step 1: Exporting data from Builder...')
  
  const conversations = await builderGet('conversations', 'order=created_at.asc')
  console.log(`[v0]   conversations: ${conversations.length}`)
  
  const messages = await builderGet('messages', 'order=created_at.asc')
  console.log(`[v0]   messages: ${messages.length}`)
  
  const profiles = await builderGet('profiles', '')
  console.log(`[v0]   profiles: ${profiles.length}`)
  
  const attachments = await builderGet('attachments', 'order=created_at.asc')
  console.log(`[v0]   attachments: ${attachments.length}`)
  
  const soumissions = await builderGet('soumissions', 'order=created_at.asc')
  console.log(`[v0]   soumissions: ${soumissions.length}`)

  let agents = []
  try {
    agents = await builderGet('agents', '')
    console.log(`[v0]   agents: ${agents.length}`)
  } catch (e) {
    console.log(`[v0]   agents: skipped (${e.message})`)
  }

  // ==========================================
  // Step 2: Check existing users in Construct AI
  // ==========================================
  console.log('\n[v0] Step 2: Checking existing users in Construct AI...')
  
  const existingUsers = await (async () => {
    const res = await fetch(`${CONSTRUCT_URL}/rest/v1/users?select=id,email,name`, {
      headers: {
        'apikey': CONSTRUCT_KEY,
        'Authorization': `Bearer ${CONSTRUCT_KEY}`,
      }
    })
    if (!res.ok) {
      console.log(`[v0]   Could not fetch users: ${res.status}`)
      return []
    }
    return res.json()
  })()
  
  console.log(`[v0]   Existing users in Construct AI: ${existingUsers.length}`)
  existingUsers.forEach(u => console.log(`[v0]     - ${u.id} (${u.email || 'no email'})`))

  // Build sets of existing user IDs and emails
  const existingUserIds = new Set(existingUsers.map(u => u.id))
  const existingUserEmails = new Set(existingUsers.filter(u => u.email).map(u => u.email.toLowerCase()))

  // ==========================================
  // Step 3: Upsert profiles -> users
  // ==========================================
  console.log('\n[v0] Step 3: Migrating profiles -> users...')
  
  const usersToUpsert = profiles.map(p => ({
    id: p.id, // same UUID from Supabase Auth
    email: p.email || null,
    name: p.display_name || p.full_name || p.name || null,
    first_name: p.first_name || null,
    last_name: p.last_name || null,
    avatar_url: p.avatar_url || null,
    created_at: p.created_at,
    updated_at: p.updated_at || p.created_at,
  }))

  // For existing users, we don't want to overwrite their Construct AI settings
  // Skip by both ID and email to avoid unique constraint violations
  const newUsers = usersToUpsert.filter(u => 
    !existingUserIds.has(u.id) && 
    !(u.email && existingUserEmails.has(u.email.toLowerCase()))
  )
  const existingToUpdate = usersToUpsert.filter(u => 
    existingUserIds.has(u.id) || 
    (u.email && existingUserEmails.has(u.email.toLowerCase()))
  )

  console.log(`[v0]   newUsers to insert: ${newUsers.length}`)
  newUsers.forEach(u => console.log(`[v0]     - ${u.id} (${u.email})`))
  
  // Construct AI has a trigger on users table that prevents direct inserts via PostgREST.
  // Users must be created through Supabase Auth first.
  // For users that can't be migrated, assign their data to Franco's account.
  
  // Find Franco's ID in Construct AI (the admin/owner)
  const francoConstructId = existingUsers.find(u => 
    u.email && u.email.includes('franco')
  )?.id || existingUsers[0]?.id
  
  console.log(`[v0]   Fallback user (Franco): ${francoConstructId}`)
  
  if (newUsers.length > 0) {
    console.log(`[v0]   ${newUsers.length} users cannot be inserted (Construct AI requires auth signup):`)
    newUsers.forEach(u => console.log(`[v0]     - ${u.email} -> will be assigned to Franco (${francoConstructId})`))
  }
  
  if (existingToUpdate.length > 0) {
    console.log(`[v0]   Users already exist: ${existingToUpdate.map(u => u.email || u.id).join(', ')}`)
  }

  // Build user ID mapping: Builder profile ID -> Construct AI user ID
  const userIdMap = new Map()
  for (const profile of profiles) {
    // Check if same ID exists in Construct AI
    if (existingUserIds.has(profile.id)) {
      userIdMap.set(profile.id, profile.id)
    } else if (profile.email) {
      // Find by email match
      const matchedUser = existingUsers.find(u => u.email && u.email.toLowerCase() === profile.email.toLowerCase())
      if (matchedUser) {
        userIdMap.set(profile.id, matchedUser.id)
        console.log(`[v0]   User ID mapping: ${profile.id} -> ${matchedUser.id} (matched by email: ${profile.email})`)
      }
    }
    // For unmapped users, fallback to Franco
    if (!userIdMap.has(profile.id)) {
      userIdMap.set(profile.id, francoConstructId)
      console.log(`[v0]   User ID mapping: ${profile.id} -> ${francoConstructId} (fallback to Franco)`)
    }
  }

  // Helper to resolve user_id
  const resolveUserId = (oldUserId) => userIdMap.get(oldUserId) || francoConstructId

  // ==========================================
  // Step 4: Migrate conversations -> chats
  // ==========================================
  console.log('\n[v0] Step 4: Migrating conversations -> chats...')
  
  // ID mapping: Builder conversation UUID -> Construct AI chat integer ID
  const conversationIdMap = new Map() // old UUID -> new integer ID
  
  for (const conv of conversations) {
    const chatRow = {
      user_id: resolveUserId(conv.user_id),
      title: conv.title || 'Sans titre',
      created_at: conv.created_at,
      updated_at: conv.updated_at || conv.created_at,
      status: conv.status || null,
      description: conv.summary || null,
      conversation_summaries: null,
      tags: null,
      metadata: {
        builder_original_id: conv.id,
        builder_agent_id: conv.agent_id,
        builder_message_count: conv.message_count,
        migrated_from: 'builder',
        migrated_at: new Date().toISOString(),
      },
    }
    
    try {
      const [inserted] = await constructInsert('chats', [chatRow])
      if (inserted) {
        conversationIdMap.set(conv.id, inserted.id)
        console.log(`[v0]   ${conv.title || 'Sans titre'} (${conv.id}) -> chat #${inserted.id}`)
      }
    } catch (e) {
      console.log(`[v0]   ERROR inserting chat for "${conv.title}": ${e.message}`)
    }
  }
  
  console.log(`[v0]   Mapped ${conversationIdMap.size} conversations -> chats`)

  // ==========================================
  // Step 5: Migrate messages -> messages
  // ==========================================
  console.log('\n[v0] Step 5: Migrating messages -> messages...')
  
  const messageIdMap = new Map() // old UUID -> new integer ID
  let skippedMessages = 0
  
  // Group messages by conversation for batch insert
  const msgsByConv = new Map()
  for (const msg of messages) {
    const newChatId = conversationIdMap.get(msg.conversation_id)
    if (!newChatId) {
      skippedMessages++
      continue
    }
    if (!msgsByConv.has(msg.conversation_id)) msgsByConv.set(msg.conversation_id, [])
    msgsByConv.get(msg.conversation_id).push(msg)
  }
  
  for (const [convId, convMessages] of msgsByConv) {
    const newChatId = conversationIdMap.get(convId)
    const messageRows = convMessages.map(msg => ({
      chat_id: newChatId,
      user_id: msg.user_id ? resolveUserId(msg.user_id) : null,
      content: msg.content || '',
      role: msg.role || 'user',
      is_error: false,
      is_status: false,
      created_at: msg.created_at,
      metadata: {
        builder_original_id: msg.id,
        migrated_from: 'builder',
      },
    }))
    
    try {
      const inserted = await constructInsert('messages', messageRows)
      // Map old IDs to new IDs
      for (let i = 0; i < convMessages.length && i < inserted.length; i++) {
        messageIdMap.set(convMessages[i].id, inserted[i].id)
      }
      console.log(`[v0]   Chat #${newChatId}: ${inserted.length} messages migrated`)
    } catch (e) {
      console.log(`[v0]   ERROR inserting messages for chat #${newChatId}: ${e.message}`)
      skippedMessages += convMessages.length
    }
  }
  
  console.log(`[v0]   Migrated ${messageIdMap.size} messages (skipped: ${skippedMessages})`)

  // ==========================================
  // Step 6: Migrate attachments -> message_attachments
  // ==========================================
  console.log('\n[v0] Step 6: Migrating attachments -> message_attachments...')
  
  let attachmentsMigrated = 0
  let attachmentsSkipped = 0
  
  for (const att of attachments) {
    // Find the new message_id
    const newMessageId = att.message_id ? messageIdMap.get(att.message_id) : null
    
    if (att.message_id && !newMessageId) {
      console.log(`[v0]   WARNING: attachment ${att.id} references unknown message ${att.message_id}, skipping`)
      attachmentsSkipped++
      continue
    }
    
    const attachmentRow = {
      id: att.id, // Keep UUID
      message_id: newMessageId || null,
      file_name: att.file_name || att.filename || 'unknown',
      file_path: att.file_path || att.storage_path || att.url || '',
      file_size: att.file_size || att.size || 0,
      mime_type: att.mime_type || att.content_type || 'application/octet-stream',
      storage_bucket: att.bucket || 'attachments',
      created_at: att.created_at,
    }
    
    try {
      await constructInsert('message_attachments', [attachmentRow])
      attachmentsMigrated++
    } catch (e) {
      console.log(`[v0]   ERROR inserting attachment ${att.id}: ${e.message}`)
      attachmentsSkipped++
    }
  }
  
  console.log(`[v0]   Migrated ${attachmentsMigrated} attachments (skipped: ${attachmentsSkipped})`)

  // ==========================================
  // Step 7: Migrate soumissions -> submissions
  // ==========================================
  console.log('\n[v0] Step 7: Migrating soumissions -> submissions...')
  
  let submissionsMigrated = 0
  let submissionsSkipped = 0
  
  for (const soum of soumissions) {
    const newChatId = soum.conversation_id ? conversationIdMap.get(soum.conversation_id) : null
    const newMessageId = soum.message_id ? messageIdMap.get(soum.message_id) : null
    
    const submissionRow = {
      user_id: soum.user_id ? resolveUserId(soum.user_id) : null,
      chat_id: newChatId || null,
      message_id: newMessageId || null,
      title: soum.title || soum.nom_projet || 'Sans titre',
      description: soum.description || null,
      status: soum.status || 'brouillon',
      version: soum.version || 1,
      amount: soum.total || soum.amount || soum.montant_total || null,
      submission_data: soum.data || soum.contenu || soum.submission_data || null,
      metadata: {
        builder_original_id: soum.id,
        builder_status: soum.status,
        migrated_from: 'builder',
        migrated_at: new Date().toISOString(),
      },
      created_at: soum.created_at,
      updated_at: soum.updated_at || soum.created_at,
    }
    
    try {
      await constructInsert('submissions', [submissionRow])
      submissionsMigrated++
    } catch (e) {
      console.log(`[v0]   ERROR inserting submission: ${e.message}`)
      submissionsSkipped++
    }
  }
  
  console.log(`[v0]   Migrated ${submissionsMigrated} submissions (skipped: ${submissionsSkipped})`)

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n[v0] ====================================')
  console.log('[v0] Migration Summary')
  console.log('[v0] ====================================')
  console.log(`[v0] Users:        ${newUsers.length} new + ${existingToUpdate.length} existing`)
  console.log(`[v0] Chats:        ${conversationIdMap.size} migrated`)
  console.log(`[v0] Messages:     ${messageIdMap.size} migrated, ${skippedMessages} skipped`)
  console.log(`[v0] Attachments:  ${attachmentsMigrated} migrated, ${attachmentsSkipped} skipped`)
  console.log(`[v0] Submissions:  ${submissionsMigrated} migrated, ${submissionsSkipped} skipped`)
  console.log('[v0] ====================================')
  
  // Print ID mapping for reference
  console.log('\n[v0] === Conversation -> Chat ID Mapping ===')
  for (const [oldId, newId] of conversationIdMap) {
    const conv = conversations.find(c => c.id === oldId)
    console.log(`[v0]   ${conv?.title || 'Unknown'}: ${oldId} -> #${newId}`)
  }
}

migrate().catch(e => {
  console.error('[v0] FATAL ERROR:', e.message)
  console.error(e.stack)
  process.exit(1)
})
