# Unia-Admin-Bot 设计文档

**日期**: 2026-06-02  
**项目**: Unia-Admin-Bot — B 站直播房管工具

---

## 1. 项目概述

独立 Web 应用（React + Vite 前端，Node.js + Express 后端），专为 B 站直播房管设计。
提供实时弹幕控制台、用户禁言管理、跨场次历史搜索、多房管账户系统和禁言审计日志。

弹幕数据存储格式与 Unia-Danmuku 完全兼容（JSONL），历史数据可无损迁移。

---

## 2. 整体架构

### 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React + Vite，样式参考 Unia-Danmuku |
| 后端 | Node.js + Express |
| 实时通信 | WebSocket (`/ws/danmaku`) |
| 运营数据 | SQLite（`backend/data/admin.db`）|
| 弹幕数据 | JSONL（与 Unia-Danmuku 格式完全一致）|
| B 站认证 | 共享 `cookies.json`（单个 B 站账户）|

### 目录结构

```
Unia-Admin-Bot/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── db.js                  # SQLite 初始化 & schema 迁移
│   │   ├── routes/
│   │   │   ├── auth.js            # 登录、注册、邀请码
│   │   │   ├── danmaku.js         # 连接/断开直播间、WS 创建
│   │   │   ├── ban.js             # 禁言、解禁、日志查询
│   │   │   ├── history.js         # 历史场次/弹幕查询、跨场次搜索
│   │   │   ├── tags.js            # 用户标签/备注 CRUD
│   │   │   └── mods.js            # 房管管理（admin 专属）
│   │   ├── services/
│   │   │   ├── bilibiliLiveWS.js  # B 站直播 WebSocket（复用 Unia-Danmuku 逻辑）
│   │   │   └── biliAdmin.js       # 禁言/解禁 B 站 API 封装
│   │   └── utils/
│   │       ├── historyStorage.js  # JSONL 读写（同 Unia-Danmuku 格式）
│   │       └── cookieStorage.js   # 共享 B 站 Cookie 读取
│   └── data/
│       ├── admin.db               # SQLite
│       ├── cookies.json           # 共享 B 站 Cookie
│       └── history/
│           └── <roomId>/
│               └── <sessionId>/
│                   ├── danmaku.jsonl
│                   ├── gift.jsonl
│                   ├── guard.jsonl
│                   └── superchat.jsonl
└── frontend/
    └── src/
        ├── pages/
        │   ├── DanmakuPage.jsx    # 弹幕控制台（主界面）
        │   ├── HistoryPage.jsx    # 历史记录（独立页）
        │   ├── BanLogPage.jsx     # 禁言日志
        │   └── ModsPage.jsx       # 房管管理（admin 专属）
        ├── components/
        │   ├── NavBar.jsx         # 导航栏（含用户下拉菜单）
        │   └── UserActionPopup.jsx
        ├── utils/
        │   └── emoteUtils.js      # 表情大小白名单判断
        └── services/
            └── api.js
```

---

## 3. 数据模型

### 存储分工

| 数据类型 | 存储方式 |
|----------|----------|
| 弹幕、礼物、SC、上舰 | JSONL（Unia-Danmuku 兼容格式）|
| 房管账户、角色 | SQLite `mods` |
| 邀请码 | SQLite `invite_tokens` |
| 禁言操作日志 | SQLite `ban_logs` |
| 用户标签/备注 | SQLite `user_tags` |

### SQLite Schema

```sql
-- 房管账户
CREATE TABLE mods (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT    NOT NULL UNIQUE,
  password_hash TEXT   NOT NULL,
  role         TEXT    NOT NULL DEFAULT 'mod', -- 'admin' | 'mod'
  created_at   INTEGER NOT NULL,
  invited_by   INTEGER REFERENCES mods(id)
);

-- 邀请码
CREATE TABLE invite_tokens (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token        TEXT    NOT NULL UNIQUE,  -- UUID
  created_by   INTEGER NOT NULL REFERENCES mods(id),
  expires_at   INTEGER NOT NULL,         -- Unix 时间戳
  used_by      INTEGER REFERENCES mods(id),
  used_at      INTEGER
);

-- 禁言操作日志
CREATE TABLE ban_logs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id          TEXT    NOT NULL,
  mod_id           INTEGER NOT NULL REFERENCES mods(id),
  target_uid       INTEGER NOT NULL,
  target_name      TEXT    NOT NULL,
  trigger_content  TEXT,                 -- 触发禁言的弹幕原文
  ban_hours        INTEGER NOT NULL,     -- -1=永久, 0=本场, 正整数=小时数
  bilibili_ban_id  INTEGER,              -- B 站返回的记录 ID，用于解禁
  created_at       INTEGER NOT NULL
);

-- 用户标签/备注（每行一个标签，同一用户可有多行）
CREATE TABLE user_tags (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_uid   INTEGER NOT NULL,
  target_name  TEXT    NOT NULL,
  tag          TEXT,                     -- 短标签，如"喷子"
  note         TEXT,                     -- 长备注
  created_by   INTEGER NOT NULL REFERENCES mods(id),
  created_at   INTEGER NOT NULL
);
```

### JSONL 弹幕格式（与 Unia-Danmuku 一致）

```json
{
  "type": "danmaku",
  "user": {
    "uid": 12345678,
    "username": "用户名",
    "isAdmin": false,
    "guardLevel": 0,
    "face": "https://..."
  },
  "content": "弹幕内容",
  "timestamp": 1717200000,
  "medal": { "level": 12, "name": "粉丝团", "upName": "主播名", "roomId": 123456 },
  "emots": null
}
```

