import { PlanTemplate } from '../../types';
import { stocksBasicTemplate } from './basic';
import { stocksComprehensiveTemplate } from './comprehensive';
import { stocksRiskFocusedTemplate } from './risk_focused';
import { stocksStandardTemplate } from './standard';

export { stocksBasicTemplate } from './basic';
export { stocksStandardTemplate } from './standard';
export { stocksRiskFocusedTemplate } from './risk_focused';
export { stocksComprehensiveTemplate } from './comprehensive';

export const DOMAIN_TEMPLATE_ENTRIES: PlanTemplate[] = [
  stocksBasicTemplate,
  stocksStandardTemplate,
  stocksRiskFocusedTemplate,
  stocksComprehensiveTemplate,
];
