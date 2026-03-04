import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const workspaceDir = path.resolve(process.cwd(), 'src/pages/workspaces');
const files = readdirSync(workspaceDir)
  .filter((name) => name.endsWith('WorkspacePages.tsx'))
  .map((name) => path.join(workspaceDir, name));

const rawTextNodePattern = />\s*([A-Za-z][^<{]{0,120})\s*</g;
const directIssueRenderPattern = /<li key=\{(issue|warning)\}>\{\1\}<\/li>/;

const findings = [];

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (directIssueRenderPattern.test(line)) {
      findings.push({
        file: relativePath,
        line: index + 1,
        message: 'Direct issue/warning rendering detected; use localized mapping helper before rendering.',
      });
    }

    rawTextNodePattern.lastIndex = 0;
    let match;
    while ((match = rawTextNodePattern.exec(line)) !== null) {
      const rawText = match[1].trim();
      if (!rawText) {
        continue;
      }
      findings.push({
        file: relativePath,
        line: index + 1,
        message: `Possible hardcoded text node: "${rawText}"`,
      });
    }
  });
}

if (findings.length > 0) {
  console.error('Workspace i18n check failed. Resolve the following findings:');
  findings.forEach((finding) => {
    console.error(`- ${finding.file}:${finding.line} ${finding.message}`);
  });
  process.exit(1);
}

console.log(`Workspace i18n check passed (${files.length} files scanned).`);
