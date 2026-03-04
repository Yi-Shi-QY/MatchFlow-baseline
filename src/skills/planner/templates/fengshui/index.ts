import { PlanTemplate } from "../../types";
import { fengshuiBasicTemplate } from "./basic";
import { fengshuiStandardTemplate } from "./standard";
import { fengshuiFocusedTemplate } from "./focused";
import { fengshuiComprehensiveTemplate } from "./comprehensive";

export { fengshuiBasicTemplate } from "./basic";
export { fengshuiStandardTemplate } from "./standard";
export { fengshuiFocusedTemplate } from "./focused";
export { fengshuiComprehensiveTemplate } from "./comprehensive";

export const DOMAIN_TEMPLATE_ENTRIES: PlanTemplate[] = [
  fengshuiBasicTemplate,
  fengshuiStandardTemplate,
  fengshuiFocusedTemplate,
  fengshuiComprehensiveTemplate,
];
