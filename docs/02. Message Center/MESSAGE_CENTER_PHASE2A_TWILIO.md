# Message Center - Phase 2A Implementation
## Twilio Integration (Office SMS)

**Estimated Time:** 2-3 hours  
**Prerequisites:** Phase 1 complete, Twilio account with phone number  
**Outcome:** Send and receive real SMS from Message Center via Twilio

---

## Before You Start

Tell Claude Code about your existing Twilio setup:

1. **Where is your Twilio code?** (e.g., `src/services/twilio.ts`, `supabase/functions/`)
2. **What's your Twilio phone number?** (e.g., `+15125550100`)
3. **Do you have environment variables set up?** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`)

---

## Step 1: Environment Variables

Ensure these are set in Supabase Edge Functions secrets:

```bash
# In Supabase Dashboard > Project Settings > Edge Functions > Secrets
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15125550100
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Step 2: Twilio Webhook Handler (Receive SMS)

Create file: `supabase/functions/twilio-webhook/index.ts`

```typescript
// supabase/functions/twilio-webhook/index.ts
// Handles incoming SMS from Twilio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse Twilio webhook payload (form-urlencoded)
    const formData = await req.formData();
    const twilioData = Object.fromEntries(formData.entries());

    console.log('Received Twilio webhook:', JSON.stringify(twilioData));

    // Extract message details
    const {
      MessageSid: messageSid,
      From: fromPhone,
      To: toPhone,
      Body: body,
      NumMedia: numMedia,
      MediaUrl0: mediaUrl0,
      MediaContentType0: mediaType0,
    } = twilioData as Record<string, string>;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for opt-out keywords
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit'];
    const optInKeywords = ['start', 'yes', 'subscribe'];
    const bodyLower = body?.toLowerCase().trim();

    if (optOutKeywords.includes(bodyLower)) {
      await handleOptOut(supabase, fromPhone);
      return new Response(generateTwiML('You have been unsubscribed. Reply START to re-subscribe.'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    if (optInKeywords.includes(bodyLower)) {
      await handleOptIn(supabase, fromPhone);
      return new Response(generateTwiML('Welcome back! You are now subscribed.'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Find or create contact
    const contact = await findOrCreateContact(supabase, fromPhone);

    // Find or create conversation
    const conversation = await findOrCreateConversation(supabase, contact.id, fromPhone, toPhone);

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('mc_messages')
      .insert({
        conversation_id: conversation.id,
        channel: 'sms',
        direction: 'inbound',
        body: body || '',
        from_phone: fromPhone,
        to_phone: toPhone,
        from_contact_id: contact.id,
        status: 'received',
        sent_at: new Date().toISOString(),
        metadata: {
          twilio_sid: messageSid,
          num_media: numMedia,
        },
      })
      .select()
      .single();

    if (messageError) {
      console.error('Failed to insert message:', messageError);
      throw messageError;
    }

    // Handle media attachments
    if (parseInt(numMedia || '0') > 0 && mediaUrl0) {
      await supabase.from('mc_attachments').insert({
        message_id: message.id,
        file_name: `attachment_${messageSid}`,
        file_type: mediaType0 || 'application/octet-stream',
        file_size: 0, // Twilio doesn't provide size
        file_url: mediaUrl0,
      });
    }

    console.log(`Processed inbound SMS from ${fromPhone}: ${messageSid}`);

    // Return empty TwiML (no auto-reply)
    return new Response(generateTwiML(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Twilio retries
    return new Response(generateTwiML(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});

// Generate TwiML response
function generateTwiML(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

// Find or create contact by phone
async function findOrCreateContact(supabase: any, phone: string) {
  // Normalize phone
  const normalized = phone.replace(/\D/g, '');
  const last10 = normalized.slice(-10);

  // Try to find existing contact
  const { data: existing } = await supabase
    .from('mc_contacts')
    .select('*')
    .or(`phone_primary.ilike.%${last10}%,phone_secondary.ilike.%${last10}%`)
    .limit(1)
    .single();

  if (existing) return existing;

  // Try to match with Client Hub
  const { data: clientContact } = await supabase
    .from('client_contacts')
    .select('*, client:clients(*)')
    .or(`phone.ilike.%${last10}%,mobile.ilike.%${last10}%`)
    .limit(1)
    .single();

  // Create new contact
  const { data: newContact, error } = await supabase
    .from('mc_contacts')
    .insert({
      contact_type: 'client',
      display_name: clientContact 
        ? `${clientContact.first_name || ''} ${clientContact.last_name || ''}`.trim() || phone
        : phone,
      first_name: clientContact?.first_name,
      last_name: clientContact?.last_name,
      company_name: clientContact?.client?.company_name,
      phone_primary: phone,
      client_id: clientContact?.client_id,
    })
    .select()
    .single();

  if (error) throw error;
  return newContact;
}

// Find or create conversation
async function findOrCreateConversation(
  supabase: any,
  contactId: string,
  fromPhone: string,
  toPhone: string
) {
  // Look for existing conversation with this contact
  const { data: existing } = await supabase
    .from('mc_conversations')
    .select('*')
    .eq('contact_id', contactId)
    .eq('conversation_type', 'client')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (existing) return existing;

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from('mc_conversations')
    .insert({
      conversation_type: 'client',
      contact_id: contactId,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return newConversation;
}

// Handle opt-out
async function handleOptOut(supabase: any, phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const last10 = normalized.slice(-10);

  await supabase
    .from('mc_contacts')
    .update({
      sms_opted_out: true,
      sms_opted_out_at: new Date().toISOString(),
    })
    .or(`phone_primary.ilike.%${last10}%,phone_secondary.ilike.%${last10}%`);

  console.log(`Contact opted out: ${phone}`);
}

// Handle opt-in
async function handleOptIn(supabase: any, phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const last10 = normalized.slice(-10);

  await supabase
    .from('mc_contacts')
    .update({
      sms_opted_out: false,
      sms_opted_out_at: null,
    })
    .or(`phone_primary.ilike.%${last10}%,phone_secondary.ilike.%${last10}%`);

  console.log(`Contact opted in: ${phone}`);
}
```

