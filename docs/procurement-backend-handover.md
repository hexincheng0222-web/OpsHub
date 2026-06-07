# 📋 手机采购 & 电脑采购 — 后端交接文档

> **文档版本**: v1.0  
> **更新日期**: 2025-07  
> **前端项目**: OpsHub (Vue 3 + Element Plus + Pinia)  
> **当前状态**: 纯前端 Mock，需后端接管

---

## 一、整体架构说明

当前手机采购和电脑采购页面**没有后端 API**，所有数据存储在前端 Pinia store（内存级别），使用 Mock 数据填充。后端需要提供：

1. **RESTful API** — 增删改查 + 批量操作 + 导入
2. **数据库表** — 持久化存储
3. **字典接口**（可选）— 品牌、型号、部门等下拉数据

### 前端 Store 位置

```
src/stores/procurement.ts    ← 两个接口定义 + 两个 store
src/views/PhoneProcurementView.vue      ← 手机采购页面
src/views/ComputerProcurementView.vue   ← 电脑采购页面
```

---

## 二、手机采购 (PhoneProcurement)

### 2.1 数据结构

```typescript
interface PhoneProcurement {
  id: number            // 主键，自增
  assetNumber: string   // 资产编号，格式 IT-PH-{YYYY}-{NNN}，前端自动生成
  partNo: string        // Part No（零件编号）
  serialNo: string      // Serial No（序列号）
  imei: string          // IMEI/MEID，15位
  arrivalDate: string   // 到货时间，格式 YYYY-MM-DD
  pickupDate: string    // 领用时间，格式 YYYY-MM-DD
  brand: string         // 品牌 ⭐ 字典化
  model: string         // 型号 ⭐ 品牌联动字典
  assetLink: string     // 资产关联（关联电脑资产编号）
  department: string    // 领用部门 ⭐ 字典化
  handler: string       // 经手人 ⭐ 字典化
  recipient: string     // 领用人
  dingtalkCreator: string // 钉钉流程创建人
  purchaseType: string  // 换/新购，枚举值: "新购" | "换"
  dingtalkFlow: string  // 钉钉流程编号
  originalOwner: string // 原手机归属（换机时填写）
  notes: string         // 备注
}
```

### 2.2 数据库表设计建议

```sql
CREATE TABLE phone_procurement (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  asset_number    VARCHAR(32)  NOT NULL UNIQUE COMMENT '资产编号 IT-PH-YYYY-NNN',
  part_no         VARCHAR(64)  DEFAULT '' COMMENT 'Part No',
  serial_no       VARCHAR(64)  DEFAULT '' COMMENT 'Serial No',
  imei            VARCHAR(32)  DEFAULT '' COMMENT 'IMEI/MEID',
  arrival_date    DATE         DEFAULT NULL COMMENT '到货时间',
  pickup_date     DATE         DEFAULT NULL COMMENT '领用时间',
  brand           VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '品牌',
  model           VARCHAR(128) NOT NULL DEFAULT '' COMMENT '型号',
  asset_link      VARCHAR(32)  DEFAULT '' COMMENT '关联电脑资产编号',
  department      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '领用部门',
  handler         VARCHAR(32)  DEFAULT '' COMMENT '经手人',
  recipient       VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '领用人',
  dingtalk_creator VARCHAR(32) DEFAULT '' COMMENT '钉钉流程创建人',
  purchase_type   VARCHAR(8)   NOT NULL DEFAULT '新购' COMMENT '换/新购',
  dingtalk_flow   VARCHAR(64)  DEFAULT '' COMMENT '钉钉流程编号',
  original_owner  VARCHAR(32)  DEFAULT '' COMMENT '原手机归属',
  notes           TEXT         DEFAULT NULL COMMENT '备注',
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_brand (brand),
  INDEX idx_department (department),
  INDEX idx_imei (imei),
  INDEX idx_arrival_date (arrival_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='手机采购记录';
```

