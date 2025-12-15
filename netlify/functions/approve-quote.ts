import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ApproveQuoteRequest {
  quoteId: string;
  token: string;
  action: 'approve' | 'request_changes';
  notes?: string;
  poNumber?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload: ApproveQuoteRequest = JSON.parse(event.body || '{}');
    const { quoteId, token, action, notes, poNumber } = payload;

    if (!quoteId || !token || !action) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    console.log('Processing quote action:', { quoteId, action });

    // Verify the token matches the quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, quote_number, status, view_token, client_id, sales_rep_id')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Quote not found' }),
      };
    }

    // Verify token
    if (quote.view_token !== token) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    // Check quote status - should be sent or follow_up to be approved
    if (!['sent', 'follow_up', 'changes_requested'].includes(quote.status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Quote cannot be ${action === 'approve' ? 'approved' : 'modified'} in current status: ${quote.status}`,
        }),
      };
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      // Update quote with approval
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'approved',
          status_changed_at: now,
          approval_status: 'approved',
          client_approved_at: now,
          approval_notes: notes || null,
          client_po_number: poNumber || null,
          client_response_notes: notes || null,
          updated_at: now,
        })
        .eq('id', quoteId);

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error('Failed to update quote');
      }

      // Record in status history
      await supabase.from('fsm_status_history').insert({
        entity_type: 'quote',
        entity_id: quoteId,
        from_status: quote.status,
        to_status: 'approved',
        notes: `Client approved${poNumber ? ` (PO: ${poNumber})` : ''}${notes ? `: ${notes}` : ''}`,
      });

      console.log('Quote approved:', quoteId);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Quote approved successfully',
        }),
      };
    } else if (action === 'request_changes') {
      // Update quote with change request
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'changes_requested',
          status_changed_at: now,
          client_response_notes: notes || null,
          updated_at: now,
        })
        .eq('id', quoteId);

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error('Failed to update quote');
      }

      // Record in status history
      await supabase.from('fsm_status_history').insert({
        entity_type: 'quote',
        entity_id: quoteId,
        from_status: quote.status,
        to_status: 'changes_requested',
        notes: `Client requested changes: ${notes}`,
      });

      console.log('Changes requested for quote:', quoteId);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Change request submitted successfully',
        }),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid action' }),
    };
  } catch (error) {
    console.error('Approve quote error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
