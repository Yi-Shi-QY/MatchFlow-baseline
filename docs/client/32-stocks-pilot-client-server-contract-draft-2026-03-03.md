# Stocks Pilot Client-Server Contract Draft (2026-03-03)

## 1. Purpose

This document defines a practical integration contract for the `stocks` pilot domain between client and server teams.

Goals:

1. Enable server-backed `stocks` data with minimal break risk.
2. Keep current client runtime compatible with existing `Match`-like payloads.
3. Provide a clear migration path toward a truly domain-agnostic analysis entity.

Scope:

1. Client runtime in `MatchFlow/src`.
2. API payload contracts for `/matches` and `/analysis/config/*`.
3. No server implementation details or framework constraints.

## 2. Current Client Reality (Important)

Today, `fetchMatches()` still reads:

1. `GET /matches`
2. response shape: `{ data: Match[] }`

Where `Match` is still the top-level transport shape in client code.

Therefore, server integration for `stocks` in this phase should follow:

1. Keep compatibility fields required by current client screens.
2. Add domain-specific fields (`assetProfile`, `priceAction`, `valuationHealth`, `riskEvents`).
3. Include `sourceContext.domainId = "stocks"` in analysis payload paths when possible.

## 3. Stocks Domain Runtime Contract in Client

The new client domain module consumes these source groups:

1. `asset_profile`
2. `price_action`
3. `valuation_health`
4. `risk_events`

The `stocks` planning strategy routes using capability/signal keys:

1. `hasAssetProfile`
2. `hasPriceAction`
3. `hasValuationHealth`
4. `hasRiskEvents`

If server provides these consistently through source context, planning becomes deterministic.

## 4. Minimal `/matches` Contract (Phase 1: Compatible)

## 4.1 Envelope

```json
{
  "data": [
    {
      "...": "match-like object"
    }
  ]
}
```

## 4.2 Required baseline fields per item

1. `id: string`
2. `league: string` (for now, can carry market universe label such as `US Equities`)
3. `date: ISO string`
4. `status: "upcoming" | "live" | "finished"`
5. `homeTeam` object (compat anchor)
6. `awayTeam` object (compat anchor)

`homeTeam` and `awayTeam` are still used by current list/detail card rendering.

## 4.3 Recommended stocks extensions per item

1. `assetProfile`
2. `priceAction`
3. `valuationHealth`
4. `riskEvents`
5. `customInfo` (optional narrative)
6. `capabilities` with booleans
7. `source` (recommended `"server"`)

Example:

```json
{
  "id": "stk_aapl_20260303",
  "league": "US Equities",
  "date": "2026-03-03T14:30:00.000Z",
  "status": "live",
  "source": "server",
  "homeTeam": {
    "id": "asset_aapl",
    "name": "AAPL",
    "logo": "https://logo.clearbit.com/apple.com",
    "form": ["+1.2%", "-0.4%", "+0.9%", "+2.1%", "+0.5%"]
  },
  "awayTeam": {
    "id": "benchmark_ndx",
    "name": "NASDAQ 100",
    "logo": "https://upload.wikimedia.org/wikipedia/commons/0/06/Nasdaq_100_logo.svg",
    "form": ["+0.8%", "-0.2%", "+0.4%", "+1.3%", "+0.2%"]
  },
  "capabilities": {
    "hasStats": true,
    "hasOdds": false,
    "hasCustom": true
  },
  "assetProfile": {
    "symbol": "AAPL",
    "assetName": "Apple Inc.",
    "benchmark": "NASDAQ 100",
    "sector": "Technology Hardware",
    "timeframe": "1-3 months",
    "marketPhase": "Post-earnings consolidation"
  },
  "priceAction": {
    "trendScore": 72,
    "momentum14d": 4.6,
    "volatility30d": 18.9,
    "relativeStrength": 64,
    "support": 176.5,
    "resistance": 189.0
  },
  "valuationHealth": {
    "peRatio": 28.2,
    "revenueGrowthPct": 8.1,
    "revisionScore": 62,
    "freeCashFlowMarginPct": 24.0
  },
  "riskEvents": {
    "narrative": "AI cycle upside versus valuation crowding risk.",
    "catalysts": ["AI product event", "Buyback acceleration"],
    "downsideTriggers": ["Demand miss", "Margin compression"]
  }
}
```

## 5. `/analysis/config/*` Contract for Stocks

Client reads:

1. `GET /analysis/config/match/:matchId`
2. `POST /analysis/config/resolve`

Accepted payload path:

1. `data.sourceContext`

## 5.1 Recommended `sourceContext` payload

```json
{
  "data": {
    "matchId": "stk_aapl_20260303",
    "sourceContext": {
      "domainId": "stocks",
      "selectedSources": {
        "asset_profile": true,
        "price_action": true,
        "valuation_health": true,
        "risk_events": true
      },
      "selectedSourceIds": [
        "asset_profile",
        "price_action",
        "valuation_health",
        "risk_events"
      ],
      "capabilities": {
        "hasAssetProfile": true,
        "hasPriceAction": true,
        "hasValuationHealth": true,
        "hasRiskEvents": true
      },
      "planning": {
        "mode": "template",
        "templateType": "stocks_comprehensive",
        "requiredAgents": ["stocks_overview", "stocks_prediction"],
        "requiredSkills": ["calculator"]
      }
    }
  }
}
```

## 5.2 Planning override keys supported by client

The client currently supports these planning override keys:

1. `mode: "template" | "autonomous"`
2. `templateType` or `templateId`
3. `requiredAgents: string[]`
4. `requiredSkills: string[]`
5. `hub` (optional endpoint hint object)

## 6. Stocks Template and Agent IDs (Server Reference)

## 6.1 Template IDs

1. `stocks_basic`
2. `stocks_standard`
3. `stocks_risk_focused`
4. `stocks_comprehensive`

## 6.2 Agent IDs

1. `stocks_overview`
2. `stocks_technical`
3. `stocks_fundamental`
4. `stocks_risk`
5. `stocks_prediction`
6. `stocks_general`

## 7. Phase Plan for Server Alignment

## Phase 1 (Now): Compatible transport

1. Keep `/matches` as `Match[]` envelope.
2. Add stocks domain fields on top.
3. Provide `sourceContext.domainId = "stocks"` via config endpoints.

## Phase 2 (Next): Generic entity contract

1. Introduce domain-agnostic `AnalysisEntity` response.
2. Client adds adapter layer from `AnalysisEntity` to current UI.
3. Gradually remove hard dependence on `homeTeam/awayTeam` naming.

## 8. Integration Validation Checklist

Server-client integration is considered acceptable when:

1. Settings can switch to `stocks`.
2. Home list renders server-provided stocks records without fallback.
3. MatchDetail can run analysis using server record.
4. Planning route resolves to stocks templates (not football/basketball).
5. Summary card renders generic `outcomeDistribution` / `conclusionCards`.
6. History reopen and resume flows do not hit `Match not found`.

## 9. Non-goals and Constraints

1. This draft does not require server-side account/tenant model changes.
2. This draft does not require removing sports domains.
3. This draft does not prescribe database schema.
4. This draft keeps client backward compatibility as the top priority.

