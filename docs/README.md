# MatchFlow Documentation Hub / 鏂囨。涓績

This folder is the single source of truth for project documentation.  
鏈洰褰曟槸椤圭洰鏂囨。鐨勫敮涓€鍏ュ彛銆?
## Start Here / 浠庤繖閲屽紑濮?
EN:

1. If you know your role, start with [00-role-navigation.md](./00-role-navigation.md).
2. If you know your task, start with [15-task-navigation.md](./15-task-navigation.md).
3. If you are new, read in order:
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [03-development.md](./03-development.md).

ZH:

1. 鎸夎鑹叉煡闃咃紝璇峰厛鐪?[00-role-navigation.md](./00-role-navigation.md)銆?2. 鎸変换鍔℃煡闃咃紝璇峰厛鐪?[15-task-navigation.md](./15-task-navigation.md)銆?3. 鏂版垚鍛樺缓璁『搴忛槄璇伙細
   [01-product-overview.md](./01-product-overview.md) ->
   [02-architecture.md](./02-architecture.md) ->
   [03-development.md](./03-development.md)銆?
## Document Index / 鏂囨。绱㈠紩

1. [00-role-navigation.md](./00-role-navigation.md)  
   Role-based reading paths / 鎸夎鑰呰鑹插鑸?2. [01-product-overview.md](./01-product-overview.md)  
   Product scope, features, current goals / 浜у搧鑼冨洿涓庡綋鍓嶇洰鏍?3. [02-architecture.md](./02-architecture.md)  
   App/server architecture and runtime flow / 鍓嶅悗绔灦鏋勪笌杩愯娴?4. [03-development.md](./03-development.md)  
   Local development and release workflow / 鏈湴寮€鍙戜笌鍙戝竷娴佺▼
5. [04-ai-agent-framework.md](./04-ai-agent-framework.md)  
   Agent/skill pipeline and model routing / Agent-Skill 娴佺▼涓庢ā鍨嬭矾鐢?6. [05-i18n-and-encoding.md](./05-i18n-and-encoding.md)  
   i18n and UTF-8 quality rules / i18n 涓?UTF-8 璐ㄩ噺瑙勮寖
7. [06-agent-skill-extension-guide.md](./06-agent-skill-extension-guide.md)  
   Agent/Skill/Template extension guide / Agent銆丼kill銆乀emplate 鎵╁睍鎸囧崡
8. [07-data-source-extension-guide.md](./07-data-source-extension-guide.md)  
   Declarative data source extension guide / 澹版槑寮忔暟鎹簮鎵╁睍鎸囧崡
9. [08-server-api-guide.md](./08-server-api-guide.md)  
   Match data server API reference / 鏁版嵁鏈嶅姟绔?API 鍙傝€?10. [09-server-deploy-and-database-guide.md](./09-server-deploy-and-database-guide.md)  
    Deployment, PostgreSQL schema, admin workflows / 閮ㄧ讲銆佹暟鎹簱涓庤繍缁存祦绋?11. [10-server-refactor-roadmap.md](./10-server-refactor-roadmap.md)  
    Server evolution roadmap / 鏈嶅姟绔噸鏋勪笌婕旇繘璺嚎
12. [11-linux-validation-handoff.md](./11-linux-validation-handoff.md)  
    Linux environment validation checklist / Linux 鐜鑱旇皟鏍￠獙娓呭崟
13. [12-changelog.md](./12-changelog.md)  
    Human-readable project change log / 椤圭洰鍙樻洿璁板綍
14. [13-cicd-guide.md](./13-cicd-guide.md)  
    CI/CD workflow and release strategy / CI/CD 宸ヤ綔娴佷笌鍙戝竷绛栫暐
15. [14-extension-hub-spec.md](./14-extension-hub-spec.md)  
    Manifest schema and hub compatibility / Manifest 缁撴瀯涓?Hub 鍏煎瑙勮寖
16. [15-task-navigation.md](./15-task-navigation.md)  
    Task-based reading paths / 鎸変换鍔″畾浣嶉槄璇昏矾寰?
17. [16-server-auth-and-admin-roadmap.md](./16-server-auth-and-admin-roadmap.md)  
    Server auth, account system, and admin console roadmap / 服务端账号、权限与管理后台路线图
18. [17-server-auth-implementation-backlog.md](./17-server-auth-implementation-backlog.md)  
    Phase 0/1 execution backlog for auth rollout / 账号鉴权阶段 0/1 实施任务清单
19. [18-server-2.0-kickoff.md](./18-server-2.0-kickoff.md)  
    Server 2.0 kickoff baseline and first-delivery checklist / 服务端 2.0 启动基线与首批交付清单
20. [19-web-admin-studio-upgrade-plan.md](./19-web-admin-studio-upgrade-plan.md)  
    Web admin visual governance upgrade plan / Web 管理端可视化治理升级计划
21. [20-web-admin-phase-a-contract-freeze.md](./20-web-admin-phase-a-contract-freeze.md)  
    Phase A contract freeze deliverables for admin studio / 管理端阶段 A 契约冻结交付物
22. [21-server2-phase-e-rollout-runbook.md](./21-server2-phase-e-rollout-runbook.md)  
    Phase E hardening and tenant rollout execution runbook / Phase E 加固与分租户上线执行手册
## Writing Rules / 鏂囨。瑙勮寖

1. Every document must contain English + Chinese sections in the same file.  
   姣忎唤鏂囨。蹇呴』鍦ㄥ悓涓€鏂囦欢鍐呭寘鍚嫳鏂囧拰涓枃銆?2. All docs must be UTF-8 encoded.  
   鎵€鏈夋枃妗ｅ繀椤讳娇鐢?UTF-8 缂栫爜銆?3. Keep docs operational, not only conceptual: include commands, inputs, and expected outputs.  
   鏂囨。瑕佸彲鎵ц锛屼笉浠呰姒傚康锛岃繕瑕佺粰鍛戒护銆佽緭鍏ュ拰棰勬湡缁撴灉銆?4. When behavior changes, update docs in this folder in the same PR/commit.  
   鍔熻兘琛屼负鍙樺寲鏃讹紝蹇呴』鍦ㄥ悓涓€ PR/鎻愪氦涓悓姝ユ洿鏂版湰鐩綍鏂囨。銆?
## Scope / 鑼冨洿澹版槑

Only markdown files under `docs/` are considered maintained project documentation.  
浠?`docs/` 鐩綍鍐呯殑 Markdown 鏂囦欢灞炰簬姝ｅ紡缁存姢鏂囨。銆?

