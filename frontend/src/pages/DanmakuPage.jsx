import { useState, useEffect, useRef, useCallback } from 'react';
import { startDanmaku, stopDanmaku } from '../services/api';
import UserActionPopup from '../components/UserActionPopup';
import HistoryDrawer from '../components/HistoryDrawer';
import './DanmakuPage.css';

let globalIdCounter = 0;
const genId = () => `m-${Date.now()}-${globalIdCounter++}`;

const GUARD_LABELS = { 1: '总督', 2: '提督', 3: '舰长' };
const GUARD_COLORS = { 1: '#f0a500', 2: '#9b59b6', 3: '#3498db' };

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts > 1e10 ? ts : ts * 1000);
  return d.toTimeString().slice(0, 8);
}

function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

export default function DanmakuPage() {
  const [roomId, setRoomId] = useState('');
  const [connected, setConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState(0);
  const [liveStartTime, setLiveStartTime] = useState(0);
  const [liveDuration, setLiveDuration] = useState('00:00:00');
  const [roomInfo, setRoomInfo] = useState(null);
  const [watchedCount, setWatchedCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [rankCount, setRankCount] = useState(0);

  const [danmakuList, setDanmakuList] = useState([]);
  const [scList, setScList] = useState([]);
  const [giftList, setGiftList] = useState([]);

  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterUid, setFilterUid] = useState(null);

  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const [selectedUser, setSelectedUser] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [bannedUids, setBannedUids] = useState(new Set());

  const [historyDrawer, setHistoryDrawer] = useState({ open: false, uid: null });

  const wsRef = useRef(null);
  const listRef = useRef(null);
  const isAutoScrollRef = useRef(true);
  const reconnectRef = useRef(null);
  const reconnectCount = useRef(0);

  // Live duration timer
  useEffect(() => {
    if (!liveStartTime || liveStatus !== 1) return;
    const timer = setInterval(() => {
      setLiveDuration(formatDuration(Math.floor((Date.now() / 1000) - liveStartTime)));
    }, 1000);
    return () => clearInterval(timer);
  }, [liveStartTime, liveStatus]);

  const addMessage = useCallback((msg) => {
    const withId = { ...msg, _id: genId() };
    if (msg.type === 'danmaku' || msg.type === 'divider') {
      setDanmakuList(prev => [...prev.slice(-499), withId]);
      if (!isAutoScrollRef.current) {
        setUnreadCount(c => c + 1);
      }
    } else if (msg.type === 'superchat') {
      setScList(prev => [...prev.slice(-199), withId]);
    } else if (msg.type === 'gift') {
      setGiftList(prev => [...prev.slice(-199), withId]);
    }
  }, []);

  const connectWS = useCallback(() => {
    const token = localStorage.getItem('token');
    const wsUrl = `ws://${location.host}/ws/danmaku?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => { reconnectCount.current = 0; };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'live_status') {
          setLiveStatus(msg.liveStatus);
          if (msg.liveStartTime) setLiveStartTime(msg.liveStartTime);
        } else if (msg.type === 'room_info') {
          setRoomInfo(msg);
        } else if (msg.type === 'watched') {
          setWatchedCount(msg.count || 0);
        } else if (msg.type === 'like') {
          setLikeCount(msg.count || 0);
        } else if (msg.type === 'rank_count') {
          setRankCount(msg.count || 0);
        } else {
          addMessage(msg);
        }
      } catch {}
    };
    ws.onclose = (e) => {
      if (e.code === 4001) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectCount.current++), 30000);
      if (reconnectCount.current <= 5) {
        reconnectRef.current = setTimeout(connectWS, delay);
      }
    };
    ws.onerror = () => {};
  }, [addMessage]);

  useEffect(() => {
    connectWS();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  // Auto-scroll
  useEffect(() => {
    if (!isAutoScrollRef.current || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [danmakuList]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAutoScrollRef.current = atBottom;
    setIsAutoScroll(atBottom);
    if (atBottom) setUnreadCount(0);
  };

  const scrollToBottom = () => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    isAutoScrollRef.current = true;
    setIsAutoScroll(true);
    setUnreadCount(0);
  };

  const handleConnect = async () => {
    if (!roomId.trim()) return;
    try {
      await startDanmaku(roomId.trim());
      setConnected(true);
      setDanmakuList([]);
      setScList([]);
      setGiftList([]);
    } catch (e) {
      alert(e.response?.data?.error || '连接失败');
    }
  };

  const handleDisconnect = async () => {
    await stopDanmaku();
    setConnected(false);
    setLiveStatus(0);
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

  const handleBanSuccess = (uid) => {
    setBannedUids(prev => new Set([...prev, uid]));
  };

  const filterDanmaku = (list) => {
    return list.filter(msg => {
      if (msg.type === 'divider') return true;
      if (filterType !== 'all' && msg.type !== filterType) return false;
      if (filterUid && msg.user?.uid !== filterUid) return false;
      if (filterText) {
        const t = filterText.toLowerCase();
        const inContent = msg.content?.toLowerCase().includes(t);
        const inUser = msg.user?.username?.toLowerCase().includes(t) ||
                       String(msg.user?.uid).includes(t);
        if (!inContent && !inUser) return false;
      }
      return true;
    });
  };

  const highlight = (text) => {
    if (!filterText || !text) return text;
    const idx = text.toLowerCase().indexOf(filterText.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="dm-highlight">{text.slice(idx, idx + filterText.length)}</mark>
        {text.slice(idx + filterText.length)}
      </>
    );
  };

  const filtered = filterDanmaku(danmakuList);

  return (
    <div className="dm-page">
      {/* Top bar */}
      <div className="dm-topbar">
        <div className="dm-room-input">
          <input
            className="dm-input"
            placeholder="直播间房间号"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !connected && handleConnect()}
            disabled={connected}
          />
          {!connected
            ? <button className="dm-btn dm-btn-connect" onClick={handleConnect}>连接</button>
            : <button className="dm-btn dm-btn-disconnect" onClick={handleDisconnect}>断开</button>
          }
          <span className={`dm-status-dot ${liveStatus === 1 ? 'live' : liveStatus === 2 ? 'replay' : ''}`} />
          {liveStatus === 1 && <span className="dm-duration">{liveDuration}</span>}
        </div>

        <div className="dm-stats">
          {roomInfo && <span className="dm-anchor">{roomInfo.anchorName}</span>}
          <span className="dm-stat-item">在线 <b>{watchedCount.toLocaleString()}</b></span>
          <span className="dm-stat-item">点赞 <b>{likeCount.toLocaleString()}</b></span>
          <span className="dm-stat-item">高能 <b>{rankCount.toLocaleString()}</b></span>
          {roomInfo && <span className="dm-stat-item">舰长 <b>{roomInfo.guardCount}</b></span>}
        </div>
      </div>

      {/* Filter bar */}
      <div className="dm-filterbar">
        <input
          className="dm-filter-input"
          placeholder="搜索用户名 / UID / 弹幕内容"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
        />
        <select
          className="dm-filter-select"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="all">全部</option>
          <option value="danmaku">弹幕</option>
          <option value="gift">礼物</option>
          <option value="superchat">SC</option>
          <option value="guard">上舰</option>
        </select>
        {(filterText || filterUid || filterType !== 'all') && (
          <button className="dm-filter-clear" onClick={() => { setFilterText(''); setFilterUid(null); setFilterType('all'); }}>
            清除筛选
          </button>
        )}
        {filterUid && (
          <span className="dm-filter-tag">UID: {filterUid}</span>
        )}
      </div>

      {/* Main area */}
      <div className="dm-main">
        {/* Danmaku list */}
        <div className="dm-col dm-col-danmaku">
          <div className="dm-col-header">弹幕 <span className="dm-col-count">{danmakuList.length}</span></div>
          <div className="dm-list" ref={listRef} onScroll={handleScroll}>
            {filtered.map(msg => {
              if (msg.type === 'divider') {
                return (
                  <div key={msg._id} className="dm-divider">
                    <span>{msg.content}</span>
                  </div>
                );
              }
              const isBanned = bannedUids.has(msg.user?.uid);
              return (
                <div key={msg._id} className={`dm-row ${isBanned ? 'dm-row-banned' : ''}`}>
                  <span className="dm-time">{formatTime(msg.timestamp)}</span>
                  <div
                    className="dm-user"
                    onClick={e => handleUserClick(e, msg.user, msg)}
                  >
                    {msg.user?.face && (
                      <img src={msg.user.face} alt="" className="dm-avatar" referrerPolicy="no-referrer"
                        onError={e => e.target.style.display = 'none'} />
                    )}
                    {msg.user?.guardLevel > 0 && (
                      <span
                        className="dm-guard-badge"
                        style={{ background: GUARD_COLORS[msg.user.guardLevel] }}
                      >
                        {GUARD_LABELS[msg.user.guardLevel]}
                      </span>
                    )}
                    <span className="dm-username">{highlight(msg.user?.username)}</span>
                  </div>
                  <span className="dm-content">{highlight(msg.content)}</span>
                </div>
              );
            })}
          </div>
          {!isAutoScroll && unreadCount > 0 && (
            <button className="dm-new-msg-btn" onClick={scrollToBottom}>
              ↓ {unreadCount} 条新消息
            </button>
          )}
        </div>

        {/* SC list */}
        <div className="dm-col dm-col-sc">
          <div className="dm-col-header">醒目留言 <span className="dm-col-count">{scList.length}</span></div>
          <div className="dm-list">
            {scList.map(msg => (
              <div key={msg._id} className="dm-sc-row">
                <div className="dm-sc-header" style={{ background: `#${msg.backgroundColor || '1a78c2'}` }}>
                  <span className="dm-sc-user">{msg.user?.username}</span>
                  <span className="dm-sc-price">¥{msg.price}</span>
                </div>
                <div className="dm-sc-content">{msg.message}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Gift list */}
        <div className="dm-col dm-col-gift">
          <div className="dm-col-header">礼物 <span className="dm-col-count">{giftList.length}</span></div>
          <div className="dm-list">
            {giftList.map(msg => (
              <div key={msg._id} className="dm-gift-row"
                onClick={e => msg.user && handleUserClick(e, msg.user, msg)}>
                <span className="dm-gift-user">{msg.user?.username}</span>
                <span className="dm-gift-name"> 赠送 {msg.giftName}</span>
                <span className="dm-gift-count"> ×{msg.num}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserActionPopup
          user={selectedUser}
          msg={selectedMsg}
          position={popupPos}
          roomId={roomId}
          onClose={() => setSelectedUser(null)}
          onBanSuccess={handleBanSuccess}
          onFilterUser={(uid) => { setFilterUid(uid); setSelectedUser(null); }}
          onViewHistory={(uid) => { setHistoryDrawer({ open: true, uid }); setSelectedUser(null); }}
        />
      )}

      {historyDrawer.open && (
        <HistoryDrawer
          initUid={historyDrawer.uid}
          roomId={roomId}
          onClose={() => setHistoryDrawer({ open: false, uid: null })}
        />
      )}
    </div>
  );
}
