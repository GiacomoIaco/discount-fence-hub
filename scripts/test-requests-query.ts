import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';

async function test() {
  // Get token
  const { data: tokenData } = await supabase
    .from('jobber_tokens')
    .select('access_token')
    .eq('id', 'residential')
    .single();

  if (!tokenData) {
    console.error('No token found');
    return;
  }

  const query = `
    query TestRequests {
      requests(first: 5, filter: { createdAt: { after: "2024-01-01T00:00:00Z" } }) {
        nodes {
          id
          title
          requestStatus
          source
          createdAt
          client {
            id
            name
          }
          assessment {
            startAt
            completedAt
            assignedUsers {
              nodes {
                name {
                  full
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  console.log('Sending query...');
  const response = await fetch(JOBBER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenData.access_token}`,
      'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2));
    return;
  }

  console.log('Success! Requests found:', result.data.requests.nodes.length);
  console.log('Sample request:');
  const req = result.data.requests.nodes[0];
  console.log('  ID:', req.id);
  console.log('  Title:', req.title);
  console.log('  Source:', req.source);
  console.log('  CreatedAt:', req.createdAt);
  console.log('  Assessment:', req.assessment);

  if (req.assessment?.assignedUsers?.nodes?.length > 0) {
    console.log('  Salesperson:', req.assessment.assignedUsers.nodes[0].name?.full);
  }
}

test().catch(console.error);
