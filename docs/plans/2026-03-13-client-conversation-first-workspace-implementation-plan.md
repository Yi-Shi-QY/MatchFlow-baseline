# Client Conversation-First Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将客户端重构为对话优先的移动端工作空间，落地新的一级/二级页面体系、任务中心、分析与数据、历史、记忆和正式设置体系，同时清理研发态文案与旧页面残留。

**Architecture:** 保留现有 `manager gateway`、`automation runtime`、`subject route` 和 `WorkspaceShell` 作为业务真相与应用壳层，只做增量重构，不推翻现有 2.0 核心。UI 层优先引入纯 view-model / selector 文件承接排序、分区和卡片状态，避免把页面逻辑继续堆进现有大组件；`Home.tsx` 中已存在的历史、对象和数据展示能力不直接复制，而是拆成共享卡片与新页面模型；记忆页复用 `manager memories` 作为内容真相，再用独立 UI metadata store 补齐状态、来源链路和去重信息。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Router, i18next, Capacitor, manager gateway session store, automation runtime, SQLite with localStorage fallback.

---

## Scope

本计划覆盖以下正式产品改造：

- 一级导航与移动端壳层收口
- 首页对话优先骨架、继续区和建议回复区
- 任务中心正式化
- 分析与数据页正式化
- 历史页独立化
- 记忆页与详情页基础能力
- 设置首页重构
- `连接与数据` / `高级与诊断` 二级页
- 正式文案与 i18n 清理

## Non-Goals

本计划明确不包含：

- 账号体系接入后的权限自动分配
- 真正的多 runtime pack 热插拔执行
- 完整的桌面端专属布局重做
- 开发联调选项在正式版中的可见入口
- 复杂的全自动记忆合并决策

## Delivery Rules

- 先做路由与壳层，再做页面，不跳步。
- 每个页面优先落纯 model / selector 测试，再接 UI。
- 不重复保留旧的研发态文案。
- `Settings`、`History`、`Memory` 等新增页面必须进入正式路由，但不进入错误的一级导航层级。
- `Home.tsx` 中被拆走的能力必须完成迁移后才能删除或彻底弃用。

## Route Target

本计划完成后，客户端路由目标应为：

- `/` -> 对话中心
- `/tasks` -> 任务中心
- `/sources` -> 分析与数据
- `/history` -> 历史
- `/memory` -> 记忆
- `/memory/:memoryId` -> 记忆详情
- `/settings` -> 设置首页
- `/settings/connections` -> 连接与数据
- `/settings/diagnostics` -> 高级与诊断
- `/extensions` -> 扩展管理
- `/subject/:domainId/:subjectId` -> 主题详情 / 分析执行页

## Test Strategy

- 纯逻辑优先使用 Vitest 单测，覆盖排序、分区、状态映射、去重和路由配置。
- 页面层尽量通过纯 model 测试和手工 smoke 验证，不在本阶段额外引入新的重量级 UI 测试框架。
- 每个任务完成后至少执行对应 focused test；阶段末执行 `npm.cmd run lint` 与 `npm.cmd run build`。

---

### Task 1: Freeze workspace route and navigation contracts

**Files:**
- Create: `src/services/navigation/workspaceNav.ts`
- Test: `src/services/__tests__/workspaceNav.test.ts`
- Modify: `src/components/layout/WorkspaceShell.tsx`
- Modify: `src/App.tsx`
- Create: `src/pages/History.tsx`
- Create: `src/pages/Memory.tsx`
- Create: `src/pages/settings/ConnectionDataSettings.tsx`
- Create: `src/pages/settings/AdvancedDiagnostics.tsx`

**Step 1: Write the failing route-contract test**

Cover these expectations:

```ts
expect(getPrimaryWorkspaceNav().map((item) => item.id)).toEqual([
  'chat',
  'tasks',
  'sources',
  'history',
  'memory',
  'settings',
]);

expect(getSettingsChildRoutes()).toEqual([
  '/settings/connections',
  '/settings/diagnostics',
]);

expect(isPrimaryWorkspaceRoute('/settings/connections')).toBe(false);
expect(isPrimaryWorkspaceRoute('/extensions')).toBe(false);
```

**Step 2: Run the focused test to verify the gap**

Run:

```bash
npx vitest run src/services/__tests__/workspaceNav.test.ts
```

Expected:
- FAIL because the route/navigation contract does not exist yet

**Step 3: Create `workspaceNav.ts` and move shell navigation to that contract**

Implement:

- a typed nav config for primary workspace pages
- child route config for settings subpages
- helper predicates for primary vs secondary routes
- label/hint keys instead of hardcoded shell strings

Target shape:

