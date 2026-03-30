import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth, googleProvider } from './firebase';
import { ref, onValue, set, update, remove, onDisconnect, get, off } from 'firebase/database';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import html2canvas from 'html2canvas';
import './membership.css';

// 6 個萌系動物預設選項 (v4.8)
// 預設頭像 Emoji 清單 (v2.2)
const DEFAULT_ANIMALS = [
  '🐶', '🐱', '🦊', '🐼', '🐨', '🐯', '🐸', '🐰',
  '🐧', '🐻', '🐹', '🐭', '🦁', '🐮', '🦒', '🐘',
  '🦄', '🐲', '🦖', '🐢', '🐷', '🐔', '🐤', '🐦',
  '🐙', '🐒', '🦍', '🦝', '🐴', '🐑', '🐿️', '🦉',
  '🐝', '🦋', '🐞', '🌻', '🍀', '🌈', '🍦', '🥨',
  '🍭', '🧁', '🍪', '🍩', '🍫', '⚔️', '🛡️', '🏹',
  '⚖️', '💎', '👑', '🏰', '🔥', '❄️', '⚡', '🎈',
  '🎁', '🎀', '🧸', '🪁', '🎮', '🎨'
];

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
const ADMIN_UID = 'dVqiQcpgNqR5xgHZbeGjsncgHeN2'; // 管理員專屬完整的 UID
// --- 稱號系統配置 (v4.1 榮譽升級) ---
const RANKS_CONFIG = [
  { title: '初心者', badge: '🌱', color: '#ffffff', minKills: 0, scale: 100, desc: '踏入戰場的新生力量，一切的起點。' },
  { title: '見習生', badge: '🐤', color: '#81c784', minKills: 500, scale: 200, desc: '開始掌握節奏，在森林中磨練自我。' },
  { title: '冒險者', badge: '⛺', color: '#4caf50', minKills: 1500, scale: 300, desc: '渴望未知的戰役，橫跨大陸的行者。' },
  { title: '討伐者', badge: '🏹', color: '#26a69a', minKills: 3000, scale: 400, desc: '以獵殺為生，名號在頻道間悄然傳開。' },
  { title: '守護者', badge: '🛡️', color: '#4fc3f7', minKills: 5000, scale: 600, desc: '盾牌後的堅毅目光，守護公會榮耀。' },
  { title: '精英排長', badge: '⭐', color: '#2196f3', minKills: 10000, scale: 1000, desc: '戰術執行者，帶領隊員精準打擊。' },
  { title: '鋼鐵騎士', badge: '⚔️', color: '#7e57c2', minKills: 20000, scale: 2000, desc: '意志如鋼鐵般不屈，衝鋒在最前線。' },
  { title: '榮耀男爵', badge: '🏅', color: '#ab47bc', minKills: 40000, scale: 4000, desc: '獲得初步貴族頭銜，展現統帥潛力。' },
  { title: '尊貴子爵', badge: '🎩', color: '#ce93d8', minKills: 100000, scale: 10000, desc: '優雅與力量並存，戰功卓越的貴族。' },
  { title: '望族伯爵', badge: '🤵', color: '#f06292', minKills: 200000, scale: 20000, desc: '家族名望如日中天，累積驚人擊殺。' },
  { title: '世襲侯爵', badge: '💂', color: '#f44336', minKills: 350000, scale: 30000, desc: '打王成為血脈本能，戰無不勝的將領。' },
  { title: '巔峰公爵', badge: '🎖️', color: '#ff7043', minKills: 500000, scale: 50000, desc: '位居權力巔峰，全頻道的敬畏對象。' },
  { title: '領地之主', badge: '🏯', color: '#ffb74d', minKills: 750000, scale: 50000, desc: '每一吋地圖都是你絕對掌控的狩獵場。' },
  { title: '大領主', badge: '🏰', color: '#ffc107', minKills: 1000000, scale: 100000, desc: '領主之中的領袖，權威不可撼動。' },
  { title: '聖騎士團長', badge: '🔱', color: '#fff176', minKills: 2000000, scale: 200000, desc: '神聖戰士首領，光輝籠罩整個公會。' },
  { title: '封號鬥羅', badge: '🌀', color: '#80deea', minKills: 4000000, scale: 400000, desc: '力量覺醒至極致，獲得專屬傳奇封號。' },
  { title: '滅世戰神', badge: '🔥', color: '#ff1744', minKills: 6000000, scale: 400000, desc: '降臨時天地變色，野王皆為塵土。' },
  { title: '傳奇至尊', badge: '✨', color: '#eceff1', minKills: 8000000, scale: 400000, desc: '史詩中的不朽傳說，榮耀名留青史。' },
  { title: '超越者', badge: '⚛️', color: '#ea80fc', minKills: 10000000, scale: 500000, desc: '超脫凡塵境界，掌握虛空的戰鬥法則。' },
  { title: '虛空至尊', badge: '👑', color: '#1a1a1a', minKills: 15000000, scale: 1000000, desc: '站立於頂點的王者，虛空的絕對主宰。' }
];

const getRankInfo = (kills = 0) => {
  let titleIdx = 0;
  for (let i = RANKS_CONFIG.length - 1; i >= 0; i--) {
    if (kills >= RANKS_CONFIG[i].minKills) {
      titleIdx = i;
      break;
    }
  }

  const config = RANKS_CONFIG[titleIdx];
  const relativeKills = kills - config.minKills;
  const subRankLevel = Math.floor(relativeKills / config.scale); 
  const currentSubRank = Math.min(5, subRankLevel + 1); 
  
  const subRankMap = ['五階', '四階', '三階', '二階', '一階'];
  const subRankText = subRankMap[currentSubRank - 1] || '一階';
  const level = (titleIdx * 5) + Math.min(5, currentSubRank);

  let nextThreshold = config.minKills + (currentSubRank * config.scale);
  let isMax = false;
  
  if (currentSubRank >= 5) {
    if (titleIdx < RANKS_CONFIG.length - 1) {
      nextThreshold = RANKS_CONFIG[titleIdx + 1].minKills;
    } else {
      isMax = true;
    }
  }

  return { 
    ...config, 
    level, 
    subRank: subRankText,
    fullTitle: `${config.title} ${subRankText}`,
    nextKills: isMax ? 0 : (nextThreshold - kills),
    progress: isMax ? 100 : Math.min(99, ((kills - (config.minKills + (currentSubRank-1)*config.scale)) / config.scale) * 100)
  };
};

// --- 頭像渲染助手 (v4.9) ---
const renderAvatar = (photoURL, className = "avatar-img", style = {}) => {
  const isEmoji = !photoURL || !photoURL.startsWith('http');
  if (isEmoji) {
    return (
      <div className={`${className} avatar-emoji-container`} style={style}>
        {photoURL || '🐶'}
      </div>
    );
  }
  return <img src={photoURL} alt="avatar" className={className} style={style} />;
};