### 2.3 API 接口

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| `GET` | `/api/phone-procurement` | 分页列表 | Query: `page, pageSize, search, department, purchaseType, brand, startDate, endDate` |
| `GET` | `/api/phone-procurement/:id` | 详情 | — |
| `POST` | `/api/phone-procurement` | 新增 | `PhoneProcurement` (不含 id) |
| `PUT` | `/api/phone-procurement/:id` | 修改 | `Partial<PhoneProcurement>` |
| `DELETE` | `/api/phone-procurement/:id` | 删除单条 | — |
| `POST` | `/api/phone-procurement/batch-delete` | 批量删除 | `{ ids: number[] }` |
| `POST` | `/api/phone-procurement/import` | CSV 导入 | `multipart/form-data` (file) |
| `GET` | `/api/phone-procurement/export` | CSV 导出 | Query: 同列表筛选条件 |
| `GET` | `/api/phone-procurement/template` | 下载导入模板 | — |

#### 2.3.1 列表查询参数

```json
{
  "page": 1,
  "pageSize": 10,
  "search": "Apple",           // 模糊搜索 brand/model/recipient/imei/assetNumber/partNo/department
  "department": "研发部",       // 精确匹配
  "purchaseType": "新购",       // 精确匹配
  "brand": "Apple",            // 精确匹配
  "startDate": "2025-01-01",   // arrivalDate 范围
  "endDate": "2025-12-31"
}
```

#### 2.3.2 列表响应格式

```json
{
  "code": 0,
  "data": {
    "list": [ /* PhoneProcurement[] */ ],
    "total": 128
  }
}
```

#### 2.3.3 资产编号自动生成规则

前端当前逻辑：`IT-PH-{当前年份}-{3位序号}`，例如 `IT-PH-2025-001`

后端应实现**全局唯一**的序号生成，建议使用数据库序列或 Redis 自增，避免并发冲突。

#### 2.3.4 CSV 导入格式

导入文件为 UTF-8 CSV，列顺序（17列）：

```
资产编号,Part No,Serial No,IMEI/MEID,到货时间,领用时间,品牌,型号,资产关联,领用部门,经手人,领用人,钉钉流程创建人,换/新购,钉钉流程,原手机归属,备注
```

导入规则：
- 第一行为表头，从第二行开始读取数据
- `资产编号` 为空时自动生成
- `到货时间` / `领用时间` 格式为 `YYYY-MM-DD`
- `换/新购` 只接受 `新购` 或 `换`，其他值默认为 `新购`
- 导入后返回导入成功的条数

---

## 三、电脑采购 (ComputerProcurement)

### 3.1 数据结构

```typescript
interface ComputerProcurement {
  id: number            // 主键，自增
  model: string         // 采购型号 ⭐ 字典化（采购型号→设备型号联动）
  department: string    // 使用部门 ⭐ 字典化
  applicant: string     // 申请人
  macAddress: string    // MAC 地址，格式 AA:BB:CC:DD:EE:FF
  deviceModel: string   // 设备型号 ⭐ 字典化
  ceNumber: string      // 使用人 CE 号
  actualUser: string    // 实际使用人
  approvalNumber: string // 申请审批流程编号（钉钉）
  receiveDate: string   // 收货日期，格式 YYYY-MM-DD
  assetNumber: string   // 固定资产编号，格式 IT-PC-YYYY-NNN
  deliveryDate: string  // 设备交付日期，格式 YYYY-MM-DD
  deliveryPerson: string // 设备交付人 ⭐ 字典化
  pickupApproval: string // 领用审批流程编号（钉钉）
  ceProcessed: boolean  // 是否已走 CE 流程
  price: number         // 价格（元），精度 2 位小数
}
```

### 3.2 数据库表设计建议

