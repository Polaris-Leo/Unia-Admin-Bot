# Unia 房管系统

B 站直播房管工具，提供实时弹幕控制台、禁言管理、多房管账户系统和完整审计日志。

## 功能

- **实时弹幕控制台** — 弹幕/礼物/SC 三列展示，比例 2:1:1（弹幕占一半，SC/礼物各占四分之一）；启动后优先加载最新 100 条历史弹幕，向上滚动到顶部时自动按需加载更早消息（每次 100 条），加载过程使用 `requestAnimationFrame` 补偿高度差，列表不会跳回；新消息到来时自动滚动使用双帧 `requestAnimationFrame` 写入，防止程序滚动误触发"未读计数"；偏离最新位置时底部固定显示悬浮按钮——有未读时显示「N 条新消息」，无未读但仍偏离时显示「回到最新位置」；顶栏居中筛选框（用户名/UID/内容关键词实时高亮过滤）；弹幕内嵌表情按 B 站官方标准分两档渲染（标准颜文字 1 行高 / 订阅大表情 2 行高）
- **直播场次分界线** — 仅在收到 B 站 LIVE 事件（直播真正开始）时插入「直播开始 HH:MM」分界线，时间取自 B 站接口返回的实际开播时刻；下播时插入「直播结束 HH:MM」；后端重启或网页刷新不会重复插入；B 站偶发的重复 LIVE 命令已做去重处理，分界线始终只出现一次；每场直播数据存入独立 session 文件夹
- **显示设置** — 右上角设置面板（主页）/ 筛选栏左下角设置按钮（历史页），两处共用同一套持久化设置：
  - **弹幕字号** — -5 到 +5 共 11 级，弹幕/SC/礼物三列同步生效
  - **显示方向** — 向上滚动（新弹幕在底部）/ 向下滚动（新弹幕在顶部）
  - **SC 显示方式** — 「卡片」（按金额分 6 档配色的彩色卡片，深色模式下内容区固定深色文字）/ 「文字」（紧凑单行，用户名与正文颜色分层）
  - **礼物显示方式** — 「文字」（紧凑单行，默认）/ 「图标」（含 B 站礼物图标 + 名称 + 数量 + 金额）
  - 设置以 MUI Toggle Button 样式呈现，分组标题以主题色高亮区分，持久化到本地
