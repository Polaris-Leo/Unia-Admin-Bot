import { useState, useEffect } from 'react';
import { searchHistory, getHistorySessions } from '../services/api';
import './HistoryDrawer.css';

function formatTs(ts) {
  if (!ts) return '';
  return new Date(ts > 1e10 ? ts : ts * 1000).toLocaleString();
}

export default function HistoryDrawer({ initUid, roomId, onClose }) {
  const [uid, setUid] = useState(initUid || '');
  const [keyword, setKeyword] = useState('');
  const [searchRoomId, setSearchRoomId] = useState(roomId || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initUid && roomId) {
      handleSearch({ uid: initUid, roomId });
    }
  }, []);

  const handleSearch = async (overrides = {}) => {
    const params = {
      uid: overrides.uid !== undefined ? overrides.uid : uid,
      keyword,
      roomId: overrides.roomId !== undefined ? overrides.roomId : searchRoomId,
    };
    if (!params.roomId) return;
    setLoading(true);
    try {
      const res = await searchHistory(params);
      setResults(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">历史弹幕搜索</span>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>

        <div className="drawer-filters">
          <div className="drawer-filter-row">
            <input
              className="drawer-input"
              placeholder="房间号"
              value={searchRoomId}
              onChange={e => setSearchRoomId(e.target.value)}
            />
            <input
              className="drawer-input"
              placeholder="UID（可选）"
              value={uid}
              onChange={e => setUid(e.target.value)}
            />
          </div>
          <div className="drawer-filter-row">
            <input
              className="drawer-input drawer-input-wide"
              placeholder="关键词（内容/用户名）"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button className="drawer-search-btn" onClick={() => handleSearch()} disabled={loading}>
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>

        <div className="drawer-results">
          {results.length === 0 && !loading && (
            <div className="drawer-empty">无结果</div>
          )}
          {results.map((msg, i) => (
            <div key={i} className="drawer-row">
              <span className="drawer-row-time">{formatTs(msg.timestamp)}</span>
              <span className="drawer-row-user">{msg.user?.username}</span>
              <span className="drawer-row-content">{msg.content}</span>
            </div>
          ))}
          {results.length >= 500 && (
            <div className="drawer-limit">已显示最多 500 条结果</div>
          )}
        </div>
      </div>
    </div>
  );
}
