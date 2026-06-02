# Unia-Admin-Bot

B 站直播房管工具 — 弹幕控制台 + 禁言管理 + 多房管账户系统。

## 功能

- 实时弹幕控制台（弹幕/礼物/SC 分列，常驻筛选栏）
- 点击用户弹出操作面板：禁言、解禁、标签/备注、历史弹幕查询
- 禁言日志：完整审计谁在何时禁言了谁、禁言时长
- 跨场次历史弹幕搜索
- 多房管账户（邀请制注册）
- 弹幕数据与 Unia-Danmuku 格式完全兼容

## 快速开始

```bash
# 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 配置后端
cp backend/.env.example backend/.env
# 编辑 backend/.env 设置 JWT_SECRET 等

# 启动后端（首次启动会打印 admin 初始密码）
cd backend && npm run dev

# 启动前端（新终端）
cd frontend && npm run dev

# 访问 http://localhost:3000
```

## 迁移 Unia-Danmuku 数据

直接复制历史数据目录：
```bash
cp -r ../Unia-Danmuku/backend/data/history ./backend/data/history
```

复制 B 站 Cookie：
```bash
cp ../Unia-Danmuku/backend/data/cookies.json ./backend/data/cookies.json
```

## 技术栈

- 后端：Node.js v24+ · Express · `node:sqlite`（内置）· WebSocket
- 前端：React · Vite · react-router-dom
