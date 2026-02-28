import React from 'react';
import * as remotion from 'remotion';
import { transform } from 'sucrase';
import * as lucide from 'lucide-react';
import { TEMPLATES } from '@/src/services/remotion/templates';

export function evaluateRemotionCode(code: string): React.ComponentType<any> | null {
  try {
    // Remove markdown code blocks if present
    let cleanCode = code;
    if (cleanCode.startsWith('\`\`\`')) {
      cleanCode = cleanCode.replace(/^\`\`\`(tsx|ts|jsx|js)?\n/, '').replace(/\n\`\`\`$/, '');
    }

    const transpiled = transform(cleanCode, {
      transforms: ['jsx', 'typescript', 'imports'],
      jsxRuntime: 'classic', // Uses React.createElement
    }).code;

    const requireFn = (moduleName: string) => {
      if (moduleName === 'react') {
        // Handle default import for React
        return { ...React, default: React, __esModule: true };
      }
      if (moduleName === 'remotion') {
        return { ...remotion, __esModule: true };
      }
      if (moduleName === 'lucide-react') {
        return { ...lucide, __esModule: true };
      }
      if (moduleName === '@/src/services/remotion/templates') {
        return { TEMPLATES, __esModule: true };
      }
      console.warn(`Module ${moduleName} not found in dynamic evaluation`);
      return {};
    };

    const exports: any = {};
    const module = { exports };
    
    const fn = new Function('require', 'exports', 'module', 'React', transpiled);
    fn(requireFn, exports, module, React);
    
    return exports.default || module.exports.default || module.exports;
  } catch (e) {
    console.error("Failed to evaluate Remotion code:", e);
    return null;
  }
}
