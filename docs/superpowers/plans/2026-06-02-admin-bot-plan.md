# Unia-Admin-Bot 实现计划

**日期**: 2026-06-02  
**设计文档**: `docs/superpowers/specs/2026-06-02-admin-bot-design.md`

---

## 阶段概览

| 阶段 | 内容 | 依赖 |
|------|------|------|
| 1 | 项目脚手架 | — |
| 2 | SQLite 数据库初始化 | 阶段 1 |
| 3 | 认证系统（登录/注册/邀请） | 阶段 2 |
| 4 | B 站直播 WebSocket 接入 | 阶段 3 |
| 5 | 弹幕控制台前端（主界面） | 阶段 4 |
| 6 | 禁言/解禁功能 | 阶段 3 |
| 7 | 禁言日志页 | 阶段 6 |
| 8 | 用户标签/备注 | 阶段 5 |
| 9 | 历史搜索与跨场次查询 | 阶段 5 |
| 10 | UserActionPopup 完整功能整合 | 阶段 6、8、9 |
| 11 | 房管管理页（ModsPage） | 阶段 3 |
| 12 | 收尾：样式打磨、错误处理、推送 | 全部 |

---

## 阶段 1：项目脚手架

### 后端
- [ ] 初始化 `backend/package.json`（Express、better-sqlite3、ws、axios、bcrypt、jsonwebtoken、uuid、pako、cors、dotenv）
- [ ] 创建 `backend/src/server.js`：Express + HTTP server + WS 挂载点
- [ ] 创建 `backend/.env.example`：`PORT`、`JWT_SECRET`、`DATA_DIR`
- [ ] 创建 `backend/data/` 目录结构（history/、cookies.json 占位）

### 前端
- [ ] 用 `npm create vite@latest frontend -- --template react` 初始化
- [ ] 安装依赖：react-router-dom、axios
- [ ] 配置 `vite.config.js`：代理 `/api` 和 `/ws` 到后端
- [ ] 创建基础路由结构：`/`（DanmakuPage）、`/ban-logs`、`/mods`、`/login`、`/register`

### 根目录
- [ ] 创建根 `package.json`（scripts: `dev`、`start` 同时启动前后端）
- [ ] 创建 `.gitignore`（node_modules、.env、data/admin.db、data/cookies.json）
- [ ] 创建 `README.md`

**验收**：`npm run dev` 能同时启动前后端，浏览器访问 `localhost:3000` 不报错。

---

## 阶段 2：SQLite 数据库初始化

**文件**：`backend/src/db.js`

- [ ] 用 `better-sqlite3` 打开/创建 `data/admin.db`
- [ ] 执行建表 SQL（`mods`、`invite_tokens`、`ban_logs`、`user_tags`）
- [ ] 首次启动时检测 `mods` 表是否为空，若为空则创建默认 admin 账户（用户名 `admin`，密码从 `.env` 读取 `ADMIN_INIT_PASSWORD`，若未设置则输出随机密码到终端）
- [ ] 导出 `db` 实例供各路由使用

**验收**：服务启动后 `data/admin.db` 存在，四张表结构正确。

---

## 阶段 3：认证系统

**文件**：`backend/src/routes/auth.js`、`backend/src/middleware/auth.js`

### 后端
- [ ] `POST /api/auth/login`：验证用户名+密码（bcrypt），签发 JWT（payload: `{ id, username, role }`，7 天有效）
- [ ] `POST /api/auth/register`：验证 invite token 有效且未过期未使用，bcrypt hash 密码，创建 mod，标记 token 已使用
- [ ] `POST /api/auth/invite`（admin）：生成 UUID token，写 `invite_tokens`，返回完整注册链接
- [ ] `GET /api/auth/me`：返回当前用户信息
- [ ] `middleware/auth.js`：验证 JWT，注入 `req.mod`；`requireAdmin` 中间件校验 role

### 前端
- [ ] `LoginPage.jsx`：用户名+密码表单，登录后存 JWT 到 localStorage，跳转主页
- [ ] `RegisterPage.jsx`：从 URL 读取 `?token=`，填写用户名+密码完成注册
- [ ] `axios` 拦截器：自动附加 `Authorization: Bearer <token>`
- [ ] 路由守卫：未登录跳转 `/login`

**验收**：能登录、能用邀请链接注册新账户、未登录访问受保护页面自动跳转。

---

## 阶段 4：B 站直播 WebSocket 接入

**文件**：`backend/src/services/bilibiliLiveWS.js`、`backend/src/services/biliAdmin.js`、`backend/src/routes/danmaku.js`、`backend/src/utils/historyStorage.js`、`backend/src/utils/cookieStorage.js`

