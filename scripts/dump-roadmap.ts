/**
 * Dump roadmap items to a markdown file for Claude to read
 * Run with: npx tsx scripts/dump-roadmap.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mravqfoypwyutjqtoxet.supabase.co';
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  // Try to read from .env file
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
    if (match) {
      supabaseKey = match[1].trim();
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface RoadmapItem {
  code: string;
  hub: string;
  title: string;
  raw_idea: string | null;
  claude_analysis: string | null;
  status: string;
  importance: number;
  complexity: string;
  created_at: string;
}

async function dumpRoadmap() {
  console.log('Fetching roadmap items...');

  const { data, error } = await supabase
    .from('roadmap_items')
    .select('code, hub, title, raw_idea, claude_analysis, status, importance, complexity, created_at')
    .order('hub')
    .order('status')
    .order('importance', { ascending: false });

  if (error) {
    console.error('Error fetching roadmap:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No roadmap items found');
    process.exit(0);
  }

  // Group by hub
  const byHub: Record<string, RoadmapItem[]> = {};
  for (const item of data) {
    if (!byHub[item.hub]) {
      byHub[item.hub] = [];
    }
    byHub[item.hub].push(item);
  }

  // Generate markdown
  let markdown = `# Roadmap Items\n\n`;
  markdown += `*Generated: ${new Date().toISOString()}*\n\n`;
  markdown += `**Total items:** ${data.length}\n\n`;

  // Summary by status
  const statusCounts: Record<string, number> = {};
  for (const item of data) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  }
  markdown += `**By status:** ${Object.entries(statusCounts).map(([s, c]) => `${s}(${c})`).join(', ')}\n\n`;

  markdown += `---\n\n`;

  const hubLabels: Record<string, string> = {
    'general': 'General (G)',
    'operations': 'Operations (O)',
    'requests': 'Requests (R)',
    'sales': 'Sales (S)',
    'communication': 'Communication (C)',
    'photos': 'Photos (P)',
    'analytics': 'Analytics (A)',
    'future': 'Future Vision (F)',
  };

  for (const hub of Object.keys(byHub).sort()) {
    const items = byHub[hub];
    markdown += `## ${hubLabels[hub] || hub}\n\n`;

    for (const item of items) {
      const stars = '★'.repeat(item.importance) + '☆'.repeat(5 - item.importance);
      markdown += `### ${item.code}: ${item.title}\n\n`;
      markdown += `- **Status:** ${item.status} | **Complexity:** ${item.complexity} | **Importance:** ${stars}\n`;

      if (item.raw_idea) {
        markdown += `- **Description:** ${item.raw_idea}\n`;
      }
      if (item.claude_analysis) {
        markdown += `- **AI Analysis:** ${item.claude_analysis}\n`;
      }
      markdown += `\n`;
    }
  }

  // Write to file
  const outputPath = path.join(__dirname, '..', 'ROADMAP_ITEMS.md');
  fs.writeFileSync(outputPath, markdown);
  console.log(`Roadmap dumped to ${outputPath}`);
  console.log(`Total items: ${data.length}`);
}

dumpRoadmap();
