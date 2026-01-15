const fs = require('fs');
const filePath = 'src/features/fsm/components/project/ProjectContextHeader.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the ProjectPipelineProgress import that accidentally got icons
content = content.replace(
  `import {
  Phone,
  Edit2,
  Share2,
  ProjectPipelineProgress,
  extractPipelineData,
  type ProjectPipelineData,
} from '../shared/ProjectPipelineProgress';`,
  `import {
  ProjectPipelineProgress,
  extractPipelineData,
  type ProjectPipelineData,
} from '../shared/ProjectPipelineProgress';`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed ProjectPipelineProgress import');