- [ ] 从 Unia-Danmuku 复制 `bilibiliLiveWS.js`（连接、心跳、消息解析、JSONL 写入）
- [ ] 从 Unia-Danmuku 复制 `historyStorage.js`（saveMessage、loadHistory、getSessions）
- [ ] 从 Unia-Danmuku 复制 `cookieStorage.js`（读取 cookies.json）
- [ ] `danmaku.js` 路由：`POST /start`、`POST /stop`、`GET /rooms`
- [ ] `createDanmakuWSS(server)`：创建 `/ws/danmaku`，鉴权（WS 握手时验证 JWT query param），广播消息给已连接前端
- [ ] `biliAdmin.js`：封装 `addSilentUser`、`delSilentUser`、`getSilentUserList`（使用 cookies.json 中的 SESSDATA + bili_jct）

**验收**：填入真实房间号后能连接直播间，控制台打印收到的弹幕消息。

---

## 阶段 5：弹幕控制台前端（主界面）

**文件**：`frontend/src/pages/DanmakuPage.jsx`、`DanmakuPage.css`

- [ ] 顶部工具栏：房间号输入、连接/断开按钮、直播状态指示灯、在线人数/点赞数统计
- [ ] **常驻筛选栏**：关键词输入框（防抖 300ms）、消息类型下拉（全部/弹幕/礼物/SC）、清除按钮
  - 筛选逻辑：对已接收消息实时过滤，关键词高亮显示
- [ ] 弹幕列表：
  - 每行：头像（referrerPolicy）、守护等级标识、用户名（可点击）、弹幕内容、时间戳
  - 已禁言用户行显示红色左边框
  - 自动滚动 + 未读消息按钮（同 Unia-Danmuku）
- [ ] WebSocket 连接管理：断线自动重连，连接状态显示
- [ ] 消息分类展示（弹幕/礼物/SC 分列或 Tab，参考 Unia-Danmuku 布局）
- [ ] `UserActionPopup` 占位（阶段 10 完善）

**验收**：实时弹幕正常显示，筛选栏能过滤和高亮，自动滚动正常工作。

---

## 阶段 6：禁言/解禁功能

**文件**：`backend/src/routes/ban.js`

- [ ] `POST /api/ban/silent`：
  - 从 JWT 获取 `mod_id`
  - 调 `biliAdmin.addSilentUser(room_id, tuid, hours, msg, cookies)`
  - 写 `ban_logs`（room_id, mod_id, target_uid, target_name, trigger_content, ban_hours, bilibili_ban_id）
  - 返回 `bilibili_ban_id`
- [ ] `POST /api/ban/unsilent`：
  - 调 `biliAdmin.delSilentUser(room_id, ban_id, cookies)`
  - 在 `ban_logs` 对应记录标记 unsilenced（可选：新增 `unsilenced_at` 字段）
- [ ] `GET /api/ban/list`：调 B 站 `GetSilentUserList`，分页返回当前禁言列表
- [ ] `GET /api/ban/logs`：查 `ban_logs` 表，支持 `mod_id`、`target_uid`、`room_id`、`from`、`to` 筛选，分页

**验收**：能成功禁言/解禁用户，ban_logs 表有正确记录，记录包含发起房管信息。

---

## 阶段 7：禁言日志页

**文件**：`frontend/src/pages/BanLogPage.jsx`

- [ ] 数据表格：时间 | 房管 | 被禁用户（UID+名） | 触发弹幕 | 禁言时长 | 操作
- [ ] 操作列：已解禁显示"已解禁"标签；未解禁显示"解禁"按钮，点击调 `/api/ban/unsilent`
- [ ] 顶部筛选：按房管筛选、按被禁用户 UID/名筛选、时间范围
- [ ] 分页加载

**验收**：禁言记录正确展示，能从日志页解禁用户。

---

## 阶段 8：用户标签/备注

**文件**：`backend/src/routes/tags.js`、前端 `UserActionPopup` 标签区域

- [ ] `GET /api/tags/:uid`：返回该用户所有标签和备注
- [ ] `POST /api/tags/:uid`：新增标签（tag）或备注（note）
- [ ] `DELETE /api/tags/:tagId`：删除标签
- [ ] 前端：悬浮窗中展示标签气泡，支持点击 [+添加] 输入新标签，点击标签右侧 × 删除

**验收**：能为用户添加/删除标签，标签在悬浮窗中正确显示。

---

## 阶段 9：历史搜索与跨场次查询

**文件**：`backend/src/routes/history.js`、`frontend/src/components/HistoryDrawer.jsx`