```ts
export interface WorkspaceNavItem {
  id: 'chat' | 'tasks' | 'sources' | 'history' | 'memory' | 'settings';
  route: string;
  primary: boolean;
  iconKey: string;
  titleKey: string;
  hintKey: string;
}
```

**Step 4: Extend `App.tsx` with formal routes and lazy page entrypoints**

Add lazy imports and routes for:

- `/history`
- `/memory`
- `/memory/:memoryId`
- `/settings/connections`
- `/settings/diagnostics`

For this task, new pages can return minimal `WorkspaceShell` placeholders; detailed UI lands in later tasks.

**Step 5: Run verification**

Run:

```bash
npx vitest run src/services/__tests__/workspaceNav.test.ts
npm.cmd run build
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add src/services/navigation/workspaceNav.ts src/services/__tests__/workspaceNav.test.ts src/components/layout/WorkspaceShell.tsx src/App.tsx src/pages/History.tsx src/pages/Memory.tsx src/pages/settings/ConnectionDataSettings.tsx src/pages/settings/AdvancedDiagnostics.tsx
git commit -m "feat: add formal workspace route and navigation contract"
```

### Task 2: Rebuild the conversation-first homepage shell

**Files:**
- Create: `src/pages/command/homeLayoutModel.ts`
- Test: `src/pages/command/__tests__/homeLayoutModel.test.ts`
- Create: `src/pages/command/CommandCenterStatusBar.tsx`
- Create: `src/pages/command/CommandCenterContinueStrip.tsx`
- Create: `src/pages/command/CommandCenterSummaryStrip.tsx`
- Create: `src/pages/command/CommandCenterSuggestionBar.tsx`
- Modify: `src/pages/command/useCommandCenterState.ts`
- Modify: `src/pages/CommandCenter.tsx`
- Modify: `src/pages/command/CommandCenterConversation.tsx`
- Modify: `src/pages/command/CommandCenterRunStatus.tsx`

**Step 1: Write the failing homepage-layout test**

Cover:

- `continue-first` mode when blocking items exist
- `new-input-first` mode when the last flow is closed
- continue cards are capped at 3
- continue card priority is:
  1. approval request
  2. clarification reply
  3. exception handling
  4. resumable thread
- suggestion chips are auxiliary and never auto-submit

Example test shape:

```ts
const layout = deriveCommandCenterHomeLayout({
  projection,
  drafts,
  language: 'zh',
});

expect(layout.mode).toBe('continue_first');
expect(layout.continueCards).toHaveLength(3);
expect(layout.continueCards[0].kind).toBe('approval');
```

**Step 2: Run the focused test**

Run:

```bash
npx vitest run src/pages/command/__tests__/homeLayoutModel.test.ts
```

Expected:
- FAIL because the layout model does not exist yet

**Step 3: Implement the pure homepage model**

Create `homeLayoutModel.ts` that maps projection + drafts into:

- top status label
- homepage mode
- continue cards
- last summary card
- suggestion chips

Do not read React state directly in this file.

**Step 4: Wire the new homepage shell into `CommandCenter`**

Implement:

- top compact status bar component
- continue strip or last-summary strip
- suggestion chip bar above composer
- keep message flow and composer as the primary body
- remove `CommandCenterDebugPanel` from the default production page path; if needed later, gate it behind a dev-only condition rather than rendering it by default

**Step 5: Run verification**

Run:

```bash
npx vitest run src/pages/command/__tests__/homeLayoutModel.test.ts src/pages/command/__tests__/feedAdapter.test.ts src/pages/command/__tests__/runStatusModel.test.ts
npm.cmd run lint
```

Expected:
- PASS

**Step 6: Manual smoke checklist**

Verify manually:

1. Homepage shows continue strip when there is a pending draft/approval
2. Homepage falls back to last-summary strip when no blocking item exists
3. Suggestion chips populate the composer but do not auto-send
4. Bottom input remains visible while scrolling

**Step 7: Commit**

```bash
git add src/pages/command/homeLayoutModel.ts src/pages/command/__tests__/homeLayoutModel.test.ts src/pages/command/CommandCenterStatusBar.tsx src/pages/command/CommandCenterContinueStrip.tsx src/pages/command/CommandCenterSummaryStrip.tsx src/pages/command/CommandCenterSuggestionBar.tsx src/pages/command/useCommandCenterState.ts src/pages/CommandCenter.tsx src/pages/command/CommandCenterConversation.tsx src/pages/command/CommandCenterRunStatus.tsx
git commit -m "feat: rebuild command center as conversation-first homepage"
```

### Task 3: Convert Automation into the formal task center

