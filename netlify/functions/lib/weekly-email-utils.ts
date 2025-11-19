/**
 * Shared utilities for weekly email functions
 */

/**
 * Get Monday of the current week (week starts on Monday)
 */
export function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

/**
 * Get Monday of last week
 */
export function getMondayOfLastWeek(): string {
  const currentMonday = new Date(getMondayOfCurrentWeek());
  currentMonday.setDate(currentMonday.getDate() - 7);
  return currentMonday.toISOString().split('T')[0];
}

/**
 * Format a week range for display (e.g., "Jan 8-14, 2025")
 */
export function formatWeekRange(mondayDateStr: string): string {
  const monday = new Date(mondayDateStr);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const monthStr = monday.toLocaleDateString('en-US', { month: 'short' });
  const startDay = monday.getDate();
  const endDay = sunday.getDate();
  const year = sunday.getFullYear();

  return `${monthStr} ${startDay}-${endDay}, ${year}`;
}

/**
 * Get email recipients based on settings
 * For now returns a default list - can be enhanced with settings query
 */
export function getRecipients(settingsValue?: any): string[] {
  // TODO: Parse settings to get actual recipient list
  // For now, return default leadership email
  return ['giacomo@discountfenceusa.com'];
}

/**
 * Group updates by Function → Area → Initiative hierarchy
 */
export function groupUpdatesByHierarchy(updates: any[]): any {
  const grouped: any = {};

  for (const update of updates) {
    const functionName = update.initiative?.area?.function?.name || 'Uncategorized';
    const areaName = update.initiative?.area?.name || 'Uncategorized';
    const initiativeName = update.initiative?.title || 'Untitled';

    if (!grouped[functionName]) {
      grouped[functionName] = {};
    }
    if (!grouped[functionName][areaName]) {
      grouped[functionName][areaName] = {};
    }
    if (!grouped[functionName][areaName][initiativeName]) {
      grouped[functionName][areaName][initiativeName] = [];
    }

    grouped[functionName][areaName][initiativeName].push(update);
  }

  return grouped;
}

/**
 * Generate HTML email for weekly summary
 */
export function generateSummaryHTML(grouped: any, weekDate: string): string {
  const weekRange = formatWeekRange(weekDate);

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
        h2 { color: #1e40af; margin-top: 30px; padding: 10px; background: #eff6ff; border-left: 4px solid #2563eb; }
        h3 { color: #1e3a8a; margin-left: 20px; margin-top: 20px; }
        h4 { color: #1e293b; margin-left: 40px; font-weight: 600; }
        .update-text { margin-left: 60px; padding: 15px; background: #f8fafc; border-left: 3px solid #cbd5e1; color: #475569; }
        .author { margin-left: 60px; font-size: 12px; color: #64748b; font-style: italic; margin-top: 5px; }
        .no-updates { margin-left: 60px; color: #94a3b8; font-style: italic; }
        hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
      </style>
    </head>
    <body>
      <h1>📊 Leadership Weekly Summary</h1>
      <p style="font-size: 18px; color: #64748b; margin-bottom: 30px;">Week of ${weekRange}</p>
      <hr>
  `;

  const functionNames = Object.keys(grouped).sort();

  if (functionNames.length === 0) {
    html += '<p class="no-updates">No updates were submitted for this week.</p>';
  } else {
    for (const functionName of functionNames) {
      html += `<h2>📁 ${functionName}</h2>`;
      const areas = grouped[functionName];
      const areaNames = Object.keys(areas).sort();

      for (const areaName of areaNames) {
        html += `<h3>▸ ${areaName}</h3>`;
        const initiatives = areas[areaName];
        const initiativeNames = Object.keys(initiatives).sort();

        for (const initiativeName of initiativeNames) {
          const updates = initiatives[initiativeName];
          const update = updates[0]; // Should only be one per week

          html += `<h4>✓ ${initiativeName}</h4>`;

          if (update.update_text) {
            html += `<div class="update-text">${update.update_text.replace(/\n/g, '<br>')}</div>`;
          } else {
            html += '<p class="no-updates">No update provided</p>';
          }

          if (update.author?.full_name) {
            html += `<p class="author">— ${update.author.full_name}</p>`;
          }
        }
      }
    }
  }

  html += `
      <hr>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px;">
        This is an automated email from Discount Fence Hub Leadership Portal
      </p>
    </body>
    </html>
  `;

  return html;
}