### 后端
- [ ] `GET /api/history/:roomId/sessions`：返回场次列表（从目录结构读取）
- [ ] `GET /api/history/:roomId/:sessionId`：返回指定场次全量弹幕（loadHistory）
- [ ] `GET /api/history/search`：
  - 参数：`uid`、`keyword`、`roomId`、`from`（时间戳）、`to`
  - 遍历目标房间所有场次的 `danmaku.jsonl`，用 readline 逐行过滤
  - 返回匹配结果（含 sessionId、timestamp、user、content），限制最多 500 条

### 前端
- [ ] `HistoryDrawer.jsx`：侧滑抽屉
  - 顶部：房间选择 + 场次日期范围 + 关键词/UID 输入 + 搜索按钮
  - 结果列表：时间 | 用户名 | 弹幕内容，按时间升序
  - 从 `UserActionPopup` 点击"查看历史弹幕"时预填 UID 打开

**验收**：能跨场次搜索某用户的所有历史弹幕，结果准确。

---

## 阶段 10：UserActionPopup 完整功能整合

**文件**：`frontend/src/components/UserActionPopup.jsx`

整合前面各阶段，实现完整悬浮窗：

- [ ] 用户信息区：头像、用户名+复制、UID+复制、发送时间、守护等级
- [ ] 标签区：展示现有标签、[+添加]、点击 × 删除（调阶段 8 API）
- [ ] 备注区：单行可编辑备注
- [ ] 禁言区：[本场][1h][12h][永久] 四个按钮；若用户在当前禁言列表中则显示[解除禁言]
  - 点击禁言按钮 → 调 `/api/ban/silent` → Toast 通知 → 回调更新弹幕行红色边框
- [ ] 查看历史弹幕：预填 UID，打开 HistoryDrawer
- [ ] 筛选该用户：更新主界面筛选栏
- [ ] 外部链接：B 站空间

**验收**：悬浮窗所有功能闭环，禁言/标签/历史查看全部可用。

---

## 阶段 11：房管管理页

**文件**：`frontend/src/pages/ModsPage.jsx`、`backend/src/routes/mods.js`

### 后端
- [ ] `GET /api/mods`（admin）：返回所有房管账户（id, username, role, created_at, invited_by_name）
- [ ] `DELETE /api/mods/:modId`（admin）：禁用账户（软删除，设 `disabled_at`，需在 `mods` 表增加该字段）
- [ ] `GET /api/mods/invites`（admin）：返回邀请码列表（状态、有效期、使用情况）

### 前端
- [ ] 房管列表表格：用户名 | 角色 | 注册时间 | 邀请人 | 操作（禁用）
- [ ] 生成邀请链接：点击按钮 → 调 `/api/auth/invite` → 显示链接（带复制按钮）→ 可设置有效期（24h/72h/7d）
- [ ] 邀请码历史列表：token（脱敏）| 创建时间 | 有效期 | 状态

**验收**：admin 能生成邀请链接、查看和禁用房管账户。

---

## 阶段 12：收尾

- [ ] 统一错误处理中间件（Express `errorHandler`），前端 axios 拦截器处理 401/403/500
- [ ] WebSocket 断线重连逻辑（指数退避，最多 5 次）
- [ ] 样式打磨：统一 CSS 变量（颜色、字体），复用 Unia-Danmuku 风格
- [ ] 导航栏：弹幕控制台 / 禁言日志 / 房管管理（admin 才显示）+ 当前用户 + 登出
- [ ] README.md 补充：安装、启动、迁移 Unia-Danmuku 数据说明
- [ ] 推送所有提交到 GitHub

**验收**：完整流程可用，错误有友好提示，GitHub 代码最新。

---

## 文件清单（最终）

### 后端核心文件
- `backend/src/server.js`
- `backend/src/db.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/danmaku.js`
- `backend/src/routes/ban.js`
- `backend/src/routes/history.js`
- `backend/src/routes/tags.js`
- `backend/src/routes/mods.js`
- `backend/src/services/bilibiliLiveWS.js`
- `backend/src/services/biliAdmin.js`
- `backend/src/utils/historyStorage.js`
- `backend/src/utils/cookieStorage.js`

### 前端核心文件
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/RegisterPage.jsx`
- `frontend/src/pages/DanmakuPage.jsx` + `DanmakuPage.css`
- `frontend/src/pages/BanLogPage.jsx`
- `frontend/src/pages/ModsPage.jsx`
- `frontend/src/components/UserActionPopup.jsx`
- `frontend/src/components/HistoryDrawer.jsx`
- `frontend/src/services/api.js`
