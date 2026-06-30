---
name: create-migration
description: 为 SQLite 数据库创建安全、可追溯的迁移脚本
user_invocable: true
disable_model_invocation: true
---

# 数据库迁移 Skill

为 OpsHub 的 SQLite 数据库创建迁移脚本，确保数据库变更安全、可追溯。

## 用法

```
/create-migration <description>
```

例如：`/create-migration 添加设备状态字段`

## 迁移规范

1. 迁移文件命名：`YYYYMMDDHHmmss-<description>.sql`
2. 存放位置：`server/migrations/`
3. 每次迁移包含：
   - `-- UP` 部分：正向变更
   - `-- DOWN` 部分：回滚脚本
4. 更新 `server/db.ts` 中的建表逻辑以保持同步

## 迁移模板

```sql
-- UP
ALTER TABLE devices ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- DOWN
ALTER TABLE devices DROP COLUMN status;
```

## 安全规则

- 禁止 `DROP TABLE` — 使用 `RENAME` + 重建替代
- 必须先测试 `-- DOWN` 可回滚
- 迁移前自动备份数据库到 `data/backups/`
