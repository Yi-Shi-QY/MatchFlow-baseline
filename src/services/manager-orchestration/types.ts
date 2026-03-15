export type ManagerRoutingMode = 'single' | 'composite' | 'ambiguous';

export interface ManagerRoutingItem {
  domainId: string;
  sourceText: string;
  confidence: number;
  reason?: string;
}

export interface ManagerRoutingResult {
  mode: ManagerRoutingMode;
  items: ManagerRoutingItem[];
}

export type ManagerCompositeWorkflowStatus = 'planning' | 'active' | 'blocked' | 'completed';
export type ManagerCompositeItemStatus = 'pending' | 'active' | 'blocked' | 'completed' | 'failed';

export interface ManagerCompositeItem {
  itemId: string;
  title: string;
  domainId: string;
  sourceText: string;
  status: ManagerCompositeItemStatus;
  childSessionId?: string | null;
  childWorkflowType?: string | null;
  childWorkflowStateData?: Record<string, unknown> | null;
  pendingLabel?: string;
  summary?: string;
}

export interface ManagerCompositeWorkflowState {
  schemaVersion: 'manager_composite_v1';
  workflowId: string;
  workflowType: 'manager_composite';
  sourceText: string;
  status: ManagerCompositeWorkflowStatus;
  activeItemId: string | null;
  items: ManagerCompositeItem[];
  createdAt: number;
  updatedAt: number;
}
