import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, remove, onDisconnect, get, off, increment } from 'firebase/database';
import { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';
import html2canvas from 'html2canvas';
import './membership.css';

// BOSS 定義 (v2.1 擴展版)
const BOSSES = {
  croco: { name: "沼澤巨鱷", time: 105, area: "維多利亞島", color: "#2e7d32" },
  doll: { name: "仙人娃娃", time: 178, area: "桃花仙境", color: "#f48fb1" },
  bear: { name: "肯得熊", time: 128, area: "桃花仙境", color: "#795548" },
  cat: { name: "喵怪仙人", time: 247, area: "桃花仙境", color: "#9c27b0" },
  deer: { name: "艾利傑", time: 120, area: "天空之城", color: "#0288d1" },
  snaky: { name: "雪毛怪人", time: 153, area: "冰原雪域", color: "#b3e5fc" },
  rich: { name: "胖老朽", time: 144, area: "瑪迦提亞城", color: "#fbc02d" },
  chimera: { name: "奇美拉", time: 153, area: "瑪迦提亞城", color: "#607d8b" },
  leviathan: { name: "利維坦", time: 216, area: "神木村", color: "#3f51b5" },
  dragon: { name: "九層龍", time: 216, area: "神木村", color: "#8d6e63" },
  dodo: { name: "多多", time: 135, area: "時間神殿", color: "#673ab7" },
  lily: { name: "莉利里諾斯", time: 135, area: "時間神殿", color: "#e91e63" },
  lyca: { name: "萊伊卡", time: 135, area: "時間神殿", color: "#f44336" }
};

// 100 階勳銜系統
const TIERS = [
  { name: "初心者", start: 0, step: 10, icon: "🌱", hue: 120 },
  { name: "冒險家", start: 100, step: 20, icon: "🧭", hue: 200 },
  { name: "精銳成員", start: 300, step: 40, icon: "⚔️", hue: 180 },
  { name: "資深勇者", start: 700, step: 60, icon: "🛡️", hue: 210 },
  { name: "公會將軍", start: 1300, step: 100, icon: "🛡️", hue: 45 },
  { name: "超凡精銳", start: 2300, step: 200, icon: "🔥", hue: 15 },
  { name: "榮耀騎士", start: 4300, step: 300, icon: "🥈", hue: 210 },
  { name: "聖域護衛", start: 7300, step: 400, icon: "🥇", hue: 45 },
  { name: "楓葉之子", start: 11300, step: 600, icon: "🍁", hue: 340 },
  { name: "虛空至尊", start: 17300, step: 1000, icon: "🌌", hue: 280 }
];

const calculateUserRank = (totalKills = 0) => {
  let tierIndex = TIERS.findIndex((t, idx) => {
    const nextTier = TIERS[idx + 1];
    return totalKills >= t.start && (!nextTier || totalKills < nextTier.start);
  });
  if (tierIndex === -1) tierIndex = TIERS.length - 1;
  const tier = TIERS[tierIndex];
  const innerProgress = totalKills - tier.start;
  const subRank = Math.min(10, Math.floor(innerProgress / tier.step) + 1);
  const subRankLabel = "★".repeat(subRank);
  return { title: `[${tier.name}] ${subRankLabel}`, color: `hsl(${tier.hue}, 70%, 65%)`, badge: tier.icon };
};

// 持續時間格式化 (HH:mm:ss)
const formatDuration = (ms) => {
  if (!ms || ms < 0) return "00:00:00";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

function App() {
  const [rooms, setRooms] = useState({});
  const [roomSummaries, setRoomSummaries] = useState({});
  const [userName, setUserName] = useState(localStorage.getItem('artale_user_name') || '');
  const [lobbyBossFilter, setLobbyBossFilter] = useState('croco'); 
  const [currentRoomId, setCurrentRoomId] = useState(() => {
    return window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('room') || localStorage.getItem('pikapi_room_id') || null;
  });
  const [view, setView] = useState('lobby'); 
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [syncSpin, setSyncSpin] = useState(false);
  const [lastSyncTs, setLastSyncTs] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshLobbyData = async () => {
    setSyncSpin(true);
    try {
      const snap = await get(ref(db, 'roomSummaries'));
      const data = snap.exists() ? snap.val() : {};
      setRoomSummaries(data);
      setLastSyncTs(Date.now());
    } catch (err) { console.error(err); }
    finally { setTimeout(() => setSyncSpin(false), 500); }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        onValue(ref(db, `users/${user.uid}`), (s) => {
          const p = s.val() || {};
          setCurrentUser({ ...user, profile: p });
          if (p.isAdmin) setIsAdmin(true);
        });
      } else { setCurrentUser(null); setIsAdmin(false); }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentRoomId || view !== 'room') return;
    const unsub = onValue(ref(db, `rooms/${currentRoomId}`), (s) => {
      const d = s.val();
      if (!d) { backToLobby(); return; }
      setRooms(prev => ({ ...prev, [currentRoomId]: d }));
    });
    const heartRef = ref(db, `rooms/${currentRoomId}/members/${currentUser.uid}/isOnline`);
    set(heartRef, true);
    onDisconnect(heartRef).set(false);
    return () => unsub();
  }, [currentRoomId, view]);

  useEffect(() => { if (view === 'lobby') refreshLobbyData(); }, [view]);

  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());
  const handleLogout = () => { signOut(auth); backToLobby(); };

  const createRoom = () => {
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const conductor = userName || currentUser.displayName || "冒險家";
    const newRoom = {
      id, bossId: lobbyBossFilter, password: Math.random().toString(36).substr(2, 4),
      conductor, conductorUid: currentUser.uid,
      members: { [currentUser.uid]: { name: conductor, photoURL: currentUser.photoURL || '🐶', isOnline: true, joinedAt: Date.now() } },
      records: {}, totalKills: 0, createdAt: Date.now()
    };
    const summary = { id, bossId: lobbyBossFilter, conductor, totalKills: 0, onlineCount: 1, createdAt: Date.now(), isValuable: false };
    const updates = {};
    updates[`rooms/${id}`] = newRoom;
    updates[`roomSummaries/${id}`] = summary;
    update(ref(db), updates).then(() => { setCurrentRoomId(id); setView('room'); window.history.pushState({}, '', `#${id}`); });
  };

  const joinRoom = () => {
    get(ref(db, `rooms/${currentRoomId}`)).then((s) => {
      const r = s.val();
      if (!r || r.password !== passwordInput) return alert("密碼錯誤");
      const updates = {};
      updates[`rooms/${currentRoomId}/members/${currentUser.uid}`] = { name: userName || currentUser.displayName, photoURL: currentUser.photoURL || '🐶', isOnline: true, joinedAt: Date.now() };
      updates[`roomSummaries/${currentRoomId}/onlineCount`] = increment(1);
      update(ref(db), updates).then(() => { setView('room'); window.history.pushState({}, '', `#${currentRoomId}`); });
    });
  };

  const backToLobby = () => { setView('lobby'); setCurrentRoomId(null); window.history.pushState({}, '', window.location.pathname); };
  const addRecord = (ch) => {
    const r = rooms[currentRoomId];
    const nK = (r.totalKills || 0) + 1;
    const updates = {};
    updates[`rooms/${currentRoomId}/records/${ch}`] = { ts: Date.now(), reporter: userName || "冒險家", photoURL: currentUser.photoURL || '🐶', ready: false };
    updates[`rooms/${currentRoomId}/totalKills`] = nK;
    updates[`roomSummaries/${currentRoomId}/totalKills`] = nK;
    updates[`roomSummaries/${currentRoomId}/isValuable`] = true;
    update(ref(db), updates);
  };
  const markAsReady = (ch) => update(ref(db, `rooms/${currentRoomId}/records/${ch}`), { ready: true, readyAt: Date.now() });

  const currentRoom = rooms[currentRoomId];
  const rank = calculateUserRank(currentUser?.profile?.totalKills || 0);

  return (
    <div className="app-wrapper">
      <header className="global-header">
        <div className="header-logo" onClick={backToLobby}>⚡ PiKaPi <span className="boss-highlight">BOSS Tracker</span></div>
        <div className="header-actions">
          <div className="sub-nav-btns">
            <button className={`admin-tab ${view === 'lobby' ? 'active' : ''}`} onClick={() => setView('lobby')}>🛡️ 指揮部</button>
            <button className={`admin-tab ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>🎖️ 勳章圖鑑</button>
            {isAdmin && <button className="admin-entry-btn">🏆 戰績排行</button>}
          </div>
          <div className="sync-area">
            <button className={`sync-btn ${syncSpin ? 'spinning' : ''}`} onClick={refreshLobbyData}>🔄 更新</button>
          </div>
          {currentUser && (
            <div className="user-profile-mini">
              <span className="v16-badge-name">Hi, {userName || currentUser.displayName}</span>
              <img src={currentUser.photoURL || '🐶'} className="header-avatar" onClick={() => setView('profile')} alt="avatar" />
              <button className="logout-btn" onClick={handleLogout}>登出</button>
            </div>
          )}
        </div>
      </header>

      <div className="main-content-area">
        {view === 'lobby' && (
          <div className="lobby-view fade-in" style={{ width: '95%', maxWidth: '1400px' }}>
            {/* Build v2.1 Banner */}
            <div className="glass-panel" style={{ padding: '35px', borderRadius: '24px', textAlign: 'center', marginBottom: '30px', border: '1.5px solid var(--gold-glow)' }}>
              <span className="box-label" style={{ fontSize: '0.9rem', opacity: 0.7 }}>Build v2.1 - 指揮中心已上線</span>
              <h1 className="boss-highlight" style={{ fontSize: '3rem', margin: '15px 0', textShadow: '0 0 25px rgba(255, 215, 0, 0.5)' }}>PiKaPi 公會和諧打王趣</h1>
              <p style={{ letterSpacing: '2px', opacity: 0.8 }}>專業野王紀錄管理系統</p>
            </div>

            {/* Boss Filter Bar */}
            <div className="glass-panel" style={{ padding: '20px 30px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span className="v16-badge-name">選擇野王：</span>
                <select className="v16-ch-input" value={lobbyBossFilter} onChange={(e) => setLobbyBossFilter(e.target.value)} style={{ width: '250px', padding: '10px' }}>
                  {Object.entries(BOSSES).map(([id, b]) => <option key={id} value={id}>{b.name}</option>)}
                </select>
              </div>
              <button className="btn-primary" style={{ padding: '15px 35px' }} onClick={createRoom}>創建打王房間</button>
            </div>

            {/* Room List Table */}
            <h3 className="drawer-label" style={{ marginBottom: '15px' }}>房間列表 - {BOSSES[lobbyBossFilter]?.name}</h3>
            <div className="admin-table-wrapper" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>房號</th>
                    <th>車長</th>
                    <th>人數</th>
                    <th>持續時間</th>
                    <th>狀態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(roomSummaries).filter(r => r.bossId === lobbyBossFilter).map(r => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--gold)', fontWeight: 950 }}>{r.id}</td>
                      <td>{r.conductor}</td>
                      <td>{r.onlineCount}/4</td>
                      <td>{formatDuration(now - r.createdAt)}</td>
                      <td><span className="battle-active-tag">熱烈打王中...</span></td>
                      <td><button className="btn-primary" style={{ padding: '6px 18px', fontSize: '0.8rem', background: 'var(--gold)' }} onClick={() => { setCurrentRoomId(r.id); setView('join'); }}>加入房間</button></td>
                    </tr>
                  ))}
                  {Object.values(roomSummaries).filter(r => r.bossId === lobbyBossFilter).length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>目前沒有該 BOSS 的王團</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'join' && (
          <div className="join-container fade-in">
             <div className="glass-panel" style={{ padding: '40px', borderRadius: '24px', textAlign: 'center' }}>
                <h2>進入房間 #{currentRoomId}</h2>
                <input type="password" placeholder="4 位數密碼" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ margin: '20px 0', fontSize: '1.2rem', textAlign: 'center' }} />
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button className="btn-primary" onClick={joinRoom}>確認進入</button>
                  <button className="btn-secondary-glass" onClick={backToLobby}>返回大廳</button>
                </div>
             </div>
          </div>
        )}

        {view === 'profile' && (
          <div className="profile-card glass-panel fade-in">
            <div className="avatar-wrapper" style={{ boxShadow: `0 0 25px ${rank.color}` }}>
              <div className="profile-avatar-large avatar-emoji-container">{currentUser?.photoURL || '🐶'}</div>
              <div className="rank-badge-overlay">{rank.badge}</div>
            </div>
            <div className="profile-info">
              <h2 style={{ color: rank.color }}>{userName || currentUser?.displayName}</h2>
              <span className="profile-rank" style={{ color: rank.color }}>{rank.title}</span>
            </div>
            <div className="profile-stats-summary">
              <div className="stat-main"><span className="label">總擊殺紀錄</span><div className="value">{currentUser?.profile?.totalKills || 0} <small>隻</small></div></div>
              <div className="stat-main"><span className="label">總站崗時長</span><div className="value">{(currentUser?.profile?.totalHours || 0).toFixed(1)} <small>h</small></div></div>
            </div>
            <div className="mastery-section">
              <h3 className="drawer-label">👾 野王專精數據 (Boss Mastery)</h3>
              <div className="mastery-grid">
                {Object.entries(BOSSES).map(([id, b]) => {
                  const m = currentUser?.profile?.mastery?.[id] || { kills: 0, hours: 0 };
                  return (
                    <div key={id} className="mastery-card">
                      <div className="m-boss-icon" style={{ backgroundColor: b.color }}>{b.name[0]}</div>
                      <div className="m-info"><div className="m-name">{b.name}</div><div className="m-stats">擊殺: {m.kills} | 時長: {m.hours.toFixed(1)}h</div></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button className="back-lobby-btn" onClick={() => setView('lobby')}>回大廳</button>
          </div>
        )}

        {view === 'room' && currentRoom && (
          <div className="room-container-v16 fade-in">
            <aside className="v16-sidebar">
              <div className="v16-box identity-box">
                <span className="box-label">在線身份</span>
                <div className="v16-badge-row">
                  <span className="v16-badge-gold" style={{ background: rank.color }}>{rank.badge}</span>
                  <span className="v16-badge-name">{userName || currentUser?.displayName}</span>
                </div>
              </div>
              <div className="v16-box stats-box">
                <span className="box-title">目前房間資訊</span>
                <div className="v16-boss-info"><span className="v16-boss-name">{BOSSES[currentRoom.bossId]?.name}</span><span>擊殺: ⚔️ {currentRoom.totalKills}</span></div>
                <hr className="v16-divider" />
                <div className="v16-member-list">
                  {Object.values(currentRoom.members || {}).map(m => (
                    <div key={m.uid} className="v16-member-tag"><span>{m.photoURL} {m.name}</span><span className={`status-dot ${m.isOnline ? 'online' : 'offline'}`}></span></div>
                  ))}
                </div>
              </div>
              <button className="btn-leave-v1" style={{ marginTop: 'auto' }} onClick={leaveRoom}>離開房間</button>
            </aside>
            <main className="v16-main">
              <div className="v16-header">
                <div className="v16-room-id-group">
                  <div className="v16-room-id">房間 ID <span className="v16-id-text">#{currentRoomId}</span></div>
                  <div className="v16-pwd-row"><span className="v16-pwd-box">{currentRoom.password}</span></div>
                </div>
              </div>
              <div className="v16-table-section">
                <div className="v16-table-container">
                  <div className="v16-table-header"><span>頻道</span><span>狀態</span><span>計時</span><span>回報者</span><span>操作</span></div>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(ch => {
                    const r = currentRoom.records?.[ch];
                    const bTime = BOSSES[currentRoom.bossId]?.time;
                    let rem = 0; if (r && !r.ready) rem = Math.max(0, bTime - Math.floor((now - r.ts) / 1000));
                    return (
                      <div key={ch} className="v16-table-row">
                        <span className="v16-col-ch">CH {ch.toString().padStart(2, '0')}</span>
                        <span className="v16-col-status">{r ? (r.ready ? "🟢 重生中" : (rem > 0 ? "🕒 重生中" : "🔥 可能重生")) : "---"}</span>
                        <span className="v16-col-timer">{rem > 0 ? `${Math.floor(rem / 60)}:${(rem % 60).toString().padStart(2, '0')}` : "--:--"}</span>
                        <span className="v16-col-reporter">{r ? `${r.photoURL} ${r.reporter}` : '---'}</span>
                        <div className="v16-col-actions">
                          <button className="v16-kill-btn" onClick={() => addRecord(ch)}>擊殺</button>
                          <button className="v16-kill-btn" style={{ borderColor: '#aaa' }} onClick={() => markAsReady(ch)}>重生</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
