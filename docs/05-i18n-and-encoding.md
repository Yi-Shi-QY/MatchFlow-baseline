# i18n and Encoding Guide / 国际化与编码规范

## EN

## 1. Goals

1. Keep user-facing text consistent across English and Chinese.
2. Prevent mojibake and replacement-character corruption.
3. Make i18n updates predictable during feature development.

## 2. Source of Truth

1. Runtime i18n config:
   - `src/i18n/config.ts`
2. Locale dictionaries:
   - `src/i18n/locales/en.json`
   - `src/i18n/locales/zh.json`

## 3. Rules

1. New user-facing strings should use `t("key")` instead of hardcoded literals.
2. Add matching keys in both locale files.
3. Save source/docs as UTF-8.
4. Do not mix duplicated i18n bootstrap entries.

## 4. Agent and Prompt Text

1. Ensure Chinese prompt strings are valid UTF-8.
2. Keep output tag grammar unchanged while translating content.
3. Preserve critical format markers (`<summary>`, JSON blocks, etc.).

## 5. Review Checklist

1. Did we add both EN and ZH keys?
2. Did we run type/lint checks?
3. Did we scan for obvious corruption (`�`, mojibake patterns)?
4. Did we verify one EN and one ZH runtime path in UI?

## 6. Recommended Automation

1. CI step: parse locale JSON files.
2. CI step: detect replacement character `U+FFFD`.
3. CI step: optional dictionary parity checker (`en` keys == `zh` keys).

## ZH

## 1. 目标

1. 保证中英文用户可见文案一致可用。
2. 防止乱码和替换字符污染。
3. 让 i18n 更新流程稳定、可审查。

## 2. 单一真相源

1. 运行时 i18n 配置：
   - `src/i18n/config.ts`
2. 词典文件：
   - `src/i18n/locales/en.json`
   - `src/i18n/locales/zh.json`

## 3. 规则

1. 新增用户文案优先使用 `t("key")`，避免硬编码。
2. `en/zh` 必须同步新增对应 key。
3. 源码和文档统一 UTF-8 编码。
4. 避免出现重复或冲突的 i18n 启动入口。

## 4. Agent 与 Prompt 文本

1. 确保中文提示词是 UTF-8 正常文本。
2. 翻译时不能破坏输出标签语法。
3. 保留关键格式标记（如 `<summary>`、JSON 结构）。

## 5. 评审清单

1. 是否同时补了英文和中文 key？
2. 是否执行了类型检查和 lint？
3. 是否扫描了乱码特征（`�` 等）？
4. 是否实测了中英文各一条运行路径？

## 6. 自动化建议

1. CI 校验 locale JSON 可解析。
2. CI 扫描 `U+FFFD` 替换字符。
3. CI 校验 `en/zh` key 对齐（同构检查）。

