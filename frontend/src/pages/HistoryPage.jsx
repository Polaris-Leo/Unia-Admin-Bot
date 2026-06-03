import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getHistorySessions, getHistoryData, searchHistory } from '../services/api';
import api from '../services/api';
import { isSmallEmote } from '../utils/emoteUtils';
import UserActionPopup from '../components/UserActionPopup';
import './DanmakuPage.css';
import './HistoryPage.css';

const GUARD_LABELS = { 1: '总督', 2: '提督', 3: '舰长' };
const GUARD_COLORS  = { 1: '#f0a500', 2: '#9b59b6', 3: '#3498db' };

const EMPTY_DRAFT = { sessionId: '', startDate: '', endDate: '', username: '', uid: '', keyword: '' };

function formatTs(ts) {
  if (!ts) return '';
  return new Date(ts > 1e10 ? ts : ts * 1000).toLocaleString();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts > 1e10 ? ts : ts * 1000);
  return d.toTimeString().slice(0, 8);
}

function renderContent(content, emots) {
  if (!content) return null;
  if (!emots) return content;
  const parts = content.split(/(\[+[^\]]+\]+)/);
  return parts.map((part, i) => {
    const emot = part.startsWith('[') && part.endsWith(']') ? emots[part] : null;
    if (emot) {
      return (
        <img key={i} src={emot.url} alt={part} title={part}
          className={isSmallEmote(emot.url) ? 'dm-emote' : 'dm-emote dm-emote-big'}
          referrerPolicy="no-referrer" />
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function HistoryPage() {
  const location = useLocation();
  const [roomId, setRoomId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Draft = what user is typing; applied = what was last searched
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [applied, setApplied] = useState(null);

  // Session view data
  const [sessionData, setSessionData] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Cross-session search results
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Session dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // UserActionPopup
  const [selectedUser, setSelectedUser] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [bannedUids, setBannedUids] = useState(new Set());

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    api.get('/danmaku/rooms').then(r => {
      const id = r.data.roomId || r.data.configured;
      if (id) {
        setRoomId(id);
        loadSessions(id);
        const initUid = location.state?.uid;
        if (initUid) {
          const initDraft = { ...EMPTY_DRAFT, uid: String(initUid) };
          setDraft(initDraft);
          runSearch(initDraft, id);
        }
      }
    }).catch(() => {});
  }, []);

  const loadSessions = async (rid) => {
    setSessionsLoading(true);
    try {
      const res = await getHistorySessions(rid);
      setSessions(res.data);
    } finally {
      setSessionsLoading(false);
    }
  };

  const runSearch = async (f, rid) => {
    const resolvedRid = rid ?? roomId;
    if (!resolvedRid) return;
    setApplied(f);

    if (f.sessionId) {
      // Single session mode: load and filter client-side
      setSessionData(null);
      setSessionLoading(true);
      try {
        const res = await getHistoryData(resolvedRid, f.sessionId);
        setSessionData(res.data);
      } finally {
        setSessionLoading(false);
      }
    } else {
      // Cross-session search mode
      setSearchResults([]);
      if (!f.uid && !f.keyword && !f.username) return;
      setSearchLoading(true);
      try {
        const from = f.startDate
          ? Math.floor(new Date(f.startDate + 'T00:00:00').getTime() / 1000) : undefined;
        const to = f.endDate
          ? Math.floor(new Date(f.endDate + 'T23:59:59').getTime() / 1000) : undefined;
        const res = await searchHistory({
          uid: f.uid || undefined,
          keyword: f.keyword || f.username || undefined,
          roomId: resolvedRid,
          from,
          to,
        });
        let results = res.data || [];
        // If both username and keyword provided, additionally filter by username client-side
        if (f.username && f.keyword) {
          const u = f.username.toLowerCase();
          results = results.filter(m => m.user?.username?.toLowerCase().includes(u));
        }
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }
  };

  const handleSearch = () => runSearch(draft);

  const handleReset = () => {
    setDraft(EMPTY_DRAFT);
    setApplied(null);
    setSessionData(null);
    setSearchResults([]);
  };

  const handleUserClick = (e, user, msg) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 6;
    if (x + 280 > window.innerWidth) x = window.innerWidth - 290;
    if (y + 360 > window.innerHeight) y = Math.max(10, rect.top - 360);
    setPopupPos({ x, y });
    setSelectedUser(user);
    setSelectedMsg(msg);
  };

  // Sessions filtered by draft date range (for dropdown display)
  const filteredSessionsForDropdown = sessions.filter(s => {
    const ts = Number(s);
    if (draft.startDate) {
      const start = Math.floor(new Date(draft.startDate + 'T00:00:00').getTime() / 1000);
      if (ts < start) return false;
    }
    if (draft.endDate) {
      const end = Math.floor(new Date(draft.endDate + 'T23:59:59').getTime() / 1000);
      if (ts > end) return false;
    }
    return true;
  });

  // Client-side filtering of session danmaku
  const danmakuList = sessionData?.danmaku || [];
  const scList      = sessionData?.superchat || [];
  const giftList    = sessionData?.gift || [];

  const filteredDanmaku = danmakuList.filter(msg => {
    if (msg.type === 'divider') return false;
    if (!applied) return true;
    if (applied.uid && String(msg.user?.uid) !== String(applied.uid)) return false;
    if (applied.username) {
      if (!msg.user?.username?.toLowerCase().includes(applied.username.toLowerCase())) return false;
    }
    if (applied.keyword) {
      const t = applied.keyword.toLowerCase();
      if (!msg.content?.toLowerCase().includes(t) && !msg.user?.username?.toLowerCase().includes(t)) return false;
    }
    if (applied.startDate) {
      const start = new Date(applied.startDate + 'T00:00:00').getTime() / 1000;
      if ((msg.timestamp || 0) < start) return false;
    }
    if (applied.endDate) {
      const end = new Date(applied.endDate + 'T23:59:59').getTime() / 1000;
      if ((msg.timestamp || 0) > end) return false;
    }
    return true;
  });

  const mode = applied === null ? 'placeholder'
    : applied.sessionId ? 'session'
    : 'search';

  const crossSearchNeedsInput = mode === 'search' && !applied.uid && !applied.keyword && !applied.username;

  return (
    <div className="history-page">

      {/* ── Left sidebar: Filter panel ── */}
      <div className="history-sidebar">
        <div className="history-sidebar-header">筛选</div>

        <div className="hf-body">

          {/* 场次 */}
          <div className="hf-group">
            <div className="hf-label">场次</div>
            <div className="hf-session-dropdown" ref={dropdownRef}>
              <div
                className={`hf-dropdown-trigger ${isDropdownOpen ? 'active' : ''}`}
                onClick={() => setIsDropdownOpen(v => !v)}
              >
                <span>{draft.sessionId ? formatTs(draft.sessionId) : '全部场次'}</span>
                <svg className="hf-dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {isDropdownOpen && (
                <div className="hf-dropdown-options">
                  <div
                    className={`hf-dropdown-option ${!draft.sessionId ? 'selected' : ''}`}
                    onClick={() => { setDraft(d => ({ ...d, sessionId: '' })); setIsDropdownOpen(false); }}
                  >
                    全部场次
                  </div>
                  {sessionsLoading && (
                    <div className="hf-dropdown-option disabled">加载中...</div>
                  )}
                  {!sessionsLoading && filteredSessionsForDropdown.map(s => (
                    <div
                      key={s}
                      className={`hf-dropdown-option ${draft.sessionId === String(s) ? 'selected' : ''}`}
                      onClick={() => { setDraft(d => ({ ...d, sessionId: String(s) })); setIsDropdownOpen(false); }}
                    >
                      {formatTs(s)}
                    </div>
                  ))}
                  {!sessionsLoading && filteredSessionsForDropdown.length === 0 && (
                    <div className="hf-dropdown-option disabled">无符合条件的场次</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 日期范围 */}
          <div className="hf-group">
            <div className="hf-label">日期范围</div>
            <input
              type="date"
              className="hf-input"
              value={draft.startDate}
              onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))}
            />
            <div className="hf-date-sep">至</div>
            <input
              type="date"
              className="hf-input"
              value={draft.endDate}
              onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))}
            />
          </div>

          {/* 用户名 */}
          <div className="hf-group">
            <div className="hf-label">用户名</div>
            <input
              className="hf-input"
              placeholder="输入用户名"
              value={draft.username}
              onChange={e => setDraft(d => ({ ...d, username: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* UID */}
          <div className="hf-group">
            <div className="hf-label">UID</div>
            <input
              className="hf-input"
              placeholder="输入 UID"
              value={draft.uid}
              onChange={e => setDraft(d => ({ ...d, uid: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* 弹幕内容 */}
          <div className="hf-group">
            <div className="hf-label">弹幕内容</div>
            <input
              className="hf-input"
              placeholder="关键词"
              value={draft.keyword}
              onChange={e => setDraft(d => ({ ...d, keyword: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Buttons */}
          <div className="hf-actions">
            <button className="hf-btn-reset" onClick={handleReset}>重置</button>
            <button className="hf-btn-search" onClick={handleSearch}>查询</button>
          </div>

        </div>
      </div>

      {/* ── Right main area ── */}
      <div className="history-main">

        {/* Placeholder */}
        {mode === 'placeholder' && (
          <div className="history-placeholder">设置筛选条件后点击查询</div>
        )}

        {/* Single session view */}
        {mode === 'session' && (
          <>
            <div className="history-topbar">
              <span className="history-session-label">{formatTs(applied.sessionId)}</span>
              <span className="history-stats">
                弹幕 {danmakuList.filter(m => m.type !== 'divider').length}
                {scList.length > 0 && `  SC ${scList.length}`}
                {giftList.length > 0 && `  礼物 ${giftList.length}`}
              </span>
            </div>

            {sessionLoading && <div className="history-loading">加载中...</div>}

            {!sessionLoading && (
              <div className="dm-main">
                {/* Danmaku column */}
                <div className="dm-col dm-col-danmaku">
                  <div className="dm-col-header">
                    弹幕
                    <span className="dm-col-count">{filteredDanmaku.length}</span>
                  </div>
                  <div className="dm-list">
                    {filteredDanmaku.length === 0 && (
                      <div className="history-empty">无弹幕</div>
                    )}
                    {filteredDanmaku.map((msg, i) => {
                      const isBanned = bannedUids.has(msg.user?.uid);
                      return (
                        <div key={i} className={`dm-row ${isBanned ? 'dm-row-banned' : ''}`}>
                          <span className="dm-time">{formatTime(msg.timestamp)}</span>
                          <div className="dm-user" onClick={e => handleUserClick(e, msg.user, msg)}>
                            {msg.user?.face && (
                              <img src={msg.user.face} alt="" className="dm-avatar" referrerPolicy="no-referrer"
                                onError={e => e.target.style.display = 'none'} />
                            )}
                            {msg.user?.guardLevel > 0 && (
                              <span className="dm-guard-badge"
                                style={{ background: GUARD_COLORS[msg.user.guardLevel] }}>
                                {GUARD_LABELS[msg.user.guardLevel]}
                              </span>
                            )}
                            <span className="dm-username">{msg.user?.username}</span>
                          </div>
                          <span className="dm-content">
                            {renderContent(msg.content, msg.emots)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SC column */}
                <div className="dm-col dm-col-sc">
                  <div className="dm-col-header">
                    醒目留言 <span className="dm-col-count">{scList.length}</span>
                  </div>
                  <div className="dm-list">
                    {scList.length === 0 && <div className="history-empty">无 SC</div>}
                    {scList.map((msg, i) => (
                      <div key={i} className="dm-sc-row">
                        <div className="dm-sc-header"
                          style={{ background: `#${msg.backgroundColor || '1a78c2'}` }}>
                          <span className="dm-sc-user">{msg.user?.username}</span>
                          <span className="dm-sc-price">¥{msg.price}</span>
                        </div>
                        <div className="dm-sc-content">{msg.message}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gift column */}
                <div className="dm-col dm-col-gift">
                  <div className="dm-col-header">
                    礼物 <span className="dm-col-count">{giftList.length}</span>
                  </div>
                  <div className="dm-list">
                    {giftList.length === 0 && <div className="history-empty">无礼物</div>}
                    {giftList.map((msg, i) => (
                      <div key={i} className="dm-gift-row"
                        onClick={e => msg.user && handleUserClick(e, msg.user, msg)}>
                        <span className="dm-gift-user">{msg.user?.username}</span>
                        <span className="dm-gift-name"> 赠送 {msg.giftName}</span>
                        <span className="dm-gift-count"> ×{msg.num}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Cross-session search results */}
        {mode === 'search' && (
          <div className="history-search-results">
            <div className="history-topbar">
              <span className="history-session-label">跨场次搜索</span>
              {applied.uid && <span className="history-uid-tag">UID: {applied.uid}</span>}
              <span className="history-stats">
                {searchLoading ? '搜索中...' : crossSearchNeedsInput ? '' : `${searchResults.length} 条结果`}
              </span>
            </div>
            <div className="dm-list history-search-list">
              {searchLoading && <div className="history-empty">搜索中...</div>}
              {!searchLoading && crossSearchNeedsInput && (
                <div className="history-empty">跨场次搜索需要填写 UID、用户名或弹幕关键词</div>
              )}
              {!searchLoading && !crossSearchNeedsInput && searchResults.length === 0 && (
                <div className="history-empty">无结果</div>
              )}
              {searchResults.map((msg, i) => (
                <div key={i} className="dm-row">
                  <span className="dm-time">{formatTime(msg.timestamp)}</span>
                  <div className="dm-user" onClick={e => handleUserClick(e, msg.user, msg)}>
                    {msg.user?.face && (
                      <img src={msg.user.face} alt="" className="dm-avatar" referrerPolicy="no-referrer"
                        onError={e => e.target.style.display = 'none'} />
                    )}
                    <span className="dm-username">{msg.user?.username}</span>
                  </div>
                  <span className="dm-content">{renderContent(msg.content, msg.emots)}</span>
                  <span className="history-session-tag">{formatTs(msg.sessionId)}</span>
                </div>
              ))}
              {searchResults.length >= 500 && (
                <div className="history-empty">已显示最多 500 条结果</div>
              )}
            </div>
          </div>
        )}

      </div>

      {selectedUser && (
        <UserActionPopup
          user={selectedUser}
          msg={selectedMsg}
          position={popupPos}
          roomId={roomId}
          onClose={() => { setSelectedUser(null); setSelectedMsg(null); }}
          onBanSuccess={(uid) => setBannedUids(prev => new Set([...prev, uid]))}
          onFilterUser={(uid) => {
            const newDraft = { ...draft, uid: String(uid) };
            setDraft(newDraft);
            setSelectedUser(null);
            runSearch(newDraft);
          }}
          onViewHistory={(uid) => {
            const newDraft = { ...EMPTY_DRAFT, uid: String(uid) };
            setDraft(newDraft);
            setSelectedUser(null);
            runSearch(newDraft);
          }}
        />
      )}
    </div>
  );
}
