import React from 'react';
import * as remotion from 'remotion';
import { transform } from 'sucrase';
import * as lucide from 'lucide-react';
import { TEMPLATES } from '@/src/services/remotion/templates';

export function evaluateRemotionCode(code: string): React.ComponentType<any> | null {
  try {
    let cleanCode = code;
    
    // Extract code from markdown blocks if present, while preserving our static code
    // The static code is separated by comments like // --- Animation Component ---
    
    const extractCodeFromSection = (section: string) => {
      const codeBlockRegex = /```(?:tsx|ts|jsx|js)?\n([\s\S]*?)```/g;
      let matches;
      let extractedCode = '';
      let hasCodeBlocks = false;
      
      while ((matches = codeBlockRegex.exec(section)) !== null) {
        hasCodeBlocks = true;
        extractedCode += matches[1] + '\n';
      }
      
      if (!hasCodeBlocks) {
        // Check for incomplete markdown block
        const incompleteRegex = /```(?:tsx|ts|jsx|js)?\n([\s\S]*)$/;
        const incompleteMatch = incompleteRegex.exec(section);
        if (incompleteMatch) {
          hasCodeBlocks = true;
          extractedCode = incompleteMatch[1];
        }
      }
      
      return hasCodeBlocks ? extractedCode : section;
    };

    // Split the code into sections based on our markers
    const parts = cleanCode.split(/(\/\/ --- Animation Component ---|\/\/ --- Narration Component ---|\/\/ --- Main Scene ---)/);
    
    if (parts.length > 1) {
      cleanCode = '';
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].startsWith('// ---')) {
          cleanCode += parts[i] + '\n';
        } else {
          cleanCode += extractCodeFromSection(parts[i]);
        }
      }
    } else {
      // Fallback if markers are missing
      cleanCode = extractCodeFromSection(cleanCode);
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
