---
name: api-doc
description: 自动从 Express 路由文件生成 OpenAPI 3.0 文档
user_invocable: true
disable_model_invocation: true
---

# API 文档生成 Skill

自动解析 `server/routes/` 下的 Express 路由文件，生成 OpenAPI 3.0 格式的 API 文档。

## 用法

```
/api-doc [--output <path>] [--route <route-name>]
```

- `--output`：输出路径，默认 `docs/api/openapi.json`
- `--route`：只生成指定路由的文档（如 `auth`、`devices`）

## 工作方式

1. 扫描 `server/routes/` 目录下的所有路由文件
2. 解析每个路由文件中的方法（GET/POST/PUT/DELETE）、路径、中间件
3. 读取 `server/db.ts` 中的数据库表结构作为 schema 参考
4. 从 `server/middleware/auth.ts` 提取认证要求
5. 生成 OpenAPI 3.0 JSON 文档

## 示例输出结构

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "OpsHub API",
    "version": "1.0.0"
  },
  "paths": {
    "/api/devices": {
      "get": {
        "summary": "获取设备列表",
        "security": [{ "bearerAuth": [] }]
      }
    }
  }
}
```