```sql
CREATE TABLE computer_procurement (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT,
  model             VARCHAR(128) NOT NULL DEFAULT '' COMMENT '采购型号',
  department        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '使用部门',
  applicant         VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '申请人',
  mac_address       VARCHAR(32)  DEFAULT '' COMMENT 'MAC 地址',
  device_model      VARCHAR(128) NOT NULL DEFAULT '' COMMENT '设备型号',
  ce_number         VARCHAR(32)  DEFAULT '' COMMENT '使用人 CE 号',
  actual_user       VARCHAR(32)  DEFAULT '' COMMENT '实际使用人',
  approval_number   VARCHAR(64)  DEFAULT '' COMMENT '申请审批流程编号',
  receive_date      DATE         DEFAULT NULL COMMENT '收货日期',
  asset_number      VARCHAR(32)  DEFAULT '' COMMENT '固定资产编号',
  delivery_date     DATE         DEFAULT NULL COMMENT '设备交付日期',
  delivery_person   VARCHAR(32)  DEFAULT '' COMMENT '设备交付人',
  pickup_approval   VARCHAR(64)  DEFAULT '' COMMENT '领用审批流程编号',
  ce_processed      TINYINT(1)   DEFAULT 0 COMMENT '是否已走 CE 流程',
  price             DECIMAL(10,2) DEFAULT 0 COMMENT '价格',
  created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_department (department),
  INDEX idx_model (model),
  INDEX idx_receive_date (receive_date),
  INDEX idx_asset_number (asset_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='电脑采购记录';
```

### 3.3 API 接口

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| `GET` | `/api/computer-procurement` | 分页列表 | Query: `page, pageSize, search, department, brand, startDate, endDate` |
| `GET` | `/api/computer-procurement/:id` | 详情 | — |
| `POST` | `/api/computer-procurement` | 新增 | `ComputerProcurement` (不含 id) |
| `PUT` | `/api/computer-procurement/:id` | 修改 | `Partial<ComputerProcurement>` |
| `DELETE` | `/api/computer-procurement/:id` | 删除单条 | — |
| `POST` | `/api/computer-procurement/batch-delete` | 批量删除 | `{ ids: number[] }` |
| `POST` | `/api/computer-procurement/import` | CSV 导入 | `multipart/form-data` (file) |
| `GET` | `/api/computer-procurement/export` | CSV 导出 | Query: 同列表筛选条件 |
| `GET` | `/api/computer-procurement/template` | 下载导入模板 | — |

#### 3.3.1 列表查询参数

```json
{
  "page": 1,
  "pageSize": 10,
  "search": "MacBook",          // 模糊搜索 model/department/applicant/macAddress/deviceModel/assetNumber
  "department": "研发部",         // 精确匹配
  "brand": "Apple",             // ⚠️ 注意：brand 不是存储字段，需后端根据 model 推断或新增 brand 字段
  "startDate": "2025-01-01",    // receiveDate 范围
  "endDate": "2025-12-31"
}
```

> ⚠️ **重要**: 前端当前通过 `inferBrand(model)` 函数从采购型号字符串推断品牌（含 MacBook→Apple、Dell→Dell、ThinkPad→Lenovo、HP→HP）。后端建议**在表中增加 `brand` 字段**，或提供字典映射接口，避免重复推断逻辑。

#### 3.3.2 列表响应格式

```json
{
  "code": 0,
  "data": {
    "list": [ /* ComputerProcurement[] */ ],
    "total": 56
  }
}
```

#### 3.3.3 CSV 导入格式

导入文件为 UTF-8 CSV，列顺序（15列）：

```
采购型号,使用部门,申请人,MAC 地址,设备型号,使用人 CE 号,实际使用人,申请审批流程,收货日期,固定资产编号,设备交付日期,设备交付人,领用审批流程,已走 CE 流程,价格
```

导入规则：
- 第一行为表头，从第二行开始读取数据
- `已走 CE 流程` 列：值为 `是` 时设为 `true`，其他为 `false`
- `价格` 列：解析为浮点数，无效值默认 `0`
- `收货日期` / `设备交付日期` 格式为 `YYYY-MM-DD`
- 导入后返回导入成功的条数

