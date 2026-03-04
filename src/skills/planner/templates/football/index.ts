import { PlanTemplate } from "../../types";
import { basicTemplate } from "./basic";
import { comprehensiveTemplate } from "./comprehensive";
import { oddsFocusedTemplate } from "./odds_focused";
import { standardTemplate } from "./standard";

export { basicTemplate } from "./basic";
export { standardTemplate } from "./standard";
export { oddsFocusedTemplate } from "./odds_focused";
export { comprehensiveTemplate } from "./comprehensive";

export const DOMAIN_TEMPLATE_ENTRIES: PlanTemplate[] = [
  basicTemplate,
  standardTemplate,
  oddsFocusedTemplate,
  comprehensiveTemplate,
];
