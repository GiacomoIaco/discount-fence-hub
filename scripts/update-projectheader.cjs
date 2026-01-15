const fs = require('fs');
const filePath = 'src/features/fsm/components/project/ProjectContextHeader.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add Phone, Edit2, Share2 to imports
content = content.replace(
  "import {\n  Building2,\n  MapPin,\n  Briefcase,\n  User,\n  ChevronLeft,\n  DollarSign,\n  Calendar,\n} from 'lucide-react';",
  "import {\n  Building2,\n  MapPin,\n  Briefcase,\n  User,\n  ChevronLeft,\n  DollarSign,\n  Calendar,\n  Phone,\n  Edit2,\n  Share2,\n} from 'lucide-react';"
);

// Add client phone field to interface
content = content.replace(
  "  client_display_name?: string;",
  "  client_display_name?: string;\n  client_phone?: string;"
);

// Add callbacks to props
content = content.replace(
  "  /** Callback when pipeline stage is clicked */\n  onPipelineStageClick?: (stageId: string) => void;",
  "  /** Callback when pipeline stage is clicked */\n  onPipelineStageClick?: (stageId: string) => void;\n  /** Callback when Edit button is clicked */\n  onEdit?: () => void;\n  /** Callback when Share/Invite button is clicked */\n  onShare?: () => void;"
);

// Add to destructuring
content = content.replace(
  "  pipelineData: externalPipelineData,\n  onPipelineStageClick,\n}: ProjectContextHeaderProps)",
  "  pipelineData: externalPipelineData,\n  onPipelineStageClick,\n  onEdit,\n  onShare,\n}: ProjectContextHeaderProps)"
);

// Add client phone extraction after assignedRep
content = content.replace(
  "  const assignedRep =\n    project.rep_name ||\n    project.assigned_rep_user?.name ||\n    project.assigned_rep_user?.full_name;",
  "  const assignedRep =\n    project.rep_name ||\n    project.assigned_rep_user?.name ||\n    project.assigned_rep_user?.full_name;\n\n  const clientPhone = project.client_phone || project.client?.primary_contact_phone;"
);

// Add phone display after assigned rep in Row 2
const repSection = `        {/* Assigned Rep */}
        {assignedRep && (
          <div className="flex items-center gap-1.5 text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{assignedRep}</span>
          </div>
        )}`;

const repWithPhone = `        {/* Assigned Rep */}
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
        )}`;

content = content.replace(repSection, repWithPhone);

// Add action buttons before status badge
const statusBadge = `        {/* Status badge */}
        {project.status && (`;

const actionsAndStatus = `        {/* Action Buttons */}
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
        {project.status && (`;

content = content.replace(statusBadge, actionsAndStatus);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated ProjectContextHeader.tsx with phone and action buttons');
