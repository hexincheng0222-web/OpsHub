# 待修复 TypeScript 错误清单

报告日期: 2026-06-30
检查命令: `npx vue-tsc --noEmit -p tsconfig.app.json`

---

## 一、本次改动引入（2 项）

### 1. DevicesView.vue:22 — 未使用的 router 变量

**原因**：内联返回按钮替换为 `<BackButton />` 后，`const router = useRouter()` 不再被使用。

**修复**：
```ts
// 删除第 4 行：
import { useRouter } from 'vue-router'     // ← 删除
const router = useRouter()                   // ← 删除
```

### 2. AdminView.vue:116-117 — el-menu 事件参数缺类型

**原因**：`@open`/`@close` 回调参数 `index` 隐式 any。

**修复**：
```vue
@open="(index: string) => openedMenus.push(index)"
@close="(index: string) => openedMenus = openedMenus.filter(i => i !== index)"
```

---

## 二、代码库原有（15+ 项，建议一并修）

### 3. DeviceDrawer.vue(2,101) + (23,56) — 属性类型错误

```
Property 'drawerDevice' does not exist on type '{ typeLabel: string; ... }'
```

**修复**：检查组件的 `props` 定义，确认 `device` prop 名称是否正确，或模板中 `drawerDevice` 应改为 `device`。

---

### 4. HomeView.vue(105,19) — Cellphone 图标未使用

```
TS6133: 'Cellphone' is declared but its value is never read.
```

**修复**：从 import 中删除 `Cellphone`。

---

### 5. LoginView.vue(4,15) — formRef 变量未使用

```
TS6133: 'formRef' is declared but its value is never read.
```

**原因**：`formRef` 在模板 `<el-form ref="formRef"` 中使用了，但在 `<script>` 中没有被读取的变量引用。

**修复**：若模板已正确绑定 `ref="formRef"` 则加 `// eslint-disable-next-line` 或确认 composable 返回值名称一致。

---

### 6. PhonebookView.vue(120,30) — clearSearch 未使用

```
TS6133: 'clearSearch' is declared but its value is never read.
```

**修复**：删除 `clearSearch` 的析构，或添加调用。

---

### 7. PhonebookView.vue(138) — 算术运算类型错误

```
TS2363: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
TS2365: Operator '+' cannot be applied to types 'number' and 'Ref<number, number>'.
```

**原因**：`.value` 缺失，Vue ref 在模板外直接参与运算需要 `.value`。

**修复**：检查相关表达式补 `.value`。

---

### 8. PhonebookView.vue(194,25) — 找不到 fileInput

```
TS2304: Cannot find name 'fileInput'
```

**原因**：模板中的 `ref="fileInput"` 在 `<script>` 中没有对应的 `ref()` 声明。

**修复**：添加 `const fileInput = ref<HTMLInputElement>()`。

---

### 9. PhonesView.vue(151) — 导入冲突

```
TS2440: Import declaration conflicts with local declaration of 'rebootPhone'.
```

**原因**：既导入了 `import { rebootPhone } from '@/api/phones'`（API 函数），又在同一文件定义了一个同名函数 `function rebootPhone()`。

**修复**：将本地函数改名，例如 `async function handleRebootPhone()`。

---

### 10. PhonesView.vue(232) — 参数数量不匹配

```
TS2554: Expected 0 arguments, but got 1.
```

**原因**：调用了 `rebootPhone(selectedPhone.value.id)`，但此时调用的可能是本地函数（无参数），而非 API 函数。

**修复**：该问题与 #9 相关，统一改名后自然修复。

---

### 11. PhonesView.vue(275-278) — 类型不匹配

```
TS2740: Type '{ devices: PhoneDevice[]; ... }' is missing the following properties from type 'any[]'
```

**原因**：某个变量被推断为对象，但被当作数组使用（`.length`、`.filter`）。

**修复**：检查 `response` 的数据结构，解构出 `response.devices` 赋值给期待数组的变量。

---

### 12. PrintersView.vue(112,66) — 状态类型不兼容

```
TS2345: Argument of type '{ ... status: string; }' is not assignable to parameter of type 'Printer'.
  Types of property 'status' are incompatible.
    Type 'string' is not assignable to type '"正常" | "缺墨" | "故障"'.
```

**修复**：将传入对象的 `status` 显式断言为 Printer 的联合类型：`status: data.status as "正常" | "缺墨" | "故障"`。

---

### 13. ComputerProcurementTab.vue(180) — 未使用的导入

```
TS6133: 'Plus', 'ArrowDown', 'Download', 'Upload' are declared but its value is never read.
```

### 14. ComputerProcurementTab.vue(421) — 未使用的函数

```
TS6133: 'exportCSV' is declared but its value is never read.
```

### 15. PhoneProcurementTab.vue(191) — 未使用的导入

```
TS6133: 'Plus', 'ArrowDown', 'Download', 'Upload' are declared but its value is never read.
```

### 16. PhoneProcurementTab.vue(408) — 未使用的函数

```
TS6133: 'exportCSV' is declared but its value is never read.
```

**修复**：删除未使用的 import 声明和函数。

---

### 17. ProcurementView.vue(66,7) — importInputRef 未使用

```
TS6133: 'importInputRef' is declared but its value is never read.
```

**原因**：`el-button` 的导入功能使用 `ref` 触发，但父组件不再直接使用。

**修复**：删除 `importInputRef` 声明，或确认子组件 Tab 中是否有对应处理。

---

## 验证方式

修复完成后执行：

```bash
cd /c/Users/何鑫城/Desktop/OpsHub
npx vue-tsc --noEmit -p tsconfig.app.json
```

预期结果：`exit code 0`，无错误输出。
