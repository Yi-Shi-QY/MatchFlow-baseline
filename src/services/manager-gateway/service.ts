import { createManagerGateway } from './gateway';
import { createManagerSessionStore } from './sessionStore';
import type { ManagerGateway } from './types';
import { createLegacyManagerGatewayLlmPlanner } from '@/src/services/manager/llmPlanner';

let managerGatewaySingleton: ManagerGateway | null = null;

export function getManagerGateway(): ManagerGateway {
  if (!managerGatewaySingleton) {
    managerGatewaySingleton = createManagerGateway({
      sessionStore: createManagerSessionStore(),
      llmPlanner: createLegacyManagerGatewayLlmPlanner(),
    });
  }
  return managerGatewaySingleton;
}
