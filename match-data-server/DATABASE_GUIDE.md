# 生产级数据库部署指南 (Production Database Guide)

本文档旨在指导如何将 MatchFlow 的数据存储从内存 Mock 数据迁移到生产级关系型数据库（PostgreSQL）。

## 1. 架构选型

我们推荐使用 **PostgreSQL** 作为主数据库，原因如下：
- **JSONB 支持**: 我们的 `match_stats` 和 `recent_form` 数据结构灵活，PostgreSQL 的 JSONB 类型可以完美存储这些非结构化数据，同时支持索引查询。
- **稳定性**: 业界标准，生态成熟。
- **扩展性**: 支持复杂查询和高并发。

## 2. 数据模型设计

核心包含两张表：`teams` (球队) 和 `matches` (赛事)。

### 2.1 Teams 表 (球队信息)

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | UUID | 主键 |
| `name` | VARCHAR(255) | 球队名称 |
| `logo_url` | VARCHAR(512) | 队徽图片链接 |
| `recent_form` | JSONB | 近期战绩，例如 `["W", "L", "D"]` |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

### 2.2 Matches 表 (赛事信息)

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | UUID | 主键 |
| `league_name` | VARCHAR(255) | 联赛名称 |
| `match_date` | TIMESTAMP | 比赛时间 |
| `status` | VARCHAR(50) | 状态: `upcoming`, `live`, `finished` |
| `home_team_id` | UUID | 外键 -> teams.id |
| `away_team_id` | UUID | 外键 -> teams.id |
| `home_score` | INTEGER | 主队得分 |
| `away_score` | INTEGER | 客队得分 |
| `match_stats` | JSONB | 比赛详细数据 (控球率、射门等) |

## 3. 部署步骤

### 步骤 1: 准备数据库环境

你可以选择：
1.  **云托管数据库 (推荐)**: AWS RDS, Google Cloud SQL, Supabase, Neon, Railway PostgreSQL 等。
2.  **本地/VPS 自建**: 使用 Docker 快速启动。

```bash
# Docker 启动 PostgreSQL 示例
docker run --name matchflow-db -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
```

### 步骤 2: 初始化数据库结构

使用项目中的 `schema.sql` 文件初始化表结构。

```bash
# 使用 psql 命令行工具导入
psql -h localhost -U postgres -d postgres -f schema.sql
```

### 步骤 3: 修改服务端代码 (`match-data-server`)

1.  **安装 PostgreSQL 驱动**:
    ```bash
    cd match-data-server
    npm install pg
    ```

2.  **配置环境变量**:
    在 `.env` 文件中添加数据库连接字符串：
    ```env
    DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5432/postgres
    ```

3.  **更新代码逻辑**:
    修改 `index.js`，使用数据库查询替换 `MOCK_MATCHES`。

    **代码示例 (`db.js`):**
    ```javascript
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    module.exports = {
      query: (text, params) => pool.query(text, params),
    };
    ```

    **代码示例 (`index.js` - 获取列表):**
    ```javascript
    const db = require('./db');

    app.get('/matches', authenticate, async (req, res) => {
      const { date, status } = req.query;
      
      let query = `
        SELECT m.*, 
               row_to_json(ht.*) as homeTeam, 
               row_to_json(at.*) as awayTeam 
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND m.status = $${params.length}`;
      }
      
      // ... 添加更多筛选逻辑

      try {
        const result = await db.query(query, params);
        // 格式化返回数据以匹配前端接口标准
        const formatted = result.rows.map(row => ({
          id: row.id,
          league: row.league_name,
          date: row.match_date,
          status: row.status,
          score: { home: row.home_score, away: row.away_score },
          stats: row.match_stats,
          homeTeam: {
            id: row.homeTeam.id,
            name: row.homeTeam.name,
            logo: row.homeTeam.logo_url,
            form: row.homeTeam.recent_form
          },
          awayTeam: {
            id: row.awayTeam.id,
            name: row.awayTeam.name,
            logo: row.awayTeam.logo_url,
            form: row.awayTeam.recent_form
          }
        }));
        res.json({ data: formatted });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
      }
    });
    ```

## 4. 维护与扩展

- **数据采集**: 建议编写定时任务 (Cron Job) 调用第三方体育数据 API (如 API-Football, SportRadar)，将数据同步写入到你的 PostgreSQL 数据库中。
- **缓存**: 对于高频访问的 `/matches` 接口，建议在 Node.js 层添加 Redis 缓存，减少数据库压力。
- **备份**: 开启云数据库的自动备份功能。