---

## 四、字典数据（品牌/型号/部门等）

前端当前使用**硬编码 + computed 从已有数据提取**的方式生成下拉选项。后端接管后建议：

### 4.1 需要字典化的字段

| 页面 | 字段 | 前端当前值来源 | 建议字典 key |
|------|------|---------------|-------------|
| 手机 | 品牌 brand | 硬编码 9 个品牌 + 数据提取 | `phone-brands` |
| 手机 | 型号 model | brand→model 硬编码映射 | `phone-models` |
| 手机 | 部门 department | 数据提取去重 | `departments` |
| 手机 | 经手人 handler | 数据提取去重 | `handlers` |
| 电脑 | 采购型号 model | 硬编码 12 个型号 + 数据提取 | `computer-purchase-models` |
| 电脑 | 设备型号 deviceModel | purchaseModel→deviceModel 映射 | `computer-device-models` |
| 电脑 | 部门 department | 数据提取去重 | `departments` |
| 电脑 | 交付人 deliveryPerson | 数据提取去重 | `handlers` |

### 4.2 前端硬编码的品牌→型号映射（供后端参考）

#### 手机品牌→型号

```json
{
  "Apple": ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 16 Plus", "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15", "iPhone 14 Pro Max", "iPhone 14", "iPhone SE"],
  "Samsung": ["Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S23 Ultra", "Galaxy S23", "Galaxy A55", "Galaxy A35", "Galaxy Z Fold5", "Galaxy Z Flip5"],
  "华为": ["Mate 60 Pro+", "Mate 60 Pro", "Mate 60", "Pura 70 Pro+", "Pura 70 Pro", "Pura 70", "nova 12 Pro", "nova 12"],
  "小米": ["Xiaomi 14 Ultra", "Xiaomi 14 Pro", "Xiaomi 14", "Redmi K70 Pro", "Redmi K70", "Redmi Note 13 Pro+"],
  "OPPO": ["Find X7 Ultra", "Find X7", "Reno11 Pro", "Reno11", "A3 Pro"],
  "vivo": ["X100 Pro", "X100", "S18 Pro", "S18", "Y100"],
  "荣耀": ["Magic6 Pro", "Magic6", "Magic V2", "200 Pro", "X50"],
  "一加": ["12", "11", "Ace 3", "Ace 2"],
  "realme": ["GT5 Pro", "GT5", "12 Pro+", "12 Pro"]
}
```

#### 电脑采购型号→设备型号

```json
{
  "MacBook Pro 16": ["MacBook Pro 16 M3 Max", "MacBook Pro 16 M3 Pro", "MacBook Pro 16 M2 Pro"],
  "MacBook Pro 14": ["MacBook Pro 14 M3 Max", "MacBook Pro 14 M3 Pro", "MacBook Pro 14 M2 Pro"],
  "MacBook Air 15": ["MacBook Air 15 M3", "MacBook Air 15 M2"],
  "MacBook Air 13": ["MacBook Air 13 M3", "MacBook Air 13 M2", "MacBook Air 13 M1"],
  "Dell XPS 15": ["Dell XPS 15 9530", "Dell XPS 15 9520"],
  "Dell XPS 13": ["Dell XPS 13 9340", "Dell XPS 13 9330"],
  "Dell Latitude 5540": ["Dell Latitude 5540", "Dell Latitude 5550"],
  "ThinkPad X1 Carbon": ["ThinkPad X1 Carbon Gen 11", "ThinkPad X1 Carbon Gen 12"],
  "ThinkPad T14": ["ThinkPad T14 Gen 4", "ThinkPad T14 Gen 3"],
  "ThinkPad E14": ["ThinkPad E14 Gen 5", "ThinkPad E14 Gen 4"],
  "HP EliteBook 840": ["HP EliteBook 840 G10", "HP EliteBook 840 G9"],
  "HP ProBook 450": ["HP ProBook 450 G10", "HP ProBook 450 G9"]
}
```

