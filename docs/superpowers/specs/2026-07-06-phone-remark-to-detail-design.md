# 话机备注从后台字典转移到话机详情抽屉

## 背景

当前话机备注通过后台字典表 `phone_remarks` 维护，入口在后台「ATCOM 话机 → 话机备注」（`/admin/phone-remarks`）。由于分机号已经固定，备注直接绑定分机号即可，不需要独立的后台字典管理页面。

## 目标

将备注的编辑入口从后台字典页面转移到话机管理页面（`/phones`）的详情抽屉里，使运维人员在前台话机页面就能编辑备注，取消后台字典入口。

## 改动范围

### 前端 `src/views/PhonesView.vue`（详情抽屉）

在「📦 基本信息」和「📞 账号配置」之间新增「📝 备注」区块：

- **显示状态**：一行文本展示当前备注，空时显示 `—`，右侧有「编辑」按钮
- **编辑状态**：一个 textarea（带 maxlength 防止过长）+ 「保存」「取消」按钮
- 保存成功后：退出编辑态、刷新抽屉数据、同步更新表格该行的 `remark` 字段
- 保存失败：ElMessage.error 提示，编辑态保留，不退出

### 前端 `src/api/phones.ts`

新增 API：

```ts
export async function updatePhoneRemark(id: string, remark: string) {
  return request<any>(`${BASE}/${id}/remark`, {
    method: 'PUT',
    body: JSON.stringify({ remark }),
  })
}
```

### 后端 `server/routes/phones.ts`

新增 `PUT /:id/remark` 路由：

- 从 `id` 查出话机的 `extension`
- UPSERT 到 `phone_remarks` 表（按 `extension` 唯一键）
- 写操作日志：`module: 'phones', action: 'update_remark', detail: '话机 {extension} 备注已更新'`
- 返回 `{ code: 0, data: { extension, remark } }`

### 删除后台字典入口（完全删除）

- `src/router/index.ts`：删除 `phone-remarks` 路由条目
- `src/views/admin/AdminView.vue`：删除侧栏「话机备注」菜单项
- `src/utils/admin-dict-config.ts`：删除 `'phone-remarks'` 字典配置块

### 保留不动

- `phone_remarks` 表保留（数据迁移零成本）
- 后端 `GET /phones` 里读取备注并附加到设备的逻辑保留（前台表格还要显示备注列）
- 后台其他字典（`atcom-config`、`phone-models` 等）不动

## 数据流

```
用户在详情抽屉编辑备注 → PUT /api/v1/phones/:id/remark
  → 后端按 extension UPSERT phone_remarks
  → 返回成功
  → 前端刷新抽屉 + 更新表格该行 remark
```

## 错误处理

- 保存失败：ElMessage.error 提示，编辑态保留
- 网络失败：靠现有 `request` 工具的统一错误处理
- 后端 UPSERT 用 SQLite 的 `INSERT ... ON CONFLICT(extension) DO UPDATE` 保证原子性

## 不做的事（YAGNI）

- 不改 `phone_remarks` 表结构
- 不做备注长度硬校验（前端 textarea maxlength 即可）
- 不删 `phone_remarks` 表（保留数据）
- 不动后台其他字典
