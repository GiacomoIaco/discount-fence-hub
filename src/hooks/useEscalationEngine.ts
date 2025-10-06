import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Simple Escalation Engine
 *
 * Monitors requests and auto-escalates when:
 * 1. SLA is breached (already tracked by triggers)
 * 2. Request is unassigned for > 2 hours
 * 3. Request is in 'new' stage for > target SLA time
 *
 * Actions:
 * - Update urgency to 'critical'
 * - Add activity log entry
 * - Could send notifications (not implemented yet)
 */

export function useEscalationEngine(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const checkAndEscalate = async () => {
      try {
        // Get all active requests that might need escalation
        const { data: requests, error } = await supabase
          .from('requests')
          .select('*')
          .in('stage', ['new', 'pending'])
          .or('sla_status.eq.at_risk,sla_status.eq.breached');

        if (error) {
          console.error('Escalation engine error:', error);
          return;
        }

        if (!requests || requests.length === 0) return;

        const now = Date.now();
        const escalations: Promise<any>[] = [];

        for (const request of requests) {
          const createdAt = new Date(request.created_at).getTime();
          const ageHours = (now - createdAt) / (1000 * 60 * 60);

          // Rule 1: Unassigned for too long
          if (!request.assigned_to && ageHours >= 2 && request.urgency !== 'critical') {
            console.log(`[Escalation] Request ${request.id}: Unassigned for ${ageHours.toFixed(1)}h`);

            escalations.push(
              (async () => {
                await supabase
                  .from('requests')
                  .update({ urgency: 'critical' })
                  .eq('id', request.id);

                await supabase
                  .from('request_activity_log')
                  .insert({
                    request_id: request.id,
                    action: 'auto_escalated',
                    details: {
                      reason: 'unassigned_too_long',
                      age_hours: ageHours.toFixed(1),
                      previous_urgency: request.urgency
                    }
                  });
              })()
            );
          }

          // Rule 2: SLA breached and still low/medium urgency
          if (request.sla_status === 'breached' && ['low', 'medium'].includes(request.urgency)) {
            console.log(`[Escalation] Request ${request.id}: SLA breached`);

            const newUrgency = request.urgency === 'low' ? 'medium' : 'high';

            escalations.push(
              (async () => {
                await supabase
                  .from('requests')
                  .update({ urgency: newUrgency })
                  .eq('id', request.id);

                await supabase
                  .from('request_activity_log')
                  .insert({
                    request_id: request.id,
                    action: 'auto_escalated',
                    details: {
                      reason: 'sla_breached',
                      sla_status: request.sla_status,
                      previous_urgency: request.urgency,
                      new_urgency: newUrgency
                    }
                  });
              })()
            );
          }

          // Rule 3: At risk with high expected value
          if (
            request.sla_status === 'at_risk' &&
            request.expected_value &&
            request.expected_value >= 20000 &&
            request.urgency !== 'critical'
          ) {
            console.log(`[Escalation] Request ${request.id}: High value at risk - $${request.expected_value}`);

            escalations.push(
              (async () => {
                await supabase
                  .from('requests')
                  .update({ urgency: 'critical' })
                  .eq('id', request.id);

                await supabase
                  .from('request_activity_log')
                  .insert({
                    request_id: request.id,
                    action: 'auto_escalated',
                    details: {
                      reason: 'high_value_at_risk',
                      expected_value: request.expected_value,
                      sla_status: request.sla_status,
                      previous_urgency: request.urgency
                    }
                  });
              })()
            );
          }
        }

        // Execute all escalations
        if (escalations.length > 0) {
          await Promise.all(escalations);
          console.log(`[Escalation] Processed ${escalations.length} escalations`);
        }
      } catch (error) {
        console.error('Escalation engine error:', error);
      }
    };

    // Run immediately
    checkAndEscalate();

    // Then run every 5 minutes
    const interval = setInterval(checkAndEscalate, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled]);
}