---

## 五、前端对接改造要点

后端 API 就绪后，前端需要改造以下内容：

### 5.1 Store 改造

当前 Pinia store 是纯内存操作，需要改为 API 调用：

```typescript
// 当前（Mock）
const phones = ref<PhoneProcurement[]>([...mockPhones])
function addPhone(p: PhoneProcurement) { phones.value.push(p) }

// 改造后（API）
async function fetchPhones(params: QueryParams) {
  const res = await request.get('/api/phone-procurement', { params })
  phones.value = res.data.list
  total.value = res.data.total
}
async function addPhone(p: Omit<PhoneProcurement, 'id'>) {
  await request.post('/api/phone-procurement', p)
  await fetchPhones(currentParams) // 刷新列表
}
```

### 5.2 需要改造的文件清单

| 文件 | 改造内容 |
|------|---------|
| `src/stores/procurement.ts` | 删除 mock 数据，改为 API 调用 |
| `src/views/PhoneProcurementView.vue` | store 调用方式适配异步 |
| `src/views/ComputerProcurementView.vue` | store 调用方式适配异步 |
| `src/utils/` (新增) | 可抽取 phone-csv.ts / computer-csv.ts |

### 5.3 注意事项

1. **异步适配**: 当前所有 store 操作是同步的，改为 API 后需要 `async/await`，页面的 `addComputer()` / `savePrinter()` 等函数需改为异步
2. **资产编号生成**: 手机的 `IT-PH-{year}-{seq}` 当前在前端生成，后端接管后应由后端保证唯一性
3. **品牌字段**: 电脑采购表没有独立的 `brand` 字段，品牌是前端从 `model` 字符串推断的。后端建议新增 `brand` 列，便于筛选和统计
4. **搜索**: 前端当前是全量过滤，后端需实现 SQL LIKE 模糊搜索
5. **分页**: 前端当前是客户端分页（slice），后端需实现服务端分页

---

## 六、Mock 数据（供后端测试用）

### 手机采购 Mock 数据（5条）

| 资产编号 | 品牌 | 型号 | IMEI | 部门 | 经手人 | 领用人 | 类型 |
|---------|------|------|------|------|--------|--------|------|
| IT-PH-2025-001 | Apple | iPhone 16 Pro Max 256G | 356812090123456 | 研发部 | 运维-王五 | 张三 | 新购 |
| IT-PH-2025-002 | Samsung | Galaxy S24 Ultra 512G | 356812090123457 | 设计部 | 运维-王五 | 李四 | 新购 |
| IT-PH-2025-003 | 小米 | Xiaomi 14 Ultra | 860123456789012 | 市场部 | 运维-赵六 | 王五 | 换 |
| IT-PH-2025-004 | OPPO | Find X7 Ultra | 860123456789013 | 财务部 | 运维-王五 | 赵六 | 新购 |
| IT-PH-2025-005 | 华为 | Mate 60 Pro+ | 860123456789014 | 人事部 | 运维-赵六 | 钱七 | 新购 |

### 电脑采购 Mock 数据（5条）

| 采购型号 | 设备型号 | 部门 | 申请人 | 交付人 | 价格 |
|---------|---------|------|--------|--------|------|
| MacBook Pro 16" | MacBook Pro M3 Max | 研发部 | 张三 | 运维-王五 | 18999 |
| Dell XPS 15 | Dell XPS 15 9530 | 设计部 | 李四 | 运维-王五 | 12999 |
| ThinkPad X1 Carbon | ThinkPad X1 Carbon Gen 11 | 市场部 | 王五 | 运维-赵六 | 10999 |
| MacBook Air 15" | MacBook Air M3 | 财务部 | 赵六 | 运维-王五 | 8999 |
| HP EliteBook 840 | HP EliteBook 840 G10 | 人事部 | 钱七 | 运维-赵六 | 7599 |