**Files:**
- Create: `src/pages/automation/taskCenterModel.ts`
- Test: `src/pages/automation/__tests__/taskCenterModel.test.ts`
- Create: `src/pages/automation/TaskCenterSummaryGrid.tsx`
- Create: `src/pages/automation/TaskCenterSection.tsx`
- Create: `src/pages/automation/TaskCenterActionCard.tsx`
- Modify: `src/pages/automation/useAutomationTaskState.ts`
- Modify: `src/pages/Automation.tsx`
- Modify: `src/pages/automation/AutomationDraftList.tsx`
- Modify: `src/pages/automation/AutomationTaskList.tsx`
- Modify: `src/pages/automation/AutomationRunList.tsx`

**Step 1: Write the failing task-center model test**

Cover:

- top summary count order is `待我处理 / 执行中 / 已安排 / 最近完成`
- only approval / clarification / exception items enter `待我处理`
- queued but non-blocking jobs enter `已安排`
- active runs enter `执行中`
- completed runs enter `最近完成`

Example:

```ts
expect(model.waitingItems.map((item) => item.kind)).toEqual([
  'approval',
  'clarification',
  'exception',
]);
expect(model.runningItems[0].primaryAction.label).toBe('查看进展');
```

**Step 2: Run the focused test**

Run:

```bash
npx vitest run src/pages/automation/__tests__/taskCenterModel.test.ts
```

Expected:
- FAIL because the classification model does not exist yet

**Step 3: Implement the pure task-center model**

Create `taskCenterModel.ts` that converts drafts/rules/jobs/runs into:

- summary metrics
- waiting section cards
- running section cards
- scheduled section cards
- completed section cards

Keep action labels explicit:

- `确认执行`
- `继续补充`
- `处理异常`
- `查看进展`
- `查看安排`
- `查看结果`

**Step 4: Rebuild `Automation.tsx` around the new formal sections**

Implement:

- product copy update from “automation hub” to “任务中心”
- summary grid first
- section blocks in this order:
  1. `待我处理`
  2. `执行中`
  3. `已安排`
  4. `最近完成`
- move heavy diagnostics off the primary task center surface

**Step 5: Run verification**

Run:

```bash
npx vitest run src/pages/automation/__tests__/taskCenterModel.test.ts src/services/__tests__/automationCommandCenter.test.ts src/services/__tests__/automationClarification.test.ts
npm.cmd run lint
```

Expected:
- PASS

**Step 6: Manual smoke checklist**

Verify manually:

1. A draft needing clarification appears in `待我处理`
2. A running job appears in `执行中`
3. A scheduled job/rule appears in `已安排`
4. Recent completed runs show `查看结果` as the first action

**Step 7: Commit**

```bash
git add src/pages/automation/taskCenterModel.ts src/pages/automation/__tests__/taskCenterModel.test.ts src/pages/automation/TaskCenterSummaryGrid.tsx src/pages/automation/TaskCenterSection.tsx src/pages/automation/TaskCenterActionCard.tsx src/pages/automation/useAutomationTaskState.ts src/pages/Automation.tsx src/pages/automation/AutomationDraftList.tsx src/pages/automation/AutomationTaskList.tsx src/pages/automation/AutomationRunList.tsx
git commit -m "feat: convert automation page into formal task center"
```

### Task 4: Rebuild Analysis & Data workspace

**Files:**
- Create: `src/pages/dataSources/analysisDataWorkspaceModel.ts`
- Test: `src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts`
- Create: `src/pages/dataSources/useAnalysisDataWorkspaceState.ts`
- Create: `src/pages/dataSources/AnalysisDataStatusCard.tsx`
- Create: `src/pages/dataSources/AnalyzableObjectCard.tsx`
- Create: `src/pages/dataSources/DataAvailabilityCard.tsx`
- Create: `src/pages/dataSources/RecentSyncCard.tsx`
- Modify: `src/pages/DataSources.tsx`

**Step 1: Write the failing analysis-data workspace model test**

Cover:

- 首屏顺序固定为 `顶部状态摘要 / 当前可分析对象 / 数据可用性 / 最近同步或最近更新`
- `当前可分析对象` 使用主题卡片，不直接暴露原始 feed row
- `数据可用性` 只输出单张摘要卡，不展开成长列表
- `最近同步 / 最近更新` 只承接辅助信息，不抢占首屏主焦点

Example:

```ts
expect(model.sections.map((section) => section.id)).toEqual([
  'status_summary',
  'analyzable_objects',
  'data_availability',
  'recent_updates',
]);
expect(model.objectCards[0].primaryAction.label).toBe('进入分析');
expect(model.dataAvailabilityCard.kind).toBe('summary');
```

**Step 2: Run the focused test**

Run:

```bash
npx vitest run src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts
```

Expected:
- FAIL because the workspace model does not exist yet

**Step 3: Implement the pure analysis-data workspace model**

Create `analysisDataWorkspaceModel.ts` and `useAnalysisDataWorkspaceState.ts` to:

- 合并 `resolveDomainMatchFeed`、`getSavedSubjects`、`getHistory` 的结果，按主题对象输出卡片
- 计算顶部摘要区所需的对象数量、数据状态和最近更新时间
- 将 feed 刷新状态、加载失败和数据源缺失收束为单张 `数据可用性` 摘要卡
- 给最近更新区输出轻量事件项，而不是再造一个完整结果流

Do not read JSX or DOM state inside the pure model.

**Step 4: Rebuild `DataSources.tsx` around the new workspace model**

Implement:

- 顶部轻量状态摘要卡
- `当前可分析对象` 主题卡片列表
- 单张 `数据可用性` 摘要卡
- `最近同步 / 最近更新` 轻量区块
- 扫描/刷新类动作如果保留，只作为次级头部动作，不改变首屏信息顺序

**Step 5: Run verification**

Run:

```bash
npx vitest run src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts src/services/__tests__/domainMatchFeed.test.ts
npm.cmd run lint
```

Expected:
- PASS

**Step 6: Manual smoke checklist**

Verify manually:

1. 页面首屏先看到状态摘要，再看到可分析对象，而不是先看到数据流
2. 可分析对象卡片点击后能进入 `/subject/:domainId/:subjectId`
3. 数据源未配置或刷新失败时，只在 `数据可用性` 摘要卡中暴露状态
4. 最近同步区只显示轻量更新时间，不重复渲染完整历史结果列表

**Step 7: Commit**

```bash
git add src/pages/dataSources/analysisDataWorkspaceModel.ts src/pages/dataSources/__tests__/analysisDataWorkspaceModel.test.ts src/pages/dataSources/useAnalysisDataWorkspaceState.ts src/pages/dataSources/AnalysisDataStatusCard.tsx src/pages/dataSources/AnalyzableObjectCard.tsx src/pages/dataSources/DataAvailabilityCard.tsx src/pages/dataSources/RecentSyncCard.tsx src/pages/DataSources.tsx
git commit -m "feat: rebuild analysis and data workspace"
```

### Task 5: Extract a dedicated history workspace

**Files:**
- Create: `src/pages/history/historyWorkspaceModel.ts`
- Test: `src/pages/history/__tests__/historyWorkspaceModel.test.ts`
- Create: `src/pages/history/useHistoryWorkspaceState.ts`
- Create: `src/pages/history/HistorySummaryCard.tsx`
- Create: `src/pages/history/HistoryResultCard.tsx`
- Create: `src/pages/history/HistoryResumeCard.tsx`
- Create: `src/pages/history/HistorySavedTopicCard.tsx`
- Modify: `src/pages/History.tsx`
- Modify: `src/services/history.ts`
- Test: `src/services/__tests__/historyResumeRecoverability.test.ts`

**Step 1: Write the failing history workspace tests**

Cover:

- 首屏顺序固定为 `顶部轻量摘要 / 最近完成 / 可继续内容 / 已保存主题`
- `最近完成` 卡以结果浏览为第一动作
- `可继续内容` 只承接真正可恢复的主题，不重复展示当前待处理任务
- `已保存主题` 来自 `savedSubjects`，与 `可继续内容` 分开

Example:

```ts
expect(model.sections.map((section) => section.id)).toEqual([
  'summary',
  'recent_completed',
  'resumable_topics',
  'saved_topics',
]);
expect(model.resumableCards[0].primaryAction.label).toBe('继续此主题');
```

Also extend `historyResumeRecoverability.test.ts` to cover a batch listing helper for recoverable resume states.

**Step 2: Run the focused tests**

Run:

```bash
npx vitest run src/pages/history/__tests__/historyWorkspaceModel.test.ts src/services/__tests__/historyResumeRecoverability.test.ts
```

Expected:
- FAIL because the history workspace model and batch resume query do not exist yet

**Step 3: Add recoverable-history query helpers and the pure history model**

Implement:

- `history.ts` 中新增按域列出可恢复 resume state 的查询能力
- `historyWorkspaceModel.ts` 将 history records、resume states、saved subjects 合并成 3 组正式卡片
- 去重规则优先按 `domainId + subjectId` 合并，避免同一主题同时出现在多个首屏区块
- 结果卡、可继续卡、已保存主题卡使用明确动作文案：`查看结果`、`继续此主题`、`打开主题`

**Step 4: Wire the dedicated history page**

Implement:

