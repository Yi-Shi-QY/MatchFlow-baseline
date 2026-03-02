# Skill Runtime Modes

This document describes how installed Skill manifests are executed on the client.

## Supported Modes

1. `builtin_alias`
- Purpose: map an installed skill id to an existing built-in skill executor.
- Required fields:
  - `targetSkill` (string)

2. `http_json`
- Purpose: call an HTTP endpoint and return parsed JSON (or text).
- Required fields:
  - `request.url` (string)
- Optional fields:
  - `request.method`: `GET | POST | PUT | PATCH | DELETE` (default `GET`)
  - `request.headers`: string map
  - `request.query`: map of `string | number | boolean`
  - `request.body`: any JSON payload
  - `request.auth`: `none | match_data_api_key`
  - `request.timeoutMs`: positive number
  - `response.pickPath`: dot path to extract a field from response payload
  - `response.defaultValue`: fallback when `pickPath` is not found

Security constraints:
- URL protocol must be `https` (or `http` for localhost only).
- URL host must match one of:
  - default hosts derived from `settings.matchDataServerUrl`
  - explicit allowlist in `settings.skillHttpAllowedHosts`
- embedded URL credentials are rejected.

3. `static_result`
- Purpose: return deterministic static payload (useful for testing/tool-call verification).
- Required fields:
  - `value` (any JSON value)

## Template Interpolation

`http_json` request fields and `static_result.value` support token interpolation:

- `{{args.foo}}`
- `{{foo}}` (fallback to `args.foo`)
- `{{settings.matchDataServerUrl}}`
- `{{matchDataServerUrl}}`

If a string is exactly one token, the token value is returned as-is (keeps number/object type).
If tokens are embedded in a longer string, token values are stringified.

## Example: builtin_alias

```json
{
  "kind": "skill",
  "id": "plan_selector_alias",
  "version": "1.0.0",
  "name": "Plan Selector Alias",
  "description": "Alias to built-in select_plan_template",
  "declaration": {
    "name": "plan_selector_alias",
    "description": "Select plan template",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  },
  "runtime": {
    "mode": "builtin_alias",
    "targetSkill": "select_plan_template"
  }
}
```

## Example: http_json

```json
{
  "kind": "skill",
  "id": "fetch_market_snapshot",
  "version": "1.0.0",
  "name": "Fetch Market Snapshot",
  "description": "Fetch external market data",
  "declaration": {
    "name": "fetch_market_snapshot",
    "description": "Get latest market snapshot for a symbol",
    "parameters": {
      "type": "object",
      "properties": {
        "symbol": { "type": "string" }
      },
      "required": ["symbol"]
    }
  },
  "runtime": {
    "mode": "http_json",
    "request": {
      "method": "GET",
      "url": "/market/snapshot",
      "query": {
        "symbol": "{{args.symbol}}"
      },
      "auth": "match_data_api_key",
      "timeoutMs": 5000
    },
    "response": {
      "pickPath": "data.snapshot"
    }
  }
}
```

## Example: static_result

```json
{
  "kind": "skill",
  "id": "tool_probe",
  "version": "1.0.0",
  "name": "Tool Probe",
  "description": "Return a deterministic payload for tool-call verification",
  "declaration": {
    "name": "tool_probe",
    "description": "Probe tool execution",
    "parameters": {
      "type": "object",
      "properties": {
        "input": { "type": "string" }
      }
    }
  },
  "runtime": {
    "mode": "static_result",
    "value": {
      "ok": true,
      "echo": "{{args.input}}"
    }
  }
}
```