---

## Step 3: Send SMS Edge Function

Create file: `supabase/functions/send-sms/index.ts`

```typescript
// supabase/functions/send-sms/index.ts
// Sends SMS via Twilio and updates message status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSMSRequest {
  message_id: string;
  to: string;
  body: string;
  media_urls?: string[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message_id, to, body, media_urls } = await req.json() as SendSMSRequest;

    // Validate input
    if (!message_id || !to || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: message_id, to, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!;

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if contact is opted out
    const { data: message } = await supabase
      .from('mc_messages')
      .select(`
        *,
        conversation:mc_conversations(
          contact:mc_contacts(sms_opted_out)
        )
      `)
      .eq('id', message_id)
      .single();

    if (message?.conversation?.contact?.sms_opted_out) {
      // Update message as failed
      await supabase
        .from('mc_messages')
        .update({
          status: 'failed',
          error_message: 'Contact has opted out of SMS',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message_id);

      return new Response(
        JSON.stringify({ error: 'Contact has opted out of SMS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare Twilio request body
    const twilioBody = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    });

    // Add media URLs if provided
    if (media_urls && media_urls.length > 0) {
      media_urls.forEach((url, index) => {
        twilioBody.append(`MediaUrl${index}`, url);
      });
    }

    // Send via Twilio API
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: twilioBody.toString(),
      }
    );

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);

      // Update message as failed
      await supabase
        .from('mc_messages')
        .update({
          status: 'failed',
          error_message: twilioResult.message || 'Failed to send SMS',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message_id);

      return new Response(
        JSON.stringify({ error: twilioResult.message || 'Failed to send SMS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update message with Twilio SID and status
    await supabase
      .from('mc_messages')
      .update({
        status: mapTwilioStatus(twilioResult.status),
        metadata: {
          twilio_sid: twilioResult.sid,
          twilio_status: twilioResult.status,
        },
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', message_id);

    console.log(`SMS sent successfully: ${twilioResult.sid}`);

    return new Response(
      JSON.stringify({
        success: true,
        twilio_sid: twilioResult.sid,
        status: twilioResult.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send SMS error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Map Twilio status to our status
function mapTwilioStatus(twilioStatus: string): string {
  const statusMap: Record<string, string> = {
    'queued': 'sending',
    'sending': 'sending',
    'sent': 'sent',
    'delivered': 'delivered',
    'undelivered': 'failed',
    'failed': 'failed',
  };
  return statusMap[twilioStatus] || 'sent';
}
```

