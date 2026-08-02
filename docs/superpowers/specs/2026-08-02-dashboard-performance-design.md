# 首页卡片数据加载性能优化设计

- 日期：2026-08-02
- 范围：`/api/v1/dashboard/stats` + 前端首页渲染

## 背景与根因

首页 8 张卡片由 `HomeView.vue` 的 `onMounted` 调用 `/api/v1/dashboard/stats` 一次性赋值渲染。

该接口中 7 项统计（services/manuals/devices/printers/computers/procurementPhones/lmDevices）是毫秒级 SQLite `COUNT(*)`，但 **ATCOM 话机统计会阻塞整个接口**：

```ts
let cached = getCachedPhones()
if (!cached) {
  await Promise.race([
    ensurePhoneCache(),  // 串行跑完整话机发现链
    new Promise((_, reject) => setTimeout(() => reject(new Error('pbx-timeout')), 5000)),
  ]).catch(() => {})
  cached = getCachedPhones()
}
```

`ensurePhoneCache()` → `discoverPhones()` 是一条串行 HTTP 链（登录→分机配置→分机状态→刷新实时状态），各步超时 5s/10s/10s/30s，总耗时约 1~3s（PBX 正常）至 5s（不可达被兜底超时）。

- 话机缓存 TTL 为 **180 秒**：两次打开首页间隔 >3 分钟，缓存过期，首页需重跑整条链。
- 前端单接口一次性赋值 → 所有卡片一起等慢请求 → 用户感知"几秒才有数据显示"。

## 目标

1. 首页接口在任何情况下 **<50ms 返回**（不因话机轮询阻塞）。
2. 话机数据：冷启动显示占位，后台异步预热，后续请求立即拿到真实值。
3. 不改变前端数据结构与现有调用方式（前端零改动）。

## 方案：只读缓存 + 后台异步预热

### 后端改动（`server/routes/dashboard.ts`）

`/stats` 中的话机统计块由"无缓存则同步等"改为：

```ts
// 只读缓存：无缓存立即返回 0/0 占位，由后台异步预热填充（不阻塞首页）
const cached = getCachedPhones()
let phones = cached ? cached.length : 0
let phonesOnline = cached ? cached.filter((d: any) => d.online).length : 0
// 后台异步预热：仅当缓存缺失时触发一次，供后续请求使用
if (!cached) {
  ensurePhoneCache().catch(() => {})   // 不 await
}
```

要点：
- `ensurePhoneCache()` 改为 **fire-and-forget**（不 await，catch 吞错）。
- 移除 `Promise.race` 的 5s 兜底——不再需要，接口本身不等待。
- 其余 7 项统计不变。

### 前端改动（无）

前端无需任何改动：冷启动时 `phones=0, phonesOnline=0`，话机卡显示 `--` / `待接入`（现有模板逻辑已覆盖：`v-if="phoneTotal"` 显示在线数，`v-else` 显示"待接入"）。用户刷新首页（间隔 >3 分钟）即拿到真实话机数。

## 验收标准

1. 冷启动（重启服务后首次访问）首页接口返回时间 **<50ms**（不再有 1~5s 阻塞）。
2. 冷启动话机卡显示"待接入"，约 1~3s 后台预热完成后，刷新首页显示真实话机数。
3. 话机页 `/api/v1/phones` 行为不变（仍同步发现）。
4. 类型检查 `typecheck:server` / `typecheck:client` 通过。

## 范围外（不在此计划内）

- Element Plus 按需引入 + gzip 压缩（解决首屏资源加载，另立项）。
- 话机发现链各步超时收紧（30s 刷新超时偏大，另评估）。
- 操作日志批量写入、懒加载 quill/xlsx（后端均衡优化的其余项）。
