// Morning Digest Edge Function
// Sends a daily summary email to users with their upcoming schedule

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduleEntry {
  id: string
  scheduled_date: string
  start_time: string | null
  end_time: string | null
  entry_type: string
  title: string | null
  estimated_footage: number | null
  job?: {
    job_number: string
    client_name: string
  }
  service_request?: {
    request_number: string
    contact_name: string
  }
  crew?: {
    name: string
  }
}

interface UserForDigest {
  user_id: string
  digest_time: string
  digest_days_ahead: number
  email: string
  full_name: string | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get current time in CST (Central Standard Time)
    const now = new Date()
    const cstOffset = -6 * 60 // CST is UTC-6
    const cstNow = new Date(now.getTime() + (now.getTimezoneOffset() + cstOffset) * 60000)
    const currentHour = cstNow.getHours()
    const currentMinute = cstNow.getMinutes()

    console.log(`Running morning digest at ${currentHour}:${currentMinute} CST`)

    // Get users who should receive digest at this time
    // For simplicity, we'll match on the hour (e.g., 06:00 matches 6am)
    const { data: users, error: usersError } = await supabase
      .from('notification_preferences')
      .select(`
        user_id,
        digest_time,
        digest_days_ahead,
        user:auth.users(email, raw_user_meta_data)
      `)
      .eq('email_morning_digest', true)

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    // Filter to users whose digest time matches current hour
    const usersToNotify: UserForDigest[] = (users || [])
      .filter((u: any) => {
        const [digestHour] = u.digest_time.split(':').map(Number)
        return digestHour === currentHour
      })
      .map((u: any) => ({
        user_id: u.user_id,
        digest_time: u.digest_time,
        digest_days_ahead: u.digest_days_ahead || 1,
        email: u.user?.email || '',
        full_name: u.user?.raw_user_meta_data?.full_name || null,
      }))

    console.log(`Found ${usersToNotify.length} users to notify`)

    const results = []

    for (const user of usersToNotify) {
      try {
        // Get user's schedule entries for today and upcoming days
        const today = new Date().toISOString().split('T')[0]
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + user.digest_days_ahead)
        const endDate = futureDate.toISOString().split('T')[0]

        // Find entries where user is either:
        // 1. Assigned as crew lead (via fsm_team_profiles.crew_id)
        // 2. Assigned as sales rep (via schedule_entries.sales_rep_id)
        // 3. Part of assigned crew

        const { data: entries, error: entriesError } = await supabase
          .from('schedule_entries')
          .select(`
            id,
            scheduled_date,
            start_time,
            end_time,
            entry_type,
            title,
            estimated_footage,
            job:jobs(job_number, client:clients(name)),
            service_request:service_requests(request_number, contact_name),
            crew:crews(name)
          `)
          .gte('scheduled_date', today)
          .lte('scheduled_date', endDate)
          .not('status', 'eq', 'cancelled')
          .order('scheduled_date')
          .order('start_time')

        if (entriesError) {
          console.error(`Error fetching entries for ${user.email}:`, entriesError)
          continue
        }

        // TODO: Filter entries to only those relevant to this user
        // For now, we'll send all entries (admin view)
        const userEntries = entries || []

        if (userEntries.length === 0) {
          console.log(`No entries for ${user.email}, skipping`)
          continue
        }

        // Build email content
        const emailHtml = buildDigestEmail(user, userEntries as any)

        // Send email via Resend (or log if no API key)
        if (resendApiKey) {
          const emailResult = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Discount Fence <notifications@discountfence.com>',
              to: user.email,
              subject: `Your Schedule for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
              html: emailHtml,
            }),
          })

          if (!emailResult.ok) {
            const errorText = await emailResult.text()
            console.error(`Failed to send email to ${user.email}:`, errorText)
          } else {
            console.log(`Sent digest to ${user.email}`)
          }
        } else {
          console.log(`Would send digest to ${user.email} (no RESEND_API_KEY set)`)
          console.log('Email content preview:', emailHtml.substring(0, 200))
        }

        // Log the notification
        await supabase.from('notification_log').insert({
          user_id: user.user_id,
          notification_type: 'morning_digest',
          subject: `Schedule Digest - ${today}`,
          body: `${userEntries.length} entries`,
          status: resendApiKey ? 'sent' : 'skipped',
          sent_at: new Date().toISOString(),
        })

        results.push({ user_id: user.user_id, email: user.email, entries: userEntries.length })
      } catch (userError) {
        console.error(`Error processing user ${user.email}:`, userError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Morning digest error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildDigestEmail(user: UserForDigest, entries: ScheduleEntry[]): string {
  const greeting = user.full_name ? `Hi ${user.full_name.split(' ')[0]},` : 'Hi,'
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Group entries by date
  const byDate = entries.reduce((acc, entry) => {
    const date = entry.scheduled_date
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {} as Record<string, ScheduleEntry[]>)

  let entriesHtml = ''
  for (const [date, dateEntries] of Object.entries(byDate)) {
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })

    entriesHtml += `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #1e40af; margin: 0 0 8px 0; font-size: 14px;">${dateLabel}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${dateEntries.map(entry => {
            const time = entry.start_time
              ? `${formatTime(entry.start_time)}${entry.end_time ? ' - ' + formatTime(entry.end_time) : ''}`
              : 'All day'

            let title = entry.title || ''
            if (entry.entry_type === 'job_visit' && entry.job) {
              title = `${entry.job.job_number}: ${(entry.job as any).client?.name || 'Client'}`
              if (entry.estimated_footage) {
                title += ` (${entry.estimated_footage} LF)`
              }
            } else if (entry.entry_type === 'assessment' && entry.service_request) {
              title = `Assessment: ${entry.service_request.contact_name || 'Client'}`
            }

            const typeColor = {
              job_visit: '#10B981',
              assessment: '#8B5CF6',
              blocked: '#9CA3AF',
              meeting: '#EC4899',
            }[entry.entry_type] || '#6B7280'

            return `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; width: 100px; color: #6b7280; font-size: 13px;">
                  ${time}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${typeColor}; margin-right: 8px;"></span>
                  <span style="font-size: 14px; color: #111827;">${title || entry.entry_type}</span>
                  ${entry.crew ? `<span style="font-size: 12px; color: #6b7280; margin-left: 8px;">(${entry.crew.name})</span>` : ''}
                </td>
              </tr>
            `
          }).join('')}
        </table>
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Daily Schedule</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 14px;">${today}</p>
      </div>

      <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px 0;">${greeting}</p>
        <p style="margin: 0 0 20px 0;">Here's your schedule overview:</p>

        ${entriesHtml || '<p style="color: #6b7280;">No scheduled items for today.</p>'}

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <a href="${Deno.env.get('PUBLIC_SITE_URL') || 'https://discount-fence-hub.netlify.app'}/schedule"
             style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px;">
            View Full Schedule
          </a>
        </div>
      </div>

      <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 16px;">
        Discount Fence USA |
        <a href="${Deno.env.get('PUBLIC_SITE_URL') || 'https://discount-fence-hub.netlify.app'}/settings/notifications"
           style="color: #9ca3af;">Notification Settings</a>
      </p>
    </body>
    </html>
  `
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`
}