- **明暗主题** — 导航栏太阳/月亮按钮一键切换，自动跟随系统偏好，无刷新闪烁
- **历史记录页** — 左侧筛选栏（场次下拉、日期范围、用户名、UID、弹幕内容），右侧三列布局展示当场弹幕/SC/礼物；选定场次时各筛选条件在前端实时过滤，不选场次时跨全部场次搜索（最多 500 条）；支持将筛选结果导出为 Excel（弹幕/SC/礼物各一个 Sheet）；筛选栏左下角显示设置按钮，与主页同步同一套字号和显示模式设置
- **弹幕悬浮窗（浏览器 PiP）**（需 Chrome 116+ 或 Edge）— 点击工具栏画中画按钮，将弹幕列表弹出为独立小窗口，始终置顶于浏览器其他标签；弹幕内容（含表情图片）实时同步；点击用户名可直接弹出完整操作面板（禁言/标签/历史）；主题随主窗口深色/浅色模式自动同步；再次点击按钮或关闭小窗口即可退出
- **弹幕悬浮窗（Electron 独立程序）** — **系统级透明置顶**，可透过背景看到其他任意程序的画面；独立进程，后端运行即可接收弹幕，无需打开浏览器；支持 Electron 远程模式：前端通过 URL 参数 `backendUrl` 接入远程后端，自动持久化到本机配置，整页刷新后仍能恢复连接；详见 [Unia-Admin-APP](https://github.com/Polaris-Leo/Unia-Admin-APP)
- **用户操作面板** — 点击用户名弹出：禁言（本场/1h/12h/永久）、解禁、内部标签/备注、跳转历史记录页；面板采用主题色径向渐变背景 + 渐变标题区，视觉层次更清晰，宽度收窄至 252px 减少遮挡
- **禁言日志** — 完整记录谁在何时对哪位用户执行了何种禁言操作，支持筛选和一键解禁
- **多房管账户** — 三级角色：超级管理员（唯一，内置）、系统管理员、普通房管；超级管理员可管理所有账户并查看全部邀请码，系统管理员只能使用邀请制注册并查看自己生成的邀请码；邀请链接一次性，生成后弹窗展示，关闭即不可再查看；Cookie 状态按钮与扫码登录入口仅对管理员（系统管理员及超级管理员）可见，普通房管不显示，B 站账号登录状态由后端统一管理全员共享
- **时间显示** — 所有时间戳（弹幕时间、场次标签、禁言记录等）统一显示北京时间（UTC+8），与服务器系统时区无关
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

**扫码登录行为**：

- **已登录**（本地 Cookie 有效）— 打开弹窗时直接展示已登录状态（UID + 退出按钮），**不自动生成二维码**，避免不必要的 API 请求；点击「切换账号」可展开扫码区，用新账号重新登录
- **未登录** — 打开弹窗时自动生成二维码，使用 B 站 APP 扫码后 Cookie 写入本地文件并立即生效
- **二维码过期** — 扫码区显示「点击刷新」按钮，手动重新生成；也可随时点击「刷新二维码」链接强制刷新

## 房管账户管理

首次启动时自动创建 `admin` 账户，密码打印到终端。

**修改自身账户信息**：

任意已登录用户均可点击导航栏右上角用户名，在下拉菜单中选择「修改账户信息」，自行更改用户名和密码。

**直接创建账户**（仅超级管理员）：

1. 以超级管理员登录后，进入「用户管理」→「用户列表」
2. 点击「新建用户」，填写用户名、密码、角色后创建

**邀请制注册**（系统管理员及以上）：

1. 进入「用户管理」→「邀请码」，选择有效期后点击「生成」
2. 链接仅在弹窗内展示一次，关闭后不可再查看，请立即复制
3. 将链接发给新房管，对方打开后填写用户名和密码完成注册
4. 邀请链接一次性使用，过期自动失效；链接丢失请删除后重新生成

**账户权限说明**：

| 角色 | 用户列表 | 直接创建账户 | 邀请码（查看范围） |
|------|---------|------------|-----------------|
| 超级管理员 | ✓ | ✓ | 全部 |
| 系统管理员 | — | — | 仅自己生成的 |
| 普通房管 | — | — | — |

**重置 admin 密码：**

```bash
cd backend
node --no-warnings -e "
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
const hash = await bcrypt.hash('新密码', 10);
const db = new DatabaseSync('./data/admin.db');
db.prepare('UPDATE mods SET password_hash=? WHERE username=?').run(hash, 'admin');
console.log('密码已重置');
"
```

## Docker 部署

> **推荐用于服务器部署**，无需在服务器上安装 Node.js，只需安装 Docker。

### 前提

- 安装 [Docker](https://docs.docker.com/get-docker/)（无需 Docker Compose）

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

编辑 `backend/.env`，填写必填项：

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 随机长字符串，务必修改 |
| `ROOM_ID` | 直播间房间号 |
| `BILI_COOKIE_UID` | 用于禁言的 B 站账号 UID |
| `FRONTEND_URL` | 改为服务器实际地址，如 `http://1.2.3.4:3001`（用于邀请链接） |

**3. 构建镜像**

```bash
docker build -t unia-admin-bot .
```

**4. 启动容器**

```bash
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/backend/data \
  --env-file backend/.env \
  --name unia-admin-bot \
  --restart unless-stopped \
  unia-admin-bot
```

访问 `http://<服务器IP>:3001`，首次启动密码查看方式：

```bash
docker logs unia-admin-bot
```

**5. 停止 / 重启**

```bash
docker stop unia-admin-bot
docker start unia-admin-bot
```

**6. 更新到最新版本**

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker build -t unia-admin-bot .

# 停止并删除旧容器（数据不会丢失，挂载在 ./data 目录）
docker stop unia-admin-bot && docker rm unia-admin-bot

# 启动新容器
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/backend/data \
  --env-file backend/.env \
  --name unia-admin-bot \
  --restart unless-stopped \
  unia-admin-bot
```

### 数据持久化

容器内数据目录 `/app/backend/data` 已通过 `-v` 挂载到宿主机 `./data`，包含：

- `admin.db` — 账户、禁言日志、标签
- `history/` — 弹幕历史 JSONL 文件
- `cookies.json` — 本地扫码 Cookie（如使用）

只要不删除 `./data` 目录，更新容器不会丢失任何数据。

### Docker Compose（可选，需较新版本）

如果服务器 Docker 支持 compose 插件（`docker compose version` 有输出），可以使用：

```bash
docker compose up -d        # 启动
docker compose down         # 停止
docker compose up -d --build  # 更新重建
docker compose logs app     # 查看日志
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
