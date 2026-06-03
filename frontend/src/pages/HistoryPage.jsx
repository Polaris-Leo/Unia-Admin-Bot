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
  const parts = content.split(/(\[[^\]]+\])/);
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
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const [filterText, setFilterText] = useState('');
  const [filterUid, setFilterUid] = useState(null);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchUid, setSearchUid] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [bannedUids, setBannedUids] = useState(new Set());

  const searchInputRef = useRef(null);

  useEffect(() => {
    api.get('/danmaku/rooms').then(r => {
      const id = r.data.roomId || r.data.configured;
      if (id) {
        setRoomId(id);
        loadSessions(id);
        const initUid = location.state?.uid;
        if (initUid) {
          setSearchUid(initUid);
          setSearchMode(true);
          setSearchLoading(true);
          searchHistory({ uid: initUid, roomId: id }).then(res => {
            setSearchResults(res.data);
          }).finally(() => setSearchLoading(false));
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

  const selectSession = async (sessionId) => {
    if (selectedSession === sessionId && !searchMode) return;
    setSelectedSession(sessionId);
    setSearchMode(false);
    setFilterText('');
    setFilterUid(null);
    setSessionData(null);
    setSessionLoading(true);
    try {
      const res = await getHistoryData(roomId, sessionId);
      setSessionData(res.data);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleSearch = async (overrides = {}) => {
    const uid = overrides.uid !== undefined ? overrides.uid : searchUid;
    const keyword = overrides.keyword !== undefined ? overrides.keyword : searchKeyword;
    if (!roomId) return;
    if (!uid && !keyword?.trim()) return;
    setSearchLoading(true);
    setSearchMode(true);
    setSelectedSession(null);
    try {
      const res = await searchHistory({ uid, keyword, roomId });
      setSearchResults(res.data);
    } finally {
      setSearchLoading(false);
    }
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

  const danmakuList = sessionData?.danmaku || [];
  const scList      = sessionData?.superchat || [];
  const giftList    = sessionData?.gift || [];

  const filteredDanmaku = danmakuList.filter(msg => {
    if (msg.type === 'divider') return false;
    if (filterUid && String(msg.user?.uid) !== String(filterUid)) return false;
    if (filterText) {
      const t = filterText.toLowerCase();
      return msg.content?.toLowerCase().includes(t) ||
             msg.user?.username?.toLowerCase().includes(t) ||
             String(msg.user?.uid).includes(t);
    }
    return true;
  });

  const searchLabel = searchUid
    ? (searchKeyword.trim() ? `UID:${searchUid}  "${searchKeyword}"` : `UID:${searchUid}`)
    : `"${searchKeyword}"`;

  return (
    <div className="history-page">
      {/* Left sidebar */}
      <div className="history-sidebar">
        <div className="history-sidebar-header">历史记录</div>
        <div className="history-search-box">
          <input
            ref={searchInputRef}
            className="history-search-input"
            placeholder="跨场次搜索弹幕..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="history-search-btn" onClick={() => handleSearch()} disabled={searchLoading}>
            {searchLoading ? '…' : '搜'}
          </button>
        </div>
        <div className="history-session-list">
          {sessionsLoading && <div className="history-empty">加载中...</div>}
          {!sessionsLoading && sessions.length === 0 && (
            <div className="history-empty">暂无历史记录</div>
          )}
          {sessions.map(s => (
            <div
              key={s}
              className={`history-session-item ${selectedSession === s && !searchMode ? 'active' : ''}`}
              onClick={() => selectSession(s)}
            >
              {formatTs(s)}
            </div>
          ))}
        </div>
      </div>

      {/* Right main area */}
      <div className="history-main">

        {/* Placeholder */}
        {!selectedSession && !searchMode && (
          <div className="history-placeholder">选择左侧场次，或在搜索框搜索历史弹幕</div>
        )}

        {/* Search results */}
        {searchMode && (
          <div className="history-search-results">
            <div className="history-topbar">
              {searchUid && (
                <span className="history-uid-tag">UID: {searchUid}</span>
              )}
              <span className="history-session-label">搜索 {searchLabel}</span>
              <span className="history-stats">{searchResults.length} 条结果</span>
              <button className="history-exit-search" onClick={() => {
                setSearchMode(false);
                setSearchUid(null);
              }}>× 退出搜索</button>
            </div>
            <div className="dm-list history-search-list">
              {searchLoading && <div className="history-empty">搜索中...</div>}
              {!searchLoading && searchResults.length === 0 && (
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

        {/* Session view */}
        {selectedSession && !searchMode && (
          <>
            <div className="history-topbar">
              <span className="history-session-label">{formatTs(selectedSession)}</span>
              {filterUid && (
                <span className="history-uid-tag">
                  UID: {filterUid}
                  <button className="history-uid-clear" onClick={() => setFilterUid(null)}>×</button>
                </span>
              )}
              <input
                className="history-filter-input"
                placeholder="筛选弹幕内容 / 用户名 / UID..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
              />
              {filterText && (
                <button className="dm-filter-clear" onClick={() => setFilterText('')}>×</button>
              )}
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
                    {filterUid && (
                      <span className="history-filter-hint">已筛选用户</span>
                    )}
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
            setFilterUid(uid);
            setSelectedUser(null);
          }}
          onViewHistory={(uid) => {
            setSearchUid(uid);
            setSearchKeyword('');
            setSelectedUser(null);
            handleSearch({ uid, keyword: '' });
          }}
        />
      )}
    </div>
  );
}
