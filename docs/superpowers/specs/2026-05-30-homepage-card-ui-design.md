# 首页卡片 UI 优化设计规格

**日期：** 2026-05-30  
**状态：** 已批准

## 1. 目标

优化运维中心首页的 4 张功能卡片（内网服务、系统运维、设备信息、打印机管理），提升视觉层次感和交互体验，同时保持深色/浅色主题的双模式适配。

## 2. 设计决策

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 卡片风格 | 毛玻璃（Glassmorphism） | 现代感强，层次分明 |
| 悬浮效果 | 微上浮 + 光晕扩散 | 交互反馈清晰，性能友好 |
| 配色方案 | 蓝绿紫橙（当前色系） | 保持一致性，对比鲜明 |
| 主题支持 | 深色 + 浅色双模式 | 适配系统偏好 |

## 3. 视觉规范

### 3.1 卡片基础样式

```css
/* 深色主题 */
.big-card {
  background: rgba(13,17,23,0.70);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 26px 28px 22px;
  transition: all 0.4s cubic-bezier(0.25,0.1,0.25,1);
}

/* 浅色主题 */
.light-theme .big-card {
  background: rgba(255,255,255,0.80);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(0,0,0,0.08);
}
```

### 3.2 悬浮效果

```css
.big-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255,255,255,0.10);
}

/* 蓝色卡片悬浮 */
.card-blue:hover {
  border-color: rgba(88,166,255,0.35);
  box-shadow: 0 0 60px rgba(88,166,255,0.08),
              0 0 120px rgba(88,166,255,0.04),
              0 8px 32px rgba(0,0,0,0.5);
}

/* 浅色主题悬浮 */
.light-theme .big-card:hover {
  box-shadow: 0 0 40px rgba(0,0,0,0.06),
              0 8px 24px rgba(0,0,0,0.08);
}
```

### 3.3 卡片主题色

| 卡片 | 主色 | 图标背景 | 数字颜色 |
|------|------|----------|----------|
| 内网服务 | #58a6ff | rgba(88,166,255,0.18) | #79c0ff |
| 系统运维 | #3fb950 | rgba(63,185,80,0.18) | #7ee787 |
| 设备信息 | #a371f7 | rgba(163,113,247,0.18) | #bc8cff |
| 打印机管理 | #d29922 | rgba(210,153,34,0.18) | #e3b341 |

### 3.4 图标容器

```css
.card-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.35s ease, box-shadow 0.35s ease;
}

.big-card:hover .card-icon-wrap {
  transform: scale(1.08);
}
```

## 4. 主题适配

### 4.1 深色主题（默认）

- 页面背景：`#0a0e14`
- 卡片背景：`rgba(13,17,23,0.70)` + 模糊
- 文字：白色渐变标题 + 灰色副标题
- 装饰：背景光球、粒子动画、网格覆盖

### 4.2 浅色主题

- 页面背景：`#f6f8fa`
- 卡片背景：`rgba(255,255,255,0.80)` + 模糊
- 文字：深色渐变标题 + 灰色副标题
- 装饰：隐藏背景光球和标题光晕

## 5. 文件修改

- `src/views/HomeView.vue` — 主要修改文件
  - 更新 `.big-card` 样式
  - 添加 `.light-theme` 适配规则
  - 保持现有结构不变

## 6. 验收标准

1. 深色主题下卡片呈现毛玻璃效果
2. 悬浮时卡片上移 + 光晕扩散
3. 浅色主题下卡片适配为白色半透明
4. 浅色主题下标题文字清晰可见
5. 动画流畅，无性能问题
6. 响应式布局正常（2列网格）
