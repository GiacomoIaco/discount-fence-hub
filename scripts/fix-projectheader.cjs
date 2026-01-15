const fs = require('fs');
const filePath = 'src/features/fsm/components/project/ProjectContextHeader.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix duplicate imports - rewrite the entire import section
content = content.replace(
  /import \{[\s\S]*?\} from 'lucide-react';/g,
  `import {
  Building2,
  MapPin,
  Briefcase,
  User,
  ChevronLeft,
  DollarSign,
  Calendar,
  Phone,
  Edit2,
  Share2,
} from 'lucide-react';`
);

// Remove duplicate lucide imports if any
const lucideImportCount = (content.match(/from 'lucide-react'/g) || []).length;
if (lucideImportCount > 1) {
  // Keep only the first lucide import block
  const firstEnd = content.indexOf("} from 'lucide-react';") + "} from 'lucide-react';".length;
  const secondStart = content.indexOf("import {", firstEnd);
  const secondEnd = content.indexOf("} from 'lucide-react';", secondStart) + "} from 'lucide-react';".length;
  if (secondStart > 0 && secondEnd > secondStart) {
    content = content.substring(0, secondStart) + content.substring(secondEnd);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed imports');