---

## Step 4: Twilio Status Webhook (Delivery Updates)

Create file: `supabase/functions/twilio-status/index.ts`

```typescript
// supabase/functions/twilio-status/index.ts
// Handles delivery status updates from Twilio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    const {
      MessageSid: messageSid,
      MessageStatus: messageStatus,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
    } = data as Record<string, string>;

    console.log(`Status update for ${messageSid}: ${messageStatus}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'queued': 'sending',
      'sending': 'sending',
      'sent': 'sent',
      'delivered': 'delivered',
      'undelivered': 'failed',
      'failed': 'failed',
      'read': 'read',
    };

    const ourStatus = statusMap[messageStatus] || 'sent';

    // Update message by Twilio SID (stored in metadata)
    const { error } = await supabase
      .from('mc_messages')
      .update({
        status: ourStatus,
        status_updated_at: new Date().toISOString(),
        delivered_at: messageStatus === 'delivered' ? new Date().toISOString() : undefined,
        error_message: errorMessage || null,
        metadata: {
          twilio_status: messageStatus,
          twilio_error_code: errorCode,
        },
      })
      .filter('metadata->>twilio_sid', 'eq', messageSid);

    if (error) {
      console.error('Failed to update message status:', error);
    }

    return new Response('OK', { headers: corsHeaders });

  } catch (error) {
    console.error('Status webhook error:', error);
    return new Response('OK', { headers: corsHeaders });
  }
});
```

---

## Step 5: Update Message Service

Update file: `src/features/message-center/services/messageService.ts`

Replace the `sendMessage` function:

```typescript
// Replace the existing sendMessage function with this:

