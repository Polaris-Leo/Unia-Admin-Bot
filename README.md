# Unia-Admin-Bot

B 站直播房管工具，提供实时弹幕控制台、禁言管理、多房管账户系统和完整审计日志。

## 功能

- **实时弹幕控制台** — 弹幕/礼物/SC 分列展示，常驻筛选栏（用户名/UID/内容关键词实时高亮过滤）；弹幕内嵌表情自动渲染为图片
- **用户操作面板** — 点击用户名弹出：禁言（本场/1h/12h/永久）、解禁、内部标签/备注、查看历史弹幕
- **禁言日志** — 完整记录谁在何时对哪位用户执行了何种禁言操作，支持筛选和一键解禁
- **历史弹幕** — 双 Tab 界面：「历史场次」按场次浏览（弹幕/SC/礼物/上舰分类）；「搜索」跨场次按 UID、关键词、时间范围过滤，最多返回 500 条
- **多房管账户** — 支持直接创建/邀请制注册，admin 管理账户，JWT 鉴权；角色分为「普通房管」和「系统管理员」
- **离线/轮播模式** — 直播间断开时继续记录传入消息，重连后无缝续接
- **弹幕数据兼容** — 存储格式与 Unia-Danmuku 完全一致（JSONL），历史数据可直接复制迁移

## 依赖服务

| 服务 | 说明 |
|------|------|
| [Unia-BiliCookie](../Unia-BiliCookie) | B 站 Cookie 管理服务（主要来源，需指定账号 UID）|
| 本地扫码登录 | 兜底方案，通过工具内置的二维码页面扫码授权 |

**Cookie 优先级**：Unia-BiliCookie 服务 → 本地扫码文件 → 未登录

## 快速开始

### 1. 安装依赖

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. 配置

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，至少配置以下字段：

```env
# 服务端口
PORT=3001

# JWT 签名密钥（请修改为随机长字符串）
JWT_SECRET=your-secret-here

# 直播间房间号（启动时自动连接）
ROOM_ID=12345678

# Unia-BiliCookie 服务地址
COOKIE_MANAGER_URL=http://localhost:3100

# 用于房管操作的 B 站账号 UID（必须填写，否则禁言操作无权限）
BILI_COOKIE_UID=你的UID
```

### 3. 启动

**生产模式（单端口，推荐）**

```bash
# 构建前端
npm run build

# 启动后端（同时托管前端）
npm run start
```

访问 [http://localhost:3001](http://localhost:3001)，使用 `admin` 账户登录。

**开发模式（双端口，支持热更新）**

```bash
# 同时启动前后端
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)（Vite 开发服务器，带热更新）。

## 配置说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `PORT` | 否 | 后端端口，默认 `3001` |
| `JWT_SECRET` | 是 | JWT 签名密钥，请使用长随机字符串 |
| `DATA_DIR` | 否 | 数据目录，默认 `./data` |
| `ADMIN_INIT_PASSWORD` | 否 | 首次启动 admin 初始密码，留空则随机生成并打印到终端 |
| `ROOM_ID` | 是 | 直播间房间号，启动后自动连接 |
| `COOKIE_MANAGER_URL` | 否 | Unia-BiliCookie 服务地址，留空则仅使用本地扫码 Cookie |
| `FRONTEND_URL` | 否 | 邀请链接中的前端地址；生产模式用 `http://localhost:3001`，开发模式用 `http://localhost:3000` |
| `BILI_COOKIE_UID` | 推荐 | 指定 BiliCookie 账号 UID；未填时自动取任意可用账号（禁言可能无权限）|

## B 站账号登录

点击导航栏右侧的 **Cookie 状态指示灯** 可打开登录弹窗，查看当前 Cookie 来源状态，也可以直接扫码登录作为兜底。

| 指示灯颜色 | 含义 |
|-----------|------|
| 绿色 | BiliCookie 服务在线，显示当前 UID |
| 黄色 | 使用本地扫码 Cookie |
| 红色 | 未登录或服务离线 |

## 房管账户管理

首次启动时自动创建 `admin` 账户，密码打印到终端。

**直接创建账户**（需系统管理员权限）：

1. 以 `admin` 登录后，进入「房管管理」页面
2. 点击「新建账户」，填写用户名、密码、角色后创建

**邀请制注册**：

1. 点击「生成邀请链接」，设置有效期后复制链接
2. 将链接发给新房管，对方打开后填写用户名和密码完成注册
3. 邀请链接一次性使用，过期自动失效

**重置 admin 密码：**

```bash
cd backend
node --no-warnings -e "
import bcrypt from 'bcrypt';
import { DatabaseSync } from 'node:sqlite';
const hash = await bcrypt.hash('新密码', 10);
const db = new DatabaseSync('./data/admin.db');
db.prepare('UPDATE mods SET password_hash=? WHERE username=?').run(hash, 'admin');
console.log('密码已重置');
"
```

## Docker 部署

> **推荐用于服务器部署**，无需在服务器上安装 Node.js。

### 前提

- 安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)

### 步骤

**1. 克隆项目**

```bash
git clone <repo-url> Unia-Admin-Bot
cd Unia-Admin-Bot
```

**2. 配置环境变量**

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填写 `JWT_SECRET`、`ROOM_ID`、`BILI_COOKIE_UID` 等必填项。

**3. 启动**

```bash
docker compose up -d
```

访问 `http://<服务器IP>:3001`，首次启动密码打印到容器日志：

```bash
docker compose logs app
```

**4. 停止 / 更新**

```bash
# 停止
docker compose down

# 拉取最新代码后重新构建
git pull
docker compose up -d --build
```

### 数据持久化

容器内数据目录 `/app/backend/data` 已通过 volume 挂载到宿主机 `./data`，包含：

- `admin.db` — 账户、禁言日志、标签
- `history/` — 弹幕历史 JSONL 文件
- `cookies.json` — 本地扫码 Cookie（如使用）

只要不删除 `./data` 目录，升级镜像不会丢失数据。

### 手动构建镜像

```bash
# 构建
docker build -t unia-admin-bot .

# 运行
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/backend/data \
  --env-file backend/.env \
  --name unia-admin-bot \
  unia-admin-bot
```

## 迁移 Unia-Danmuku 历史数据

弹幕数据格式完全兼容，直接复制即可：

```bash
# 复制历史弹幕数据
cp -r ../Unia-Danmuku/backend/data/history ./backend/data/history

# 如果不使用 Unia-BiliCookie，也可复制本地 Cookie 文件
cp ../Unia-Danmuku/backend/data/cookies.json ./backend/data/cookies.json
```

## 技术栈

| 层 | 技术 |
|----|------|
| 后端运行时 | Node.js v24+（使用内置 `node:sqlite`，无需编译） |
| 后端框架 | Express · WebSocket (`ws`) |
| 数据存储 | SQLite（账户/日志/标签）· JSONL（弹幕历史）|
| 前端框架 | React · Vite |
| 路由 | react-router-dom |
| HTTP 客户端 | axios |
| 容器化 | Docker（多阶段构建）|