- 顶部轻量摘要卡
- `最近完成` 列表
- `可继续内容` 列表
- `已保存主题` 列表
- 点击结果或主题统一进入已有 `subject` 详情路由

**Step 5: Run verification**

Run:

```bash
npx vitest run src/pages/history/__tests__/historyWorkspaceModel.test.ts src/services/__tests__/historyResumeRecoverability.test.ts
npm.cmd run lint
```

Expected:
- PASS

**Step 6: Manual smoke checklist**

Verify manually:

1. 最近完成卡默认主操作是 `查看结果`
2. 有可恢复的 resume state 时，主题进入 `可继续内容`
3. 已保存主题与可继续内容不会为同一主题重复刷屏
4. 从历史页进入主题后，旧结果与恢复执行都能正常工作

**Step 7: Commit**

```bash
git add src/pages/history/historyWorkspaceModel.ts src/pages/history/__tests__/historyWorkspaceModel.test.ts src/pages/history/useHistoryWorkspaceState.ts src/pages/history/HistorySummaryCard.tsx src/pages/history/HistoryResultCard.tsx src/pages/history/HistoryResumeCard.tsx src/pages/history/HistorySavedTopicCard.tsx src/pages/History.tsx src/services/history.ts src/services/__tests__/historyResumeRecoverability.test.ts
git commit -m "feat: extract dedicated history workspace"
```

### Task 6: Build the memory workspace on top of manager memories

