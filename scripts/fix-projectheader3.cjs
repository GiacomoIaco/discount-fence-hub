const fs = require('fs');
const filePath = 'src/features/fsm/components/project/ProjectContextHeader.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add callback props to interface
content = content.replace(
  `  /** Callback when pipeline stage is clicked */
  onPipelineStageClick?: (stageId: string) => void;
}`,
  `  /** Callback when pipeline stage is clicked */
  onPipelineStageClick?: (stageId: string) => void;
  /** Callback when Edit button is clicked */
  onEdit?: () => void;
  /** Callback when Share/Invite button is clicked */
  onShare?: () => void;
}`
);

// 2. Add to destructuring
content = content.replace(
  `  pipelineData: externalPipelineData,
  onPipelineStageClick,
}: ProjectContextHeaderProps)`,
  `  pipelineData: externalPipelineData,
  onPipelineStageClick,
  onEdit,
  onShare,
}: ProjectContextHeaderProps)`
);

// 3. Add clientPhone extraction after assignedRep
content = content.replace(
  `const assignedRep =
    project.rep_name ||
    project.assigned_rep_user?.name ||
    project.assigned_rep_user?.full_name;`,
  `const assignedRep =
    project.rep_name ||
    project.assigned_rep_user?.name ||
    project.assigned_rep_user?.full_name;

  const clientPhone = project.client_phone || project.client?.primary_contact_phone;`
);

// 4. Add phone display after assigned rep section
content = content.replace(
  `        {/* Assigned Rep */}
        {assignedRep && (
          <div className="flex items-center gap-1.5 text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{assignedRep}</span>
          </div>
        )}

        {/* Project Value */}`,
  `        {/* Assigned Rep */}
        {assignedRep && (
          <div className="flex items-center gap-1.5 text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{assignedRep}</span>
          </div>
        )}

        {/* Client Phone */}
        {clientPhone && (
          <a
            href={\`tel:\${clientPhone}\`}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{clientPhone}</span>
          </a>
        )}

        {/* Project Value */}`
);

// 5. Add action buttons before status badge
content = content.replace(
  `        {/* Status badge */}
        {project.status && (`,
  `        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/50 hover:bg-blue-500/70 rounded transition-colors"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>
          )}
        </div>

        {/* Status badge */}
        {project.status && (`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added phone display and action buttons');