export async function sendMessage(message: NewMessage): Promise<Message> {
  // 1. Insert message with 'sending' status
  const { data, error } = await supabase
    .from('mc_messages')
    .insert({
      conversation_id: message.conversation_id,
      channel: message.channel,
      direction: 'outbound',
      body: message.body,
      to_phone: message.to_phone,
      to_email: message.to_email,
      from_phone: import.meta.env.VITE_TWILIO_PHONE_NUMBER, // Add to .env
      status: 'sending',
      sent_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // 2. Call Edge Function to send via Twilio
  if (message.channel === 'sms' && message.to_phone) {
    try {
      const response = await supabase.functions.invoke('send-sms', {
        body: {
          message_id: data.id,
          to: message.to_phone,
          body: message.body,
        }
      });

      if (response.error) {
        console.error('Failed to send SMS:', response.error);
        // Message status will be updated by the edge function
      }
    } catch (err) {
      console.error('Error invoking send-sms:', err);
    }
  }

  // 3. Return the message (status will update via realtime)
  return data;
}
```

---

## Step 6: Add Environment Variable to Frontend

Add to your `.env` or `.env.local`:

```bash
VITE_TWILIO_PHONE_NUMBER=+15125550100
```

---

## Step 7: Deploy Edge Functions

Run these commands from your project root:

```bash
# Deploy webhook handler (receives incoming SMS)
supabase functions deploy twilio-webhook --no-verify-jwt

# Deploy send SMS function
supabase functions deploy send-sms

# Deploy status callback handler
supabase functions deploy twilio-status --no-verify-jwt
```

---

## Step 8: Configure Twilio Webhooks

In your Twilio Console:

### For Incoming Messages:
1. Go to **Phone Numbers** → Select your number
2. Under **Messaging Configuration**:
   - **When a message comes in**: Webhook
   - **URL**: `https://YOUR-PROJECT.supabase.co/functions/v1/twilio-webhook`
   - **Method**: POST

### For Status Callbacks:
1. Same phone number settings
2. Under **Messaging Configuration**:
   - **Status callback URL**: `https://YOUR-PROJECT.supabase.co/functions/v1/twilio-status`

---

## Step 9: Update UI for Opt-Out Warning

Update `src/features/message-center/components/MessageComposer.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MessageComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isOptedOut?: boolean; // NEW PROP
}

export function MessageComposer({ 
  onSend, 
  disabled = false,
  placeholder = 'Type a message...',
  isOptedOut = false // NEW PROP
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isOptedOut) return;
    
    onSend(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show opt-out warning
  if (isOptedOut) {
    return (
      <div className="border-t bg-yellow-50 p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <p className="font-medium">This contact has opted out of SMS</p>
            <p className="text-sm">They texted STOP and cannot receive messages until they reply START.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      <div className="flex items-end gap-2">
        {/* Attachment Buttons */}
        <div className="flex gap-1">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach image"
          >
            <Image className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          {/* Character count for SMS */}
          {message.length > 0 && (
            <span className={cn(
              'absolute bottom-2 right-2 text-xs',
              message.length > 160 ? 'text-orange-500' : 'text-gray-400'
            )}>
              {message.length}/160
            </span>
          )}
        </div>

        {/* Send Button */}
        <Button
          type="submit"
          disabled={!message.trim() || disabled}
          className="px-4 py-2"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Hint */}
      <p className="mt-1 text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
```

---

## Step 10: Update MessageCenterPage to Pass Opt-Out Status

In `MessageCenterPage.tsx`, update the MessageComposer usage:

```typescript
{/* Composer */}
<MessageComposer
  onSend={handleSendMessage}
  disabled={sendMessage.isPending}
  placeholder={`Message ${selectedConversation.contact?.display_name || 'contact'}...`}
  isOptedOut={selectedConversation.contact?.sms_opted_out || false}
/>
```

---

## Verification Checklist

### Edge Functions
- [ ] `twilio-webhook` deployed and accessible
- [ ] `send-sms` deployed
- [ ] `twilio-status` deployed

### Twilio Console
- [ ] Webhook URL configured for incoming messages
- [ ] Status callback URL configured

### Functionality Tests
- [ ] Send SMS from Message Center → Received on phone
- [ ] Reply from phone → Appears in Message Center
- [ ] Message status updates (sent → delivered)
- [ ] New contact auto-created when unknown number texts
- [ ] Opt-out (text STOP) → Contact marked as opted out
- [ ] Opt-in (text START) → Contact re-subscribed
- [ ] Opted-out contact shows warning in composer

### Real-time
- [ ] New incoming message appears without refresh
- [ ] Conversation list updates when message received

---

## Troubleshooting

### SMS Not Sending
1. Check Supabase Edge Function logs
2. Verify Twilio credentials in secrets
3. Check Twilio Console for error messages

### Webhook Not Receiving
1. Verify webhook URL is correct in Twilio
2. Check Edge Function is deployed with `--no-verify-jwt`
3. Look at Twilio webhook logs for delivery status

### Status Not Updating
1. Ensure status callback URL is configured
2. Check `twilio-status` function logs
3. Verify metadata is being saved with twilio_sid

---

## Next Phase Preview

**Phase 2B: QUO Integration** (Rep SMS Sync)
- Webhook handler for QUO events
- Sync rep conversations into Message Center
- Enable Project Radar AI analysis

---

**End of Phase 2A Implementation Spec**