**Files:**
- Create: `src/services/memoryWorkspace.ts`
- Create: `src/services/memoryMetadata.ts`
- Test: `src/services/__tests__/memoryWorkspace.test.ts`
- Test: `src/services/__tests__/memoryMetadata.test.ts`
- Create: `src/pages/memory/memoryWorkspaceModel.ts`
- Test: `src/pages/memory/__tests__/memoryWorkspaceModel.test.ts`
- Create: `src/pages/memory/MemorySection.tsx`
- Create: `src/pages/memory/MemoryCard.tsx`
- Create: `src/pages/memory/DailySummaryCard.tsx`
- Create: `src/pages/MemoryDetail.tsx`
- Modify: `src/pages/Memory.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing memory workspace tests**

Cover:

- `manager memories` 是正文真相，UI metadata 只承接状态、来源链路、去重和每日摘要
- 首屏顺序固定为 `摘要区 / 待确认 / 已启用 / 每日摘要 / 已停用`
- 每日摘要 CTA 根据提炼状态切换为 `生成记忆 / 查看已生成记忆 / 查看提炼结果`
- 去重顺序固定为 `结构化键 -> 来源链路 -> 相近内容合并提示`

Example:

```ts
expect(model.sections.map((section) => section.id)).toEqual([
  'summary',
  'pending',
  'enabled',
  'daily_summary',
  'disabled',
]);
expect(model.dailySummaryCards[0].ctaLabel).toBe('查看提炼结果');
expect(model.pendingCards[0].actions).toContain('查看理由');
```

**Step 2: Run the focused tests**

Run:

```bash
npx vitest run src/services/__tests__/memoryWorkspace.test.ts src/services/__tests__/memoryMetadata.test.ts src/pages/memory/__tests__/memoryWorkspaceModel.test.ts
```

Expected:
- FAIL because the workspace loader, metadata store, and page model do not exist yet

**Step 3: Implement memory loading and UI metadata services**

Implement:

- `memoryWorkspace.ts` 通过 `createManagerSessionStore()` 加载 `global / domain / session` 三层 manager memory
- `memoryMetadata.ts` 独立保存 UI 状态、判断依据、来源链路、每日摘要提炼结果和相似记忆提示
- 已启用记忆正文始终从 manager memory 读取；不要创建第二份记忆正文真相
- `暂不使用` 只修改 metadata 状态，不删除 manager memory 正文

**Step 4: Build the memory page and detail route**

Implement:

- `Memory.tsx` 正式首屏分区
- `MemoryDetail.tsx` 详情顺序：`判断依据与来源 / 影响说明 / 记忆正文预览 / 操作区`
- `编辑后启用` 通过 manager memory upsert 回写正文，而不是只改前端展示
- 相似记忆冲突时给出 `查看现有记忆 / 合并后启用 / 仍作为新记忆保存`

**Step 5: Run verification**

Run:

```bash
npx vitest run src/services/__tests__/memoryWorkspace.test.ts src/services/__tests__/memoryMetadata.test.ts src/pages/memory/__tests__/memoryWorkspaceModel.test.ts src/services/__tests__/managerSessionStore.test.ts
npm.cmd run lint
```

Expected:
- PASS

**Step 6: Manual smoke checklist**

Verify manually:

1. 待确认记忆可以进入独立详情页查看理由
2. `暂不使用` 会把记忆移入 `已停用`，不会丢失正文
3. 每日摘要在部分提炼后显示 `查看提炼结果`
4. `编辑后启用` 会影响后续页面读取到的记忆正文

**Step 7: Commit**

```bash
git add src/services/memoryWorkspace.ts src/services/memoryMetadata.ts src/services/__tests__/memoryWorkspace.test.ts src/services/__tests__/memoryMetadata.test.ts src/pages/memory/memoryWorkspaceModel.ts src/pages/memory/__tests__/memoryWorkspaceModel.test.ts src/pages/memory/MemorySection.tsx src/pages/memory/MemoryCard.tsx src/pages/memory/DailySummaryCard.tsx src/pages/Memory.tsx src/pages/MemoryDetail.tsx src/App.tsx
git commit -m "feat: build memory workspace on manager memories"
```

### Task 7: Redesign the settings home and settings data model

**Files:**
- Modify: `src/services/settings.ts`
- Test: `src/services/__tests__/settings.test.ts`
- Create: `src/pages/settings/useSettingsState.ts`
- Create: `src/pages/settings/settingsHomeModel.ts`
- Test: `src/pages/settings/__tests__/settingsHomeModel.test.ts`
- Create: `src/pages/settings/SettingsOverviewCard.tsx`
- Create: `src/pages/settings/SettingsSection.tsx`
- Create: `src/pages/settings/SettingsItemRow.tsx`
- Modify: `src/pages/Settings.tsx`

**Step 1: Write the failing settings migration and home-model tests**

Cover:

- 旧设置结构能迁移到新的正式设置模型
- 设置首页顺序固定为 `顶部轻量总览 / 通用 / 执行与提醒 / 记忆与推荐 / 连接与数据 / 高级与诊断入口`
- 设置项改动即时生效，不再依赖统一保存
- 顶部按钮语义改为 `完成`，不再承担 `保存全部` 语义

Example:

```ts
expect(model.sections.map((section) => section.id)).toEqual([
  'general',
  'execution',
  'memory',
  'connections',
  'diagnostics_entry',
]);
expect(model.primaryAction.label).toBe('完成');
expect(normalizeSettings(legacySettings).enableDailyMemorySummary).toBe(true);
```

**Step 2: Run the focused tests**

Run:

```bash
npx vitest run src/services/__tests__/settings.test.ts src/pages/settings/__tests__/settingsHomeModel.test.ts
```

Expected:
- FAIL because the new settings shape and home model do not exist yet

**Step 3: Extend the settings service for the formal product model**

Implement:

- 在 `settings.ts` 中增加正式版需要的记忆与推荐策略字段
- 保留已有 provider/model/server 等连接配置字段
- 去掉页面层的 `basic / advanced` 模式心智，但保留必要的隐藏兼容字段
- 处理 `v2 -> v3` 规范化，确保历史本地数据不会因字段缺省而崩溃

**Step 4: Rebuild `Settings.tsx` into the formal settings home**

Implement:

- 顶部轻量总览卡，状态标签可跳转到 `连接与数据` 或 `记忆`
- `通用`、`执行与提醒`、`记忆与推荐`、`连接与数据` 四个正式分区
- `高级与诊断` 只保留为底部独立入口
- 页面内设置即时持久化；顶部 `完成` 只负责退出当前设置流程

**Step 5: Run verification**

Run:

```bash
npx vitest run src/services/__tests__/settings.test.ts src/pages/settings/__tests__/settingsHomeModel.test.ts
npm.cmd run lint
```

Expected:
- PASS

**Step 6: Manual smoke checklist**

Verify manually:

1. 设置首页不再出现 `基础模式 / 高级模式`
2. 修改语言、主题或记忆策略后立即生效
3. 顶部状态标签可以跳到 `连接与数据` 或 `记忆`
4. 点击 `完成` 不需要额外保存也不会丢改动

**Step 7: Commit**

```bash
git add src/services/settings.ts src/services/__tests__/settings.test.ts src/pages/settings/useSettingsState.ts src/pages/settings/settingsHomeModel.ts src/pages/settings/__tests__/settingsHomeModel.test.ts src/pages/settings/SettingsOverviewCard.tsx src/pages/settings/SettingsSection.tsx src/pages/settings/SettingsItemRow.tsx src/pages/Settings.tsx
git commit -m "feat: redesign settings home and settings data model"
```

### Task 8: Build `连接与数据` and `高级与诊断` pages

**Files:**
- Create: `src/pages/settings/connectionDataModel.ts`
- Test: `src/pages/settings/__tests__/connectionDataModel.test.ts`
- Create: `src/pages/settings/diagnosticsModel.ts`
- Test: `src/pages/settings/__tests__/diagnosticsModel.test.ts`
- Create: `src/pages/settings/ConnectionStatusCard.tsx`
- Create: `src/pages/settings/DiagnosticsSection.tsx`
- Modify: `src/pages/settings/ConnectionDataSettings.tsx`
- Modify: `src/pages/settings/AdvancedDiagnostics.tsx`
- Modify: `src/pages/ExtensionsHub.tsx`

**Step 1: Write the failing child-page model tests**

Cover:

- `连接与数据` 首屏顺序固定为 `顶部统一状态卡 / AI 服务 / 数据源`
- AI 与数据源表单默认展开，当前版本直接暴露 provider/model/baseUrl/apiKey/serverUrl
- `高级与诊断` 只输出正式产品可理解的诊断分区
- `本地测试服务预设`、`HTTP 白名单`、`开发选项` 不进入正式版子页模型

Example:

```ts
expect(connectionModel.sections.map((section) => section.id)).toEqual([
  'status',
  'ai_service',
  'data_source',
]);
expect(diagnosticsModel.sections.map((section) => section.id)).toContain('maintenance');
expect(diagnosticsModel.sections.map((section) => section.id)).not.toContain('dev_options');
```

**Step 2: Run the focused tests**

Run:

```bash
npx vitest run src/pages/settings/__tests__/connectionDataModel.test.ts src/pages/settings/__tests__/diagnosticsModel.test.ts
```

Expected:
- FAIL because the formal subpage models do not exist yet

**Step 3: Implement `连接与数据`**

Implement:

- 顶部统一状态卡
- AI 服务配置区，默认展开，支持连接检测
- 数据源配置区，默认展开，支持数据连接检测
- 当前版本允许直接修改 provider/model/base URL/API Key/server URL，不提前为账号权限体系加抽象

**Step 4: Implement `高级与诊断`**

Implement:

- 分区收口为 `连接检查 / 同步状态 / 扩展与同步入口 / 通知检查 / 自动执行检查 / 维护与清理`
- `扩展管理` 入口仍然跳转 `/extensions`
- 危险操作集中放在底部 `维护与清理`
- 删除正式 UI 上对本地测试预设、allowlist 和开发模式切换的暴露

**Step 5: Run verification**

Run:

```bash
npx vitest run src/pages/settings/__tests__/connectionDataModel.test.ts src/pages/settings/__tests__/diagnosticsModel.test.ts
npm.cmd run lint
```

Expected:
- PASS

**Step 6: Manual smoke checklist**

Verify manually:

1. 从设置首页进入 `连接与数据` 时，AI 与数据源表单默认展开
2. `连接与数据` 页面可以直接检测 AI 和数据源连接
3. `高级与诊断` 页面还能进入 `/extensions`
4. 正式页面中不再显示本地测试服务预设、白名单和开发模式切换

**Step 7: Commit**

```bash
git add src/pages/settings/connectionDataModel.ts src/pages/settings/__tests__/connectionDataModel.test.ts src/pages/settings/diagnosticsModel.ts src/pages/settings/__tests__/diagnosticsModel.test.ts src/pages/settings/ConnectionStatusCard.tsx src/pages/settings/DiagnosticsSection.tsx src/pages/settings/ConnectionDataSettings.tsx src/pages/settings/AdvancedDiagnostics.tsx src/pages/ExtensionsHub.tsx
git commit -m "feat: build settings connection and diagnostics subpages"
```

### Task 9: Finish i18n cleanup, remove dead product-dev surfaces, and run the regression gate

**Files:**
- Modify: `src/i18n/config.ts`
- Modify: `src/i18n/locales/zh/core/app.json`
- Modify: `src/i18n/locales/en/core/app.json`
- Modify: `src/i18n/locales/zh/core/settings.json`
- Modify: `src/i18n/locales/en/core/settings.json`
- Modify: `src/i18n/locales/zh/pages/home/main.json`
- Modify: `src/i18n/locales/en/pages/home/main.json`
- Modify: `src/i18n/locales/zh/features/extensions.json`
- Modify: `src/i18n/locales/en/features/extensions.json`
- Modify: `src/pages/CommandCenter.tsx`
- Modify: `src/pages/Automation.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/ExtensionsHub.tsx`
- Delete: `src/pages/Home.tsx`
- Delete: `src/pages/command/CommandCenterDebugPanel.tsx`
- Delete: `src/pages/automation/AutomationDiagnosticsCard.tsx`

**Step 1: Audit remaining formal-surface copy and dead code**

Look for:

- `第一阶段`
- `已接入`
- `统一入口`
- `local test server`
- `basic / advanced mode`
- `debug panel`
- 其他研发态或迁移态提示

Also confirm `Home.tsx`、`CommandCenterDebugPanel.tsx`、`AutomationDiagnosticsCard.tsx` 在前置任务完成后已无正式路由依赖。

**Step 2: Finish the i18n and copy cleanup**

Implement:

- 将正式页面剩余硬编码文案收口到现有 i18n 资源
- 替换正式 UI 中的研发态说明与内部术语
- 删除已无引用的旧首页、调试面板和旧诊断卡
- 保持 `ExtensionsHub` 文案与新的设置/诊断层级一致

**Step 3: Run the full regression suite**

Run:

```bash
npx vitest run
npm.cmd run lint
npm.cmd run build
```

Expected:
- PASS

**Step 4: Manual release checklist**

Verify manually:

1. 一级导航只剩 `对话中心 / 任务中心 / 分析与数据 / 历史 / 记忆 / 设置`
2. 所有正式页面不再暴露研发态备注、调试面板或开发选项
3. `连接与数据`、`高级与诊断`、`扩展管理` 路由回退关系正确
4. 对话中心、任务中心、分析与数据、历史、记忆、设置六个一级页都能正常打开并返回

**Step 5: Commit**

```bash
git add src/i18n/config.ts src/i18n/locales/zh/core/app.json src/i18n/locales/en/core/app.json src/i18n/locales/zh/core/settings.json src/i18n/locales/en/core/settings.json src/i18n/locales/zh/pages/home/main.json src/i18n/locales/en/pages/home/main.json src/i18n/locales/zh/features/extensions.json src/i18n/locales/en/features/extensions.json src/pages/CommandCenter.tsx src/pages/Automation.tsx src/pages/Settings.tsx src/pages/ExtensionsHub.tsx
git add -u src/pages/Home.tsx src/pages/command/CommandCenterDebugPanel.tsx src/pages/automation/AutomationDiagnosticsCard.tsx
git commit -m "chore: finalize conversation-first workspace cleanup and regression gate"
```

## Suggested Execution Order

建议按以下顺序执行，不要穿插跳步：

1. Task 1-3：先把路由、首页和任务中心收口，建立新的一级工作区骨架。
2. Task 4-5：再做 `分析与数据` 和 `历史`，把内容浏览型页面从旧结构中彻底分离。
3. Task 6：在新页面层级稳定后再上 `记忆`，避免同时改动路由、状态与设置策略。
4. Task 7-8：最后重做设置首页和二级页，因为它们依赖前面页面的正式入口和真实状态摘要。
5. Task 9：所有页面落稳后再做文案清理、死代码删除和总回归，避免中途反复删改。

## Acceptance Criteria

- 应用默认进入 `/` 对话中心，移动端壳层为顶部状态条加左上角抽屉侧栏，不使用底部 tab。
- 一级导航顺序固定为 `对话中心 / 任务中心 / 分析与数据 / 历史 / 记忆 / 设置`。
- 对话中心首屏符合 `继续优先 / 新输入优先` 规则，继续区优先级正确，建议回复只做辅助输入。
- 任务中心首屏顺序、四类卡片结构和主次动作文案与冻结设计一致。
- `分析与数据`、`历史`、`记忆` 都成为正式一级页，不再混在旧首页或设置页里。
- 记忆正文以 manager memory 为唯一内容真相，UI metadata 只承担状态、来源链路、每日摘要和去重信息。
- 设置首页采用正式产品语义，即时生效，顶部按钮为 `完成`，`连接与数据` 与 `高级与诊断` 是独立二级页。
- 正式页面不再显示研发态文案、调试面板、本地测试预设或基础/高级模式切换。
- `npx vitest run`、`npm.cmd run lint`、`npm.cmd run build` 最终全部通过。

## Open Risks

- 记忆工作区同时涉及 manager memory 正文与 UI metadata，新旧数据迁移需要明确默认状态，否则容易出现“有正文但无 UI 状态”的边界数据。
- 历史页要支持“可继续内容”，因此 `history.ts` 需要补充批量 resume 查询；若 DB 与 localStorage 两条路径行为不一致，会引入恢复结果不一致问题。
- 设置数据模型升级会影响 `ai`、`automation`、`analysisConfig` 等多个服务，必须验证旧本地设置升级后不会丢失连接配置。
- `高级与诊断` 同时依赖 Capacitor 权限、通知和自动执行状态，Web / Native 平台回退文案需要单独检查。
- 最终 i18n 清理很可能暴露更多硬编码字符串，特别是在 domain presenter、扩展页和错误消息路径上。

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-13-client-conversation-first-workspace-implementation-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
