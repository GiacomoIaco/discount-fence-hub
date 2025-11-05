interface Initiative {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  color_status: string;
  progress_percent: number;
  assigned_user?: {
    full_name: string;
  };
  bucket?: {
    name: string;
  };
}

interface FunctionData {
  name: string;
  initiatives: Initiative[];
}

export function generateWeeklySummaryHTML(
  weekStart: string,
  weekEnd: string,
  functionsData: FunctionData[]
): string {
  const statusEmoji = {
    green: '🟢',
    yellow: '🟡',
    red: '🔴',
  };

  const priorityBadge = {
    high: '<span style="background: #DC2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">HIGH</span>',
    medium: '<span style="background: #2563EB; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">MEDIUM</span>',
    low: '<span style="background: #6B7280; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">LOW</span>',
  };

  const functionsHTML = functionsData.map(func => {
    const redInitiatives = func.initiatives.filter(i => i.color_status === 'red');
    const yellowInitiatives = func.initiatives.filter(i => i.color_status === 'yellow');
    const greenInitiatives = func.initiatives.filter(i => i.color_status === 'green');

    const initiativesHTML = [
      ...redInitiatives,
      ...yellowInitiatives,
      ...greenInitiatives,
    ].map(initiative => `
      <div style="background: white; border-left: 4px solid ${
        initiative.color_status === 'red' ? '#DC2626' :
        initiative.color_status === 'yellow' ? '#F59E0B' :
        '#10B981'
      }; padding: 16px; margin-bottom: 12px; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">
            ${statusEmoji[initiative.color_status as keyof typeof statusEmoji]} ${initiative.title}
          </h4>
          ${priorityBadge[initiative.priority as keyof typeof priorityBadge]}
        </div>
        ${initiative.description ? `
          <p style="margin: 8px 0; color: #6B7280; font-size: 14px;">
            ${initiative.description}
          </p>
        ` : ''}
        <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 13px; color: #6B7280;">
          <div><strong>Bucket:</strong> ${initiative.bucket?.name || 'N/A'}</div>
          <div><strong>Owner:</strong> ${initiative.assigned_user?.full_name || 'Unassigned'}</div>
          <div><strong>Progress:</strong> ${initiative.progress_percent}%</div>
        </div>
        <div style="background: #E5E7EB; height: 8px; border-radius: 4px; margin-top: 8px;">
          <div style="background: #2563EB; height: 100%; width: ${initiative.progress_percent}%; border-radius: 4px;"></div>
        </div>
      </div>
    `).join('');

    const summary = `
      <div style="margin-bottom: 8px; padding: 12px; background: ${
        redInitiatives.length > 0 ? '#FEF2F2' :
        yellowInitiatives.length > 0 ? '#FFFBEB' :
        '#F0FDF4'
      }; border-radius: 4px;">
        <strong>${statusEmoji.red} Critical: ${redInitiatives.length}</strong> •
        <strong>${statusEmoji.yellow} At Risk: ${yellowInitiatives.length}</strong> •
        <strong>${statusEmoji.green} On Track: ${greenInitiatives.length}</strong>
      </div>
    `;

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #E5E7EB;">
          ${func.name}
        </h2>
        ${summary}
        ${initiativesHTML}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Leadership Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9FAFB;">
  <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%); padding: 32px; border-radius: 8px; margin-bottom: 32px; color: white;">
      <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 700;">Weekly Leadership Summary</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 16px;">Week of ${weekStart} - ${weekEnd}</p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      ${functionsHTML}

      <!-- Legend -->}
      <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid #E5E7EB;">
        <h3 style="color: #111827; font-size: 18px; font-weight: 600; margin-bottom: 12px;">Status Indicators</h3>
        <div style="font-size: 14px; color: #6B7280; line-height: 1.8;">
          <div>🟢 <strong>Green (On Track):</strong> Initiative is progressing as planned</div>
          <div>🟡 <strong>Yellow (At Risk):</strong> Initiative needs monitoring, potential delays</div>
          <div>🔴 <strong>Red (Critical):</strong> Initiative requires immediate attention</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top: 24px; text-align: center; color: #9CA3AF; font-size: 13px;">
      <p>This is an automated weekly summary from the Leadership Project Management system.</p>
      <p>Generated with <a href="https://claude.com/claude-code" style="color: #667EEA; text-decoration: none;">Claude Code</a></p>
    </div>
  </div>
</body>
</html>
  `;
}