---

## 4. 后端 API

### 认证 `/api/auth`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST  | `/login`    | 用户名+密码 → JWT | 公开 |
| POST  | `/register` | token+用户名+密码 → 创建账户，邀请码失效 | 公开 |
| POST  | `/invite`   | 生成邀请码，返回注册链接 | admin |
| GET   | `/me`       | 当前登录用户信息 | 已登录 |
| PATCH | `/me`       | 修改自身用户名/密码 | 已登录 |

### 弹幕 `/api/danmaku`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/start`       | 连接指定直播间 |
| POST | `/stop`        | 断开连接 |
| GET  | `/rooms`       | 当前连接状态 |
| GET  | `/recent`      | 当前场次最近 100 条弹幕 + 全部 SC/礼物（页面初始加载用）|
| WS   | `/ws/danmaku`  | 实时消息推送 |

### 禁言 `/api/ban`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/silent` | 禁言用户，写 ban_logs |
| POST | `/unsilent` | 解除禁言 |
| GET  | `/list` | 获取当前禁言列表（来自 B 站 API）|
| GET  | `/logs` | 查询 ban_logs，支持分页+筛选 |

### 历史 `/api/history`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/:roomId/sessions` | 场次列表 |
| GET | `/:roomId/:sessionId` | 指定场次全量弹幕 |
| GET | `/search` | 跨场次搜索（参数: uid, keyword, roomId, from, to）|

### 标签 `/api/tags`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/:uid` | 获取用户所有标签和备注 |
| POST   | `/:uid` | 新增标签/备注 |
| DELETE | `/:tagId` | 删除标签 |

### 房管管理 `/api/mods`（admin 专属）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/` | 房管列表 |
| DELETE | `/:modId` | 禁用账户 |

---

## 5. 前端页面

### DanmakuPage（主界面）

- **顶部工具栏**：房间号输入、连接/断开、直播状态、统计数字
- **常驻筛选栏**：关键词搜索框（用户名/UID/内容）+ 类型筛选 + 清除，实时高亮匹配项
- **弹幕列表**：头像、用户名（守护等级标识）、弹幕内容、时间戳；已禁言用户行显示红色左边框
- **点击用户名** → `UserActionPopup`

### UserActionPopup

```
┌─────────────────────────────┐
│ [头像]  用户名  [复制]        │
│         UID: 12345678  [复制] │
│         发送时间              │
├─────────────────────────────┤
│ 标签: [喷子] [常客] [+添加]   │
│ 备注: 点击编辑...             │
├─────────────────────────────┤
│ 禁言  [本场][1h][12h][永久]   │
│ ✓ 解除禁言  (已禁时显示)      │
├─────────────────────────────┤
│ 查看该用户历史弹幕 →          │
│ 筛选该用户                   │
│ 跳转 B站空间...              │
└─────────────────────────────┘
```

点击禁言时长 → 调 API → Toast 通知 → 弹幕行标红。

### HistoryPage（`/history`）

独立历史记录页。左侧 220px 场次列表 + 跨场次搜索框；右侧与 DanmakuPage 完全相同的三列布局（弹幕/SC/礼物），支持内容/用户名/UID 过滤。点击用户名可触发 UserActionPopup，"查看历史弹幕"按钮可按 UID 自动触发搜索。

### BanLogPage

表格：时间 | 房管 | 被禁用户 | 触发弹幕 | 禁言时长 | 解禁按钮。支持按房管/用户/时间筛选，分页。

### ModsPage（admin 专属）

房管列表 + 生成邀请链接 + 邀请码状态管理。

---

## 6. 关键数据流

### 禁言操作

```
房管点击 [禁言 1h]
  → POST /api/ban/silent { room_id, uid, username, content, hours: 1 }
  → 后端读取 cookies.json（SESSDATA + bili_jct）
  → 调 B站 AddSilentUser API
  → 写 ban_logs（room_id, mod_id, target_uid, trigger_content, ban_hours, bilibili_ban_id）
  → 返回 200
  → 前端 Toast "已禁言 1 小时" + 弹幕行红色边框
```

### 邀请注册流程

```
admin 点击「生成邀请链接」
  → POST /api/auth/invite { expires_hours: 24 }
  → 后端生成 UUID token，写 invite_tokens
  → 返回链接 /register?token=<uuid>

新房管访问链接 → 填写用户名+密码
  → POST /api/auth/register { token, username, password }
  → 验证 token 有效且未使用
  → 创建 mods 记录，标记 token 已使用
```

### 跨场次搜索

```
搜索请求 GET /api/history/search?uid=12345&roomId=123456
  → 遍历 data/history/123456/ 下所有场次目录
  → readline 逐行读取 danmaku.jsonl
  → 按 uid 或 keyword 过滤
  → 聚合排序后返回
```

---

## 7. 安全说明

- 所有受保护路由验证 JWT（中间件统一处理）
- admin 专属路由额外校验 `role === 'admin'`
- B 站 Cookie 仅在后端使用，不暴露给前端
- 禁言操作必须携带有效 JWT，mod_id 从 token 中提取（不信任前端传入）
- 邀请码一次性，过期自动失效

---

## 8. 与 Unia-Danmuku 的数据兼容性

- `historyStorage.js` 读写格式与 Unia-Danmuku 完全一致
- 迁移方式：直接将 Unia-Danmuku 的 `backend/data/history/` 目录复制到本项目相同路径
- 共享 Cookie：将 Unia-Danmuku 的 `backend/data/cookies.json` 复制到本项目即可使用同一 B 站账户
