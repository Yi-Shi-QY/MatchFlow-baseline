# 24. CN JCZQ Collection Interface and Script Runbook / 中国足彩竞彩数据采集接口与脚本执行手册

## EN

## 1. Goal

This document defines the external collection interface for Server 2.0 datasource governance, plus a runnable script example that collects real CN JCZQ data and pushes it through:

1. collect
2. import
3. confirm
4. release

Target script:

1. `match-data-server/scripts/collectCnJczqSample.js`

## 2. End-to-End Flow

1. Collector exists in Admin API (`sourceId` scoped).
2. External script fetches upstream source and builds normalized payload.
3. Script calls `POST /admin/data-collections/collectors/:collectorId/import`.
4. Admin confirms snapshot: `POST /admin/data-collections/snapshots/:snapshotId/confirm`.
5. Admin releases snapshot: `POST /admin/data-collections/snapshots/:snapshotId/release`.
6. Released snapshot can be consumed by downstream distribution flow.

## 3. API Contract (Collection Governance)

All endpoints below require:

1. `Authorization: Bearer <API_KEY or access_token>`
2. DB connection available

### 3.1 List / Create Collector

1. `GET /admin/data-collections/collectors?sourceId=<sourceId>&limit=20`
2. `POST /admin/data-collections/collectors`

Create request example:

```json
{
  "sourceId": "cn_jczq_500_demo",
  "name": "CN JCZQ 500 Collector",
  "provider": "manual_import",
  "config": {
    "upstream": "https://trade.500.com/jczq/?playid=269&g=2"
  },
  "isEnabled": true
}
```

### 3.2 Import External Payload

1. `POST /admin/data-collections/collectors/:collectorId/import`

Request example:

```json
{
  "triggerType": "manual",
  "sourceId": "cn_jczq_500_demo",
  "contentHash": "78f47c62a3f6f77e9ef3cc4cfebc9d29f6fefcab8fbc5c7c7d1d7e224d748630",
  "allowDuplicate": false,
  "force": false,
  "recordCount": 9,
  "payload": {
    "source": "https://trade.500.com/jczq/?playid=269&g=2",
    "sourceId": "cn_jczq_500_demo",
    "collectedAt": "2026-03-02T11:25:12.025Z",
    "timezone": "Asia/Shanghai",
    "rows": []
  }
}
```

Response shape:

```json
{
  "data": {
    "collector": {
      "id": "45396c2c-1cc9-4110-9867-1333ab7184f2"
    },
    "run": {
      "id": "8237935c-9c1f-4be5-972e-e33b724ccc9e",
      "status": "succeeded"
    },
    "snapshot": {
      "id": "fa533203-075a-4171-8693-50bbaf24fce6",
      "confirmationStatus": "pending",
      "releaseStatus": "draft"
    },
    "deduplicated": false
  }
}
```

Deduplication (default):

1. If same `sourceId + payload content hash` already exists (and not rejected), server returns existing snapshot.
2. Response has `data.deduplicated=true`.
3. A succeeded run is still created for traceability.
4. `collectCnJczqSample.js` computes stable `contentHash` from source + rows + summary, so retries are idempotent even when `collectedAt` changes.

### 3.3 Confirm Snapshot

1. `POST /admin/data-collections/snapshots/:snapshotId/confirm`

Request:

```json
{
  "action": "confirm",
  "notes": "auto-confirmed by collectCnJczqSample.js"
}
```

### 3.4 Release Snapshot

1. `POST /admin/data-collections/snapshots/:snapshotId/release`

Request:

```json
{
  "channel": "internal"
}
```

Release requires snapshot status:

1. `confirmationStatus = confirmed`

### 3.5 Common Error Codes

1. `CATALOG_DB_REQUIRED`
2. `COLLECTION_COLLECTOR_NOT_FOUND`
3. `COLLECTION_SOURCE_ID_MISMATCH`
4. `COLLECTION_IMPORT_PAYLOAD_INVALID`
5. `COLLECTION_RELEASE_BLOCKED_BY_CONFIRMATION`
6. `COLLECTION_RELEASE_CHANNEL_INVALID`

## 4. Script Example

### 4.1 Fetch Only

```bash
cd match-data-server
node scripts/collectCnJczqSample.js --source-id cn_jczq_500_demo
```

Expected:

1. fetches upstream page HTML
2. parses rows and odds
3. writes local file under `match-data-server/dist/collections/*.json`

Recommended production flags:

```bash
node scripts/collectCnJczqSample.js \
  --source-id cn_jczq_500_demo \
  --timeout-ms 20000 \
  --retries 3 \
  --retry-delay-ms 1500 \
  --min-rows 5
```

### 4.2 Upload + Confirm + Release

```bash
cd match-data-server
node scripts/collectCnJczqSample.js \
  --source-id cn_jczq_500_demo \
  --upload \
  --auto-confirm \
  --auto-release \
  --channel internal \
  --timeout-ms 20000 \
  --retries 3 \
  --retry-delay-ms 1500 \
  --min-rows 5 \
  --server-url http://127.0.0.1:3001 \
  --api-key <API_KEY>
```

## 5. Real Execution Record (2026-03-02)

Local execution completed on 2026-03-02 with real upstream page data:

1. upstream: `https://trade.500.com/jczq/?playid=269&g=2`
2. parsed rows: `9`
3. sample row: `周一001 大田市民 vs 安养FC`
4. collector id: `45396c2c-1cc9-4110-9867-1333ab7184f2`
5. run id: `8237935c-9c1f-4be5-972e-e33b724ccc9e`
6. snapshot id: `fa533203-075a-4171-8693-50bbaf24fce6`
7. final snapshot status: `confirmationStatus=confirmed`, `releaseStatus=released`, `releaseChannel=internal`, `recordCount=9`
8. repeated upload with same `contentHash` reused snapshot id and returned `deduplicated=true`

Output file example:

1. `match-data-server/dist/collections/cn-jczq-500-2026-03-02T11-25-12-026Z.json`

## 6. Operations and Compliance Notes

1. Upstream websites can change HTML structure at any time; parser maintenance is expected.
2. Respect upstream terms of use, robots policy, and local regulations before production scraping.
3. Keep collection tasks throttled and monitored (retry/backoff, idempotency, alerting).
4. Recommended production path: scheduled collector + review workflow in Admin Studio.

## ZH

## 1. 目标

本文档定义服务端 2.0 的数据采集对接接口，并给出真实中国足彩竞彩数据采集脚本示例，覆盖完整流程：

1. 采集
2. 导入
3. 确认
4. 发布

脚本文件：

1. `match-data-server/scripts/collectCnJczqSample.js`

## 2. 端到端流程

1. 在管理端创建或获取采集器（按 `sourceId` 管理）。
2. 外部脚本抓取上游页面并生成标准化 `payload`。
3. 调用导入接口创建一次采集 run 和待确认快照。
4. 调用确认接口将快照标记为 `confirmed`。
5. 调用发布接口按 `internal|beta|stable` 发布。
6. 后续分发系统消费已发布快照。

## 3. 接口说明（采集治理）

统一要求：

1. 请求头 `Authorization: Bearer <API_KEY 或 access_token>`
2. 服务端必须连接数据库

### 3.1 采集器查询与创建

1. `GET /admin/data-collections/collectors`
2. `POST /admin/data-collections/collectors`

关键字段：

1. `sourceId`：数据源标识（脚本与采集器必须一致）
2. `provider`：`match_snapshot|manual_import`
3. `config`：采集配置（例如 upstream 地址）

### 3.2 导入外部采集结果

1. `POST /admin/data-collections/collectors/:collectorId/import`

关键字段：

1. `payload`：采集后的 JSON 对象
2. `recordCount`：记录条数（可选，不传默认按 `payload.rows.length`）
3. `triggerType`：`manual|scheduled|retry`

返回：

1. `run.id`
2. `snapshot.id`
3. `snapshot.confirmationStatus=pending`
4. `snapshot.releaseStatus=draft`

### 3.3 快照确认

1. `POST /admin/data-collections/snapshots/:snapshotId/confirm`

请求字段：

1. `action`：`confirm|reject`
2. `notes`：备注（可选）

### 3.4 快照发布

1. `POST /admin/data-collections/snapshots/:snapshotId/release`

请求字段：

1. `channel`：`internal|beta|stable`

发布前置条件：

1. 快照必须已经 `confirmed`

### 3.5 常见错误码

1. `CATALOG_DB_REQUIRED`：数据库不可用
2. `COLLECTION_COLLECTOR_NOT_FOUND`：采集器不存在
3. `COLLECTION_SOURCE_ID_MISMATCH`：导入请求 `sourceId` 与采集器不一致
4. `COLLECTION_IMPORT_PAYLOAD_INVALID`：payload 非法
5. `COLLECTION_RELEASE_BLOCKED_BY_CONFIRMATION`：未确认不能发布
6. `COLLECTION_RELEASE_CHANNEL_INVALID`：channel 非法

## 4. 脚本执行示例

### 4.1 仅采集落盘

```bash
cd match-data-server
node scripts/collectCnJczqSample.js --source-id cn_jczq_500_demo
```

结果：

1. 抓取真实上游页面
2. 解析比赛行和赔率
3. 输出 JSON 到 `dist/collections/`

### 4.2 采集并导入+确认+发布

```bash
cd match-data-server
node scripts/collectCnJczqSample.js \
  --source-id cn_jczq_500_demo \
  --upload \
  --auto-confirm \
  --auto-release \
  --channel internal \
  --server-url http://127.0.0.1:3001 \
  --api-key <API_KEY>
```

## 5. 本地真实执行记录（2026-03-02）

已在本地完成一次真实执行（含导入、确认、发布）：

1. 上游地址：`https://trade.500.com/jczq/?playid=269&g=2`
2. 解析场次：`9`
3. 样例比赛：`周一001 大田市民 vs 安养FC`
4. collector id：`45396c2c-1cc9-4110-9867-1333ab7184f2`
5. run id：`8237935c-9c1f-4be5-972e-e33b724ccc9e`
6. snapshot id：`fa533203-075a-4171-8693-50bbaf24fce6`
7. 最终状态：`confirmed + released(internal)`，`recordCount=9`

输出文件示例：

1. `match-data-server/dist/collections/cn-jczq-500-2026-03-02T11-25-12-026Z.json`

## 6. 生产建议与合规提示

1. 上游 HTML 结构随时可能变化，解析规则需可维护。
2. 生产抓取前必须确认上游站点使用条款和相关法规。
3. 建议接入限流、重试退避、幂等和告警。
4. 推荐生产流程：定时采集 -> 管理端确认 -> 分渠道发布。
