# Declarative Data Source Extension Guide / 声明式数据源扩展指南

## EN

## 1. Goal

Make source selection and payload assembly declarative so UI can adapt automatically.

## 2. Canonical Registry

Data sources are defined in:

1. `src/services/dataSources.ts`

Each source entry declares:

1. Metadata (`id`, i18n labels, icon, card span).
2. Availability and default behavior.
3. Payload mutation methods:
   - `applyToData`
   - `removeFromData`
4. Form sections/fields for UI generation.

## 3. Current Built-in Source IDs

1. `fundamental`
2. `market`
3. `custom`

## 4. App Runtime Behavior

1. `MatchDetail` renders source cards from registry.
2. Selected sources mutate `editableData`.
3. App injects `sourceContext`:
   - selected flags
   - selected IDs
   - capabilities
   - match status
4. Planning uses these signals to pick route/template.

## 5. How to Add a New Source

1. Add source definition in registry.
2. Provide availability/default rules.
3. Implement `applyToData/removeFromData`.
4. Add form schema for edit UI.
5. Add i18n keys for EN/ZH labels and hints.
6. Extend capability derivation only if planner needs extra signal.
7. Validate in UI:
   - source card appears
   - source form renders
   - payload and `sourceContext` are correct

## 6. SourceContext Contract (Recommended)

```json
{
  "sourceContext": {
    "origin": "server-db | server-mock | local | imported",
    "selectedSources": {
      "fundamental": true,
      "market": false,
      "custom": true
    },
    "selectedSourceIds": ["fundamental", "custom"],
    "capabilities": {
      "hasFundamental": true,
      "hasStats": true,
      "hasOdds": false,
      "hasCustom": true
    },
    "matchStatus": "upcoming | live | finished | unknown"
  }
}
```

## 7. Validation Checklist

1. Source toggles update payload deterministically.
2. Removing a source cleans corresponding fields.
3. Planner route changes as expected with capability changes.
4. No hardcoded source UI blocks remain in page component.

## ZH

## 1. 目标

通过声明式数据源定义，让分析前界面和数据组装逻辑可以自动适配，不再写死。

## 2. 标准注册表

数据源统一定义在：

1. `src/services/dataSources.ts`

每个数据源条目应声明：

1. 元信息（`id`、多语言文案 key、icon、卡片布局）。
2. 可用性与默认选择规则。
3. payload 变更函数：
   - `applyToData`
   - `removeFromData`
4. UI 表单区块与字段定义。

## 3. 当前内置数据源

1. `fundamental`
2. `market`
3. `custom`

## 4. 应用运行行为

1. `MatchDetail` 根据注册表渲染数据源卡片。
2. 用户选择会驱动 `editableData` 自动变更。
3. 系统注入 `sourceContext`：
   - 选择状态
   - 选择 ID 列表
   - 能力标记
   - 比赛状态
4. 规划器基于上述信号选择模板或自主模式。

## 5. 新增数据源步骤

1. 在注册表新增数据源定义。
2. 实现可用性和默认规则。
3. 实现 `applyToData/removeFromData`。
4. 定义对应的编辑表单结构。
5. 增加中英文 i18n key。
6. 若规划需要新增信号，再扩展 capability 计算函数。
7. 在 UI 联调验证：
   - 卡片是否出现
   - 表单是否正确渲染
   - payload 与 `sourceContext` 是否符合预期

## 6. 推荐 SourceContext 契约

```json
{
  "sourceContext": {
    "origin": "server-db | server-mock | local | imported",
    "selectedSources": {
      "fundamental": true,
      "market": false,
      "custom": true
    },
    "selectedSourceIds": ["fundamental", "custom"],
    "capabilities": {
      "hasFundamental": true,
      "hasStats": true,
      "hasOdds": false,
      "hasCustom": true
    },
    "matchStatus": "upcoming | live | finished | unknown"
  }
}
```

## 7. 校验清单

1. 开关数据源时 payload 变化应确定可预期。
2. 取消数据源应清理对应字段。
3. capability 变化应触发预期规划路由变化。
4. 页面中不应再有写死的数据源 UI 逻辑块。

