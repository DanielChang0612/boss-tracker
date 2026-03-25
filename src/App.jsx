import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';

// BOSS 定義
const BOSSES = {
  croco: { name: "沼澤巨鱷", time: 105, area: "維多利亞島", color: "#2e7d32" },
  doll: { name: "仙人娃娃", time: 178, area: "桃花仙境", color: "#f48fb1" },
  bear: { name: "肯得熊", time: 128, area: "桃花仙境", color: "#795548" },
  mushroom: { name: "蘑菇王", time: 240, area: "維多利亞島", color: "#d32f2f" },
  deetloi: { name: "迪特和洛伊", time: 165, area: "納希沙漠", color: "#ffb300" },
  chimera: { name: "奇美拉", time: 135, area: "納希沙漠", color: "#7b1fa2" },
  guard: { name: "自動警備系統", time: 173, area: "納希沙漠", color: "#455a64" },
  twins: { name: "紅藍雙怪", time: 135, area: "納希沙漠", color: "#1976d2" },
  test: { name: "測試王", time: 0.25, area: "開發者地圖", color: "#607d8b" }
};

const ROOM_AUTO_DELETE_MS = 2 * 60 * 60 * 1000; // 2 小時

function App() {
  const [rooms, setRooms] = useState(() => {
    try {
      const saved = localStorage.getItem('artale_guild_rooms');
      return (saved && saved !== 'null') ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [userName, setUserName] = useState(localStorage.getItem('artale_user_name') || '');
  const [currentRoomId, setCurrentRoomId] = useState(window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('room') || null);
  const [view, setView] = useState(currentRoomId ? 'join' : 'lobby');

  // UI 輔助狀態
  const [selectedBossId, setSelectedBossId] = useState('deetloi');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [newRoomConductor, setNewRoomConductor] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [joinNameInput, setJoinNameInput] = useState('');
  const [inputChannel, setInputChannel] = useState('');
  const [now, setNow] = useState(Date.now());

  // 1. 監聽 Firebase 雲端資料 (取代 LocalStorage 同步)
  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    return onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      setRooms(data || {});
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('artale_user_name', userName);
  }, [userName]);

  // 監聽 URL Hash (加入房間連結) -> 只有在大廳時才自動進入加入頁面，避免重複觸發
  useEffect(() => {
    const hashId = window.location.hash.slice(1);
    if (hashId && rooms[hashId] && view === 'lobby') {
      setCurrentRoomId(hashId);
      setView('join');
    }
  }, [rooms, view]);


  // 當 View 切換時清空輸入 (使用者回饋: 確保新開分頁或切換時為空)
  useEffect(() => {
    if (view === 'lobby') {
      setPasswordInput('');
      setJoinNameInput('');
    }
    if (showCreateModal) {
      setNewRoomConductor('');
    }
  }, [view, showCreateModal]);

  // 強制下車同步邏輯 (當成員被踢除時，即時跳轉回大廳)
  useEffect(() => {
    if (currentRoomId && rooms && rooms[currentRoomId] && view === 'room' && userName) {
      const room = rooms[currentRoomId];
      const rawMembers = room.members || [];
      const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
      if (!members.includes(userName)) {
        alert("【系統提醒】您已被請下車，將跳轉回大廳。");
        setCurrentRoomId(null);
        setView('lobby');
        window.history.pushState({}, '', window.location.pathname);
      }
    }
  }, [rooms, currentRoomId, userName, view]);

  // 計時器
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 生命週期管理：自動清理無人房間 (由前端定期觸發雲端刪除)
  useEffect(() => {
    const cleanup = () => {
      Object.keys(rooms || {}).forEach(id => {
        const room = rooms[id];
        if (room.emptySince && (Date.now() - room.emptySince > ROOM_AUTO_DELETE_MS)) {
          remove(ref(db, `rooms/${id}`));
        }
      });
    };
    const interval = setInterval(cleanup, 60000);
    return () => clearInterval(interval);
  }, [rooms]);

  // --- 邏輯函式 ---

  const createRoom = () => {
    if (!newRoomConductor.trim()) return alert("請輸入車長名稱");
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const newRoom = {
      id,
      bossId: selectedBossId,
      password: Math.random().toString(36).substr(2, 4), // 隨機預設密碼
      conductor: newRoomConductor.trim(),
      members: [newRoomConductor.trim()],
      records: {},
      totalKills: 0,
      createdAt: Date.now(),
      emptySince: null
    };
    const roomRef = ref(db, `rooms/${id}`);
    set(roomRef, newRoom);

    setUserName(newRoomConductor.trim());
    setCurrentRoomId(id);
    setView('room');
    setShowCreateModal(false);
    window.history.pushState({}, '', `#${id}`);
  };

  const joinRoom = () => {
    const room = rooms[currentRoomId];
    if (!room) { alert("房間已不存在"); setView('lobby'); return; }
    if (!joinNameInput.trim()) return alert("請輸入您的名稱");

    if (room.password !== passwordInput) {
      alert("密碼錯誤，請重新輸入！");
      return;
    }

    const rawMembersJoin = room.members || [];
    const membersJoin = Array.isArray(rawMembersJoin) ? rawMembersJoin : Object.values(rawMembersJoin);
    if (membersJoin.length >= 4 && !membersJoin.includes(joinNameInput.trim())) {
      alert("我還沒上車阿！(房間已滿 4 人)");
      return;
    }

    const roomRef = ref(db, `rooms/${currentRoomId}`);
    const rawMembers = room.members || [];
    const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
    const isEmptyRoom = members.length === 0;
    const nextMembers = members.includes(joinNameInput.trim())
      ? members
      : [...members, joinNameInput.trim()];

    update(roomRef, {
      conductor: isEmptyRoom ? joinNameInput.trim() : room.conductor,
      members: nextMembers,
      emptySince: null
    });

    setUserName(joinNameInput.trim());
    setView('room');
    window.history.pushState({}, '', `#${currentRoomId}`);
    setPasswordInput(''); // 清空
    setJoinNameInput(''); // 清空
  };

  const manualSync = () => {
    const saved = JSON.parse(localStorage.getItem('artale_guild_rooms')) || {};
    setRooms(saved);
    alert("資料已同步更新！");
  };

  const backToLobby = () => {
    window.history.pushState({}, '', window.location.pathname); // 清除 Hash，避免 Effect 再次跳轉
    setCurrentRoomId(null);
    setView('lobby');
  };

  const handleLeaveClick = () => {
    setShowLeaveModal(true);
  };

  const confirmLeave = () => {
    const room = rooms[currentRoomId];
    if (room) {
      const rawMembers = room.members || [];
      const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
      const nextMembers = members.filter(m => m !== userName);
      const isConductor = room.conductor === userName;

      update(ref(db, `rooms/${currentRoomId}`), {
        members: nextMembers,
        conductor: isConductor ? (nextMembers[0] || room.conductor) : room.conductor,
        emptySince: nextMembers.length === 0 ? Date.now() : null
      });
    }
    setShowLeaveModal(false);
    setCurrentRoomId(null);
    setView('lobby');
    window.history.pushState({}, '', window.location.pathname);
  };

  const removeMember = (targetName) => {
    const room = rooms[currentRoomId];
    if (room.conductor !== userName) return;
    const members = room.members || [];
    update(ref(db, `rooms/${currentRoomId}`), {
      members: members.filter(m => m !== targetName)
    });
  };

  const addRecord = (manualChKey) => {
    const chKey = manualChKey || `CH ${inputChannel.trim()}`;
    if (!manualChKey && !inputChannel.trim()) return;
    set(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { 
      lastKill: Date.now(),
      reporter: userName 
    });
    
    // 全域擊殺統計累加
    const room = rooms[currentRoomId];
    update(ref(db, `rooms/${currentRoomId}`), { 
      totalKills: (room.totalKills || 0) + 1 
    });

    if (!manualChKey) setInputChannel('');
  };

  const removeRecord = (chKey) => {
    remove(ref(db, `rooms/${currentRoomId}/records/${chKey}`));
  };

  // --- 渲染輔助 ---

  const currentRoom = (currentRoomId && rooms && rooms[currentRoomId]) ? rooms[currentRoomId] : null;
  const currentBoss = (currentRoom && currentRoom.bossId && BOSSES[currentRoom.bossId])
    ? BOSSES[currentRoom.bossId]
    : BOSSES[selectedBossId] || Object.values(BOSSES)[0];

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const exportReport = () => {
    const element = document.getElementById('kill-report-card');
    if (!element) return;
    
    // 提醒使用者正在處理
    const btn = document.querySelector('.export-btn');
    const originalText = btn.innerText;
    btn.innerText = "生成圖片中...";
    btn.disabled = true;

    window.html2canvas(element, {
      backgroundColor: '#1a1a1a', // 確保背景是深色
      scale: 2, // 提高解析度
      useCORS: true
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `PiKaPi_${currentBoss.name}_戰報_${new Date().toLocaleDateString()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      btn.innerText = originalText;
      btn.disabled = false;
      alert("✅ 戰報匯出成功！");
    }).catch(err => {
      console.error(err);
      btn.innerText = originalText;
      btn.disabled = false;
      alert("❌ 匯出失敗，請重試");
    });
  };

  // Lobby 房間列表過濾
  const bossRooms = useMemo(() => {
    if (!rooms) return [];
    return Object.values(rooms).filter(r => r && r.bossId === selectedBossId);
  }, [rooms, selectedBossId]);

  // --- 渲染組件 ---

  // --- 主渲染邏輯 ---
  const renderContent = () => {
    try {
      if (view === 'lobby') {
        return (
          <div className="lobby-container">
            {/* ... 大廳內容 ... */}
            <header className="lobby-header">
              <div className="version-tag">Build v1.2.1</div>
              <h1>PiKaPi 公會和諧打王趣</h1>
              <p>專業野王紀錄管理系統</p>
            </header>

            <section className="lobby-controls">
              <div className="boss-selector">
                <label>選擇野王：</label>
                <select value={selectedBossId} onChange={(e) => setSelectedBossId(e.target.value)}>
                  {Object.entries(BOSSES).map(([id, boss]) => (
                    <option key={id} value={id}>{boss.name} ({boss.area})</option>
                  ))}
                </select>
              </div>
              <button className="create-btn" onClick={() => setShowCreateModal(true)}>創建打王房間</button>
            </section>

            <section className="room-list">
              <h3>房間列表 - {BOSSES[selectedBossId].name}</h3>
              <div className="list-container">
                <div className="list-header lobby-table-header">
                  <span>房號</span>
                  <span>車長</span>
                  <span>人數</span>
                  <span>持續時間</span>
                  <span>狀態</span>
                  <span>操作</span>
                </div>
                {bossRooms.length === 0 && <div className="empty-msg">目前沒有房間，快去當車長吧！</div>}
                {bossRooms.map(room => (
                  <div key={room.id} className="list-row">
                    <div className="col-ch">{room.id}</div>
                    <div className="col-boss">{room.conductor}</div>
                    <div className="col-timer">
                      {(() => {
                        const m = room.members || [];
                        const arr = Array.isArray(m) ? m : Object.values(m);
                        return arr.length;
                      })()}/4
                    </div>
                    <div className="col-status">{formatTime(now - room.createdAt)}</div>
                    <div className="col-window">
                      {(() => {
                        const m = room.members || [];
                        const arr = Array.isArray(m) ? m : Object.values(m);
                        return arr.length === 0;
                      })() ? (
                        <span className="delete-countdown">無成員 (清理倒數: {formatTime(ROOM_AUTO_DELETE_MS - (now - room.emptySince))})</span>
                      ) : "熱烈打王中..."}
                    </div>
                    <div className="col-actions">
                      {(() => {
                        const m = room.members || [];
                        const arr = Array.isArray(m) ? m : Object.values(m);
                        return arr.length >= 4;
                      })() ? (
                        <div className="full-room-status">
                          <span>四人打寶中 (滿員)</span>
                        </div>
                      ) : (
                        <button className="row-kill-btn" onClick={() => { setCurrentRoomId(room.id); setView('join'); }}>加入房間</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {showCreateModal && (
              <div className="modal-overlay">
                <div className="modal">
                  <h2>創建房間 - {BOSSES[selectedBossId].name}</h2>
                  <input
                    type="text"
                    placeholder="輸入您的車長名稱 (例如: 幸運車長橘子)"
                    value={newRoomConductor}
                    onChange={(e) => setNewRoomConductor(e.target.value)}
                  />
                  <div className="modal-btns">
                    <button onClick={createRoom}>確定創建</button>
                    <button onClick={() => setShowCreateModal(false)} className="cancel-btn">取消</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

      if (view === 'join') {
        const room = rooms[currentRoomId];
        if (!room) return <div className="error-view">房間已不存在 <button onClick={() => setView('lobby')}>回大廳</button></div>;
        const rawMembers = room.members || [];
        const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
        const isEmptyRoom = members.length === 0;
        return (
          <div className="join-container">
            <div className="modal">
              <h2>{isEmptyRoom ? '重啟房間' : '加入房間'} {currentRoomId}</h2>
              <p>Boss: {BOSSES[room.bossId].name}</p>
              {isEmptyRoom && <p className="gold-text">※ 目前房間沒人，請輸入原房間密碼以重啟並繼承成為新車長。</p>}
              <input
                type="password"
                placeholder="輸入房間密碼"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              <input
                type="text"
                placeholder="您的名稱"
                value={joinNameInput}
                onChange={(e) => setJoinNameInput(e.target.value)}
              />
              <div className="modal-btns">
                <button onClick={joinRoom}>{isEmptyRoom ? '重啟公會專車' : '上車'}</button>
                <button onClick={backToLobby} className="cancel-btn">回大廳</button>
              </div>
            </div>
          </div>
        );
      }

      if (view === 'room' && currentRoom) {
        const isConductor = currentRoom.conductor === userName;
        const rawMembers = currentRoom.members || [];
        const members = Array.isArray(rawMembers) ? rawMembers : Object.values(rawMembers);
        const records = (currentRoom && currentRoom.records) ? currentRoom.records : {};
        const keys = Object.keys(records);

        return (
          <div className={`room-container boss-theme-${currentRoom.bossId}`} style={{ borderColor: currentBoss.color }}>
            <div className="room-sidebar">
              <div className="my-identity">
                <label>您的身分：</label>
                <div className="identity-val">
                  <span className="badge-role">{isConductor ? '幸運車長' : '乘客'}</span>
                  <span className="badge-name">{userName}</span>
                </div>
              </div>
              <div className="member-list">
                <h3>車內成員 {members.length}/4</h3>
                {members.map(m => (
                  <div key={m} className="member-item">
                    <span>{m === currentRoom.conductor ? '🚗' : '👤'} {m}</span>
                    {isConductor && m !== userName && (
                      <button onClick={() => removeMember(m)}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="boss-info-panel">
                <h3>BOSS 資訊</h3>
                <p className="boss-title">{currentBoss.name}</p>
                <p>重生時間: {currentBoss.time} 分鐘</p>
                <p>地區: {currentBoss.area}</p>
              </div>

              {/* 擊殺報告 (v1.2.0) */}
              <div className="kill-report-panel" id="kill-report-card">
                <h3>📊 擊殺報告 (TODAY)</h3>
                <div className="report-content">
                  <div className="report-item">
                    <span className="label">日期:</span>
                    <span className="val">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="report-item">
                    <span className="label">房號:</span>
                    <span className="val highlight">{currentRoomId}</span>
                  </div>
                  <div className="report-item">
                    <span className="label">BOSS 名稱:</span>
                    <span className="val">{currentBoss.name}</span>
                  </div>
                  <div className="report-item total-kills-row">
                    <span className="label">擊殺次數:</span>
                    <span className="val count-box">{currentRoom.totalKills || 0} 次</span>
                  </div>
                  <div className="report-item killers-section">
                    <span className="label">擊殺者 (房內成員):</span>
                    <div className="killers-list">
                      {members.join(', ')}
                    </div>
                  </div>
                </div>
                <button className="export-btn" onClick={exportReport}>🖼 匯出擊殺戰報 (PNG)</button>
              </div>

              <div className="sidebar-btns">
                <button className="leave-btn" onClick={handleLeaveClick}>下車離開 (返回大廳)</button>
              </div>
            </div>

            <div className="room-main">
              <header className="room-header">
                <div className="room-info">
                  <h2>房號: <span className="gold-text">{currentRoomId}</span></h2>
                  <div className="room-password">
                    <label>房間密碼:</label>
                    <div className="password-controls">
                      {isConductor ? (
                        <input
                          className="inline-input password-large"
                          value={currentRoom.password}
                          onChange={(e) => {
                            const newPass = e.target.value;
                            update(ref(db, `rooms/${currentRoomId}`), { password: newPass });
                          }}
                        />
                      ) : <span className="password-large">{currentRoom.password}</span>}
                      <button className="copy-btn-mini" onClick={() => {
                        navigator.clipboard.writeText(currentRoom.password);
                        alert("密碼已複製！");
                      }}>複製</button>
                    </div>
                  </div>
                </div>
                <button className="share-btn" onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("已複製房間連結！");
                }}>分享房間連結</button>
              </header>

              <section className="input-section">
                <input
                  type="text"
                  placeholder="輸入頻道 (例: 5)"
                  className="main-input"
                  value={inputChannel}
                  onChange={(e) => setInputChannel(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addRecord()}
                />
                <button onClick={() => addRecord()} className="add-btn">已擊殺開始計時</button>
              </section>

              <main className="list-container">
                <div className="list-header">
                  <span>頻道</span>
                  <span>野王名稱</span>
                  <span>倒數計時</span>
                  <span>目前狀態</span>
                  <span>預計重生時間</span>
                  <span>回報者</span>
                  <span>頻道操作</span>
                </div>
                {keys.length === 0 ? (
                  <div className="empty-msg">目前沒有紀錄，請輸入頻道開始。</div>
                ) : (
                  keys.sort((a, b) => {
                    const chA = records[a];
                    const chB = records[b];
                    const elapsedA = (now - chA.lastKill) / 60000;
                    const elapsedB = (now - chB.lastKill) / 60000;
                    const remainingA = currentBoss.time - elapsedA;
                    const remainingB = currentBoss.time - elapsedB;
                    const isReadyA = remainingA <= 0;
                    const isReadyB = remainingB <= 0;

                    if (isReadyA && !isReadyB) return -1;
                    if (!isReadyA && isReadyB) return 1;
                    // 皆為已重生或皆為重生中：依照剩餘時間排序 (越小排越上面)
                    return remainingA - remainingB;
                  }).map(chKey => {
                    const chData = records[chKey];
                    if (!chData) return null;
                    const elapsed = (now - chData.lastKill) / 60000;
                    const remaining = currentBoss.time - elapsed;
                    const isReady = remaining <= 0;
                    return (
                      <div key={chKey} className={`list-row ${isReady ? 'row-ready' : ''}`}>
                        <div className="col-ch">{chKey}</div>
                        <div className="col-boss">{currentBoss.name}</div>
                        <div className="col-timer">{isReady ? "READY" : formatTime(remaining * 60000)}</div>
                        <div className="col-status">
                          <span className={`status-badge ${isReady ? 'status-ready' : 'status-respawning'}`}>
                            {isReady ? '已重生' : '重生中'}
                          </span>
                        </div>
                        <div className="col-window">{formatDateTime(chData.lastKill + currentBoss.time * 60000)}</div>
                        <div className="col-reporter">
                          <span className="reporter-badge">👤 {chData.reporter || '系統'}</span>
                        </div>
                        <div className="col-actions">
                          {isReady && (
                            <button className="re-kill-btn" onClick={() => addRecord(chKey)}>已擊殺</button>
                          )}
                          <button className="row-remove-btn" onClick={() => removeRecord(chKey)}>刪除</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </main>
            </div>
          </div>
        );
      }

    } catch (err) {
      console.error("Render Error:", err);
      return (
        <div className="error-view">
          <h2>系統發生錯誤</h2>
          <pre style={{ textAlign: 'left', background: '#000', padding: '10px' }}>{err.stack}</pre>
          <button onClick={() => { setView('lobby'); setCurrentRoomId(null); }}>返回大廳</button>
        </div>
      );
    }
  };

  return (
    <>
      {renderContent()}

      {showLeaveModal && currentRoom && (
        <div className="modal-overlay">
          <div className="modal info-modal">
            <h2>【下車前資訊提醒】</h2>
            <p>請確認是否記錄好相關資訊：</p>
            <div className="info-item">
              <label>您的名稱：</label>
              <div className="info-val">{userName}</div>
            </div>
            <div className="info-item">
              <label>房間密碼：</label>
              <div className="info-val">
                <span className="password-display">{currentRoom.password}</span>
                <button className="copy-btn-mini" onClick={() => {
                  navigator.clipboard.writeText(currentRoom.password);
                  alert("密碼已複製！");
                }}>複製</button>
              </div>
            </div>
            {(() => {
              const m = currentRoom.members || [];
              const arr = Array.isArray(m) ? m : Object.values(m);
              return arr.length === 1;
            })() && (
                <div className="warning-box">
                  ⚠️ 注意：您是最後一位成員，下車後該房間將成為<strong>無人房</strong>！下一位進入的玩家將繼承成為車長！
                </div>
              )}
            <div className="modal-btns">
              <button onClick={confirmLeave}>確認紀錄並下車</button>
              <button onClick={() => setShowLeaveModal(false)} className="cancel-btn">取消</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
