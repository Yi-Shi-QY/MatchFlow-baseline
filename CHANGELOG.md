# Changelog

All notable changes to this project are documented in this file.

## 2026-03-01

### Added

- Added deterministic animation payload normalization and validation in `src/services/remotion/templateParams.ts`.
- Added template-id-based animation rendering path in `src/components/RemotionPlayer.tsx`.
- Added architecture inventory document: `ARCHITECTURE_MAP.md`.

### Changed

- Consolidated AI runtime toward parameter-first animation flow in `src/services/ai.ts`.
- Refreshed architecture docs:
  - `README.md`
  - `PROJECT_GUIDE.md`
  - `AI_AGENT_FRAMEWORK.md`
  - `src/docs/AGENT_GUIDE.md`
  - `赛事数据源扩展指南.md`
  - `赛事数据服务端接口指南.md`
  - `数据分析Agent修改指南.md`
- Repaired widespread text encoding issues in prompts/UI/docs to ensure UTF-8 compatibility.

### Removed

- Removed legacy dynamic Remotion code-generation path and related unused modules.
