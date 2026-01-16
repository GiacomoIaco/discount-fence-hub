// Test script to introspect Jobber API schema
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function refreshToken(refreshTokenValue: string): Promise<string> {
  const response = await fetch(JOBBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: process.env.JOBBER_CLIENT_ID!,
      client_secret: process.env.JOBBER_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const token = await response.json();
  return token.access_token;
}

async function getAccessToken(): Promise<string> {
  const { data: tokenData, error: tokenError } = await supabase
    .from('jobber_tokens')
    .select('*')
    .eq('id', 'residential')
    .single();

  if (tokenError || !tokenData) {
    throw new Error('No token found for residential');
  }

  const isExpired = new Date(tokenData.access_token_expires_at) < new Date();

  if (isExpired) {
    console.log('Refreshing token...');
    return refreshToken(tokenData.refresh_token);
  }

  return tokenData.access_token;
}

async function graphqlQuery(accessToken: string, query: string) {
  const response = await fetch(JOBBER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION || '2025-01-20',
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  return result;
}

async function main() {
  const accessToken = await getAccessToken();

  // Introspect the Job type
  const introspectionQuery = `
    query {
      __type(name: "Job") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
              fields {
                name
                type {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  console.log('Introspecting Job type...\n');
  const result = await graphqlQuery(accessToken, introspectionQuery);

  if (result.errors) {
    console.log('Introspection errors:', JSON.stringify(result.errors, null, 2));
    return;
  }

  const fields = result.data?.__type?.fields || [];
  console.log('Job fields:');
  for (const field of fields) {
    const typeName = field.type?.name || field.type?.ofType?.name || field.type?.kind;
    console.log(`  ${field.name}: ${typeName}`);

    // If this is an object type, show its fields too
    if (field.type?.ofType?.fields) {
      for (const subField of field.type.ofType.fields) {
        console.log(`    .${subField.name}: ${subField.type?.name}`);
      }
    }
  }

  // Also introspect JobAmounts if it exists
  const amountsQuery = `
    query {
      __type(name: "JobAmounts") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }
  `;

  console.log('\n\nIntrospecting JobAmounts type...\n');
  const amountsResult = await graphqlQuery(accessToken, amountsQuery);

  if (amountsResult.data?.__type?.fields) {
    console.log('JobAmounts fields:');
    for (const field of amountsResult.data.__type.fields) {
      console.log(`  ${field.name}: ${field.type?.name || field.type?.kind}`);
    }
  } else {
    console.log('Could not get JobAmounts fields');
  }
}

main().catch(console.error);
