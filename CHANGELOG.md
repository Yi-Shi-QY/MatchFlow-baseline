# Changelog

All notable changes to this project are documented in this file.

## 2026-03-01

### Added
- Added deterministic animation payload normalization and validation in [`src/services/remotion/templateParams.ts`](src/services/remotion/templateParams.ts).
- Added explicit template-id-based animation rendering path in [`src/components/RemotionPlayer.tsx`](src/components/RemotionPlayer.tsx).

### Changed
- Consolidated AI runtime to parameter-first animation flow in [`src/services/ai.ts`](src/services/ai.ts).
- Updated architecture and maintenance documentation to match current implementation:
  - [`README.md`](README.md)
  - [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md)
  - [`AI_AGENT_FRAMEWORK.md`](AI_AGENT_FRAMEWORK.md)
  - [`src/docs/AGENT_GUIDE.md`](src/docs/AGENT_GUIDE.md)
  - [`数据分析Agent修改指南.md`](数据分析Agent修改指南.md)
  - [`赛事数据服务端接口指南.md`](赛事数据服务端接口指南.md)
  - [`赛事数据源扩展指南.md`](赛事数据源扩展指南.md)

### Removed
- Removed legacy dynamic Remotion code-generation path and related rule files.
- Removed unused/legacy modules:
  - `src/agents/narration.ts`
  - `src/skills/animation.ts`
  - `src/skills/animation_templates/*`
  - `src/services/remotionRules.ts`
  - `src/services/remotion/animationRules.ts`
  - `src/services/remotion/narrationRules.ts`
  - `src/utils/evaluateRemotion.ts`
  - `动画Agent修改指南.md`
