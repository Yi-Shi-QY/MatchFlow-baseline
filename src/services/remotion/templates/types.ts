import type React from "react";

export interface AnimationTemplateContext {
  homeName: string;
  awayName: string;
  baseExample: any;
}

export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
  schema: any;
  requiredParams: string[];
  example: any;
  fillParams: (params: any) => any;
  validateParams?: (params: any) => string[];
  buildFallbackParams?: (context: AnimationTemplateContext) => any;
  buildPromptExample?: (context: AnimationTemplateContext) => any;
  Component: React.FC<{ data: any }>;
}