function App() {
  const [rooms, setRooms] = useState({});
  const [roomSummaries, setRoomSummaries] = useState({}); // 補回缺失的摘要 State
  const [userName, setUserName] = useState(localStorage.getItem('artale_user_name') || '');
  const [currentRoomId, setCurrentRoomId] = useState(window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('room') || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [view, setView] = useState('landing');

  // UI 輔助狀態
  const [selectedBossId, setSelectedBossId] = useState('deetloi');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [newRoomConductor, setNewRoomConductor] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [joinNameInput, setJoinNameInput] = useState('');
  const [inputChannel, setInputChannel] = useState('');
  const [now, setNow] = useState(Date.now());
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showInheritanceModal, setShowInheritanceModal] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voiceSettings, setVoiceSettings] = useState(() => {
    const saved = localStorage.getItem('pikapi_voice_settings');
    return saved ? JSON.parse(saved) : { voiceURI: '', rate: 1, pitch: 1 };
  });

  const [presenceData, setPresenceData] = useState({});
  const [allUsers, setAllUsers] = useState({});
  const [adminTab, setAdminTab] = useState('rooms'); // 'rooms' | 'users'
  const [adminUserSubTab, setAdminUserSubTab] = useState('stats'); // 'stats' | 'directory'
  const [adminUserSearchTerm, setAdminUserSearchTerm] = useState(''); // 搜尋過濾
  const [sessionStartTime, setSessionStartTime] = useState(null); // 個人站崗計時器
  const [sessionKills, setSessionKills] = useState(0); // 本次隨車累計擊殺 (v1.6.2)
  const [globalBroadcast, setGlobalBroadcast] = useState(null); // 全域公告節點
  const [broadcastInput, setBroadcastInput] = useState(''); // 管理員廣播輸入框
  const [adminMenu, setAdminMenu] = useState(null); // { rid, m }
  const [showAvatarModal, setShowAvatarModal] = useState(false); // 預設頭像彈窗
  const [selectedEmoji, setSelectedEmoji] = useState(null); // 選中的 Emoji
  const [copySuccess, setCopySuccess] = useState(false); // 複製密碼成功狀態
  const [isUsersLoading, setIsUsersLoading] = useState(false); // 管理員加載狀態
  const [isSummariesLoading, setIsSummariesLoading] = useState(false); // 大廳加載狀態
  const [lastSummariesUpdate, setLastSummariesUpdate] = useState(null); // 上次刷新時間
  const [isTabActive, setIsTabActive] = useState(true); // 頁面是否在前景 (v3.3)
  const [selectedMedal, setSelectedMedal] = useState(null); // 當前點選查看的勳章 (v4.4)

  const userHasSeenSelfInRoom = useRef(false);
  const lastPresenceUpdateTs = useRef(0); // 頻率限制 (v3.2)
  const isAdmin = currentUser?.uid === ADMIN_UID;

  const currentRoom = (currentRoomId && rooms && rooms[currentRoomId]) ? rooms[currentRoomId] : null;
  const currentBoss = (currentRoom && currentRoom.bossId && BOSSES[currentRoom.bossId])
    ? BOSSES[currentRoom.bossId]
    : BOSSES[selectedBossId] || Object.values(BOSSES)[0];

  useEffect(() => {
    const handleVisibilityChange = () => {
      const active = document.visibilityState === 'visible';
      setIsTabActive(active);
      if (!active && currentUser) {
        // 當分頁隱藏時，立刻發送一次離線標記 (v3.3)
        const presenceRef = ref(db, `presence/${currentUser.uid}`);
        update(presenceRef, { isOnline: false, lastSeen: Date.now() });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser]);

  const fetchRoomSummaries = async () => {
    setIsSummariesLoading(true);
    try {
      const snapshot = await get(ref(db, 'roomSummaries'));
      setRoomSummaries(snapshot.val() || {});
      setLastSummariesUpdate(Date.now());
    } catch (err) {
      console.error("Failed to fetch room summaries:", err);
    } finally {
      setIsSummariesLoading(false);
    }
  };

  // 1. 初始化大廳數據 (僅一次，大幅省流量 v3.2)
  useEffect(() => {
    if (view === 'lobby' && isTabActive) {
      fetchRoomSummaries();
    }
  }, [view, isTabActive]);

  // 2. 當進入特定房間時，採用分拆式監聽 (前景才會同步 v3.3)
  useEffect(() => {
    if (!currentRoomId || view !== 'room' || !isTabActive) return;
    
    // 將大節點拆成獨立監聽器，避免「一人改名、全站重抓」的問題
    const baseRef = ref(db, `rooms/${currentRoomId}`);
    
    // 房間基本資訊與車長
    const unsubRoom = onValue(baseRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRooms(prev => ({ 
          ...prev, 
          [currentRoomId]: { ...(prev[currentRoomId] || {}), ...data } 
        }));
      }
    });

    return () => {
      unsubRoom();
    };
  }, [currentRoomId, view, isTabActive]);

  // 2.1 語音專用監聽器 (全天候開啟，含背景 v3.5)
  useEffect(() => {
    if (!currentRoomId || view !== 'room') return;
    
    // 專門監聽語音節點，體積極小，確保在後台也能通報
    const alertRef = ref(db, `rooms/${currentRoomId}/voiceAlert`);
    return onValue(alertRef, (snapshot) => {
      const alert = snapshot.val();
      if (alert && alert.ts > lastAlertTs.current) {
        lastAlertTs.current = alert.ts;
        const utterance = new SpeechSynthesisUtterance(alert.message);
        const selectedVoice = availableVoices.find(v => v.voiceURI === voiceSettings.voiceURI);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;
        utterance.lang = 'zh-TW';
        window.speechSynthesis.speak(utterance);
      }
    });
  }, [currentRoomId, view, voiceSettings, availableVoices]);

  useEffect(() => {
    localStorage.setItem('pikapi_voice_settings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  useEffect(() => {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices.filter(v => v.lang.includes('zh') || v.lang.includes('en')));
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  // 已移至摘要監聽與單房監聽，此處拔除以節省流量

  // 全局點擊關閉選單 (v4.5)
  useEffect(() => {
    const handleClickOutside = (e) => {
      // 如果點擊的地方不屬於成員標籤，則關閉選單
      if (!e.target.closest('.admin-member-tag')) {
        setAdminMenu(null);
      }
    };
    if (adminMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [adminMenu]);

  const fetchAllUsers = async () => {
    if (currentUser?.uid !== ADMIN_UID) return;
    setIsUsersLoading(true);
    try {
      const snapshot = await get(ref(db, 'users'));
      if (snapshot.exists()) {
        setAllUsers(snapshot.val());
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
      alert("讀取成員資料失敗");
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    // 3. 管理員名錄專用的在線狀態即時監聽 (僅前景同步 v3.3)
    if (view === 'admin' && isAdmin && isTabActive) {
      const globalPresenceRef = ref(db, 'presence');
      return onValue(globalPresenceRef, (snapshot) => {
        setPresenceData(snapshot.val() || {});
      });
    }
  }, [view, isAdmin, isTabActive]);

  useEffect(() => {
    // 監聽大廳連線狀態並同步心跳 (僅針對在房間內的前景成員 v3.3)
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true && currentRoomId && userName && view === 'room' && isTabActive) {
        const memberRef = ref(db, `rooms/${currentRoomId}/members/${userName}`);
        update(memberRef, { 
          isOnline: true, 
          lastSeen: Date.now() 
        });
      }
    });
    return () => unsubscribe();
  }, [currentRoomId, userName, view, isTabActive]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        let userData = snapshot.val();
        
        if (!userData) {
          userData = {
            uid: user.uid,
            displayName: user.displayName || '無名英雄',
            photoURL: '🐶', // 預設使用 Emoji，取代 Google 圖片 (v2.2)
            totalKills: 0,
            totalHours: 0,
            status: user.uid === ADMIN_UID ? 'approved' : 'new', // 管理員自動核准，新戶為 new
            createdAt: Date.now()
          };
          update(userRef, userData);
        }
        
        // 優先使用資料庫中的資料 (v2.2)
        const combinedUser = { 
          ...user, 
          photoURL: userData.photoURL || '🐶', 
          displayName: userData.displayName || user.displayName,
          profile: userData 
        };
        setCurrentUser(combinedUser);
        setUserName(userData.displayName || user.displayName);
        // 權限守衛 (v4.9)
        if (user.uid !== ADMIN_UID && userData.status !== 'approved') {
          setView('landing');
        } else if (view === 'landing') {
          const hashId = window.location.hash.slice(1);
          if (hashId && rooms[hashId]) {
            setCurrentRoomId(hashId);
            setJoinNameInput(userData.displayName);
            setView('join');
          } else {
            setView('lobby');
          }
        }
      } else {
        // 如果登出前正在房間內，先結算時間
        if (currentUser && currentRoomId && sessionStartTime) {
          const delta = (Date.now() - sessionStartTime) / (1000 * 60 * 60);
          const userRef = ref(db, `users/${currentUser.uid}`);
          get(userRef).then(snap => {
            const data = snap.val() || {};
            const bossId = rooms[currentRoomId]?.bossId || 'unknown';
            update(userRef, {
              totalHours: (data.totalHours || 0) + delta,
              [`bossStats/${bossId}/hours`]: (data.bossStats?.[bossId]?.hours || 0) + delta
            });
          });
        }
        setCurrentUser(null);
        setView('landing');
        setCurrentRoomId(null);
        setSessionStartTime(null);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [view, rooms, currentRoomId]); // Added session logic dependency
  
  // 終極全域心跳控流 (v3.3)
  useEffect(() => {
    if (!currentUser || !isTabActive) return;

    const updatePresence = () => {
      if (Date.now() - lastPresenceUpdateTs.current > 60000) {
        const presenceRef = ref(db, `presence/${currentUser.uid}`);
        update(presenceRef, { 
          isOnline: true, 
          lastSeen: Date.now(),
          displayName: currentUser.displayName || '無名英雄'
        });
        const disconnectRef = onDisconnect(presenceRef);
        disconnectRef.update({ isOnline: false, lastSeen: Date.now() });
        lastPresenceUpdateTs.current = Date.now();
      }
    };

    updatePresence(); // 立即同步一次
    const interval = setInterval(updatePresence, 30000); // 每一分鐘檢查一次 (搭配防抖)
    return () => clearInterval(interval);
  }, [currentUser, isTabActive]);

  // 全域廣播監聽與語音報讀 (全天候支援 v3.5)
  useEffect(() => {
    const broadcastRef = ref(db, 'globalBroadcast');
    const unsubscribe = onValue(broadcastRef, (snap) => {
      const data = snap.val();
      if (data && data.ts > Date.now() - 30000) { // 30秒內的公告才顯示
        setGlobalBroadcast(data);
        // 語音報讀 (TTS)
        const speech = new SpeechSynthesisUtterance(data.message);
        speech.lang = 'zh-TW';
        speech.rate = 0.9;
        window.speechSynthesis.speak(speech);

        // 8秒後自動隱藏橫幅
        setTimeout(() => setGlobalBroadcast(null), 8000);
      }
    });
    return () => unsubscribe();
  }, []); // 移除 isTabActive 限制，大廳也能聽全域公告

  // 檢查是否被踢出房間 (已整合至下方 v2.3 機制，此處移除以避免誤判)

  useEffect(() => {
    if (view === 'lobby' && userName) {
      localStorage.setItem('artale_user_name', userName);
    }
  }, [userName, view]);

  useEffect(() => {
    const hashId = window.location.hash.slice(1);
    if (hashId && rooms[hashId] && view === 'lobby') {
      setCurrentRoomId(hashId);
      setJoinNameInput(userName);
      setView('join');
    }
  }, [rooms, view, userName]);

  useEffect(() => {
    if (view === 'lobby') {
      setPasswordInput('');
      setJoinNameInput(userName);
    }
    if (showCreateModal) {
      setNewRoomConductor(userName);
    }
  }, [view, showCreateModal, userName]);

  useEffect(() => {
    if (currentRoomId && rooms && rooms[currentRoomId] && view === 'room' && userName) {
      const room = rooms[currentRoomId];
      const rawMembers = room.members || {};
      const members = Array.isArray(rawMembers) ? rawMembers : Object.keys(rawMembers);
      
      const isInRoom = members.includes(userName);

      if (isInRoom) {
        userHasSeenSelfInRoom.current = true;
      } else if (userHasSeenSelfInRoom.current) {
        const timer = setTimeout(() => {
          get(ref(db, `rooms/${currentRoomId}/members/${userName}`)).then(snap => {
            if (!snap.exists()) {
              alert("【系統提醒】您已被請下車，將跳轉回大廳。");
              userHasSeenSelfInRoom.current = false;
              setCurrentRoomId(null);
              setView('lobby');
              window.history.pushState({}, '', window.location.pathname);
            }
          });
        }, 2000);
        return () => clearTimeout(timer);
      }
    } else if (view === 'lobby') {
      userHasSeenSelfInRoom.current = false;
    }
  }, [rooms, currentRoomId, userName, view]);

  // 已廢除個人圖片上傳 (v2.2)
  const updateProfileAvatar = (newUrl) => {
    if (!currentUser) return;
    update(ref(db, `users/${currentUser.uid}`), { photoURL: newUrl });
    setCurrentUser(prev => ({
      ...prev,
      photoURL: newUrl,
      profile: { ...prev.profile, photoURL: newUrl }
    }));
    alert("頭像更換成功！");
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lastAlertTs = useRef(Date.now());
  // 已移至 2.1 語音專用監聽器，此處移除以節省流量 (v3.5)

  const handleTestVoice = () => {
    const utterance = new SpeechSynthesisUtterance("PiKaPi 戰略通報測試。");
    const selectedVoice = availableVoices.find(v => v.voiceURI === voiceSettings.voiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.lang = 'zh-TW';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const cleanup = () => {
      Object.keys(rooms || {}).forEach(id => {
        const room = rooms[id];
        const rawMembers = room.members || {};
        const members = Array.isArray(rawMembers) ? rawMembers : Object.keys(rawMembers);
        
        if (members.length === 0 && !room.emptySince) {
          update(ref(db, `rooms/${id}`), { emptySince: Date.now() });
        }

        if (room.emptySince && (Date.now() - room.emptySince > ROOM_AUTO_DELETE_MS)) {
          remove(ref(db, `rooms/${id}`));
        }
      });
    };
    const interval = setInterval(cleanup, 60000);
    return () => clearInterval(interval);
  }, [rooms]);

  useEffect(() => {
    if (currentRoomId && userName && view === 'room') {
      const memberRef = ref(db, `rooms/${currentRoomId}/members/${userName}`);
      update(memberRef, { 
        isOnline: true, 
        lastSeen: Date.now() 
      });

      const disconnectRef = onDisconnect(memberRef);
      disconnectRef.update({ 
        isOnline: false, 
        lastSeen: Date.now() 
      });
      
      return () => {
        update(memberRef, { isOnline: false });
        disconnectRef.cancel();
      };
    }
  }, [currentRoomId, userName, view]);

  useEffect(() => {
    if (currentRoomId && view === 'room' && currentRoom) {
      const rawMembers = currentRoom.members || {};
      const members = Array.isArray(rawMembers) ? rawMembers : Object.keys(rawMembers);
      const isConductorInRoom = members.includes(currentRoom.conductor);

      if (members.length > 0 && !isConductorInRoom) {
        update(ref(db, `rooms/${currentRoomId}`), {
          conductor: members[0]
        });
      }
    }
  }, [currentRoomId, view, currentRoom]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("登入失敗", error);
      alert("登入失敗，請重試。");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('landing');
    } catch (error) {
      console.error("登出失敗", error);
    }
  };

  const updateProfileName = (newName) => {
    if (!newName.trim()) return alert("請輸入暱稱");
    if (!currentUser) return;
    update(ref(db, `users/${currentUser.uid}`), { displayName: newName.trim() });
    setUserName(newName.trim());
    alert("暱稱已更新！");
  };

  const createRoom = () => {
    const conductor = userName; // 直接使用系統名稱 (v2.2)
    if (!conductor.trim()) return alert("請至 Profile 設定您的名稱");
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const newRoom = {
      id,
      bossId: selectedBossId,
      password: Math.random().toString(36).substr(2, 4),
      conductor,
      members: { [userName]: true },
      records: {},
      totalKills: 0,
      createdAt: Date.now()
    };
    
    // 同步寫入摘要，讓大廳監聽超省流量
    const summary = {
      id,
      bossId: selectedBossId,
      conductor,
      totalKills: 0,
      createdAt: Date.now(),
      onlineCount: 1
    };

    update(ref(db), {
      [`rooms/${id}`]: newRoom,
      [`roomSummaries/${id}`]: summary,
      [`users/${currentUser.uid}/rooms/${id}`]: true
    }).then(() => {
      setCurrentRoomId(id);
      setView('room');
      setSessionStartTime(Date.now());
      setSessionKills(0);
    });
  };

  const joinRoom = () => {
    const room = rooms[currentRoomId];
    if (!room) return alert("房間已不存在");
    if (!joinNameInput.trim()) return alert("請輸入您的名稱");
    if (room.password !== passwordInput) return alert("密碼錯誤");

    update(ref(db, `rooms/${currentRoomId}/members`), {
      [joinNameInput.trim()]: { 
        joinedAt: Date.now(), 
        startKills: room.totalKills || 0,
        photoURL: currentUser.profile?.photoURL || '🐶', // 同步頭像 (v2.3)
        isOnline: true
      }
    });
    
    setUserName(joinNameInput.trim());
    setView('room');
    setSessionStartTime(Date.now()); // 開始計時
    window.history.pushState({}, '', `#${currentRoomId}`);
    setPasswordInput('');
    setJoinNameInput('');
  };

  const backToLobby = () => {
    window.history.pushState({}, '', window.location.pathname);
    setCurrentRoomId(null);
    setView('lobby');
  };

  const confirmLeave = () => {
    const room = rooms[currentRoomId];
    if (room && currentUser) {
      // 結算站崗時間
      if (sessionStartTime) {
        const delta = (Date.now() - sessionStartTime) / (1000 * 60 * 60); // 小時
        const userRef = ref(db, `users/${currentUser.uid}`);
        get(userRef).then(snap => {
          const data = snap.val() || {};
          const bossId = room.bossId;
          update(userRef, {
            totalHours: (data.totalHours || 0) + delta,
            [`bossStats/${bossId}/hours`]: (data.bossStats?.[bossId]?.hours || 0) + delta
          });
        });
      }

      const rawMembers = room.members || {};
      const members = Object.keys(rawMembers).filter(m => m !== userName);
      const isConductor = room.conductor === userName;
      remove(ref(db, `rooms/${currentRoomId}/members/${userName}`));
      update(ref(db, `rooms/${currentRoomId}`), {
        conductor: isConductor ? (members[0] || room.conductor) : room.conductor,
        emptySince: members.length === 0 ? Date.now() : null
      });
    }
    setSessionStartTime(null);
    setShowLeaveModal(false);
    setCurrentRoomId(null);
    setView('lobby');
    window.history.pushState({}, '', window.location.pathname);
  };

  const removeMember = (targetName) => {
    if (currentRoom.conductor !== userName) return;
    if (confirm(`確定要將 ${targetName} 請下車嗎？`)) {
      remove(ref(db, `rooms/${currentRoomId}/members/${targetName}`));
    }
  };

  const transferConductor = (targetName) => {
    if (currentRoom.conductor !== userName) return;
    if (confirm(`確定要將車長權限移交給 ${targetName} 嗎？`)) {
      update(ref(db, `rooms/${currentRoomId}`), { conductor: targetName });
    }
  };

  const toggleWildBossExplore = () => {
    const isActive = currentRoom.wildBossExplore?.[userName];
    update(ref(db, `rooms/${currentRoomId}/wildBossExplore`), {
      [userName]: isActive ? null : true
    });
    if (!isActive) {
      update(ref(db, `rooms/${currentRoomId}`), {
        voiceAlert: { message: `${userName} 已經去打野了`, ts: Date.now(), sender: userName }
      });
    }
  };

  const handleStationed = (chKey) => {
    const records = currentRoom.records || {};
    const isOccupiedByMe = records[chKey]?.occupant === userName;
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { 
      occupant: isOccupiedByMe ? null : userName // 點擊第二次解除佔位 (v2.3)
    });
  };

  const addRecord = (manualChKey) => {
    const chKey = manualChKey || `CH ${inputChannel.trim()}`;
    if (!manualChKey && !inputChannel.trim()) return;
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { 
      lastKill: Date.now(),
      reporter: userName,
      occupant: null
    });

    // 增加房間總擊殺 (同步更新詳情與摘要)
    update(ref(db), { 
      [`rooms/${currentRoomId}/totalKills`]: (currentRoom.totalKills || 0) + 1,
      [`roomSummaries/${currentRoomId}/totalKills`]: (currentRoom.totalKills || 0) + 1,
      [`rooms/${currentRoomId}/wildBossExplore`]: null
    });

    // 增加個人與 Boss 個別統計
    if (currentUser && currentRoom) {
      const bossId = currentRoom.bossId;
      const userRef = ref(db, `users/${currentUser.uid}`);
      get(userRef).then(snap => {
        const data = snap.val() || {};
        const newActivity = {
          bossId,
          bossName: currentBoss.name,
          ch: chKey,
          at: Date.now()
        };
        const recent = data.recentActivity || [];
        const updatedRecent = [newActivity, ...recent].slice(0, 5);
        
        update(userRef, {
          totalKills: (data.totalKills || 0) + 1,
          [`bossStats/${bossId}/kills`]: (data.bossStats?.[bossId]?.kills || 0) + 1,
          recentActivity: updatedRecent
        });
      });
    }

    // 更新 Session 擊殺計數 (v1.6.2)
    setSessionKills(prev => prev + 1);

    if (!manualChKey) setInputChannel('');
  };

  const removeRecord = (chKey) => {
    remove(ref(db, `rooms/${currentRoomId}/records/${chKey}`));
  };

  const markAsReady = (chKey) => {
    const readyTime = Date.now() - (currentBoss.time * 60 * 1000);
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { 
      lastKill: readyTime,
      reporter: userName,
      occupant: null
    });
  };

  const sendInheritanceRequest = (targetId) => {
    set(ref(db, `rooms/${targetId}/inheritanceRequest`), {
      fromRoomId: currentRoomId,
      fromConductor: userName,
      at: Date.now(),
      status: 'pending'
    });
    setShowInheritanceModal(false);
    alert("❤️ 愛的小禮物已發送！");
  };

  const handleInheritanceResponse = (accept) => {
    if (accept) {
      const fromRoom = rooms[currentRoom.inheritanceRequest.fromRoomId];
      if (!fromRoom) return alert("對方的愛消失了...");
      const myRecords = currentRoom.records || {};
      const fromRecords = fromRoom.records || {};
      const mergedRecords = { ...myRecords };
      Object.keys(fromRecords).forEach(ch => {
        if (!mergedRecords[ch] || fromRecords[ch].lastKill > mergedRecords[ch].lastKill) {
          mergedRecords[ch] = fromRecords[ch];
        }
      });
      update(ref(db, `rooms/${currentRoomId}`), { records: mergedRecords, inheritanceRequest: null });
      remove(ref(db, `rooms/${fromRoom.id}`));
    } else {
      update(ref(db, `rooms/${currentRoomId}`), { inheritanceRequest: null });
    }
  };
  const handleRespawned = (ch) => {
    if (!currentRoomId || !currentBoss) return;
    const recordsRef = ref(db, `rooms/${currentRoomId}/records/${ch}`);
    const respawnTime = Date.now() - (currentBoss.time * 60000);
    update(recordsRef, {
      lastKill: respawnTime,
      reporter: userName,
      timestamp: Date.now()
    });
  };

  const broadcastStatus = (ch) => {
    if (!currentRoomId || !currentBoss) return;
    const chNum = ch.replace('CH','').trim();
    const message = `頻道 ${chNum} 已經重生`;
    
    // 更新至 Firebase 中心的語音警報設施，這會觸發全房報讀
    update(ref(db, `rooms/${currentRoomId}`), {
      voiceAlert: {
        message: message,
        ts: Date.now(),
        sender: userName
      }
    });
  };


  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const exportReport = () => {
    const element = document.getElementById('kill-report-card');
    if (!element) return;
    html2canvas(element, { backgroundColor: '#1a1a1a', scale: 2 }).then(canvas => {
      const link = document.createElement('a');
      link.download = `PiKaPi战報.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const adminDeleteRoom = (roomId) => {
    if (!window.confirm(`確定要【強制刪除】房號 ${roomId} 嗎？`)) return;
    remove(ref(db, `rooms/${roomId}`));
  };

  const adminKickMember = (roomId, memberName) => {
    if (!window.confirm(`確定要將成員 ${memberName} 【強制下車】嗎？`)) return;
    remove(ref(db, `rooms/${roomId}/members/${memberName}`));
  };

  const applyForMembership = () => {
    if (!currentUser) return;
    update(ref(db, `users/${currentUser.uid}`), { 
      status: 'pending',
      appliedAt: Date.now()
    });
    alert("🚀 申請已送出！請等待指揮官審核。");
  };

  const adminApproveUser = (uid) => {
    update(ref(db, `users/${uid}`), { status: 'approved' });
    alert("✅ 審核通過！");
  };

  const adminRejectUser = (uid) => {
    if (!window.confirm("確定要【拒絕】此申請嗎？")) return;
    update(ref(db, `users/${uid}`), { status: 'rejected' });
    alert("❌ 已拒絕申請。");
  };

  const adminTransferConductor = (roomId, newConductor) => {
    if (!window.confirm(`確定要將房號 ${roomId} 的【車長】轉移給 ${newConductor} 嗎？`)) return;
    update(ref(db, `rooms/${roomId}`), { conductor: newConductor });
  };

  const adminResetUserStats = (uid) => {
    if (!window.confirm("確定要【重置】該成員的所有打王數據與時長嗎？此動作不可逆！")) return;
    const userRef = ref(db, `users/${uid}`);
    update(userRef, {
      totalKills: 0,
      totalHours: 0,
      bossStats: null,
      recentActivity: null
    });
  };

  const getUserCurrentLocation = (name) => {
    const activeRoom = Object.values(rooms).find(r => r.members && r.members[name]);
    return activeRoom ? `房號 #${activeRoom.id}` : "大廳";
  };

  const sendGlobalBroadcast = () => {
    if (!broadcastInput.trim()) return;
    set(ref(db, 'globalBroadcast'), {
      message: broadcastInput.trim(),
      ts: Date.now(),
      sender: userName
    });
    setBroadcastInput('');
    alert("📢 全域廣播已發送！所有線上成員將收到語音提示。");
  };

  const renderAdminDashboard = () => {
    const roomList = Object.entries(rooms).map(([id, data]) => ({ id, ...data }));
    const userList = Object.entries(allUsers).map(([uid, data]) => ({ uid, ...data }));
    return (
      <div className="admin-container">
        <div className="admin-header">
          <div className="admin-title">🛡️ 戰略指揮部 <span className="admin-subtitle">最高管理權限</span></div>
          <div className="admin-tabs">
            <button className={`admin-tab ${adminTab === 'rooms' ? 'active' : ''}`} onClick={() => setAdminTab('rooms')}>房間概況</button>
            <button className={`admin-tab ${adminTab === 'users' ? 'active' : ''}`} onClick={() => setAdminTab('users')}>成員數據</button>
          </div>
          <button className="btn-secondary back-lobby-btn-small" onClick={() => setView('lobby')}>返回大廳</button>
        </div>
        <div className="admin-content card-bg glass-panel">
          <div className="admin-broadcast-section">
            <h3>📢 全域語音廣播</h3>
            <div className="broadcast-input-group">
              <input 
                type="text" 
                placeholder="在此輸入重要廣播訊息..." 
                value={broadcastInput} 
                onChange={e => setBroadcastInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendGlobalBroadcast()}
              />
              <button className="btn-primary" onClick={sendGlobalBroadcast}>發送全域廣播</button>
            </div>
          </div>

          {adminTab === 'rooms' ? (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th>房號</th><th>Boss</th><th>密碼</th><th>車長</th><th>當前成員 / 管理</th><th>操作</th></tr></thead>
                <tbody>
                  {roomList.map(r => {
                    const membersMap = r.members || {};
                    return (
                      <tr key={r.id}>
                        <td className="admin-room-id">#{r.id}</td>
                        <td className="admin-boss-name">{BOSSES[r.bossId]?.name || r.bossId}</td>
                        <td className="admin-room-pwd code-font">{r.password}</td>
                        <td className="admin-conductor">{r.conductor}</td>
                        <td className="admin-members">
                          <div className="admin-member-tags">
                            {Object.keys(membersMap).map(m => {
                              const isCond = r.conductor === m;
                              return (
                                <div 
                                  key={m} 
                                  className={`admin-member-tag ${isCond ? 'is-cond' : ''} ${adminMenu?.m === m && adminMenu?.rid === r.id ? 'active' : ''}`}
                                  onClick={() => setAdminMenu(adminMenu?.m === m && adminMenu?.rid === r.id ? null : { rid: r.id, m })}
                                >
                                  <span className="m-name">{isCond ? '👑' : ''} {m}</span>
                                  {adminMenu?.m === m && adminMenu?.rid === r.id && (
                                    <div className="admin-member-actions-popup glass-panel">
                                      {!isCond && <button onClick={(e) => { e.stopPropagation(); adminTransferConductor(r.id, m); setAdminMenu(null); }}>👑 成為車長</button>}
                                      <button className="kick-btn-popup" onClick={(e) => { e.stopPropagation(); adminKickMember(r.id, m); setAdminMenu(null); }}>🥾 強制下車</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {Object.keys(membersMap).length === 0 && <span className="no-members">尚無成員</span>}
                          </div>
                        </td>
                        <td>
                          <button className="admin-btn-view" onClick={() => { setCurrentRoomId(r.id); setView('join'); }}>查看</button>
                          <button className="admin-btn-delete" onClick={() => adminDeleteRoom(r.id)}>解散</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-users-view">
              {Object.keys(allUsers).length === 0 ? (
                <div className="admin-load-data-cta">
                  <div className="bandwidth-warning-box">
                    <h4>⚠️ 頻寬最佳化提示</h4>
                    <p>管理員名錄包含公會全體成員資料，讀取完整名錄會消耗大量流量。建議僅在維護時開啟。</p>
                    <button 
                      className="btn-v9-report" 
                      style={{marginTop: '20px', padding: '15px 40px'}} 
                      onClick={fetchAllUsers}
                      disabled={isUsersLoading}
                    >
                      {isUsersLoading ? '戰略數據讀取中...' : '🛡️ 讀取完整成員名錄 (Download All)'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="admin-user-sub-nav">
                    <div className="sub-nav-btns">
                      <button className={adminUserSubTab === 'stats' ? 'active' : ''} onClick={() => setAdminUserSubTab('stats')}>🔥 績效排行</button>
                      <button className={adminUserSubTab === 'directory' ? 'active' : ''} onClick={() => setAdminUserSubTab('directory')}>🗒️ 名錄管理</button>
                    </div>
                    <div className="admin-search-bar">
                      <input 
                        type="text" 
                        placeholder="搜尋暱稱或 UID..." 
                        value={adminUserSearchTerm}
                        onChange={e => setAdminUserSearchTerm(e.target.value)}
                      />
                    </div>
                    <button className="btn-v9-grey" onClick={fetchAllUsers} style={{marginLeft: '10px'}} disabled={isUsersLoading}>
                      {isUsersLoading ? '刷新中...' : '🔄 重新整理'}
                    </button>
                  </div>
                  
                  {/* --- 申請等待區 (v4.9) --- */}
                  {adminUserSubTab === 'directory' && Object.values(allUsers).some(u => u.status === 'pending') && (
                    <div className="admin-pending-section glass-panel">
                      <h3>🛡️ 申請等待區 (Pending Requests)</h3>
                      <div className="pending-list">
                        {Object.values(allUsers).filter(u => u.status === 'pending').map(pu => (
                          <div key={pu.uid} className="pending-card">
                            <div className="p-user-info">
                              {renderAvatar(pu.photoURL, "p-avatar")}
                              <div className="p-text">
                                <span className="p-name">{pu.displayName}</span>
                                <span className="p-uid">{pu.uid}</span>
                              </div>
                            </div>
                            <div className="p-actions">
                              <button className="btn-approve" onClick={() => adminApproveUser(pu.uid)}>同意</button>
                              <button className="btn-reject" onClick={() => adminRejectUser(pu.uid)}>拒絕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="admin-table-wrapper">
                    {adminUserSubTab === 'stats' ? (
                      <table className="admin-table">
                        <thead><tr><th>完整 UID</th><th>暱稱</th><th>總擊殺</th><th>總打王時間</th></tr></thead>
                        <tbody>
                          {userList
                            .filter(u => (u.nickname || u.displayName || '').includes(adminUserSearchTerm) || u.uid.includes(adminUserSearchTerm))
                            .map(u => (
                            <tr key={u.uid}>
                              <td className="admin-uid code-font" style={{wordBreak: 'break-all', maxWidth: '200px', fontSize: '10px'}}>{u.uid}</td>
                              <td className="admin-nickname">{u.nickname || u.displayName}</td>
                              <td className="admin-kills">{u.totalKills || 0}</td>
                              <td>{(u.totalHours || 0).toFixed(1)} h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="admin-table">
                        <thead><tr><th>成員</th><th>完整 UID</th><th>狀態</th><th>位置</th><th>加入日期</th><th>維護</th></tr></thead>
                        <tbody>
                          {userList
                            .filter(u => (u.nickname || u.displayName || '').includes(adminUserSearchTerm) || u.uid.includes(adminUserSearchTerm))
                            .map(u => (
                            <tr key={u.uid}>
                              <td className="admin-user-cell">
                                {renderAvatar(u.photoURL, "admin-mini-avatar")}
                                <span>{u.nickname || u.displayName}</span>
                              </td>
                              <td className="admin-uid code-font" style={{wordBreak: 'break-all', maxWidth: '200px', fontSize: '10px'}}>{u.uid}</td>
                              <td>
                                <span className={`status-dot ${u.isOnline ? 'online' : 'offline'}`}></span>
                                {u.isOnline ? '線上' : '離線'}
                              </td>
                              <td className="location-text">{getUserCurrentLocation(u.nickname || u.displayName)}</td>
                              <td className="date-text">{u.createdAt ? new Date(u.createdAt).toLocaleString([], {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit'}) : '早期成員'}</td>
                              <td>
                                <button className="btn-danger btn-micro" onClick={() => adminResetUserStats(u.uid)}>重置</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const bossRooms = useMemo(() => {
    if (!roomSummaries) return [];
    return Object.values(roomSummaries).filter(r => r && r.bossId === selectedBossId);
  }, [roomSummaries, selectedBossId]);

  const renderMedalOverview = () => {
    const userKills = currentUser?.profile?.totalKills || 0;
    const currentRank = getRankInfo(userKills);
    
    return (
      <div className="medal-hall-container fade-in">
        <header className="medal-hall-header">
          <div className="hall-title">
            <span className="hall-icon">🏆</span>
            <h1>榮譽殿堂 <small>Honor Hall</small></h1>
          </div>
          <div className="hall-summary glass-panel">
            <div className="summary-main">
              <span className="s-label">當前名望：</span>
              <span className="s-title" style={{color: currentRank.color}}>{currentRank.fullTitle}</span>
              <span className="s-level">Lv.{currentRank.level}</span>
            </div>
            <div className="summary-progress">
              <div className="p-bar-bg"><div className="p-bar-fill" style={{width: `${currentRank.progress}%`, background: currentRank.color}}></div></div>
              <div className="p-text">
                {currentRank.nextKills > 0 ? `距離下一階級還差 ${currentRank.nextKills} 擊殺` : '已達成最高榮耀'}
              </div>
            </div>
          </div>
        </header>

        <div className="medal-grid">
          {RANKS_CONFIG.map((rank, idx) => {
            const isUnlocked = userKills >= rank.minKills;
            const isCurrentTitle = currentRank.title === rank.title;
            
            return (
              <div 
                key={idx} 
                className={`medal-card ${isUnlocked ? 'unlocked' : ''} ${isCurrentTitle ? 'active' : ''}`}
                onClick={() => setSelectedMedal({...rank, levelRange: `Lv.${idx*5+1} - ${idx*5+5}`})}
              >
                <div className="m-badge" style={{borderColor: isUnlocked ? rank.color : 'rgba(255,255,255,0.1)'}}>
                  <span className="m-icon">{rank.badge}</span>
                  {isUnlocked && <div className="m-glow" style={{background: rank.color}}></div>}
                </div>
                <div className="m-info">
                  <div className="m-name" style={{color: isUnlocked ? '#fff' : '#444'}}>{rank.title}</div>
                  <div className="m-req">{isUnlocked ? '已達成' : `解鎖: ${rank.minKills}`}</div>
                  {isCurrentTitle && <div className="m-current-tag">CURRENT</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 勳章詳情彈窗 (v4.4) */}
        {selectedMedal && (
          <div className="medal-detail-overlay fade-in" onClick={() => setSelectedMedal(null)}>
            <div className="medal-detail-popup glass-panel" onClick={e => e.stopPropagation()}>
              <button className="close-popup-btn" onClick={() => setSelectedMedal(null)}>×</button>
              <div className="p-badge-large" style={{borderColor: selectedMedal.color}}>
                <span className="p-icon-large">{selectedMedal.badge}</span>
                <div className="p-glow-large" style={{background: selectedMedal.color}}></div>
              </div>
              <h2 style={{color: selectedMedal.color}}>{selectedMedal.title}</h2>
              <div className="p-level-tag">{selectedMedal.levelRange}</div>
              <p className="p-description">“ {selectedMedal.desc} ”</p>
              <div className="p-stats-row">
                <div className="p-stat-box">
                  <span className="p-s-label">解鎖門檻</span>
                  <span className="p-s-value">{selectedMedal.minKills} 擊殺</span>
                </div>
                <div className="p-stat-box">
                  <span className="p-s-label">階級跨度</span>
                  <span className="p-s-value">每階 {selectedMedal.scale} 殺</span>
                </div>
              </div>
              <button className="v9-btn-confirm" onClick={() => setSelectedMedal(null)} style={{marginTop: '30px', width: '100%'}}>確認收到榮耀</button>
            </div>
          </div>
        )}
        
        <button className="v9-btn-secondary back-lobby-btn" onClick={() => setView('lobby')}>返回大廳中心</button>
      </div>
    );
  };

  const renderContent = () => {
    if (authChecking) return <div className="loading-screen">連線中...</div>;
    try {
      if (view === 'landing' || !currentUser) {
        return (
          <div className="landing-page-container">
            <div className="landing-content glass-panel">
              <h1 className="landing-title neon-text">PIKAPI<br/>GUILD TRACKER</h1>
              <p className="landing-subtitle">專業公會戰役管理・專屬戰報・把愛傳下去 v2.1</p>
              <button className="login-btn-large" onClick={handleLogin}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                使用 Google 帳號登入
              </button>
            </div>
          </div>
        );
      }
      
      // 未申請的使用者畫面 (v4.9)
      if (currentUser && currentUser.profile?.status === 'new' && view === 'landing') {
        return (
          <div className="landing-container">
            <div className="landing-content glass-panel">
              <div className="brand-badge">Step 2: 權限申請</div>
              <h1>歡迎來到 PiKaPi 指揮部</h1>
              {currentUser && (
                <div className="nav-profile-control">
                  {currentUser.uid === ADMIN_UID && view !== 'admin' && (
                    <button className="btn-admin-entrance" onClick={() => setView('admin')}>🛡️ 指揮部</button>
                  )}
                  <div className="user-profile-summary">
                    <span className="user-welcome">Hi, {userName || '英雄'}</span>
                    {renderAvatar(currentUser.photoURL, "header-avatar")}
                  </div>
                  <button className="logout-btn" onClick={handleLogout}>登出</button>
                </div>
              )}
              <p className="landing-subtitle">請點擊下方按鈕向管理員提交「使用申請」，<br/>審核通過後即可開始紀錄。 v2.1</p>
              <button className="apply-btn-premium" onClick={applyForMembership}>
                🚀 提交加入申請
              </button>
              <button 
                className="btn-danger" 
                onClick={handleLogout} 
                style={{marginTop: '20px', background: 'transparent', border: 'none', textDecoration: 'underline', color: 'rgba(255,255,255,0.4)'}}
              >
                切換帳號登出
              </button>
            </div>
          </div>
        );
      }
      const isAdmin = currentUser?.uid === ADMIN_UID;
      const userStatus = currentUser?.profile?.status;

      if (view === 'admin' && isAdmin) return renderAdminDashboard();
      
      // 等待審核或被拒絕的特殊視圖 (v4.9)
      if (currentUser && !isAdmin && userStatus !== 'approved') {
        const isPending = userStatus === 'pending';
        const isRejected = userStatus === 'rejected';

        return (
          <div className="landing-container waiting-room-view">
            <div className="landing-content glass-panel">
              <div className="waiting-animation">
                <span className="wait-icon">{isRejected ? '❌' : '🛡️'}</span>
              </div>
              <h1>{isRejected ? '申請未通過' : '入隊申請審核中'}</h1>
              <p className="landing-subtitle">
                {isRejected 
                  ? '很遺憾，您的申請暫時未獲核准。如有疑問請洽公會幹部。' 
                  : '指揮官正在審核您的申請，請耐心等候。通過後將自動進入大廳。'}
              </p>
              <div className="waiting-actions" style={{marginTop: '30px'}}>
                {isRejected && (
                  <button className="login-btn-large" onClick={applyForMembership}>重新提交申請</button>
                )}
                <button className="btn-danger" onClick={handleLogout} style={{marginTop: '15px'}}>登出帳號</button>
              </div>
            </div>
          </div>
        );
      }
      if (view === 'medals') return renderMedalOverview();
      if (view === 'profile') {
        const stats = currentUser.profile?.bossStats || {};
        const rank = getRankInfo(currentUser.profile?.totalKills, currentUser.profile?.totalHours);
        
        return (
          <div className="profile-page-container">
            <div className="profile-card glass-panel">
              <div className="profile-header">
                <div className="avatar-wrapper" onClick={() => setShowAvatarModal(true)}>
                  <div className="profile-avatar-large">
                    {currentUser.profile?.photoURL?.length <= 4 ? (
                      <span className="avatar-emoji-large">{currentUser.profile.photoURL}</span>
                    ) : (
                      <img src={currentUser.profile?.photoURL || 'https://via.placeholder.com/150'} alt="Avatar" />
                    )}
                  </div>
                  <div className="rank-badge-overlay">{rank.badge}</div>
                  <div className="avatar-edit-overlay">更換</div>
                </div>
                <div className="profile-info">
                  <h2 className="profile-full-title" style={{ color: rank.color }}>{rank.fullTitle}</h2>
                  <div className="rank-pill-badge">Lv.{rank.level}</div>
                  <p className="profile-user-name">暱稱: {userName}</p>
                  <p className="profile-uid" style={{fontSize: '10px', opacity: 0.5}}>{currentUser.uid}</p>
                  <div className="profile-edit-name">
                    <input type="text" className="v9-profile-input" defaultValue={userName} id="profileNameInput" placeholder="暱稱" />
                    <button className="v9-btn-primary" onClick={() => updateProfileName(document.getElementById('profileNameInput').value)}>更新名稱</button>
                    <button className="v9-btn-secondary" onClick={() => setShowAvatarModal(true)}>更換頭像</button>
                  </div>
                </div>
              </div>
              
              <div className="profile-stats-summary">
                <div className="stat-main">
                  <span className="label">總擊殺紀錄</span>
                  <span className="value">{currentUser.profile?.totalKills || 0} <small>隻</small></span>
                </div>
                <div className="stat-main">
                  <span className="label">總站崗時長</span>
                  <span className="value">{(currentUser.profile?.totalHours || 0).toFixed(1)} <small>h</small></span>
                </div>
              </div>

              <div className="mastery-section">
                <h3>👾 野王專精數據 (Boss Mastery)</h3>
                <div className="mastery-grid">
                  {Object.entries(BOSSES).map(([id, boss]) => {
                    const bStats = stats[id] || { kills: 0, hours: 0 };
                    return (
                      <div key={id} className="mastery-card" style={{ borderLeft: `4px solid ${boss.color}` }}>
                        <div className="m-boss-icon" style={{ backgroundColor: `${boss.color}22`, color: boss.color }}>{boss.name[0]}</div>
                        <div className="m-info">
                          <div className="m-name">{boss.name}</div>
                          <div className="m-stats">
                            <span>擊殺: <strong>{bStats.kills || 0}</strong></span>
                            <span>時長: <strong>{(bStats.hours || 0).toFixed(1)}h</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="recent-activity-section">
                <h3>📜 近期戰果 (Recent Highlights)</h3>
                <div className="activity-list">
                  {(currentUser.profile?.recentActivity || []).length === 0 && <div className="empty-msg">尚無擊殺紀錄，快去打王吧！</div>}
                  {(currentUser.profile?.recentActivity || []).map((act, i) => (
                    <div key={i} className="activity-item">
                      <span className="act-time">{new Date(act.at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className="act-boss">{act.bossName}</span>
                      <span className="act-ch">{act.ch}</span>
                      <span className="act-badge">擊殺 ✅</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <button className="v9-btn-secondary back-lobby-btn" onClick={backToLobby}>返回大廳中心</button>
            </div>
          </div>
        );
      }
      if (view === 'lobby') {
        return (
          <div className="lobby-container">
            <header className="lobby-header">
              <div className="version-tag">Build v2.1 - 指揮中心已上線</div>
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
              <div className="lobby-btn-group">
                <button className="create-btn" onClick={() => setShowCreateModal(true)}>創建打王房間</button>
                <button 
                  className={`refresh-btn ${isSummariesLoading ? 'loading' : ''}`} 
                  onClick={fetchRoomSummaries}
                  title="刷新房況"
                >
                  <span className="refresh-icon">🔄</span>
                  {lastSummariesUpdate && (
                    <small className="last-update-ts">
                      上次更新於 {new Date(lastSummariesUpdate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </small>
                  )}
                </button>
              </div>
            </section>
            <section className="room-list">
              <h3>房間列表 - {BOSSES[selectedBossId].name}</h3>
              <div className="list-container">
                <div className="list-header lobby-table-header">
                  <span>房號</span><span>車長</span><span>人數</span><span>持續時間</span><span>狀態</span><span>操作</span>
                </div>
                {bossRooms.length === 0 && <div className="empty-msg">目前沒有房間，快去當車長吧！</div>}
                {bossRooms.map(room => (
                  <div key={room.id} className="list-row">
                    <div className="col-ch">{room.id}</div>
                    <div className="col-boss">{room.conductor}</div>
                    <div className="col-timer">{room.onlineCount || 1}/4</div>
                    <div className="col-status">{formatTime(now - room.createdAt)}</div>
                    <div className="col-window">熱烈打王中...</div>
                    <div className="col-actions">
                      <button className="row-kill-btn" onClick={() => { setCurrentRoomId(room.id); setView('join'); setJoinNameInput(userName); }}>加入房間</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {showCreateModal && (
              <div className="modal-overlay">
                <div className="modal">
                  <h2>創建房間 - {BOSSES[selectedBossId].name}</h2>
                  <div className="v9-readonly-input">
                    <span className="label">車長名稱 :</span>
                    <span className="value">{userName}</span>
                  </div>
                  <div className="modal-btns">
                    <button onClick={createRoom}>確定</button>
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
        if (!room) return <div className="error-view">房間已不存在 <button onClick={backToLobby}>回大廳</button></div>;
        return (
          <div className="join-container">
            <div className="modal">
              <h2>加入房間 {currentRoomId}</h2>
              <p>Boss: {BOSSES[room.bossId]?.name}</p>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="密碼" />
              <input value={joinNameInput} onChange={(e) => setJoinNameInput(e.target.value)} placeholder="您的名稱" />
              <div className="modal-btns">
                <button onClick={joinRoom}>上車</button>
                <button onClick={backToLobby} className="cancel-btn">回大廳</button>
              </div>
            </div>
          </div>
        );
      }
      if (view === 'room' && currentRoom) {
        const isConductor = currentRoom.conductor === userName;
        const members = Object.keys(currentRoom.members || {});
        const records = currentRoom.records || {};
        const sessionDurationHrs = sessionStartTime ? (Date.now() - sessionStartTime) / (1000 * 60 * 60) : 0;
        const efficiency = sessionDurationHrs > 0 ? (sessionKills / sessionDurationHrs).toFixed(1) : '0.0';

        return (
          <div className={`room-container-v25 boss-theme-${currentRoom.bossId} fade-in`}>
            {/* --- V9.0 SIDEBAR: 4 MODULES --- */}
            <aside className="v25-sidebar">
              {/* Box 1: Identity */}
              <div className="hud-card active-segment">
                <span className="hud-label">您的身分 :</span>
                <div className="v7-identity">
                  <span className="v9-role-badge">{isConductor ? '幸運車長' : '車內成員'}</span>
                  <span className="v7-name">{userName}</span>
                </div>
              </div>

              {/* Box 2: Members */}
              <div className="hud-card">
                <span className="hud-label">車內成員 {members.length}/4</span>
                <div className="v9-members-list">
                  {Object.entries(currentRoom.members || {}).map(([mName, mData]) => (
                    <div key={mName} className={`v9-member-item ${mName === userName ? 'is-me' : ''}`}>
                      <div className="v9-member-avatar-box">
                        <div className="v9-mini-avatar">
                          {mData.photoURL?.length <= 4 ? <span>{mData.photoURL}</span> : <img src={mData.photoURL} alt="p" />}
                        </div>
                        <span className={`status-dot-v9 ${mData.isOnline ? 'online' : 'offline'}`}></span>
                      </div>
                      <span className="member-name">{mName}</span>
                      {mName === currentRoom.conductor ? (
                        <span className="v9-conductor-badge">👑 車長</span>
                      ) : (
                        isConductor && (
                          <div className="v9-member-ctx-actions">
                            <button className="v9-ctx-btn-gold" onClick={() => transferConductor(mName)} title="移交車長">👑</button>
                            <button className="v9-ctx-btn-red" onClick={() => removeMember(mName)} title="請下車">❌</button>
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 3: Boss Information */}
              <div className="hud-card">
                <span className="hud-label">BOSS 資訊</span>
                <div style={{fontSize:'0.85rem', lineHeight:'1.8', color:'#ccc'}}>
                  <div>{currentBoss.name}</div>
                  <div>重生時間: {currentBoss.time} 分鐘</div>
                  <div>地區: 開發者地圖</div>
                </div>
              </div>

              {/* Box 4: Kill Report (Deep Analysis) */}
              <div className="hud-card">
                <span className="hud-label">📊 擊殺報告 (TODAY)</span>
                
                <div className="stats-section-v9">
                  <span className="stats-sub-label">房內總累計 (OVERALL)</span>
                  <div className="stats-row">房號 / BOSS: <span style={{fontSize:'0.75rem'}}>{currentRoomId} - {currentBoss.name}</span></div>
                  <div className="stats-row">總擊殺次數: <b>{currentRoom.totalKills || 0} 次</b></div>
                  <div className="stats-row">總共航程: <span>{formatTime(now - currentRoom.createdAt)}</span></div>
                </div>

                <div className="stats-section-v9">
                  <span className="stats-sub-label">您的隨車里程 (YOUR SESSION)</span>
                  <div className="stats-grid-v9">
                    <div className="stat-box-v9"><b>{formatTime(Date.now() - (sessionStartTime || Date.now()))}</b><span>已隨車</span></div>
                    <div className="stat-box-v9"><b>{sessionKills} 次</b><span>共獲取</span></div>
                    <div className="stat-box-v9"><b>{efficiency}</b><span>時點效率</span></div>
                  </div>
                </div>

                <div style={{marginTop:'20px', display:'flex', flexDirection:'column', gap:'10px'}}>
                  <button className="v9-btn bg-yellow" style={{width:'100%'}} onClick={exportReport}>🖼️ 匯出擊殺戰報 (PNG)</button>
                  <button className="v9-btn bg-pink" style={{width:'100%'}} onClick={() => setShowInheritanceModal(true)}>把愛傳下去 (繼承給他房)</button>
                </div>
              </div>
            </aside>

            {/* --- MAIN AREA: V9.0 HEADER & TABLE --- */}
            <main className="v25-main">
              <header className="room-top-bar">
                <div className="v9-room-info">
                  <h2>房號: {currentRoomId}</h2>
                  <span>房間密碼:</span>
                  <div className="v9-pwd-area">
                    <div className="v9-pwd-box">{currentRoom.password}</div>
                    <button className="btn-v9-copy" onClick={() => {
                      navigator.clipboard.writeText(currentRoom.password || '');
                      alert('密碼已複製！');
                    }}>複製</button>
                  </div>
                </div>

                <div className="v9-control-group">
                  <button className="btn-v9-grey" onClick={() => setShowVoiceSettings(true)}>⚙️ 語音設定</button>
                  <button className="btn-v9-yellow" onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('連結已複製！');
                  }}>分享房間連結</button>
                  <button className="btn-v9-red" onClick={() => setShowLeaveModal(true)}>下車離開 (返回大廳)</button>
                  <button className="btn-v9-orange" onClick={toggleWildBossExplore}>
                    {currentRoom.wildBossExplore?.[userName] ? '🍖 取消打野' : '🍖 餓了去打野'}
                  </button>
                </div>
              </header>

              <div className="main-glass-panel">
                {/* --- Wild Boss Exploration Banner (v2.3) --- */}
                {currentRoom.wildBossExplore && Object.keys(currentRoom.wildBossExplore || {}).length > 0 && (
                  <div className="v9-wild-banner fade-in">
                    <span className="wild-icon">🍖</span>
                    <span className="wild-text">
                      <b>戰術通報 :</b> {Object.keys(currentRoom.wildBossExplore).join(', ')} 正在各頻道打野中...
                    </span>
                  </div>
                )}

                <div className="kill-input-v25">
                  <input 
                    type="text" 
                    className="v25-input" 
                    placeholder="輸入頻道 (例: 5)" 
                    value={inputChannel}
                    onChange={e => setInputChannel(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addRecord()}
                  />
                  <button className="btn-v9-report" onClick={() => addRecord()}>已擊殺開始計時</button>
                </div>

                  <div className="v25-table">
                    <div id="kill-report-card" className="v25-table-container">
                      <div className="v25-table-header">
                        <span>頻道</span>
                        <span>野王名稱</span>
                        <span>倒數計時</span>
                        <span>目前狀態</span>
                        <span>回報者</span>
                        <span style={{textAlign:'right'}}>頻道操作</span>
                      </div>

                      {Object.keys(records).length === 0 ? (
                        <div style={{textAlign:'center', padding:'80px', color:'#444', fontStyle:'italic'}}>等待車員回報戰況...</div>
                      ) : (
                        Object.keys(records).sort((a,b) => records[a].lastKill - records[b].lastKill).map(ch => {
                          const remaining = currentBoss.time - (now - records[ch].lastKill) / 60000;
                          const isReady = remaining <= 0;
                          const occupant = records[ch].occupant || '';
                          
                          return (
                            <div key={ch} className={`v25-row ${isReady ? 'is-ready' : ''}`}>
                              {/* 1. 頻道與佔位 */}
                              <div className="v4-ch-group-v9">
                                <span className="v5-ch-id">CH {ch.replace('CH','').trim()}</span>
                                <div className="v9-occupant-container">
                                  {occupant && <span className="v9-occupant-tag-v9">📍 {occupant}</span>}
                                </div>
                              </div>

                              {/* 2. 野王名稱 */}
                              <div className="v5-boss-name">{currentBoss.name}</div>

                              {/* 3. 倒數計時 */}
                              <div className={`v5-timer ${isReady ? 'ready' : ''}`}>
                                {isReady ? 'READY' : formatTime(remaining * 60000)}
                              </div>

                              {/* 4. 目前狀態 */}
                              <div>
                                <span className={`v5-status-badge ${isReady ? 'v5-status-ready' : 'v5-status-waiting'}`}>
                                  {isReady ? '已重生' : '重生中'}
                                </span>
                              </div>

                              {/* 5. 回報者 */}
                              <div className="v9-reporter-chip">
                                👤 {records[ch].reporter}
                              </div>

                              {/* 6. 頻道操作 */}
                              <div className="v5-btn-set">
                                <button className="v9-btn bg-purple" onClick={() => handleStationed(ch)}>已佔位</button>
                                {!isReady ? (
                                  <button className="v9-btn bg-yellow" onClick={() => handleRespawned(ch)}>已重生</button>
                                ) : (
                                  <button className="v9-btn bg-pink" onClick={() => addRecord(ch)}>已擊殺</button>
                                )}
                                <button className="v9-btn bg-blue" onClick={() => broadcastStatus(ch)}>🔊 廣播</button>
                                <button className="v9-btn bg-red" onClick={() => removeRecord(ch)}>刪除</button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
              </div>
            </main>
          </div>
        );
      }
      return <div>未知頁面</div>;
    } catch (err) {
      return <div className="error-view">系統錯誤 <button onClick={backToLobby}>返回</button></div>;
    }
  };

  return (
    <div className={`app-wrapper ${view}-view`}>
      {globalBroadcast && (
        <div className="global-broadcast-banner">
          <div className="banner-content">
            <span className="banner-icon">📢</span>
            <span className="banner-text">【指揮中心公告】{globalBroadcast.message}</span>
            <span className="banner-close" onClick={() => setGlobalBroadcast(null)}>×</span>
          </div>
        </div>
      )}
      <header className="global-header">
        <div className="header-logo" onClick={() => (currentUser ? setView('lobby') : setView('landing'))}>
          <span>PiKaPi</span> <span className="boss-highlight">BOSS</span> Tracker
        </div>
          {!currentUser ? (
            <div className="header-actions">
              <button className="login-btn-small" onClick={handleLogin}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '18px', marginRight: '8px', verticalAlign: 'middle' }} />
                <span>Google 登入</span>
              </button>
            </div>
          ) : (
            <div className="user-profile-menu header-actions">
              <button 
                className={`medal-hall-btn ${view === 'medals' ? 'active' : ''}`} 
                onClick={() => setView('medals')}
              >
                🎖️ 勳章總覽
              </button>
              {currentUser?.uid === ADMIN_UID && (
                <button 
                  className={`admin-entry-btn ${view === 'admin' ? 'active' : ''}`} 
                  onClick={() => setView('admin')}
                >
                  🛡️ 指揮部
                </button>
              )}
              <span className="user-greeting">Hi, {userName}</span>
              <div className="header-avatar-v9" onClick={() => setView('profile')}>
                {renderAvatar(currentUser.photoURL, "header-avatar-img", { width: '100%', height: '100%' })}
              </div>
              <button className="btn-danger logout-btn" onClick={handleLogout}>登出</button>
            </div>
          )}
      </header>
      <main className="main-content-area">{renderContent()}</main>
      {showInheritanceModal && (
        <div className="modal-overlay inheritance-modal" onClick={() => setShowInheritanceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>❤️ 把愛傳下去</h2>
            <div className="love-list">
              {bossRooms.filter(r => r.id !== currentRoomId).map(room => (
                <button key={room.id} onClick={() => sendInheritanceRequest(room.id)}>傳給房號 {room.id} ({room.conductor})</button>
              ))}
            </div>
            <button className="love-cancel-btn" onClick={() => setShowInheritanceModal(false)}>取消</button>
          </div>
        </div>
      )}
      {currentRoom?.inheritanceRequest?.status === 'pending' && currentRoom.conductor === userName && (
        <div className="incoming-love-overlay">
          <div className="love-popup">
            <h3>來自房號 {currentRoom.inheritanceRequest.fromRoomId} 的愛</h3>
            <div className="love-actions">
              <button className="accept-love" onClick={() => handleInheritanceResponse(true)}>接受 ❤️</button>
              <button className="decline-love" onClick={() => handleInheritanceResponse(false)}>拒絕 💔</button>
            </div>
          </div>
        </div>
      )}
      {showAvatarModal && (
        <div className="modal-overlay avatar-modal" onClick={() => setShowAvatarModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="v9-modal-header">
              <h2>選擇頭像</h2>
              <p>挑選一個可愛符號</p>
            </div>

            <div className="emoji-selection-grid">
              {DEFAULT_ANIMALS.map(emoji => (
                <div 
                  key={emoji} 
                  className={`emoji-option ${selectedEmoji === emoji ? 'active' : ''}`}
                  onClick={() => setSelectedEmoji(emoji)}
                >
                  {emoji}
                </div>
              ))}
            </div>

            <div className="v9-modal-divider"></div>

            <div className="modal-btns">
              <button 
                className="v9-btn-confirm"
                onClick={() => {
                  if (selectedEmoji) {
                    updateProfileAvatar(selectedEmoji);
                    setShowAvatarModal(false);
                  }
                }}
                disabled={!selectedEmoji}
              >
                確認更換
              </button>
              <button onClick={() => setShowAvatarModal(false)} className="v9-btn-cancel">取消</button>
            </div>
          </div>
        </div>
      )}
      {showLeaveModal && (
        <div className="modal-overlay leave-modal" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-content v9-card-modal" onClick={e => e.stopPropagation()}>
            <div className="v9-modal-header centered">
              <h2 className="text-gold">【下車前資訊提醒】</h2>
              <p>請確認是否記錄好相關資訊：</p>
            </div>
            
            <div className="v9-info-cards">
              <div className="v9-info-card">
                <label>您的名稱：</label>
                <div className="v9-card-val text-gold">{userName}</div>
              </div>

              <div className="v9-info-card">
                <label>房間密碼：</label>
                <div className="v9-card-pwd-row">
                  <div className="v9-card-val text-gold mono">{rooms[currentRoomId]?.password}</div>
                  <button className="v9-copy-btn-mini" onClick={() => {
                    navigator.clipboard.writeText(rooms[currentRoomId]?.password);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}>
                    {copySuccess ? '已複製' : '複製'}
                  </button>
                </div>
              </div>
            </div>

            {Object.keys(rooms[currentRoomId]?.members || {}).length === 1 && (
              <div className="v9-warning-box">
                <span>⚠️ 注意：您是最後一位成員，下車後該房間將成為<span className="text-red">無人房</span>！下一位進入的玩家將繼承成為車長！</span>
              </div>
            )}

            <div className="modal-btns stacked">
              <button className="v9-btn-confirm btn-v9-white" onClick={confirmLeave}>確認紀錄並下車</button>
              <button className="v9-btn-cancel-dark" onClick={() => setShowLeaveModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {showVoiceSettings && (
        <div className="modal-overlay voice-modal v30-overlay" onClick={() => setShowVoiceSettings(false)}>
          <div className="v30-hud-console" onClick={e => e.stopPropagation()}>
            <div className="v30-console-header">
              <div className="v30-title-group">
                <span className="v30-accent-bar"></span>
                <div className="v30-title-text">
                  <h2>VOICE SYSTEM CONFIG</h2>
                  <p>TACTICAL COMMUNICATION MODULE v3.0</p>
                </div>
              </div>
              <button className="v30-close-btn" onClick={() => setShowVoiceSettings(false)}>×</button>
            </div>

            <div className="v30-console-body">
              {/* Voice Engine Selection */}
              <div className="v30-control-section">
                <div className="v30-section-label">
                  <span className="dot"></span> 語音引擎選擇 (ENGINE SELECT)
                </div>
                <div className="v30-select-container">
                  <select 
                    value={voiceSettings.voiceURI} 
                    onChange={e => setVoiceSettings(prev => ({ ...prev, voiceURI: e.target.value }))}
                  >
                    <option value="">DEFAULT SYSTEM VOICE</option>
                    {availableVoices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                  <div className="v30-select-icon">▼</div>
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="v30-sliders-grid">
                <div className="v30-control-section">
                  <div className="v30-section-label">
                    <span className="dot"></span> 語音速率 (RATE: {voiceSettings.rate}x)
                  </div>
                  <div className="v30-range-wrapper">
                    <input 
                      type="range" min="0.5" max="2" step="0.1" 
                      className="v30-range-input"
                      value={voiceSettings.rate} 
                      onChange={e => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))} 
                    />
                    <div className="v30-range-track-bg"></div>
                  </div>
                </div>

                <div className="v30-control-section">
                  <div className="v30-section-label">
                    <span className="dot"></span> 音調頻率 (PITCH: {voiceSettings.pitch}x)
                  </div>
                  <div className="v30-range-wrapper">
                    <input 
                      type="range" min="0.5" max="2" step="0.1" 
                      className="v30-range-input"
                      value={voiceSettings.pitch} 
                      onChange={e => setVoiceSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))} 
                    />
                    <div className="v30-range-track-bg"></div>
                  </div>
                </div>
              </div>

              {/* Preview & Action */}
              <div className="v30-console-footer">
                <div className="v30-status-info">
                  <div className="v30-sync-light"></div>
                  <span>系統狀態: 待命 (READY)</span>
                </div>
                <div className="v30-action-group">
                  <button className="v30-btn-test" onClick={handleTestVoice}>
                    <span className="icon">🔊</span> 測試播放 (TEST PREVIEW)
                  </button>
                  <button className="v30-btn-confirm" onClick={() => setShowVoiceSettings(false)}>
                    套用並關閉 (APPLY)
                  </button>
                </div>
              </div>
            </div>
            
            {/* Decoration Elements */}
            <div className="v30-decorator-tl"></div>
            <div className="v30-decorator-br"></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
