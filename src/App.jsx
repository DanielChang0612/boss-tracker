import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth, googleProvider } from './firebase';
import { ref, onValue, set, update, remove, onDisconnect, get, off, query, orderByChild, equalTo, limitToFirst, limitToLast, startAt, endAt, child, increment, onChildAdded, onChildChanged, onChildRemoved, push } from 'firebase/database';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import html2canvas from 'html2canvas';
import './membership.css';
import HubView from './components/HubView';
import ExpHelper from './components/ExpHelper/ExpHelper';

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
  '🎁', '🎀', '🧸', '🪁', '🎮', '🎨', '🍓', '😒',
  '⚽️', '🍆', '🐳', '🐬', '🤡', '🍼', '💩', '🥵'
];

// BOSS 定義
const BOSSES = {
  croco: { name: "沼澤巨鱷", time: 105, area: "維多利亞島", color: "#2e7d32" },
  doll: { name: "仙人娃娃", time: 178, area: "桃花仙境", color: "#f48fb1" },
  bear: { name: "肯得熊", time: 128, area: "桃花仙境", color: "#795548" },
  mushroom: { name: "蘑菇王", time: 240, area: "維多利亞島", color: "#d32f2f" },
  zombie_mushroom: { name: "殭屍菇菇", time: 40, maxTime: 60, timeText: "40 ~ 60 分鐘", area: "維多利亞島", color: "#ab47bc" },
  deetloi: { name: "迪特和洛伊", time: 165, area: "納希沙漠", color: "#ffb300" },
  chimera: { name: "奇美拉", time: 135, area: "納希沙漠", color: "#7b1fa2" },
  guard: { name: "自動警備系統", time: 173, area: "納希沙漠", color: "#455a64" },
  twins: { name: "紅藍雙怪", time: 135, area: "納希沙漠", color: "#1976d2" },
  test: { name: "測試王", time: 0.25, area: "開發者地圖", color: "#607d8b" }
};

// 維多利亞島 殭屍菇菇 熱門戰利品下拉預設 (v1.0)
const ZOMBIE_MUSHROOM_LOOT_PRESETS = [
  "短杖魔力卷軸60%",
  "單手劍攻擊卷軸60%",
  "單手斧攻擊卷軸60%",
  "腰帶敏捷卷軸60%",
  "腰帶智力卷軸60%",
  "火槍攻擊卷軸60%",
  "指虎攻擊卷軸60%",
  "寵物速度卷軸60%",
  "長杖魔力卷軸60%",
  "單手棍攻擊卷軸60%",
  "弩攻擊卷軸60%",
  "弓攻擊卷軸60%",
  "拳套攻擊卷軸60%",
  "短劍攻擊卷軸60%",
  "矛攻擊卷軸60%",
  "槍攻擊卷軸60%",
  "雙手棍攻擊卷軸60%",
  "雙手斧攻擊卷軸60%",
  "雙手劍攻擊卷軸60%",
  "日之鏢"
];

const ROOM_AUTO_DELETE_MS = 2 * 60 * 60 * 1000; // 恢復為 2 小時戰略緩衝
const ADMIN_UID = 'OFJlOe2XIXWfihSrJu49MzHKLgv1'; // 其他管理員的 UID
const PIKA_UID = 'dVqiQcpgNqR5xgHZbeGjsncgHeN2'; // 最高指揮官不可被刪除或操作

const getRoleInfo = (uid) => {
  if (uid === PIKA_UID) return { role: 'Pika', desc: '最高指揮官不可被刪除或操作', color: '#ffb74d' };
  if (uid === ADMIN_UID) return { role: '管理員', desc: '戰略指揮部管理員', color: '#4fc3f7' };
  return { role: '成員', desc: '一般作戰成員', color: '#888' };
};

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
    progress: isMax ? 100 : Math.min(99, ((kills - (config.minKills + (currentSubRank - 1) * config.scale)) / config.scale) * 100)
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
  const [availableVoices, setAvailableVoices] = useState([]);
  const [serverOffset, setServerOffset] = useState(0); // V16.7: 伺服器時間偏移對齊
  const [wildBossExplore, setWildBossExplore] = useState(false); // V16.8: 打野偵察模式開關
  const [exploreChannelInput, setExploreChannelInput] = useState(''); // V16.8: 打野偵察輸入
  const [isEditingPassword, setIsEditingPassword] = useState(false); // V16.9: 修改密碼模式
  const [newPasswordInput, setNewPasswordInput] = useState(''); // V16.9: 新密碼輸入
  const lastProcessedMsg = useRef(''); // V16.8.4: 防止重複語音

  // V17.5: 啟動時預先喚醒語音引擎
  useEffect(() => {
    window.speechSynthesis.resume();
  }, []);

  const [voiceSettings, setVoiceSettings] = useState(() => {
    const saved = localStorage.getItem('pikapi_voice_settings');
    const defaultSettings = {
      voiceURI: '',
      rate: 1.1,
      pitch: 1,
      volume: 1,
      isMuted: false
    };
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);
  const availableVoicesRef = useRef(availableVoices);
  useEffect(() => { availableVoicesRef.current = availableVoices; }, [availableVoices]);

  // V17.2: 語音佇列排隊系統
  const speechQueue = useRef([]);
  const isSpeaking = useRef(false);

  const processSpeechQueue = () => {
    // 守衛 1: 如果已經在講話了，就離開，交給 onend 處理
    if (isSpeaking.current) return;

    // 守衛 2: 如果隊列沒東西了，就停止
    if (speechQueue.current.length === 0) {
      isSpeaking.current = false;
      return;
    }

    const vSet = voiceSettingsRef.current;

    // 守衛 3: 如果靜音，清空隊列並停止
    if (vSet.isMuted) {
      console.log(`[語音序列] 目前靜音中，清空此次請求`);
      speechQueue.current = [];
      isSpeaking.current = false;
      return;
    }

    // 正式抓取文字
    const text = speechQueue.current.shift();
    if (!text) {
      // 雙重保險：如果抓到 undefined/null，繼續下一個或結束
      setTimeout(processSpeechQueue, 100);
      return;
    }

    // 鎖定狀態
    isSpeaking.current = true;
    console.log(`[語音序列] 準備播放: "${text}"，剩餘佇列: ${speechQueue.current.length}`);

    const utterance = new SpeechSynthesisUtterance(text);
    const vAvail = availableVoicesRef.current;
    const selectedVoice = vAvail.find(v => v.voiceURI === vSet.voiceURI);

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = vSet.rate;
    utterance.pitch = vSet.pitch;
    utterance.volume = vSet.volume ?? 1;
    utterance.lang = 'zh-TW';

    utterance.onstart = () => {
      console.log(`[語音序列] 正式開始唸: "${text}"`);
    };
    utterance.onend = () => {
      console.log(`[語音序列] 唸完囉: "${text}"`);
      isSpeaking.current = false;
      // 增加 200ms 緩衝，給引擎反應時間再唸下一條
      setTimeout(processSpeechQueue, 200);
    };
    utterance.onerror = (e) => {
      console.error(`[語音序列] 發生非預期中斷(${e.error})`, e);
      isSpeaking.current = false;

      // V17.5: 若被插斷，代表引擎不穩，給予更長的緩衝期 (1秒)
      const delay = e.error === 'interrupted' ? 1000 : 200;
      setTimeout(processSpeechQueue, delay);
    };

    // V17.5: 這是 Chrome 的救命草，強制喚醒引擎
    window.speechSynthesis.resume();
    window._pikapi_latest = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // V16.0: 戰術性多會話鎖定機制 (Session Lock)
  const currentSessionId = useRef(Math.random().toString(36).slice(2)).current;
  const [isKickedByOtherDevice, setIsKickedByOtherDevice] = useState(false);

  const [presenceData, setPresenceData] = useState({});
  const [allUsers, setAllUsers] = useState({});
  const [pendingUsers, setPendingUsers] = useState({}); // 即時監聽申請中用戶 (獨立於所有用戶)
  const [adminTab, setAdminTab] = useState('rooms'); // 'rooms' | 'users' | 'logs'
  const [systemLogs, setSystemLogs] = useState([]); // 全域系統日誌 (v17.9)
  const [showLogGuide, setShowLogGuide] = useState(false); // 是否顯示日誌說明

  // 排行榜流量優化計時器 (v8.2)
  const [syncCountdown, setSyncCountdown] = useState(0); // 5s 執行倒數
  const [syncCooldown, setSyncCooldown] = useState(0);   // 60s 冷卻計時
  const [adminUserSubTab, setAdminUserSubTab] = useState('stats'); // 'stats' | 'directory'
  const [adminUserSearchTerm, setAdminUserSearchTerm] = useState(''); // 搜尋過濾
  const [sessionStartTime, setSessionStartTime] = useState(null); // 個人站崗計時器
  const [sessionKills, setSessionKills] = useState(0); // 本次隨車累計擊殺 (v1.6.2)
  const [globalBroadcast, setGlobalBroadcast] = useState(null); // 全域公告節點
  const [broadcastInput, setBroadcastInput] = useState(''); // 管理員廣播輸入框
  const [lastJoinedRoomId, setLastJoinedRoomId] = useState(localStorage.getItem('pikapi_last_room') || null); // 真正進入過的房間 (v12.5)
  const [adminMenu, setAdminMenu] = useState(null); // { rid, m }
  const [showAvatarModal, setShowAvatarModal] = useState(false); // 預設頭像彈窗
  const [selectedEmoji, setSelectedEmoji] = useState(null); // 選中的 Emoji
  const [copySuccess, setCopySuccess] = useState(false); // 複製密碼成功狀態
  const [isUsersLoading, setIsUsersLoading] = useState(false); // 管理員加載狀態
  const [isSummariesLoading, setIsSummariesLoading] = useState(false); // 大廳加載狀態
  const [lastSummariesUpdate, setLastSummariesUpdate] = useState(null); // 上次刷新時間
  const [isTabActive, setIsTabActive] = useState(true); // 頁面是否在前景 (v3.3)
  const [selectedMedal, setSelectedMedal] = useState(null); // 當前點選查看的勳章 (v4.4)
  const [showMobileHud, setShowMobileHud] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  // --- 把愛傳下去相關狀態 (v13.0) ---
  const [showLoveModal, setShowLoveModal] = useState(false);
  const [loveStep, setLoveStep] = useState(1); // 1: 選擇房間, 2: 選擇頻道, 3: 毀滅確認
  const [selectedTargetRoomId, setSelectedTargetRoomId] = useState(null);
  const [incomingLoveRequest, setIncomingLoveRequest] = useState(null); // v13.0: 接收方請求
  const [loveTransferMode, setLoveTransferMode] = useState('all');     // v13.0: 傳送模式
  useEffect(() => {
    if (!currentUser) return;
    // 1. 大廳摘要監聽器 (極速同步核心) - v15.2: 全面改為 onValue 智慧差量更新
    const unsub = onValue(ref(db, 'roomSummaries'), (snap) => {
      const data = snap.val() || {};
      setRoomSummaries(data);
      setLastSummariesUpdate(Date.now());
      // 正在房內時，同步摘要進入 local room 狀態
      if (currentRoomId && data[currentRoomId]) {
        // v16.4: 摘要變動同步至房內 (已由另一個 useEffect 處理 setRooms)
      }
    }, (err) => {
      console.warn("Lobby sync permission delay:", err.message);
    });
    return () => unsub();
  }, [currentUser, currentRoomId]);
  const [leaderboardCategory, setLeaderboardCategory] = useState('boss'); // 'boss' | 'exp'
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('allTime'); // 'allTime' | 'monthly'
  const [leaderboardMetric, setLeaderboardMetric] = useState('kills'); // 'kills' | 'hours' (新增補回)
  const [leaderboardExpMetric, setLeaderboardExpMetric] = useState('gainedExp'); // 'gainedExp' | 'peakPace' | 'hours' | 'level'
  const [leaderboardExpPeriod, setLeaderboardExpPeriod] = useState('today'); // 'today' | 'monthly' | 'allTime'
  const [leaderboardMonth, setLeaderboardMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [availableRankMonths, setAvailableRankMonths] = useState([]);
  const [availableExpMonths, setAvailableExpMonths] = useState([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const lastAlertTs = useRef(Date.now()); // V15.8: 語音警報過濾器
  const isAdmin = currentUser?.uid === ADMIN_UID || currentUser?.uid === PIKA_UID;
  const [roomAlertToast, setRoomAlertToast] = useState(null); // 房內重生與區間倒數 Toast 通報
  const notifiedEventsRef = useRef({}); // { [ch_timestamp]: { min: boolean, max: boolean } }

  // 殭屍菇菇戰利品分紅 (極簡版) 本地輸入狀態
  const [lootPreset, setLootPreset] = useState('');
  const [lootCustomName, setLootCustomName] = useState('');
  const [lootAmount, setLootAmount] = useState('');

  // 房間成員分頁狀態 (每頁固定 4 人)
  const [memberPage, setMemberPage] = useState(1);

  // 自動關閉房內重生 Toast
  useEffect(() => {
    if (roomAlertToast) {
      const t = setTimeout(() => setRoomAlertToast(null), 5500);
      return () => clearTimeout(t);
    }
  }, [roomAlertToast]);


  // --- V16.1: 戰術會話全時管控系統 (24h 無死角偵測) ---
  useEffect(() => {
    if (!currentUser) return;
    const sessionRef = ref(db, `presence/${currentUser.uid}/activeSession`);

    // 1. 全時監聽 (無論在前台或背景，只要偵測到新連線，立即斷開本分頁同步行為)
    const unsubSession = onValue(sessionRef, (snap) => {
      const dbSessId = snap.val();
      if (dbSessId && dbSessId !== currentSessionId) {
        setIsKickedByOtherDevice(true);
      }
    });

    // 2. 獲取主權：當切換至本分頁時，奪取 activeSession 全域標記
    if (isTabActive && !isKickedByOtherDevice) {
      update(ref(db, `presence/${currentUser.uid}`), {
        activeSession: currentSessionId,
        isOnline: true,
        lastSeen: Date.now()
      });
    }

    return () => unsubSession();
  }, [currentUser, isTabActive, isKickedByOtherDevice]);

  const fetchRoomSummaries = async () => {
    setIsSummariesLoading(true);
    try {
      const snap = await get(ref(db, 'roomSummaries'));
      if (snap.exists()) {
        const data = snap.val() || {};
        setRoomSummaries(data);
        setLastSummariesUpdate(Date.now());
      }
    } catch (err) {
      console.error("Fetch summaries error (Permission Denied?):", err);
    } finally {
      setIsSummariesLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRoomSummaries();
    }
  }, [currentUser]);

  useEffect(() => {
    // 1. 大廳摘要監聽器 (極速同步核心) - v15.2: 全面改為 onValue 智慧差量更新
    const unsub = onValue(ref(db, 'roomSummaries'), (snap) => {
      const data = snap.val() || {};
      setRoomSummaries(data);
      setLastSummariesUpdate(Date.now());
      // 正在房內時，同步摘要進入 local room 狀態
      if (currentRoomId && data[currentRoomId]) {
        setRooms(prev => {
          const existing = prev[currentRoomId] || { records: {}, members: {} };
          return {
            ...prev,
            [currentRoomId]: { ...existing, ...data[currentRoomId] }
          };
        });
      }
    });

    return () => unsub();
  }, [currentRoomId]);

  const [hasInitialRankingsFetch, setHasInitialRankingsFetch] = useState(false); // 極致節流標記 (v6.0)

  // Native Auth States (v3.0)
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isNativeAuthVisible, setIsNativeAuthVisible] = useState(false);
  const [authError, setAuthError] = useState('');

  const userHasSeenSelfInRoom = useRef(false);
  const lastPresenceUpdateTs = useRef(0); // 頻率限制 (v3.2)
  const currentRoom = (currentRoomId && rooms && rooms[currentRoomId]) ? rooms[currentRoomId] : null;
  const currentBoss = (currentRoom && currentRoom.bossId && BOSSES[currentRoom.bossId])
    ? BOSSES[currentRoom.bossId]
    : BOSSES[selectedBossId] || Object.values(BOSSES)[0];

  // 雙階段重生提醒 (40分提醒隨時出怪，60分提醒最晚重生保底)
  useEffect(() => {
    if (view !== 'room' || !currentRoom || !currentBoss) return;
    const records = currentRoom.records || {};
    const hasMax = Boolean(currentBoss.maxTime);

    Object.entries(records).forEach(([ch, rec]) => {
      if (!rec || rec.lastKill === 0) return; // 0 是置頂/偵察中

      const elapsedMs = now - (rec.lastKill || 0);
      const minMs = currentBoss.time * 60000;
      const maxMs = hasMax ? currentBoss.maxTime * 60000 : minMs;
      const chEventKey = `${ch}_${rec.lastKill}`;

      if (!notifiedEventsRef.current[chEventKey]) {
        notifiedEventsRef.current[chEventKey] = { min: false, max: false };
      }
      const eventState = notifiedEventsRef.current[chEventKey];

      // 1. 達到最早重生時間 (如 40 分鐘)
      if (elapsedMs >= minMs && !eventState.min) {
        eventState.min = true;
        const msg = hasMax
          ? `${ch} ${currentBoss.name} 已過 ${currentBoss.time} 分鐘，隨時可能重生，請前往就位！`
          : `${ch} ${currentBoss.name} 已經重生！`;

        if (isTabActive && !voiceSettings.isMuted) {
          speechQueue.current.push(msg);
          processSpeechQueue();
        }

        setRoomAlertToast({
          id: Date.now(),
          type: hasMax ? 'window' : 'ready',
          ch,
          title: hasMax ? '🎲 隨時可能重生！' : '✅ 已經重生！',
          message: msg
        });
      }

      // 2. 達到最晚重生時間 (如 60 分鐘保底)
      if (hasMax && elapsedMs >= maxMs && !eventState.max) {
        eventState.max = true;
        const msg = `${ch} ${currentBoss.name} 已滿 ${currentBoss.maxTime} 分鐘，已達最晚重生時間！`;

        if (isTabActive && !voiceSettings.isMuted) {
          speechQueue.current.push(msg);
          processSpeechQueue();
        }

        setRoomAlertToast({
          id: Date.now(),
          type: 'ready',
          ch,
          title: '⚠️ 最晚重生時間已到！',
          message: msg
        });
      }
    });
  }, [now, view, currentRoom, currentBoss, isTabActive, voiceSettings.isMuted]);

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

  // 1. 大廳數據智慧脈沖同步 (v15.2 改為 onValue 持續監聽，僅在變動時傳送差異，極省流量)
  useEffect(() => {
    if (view !== 'lobby' || !isTabActive) return;

    setIsSummariesLoading(true);
    const summaryRef = ref(db, 'roomSummaries');

    // onValue 在初次載入後僅傳送 Diffs
    const unsubscribe = onValue(summaryRef, (snap) => {
      setRoomSummaries(snap.val() || {});
      setLastSummariesUpdate(Date.now());
      setIsSummariesLoading(false);
    });

    return () => unsubscribe();
  }, [view, isTabActive]);

  // 2. 當進入特定房間時，採用海量高密度頻道優化監聽 (V12.0 High-Density Event-Driven)
  useEffect(() => {
    // V12.0 DEFINITIVE SCALABILITY: 針對上千頻道的「事件驅動」連線，流量變成常數級。
    if (!currentRoomId || view !== 'room') return;

    const roomRef = ref(db, `rooms/${currentRoomId}`);
    const recordsRef = child(roomRef, 'records');

    // 第一步：初次載入 (保證 UI 第一秒有資料、不黑屏)
    get(roomRef).then(snap => {
      if (snap.exists()) {
        const data = snap.val();
        setRooms(prev => ({
          ...prev,
          [currentRoomId]: {
            records: {}, members: {}, ...data // 預填結構防崩潰
          }
        }));
      }
    });

    // 第二步：開始分開掛載「輕量級」監聽器 - v15.3: 從 onValue 全量下載改為 Child 級別下載
    // a. 監聽頻道列表 (流量最大戶，改用增量更新，極限節流)
    const unsubAdded = onChildAdded(recordsRef, (snap) => {
      const chKey = snap.key;
      const data = snap.val();
      setRooms(prev => {
        const existing = prev[currentRoomId] || { records: {}, members: {} };
        return {
          ...prev,
          [currentRoomId]: {
            ...existing,
            records: { ...existing.records, [chKey]: data }
          }
        };
      });
    });

    const unsubChanged = onChildChanged(recordsRef, (snap) => {
      const chKey = snap.key;
      const data = snap.val();
      setRooms(prev => {
        const existing = prev[currentRoomId] || { records: {}, members: {} };
        return {
          ...prev,
          [currentRoomId]: {
            ...existing,
            records: { ...existing.records, [chKey]: data }
          }
        };
      });
    });

    const unsubRemoved = onChildRemoved(recordsRef, (snap) => {
      const chKey = snap.key;
      setRooms(prev => {
        const existing = prev[currentRoomId] || { records: {}, members: {} };
        const newRecords = { ...existing.records };
        delete newRecords[chKey];
        return {
          ...prev,
          [currentRoomId]: { ...existing, records: newRecords }
        };
      });
    });

    // b. 監聽成員列表 (減少 Heartbeat 心跳造成的大全包下載)
    const unsubMemChanged = onValue(child(roomRef, 'members'), (snap) => {
      const mData = snap.val() || {};
      setRooms(prev => {
        const existing = prev[currentRoomId] || { records: {}, members: {} };
        const newRoomData = { ...existing, members: mData };

        // 車長負責同步大廳人數與成員名單 (僅在成員變動時觸發)
        if (newRoomData.conductor === userName) {
          const mCount = Object.keys(mData).length;
          const names = Object.keys(mData);
          update(ref(db, `roomSummaries/${currentRoomId}`), {
            onlineCount: mCount,
            memberNames: names
          });
        }

        return { ...prev, [currentRoomId]: newRoomData };
      });
    });

    // c. 監聽房間 Meta (車長, 設定等低頻變動資料) - v15.5: 精細化分路監聽，杜絕 records 造成的重複流量爆炸
    const metaPaths = ['conductor', 'bossId', 'password', 'wildBossExplore', 'voiceAlert', 'lootSplit'];
    const unsubMetas = metaPaths.map(path => {
      return onValue(child(roomRef, path), (snap) => {
        const val = snap.val();
        setRooms(prev => {
          const existing = prev[currentRoomId] || { records: {}, members: {} };
          return {
            ...prev,
            [currentRoomId]: {
              ...existing,
              [path]: val
            }
          };
        });
      });
    });

    // d. 監聽跨房請求 (把愛傳下去 v13.0)
    const loveRequestRef = ref(db, `rooms/${currentRoomId}/loveRequest`);
    const unsubLove = onValue(loveRequestRef, (snap) => {
      setIncomingLoveRequest(snap.val());
    });

    return () => {
      unsubAdded();
      unsubChanged();
      unsubRemoved();
      unsubMemChanged();
      metaPaths.forEach((_, i) => unsubMetas[i]());
      unsubLove();
    };
  }, [currentRoomId, view, isTabActive, userName]);

  // 2.3: Lite Presence Heartbeat (V11.5: Fixes 0/4 persistence across all views)
  useEffect(() => {
    if (!currentRoomId || !userName || !isTabActive) return;

    // 定期發送在線心跳 (僅寫入，不下載數據)
    const updateRoomPresence = () => {
      // V11.5 BUGFIX: Prevent kicked users from becoming zombie ghosts
      if (!userHasSeenSelfInRoom.current) return;
      const memberRef = ref(db, `rooms/${currentRoomId}/members/${userName}`);
      update(memberRef, {
        isOnline: true,
        lastSeen: Date.now()
      });
    };

    updateRoomPresence(); // 立即發送一次
    const presenceInterval = setInterval(updateRoomPresence, 30000); // 每 30 秒心跳一次

    return () => clearInterval(presenceInterval);
  }, [currentRoomId, userName, isTabActive]);

  // 2.1 語音監聽器 (V17.6: 前景分頁守衛版)
  useEffect(() => {
    if (!currentRoomId || view !== 'room') return;
    const alertRef = ref(db, `rooms/${currentRoomId}/voiceAlert`);
    const unsubscribe = onValue(alertRef, (snapshot) => {
      // V17.6: 只有前景分頁可以開口，防止多個分頁同時搶麥克風導致 interrupted
      if (!isTabActive) return;

      const alert = snapshot.val();
      if (alert && alert.ts > lastAlertTs.current) {
        if (alert.message === lastProcessedMsg.current && (alert.ts - lastAlertTs.current) < 2000) return;

        lastAlertTs.current = alert.ts;
        lastProcessedMsg.current = alert.message;

        // 加入佇列並啟動播放程序
        if (alert.message) {
          speechQueue.current.push(alert.message);
          processSpeechQueue();
        }
      }
    });
    return () => unsubscribe();
  }, [currentRoomId, view, isTabActive]);

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

  const getYearMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  /**
   * [萬能同步器] 全站數據同步匯流排 (v5.0)
   * 採用三路寫入 (Triple-Write) 策略，保證榜單讀取流量趨近於零
   */
  const syncToRankings = (uid, name, photoURL, deltaKills, deltaHours) => {
    if (!uid) return;
    try {
      const now = Date.now();
      const currentMonth = new Date(now).toISOString().slice(0, 7);
      const updates = {};

      // 1. 同步至總榜 (All-Time)
      if (deltaKills > 0) {
        updates[`rankings/allTime/kills/${uid}/v`] = increment(deltaKills);
        updates[`rankings/allTime/kills/${uid}/n`] = name;
        updates[`rankings/allTime/kills/${uid}/p`] = photoURL;
        // 同步至月榜
        updates[`rankings/monthly/${currentMonth}/kills/${uid}/v`] = increment(deltaKills);
        updates[`rankings/monthly/${currentMonth}/kills/${uid}/n`] = name;
        updates[`rankings/monthly/${currentMonth}/kills/${uid}/p`] = photoURL;
      }
      if (deltaHours > 0) {
        updates[`rankings/allTime/hours/${uid}/v`] = increment(deltaHours);
        updates[`rankings/allTime/hours/${uid}/n`] = name;
        updates[`rankings/allTime/hours/${uid}/p`] = photoURL;
        // 同步至月榜
        updates[`rankings/monthly/${currentMonth}/hours/${uid}/v`] = increment(deltaHours);
        updates[`rankings/monthly/${currentMonth}/hours/${uid}/n`] = name;
        updates[`rankings/monthly/${currentMonth}/hours/${uid}/p`] = photoURL;
      }

      updates[`rankings/meta/availableMonths/${currentMonth}`] = true;
      updates[`users/${uid}/displayName`] = name;
      updates[`users/${uid}/photoURL`] = photoURL;
      updates[`users/${uid}/lastSeen`] = now;

      if (Object.keys(updates).length > 0) {
        update(ref(db), updates);
      }
    } catch (err) {
      console.error("Atomic sync error:", err);
    }
  };

  /**
   * [經驗練功同步器] 練功戰果原子同步匯流排 (v1.0)
   * 當玩家點擊停止記錄時背景上傳，超低流量原子累積，零多餘讀取
   */
  const syncExpToRankings = async (uid, name, photoURL, expSession) => {
    if (!uid || !expSession) return;
    try {
      const { gainedExp = 0, elapsedSeconds = 0, est60Min = 0, level = 1, correctedPercent = 0 } = expSession;

      const now = Date.now();
      const d = new Date(now);
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const sessionHours = Number((elapsedSeconds / 3600).toFixed(2));
      const compositeLevelScore = level + (correctedPercent / 100);

      const updates = {};

      // 1. 今日衝刺 (Daily)
      if (gainedExp > 0) {
        updates[`rankings/exp/daily/${todayStr}/gainedExp/${uid}/v`] = increment(gainedExp);
        updates[`rankings/exp/daily/${todayStr}/gainedExp/${uid}/n`] = name;
        updates[`rankings/exp/daily/${todayStr}/gainedExp/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/daily/${todayStr}/gainedExp/${uid}/lvl`] = level;
        updates[`rankings/exp/daily/${todayStr}/gainedExp/${uid}/pct`] = correctedPercent;
      }
      if (sessionHours > 0) {
        updates[`rankings/exp/daily/${todayStr}/hours/${uid}/v`] = increment(sessionHours);
        updates[`rankings/exp/daily/${todayStr}/hours/${uid}/n`] = name;
        updates[`rankings/exp/daily/${todayStr}/hours/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/daily/${todayStr}/hours/${uid}/lvl`] = level;
        updates[`rankings/exp/daily/${todayStr}/hours/${uid}/pct`] = correctedPercent;
      }
      if (est60Min > 0) {
        updates[`rankings/exp/daily/${todayStr}/peakPace/${uid}/v`] = est60Min;
        updates[`rankings/exp/daily/${todayStr}/peakPace/${uid}/n`] = name;
        updates[`rankings/exp/daily/${todayStr}/peakPace/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/daily/${todayStr}/peakPace/${uid}/lvl`] = level;
        updates[`rankings/exp/daily/${todayStr}/peakPace/${uid}/pct`] = correctedPercent;
      }
      if (level > 0) {
        updates[`rankings/exp/daily/${todayStr}/level/${uid}/v`] = compositeLevelScore;
        updates[`rankings/exp/daily/${todayStr}/level/${uid}/n`] = name;
        updates[`rankings/exp/daily/${todayStr}/level/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/daily/${todayStr}/level/${uid}/lvl`] = level;
        updates[`rankings/exp/daily/${todayStr}/level/${uid}/pct`] = correctedPercent;
      }

      // 2. 月度賽季 (Monthly)
      if (gainedExp > 0) {
        updates[`rankings/exp/monthly/${currentMonth}/gainedExp/${uid}/v`] = increment(gainedExp);
        updates[`rankings/exp/monthly/${currentMonth}/gainedExp/${uid}/n`] = name;
        updates[`rankings/exp/monthly/${currentMonth}/gainedExp/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/monthly/${currentMonth}/gainedExp/${uid}/lvl`] = level;
        updates[`rankings/exp/monthly/${currentMonth}/gainedExp/${uid}/pct`] = correctedPercent;
      }
      if (sessionHours > 0) {
        updates[`rankings/exp/monthly/${currentMonth}/hours/${uid}/v`] = increment(sessionHours);
        updates[`rankings/exp/monthly/${currentMonth}/hours/${uid}/n`] = name;
        updates[`rankings/exp/monthly/${currentMonth}/hours/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/monthly/${currentMonth}/hours/${uid}/lvl`] = level;
        updates[`rankings/exp/monthly/${currentMonth}/hours/${uid}/pct`] = correctedPercent;
      }
      if (est60Min > 0) {
        updates[`rankings/exp/monthly/${currentMonth}/peakPace/${uid}/v`] = est60Min;
        updates[`rankings/exp/monthly/${currentMonth}/peakPace/${uid}/n`] = name;
        updates[`rankings/exp/monthly/${currentMonth}/peakPace/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/monthly/${currentMonth}/peakPace/${uid}/lvl`] = level;
        updates[`rankings/exp/monthly/${currentMonth}/peakPace/${uid}/pct`] = correctedPercent;
      }
      if (level > 0) {
        updates[`rankings/exp/monthly/${currentMonth}/level/${uid}/v`] = compositeLevelScore;
        updates[`rankings/exp/monthly/${currentMonth}/level/${uid}/n`] = name;
        updates[`rankings/exp/monthly/${currentMonth}/level/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/monthly/${currentMonth}/level/${uid}/lvl`] = level;
        updates[`rankings/exp/monthly/${currentMonth}/level/${uid}/pct`] = correctedPercent;
      }

      // 3. 總累積 (All-Time)
      if (gainedExp > 0) {
        updates[`rankings/exp/allTime/gainedExp/${uid}/v`] = increment(gainedExp);
        updates[`rankings/exp/allTime/gainedExp/${uid}/n`] = name;
        updates[`rankings/exp/allTime/gainedExp/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/allTime/gainedExp/${uid}/lvl`] = level;
        updates[`rankings/exp/allTime/gainedExp/${uid}/pct`] = correctedPercent;
      }
      if (sessionHours > 0) {
        updates[`rankings/exp/allTime/hours/${uid}/v`] = increment(sessionHours);
        updates[`rankings/exp/allTime/hours/${uid}/n`] = name;
        updates[`rankings/exp/allTime/hours/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/allTime/hours/${uid}/lvl`] = level;
        updates[`rankings/exp/allTime/hours/${uid}/pct`] = correctedPercent;
      }
      if (est60Min > 0) {
        updates[`rankings/exp/allTime/peakPace/${uid}/v`] = est60Min;
        updates[`rankings/exp/allTime/peakPace/${uid}/n`] = name;
        updates[`rankings/exp/allTime/peakPace/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/allTime/peakPace/${uid}/lvl`] = level;
        updates[`rankings/exp/allTime/peakPace/${uid}/pct`] = correctedPercent;
      }
      if (level > 0) {
        updates[`rankings/exp/allTime/level/${uid}/v`] = compositeLevelScore;
        updates[`rankings/exp/allTime/level/${uid}/n`] = name;
        updates[`rankings/exp/allTime/level/${uid}/p`] = photoURL || '';
        updates[`rankings/exp/allTime/level/${uid}/lvl`] = level;
        updates[`rankings/exp/allTime/level/${uid}/pct`] = correctedPercent;
      }

      // 4. 元數據與個人 Profile
      updates[`rankings/meta/availableExpMonths/${currentMonth}`] = true;
      if (gainedExp > 0) {
        updates[`users/${uid}/profile/totalExpGained`] = increment(gainedExp);
      }
      if (sessionHours > 0) {
        updates[`users/${uid}/profile/totalExpHours`] = increment(sessionHours);
      }
      if (level > 0) {
        updates[`users/${uid}/profile/currentLevel`] = level;
        updates[`users/${uid}/profile/currentPercent`] = correctedPercent;
      }
      updates[`users/${uid}/profile/lastExpUpdate`] = now;

      await update(ref(db), updates);
      console.log(`[ExpSync] Successfully synced: +${gainedExp} EXP, ${sessionHours}h, pace: ${est60Min}/hr, Lv.${level}`);
    } catch (err) {
      console.error("[ExpSync Error]", err);
    }
  };

  const fetchAllUsers = async (searchTerm = '') => {
    if (!isAdmin) return;
    setIsUsersLoading(true);
    try {
      let q;
      if (searchTerm) {
        // v15.5: 定向搜尋，不抓全量
        q = query(ref(db, 'users'), orderByChild('displayName'), startAt(searchTerm), endAt(searchTerm + '\uf8ff'), limitToFirst(50));
      } else {
        // v15.5: 預設只抓前 100 位，防止流量震盪
        q = query(ref(db, 'users'), limitToFirst(100));
      }
      const snapshot = await get(q);
      if (snapshot.exists()) {
        setAllUsers(snapshot.val());
      } else {
        setAllUsers({});
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
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

  // 獨立即時監聽申請中 (pending) 成員，以節省流量且不漏接申請
  useEffect(() => {
    if (view === 'admin' && isAdmin && isTabActive) {
      const pendingQuery = query(ref(db, 'users'), orderByChild('status'), equalTo('pending'));
      return onValue(pendingQuery, (snapshot) => {
        setPendingUsers(snapshot.val() || {});
      });
    }
  }, [view, isAdmin, isTabActive]);

  // 管理者不再預載全站房資訊，改由摘要處理清單
  useEffect(() => {
    if (view === 'admin' && isAdmin && isTabActive) {
      // v15.5: 進入後台時自動載入第一批成員 (限 100 人)
      if (Object.keys(allUsers).length === 0) {
        fetchAllUsers();
      }

      // 此處僅為確保摘要最新，若 lobby 的監聽器未作用，則補掛一個
      if (Object.keys(roomSummaries).length === 0) {
        const unsub = onValue(ref(db, 'roomSummaries'), snap => setRoomSummaries(snap.val() || {}));
        return () => unsub();
      }
    }
  }, [view, isAdmin, isTabActive, roomSummaries, allUsers]);

  // V17.9: 系統日誌監聽器 (僅限管理員在 Logs 分頁時才抓取，極省流量)
  useEffect(() => {
    if (view === 'admin' && isAdmin && adminTab === 'logs' && isTabActive) {
      const logsRef = query(ref(db, 'system_logs'), limitToLast(100));
      return onValue(logsRef, (snap) => {
        const data = snap.val() || {};
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => b.ts - a.ts);
        setSystemLogs(list);
      });
    }
  }, [view, isAdmin, adminTab, isTabActive]);

  const addSystemLog = (type, rid, msg) => {
    try {
      const logsRef = ref(db, 'system_logs');
      const newLogRef = push(logsRef);
      set(newLogRef, {
        ts: Date.now(),
        type,
        rid: rid || 'N/A',
        msg
      });
    } catch (err) {
      console.error("Log error:", err);
    }
  };

  // --- 排行榜數據抓取 (V10-ULTIMATE: 支援野王榜與經驗榜) ---
  const fetchLeaderboard = async (isManual = false, force = false) => {
    if (!isManual && !force) return;
    if (!force && syncCooldown > 0) {
      alert(`⚠️ 系統冷卻中，請等待 ${syncCooldown} 秒後再試。`);
      return;
    }

    setIsLeaderboardLoading(true);
    setSyncCountdown(force ? 0 : 3);

    // 啟動倒數計時器
    let countdownInterval;
    if (!force) {
      countdownInterval = setInterval(() => {
        setSyncCountdown(p => (p > 0 ? p - 1 : 0));
      }, 1000);
    }

    try {
      let path;
      if (leaderboardCategory === 'exp') {
        if (leaderboardExpPeriod === 'today') {
          const d = new Date();
          const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          path = `rankings/exp/daily/${todayStr}/${leaderboardExpMetric}`;
        } else if (leaderboardExpPeriod === 'monthly') {
          path = `rankings/exp/monthly/${leaderboardMonth}/${leaderboardExpMetric}`;
        } else {
          path = `rankings/exp/allTime/${leaderboardExpMetric}`;
        }
      } else {
        path = leaderboardPeriod === 'allTime'
          ? `rankings/allTime/${leaderboardMetric}`
          : `rankings/monthly/${leaderboardMonth}/${leaderboardMetric}`;
      }

      const q = ref(db, path);

      // 1. 同步雲端 (野王榜)
      if (leaderboardCategory === 'boss' && currentUser && currentUser.profile) {
        await syncToRankings(currentUser.uid, userName, currentUser.profile.photoURL, 0, 0);
      }

      // 2. 抓取名次 (切換為 Client-side Sorting 以跳過 Indexing 報錯)
      const snap = await get(q);
      let list = [];
      if (snap.exists()) {
        const rawData = snap.val();
        list = Object.entries(rawData)
          .map(([uid, data]) => ({ uid, ...data }))
          .sort((a, b) => (b.v || 0) - (a.v || 0))
          .slice(0, 50);
      }

      // 3. 戰略注入 (野王榜注入)
      if (leaderboardCategory === 'boss' && currentUser && currentUser.profile) {
        const myVal = leaderboardMetric === 'kills' ? (currentUser.profile.totalKills || 0) : (currentUser.profile.totalHours || 0);
        if (myVal > 0) {
          const already = list.find(u => u.uid === currentUser.uid);
          if (!already) {
            list.push({ uid: currentUser.uid, n: userName, p: currentUser.profile.photoURL, v: myVal });
          } else {
            already.v = myVal;
            already.p = currentUser.profile.photoURL;
          }
        }
      }

      // 4. 更新 UI 並揭開領獎台
      list.sort((a, b) => (b.v || 0) - (a.v || 0));
      setLeaderboardData(list);
      setHasInitialRankingsFetch(true);

      // 5. 若手動點擊同步，保留適度冷卻防刷
      if (isManual && !force) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setSyncCooldown(30);
      }
    } catch (e) {
      console.error("[Fetch Error]", e);
      alert("📡 戰略同步失敗，請檢查網路連線。");
    } finally {
      if (countdownInterval) clearInterval(countdownInterval);
      setSyncCountdown(0);
      setIsLeaderboardLoading(false);
    }
  };

  // 冷卻計時器 (Global Hook)
  useEffect(() => {
    if (syncCooldown > 0) {
      const timer = setTimeout(() => setSyncCooldown(syncCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [syncCooldown]);

  // 初始載入可用月份索引 (野王榜 & 經驗榜)
  useEffect(() => {
    const monthsRef = ref(db, 'rankings/meta/availableMonths');
    const unsubscribe = onValue(monthsRef, (snap) => {
      const data = snap.val() || {};
      setAvailableRankMonths(Object.keys(data).sort().reverse());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const expMonthsRef = ref(db, 'rankings/meta/availableExpMonths');
    const unsubscribe = onValue(expMonthsRef, (snap) => {
      const data = snap.val() || {};
      const currentMonth = getYearMonth();
      const months = Object.keys(data);
      if (!months.includes(currentMonth)) months.push(currentMonth);
      setAvailableExpMonths(months.sort().reverse());
    });
    return () => unsubscribe();
  }, []);

  // 當殿堂已解鎖時，切換分類/指標/週期自動加載數據 (零等待體驗)
  useEffect(() => {
    if (view === 'leaderboard' && hasInitialRankingsFetch) {
      fetchLeaderboard(true, true);
    }
  }, [leaderboardCategory, leaderboardMetric, leaderboardPeriod, leaderboardExpMetric, leaderboardExpPeriod, leaderboardMonth]);

  useEffect(() => {
    // 監聽大廳連線狀態並同步心跳 (全屏監控 v11.5: Fix 0/4)
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true && currentRoomId && userName && isTabActive) {
        // V11.5 BUGFIX: Also protect connected event from recreating ghost members
        if (userHasSeenSelfInRoom.current) {
          const memberRef = ref(db, `rooms/${currentRoomId}/members/${userName}`);
          update(memberRef, {
            isOnline: true,
            lastSeen: Date.now()
          });
        }
      }
    });
    return () => unsubscribe();
  }, [currentRoomId, userName, view, isTabActive]);

  // V16.7: 全球戰時授時系統 (Server Time Synchronization)
  useEffect(() => {
    const offsetRef = ref(db, ".info/serverTimeOffset");
    const unsubscribe = onValue(offsetRef, (snap) => {
      const offset = snap.val() || 0;
      setServerOffset(offset);
      console.log(`[戰時授時] 伺服器時間偏移量: ${offset}ms`);
    });
    return () => unsubscribe();
  }, []);

  const getSyncedTime = () => Date.now() + serverOffset;

  useEffect(() => {
    // 超時守衛：防止一直卡在「連線中」
    const timeout = setTimeout(() => {
      setAuthChecking(false);
    }, 5000); // 縮短為 5 秒
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userRef = ref(db, `users/${user.uid}`);
          const snapshot = await get(userRef);
          let userData = snapshot.val();

          if (!userData) {
            // 如果是剛註冊的原生帳號，可能還沒有 displayName，優先使用 user.displayName 或預設值
            const initialName = user.displayName || authEmail.split('@')[0] || '新隊員';
            userData = {
              uid: user.uid,
              displayName: initialName,
              photoURL: '🐶',
              totalKills: 0,
              totalHours: 0,
              status: (user.uid === ADMIN_UID || user.uid === PIKA_UID) ? 'approved' : 'new',
              createdAt: Date.now()
            };
            await update(userRef, userData);
            // 同步更新 Firebase Profile 的 DisplayName (針對原生帳號)
            if (!user.displayName) {
              const { updateProfile } = await import('firebase/auth');
              await updateProfile(user, { displayName: initialName });
            }
          }

          const combinedUser = {
            ...user,
            photoURL: userData.photoURL || '🐶',
            displayName: userData.displayName || user.displayName || '新隊員',
            profile: userData
          };
          setCurrentUser(combinedUser);
          setUserName(userData.displayName || user.displayName || '新隊員');

          const isUserAdmin = user.uid === ADMIN_UID || user.uid === PIKA_UID;

          if (user.uid !== PIKA_UID && userData.status === 'rejected') {
            setView('landing');
          } else if (!isUserAdmin && userData.status !== 'approved') {
            setView('landing');
          } else if (view === 'landing') {
            const hashId = window.location.hash.slice(1);
            if (hashId && rooms[hashId]) {
              setCurrentRoomId(hashId);
              setJoinNameInput(userData.displayName || '新隊員');
              setView('join');
            } else {
              setView('hub');
            }
          }
        } else {
          if (currentUser && currentRoomId && sessionStartTime) {
            const delta = (Date.now() - sessionStartTime) / (1000 * 60 * 60);
            const userRef = ref(db, `users/${currentUser.uid}`);
            localStorage.removeItem('pikapi_last_room');
            get(userRef).then(snap => {
              const data = snap.val() || {};
              const bossId = rooms[currentRoomId]?.bossId || 'unknown';
              update(userRef, {
                totalHours: (data.totalHours || 0) + delta,
                [`bossStats/${bossId}/hours`]: (data.bossStats?.[bossId]?.hours || 0) + delta
              });
            }).catch(e => console.warn("Logout cleanup permission denied:", e));
          }
          setCurrentUser(null);
          setView('landing');
          setCurrentRoomId(null);
          setSessionStartTime(null);
        }
      } catch (err) {
        console.error("Auth initialization database error:", err);
        // 如果連讀取自己的 UserProfile 都失敗，說明 Database 規則完全沒開
        if (err.message.includes("permission_denied")) {
          console.warn("CRITICAL: Database rules are blocking user access.");
        }
        // 即便報錯也允許跳轉到 Landing 讓使用者至少能看到介面
        setCurrentUser(user ? { ...user, profile: { status: 'error' } } : null);
        setView('landing');
      } finally {
        setAuthChecking(false);
      }
    });
    return () => unsubscribe();
  }, [view, rooms, currentRoomId]);

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

  // 即時登入狀態防護 (v5.0)：若帳號被剔除，立即中斷體驗
  useEffect(() => {
    if (!currentUser || currentUser.uid === PIKA_UID) return;
    const statusRef = ref(db, `users/${currentUser.uid}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const newStatus = snapshot.val();
      if (newStatus === 'rejected') {
        setCurrentUser(prev => prev ? { ...prev, profile: { ...prev.profile, status: 'rejected' } } : null);
        setView('landing');
        setCurrentRoomId(null);
      }
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // 全域廣播監聽與語音報讀 (全天候支援 v3.5)
  useEffect(() => {
    const broadcastRef = ref(db, 'globalBroadcast');
    const unsubscribe = onValue(broadcastRef, (snap) => {
      // V17.7: 同樣加入前景守衛碼，防止多分頁廣播打架
      if (!isTabActive) return;

      const data = snap.val();
      if (data && data.ts > Date.now() - 30000) { // 30秒內的公告才顯示
        setGlobalBroadcast(data);
        // 語音報讀 (TTS) - V17.3: 併入大統治序列
        speechQueue.current.push(data.message);
        processSpeechQueue();

        // 8秒後自動隱藏橫幅
        setTimeout(() => setGlobalBroadcast(null), 8000);
      }
    });
    return () => unsubscribe();
  }, [isTabActive]); // 增加 isTabActive 依賴

  // 檢查是否被踢出房間 (已整合至下方 v2.3 機制，此處移除以避免誤判)

  useEffect(() => {
    if (view === 'lobby' && userName) {
      localStorage.setItem('artale_user_name', userName);
    }
  }, [userName, view]);

  // V11.4: Removed legacy hash-based auto-join to prevent navigation conflicts with Sticky Sessions.

  useEffect(() => {
    if (view === 'lobby') {
      setPasswordInput('');
      setJoinNameInput(userName);
    } else {
      // 當離開大廳視圖時，重置所有殘留的彈窗狀態
      setShowCreateModal(false);
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
        // V11.5 FIX: Instant kick to prevent zombie heartbeat resurrection
        alert("【系統提醒】您已被請下車，將跳轉回大廳。");
        userHasSeenSelfInRoom.current = false;
        setCurrentRoomId(null);
        setLastJoinedRoomId(null);
        localStorage.removeItem('pikapi_last_room');
        setView('lobby');
        window.history.pushState({}, '', window.location.pathname);
      }
    } else if (view === 'lobby') {
      userHasSeenSelfInRoom.current = false;
    }
  }, [rooms, currentRoomId, userName, view]);

  // 已廢除個人圖片上傳 (v2.2)
  const updateProfileAvatar = (newUrl) => {
    if (!currentUser) return;

    const updates = {};
    updates[`users/${currentUser.uid}/photoURL`] = newUrl;

    // 如果目前在房間內，同步更新房內成員頭像 (v12.6)
    if (currentRoomId && userName) {
      updates[`rooms/${currentRoomId}/members/${userName}/photoURL`] = newUrl;
    }

    update(ref(db), updates);

    setCurrentUser(prev => ({
      ...prev,
      photoURL: newUrl,
      profile: { ...prev.profile, photoURL: newUrl }
    }));
    alert("頭像更換成功！戰備狀態已同步至當前頻道。");
  };

  // --- 定時器與初始化輔助 (v13.5) ---
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + serverOffset), 1000);
    return () => clearInterval(timer);
  }, [serverOffset]);

  // 斷線/刷新後，自動從資料庫恢復隨車計時 (Stick Session Restore)
  useEffect(() => {
    if (currentRoom && userName && view === 'room') {
      const myData = currentRoom.members?.[userName];
      if (myData) {
        // 恢復計時起點
        if (!sessionStartTime && myData.joinedAt) {
          setSessionStartTime(myData.joinedAt);
        }
        // 恢復本次獲取量
        const total = currentRoom.totalKills || 0;
        const start = myData.startKills || 0;
        const currentGained = Math.max(0, total - start);
        if (sessionKills < currentGained) {
          setSessionKills(currentGained);
        }
      }
    }
  }, [currentRoom, userName, view, sessionStartTime, sessionKills]);

  // 已移至 2.1 語音專用監聽器，此處移除以節省流量 (v3.5)
  // 已移至 2.1 語音專用監聽器，此處移除以節省流量 (v3.5)

  const handleTestVoice = () => {
    speechQueue.current.push("PiKaPi 戰略通報測試。");
    processSpeechQueue();
  };

  useEffect(() => {
    const cleanup = () => {
      const allTrackedIds = new Set([
        ...Object.keys(rooms || {}),
        ...Object.keys(roomSummaries || {})
      ]);

      const updates = {};
      const nowTs = Date.now();

      allTrackedIds.forEach(id => {
        const room = rooms[id] || roomSummaries[id];
        if (!room) return;

        const rawMembers = room.members || room.memberNames || {};
        const memberCount = Array.isArray(rawMembers) ? rawMembers.length : Object.keys(rawMembers).length;

        // V17.8 FIX: 如果房間內有人，必須強制清除 emptySince 標記，防止「幽靈計時器」在 2 小時後誤刪活房
        if (memberCount > 0 && room.emptySince) {
          updates[`rooms/${id}/emptySince`] = null;
          updates[`roomSummaries/${id}/emptySince`] = null;
          addSystemLog('CLEAR', id, `偵測到有人在內 (Count: ${memberCount})，已自動修正並解除倒數`);
          return; // 既然有人，這輪就不再檢查刪除
        }

        // 補漏機制：如果偵測到空房卻沒標記時間，立刻啟動倒數
        if (memberCount === 0 && !room.emptySince) {
          updates[`rooms/${id}/emptySince`] = nowTs;
          updates[`roomSummaries/${id}/emptySince`] = nowTs;
          addSystemLog('STAMP', id, '偵測到空房，啟動 2 小時銷毀倒數');
        }

        // 判定銷毀：必須同時滿足「員額為0」且「倒數歸零」
        // V17.8 FIX: 增加 memberCount === 0 雙重鎖定，確保萬無一失
        if (memberCount === 0 && room.emptySince && (nowTs - room.emptySince > ROOM_AUTO_DELETE_MS)) {
          updates[`rooms/${id}`] = null;
          updates[`roomSummaries/${id}`] = null;
          addSystemLog('DELETE', id, '空房超過 2 小時且無人上車，執行系統鎖定銷毀');
        }
      });

      if (Object.keys(updates).length > 0) {
        update(ref(db), updates);
      }
    };
    const interval = setInterval(cleanup, 30000);
    return () => clearInterval(interval);
  }, [rooms, roomSummaries]);

  useEffect(() => {
    // V11.5 FIX: Presence should stay active globally for the room, not just in view === 'room'.
    // And we must guard against recreating ghost members on unmount!
    if (currentRoomId && userName && isTabActive) {
      const memberRef = ref(db, `rooms/${currentRoomId}/members/${userName}`);

      // If we haven't officially seen ourselves yet, wait before updating presence
      if (userHasSeenSelfInRoom.current) {
        update(memberRef, {
          isOnline: true,
          lastSeen: Date.now()
        });
      }

      const disconnectRef = onDisconnect(memberRef);
      disconnectRef.update({
        isOnline: false,
        lastSeen: Date.now()
      });

      return () => {
        // V11.5 BUGFIX: DO NOT push isOnline: false here!
        // If currentRoomId was cleared because of a kick/leave, push would resurrect the member as a ghost.
        // The isTabActive hook handles tab-away, and onDisconnect handles total disconnects smoothly.
        disconnectRef.cancel();
      };
    }
  }, [currentRoomId, userName, isTabActive]);

  // V11.6: 縮小分頁/切換分頁時立即發送離線信號 (精確省流，且不依賴生命週期卸載，防止殭屍漏洞)
  useEffect(() => {
    if (currentRoomId && userName && userHasSeenSelfInRoom.current) {
      if (!isTabActive) {
        update(ref(db, `rooms/${currentRoomId}/members/${userName}`), {
          isOnline: false,
          lastSeen: Date.now()
        });
      }
    }
  }, [currentRoomId, userName, isTabActive]);

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
      console.error("[Auth] Login failed:", error);
      if (error.code === 'auth/popup-blocked') {
        alert("登入視窗被瀏覽器攔截了，請允許本網站顯示彈出視窗。");
      } else if (error.code === 'auth/network-request-failed') {
        alert("網路連線失敗，請檢查您的連線。");
      } else {
        alert(`登入發生錯誤 (${error.code})，請稍後再試。`);
      }
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

  const handleNativeAuth = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) return setAuthError('請填寫完整資訊');
    if (authPassword.length < 6) return setAuthError('密碼長度至少需 6 位');

    const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('firebase/auth');
    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error) {
      console.error("驗證失敗", error);
      let errMsg = '登入失敗，請檢查 Email 與密碼';
      if (error.code === 'auth/email-already-in-use') errMsg = '此 Email 已被註冊';
      if (error.code === 'auth/weak-password') errMsg = '密碼強度不足';
      if (error.code === 'auth/user-not-found') errMsg = '帳號不存在';
      if (error.code === 'auth/wrong-password') errMsg = '密碼錯誤';
      setAuthError(errMsg);
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
    const nowSynced = getSyncedTime();
    const newRoom = {
      id,
      bossId: selectedBossId,
      password: Math.random().toString(36).substr(2, 4),
      conductor,
      members: {
        [userName]: {
          joinedAt: nowSynced,
          startKills: 0,
          totalKills: currentUser.profile?.totalKills || 0, // 初始帶入總擊殺 (v12.7)
          photoURL: currentUser.profile?.photoURL || '🐶',
          isOnline: true
        }
      },
      records: {},
      totalKills: 0,
      createdAt: nowSynced
    };

    // 同步寫入摘要，讓大廳監聽與管理者後台超省流量 (v15.2: 補上密碼字段供管理用)
    const summary = {
      id,
      bossId: selectedBossId,
      password: newRoom.password, // v15.2 Patch: Admin can see pwd in summary
      conductor,
      totalKills: 0,
      createdAt: nowSynced,
      onlineCount: 1,
      memberNames: [conductor]
    };

    update(ref(db), {
      [`rooms/${id}`]: newRoom,
      [`roomSummaries/${id}`]: summary,
      [`users/${currentUser.uid}/rooms/${id}`]: true
    }).then(() => {
      addSystemLog('CREATE', id, `車長 ${conductor} 創建了新的戰略房間`);
      setCurrentRoomId(id);
      setLastJoinedRoomId(id); // 標記為正式進入 (v12.5)
      localStorage.setItem('pikapi_last_room', id);
      setView('room');
      setSessionStartTime(nowSynced);
      setSessionKills(0);
    });
  };

  const joinRoom = async () => {
    // V11.5 FIX: Since full room is no longer synced in lobby, fetch on demand
    const snapshot = await get(ref(db, `rooms/${currentRoomId}`));
    if (!snapshot.exists()) return alert("房間已不存在");

    const room = snapshot.val();
    const nowSynced = getSyncedTime();

    if (room.password !== passwordInput) return alert("密碼錯誤");

    // V17.8 FIX: 採用原子化更新，同時「加入成員」並「清除空房標記」
    const updates = {};
    const newMemberData = {
      joinedAt: nowSynced,
      startKills: room.totalKills || 0,
      totalKills: currentUser.profile?.totalKills || 0,
      photoURL: currentUser.profile?.photoURL || '🐶',
      isOnline: true
    };

    updates[`rooms/${currentRoomId}/members/${userName}`] = newMemberData;
    updates[`rooms/${currentRoomId}/emptySince`] = null; // 立即清除銷毀倒數
    updates[`roomSummaries/${currentRoomId}/emptySince`] = null;

    // 如果當前房間沒有車長，或是車長不在成員名單中，由加入者自動遞補
    const currentMembers = Object.keys(room.members || {});
    if (!room.conductor || !currentMembers.includes(room.conductor)) {
      updates[`rooms/${currentRoomId}/conductor`] = userName;
      updates[`roomSummaries/${currentRoomId}/conductor`] = userName;
    }

    // V17.8 同步強化：立即更新大廳摘要，防止其他人的清理定時器誤刪
    const updatedMemberNames = Array.from(new Set([...currentMembers, userName]));
    updates[`roomSummaries/${currentRoomId}/onlineCount`] = updatedMemberNames.length;
    updates[`roomSummaries/${currentRoomId}/memberNames`] = updatedMemberNames;

    await update(ref(db), updates);
    addSystemLog('JOIN', currentRoomId, `${userName} 成功加入房間，系統已清除任何銷毀倒數`);

    setLastJoinedRoomId(currentRoomId);
    localStorage.setItem('pikapi_last_room', currentRoomId);
    setView('room');
    setSessionStartTime(nowSynced); // 開始計時
    window.history.pushState({}, '', `#${currentRoomId}`);
    setPasswordInput('');
  };

  const backToLobby = (forceReset = false) => {
    window.history.pushState({}, '', window.location.pathname);
    if (forceReset) setCurrentRoomId(null);
    setView('lobby');
  };

  const confirmLeave = () => {
    const room = rooms[currentRoomId];
    if (room && currentUser) {
      // 結算站崗時間
      if (sessionStartTime) {
        const nowSynced = getSyncedTime();
        const delta = (nowSynced - sessionStartTime) / (1000 * 60 * 60); // 小時
        const userRef = ref(db, `users/${currentUser.uid}`);
        const bossId = room.bossId;

        update(userRef, {
          totalHours: increment(delta),
          [`bossStats/${bossId}/hours`]: increment(delta)
        });

        // 同步到排行榜 (v5.0 + v15.0 原子累計)
        syncToRankings(currentUser.uid, userName, currentUser.profile?.photoURL, 0, delta);
      }

      const rawMembers = room.members || {};
      const members = Object.keys(rawMembers).filter(m => m !== userName);
      const isConductor = room.conductor === userName;

      remove(ref(db, `rooms/${currentRoomId}/members/${userName}`));

      // V16.4: 房主離開時，若還有隊員，自動傳位給[0]
      const nextConductor = isConductor ? (members[0] || null) : room.conductor;
      const isRoomEmpty = members.length === 0;

      const updates = {
        conductor: nextConductor,
        emptySince: isRoomEmpty ? Date.now() : null
      };

      if (isConductor || isRoomEmpty) {
        // 同步大廳摘要
        update(ref(db, `roomSummaries/${currentRoomId}`), {
          conductor: nextConductor,
          onlineCount: members.length,
          emptySince: isRoomEmpty ? Date.now() : null
        });
      }

      update(ref(db, `rooms/${currentRoomId}`), updates);

      if (isRoomEmpty) {
        addSystemLog('STAMP', currentRoomId, `最後一員 ${userName} 離開，房間進入自動銷毀倒數`);
      } else {
        addSystemLog('LEAVE', currentRoomId, `${userName} 離開了房間`);
      }
    }
    setSessionStartTime(null);
    setShowLeaveModal(false);
    setCurrentRoomId(null);
    setLastJoinedRoomId(null);
    localStorage.removeItem('pikapi_last_room');
    setView('lobby');
    window.history.pushState({}, '', window.location.pathname);
  };

  const removeMember = (targetName) => {
    if (!currentRoom || currentRoom.conductor !== userName) return;
    if (confirm(`確定要將 ${targetName} 請下車嗎？`)) {
      const updates = {};
      updates[`rooms/${currentRoomId}/members/${targetName}`] = null;
      
      // 同步更新大廳摘要中的人數與名單
      const currentMembers = Object.keys(currentRoom.members || {});
      const nextMembers = currentMembers.filter(m => m !== targetName);
      
      updates[`roomSummaries/${currentRoomId}/onlineCount`] = nextMembers.length;
      updates[`roomSummaries/${currentRoomId}/memberNames`] = nextMembers;

      update(ref(db), updates).then(() => {
        addSystemLog('KICK', currentRoomId, `車長 ${userName} 將 ${targetName} 請下車`);
      });
    }
  };

  const transferConductor = (targetName) => {
    if (!currentRoom || currentRoom.conductor !== userName) return;
    if (confirm(`確定要將車長權限移交給 ${targetName} 嗎？`)) {
      const updates = {};
      updates[`rooms/${currentRoomId}/conductor`] = targetName;
      updates[`roomSummaries/${currentRoomId}/conductor`] = targetName;
      
      update(ref(db), updates).then(() => {
        addSystemLog('TRANSFER', currentRoomId, `原車長 ${userName} 已將權限移交給 ${targetName}`);
      });
    }
  };

  // V16.8: 打野偵察模式切換 - 會影響 UI 並開啟專用輸入框
  const toggleWildBossExplore = () => {
    if (!currentRoomId) return;
    const newState = !wildBossExplore;
    setWildBossExplore(newState);

    // 同步到資料庫，讓房內的人都知道誰進入了打野模式 (保持原有廣播功能)
    const updates = {};
    updates[`rooms/${currentRoomId}/wildBossExplore/${userName}`] = newState ? true : null;

    if (newState) {
      const msg = `${userName} 前往各頻道打野中`;
      updates[`rooms/${currentRoomId}/voiceAlert`] = { message: msg, ts: Date.now(), sender: userName };
      setExploreChannelInput(''); // 重設輸入
    }

    update(ref(db), updates);
  };

  // V16.8: 偵察模式下的專用回報邏輯 -> 強制 lastKill: 0
  const addExploreRecord = () => {
    const ch = exploreChannelInput.trim();
    if (!ch || !currentRoomId) return;
    const chKey = `CH ${ch}`;

    // 重要：lastKill = 0 是我們內定的置頂標記
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), {
      lastKill: 0,
      reporter: userName,
      occupant: null
    });

    setExploreChannelInput('');
    const msg = `${userName} 在頻道 ${ch} 發現野王啦`;
    update(ref(db, `rooms/${currentRoomId}/voiceAlert`), { message: msg, ts: Date.now(), sender: userName });
  };

  // V16.9: 修改房間密碼 (僅車長可用)
  const updateRoomPassword = () => {
    if (!currentRoomId || !currentRoom) return;
    const isOwner = currentRoom.conductor === userName;
    if (!isOwner) return;

    const newPwd = newPasswordInput.trim();
    if (!newPwd) {
      alert("密碼不能為空！");
      return;
    }

    // 同步更新房間主體與大廳摘要 (v16.9.2: 確保指揮部能看到更新後的密碼)
    const updates = {};
    updates[`rooms/${currentRoomId}/password`] = newPwd;
    updates[`roomSummaries/${currentRoomId}/password`] = newPwd;

    update(ref(db), updates);
    setIsEditingPassword(false);
  };

  const handleStationed = (chKey) => {
    const records = currentRoom.records || {};
    const rec = records[chKey] || {};
    const isOccupiedByMe = rec.occupant === userName;
    
    // 情境 1: 沒人佔位，開放任何人佔位
    if (!rec.occupant) {
      update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { occupant: userName, isConfirmed: false });
    } 
    // 情境 2: 目前是我佔領的，可以循環切換狀態 (確認有料 -> 清空)
    else if (isOccupiedByMe) {
      if (!rec.isConfirmed) {
        update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { isConfirmed: true });
      } else {
        update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { occupant: null, isConfirmed: false });
      }
    }
    // 情境 3: 別人佔領的，按鈕處於鎖定狀態 (由 UI 控制 disabled)
  };

  const addRecord = (manualChKey) => {
    const chKey = manualChKey || `CH ${inputChannel.trim()}`;
    if (!manualChKey && !inputChannel.trim()) return;
    const nowSynced = getSyncedTime();

    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), {
      lastKill: nowSynced,
      reporter: userName,
      occupant: null,
      isStolen: null // V17.9: 擊殺後自動重置「被偷」狀態
    });

    // 增加房間總擊殺 (同步更新詳情與摘要) - v15.0 原子累載
    const globalUpdates = {
      [`rooms/${currentRoomId}/totalKills`]: increment(1),
      [`roomSummaries/${currentRoomId}/totalKills`]: increment(1),
    };
    update(ref(db), globalUpdates);

    // 增加個人與 Boss 個別統計 - v15.0 原子累載
    if (currentUser && currentRoom) {
      const bossId = currentRoom.bossId;
      const userRef = ref(db, `users/${currentUser.uid}`);

      // 獲取最新狀態用於紀錄 Activity (此處讀取仍有必要，因為 Activity 是陣列操作)
      get(userRef).then(snap => {
        const data = snap.val() || {};
        const newActivity = {
          bossId,
          bossName: currentBoss.name,
          ch: chKey,
          at: nowSynced
        };
        const recent = data.recentActivity || [];
        const updatedRecent = [newActivity, ...recent].slice(0, 5);

        // 個人累計使用 increment
        const userUpdates = {
          totalKills: increment(1),
          [`bossStats/${bossId}/kills`]: increment(1),
          recentActivity: updatedRecent
        };
        update(userRef, userUpdates);

        // 勳章升級動態同步 (此處利用 local 加算暫時模擬其值供房內即時顯示)
        if (currentRoomId) {
          const simulatedKills = (data.totalKills || 0) + 1;
          update(ref(db, `rooms/${currentRoomId}/members/${userName}`), { totalKills: simulatedKills });
        }

        // 同步到排行榜 (v5.0 + v15.0 原子累計)
        syncToRankings(currentUser.uid, userName, currentUser.profile?.photoURL, 1, 0);
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
    const nowSynced = getSyncedTime();
    const readyTime = nowSynced - (currentBoss.time * 60 * 1000);
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), {
      lastKill: readyTime,
      reporter: userName,
      occupant: null
    });
  };

  const handleSpreadLoveClick = () => {
    setSelectedTargetRoomId(null);
    setLoveStep(1);
    setShowLoveModal(true);
  };

  const sendLoveRequest = async () => {
    if (!selectedTargetRoomId || !currentRoom) return;

    const targetRoomSummary = roomSummaries[selectedTargetRoomId];
    const targetConductor = targetRoomSummary?.conductor || '另一房的房主';

    const records = currentRoom.records || {};
    let channelsToMove = {};

    if (loveTransferMode === 'all') {
      channelsToMove = { ...records };
    } else {
      Object.entries(records).forEach(([ch, data]) => {
        const num = parseInt(ch.replace(/[^0-9]/g, ''));
        if (loveTransferMode === 'odd' && num % 2 !== 0) channelsToMove[ch] = data;
        if (loveTransferMode === 'even' && num % 2 === 0) channelsToMove[ch] = data;
      });
    }

    if (Object.keys(channelsToMove).length === 0) {
      return alert("【系統警告】偵測不到符合條件的頻道紀錄 (或是目標頻道目前無任何狀態)");
    }

    const request = {
      fromId: currentRoomId,
      fromConductor: userName,
      targetId: selectedTargetRoomId,
      mode: loveTransferMode,
      channels: channelsToMove,
      ts: Date.now()
    };

    // 1. 發送請求
    await set(ref(db, `rooms/${selectedTargetRoomId}/loveRequest`), request);

    // 2. 傳送房全體廣播
    update(ref(db, `rooms/${currentRoomId}/voiceAlert`), {
      message: `房主 ${userName} 已經把愛 給 另一房的房主 ${targetConductor}`,
      ts: Date.now(),
      sender: userName
    });

    setShowLoveModal(false);
  };

  const refuseLoveRequest = async () => {
    if (!incomingLoveRequest) return;
    const { fromId } = incomingLoveRequest;

    // 1. 廣播給傳送房 (狠狠拒絕)
    update(ref(db, `rooms/${fromId}/voiceAlert`), {
      message: `${userName} 房主 狠狠拒絕了你們的愛`,
      ts: Date.now(),
      sender: userName
    });

    // 2. 清除請求
    await remove(ref(db, `rooms/${currentRoomId}/loveRequest`));
    setIncomingLoveRequest(null);
  };

  const acceptLoveRequest = async () => {
    if (!incomingLoveRequest || !currentRoom) return;
    const { fromId, fromConductor, channels, mode } = incomingLoveRequest;

    const updates = {};
    // 1. 搬家頻道資料 (整合進 updates 原子操作)
    Object.entries(channels || {}).forEach(([ch, data]) => {
      updates[`rooms/${currentRoomId}/records/${ch}`] = data;
      // V16.4 FIX: 如果不是全毀模式，才需要手動設 null；全毀模式會直接刪除整間房
      if (mode !== 'all') {
        updates[`rooms/${fromId}/records/${ch}`] = null;
      }
    });

    // 2. 語音連動 (本地端)
    updates[`rooms/${currentRoomId}/voiceAlert`] = { message: `成功接受來自 ${fromConductor} 房主的愛`, ts: Date.now(), sender: userName };

    // 3. 通用清除請求 (無論何種模式都要移除)
    updates[`rooms/${currentRoomId}/loveRequest`] = null;

    if (mode === 'all') {
      // V16.4 FIX: 採用原子化刪除，防止 addRecord 或語音訊息在下一行導致房間「復活」
      updates[`rooms/${fromId}`] = null;
      updates[`roomSummaries/${fromId}`] = null;
      addSystemLog('TRANSFER', fromId, `執行毀滅式傳送至房間 ${currentRoomId}，原房間已合法銷毀`);
    } else {
      // 僅在房間未毀滅時才發送對面語音
      updates[`rooms/${fromId}/voiceAlert`] = { message: `${userName} 房主已經接受你們的愛`, ts: Date.now(), sender: userName };
    }

    // 4. 一次性提交，確保不會發生 race condition
    await update(ref(db), updates);
    setIncomingLoveRequest(null);
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

  const handleStolen = (chKey) => {
    if (!currentRoomId || !currentBoss) return;
    const nowSynced = getSyncedTime();
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), {
      lastKill: nowSynced,
      reporter: userName,
      isStolen: true,
      occupant: null
    });
    addSystemLog('STAMP', currentRoomId, `頻道 ${chKey.replace('CH', '')} BOSS 遭竊，啟動偵察倒數`);
  };

  const broadcastStatus = (ch) => {
    if (!currentRoomId || !currentBoss) return;
    const chNum = ch.replace('CH', '').trim();
    const rec = (currentRoom?.records || {})[ch] || {};
    const elapsedMin = (now - (rec.lastKill || 0)) / 60000;

    let message = `頻道 ${chNum} 已經重生`;
    if (currentBoss.maxTime) {
      if (elapsedMin < currentBoss.time) {
        const left = Math.ceil(currentBoss.time - elapsedMin);
        message = `頻道 ${chNum} 倒數中，還有 ${left} 分鐘`;
      } else if (elapsedMin < currentBoss.maxTime) {
        const left = Math.ceil(currentBoss.maxTime - elapsedMin);
        message = `頻道 ${chNum} 隨時可能重生，最晚還剩 ${left} 分鐘！`;
      } else {
        message = `頻道 ${chNum} 已滿 ${currentBoss.maxTime} 分鐘，最晚重生時間已到！`;
      }
    }

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
    // V11.5: Optimized to capture the entire tactical panel including metadata
    const element = document.getElementById('tactical-report-panel');
    if (!element) return;

    // 增加 scale 以提升文字清晰度，設置背景色確保玻璃擬態效果正確導出
    html2canvas(element, {
      backgroundColor: '#0a0a10',
      scale: 3,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => {
        const panel = clonedDoc.getElementById('tactical-report-panel');
        if (panel) panel.classList.add('exporting-png');
      }
    }).then(canvas => {
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `PiKaPi_TacticalReport_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const adminDeleteRoom = (roomId) => {
    if (!window.confirm(`確定要【強制刪除】房號 ${roomId} 嗎？`)) return;
    update(ref(db), {
      [`rooms/${roomId}`]: null,
      [`roomSummaries/${roomId}`]: null
    });
    addSystemLog('DELETE', roomId, `管理員 ${userName} 在指揮部執行【強制刪除】`);
  };

  const adminKickMember = (roomId, memberName) => {
    const cleanId = String(roomId || '').replace('#', '');
    console.log(`[正式踢除] 房號: ${cleanId}, 成員: ${memberName}`);

    if (!window.confirm(`確定要將成員 ${memberName} 【強制下車】嗎？`)) return;

    remove(ref(db, `rooms/${cleanId}/members/${memberName}`))
      .then(() => {
        addSystemLog('KICK', cleanId, `管理員 ${userName} 將 ${memberName} 強制逐出房間`);
        const summary = roomSummaries[cleanId];
        if (summary) {
          const newNames = (summary.memberNames || []).filter(n => n !== memberName);
          const updates = {
            memberNames: newNames,
            onlineCount: newNames.length,
            conductor: summary.conductor === memberName && newNames.length > 0 ? newNames[0] : summary.conductor
          };
          if (summary.conductor === memberName && newNames.length > 0) {
            update(ref(db, `rooms/${cleanId}`), { conductor: newNames[0] });
          }
          return update(ref(db, `roomSummaries/${cleanId}`), updates);
        }
      })
      .then(() => alert("✅ 已成功移除成員"))
      .catch(err => alert("❌ 移除失敗: " + err.message));
  };

  const applyForMembership = () => {
    if (!currentUser) return;
    const inputEl = document.getElementById('applyNicknameInput');
    const nicknameInput = inputEl ? inputEl.value.trim() : currentUser.displayName;

    if (inputEl && !nicknameInput) {
      alert("請填寫您的遊戲暱稱後再提交申請！");
      return;
    }

    const updates = {
      status: 'pending',
      appliedAt: Date.now()
    };

    if (nicknameInput) {
      updates.nickname = nicknameInput;
      updates.displayName = nicknameInput;
    }

    update(ref(db, `users/${currentUser.uid}`), updates);
    if (nicknameInput) setUserName(nicknameInput);

    // 即時切換畫面到「審核中」等候區
    setCurrentUser(prev => prev ? {
      ...prev,
      profile: {
        ...prev.profile,
        status: 'pending',
        ...(nicknameInput ? { nickname: nicknameInput, displayName: nicknameInput } : {})
      }
    } : null);

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
    const cleanId = String(roomId || '').replace('#', '');
    console.log(`[正式轉移] 房號: ${cleanId}, 新車長: ${newConductor}`);

    if (!window.confirm(`確定要將房號 ${cleanId} 的【車長】轉移給 ${newConductor} 嗎？`)) return;

    const updates = { conductor: newConductor };
    Promise.all([
      update(ref(db, `rooms/${cleanId}`), updates),
      update(ref(db, `roomSummaries/${cleanId}`), updates)
    ])
      .then(() => alert("👑 車長授權成功！"))
      .catch(err => alert("❌ 轉移失敗: " + err.message));
  };

  const adminResetUserStats = async (uid) => {
    if (!window.confirm("確定要【重置】該成員的所有打王數據與時長嗎？此動作亦會清除排行榜紀錄，且不可逆！")) return;

    const yyyymm = getYearMonth();
    const updates = {};

    // 1. 清除個人 Profile 節點
    updates[`users/${uid}/totalKills`] = 0;
    updates[`users/${uid}/totalHours`] = 0;
    updates[`users/${uid}/bossStats`] = null;
    updates[`users/${uid}/recentActivity`] = null;

    // 2. 同步清除排行榜紀錄 (v6.4)
    updates[`rankings/allTime/kills/${uid}`] = null;
    updates[`rankings/allTime/hours/${uid}`] = null;
    updates[`rankings/monthly/${yyyymm}/kills/${uid}`] = null;
    updates[`rankings/monthly/${yyyymm}/hours/${uid}`] = null;

    try {
      await update(ref(db), updates);
      alert("✅ 數據已重置！系統將重新抓取數據。");
      setHasInitialRankingsFetch(false); // 通報排行榜需重新同步
    } catch (e) {
      console.error("[Reset Error]", e);
      alert("❌ 重置失敗");
    }
  };

  const adminForceSyncRankings = async () => {
    if (!window.confirm("⚠️ 確定要【重構全站排行榜】嗎？這會從所有個人的最原始數據中提取戰績。")) return;
    setIsUsersLoading(true);
    try {
      const snap = await get(ref(db, 'users'));
      if (snap.exists()) {
        const users = snap.val();
        const updates = {};
        const currentMonth = getYearMonth();

        Object.entries(users).forEach(([uid, uData]) => {
          const name = uData.nickname || uData.displayName || '未知英雄';
          const kills = uData.totalKills || 0;
          const hours = uData.totalHours || 0;
          const photo = uData.photoURL || '🐶';

          if (kills > 0) {
            updates[`rankings/allTime/kills/${uid}`] = { v: kills, n: name, p: photo };
            updates[`rankings/monthly/${currentMonth}/kills/${uid}`] = { v: kills, n: name, p: photo };
          }
          if (hours > 0) {
            updates[`rankings/allTime/hours/${uid}`] = { v: hours, n: name, p: photo };
            updates[`rankings/monthly/${currentMonth}/hours/${uid}`] = { v: hours, n: name, p: photo };
          }
        });

        await update(ref(db), updates);
        alert("✅ 全站排行榜重構校準成功！");
      }
    } catch (err) {
      alert("❌ 數據重啟失敗: " + err.message);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const adminBanUser = (uid, name) => {
    if (!window.confirm(`確定要將成員 [${name}] 【永久剔除】嗎？\n(⚠️ 此動作將完全清除該使用者的 Firebase 資料與名錄紀錄)`)) return;

    // 1. 先將狀態設為 rejected，觸發對方的即時防護機制 (瞬間踢出畫面)
    update(ref(db, `users/${uid}`), { status: 'rejected' });

    // 2. 緩衝 2 秒確保對方已被踢出後，徹底抹除 Firebase 上的完整紀錄
    setTimeout(() => {
      remove(ref(db, `users/${uid}`));
      remove(ref(db, `presence/${uid}`));
    }, 2000);

    // 3. 即時從本地端名錄畫面中抹除，不再顯示
    setAllUsers(prev => {
      const updated = { ...prev };
      delete updated[uid];
      return updated;
    });

    // 能同步從所在房間強制踢出
    Object.values(rooms || {}).forEach(room => {
      if (room.members && room.members[name]) {
        remove(ref(db, `rooms/${room.id}/members/${name}`));
      }
    });
    alert("🥾 該成員已被強制剔除。");
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
    // v15.2 改由摘要獲取清單，不必等待全站 Rooms 加載
    const roomList = Object.entries(roomSummaries).map(([id, data]) => ({ id, ...data }));
    const userList = Object.entries(allUsers).map(([uid, data]) => ({ uid, ...data }));
    return (
      <div className="admin-container">
        <div className="admin-header">
          <div className="admin-title">🛡️ 戰略指揮部 <span className="admin-subtitle">最高管理權限</span></div>
          <div className="admin-tabs">
            <button className={`admin-tab ${adminTab === 'rooms' ? 'active' : ''}`} onClick={() => setAdminTab('rooms')}>房間概況</button>
            <button className={`admin-tab ${adminTab === 'users' ? 'active' : ''}`} onClick={() => setAdminTab('users')}>成員數據</button>
            <button className={`admin-tab ${adminTab === 'logs' ? 'active' : ''}`} onClick={() => setAdminTab('logs')}>日誌監控</button>
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

          {adminTab === 'rooms' && (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead><tr><th>房號</th><th>Boss</th><th>密碼</th><th>車長</th><th>當前成員 / 管理</th><th>操作</th></tr></thead>
                <tbody>
                  {roomList.map(r => {
                    return (
                      <tr key={r.id}>
                        <td data-label="房號" className="admin-room-id">#{r.id}</td>
                        <td data-label="Boss" className="admin-boss-name">{BOSSES[r.bossId]?.name || r.bossId}</td>
                        <td data-label="密碼" className="admin-room-pwd code-font">{r.password}</td>
                        <td data-label="車長" className="admin-conductor">{r.conductor}</td>
                        <td data-label="當前成員 / 管理" className="admin-members">
                          <div className="admin-member-tags">
                            {(r.memberNames || []).map(m => {
                              const isCond = r.conductor === m;
                              return (
                                <div key={m} className={`admin-member-tag ${isCond ? 'is-cond' : ''}`}>
                                  <span className="m-name">{isCond ? '👑' : ''} {m}</span>
                                  <div className="admin-inline-actions" style={{ display: 'inline-flex', gap: '4px', marginLeft: '8px' }}>
                                    {!isCond && (
                                      <button
                                        className="btn-micro"
                                        style={{ background: '#f6cf57', color: '#000', padding: '2px 6px', fontSize: '10px' }}
                                        onClick={() => adminTransferConductor(r.id, m)}
                                      >
                                        轉移
                                      </button>
                                    )}
                                    <button
                                      className="btn-micro"
                                      style={{ background: '#ff4444', color: '#fff', padding: '2px 6px', fontSize: '10px' }}
                                      onClick={() => adminKickMember(r.id, m)}
                                    >
                                      踢除
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {(!r.memberNames || r.memberNames.length === 0) && <span className="no-members">尚無成員</span>}
                          </div>
                        </td>
                        <td data-label="操作">
                          <button className="admin-btn-view" onClick={() => { setCurrentRoomId(r.id); setView('join'); }}>查看</button>
                          <button className="admin-btn-delete" onClick={() => adminDeleteRoom(r.id)}>解散</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'users' && (
            <div className="admin-users-view">
              {/* --- 獨立即時審核區塊 (不需載入全體成員即可查看) --- */}
              {/* Podium Reconstruction: 2nd - 1st - 3rd */}
              <div className="podium-section" style={{ margin: '20px 0', position: 'relative' }}>
                <h3>
                  🛡️ 申請等待區 (Pending Requests)
                  {Object.keys(pendingUsers).length > 0 && <span className="admin-pulse-indicator"></span>}
                </h3>
                {Object.keys(pendingUsers).length > 0 ? (
                  <div className="pending-list">
                    {Object.values(pendingUsers).map(pu => (
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
                ) : (
                  <div style={{ padding: '15px', color: '#888', textAlign: 'center', fontSize: '14px' }}>
                    ✅ 目前無任何待審核的入隊申請
                  </div>
                )}
              </div>

              {Object.keys(allUsers).length === 0 ? (
                <div className="admin-load-data-cta">
                  <div className="bandwidth-warning-box">
                    <h4>⚠️ 頻寬最佳化提示</h4>
                    <p>管理員名錄包含公會全體成員資料，讀取完整名錄會消耗大量流量。建議僅在維護時開啟。</p>
                    <button
                      className="btn-v9-report"
                      style={{ marginTop: '20px', padding: '15px 40px' }}
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
                    <button className="btn-v9-grey" onClick={fetchAllUsers} style={{ marginLeft: '10px' }} disabled={isUsersLoading}>
                      {isUsersLoading ? '刷新中...' : '🔄 重新整理'}
                    </button>
                    {isAdmin && (
                      <button
                        className="btn-v9-report"
                        onClick={adminForceSyncRankings}
                        style={{ marginLeft: '10px', background: 'var(--pink-glow)', boxShadow: '0 0 10px var(--pink-glow)' }}
                        disabled={isUsersLoading}
                      >
                        ⚡️ 戰略修復：重構排行榜
                      </button>
                    )}
                  </div>

                  <div className="admin-table-wrapper">
                    {adminUserSubTab === 'stats' ? (
                      <table className="admin-table">
                        <thead><tr><th>完整 UID</th><th>暱稱</th><th>總擊殺</th><th>總打王時間</th></tr></thead>
                        <tbody>
                          {userList
                            .filter(u => (u.nickname || u.displayName || '').includes(adminUserSearchTerm) || u.uid.includes(adminUserSearchTerm))
                            .map(u => (
                              <tr key={u.uid}>
                                <td data-label="完整 UID" className="admin-uid code-font" style={{ wordBreak: 'break-all', maxWidth: '200px', fontSize: '10px' }}>{u.uid}</td>
                                <td data-label="暱稱" className="admin-nickname">{u.nickname || u.displayName}</td>
                                <td data-label="總擊殺" className="admin-kills">{u.totalKills || 0}</td>
                                <td data-label="總打王時間">{(u.totalHours || 0).toFixed(1)} h</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="admin-table">
                        <thead><tr><th>成員</th><th>完整 UID</th><th>身份與說明</th><th>狀態</th><th>位置</th><th>加入日期</th><th>維護</th></tr></thead>
                        <tbody>
                          {userList
                            .filter(u => (u.nickname || u.displayName || '').includes(adminUserSearchTerm) || u.uid.includes(adminUserSearchTerm))
                            .map(u => {
                              const rInfo = getRoleInfo(u.uid);
                              return (
                                <tr key={u.uid}>
                                  <td data-label="成員" className="admin-user-cell">
                                    {renderAvatar(u.photoURL, "admin-mini-avatar")}
                                    <span>{u.nickname || u.displayName}</span>
                                  </td>
                                  <td data-label="完整 UID" className="admin-uid code-font" style={{ wordBreak: 'break-all', maxWidth: '200px', fontSize: '10px' }}>{u.uid}</td>
                                  <td data-label="身份與說明">
                                    <div style={{ color: rInfo.color, fontWeight: 'bold' }}>{rInfo.role}</div>
                                    <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{rInfo.desc}</div>
                                  </td>
                                  <td data-label="狀態">
                                    {u.status === 'rejected' ? (
                                      <span style={{ color: '#ff4444', fontWeight: 'bold' }}>🔴 已停權</span>
                                    ) : (
                                      <>
                                        <span className={`status-dot ${u.isOnline ? 'online' : 'offline'}`}></span>
                                        {u.isOnline ? '線上' : '離線'}
                                      </>
                                    )}
                                  </td>
                                  <td data-label="位置" className="location-text">{getUserCurrentLocation(u.nickname || u.displayName)}</td>
                                  <td data-label="加入日期" className="date-text">{u.createdAt ? new Date(u.createdAt).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '早期成員'}</td>
                                  <td data-label="管理維護">
                                    {/* 允許 Pika 重置自己的數據 (v6.4) */}
                                    {(u.uid !== PIKA_UID || currentUser.uid === PIKA_UID) && (
                                      <button className="btn-danger btn-micro" onClick={() => adminResetUserStats(u.uid)}>重置</button>
                                    )}
                                    {(currentUser.uid === PIKA_UID ? u.uid !== PIKA_UID : (u.uid !== PIKA_UID && u.uid !== ADMIN_UID)) && (
                                      <button className="btn-danger btn-micro" style={{ marginLeft: '5px', background: 'rgba(255,0,0,0.2)' }} onClick={() => adminBanUser(u.uid, u.nickname || u.displayName)}>剔除</button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {adminTab === 'logs' && (
            <div className="admin-logs-view fade-in">
              <div className="logs-guide-btn-wrapper" style={{ marginBottom: '15px' }}>
                <button
                  className="btn-liquid-glass lg-blue"
                  onClick={() => setShowLogGuide(!showLogGuide)}
                  style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '12px' }}
                >
                  {showLogGuide ? '📖 收合說明手冊' : '📖 查看日誌說明 / 定義 (點擊此處了解行為含義)'}
                </button>
              </div>

              {showLogGuide && (
                <div className="logs-manual-card card-bg glass-panel" style={{ marginBottom: '20px', padding: '20px' }}>
                  <h4 style={{ color: 'var(--blue)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon">📡</span> 行為代碼圖例 (Command Legend)
                  </h4>
                  <table className="admin-table mini-table">
                    <thead>
                      <tr><th>識別</th><th>指導說明 (描述)</th><th>戰略目的</th></tr>
                    </thead>
                    <tbody>
                      <tr><td className="log-type-tag create">🚀 [建立]</td><td>建立新房間</td><td>追蹤房間的出生起點。</td></tr>
                      <tr><td className="log-type-tag stamp">⌛ [標記]</td><td>偵測到零人，啟動倒數</td><td>確認判定「空房」的時間點。</td></tr>
                      <tr><td className="log-type-tag clear">🛡️ [解除]</td><td>偵測到人上車，解除倒數</td><td>確認標記已被「阻斷」，防止誤刪。</td></tr>
                      <tr><td className="log-type-tag delete">🚮 [銷毀]</td><td>空房超時，執行物理刪除</td><td>確認系統回收路徑 (真正消失點)。</td></tr>
                      <tr><td className="log-type-tag transfer">💖 [連動]</td><td>毀滅傳送 (ALL) 導致移除</td><td>確認人為操作導致的房間消失。</td></tr>
                      <tr><td className="log-type-tag leave">🏃 [離開]</td><td>成員主動點選下車</td><td>追蹤人員正常流動。</td></tr>
                      <tr><td className="log-type-tag kick">🚫 [請下車]</td><td>成員被車長強制移除</td><td>追蹤管理行為。</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="logs-strem-wrapper card-bg glass-panel" style={{ padding: '20px', maxHeight: '600px', overflowY: 'auto' }}>
                {systemLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>🛰️ 暫無通訊紀錄，請待命偵測...</div>
                ) : (
                  <div className="logs-list">
                    {systemLogs.map(log => (
                      <div key={log.id} className="log-item" style={{
                        padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '15px', alignItems: 'center'
                      }}>
                        <span className="log-ts" style={{ color: '#666', fontSize: '11px', whiteSpace: 'nowrap', minWidth: '80px' }}>
                          {new Date(log.ts).toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className={`log-badge-v179 ${log.type?.toLowerCase()}`} style={{
                          minWidth: '55px', textAlign: 'center', fontSize: '11px', fontWeight: '800',
                          padding: '3px 8px', borderRadius: '6px', color: '#fff',
                          background: log.type === 'DELETE' ? 'var(--danger)' :
                            (log.type === 'STAMP' ? 'var(--gold-dark)' :
                              (log.type === 'CLEAR' || log.type === 'JOIN' || log.type === 'LEAVE' ? 'var(--ready)' :
                                (log.type === 'KICK' ? 'var(--danger)' : 'rgba(255,255,255,0.1)')))
                        }}>
                          {log.type}
                        </div>
                        <span className="log-rid" style={{ color: 'var(--blue)', fontWeight: '800', letterSpacing: '1px' }}>#{log.rid}</span>
                        <span className="log-msg" style={{ fontSize: '13px', color: '#ddd' }}>{log.msg}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 移除原本這裡的 adminMenu 區塊 */}
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
              <span className="s-title" style={{ color: currentRank.color }}>{currentRank.fullTitle}</span>
              <span className="s-level">Lv.{currentRank.level}</span>
            </div>
            <div className="summary-progress">
              <div className="p-bar-bg"><div className="p-bar-fill" style={{ width: `${currentRank.progress}%`, background: currentRank.color }}></div></div>
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
                onClick={() => setSelectedMedal({ ...rank, levelRange: `Lv.${idx * 5 + 1} - ${idx * 5 + 5}` })}
              >
                <div className="m-badge" style={{ borderColor: isUnlocked ? rank.color : 'rgba(255,255,255,0.1)' }}>
                  <span className="m-icon">{rank.badge}</span>
                  {isUnlocked && <div className="m-glow" style={{ background: rank.color }}></div>}
                </div>
                <div className="m-info">
                  <div className="m-name" style={{ color: isUnlocked ? '#fff' : '#444' }}>{rank.title}</div>
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
              <div className="p-badge-large" style={{ borderColor: selectedMedal.color }}>
                <span className="p-icon-large">{selectedMedal.badge}</span>
                <div className="p-glow-large" style={{ background: selectedMedal.color }}></div>
              </div>
              <h2 style={{ color: selectedMedal.color }}>{selectedMedal.title}</h2>
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
              <button className="v9-btn-confirm" onClick={() => setSelectedMedal(null)} style={{ marginTop: '30px', width: '100%' }}>確認收到榮耀</button>
            </div>
          </div>
        )}

        <button className="v9-btn-secondary back-lobby-btn" onClick={() => setView('lobby')}>返回大廳中心</button>
      </div>
    );
  };

  const renderLeaderboardView = () => {
    const podium = leaderboardData.slice(0, 3);
    const rest = leaderboardData.slice(3);
    const isKills = leaderboardMetric === 'kills';
    const isExp = leaderboardCategory === 'exp';

    const renderPodiumPlaceholder = (rankText) => (
      <div className="podium-placeholder">
        <span>{rankText} WAIT...</span>
      </div>
    );

    const renderPodiumValue = (v, obj) => {
      if (isExp) {
        if (leaderboardExpMetric === 'gainedExp') {
          return <>{`+${Math.round(v || 0).toLocaleString()}`} <small>EXP</small></>;
        }
        if (leaderboardExpMetric === 'peakPace') {
          return <>{`+${Math.round(v || 0).toLocaleString()}`} <small>/HR</small></>;
        }
        if (leaderboardExpMetric === 'hours') {
          return <>{(v || 0).toFixed(1)} <small>HRS</small></>;
        }
        if (leaderboardExpMetric === 'level') {
          const lvl = obj?.lvl || Math.floor(v || 1);
          const pct = obj?.pct !== undefined ? obj.pct : ((v - Math.floor(v)) * 100);
          return <>Lv.{lvl} <small>({Number(pct).toFixed(2)}%)</small></>;
        }
      }
      return <>{(v || 0).toFixed(isKills ? 0 : 1)} <small>{isKills ? 'KILLS' : 'HRS'}</small></>;
    };

    const renderTableValue = (v, obj) => {
      if (isExp) {
        if (leaderboardExpMetric === 'gainedExp') {
          return `+${Math.round(v || 0).toLocaleString()} EXP`;
        }
        if (leaderboardExpMetric === 'peakPace') {
          return `+${Math.round(v || 0).toLocaleString()} /hr`;
        }
        if (leaderboardExpMetric === 'hours') {
          return `${(v || 0).toFixed(1)} hrs`;
        }
        if (leaderboardExpMetric === 'level') {
          const lvl = obj?.lvl || Math.floor(v || 1);
          const pct = obj?.pct !== undefined ? obj.pct : ((v - Math.floor(v)) * 100);
          return `Lv. ${lvl} (${Number(pct).toFixed(2)}%)`;
        }
      }
      return `${(v || 0).toFixed(isKills ? 0 : 1)} ${isKills ? 'KILLS' : 'HRS'}`;
    };

    const renderHeroValue = () => {
      if (!currentUser) return null;
      if (isExp) {
        const myEntry = leaderboardData.find(u => u.uid === currentUser.uid);
        if (myEntry) return renderTableValue(myEntry.v, myEntry);
        if (leaderboardExpMetric === 'gainedExp') {
          return `+${(currentUser.profile?.totalExpGained || 0).toLocaleString()} EXP`;
        }
        if (leaderboardExpMetric === 'hours') {
          return `${(currentUser.profile?.totalExpHours || 0).toFixed(1)} hrs`;
        }
        if (leaderboardExpMetric === 'level') {
          return `Lv. ${currentUser.profile?.currentLevel || 50} (${(currentUser.profile?.currentPercent || 0).toFixed(2)}%)`;
        }
        return '尚無記錄';
      }
      return isKills ? (currentUser.profile?.totalKills || 0) : (currentUser.profile?.totalHours || 0).toFixed(1);
    };

    return (
      <div className="leaderboard-view-container glass-panel fade-in">
        <div className="leaderboard-header">
          <button className="btn-secondary-glass" onClick={() => setView('lobby')}>⬅ 返回大廳中心</button>
          <div className="leaderboard-title-group">
            <h2 className="boss-highlight">
              PiKaPi 榮譽殿堂 <small style={{ fontSize: '0.6rem', opacity: 0.6, verticalAlign: 'middle' }}>{isExp ? '⚡ 經驗練功榜' : '⚔️ 野王擊殺榜'}</small>
            </h2>
            <p className="subtitle">{isExp ? '紀錄公會成員練功極限時速與不懈奮戰戰果' : '匯集頂尖戰意與不朽戰果的殿堂'}</p>
          </div>
          <div className="leaderboard-period-select">
            <button className={`sync-btn-v6 ${syncCooldown > 0 ? 'is-cooling' : ''}`} onClick={() => fetchLeaderboard(true)} disabled={isLeaderboardLoading || syncCooldown > 0}>
              {isLeaderboardLoading ? `⏳ 同步中 (${syncCountdown}s)...` : (syncCooldown > 0 ? `📡 冷卻中 (${syncCooldown}s)` : '📡 同步數據')}
            </button>
          </div>
        </div>

        {/* 一級分類切換標籤：野王擊殺榜 vs 經驗練功榜 */}
        <div className="leaderboard-category-tabs">
          <button
            className={`category-tab-btn ${!isExp ? 'active' : ''}`}
            onClick={() => setLeaderboardCategory('boss')}
          >
            ⚔️ 野王擊殺榜
          </button>
          <button
            className={`category-tab-btn category-exp ${isExp ? 'active' : ''}`}
            onClick={() => setLeaderboardCategory('exp')}
          >
            ⚡ 經驗練功榜
          </button>
        </div>

        {/* 二級控制列：指標與週期 */}
        <div className="leaderboard-main-controls">
          {!isExp ? (
            <>
              <div className="sub-nav-btns">
                <button className={leaderboardMetric === 'kills' ? 'active' : ''} onClick={() => setLeaderboardMetric('kills')}>⚔️ 擊殺戰神榜</button>
                <button className={leaderboardMetric === 'hours' ? 'active' : ''} onClick={() => setLeaderboardMetric('hours')}>🛡️ 站崗英雄榜</button>
              </div>
              <div className="sub-nav-btns">
                <button className={leaderboardPeriod === 'allTime' ? 'active' : ''} onClick={() => setLeaderboardPeriod('allTime')}>總累積榮譽</button>
                <button className={leaderboardPeriod === 'monthly' ? 'active' : ''} onClick={() => setLeaderboardPeriod('monthly')}>月賽季排行</button>
              </div>
              {leaderboardPeriod === 'monthly' && (
                <select className="v9-profile-input" style={{ width: 'auto', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--glass-border)', padding: '5px', borderRadius: '8px' }} value={leaderboardMonth} onChange={e => setLeaderboardMonth(e.target.value)}>
                  {availableRankMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </>
          ) : (
            <>
              <div className="sub-nav-btns">
                <button className={leaderboardExpMetric === 'gainedExp' ? 'active' : ''} onClick={() => setLeaderboardExpMetric('gainedExp')}>🔥 累積經驗</button>
                <button className={leaderboardExpMetric === 'peakPace' ? 'active' : ''} onClick={() => setLeaderboardExpMetric('peakPace')}>⚡ 刷怪時均</button>
                <button className={leaderboardExpMetric === 'hours' ? 'active' : ''} onClick={() => setLeaderboardExpMetric('hours')}>⏱️ 練功時長</button>
                <button className={leaderboardExpMetric === 'level' ? 'active' : ''} onClick={() => setLeaderboardExpMetric('level')}>🎖️ 角色等級</button>
              </div>
              <div className="sub-nav-btns">
                <button className={leaderboardExpPeriod === 'today' ? 'active' : ''} onClick={() => setLeaderboardExpPeriod('today')}>⚡ 今日衝刺</button>
                <button className={leaderboardExpPeriod === 'monthly' ? 'active' : ''} onClick={() => setLeaderboardExpPeriod('monthly')}>📅 月賽季排行</button>
                <button className={leaderboardExpPeriod === 'allTime' ? 'active' : ''} onClick={() => setLeaderboardExpPeriod('allTime')}>👑 總累積榮譽</button>
              </div>
              {leaderboardExpPeriod === 'monthly' && (
                <select className="v9-profile-input" style={{ width: 'auto', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid var(--glass-border)', padding: '5px', borderRadius: '8px' }} value={leaderboardMonth} onChange={e => setLeaderboardMonth(e.target.value)}>
                  {availableExpMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </>
          )}
        </div>

        <div className="podium-section">
          {!hasInitialRankingsFetch && !isLeaderboardLoading && (
            <div className="dormant-hall-overlay">
              <button
                className={`v9-btn-report ${syncCooldown > 0 ? 'is-cooling' : ''}`}
                style={{ padding: '20px 40px', fontSize: '1.2rem', boxShadow: '0 0 40px var(--pink-glow)' }}
                onClick={() => fetchLeaderboard(true)}
                disabled={syncCooldown > 0}
              >
                {syncCooldown > 0 ? `📡 冷卻等待中 (${syncCooldown}s)` : '📡 載入殿堂數據'}
              </button>
              <p style={{ marginTop: '15px', color: 'var(--gold)', opacity: 0.8, fontSize: '0.8rem', letterSpacing: '1px' }}>
                {syncCooldown > 0 ? '戰略冷卻中，請喝杯水稍候再啟動同步' : '數據已靜止，點擊啟動戰略同步'}
              </p>
            </div>
          )}

          <div className="podium-grid">
            {/* Rank 2 (Left) */}
            {podium[1] ? (
              <div className="v9-podium-card v9-rank-2">
                <div className="rank-label">NO.2 SILVER</div>
                <div className="v9-avatar-wrap">
                  {renderAvatar(podium[1].p || podium[1].a, "podium-avatar", { width: '80px', height: '80px', border: '3px solid #C0C0C0' })}
                </div>
                <div className="podium-name">{podium[1].n}</div>
                <div className="podium-value">{renderPodiumValue(podium[1].v, podium[1])}</div>
                <div className="digital-pillar"></div>
              </div>
            ) : renderPodiumPlaceholder('NO.2')}

            {/* Rank 1 (Center) */}
            {podium[0] ? (
              <div className="v9-podium-card v9-rank-1">
                <div className="rank-label">NO.1 CHAMPION</div>
                <div className="v9-avatar-wrap">
                  <div className="crown-icon" style={{ fontSize: '2.5rem', top: '-45px' }}>👑</div>
                  {renderAvatar(podium[0].p || podium[0].a, "podium-avatar", { width: '110px', height: '110px', border: '4px solid var(--gold)', boxShadow: '0 0 30px var(--gold-glow)' })}
                </div>
                <div className="podium-name" style={{ fontSize: '1.4rem' }}>{podium[0].n}</div>
                <div className="podium-value" style={{ fontSize: '1.8rem' }}>{renderPodiumValue(podium[0].v, podium[0])}</div>
                <div className="digital-pillar"></div>
              </div>
            ) : renderPodiumPlaceholder('NO.1')}

            {/* Rank 3 (Right) */}
            {podium[2] ? (
              <div className="v9-podium-card v9-rank-3">
                <div className="rank-label">NO.3 BRONZE</div>
                <div className="v9-avatar-wrap">
                  {renderAvatar(podium[2].p || podium[2].a, "podium-avatar", { width: '75px', height: '75px', border: '3px solid #CD7F32' })}
                </div>
                <div className="podium-name">{podium[2].n}</div>
                <div className="podium-value">{renderPodiumValue(podium[2].v, podium[2])}</div>
                <div className="digital-pillar"></div>
              </div>
            ) : renderPodiumPlaceholder('NO.3')}
          </div>
        </div>

        <div className="leaderboard-list-wrap">
          <table className="v9-tactical-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '120px' }}>RANKING</th>
                <th>MEMBER</th>
                <th style={{ textAlign: 'right' }}>
                  {isExp ? (
                    leaderboardExpMetric === 'gainedExp' ? 'GAINED EXP' :
                    leaderboardExpMetric === 'peakPace' ? 'PACE (/HR)' :
                    leaderboardExpMetric === 'hours' ? 'DURATION' : 'LEVEL & PROGRESS'
                  ) : (
                    `VALUE (${isKills ? 'KILLS' : 'HOURS'})`
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* --- 豪豪 (MY TACTICAL STATS) 置頂 Hero Row (v8.0) --- */}
              {currentUser && (
                <tr className="v9-row v9-row-hero">
                  <td data-label="排名" className="col-rank" style={{ textAlign: 'center' }}>
                    <span className="hero-badge">MY STATS</span>
                  </td>
                  <td data-label="成員" className="col-member">
                    <div className="admin-user-cell" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {renderAvatar(currentUser.profile?.photoURL, "admin-mini-avatar", { width: '36px', height: '36px', border: '2px solid var(--gold)' })}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '950', color: '#fff' }}>{userName}</span>
                        <span style={{ fontSize: '10px', opacity: 0.6 }}>
                          {isExp 
                            ? `LV. ${currentUser.profile?.currentLevel || 50} (${(currentUser.profile?.currentPercent || 0).toFixed(2)}%)`
                            : `RANK: ${getRankInfo(currentUser.profile?.totalKills || 0).title}`}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label="戰績" className="col-value highlight-num" style={{ textAlign: 'right' }}>
                    {renderHeroValue()}
                  </td>
                </tr>
              )}

              {rest.map((u, i) => (
                <tr key={u.uid} className="v9-row">
                  <td className="col-rank" style={{ textAlign: 'center' }}>#{i + 4}</td>
                  <td className="col-member">
                    <div className="admin-user-cell" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {renderAvatar(u.p || u.a, "admin-mini-avatar", { width: '36px', height: '36px' })}
                      <span style={{ fontWeight: '800' }}>{u.n}</span>
                    </div>
                  </td>
                  <td className="col-value highlight-num" style={{ textAlign: 'right' }}>{renderTableValue(u.v, u)}</td>
                </tr>
              ))}
              {leaderboardData.length === 0 && !isLeaderboardLoading && hasInitialRankingsFetch && (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '80px', opacity: 0.3, letterSpacing: '2px' }}>此榜單尚無紀錄，點擊右上角同步或開始練功！</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (authChecking) return <div className="loading-screen">連線中...</div>;

    // V16.0: 多重會話衝突阻斷
    if (isKickedByOtherDevice) {
      return (
        <div className="modal-overlay session-kick-overlay" style={{ background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="v30-hud-console kicked-alert" style={{ maxWidth: '400px', border: '2px solid #ff4444', animation: 'pulse-red 2s infinite' }}>
            <div className="v30-console-header danger" style={{ background: '#ff4444', color: '#fff' }}>
              <div style={{ fontWeight: '900' }}>⚠️ 戰術連線衝突 (SESSION CONFLICT)</div>
            </div>
            <div className="v30-console-body centered" style={{ padding: '40px 30px', textAlign: 'center' }}>
              <h3 style={{ color: '#ff4444' }}>您的帳號已從另一台設備登入</h3>
              <p style={{ fontSize: '14px', opacity: 0.8, marginTop: '15px' }}>為了優化系統頻寬並維護數據安全性，本分頁已停止所有戰術同步。</p>
              <div style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                <button
                  className="v30-btn-primary"
                  onClick={() => window.location.reload()}
                  style={{ background: '#ff4444', width: '100%', padding: '15px', borderRadius: '8px', fontWeight: '900' }}
                >
                  重新獲取連線主權
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    try {
      if (!currentUser) {
        return (
          <div className="landing-page-container">
            <div className="landing-content glass-panel">
              <h1 className="landing-title neon-text">PIKAPI<br />GUILD TRACKER</h1>
              <p className="landing-subtitle">專業公會戰役管理・專屬戰報・把愛傳下去 V16.3 - ORPHANED TIMER</p>

              {!isNativeAuthVisible ? (
                <div className="auth-options fade-in">
                  <button className="login-btn-large google-btn" onClick={handleLogin}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                    使用 Google 帳號登入
                  </button>
                  <div className="auth-separator"><span>或者</span></div>
                  <button className="login-btn-outline" onClick={() => setIsNativeAuthVisible(true)}>
                    使用 Email 帳號登入 / 註冊
                  </button>
                </div>
              ) : (
                <form className="native-auth-form fade-in" onSubmit={handleNativeAuth}>
                  <div className="form-header">
                    <h3>{isRegisterMode ? '建立新帳號' : '帳號登入'}</h3>
                    <button type="button" className="close-form-btn" onClick={() => setIsNativeAuthVisible(false)}>返回</button>
                  </div>

                  <div className="input-group-v9">
                    <label>電子郵件 (Email)</label>
                    <input
                      type="email"
                      placeholder="example@mail.com"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                    />
                  </div>

                  <div className="input-group-v9">
                    <label>密碼 (Password)</label>
                    <input
                      type="password"
                      placeholder="至少 6 位數"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                    />
                  </div>

                  {authError && <div className="auth-error-msg">{authError}</div>}

                  <button type="submit" className="submit-auth-btn">
                    {isRegisterMode ? '立即註冊' : '確認登入'}
                  </button>

                  <div className="auth-footer">
                    <span>{isRegisterMode ? '已有帳號？' : '還沒有帳號？'}</span>
                    <button type="button" className="toggle-mode-btn" onClick={() => {
                      setIsRegisterMode(!isRegisterMode);
                      setAuthError('');
                    }}>
                      {isRegisterMode ? '去登入' : '立即註冊'}
                    </button>
                  </div>
                </form>
              )}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '25px 0' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {renderAvatar(currentUser.photoURL, "giant-avatar-img", { width: '100%', height: '100%', fontSize: '40px', lineHeight: '80px', textAlign: 'center' })}
                  </div>
                  <span style={{ marginTop: '15px', fontSize: '20px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>
                    Hi, {userName || '英雄'}
                  </span>
                </div>
              )}
              <p className="landing-subtitle">請填寫您的遊戲暱稱並向管理員提交申請，<br />審核通過後即可開始紀錄。 V16.3 - ORPHANED TIMER</p>
              <div style={{ marginTop: '10px', marginBottom: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <input
                  type="text"
                  id="applyNicknameInput"
                  className="v9-profile-input"
                  style={{ width: '80%', padding: '12px', fontSize: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.5)' }}
                  placeholder="請輸入您的遊戲暱稱 (必填)"
                  defaultValue={userName !== '新隊員' ? userName : ''}
                />
              </div>
              <button className="apply-btn-premium" onClick={applyForMembership}>
                🚀 提交加入申請
              </button>
              <button
                className="btn-danger"
                onClick={handleLogout}
                style={{ marginTop: '20px', background: 'transparent', border: 'none', textDecoration: 'underline', color: 'rgba(255,255,255,0.4)' }}
              >
                切換帳號登出
              </button>
            </div>
          </div>
        );
      }
      const userStatus = currentUser?.profile?.status;

      if (view === 'hub') {
        const rank = getRankInfo(currentUser.profile?.totalKills, currentUser.profile?.totalHours);
        const roleInfo = getRoleInfo(currentUser.uid);
        return (
          <HubView
            currentUser={currentUser}
            userName={userName}
            rankInfo={rank}
            roleInfo={roleInfo}
            onNavigate={(targetView) => setView(targetView)}
            onLogout={handleLogout}
          />
        );
      }
      if (view === 'exp-helper') {
        return (
          <ExpHelper
            currentUser={currentUser}
            userName={userName}
            onBackToHub={() => setView('hub')}
            onSyncExp={(data) => syncExpToRankings(currentUser?.uid, userName, currentUser?.profile?.photoURL, data)}
          />
        );
      }
      if (view === 'admin' && isAdmin) return renderAdminDashboard();
      if (view === 'leaderboard') return renderLeaderboardView();

      // 等待審核或被拒絕的特殊視圖 (v4.9)
      if (currentUser && currentUser.uid !== PIKA_UID && (userStatus === 'rejected' || (!isAdmin && userStatus !== 'approved'))) {
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
              <div className="waiting-actions" style={{ marginTop: '30px' }}>
                {isRejected && (
                  <>
                    <input
                      type="text"
                      id="applyNicknameInput"
                      className="v9-profile-input"
                      style={{ width: '80%', padding: '10px', fontSize: '14px', textAlign: 'center', background: 'rgba(0,0,0,0.5)', marginBottom: '15px' }}
                      placeholder="更新您的遊戲暱稱 (必填)"
                      defaultValue={userName !== '新隊員' ? userName : ''}
                    />
                    <button className="login-btn-large" onClick={applyForMembership}>重新提交申請</button>
                  </>
                )}
                <button className="btn-danger" onClick={handleLogout} style={{ marginTop: '15px' }}>登出帳號</button>
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
                  <p className="profile-uid" style={{ fontSize: '10px', opacity: 0.5 }}>{currentUser.uid}</p>
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
                      <span className="act-time">{new Date(act.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="act-boss">{act.bossName}</span>
                      <span className="act-ch">{act.ch}</span>
                      <span className="act-badge">擊殺 ✅</span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="v9-btn-secondary back-lobby-btn" onClick={() => setView('lobby')}>返回大廳中心</button>
            </div>
          </div>
        );
      }
      if (view === 'lobby') {
        return (
          <div className="lobby-container">
            <header className="lobby-header">
              <div className="version-tag">Build v16.3 - ORPHANED TIMER</div>
              <h1>PiKaPi 公會和諧打王趣</h1>
              <p>專業野王紀錄管理系統</p>
            </header>
            <section className="lobby-controls">
              <div className="boss-selector-v105">
                <div className="boss-selector-header">
                  <label className="hud-label">🎯 作戰目標切換</label>
                  <span className="selected-area-hint">{BOSSES[selectedBossId]?.area}</span>
                </div>
                <div className="v105-boss-grid">
                  {Object.entries(BOSSES).map(([id, boss]) => (
                    <div
                      key={id}
                      className={`v105-boss-chip theme-${id} ${selectedBossId === id ? 'active' : ''}`}
                      onClick={() => setSelectedBossId(id)}
                    >
                      <span className="area-tag">{boss.area}</span>
                      <span className="boss-name">{boss.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="control-actions-v105">
                <button className="create-room-btn-v105" onClick={() => setShowCreateModal(true)}>
                  創建打王房間
                </button>
                <div className="sync-status-v105">
                  <button className="sync-btn-v105" onClick={fetchRoomSummaries}>🔄</button>
                  <p className="last-sync">上次更新於 {lastSummariesUpdate ? new Date(lastSummariesUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '尚未更新'}</p>
                </div>
              </div>
            </section>

            {/* V11.0: Active Mission Shortcut (V12.5: Only show if actually joined) */}
            {lastJoinedRoomId && roomSummaries[lastJoinedRoomId] && (
              <div className="tactical-mission-banner-v11 breathing-pulse-v11">
                <div className="mission-info-v11">
                  <span className="mission-radar">📡</span>
                  <span className="mission-desc">
                    <b>戰區直連：</b>您目前在 <b>{BOSSES[roomSummaries[lastJoinedRoomId]?.bossId]?.name || '未知目標'}</b> 的指揮頻道中
                  </span>
                </div>
                <button className="jump-back-btn-v11" onClick={() => {
                  setCurrentRoomId(lastJoinedRoomId);
                  const myData = roomSummaries[lastJoinedRoomId]?.members?.[userName];
                  if (myData && myData.joinedAt) {
                    setSessionStartTime(myData.joinedAt);
                  }
                  setView('room');
                }}>
                  立即返回戰場 (無需密碼)
                </button>
              </div>
            )}

            <div className="lobby-main">
              <h2 className="section-title">房間列表 - {BOSSES[selectedBossId]?.name}</h2>
              <div className="list-container">
                {bossRooms.length === 0 && <div className="empty-msg">目前沒有房間，快去當車長吧！</div>}
                {bossRooms.map(room => {
                  const memberCount = room.onlineCount ?? 0;
                  const isOrphaned = !room.conductor;

                  // 計算孤兒房剩餘壽命 (V16.3: 倒數計時器)
                  let countdownText = "";
                  if (isOrphaned && room.emptySince) {
                    const remainingMs = Math.max(0, (room.emptySince + ROOM_AUTO_DELETE_MS) - now);
                    const hours = Math.floor(remainingMs / 3600000);
                    const minutes = Math.floor((remainingMs % 3600000) / 60000);
                    const seconds = Math.floor((remainingMs % 60000) / 1000);
                    countdownText = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                  }

                  return (
                    <div key={room.id} className={`list-row ${isOrphaned ? 'orphaned-room' : ''}`}>
                      <div className="col-ch">{room.id}</div>
                      <div className="col-boss">
                        {room.conductor || <span style={{ color: '#ff4444', fontWeight: 'bold' }}>⚠️ 這城市那麼空</span>}
                      </div>
                      <div className="room-count"><b>{memberCount}</b> 人</div>
                      <div className="room-time">{formatTime(now - room.createdAt)}</div>
                      <div className="room-status">
                        {isOrphaned ? (
                          <div style={{ color: '#ff8a65', fontSize: '11px', animation: 'pulse-text 2s infinite' }}>
                            🧬 銷毀倒數：{countdownText}
                          </div>
                        ) : (
                          <><span className="status-pulse-green">●</span> 熱烈打王中...</>
                        )}
                      </div>
                      <div className="room-action">
                        {lastJoinedRoomId === room.id ? (
                          <button className="join-room-btn-v11 active-session" onClick={() => {
                            setCurrentRoomId(room.id);
                            const myData = room.members?.[userName];
                            if (myData && myData.joinedAt) {
                              setSessionStartTime(myData.joinedAt);
                            }
                            setView('room');
                          }}>
                            返回房間
                          </button>
                        ) : (
                          <button className="join-room-btn-v11" onClick={() => { setCurrentRoomId(room.id); setView('join'); }}>
                            加入房間
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
        const room = roomSummaries[currentRoomId] || rooms[currentRoomId];
        if (!room) return <div className="error-view">房間已不存在 <button onClick={() => setView('lobby')}>回大廳</button></div>;
        return (
          <div className="join-container">
            <div className="modal">
              <h2>加入房間 {currentRoomId}</h2>
              <p>Boss: {BOSSES[room.bossId]?.name}</p>

              <div className="v9-readonly-input" style={{ marginBottom: '15px' }}>
                <span className="label">登場身分 :</span>
                <span className="value">{userName}</span>
              </div>

              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="請輸入房間密碼"
                autoFocus
              />

              <div className="modal-btns">
                <button onClick={joinRoom}>上車</button>
                <button onClick={() => { setView('lobby'); setCurrentRoomId(null); }} className="cancel-btn">回大廳</button>
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
          <div className={`room-container-v25 boss-theme-${currentRoom.bossId} fade-in ${showMobileHud ? 'hud-open' : 'hud-closed'}`}>
            {/* 房內戰術通報 Toast (雙階段重生與保底提醒) */}
            {roomAlertToast && (
              <div className={`tactical-toast-banner fade-in toast-${roomAlertToast.type}`}>
                <div className="toast-icon">{roomAlertToast.type === 'window' ? '🎲' : '👑'}</div>
                <div className="toast-body">
                  <div className="toast-headline">{roomAlertToast.title} <span className="toast-ch">{roomAlertToast.ch}</span></div>
                  <div className="toast-subtext">{roomAlertToast.message}</div>
                </div>
                <button className="toast-close" onClick={() => setRoomAlertToast(null)}>✕</button>
              </div>
            )}

            {/* --- V9.0 SIDEBAR: 4 MODULES --- */}
            <aside className="v25-sidebar">
              <div className="mobile-hud-header">
                <h3>戰術分析儀表板 (HUD)</h3>
                <button className="hud-close-btn" onClick={() => setShowMobileHud(false)}>收起 ×</button>
              </div>

              <div className="hud-card controls-segment mobile-only">
                <span className="hud-label">房間管理指令</span>
                <div className="v9-sidebar-controls">
                  {isConductor && (
                    <button className="btn-liquid-glass lg-pink" style={{ width: '100%', marginBottom: '10px' }} onClick={handleSpreadLoveClick}>
                      <span className="icon">💖</span> 把愛傳下去
                    </button>
                  )}
                  <button className="btn-liquid-glass lg-blue" style={{ width: '100%', marginBottom: '10px' }} onClick={() => setShowVoiceSettings(true)}>
                    <span className="icon">⚙️</span> 語音設定
                  </button>
                  <button className="btn-liquid-glass lg-cyan" style={{ width: '100%', marginBottom: '10px' }} onClick={() => {
                    const shareUrl = `${window.location.origin}${window.location.pathname}#${currentRoomId}`;
                    navigator.clipboard.writeText(shareUrl);
                    alert('房號連結已複製 (含自動夾帶房號)！');
                  }}>
                    分享房間連結
                  </button>
                  <button className="btn-liquid-glass lg-amber" style={{ width: '100%', marginBottom: '10px' }} onClick={toggleWildBossExplore}>
                    <span className="icon">🍖</span> {currentRoom.wildBossExplore?.[userName] ? '回到房內打王' : '餓了去打野'}
                  </button>
                  <button className="btn-liquid-glass lg-red" style={{ width: '100%' }} onClick={() => setShowLeaveModal(true)}>
                    下車離開 (返回大廳)
                  </button>
                </div>
              </div>

              {/* Box 1: Identity */}
              <div className="hud-card active-segment">
                <span className="hud-label">您的身分 :</span>
                <div className="v7-identity">
                  <span className="v9-role-badge">{isConductor ? '幸運車長' : '車內成員'}</span>
                  <span className="v7-name">{userName}</span>
                </div>
              </div>

              {/* Box 2: Members */}
              {/* Box 2: Members (無上限 & 固定大小 4 人分頁) */}
              {(() => {
                const rawMembers = Object.entries(currentRoom.members || {});
                // 智慧排序：車長置頂、自己第二、在線優先、離線在後
                const sortedMembers = [...rawMembers].sort(([nameA, dataA], [nameB, dataB]) => {
                  if (nameA === currentRoom.conductor) return -1;
                  if (nameB === currentRoom.conductor) return 1;
                  if (nameA === userName) return -1;
                  if (nameB === userName) return 1;
                  const onlineA = typeof dataA === 'object' && dataA.isOnline ? 1 : 0;
                  const onlineB = typeof dataB === 'object' && dataB.isOnline ? 1 : 0;
                  return onlineB - onlineA;
                });

                const totalMemberPages = Math.max(1, Math.ceil(sortedMembers.length / 4));
                const safeMemberPage = Math.min(Math.max(1, memberPage), totalMemberPages);
                const paginatedMembers = sortedMembers.slice((safeMemberPage - 1) * 4, safeMemberPage * 4);

                return (
                  <div className="hud-card v9-members-card">
                    <div className="v9-members-header">
                      <span className="hud-label">車內成員 ({sortedMembers.length} 人)</span>
                      {totalMemberPages > 1 && (
                        <div className="v9-members-pagination">
                          <button
                            type="button"
                            className="member-page-btn"
                            disabled={safeMemberPage <= 1}
                            onClick={() => setMemberPage(p => Math.max(1, p - 1))}
                            title="上一頁"
                          >
                            ◀
                          </button>
                          <span className="member-page-indicator">{safeMemberPage} / {totalMemberPages}</span>
                          <button
                            type="button"
                            className="member-page-btn"
                            disabled={safeMemberPage >= totalMemberPages}
                            onClick={() => setMemberPage(p => Math.min(totalMemberPages, p + 1))}
                            title="下一頁"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="v9-members-list fixed-size-list">
                      {paginatedMembers.map(([mName, mData]) => (
                        <div key={mName} className={`v9-member-item ${mName === userName ? 'is-me' : ''}`}>
                          <div className="v9-member-avatar-box">
                            {renderAvatar(typeof mData === 'object' ? mData.photoURL : '🐶', "v9-mini-avatar")}
                            <span className={`status-dot-v9 ${typeof mData === 'object' && mData.isOnline ? 'online' : 'offline'}`}></span>
                          </div>
                          <div className="member-names-stack">
                            <span className="member-name">{mName}</span>
                            {(() => {
                              const rank = getRankInfo(typeof mData === 'object' ? mData.totalKills : 0);
                              return (
                                <span className="member-rank-mini" style={{ color: rank.color }}>
                                  {rank.badge} {rank.fullTitle}
                                </span>
                              );
                            })()}
                          </div>
                          {mName === currentRoom.conductor ? (
                            <span className="v9-conductor-badge">👑 車長</span>
                          ) : (
                            isConductor && (
                              <div className="v9-member-ctx-actions">
                                <button className="btn-liquid-glass btn-lg-micro lg-amber" onClick={() => transferConductor(mName)} title="移交車長">👑</button>
                                <button className="btn-liquid-glass btn-lg-micro lg-red" onClick={() => removeMember(mName)} title="請下車">❌</button>
                              </div>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Box 3: Boss Information */}
              <div className="hud-card">
                <span className="hud-label">BOSS 資訊</span>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.8', color: '#ccc' }}>
                  <div>{currentBoss.name}</div>
                  <div>重生時間: {currentBoss.timeText || `${currentBoss.time} 分鐘`}</div>
                  <div>地區: {currentBoss.area || '維多利亞島'}</div>
                </div>
              </div>

              {/* Box 3.5: 殭屍菇菇專屬 戰利品分紅模組 (極簡版) */}
              {currentRoom.bossId === 'zombie_mushroom' && (() => {
                const lootData = currentRoom.lootSplit || {};
                const lootItems = lootData.items || {};
                const activeMembersCount = Object.keys(currentRoom.members || {}).length || 1;
                const currentSplitCount = typeof lootData.splitCount === 'number' ? lootData.splitCount : Math.max(activeMembersCount, 1);
                const itemsList = Object.values(lootItems).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                const totalAmount = itemsList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                const feeAmount = totalAmount * 0.05;
                const netAmount = totalAmount * 0.95;
                const perPerson = currentSplitCount > 0 ? (netAmount / currentSplitCount) : 0;
                const formattedTotal = Number.isInteger(totalAmount) ? totalAmount : Number(totalAmount.toFixed(2));
                const formattedFee = Number.isInteger(feeAmount) ? feeAmount : Number(feeAmount.toFixed(2));
                const formattedNet = Number.isInteger(netAmount) ? netAmount : Number(netAmount.toFixed(2));
                const formattedPerPerson = Number.isInteger(perPerson) ? perPerson : perPerson.toFixed(1);

                const handleAddLoot = (e) => {
                  e?.preventDefault();
                  const finalName = lootPreset === '__CUSTOM__' ? lootCustomName.trim() : lootPreset;
                  if (!finalName) {
                    alert('請由下拉選單選取戰利品或輸入自訂名稱！');
                    return;
                  }
                  const lootId = `loot_${Date.now()}`;
                  update(ref(db, `rooms/${currentRoomId}/lootSplit/items/${lootId}`), {
                    id: lootId,
                    name: finalName,
                    amount: 0,
                    creator: userName,
                    createdAt: Date.now()
                  });
                  setLootPreset('');
                  setLootCustomName('');
                };

                const handleUpdateLootAmount = (lootId, valStr) => {
                  const num = parseFloat(valStr);
                  const validAmount = isNaN(num) || num < 0 ? 0 : num;
                  update(ref(db, `rooms/${currentRoomId}/lootSplit/items/${lootId}`), {
                    amount: validAmount
                  });
                };

                const handleDeleteLoot = (lootId) => {
                  if (window.confirm('確定要刪除此筆戰利品紀錄嗎？')) {
                    remove(ref(db, `rooms/${currentRoomId}/lootSplit/items/${lootId}`));
                  }
                };

                const handleUpdateSplitCount = (delta) => {
                  const nextCount = Math.max(1, currentSplitCount + delta);
                  update(ref(db, `rooms/${currentRoomId}/lootSplit`), {
                    splitCount: nextCount
                  });
                };

                const handleClearLoot = () => {
                  if (window.confirm('確定要清空本場所有戰利品紀錄嗎？')) {
                    remove(ref(db, `rooms/${currentRoomId}/lootSplit/items`));
                  }
                };

                return (
                  <div className="hud-card loot-split-card">
                    <div className="loot-card-header">
                      <span className="hud-label">🎁 本場戰利品分紅</span>
                      {itemsList.length > 0 && (
                        <button type="button" className="loot-clear-btn" onClick={handleClearLoot} title="清空本場戰利品">清空</button>
                      )}
                    </div>

                    {/* 輸入表單 (免先填金額，直接點擊記錄) */}
                    <form className="loot-input-form" onSubmit={handleAddLoot}>
                      <div className="loot-add-row">
                        <div className="loot-select-wrap">
                          <select 
                            className="loot-select" 
                            value={lootPreset} 
                            onChange={(e) => setLootPreset(e.target.value)}
                          >
                            <option value="">-- 請選擇掉落物 --</option>
                            {ZOMBIE_MUSHROOM_LOOT_PRESETS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                            <option value="__CUSTOM__">✏️ 自訂其他物品...</option>
                          </select>
                        </div>
                        <button type="submit" className="btn-liquid-glass btn-lg-micro lg-amber loot-add-btn">
                          ＋ 記錄
                        </button>
                      </div>

                      {lootPreset === '__CUSTOM__' && (
                        <input
                          type="text"
                          className="loot-custom-input"
                          placeholder="輸入自訂物品名稱..."
                          value={lootCustomName}
                          onChange={(e) => setLootCustomName(e.target.value)}
                          maxLength={30}
                        />
                      )}
                    </form>

                    {/* 掉落物清單 (每筆物品後方可直接填入/修改成交金額，即時帶入公式) */}
                    <div className="loot-items-list">
                      {itemsList.length === 0 ? (
                        <div className="loot-empty-hint">尚無掉落物，打到上方隨手選了直接「＋ 記錄」</div>
                      ) : (
                        itemsList.map(item => (
                          <div key={item.id} className="loot-item-row">
                            <span className="loot-item-bullet">•</span>
                            <span className="loot-item-name" title={item.name}>{item.name}</span>
                            <div className="loot-item-amt-box">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="loot-item-amt-input"
                                placeholder="成交金額"
                                defaultValue={item.amount > 0 ? item.amount : ''}
                                key={`${item.id}_${item.amount}`}
                                onBlur={(e) => handleUpdateLootAmount(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.target.blur();
                                  }
                                }}
                              />
                              <span className="loot-item-unit">萬</span>
                            </div>
                            <button 
                              type="button" 
                              className="loot-item-del" 
                              onClick={() => handleDeleteLoot(item.id)}
                              title="刪除"
                            >✕</button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 結算統計區 */}
                    <div className="loot-split-summary">
                      <div className="loot-sum-row">
                        <span className="loot-sum-label">💰 總成交金額</span>
                        <span className="loot-sum-val">{formattedTotal} 萬</span>
                      </div>

                      <div className="loot-sum-row loot-fee-row">
                        <span className="loot-sum-label">🏷️ 販售手續費 (5%)</span>
                        <span className="loot-fee-val">- {formattedFee} 萬</span>
                      </div>

                      <div className="loot-sum-row loot-net-row">
                        <span className="loot-sum-label">💵 扣稅淨收益 (95%)</span>
                        <span className="loot-net-val">{formattedNet} 萬</span>
                      </div>

                      <div className="loot-sum-row">
                        <span className="loot-sum-label">👥 分紅人數</span>
                        <div className="loot-people-stepper">
                          <button type="button" className="stepper-btn" onClick={() => handleUpdateSplitCount(-1)}>-</button>
                          <span className="stepper-num">{currentSplitCount} 人</span>
                          <button type="button" className="stepper-btn" onClick={() => handleUpdateSplitCount(1)}>+</button>
                        </div>
                      </div>

                      {/* 計算公式卡片 */}
                      <div className="loot-formula-box">
                        <div className="formula-title">📐 計算公式 (扣除 5% 手續費)</div>
                        <div className="formula-content">
                          ({formattedTotal}萬 × 95%) ÷ {currentSplitCount}人 = <b>{formattedPerPerson}</b> 萬
                        </div>
                      </div>

                      <div className="loot-result-divider" />

                      <div className="loot-final-payout">
                        <div className="payout-label-col">
                          <span className="payout-label">👑 每人實拿</span>
                          <span className="payout-sub-hint">(已扣除 5% 交易手續費)</span>
                        </div>
                        <span className="payout-amount">{formattedPerPerson} <small>萬</small></span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Box 4: Kill Report (Deep Analysis) */}
              <div className="hud-card">
                <span className="hud-label">📊 擊殺報告 (TODAY)</span>

                <div className="stats-section-v9">
                  <span className="stats-sub-label">房內總累計 (OVERALL)</span>
                  <div className="stats-row">房號 / BOSS: <span style={{ fontSize: '0.75rem' }}>{currentRoomId} - {currentBoss.name}</span></div>
                  <div className="stats-row">總擊殺次數: <b>{currentRoom.totalKills || 0} 次</b></div>
                  <div className="stats-row">總共航程: <span>{formatTime(now - currentRoom.createdAt)}</span></div>
                </div>

                <div className="stats-section-v9">
                  <span className="stats-sub-label">您的隨車里程 (YOUR SESSION)</span>
                  <div className="stats-grid-v9">
                    <div className="stat-box-v9"><b>{formatTime(now - (sessionStartTime || now))}</b><span>已隨車</span></div>
                    <div className="stat-box-v9"><b>{Math.max(sessionKills, (currentRoom.totalKills || 0) - (currentRoom.members?.[userName]?.startKills || 0))} 次</b><span>共獲取</span></div>
                    <div className="stat-box-v9"><b>{efficiency}</b><span>時點效率</span></div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button className="btn-liquid-glass lg-amber" style={{ width: '100%' }} onClick={exportReport}>🖼️ 匯出擊殺戰報 (PNG)</button>
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
                    {isConductor && isEditingPassword ? (
                      <div className="v9-pwd-edit-box">
                        <input
                          type="text"
                          className="v9-pwd-input-field"
                          value={newPasswordInput}
                          placeholder="新密碼"
                          onChange={e => setNewPasswordInput(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && updateRoomPassword()}
                          autoFocus
                        />
                        <button className="btn-liquid-glass btn-lg-micro lg-blue" onClick={updateRoomPassword}>儲存</button>
                        <button className="btn-liquid-glass btn-lg-micro lg-red" style={{ marginLeft: '5px' }} onClick={() => setIsEditingPassword(false)}>取消</button>
                      </div>
                    ) : (
                      <>
                        <div className="v9-pwd-box">
                          {currentRoom.password}
                        </div>
                        {isConductor && (
                          <button
                            className="btn-liquid-glass btn-lg-micro lg-blue"
                            style={{ padding: '4px 8px', minWidth: 'unset' }}
                            title="修改密碼"
                            onClick={() => {
                              setNewPasswordInput(currentRoom.password || '');
                              setIsEditingPassword(true);
                            }}
                          >
                            ✏️
                          </button>
                        )}
                        <button className="btn-liquid-glass btn-lg-micro lg-cyan" style={{ padding: '4px 12px', minWidth: 'unset', marginLeft: '5px' }} onClick={() => {
                          navigator.clipboard.writeText(currentRoom.password || '');
                          alert('密碼已複製！');
                        }}>複製</button>
                      </>
                    )}
                  </div>
                </div>

                <div className="v9-control-group desktop-only">
                  {isConductor && (
                    <button className="btn-liquid-glass lg-pink" onClick={handleSpreadLoveClick}>
                      <span className="icon">💖</span> 把愛傳下去
                    </button>
                  )}
                  <button className="btn-liquid-glass lg-blue" onClick={() => setShowVoiceSettings(true)}>
                    <span className="icon">⚙️</span> 語音設定
                  </button>
                  <button className="btn-liquid-glass lg-cyan" onClick={() => {
                    const shareUrl = `${window.location.origin}${window.location.pathname}#${currentRoomId}`;
                    navigator.clipboard.writeText(shareUrl);
                    alert('房號連結已複製 (含自動夾帶房號)！');
                  }}>
                    分享房間連結
                  </button>
                  <button className="btn-liquid-glass lg-amber" onClick={toggleWildBossExplore}>
                    <span className="icon">🍖</span> {currentRoom.wildBossExplore?.[userName] ? '回到房內打王' : '餓了去打野'}
                  </button>
                  <button className="btn-liquid-glass lg-red" onClick={() => setShowLeaveModal(true)}>
                    下車離開 (返回大廳)
                  </button>
                </div>

                <div className="v9-control-group mobile-only">
                  <button className={`btn-v16-hud-toggle ${showMobileHud ? 'active' : ''}`} onClick={() => setShowMobileHud(!showMobileHud)}>
                    {showMobileHud ? '📊 關閉數據面板' : '📊 戰略數據面板'}
                  </button>
                </div>
              </header>

              <div className="main-glass-panel" id="tactical-report-panel">
                {/* --- Report Header (Rendered for PNG Capture only) --- */}
                <div className="png-report-header">
                  <div className="report-header-top">
                    <div className="report-title">
                      <div className="report-brand">PIKAPI 戰術情報網</div>
                      <div className="report-sub">最終行動結算戰報</div>
                    </div>
                    <div className="report-stamp">【 絕密檔案 】</div>
                  </div>

                  <div className="report-meta-grid">
                    <div className="meta-item">
                      <span className="meta-label">戰區房號</span>
                      <span className="meta-value gold-txt">{currentRoomId}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">前線車長</span>
                      <span className="meta-value user-txt">{currentRoom.conductor || '無'}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">作戰目標</span>
                      <span className="meta-value boss-txt">{currentBoss.name}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">報告生成時間</span>
                      <span className="meta-value time-txt">{new Date().toLocaleString('zh-TW', { hour12: false })}</span>
                    </div>
                  </div>

                  <div className="report-stats">
                    <div className="r-stat">
                      <label>最終擊殺總數</label>
                      <span>{currentRoom.totalKills || 0}</span>
                    </div>
                    <div className="r-stat">
                      <label>總計執勤時長</label>
                      <span>{formatTime(now - currentRoom.createdAt)}</span>
                    </div>
                    <div className="r-stat">
                      <label>全車擊殺效率</label>
                      <span>
                        {((currentRoom.totalKills || 0) / Math.max(0.01, (now - currentRoom.createdAt) / 3600000)).toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#888' }}>隻/時</span>
                      </span>
                    </div>
                  </div>

                  {/* V11.5: Personal Session Section */}
                  <div className="report-personal-session">
                    <div className="ps-title">YOUR SESSION (隨車里程)</div>
                    <div className="ps-grid">
                      <div className="ps-item">
                        <label>個人隨車時長</label>
                        <span>{formatTime(now - (sessionStartTime || now))}</span>
                      </div>
                      <div className="ps-item">
                        <label>參與擊殺次數</label>
                        <span>{Math.max(0, (currentRoom.totalKills || 0) - (currentRoom.members?.[userName]?.startKills || 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* --- Wild Boss Exploration Banner (v2.3) --- */}
                {currentRoom.wildBossExplore && Object.keys(currentRoom.wildBossExplore || {}).length > 0 && (
                  <div className="v9-wild-banner fade-in">
                    <span className="wild-icon">🍖</span>
                    <span className="wild-text">
                      <b>戰術通報 :</b> {Object.keys(currentRoom.wildBossExplore).join(', ')} 正在各頻道打野中...
                    </span>
                  </div>
                )}

                {/* --- 頻道回報面板切換 (v2.5) --- */}
                {wildBossExplore ? (
                  <div className="kill-input-v25 explorer-mode-active">
                    <div className="explorer-header">
                      <span className="icon">🍗</span> 偵察回報模式
                    </div>
                    <input
                      type="text"
                      className="v25-input explorer-input"
                      placeholder="輸入發現王蹤的頻道 (例: 12)"
                      value={exploreChannelInput}
                      onChange={e => setExploreChannelInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addExploreRecord()}
                      autoFocus
                    />
                    <button className="btn-liquid-glass lg-amber" style={{ width: '200px' }} onClick={addExploreRecord}>回報發現野王</button>
                  </div>
                ) : (
                  <div className="kill-input-v25">
                    <input
                      type="text"
                      className="v25-input"
                      placeholder="輸入頻道 (例: 5)"
                      value={inputChannel}
                      onChange={e => setInputChannel(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addRecord()}
                    />
                    <button className="btn-liquid-glass lg-green" style={{ width: '200px' }} onClick={() => addRecord()}>已擊殺開始計時</button>
                  </div>
                )}

                <div className="v25-table">
                  <div id="kill-report-card" className="v25-table-container">
                    <div className="v25-table-header">
                      <span className="v25-col-ch">頻道</span>
                      <span>野王名稱</span>
                      <span className="v25-col-center">倒數計時</span>
                      <span className="v25-col-center">目前狀態</span>
                      <span className="v25-col-right">頻道操作</span>
                    </div>

                    {Object.keys(records).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '80px', color: '#444', fontStyle: 'italic' }}>等待車員回報戰況...</div>
                    ) : (
                      Object.keys(records)
                        .sort((a, b) => {
                          const valA = (records[a] || {}).lastKill ?? 9999999999999;
                          const valB = (records[b] || {}).lastKill ?? 9999999999999;
                          // V16.8 置頂邏輯: 將 lastKill === 0 (偵察到的) 排在最前
                          if (valA === 0 && valB !== 0) return -1;
                          if (valA !== 0 && valB === 0) return 1;
                          return valA - valB;
                        })
                        .map(ch => {
                          const rec = records[ch] || {};
                          const isNewFound = rec.lastKill === 0;
                          const hasMaxTime = Boolean(currentBoss && currentBoss.maxTime);
                          const elapsedMin = isNewFound ? 99999 : (now - (rec.lastKill || 0)) / 60000;
                          const remainingMin = isNewFound ? 0 : (currentBoss ? currentBoss.time - elapsedMin : 0);
                          const remainingMax = isNewFound ? 0 : (hasMaxTime ? currentBoss.maxTime - elapsedMin : remainingMin);

                          // 狀態判定
                          const inWindow = hasMaxTime && !isNewFound && remainingMin <= 0 && remainingMax > 0;
                          const isReady = isNewFound || (hasMaxTime ? remainingMax <= 0 : remainingMin <= 0);
                          const occupant = rec.occupant || '';
                          const isConfirmed = rec.isConfirmed || false;

                          return (
                            <div key={ch} className={`v25-row ${isReady ? 'is-ready' : ''} ${inWindow ? 'is-in-window' : ''} ${isNewFound ? 'is-new-found' : ''}`}>
                              {/* 1. 頻道與佔位 */}
                              <div className="v4-ch-group-v9">
                                <span className="v5-ch-id">CH {ch.replace('CH', '').trim()}</span>
                                {occupant && (
                                  <div className="v9-occupant-tag" title={occupant}>
                                    {isConfirmed ? (
                                      <span key="confirmed" style={{ color: '#00ff00', fontWeight: 'bold' }}>🟢 確認有料</span>
                                    ) : (
                                      <span key="occupied">📍 {occupant}</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 2. 野王名稱 */}
                              <div className="v5-boss-name">{currentBoss.name}</div>

                              {/* 3. 倒數計時 */}
                              <div className="v5-timer-container v25-col-center">
                                <div key="timer-display" className={`v5-timer ${isReady ? 'ready' : ''} ${inWindow ? 'in-window' : ''} ${rec.isStolen ? 'is-stolen' : ''}`}>
                                  {isReady ? 'READY' : (inWindow ? `最遲 ${formatTime(remainingMax * 60000)}` : formatTime(remainingMin * 60000))}
                                </div>
                                {rec.isStolen && isReady && (
                                  <div key="stolen-warning" className="stolen-warning fade-in">⚠️ 該BOSS被偷過請提前蹭蹭</div>
                                )}
                                {inWindow && (
                                  <div className="window-sub-hint fade-in">🎲 隨時可能現身</div>
                                )}
                              </div>

                              {/* 4. 目前狀態 */}
                              <div className="v25-col-center">
                                <span key="status-badge" className={`v5-status-badge ${isReady ? (rec.isStolen ? 'v5-status-stolen' : 'v5-status-ready') : (inWindow ? 'v5-status-window' : 'v5-status-waiting')}`}>
                                  {isReady ? (rec.isStolen ? '🥷 蹭蹭中' : (hasMaxTime ? '✅ 必定重生' : '已重生')) : (inWindow ? '🎲 隨時出怪' : '重生中')}
                                </span>
                              </div>

                              {/* 6. 頻道操作 */}
                              <div className="v5-btn-set v25-col-right">
                                <button 
                                  className={`btn-liquid-glass btn-lg-micro ${occupant ? (occupant === userName ? (isConfirmed ? 'lg-green' : 'lg-fuchsia') : 'lg-locked-grey') : 'lg-purple'}`} 
                                  onClick={() => handleStationed(ch)}
                                  style={{ 
                                    opacity: (occupant && occupant !== userName) ? 0.4 : 1,
                                    cursor: (occupant && occupant !== userName) ? 'not-allowed' : 'pointer'
                                  }}
                                  disabled={occupant && occupant !== userName}
                                >
                                  {occupant ? (occupant === userName ? '已確認' : '已被佔') : '已佔位'}
                                </button>
                                <button className="btn-liquid-glass btn-lg-micro lg-grey" onClick={() => handleStolen(ch)}>已被偷</button>
                                {!isReady && !inWindow ? (
                                  <button key="btn-respawn" className="btn-liquid-glass btn-lg-micro lg-amber" onClick={() => handleRespawned(ch)}>已重生</button>
                                ) : (
                                  <button key="btn-kill" className="btn-liquid-glass btn-lg-micro lg-pink" onClick={() => addRecord(ch)}>已擊殺</button>
                                )}
                                <button className="btn-liquid-glass btn-lg-micro lg-cyan" onClick={() => broadcastStatus(ch)}>🔊 廣播</button>
                                <button className="btn-liquid-glass btn-lg-micro lg-red" onClick={() => removeRecord(ch)}>刪除</button>
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
      console.error("[Render Error]", err);
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
        <div className="header-left">
          {currentUser && (
            <button className="mobile-nav-toggle" onClick={() => setShowMobileNav(!showMobileNav)}>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          )}
          <div className="header-logo" onClick={() => (currentUser ? setView('hub') : setView('landing'))}>
            <span>PiKaPi</span> <span className="boss-highlight">PORTAL</span>
          </div>
        </div>

        {!currentUser ? (
          <div className="header-actions">
            <button className="login-btn-small" onClick={handleLogin}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: '18px', marginRight: '8px', verticalAlign: 'middle' }} />
              <span>Google 登入</span>
            </button>
          </div>
        ) : (
          <>
            <div className="desktop-nav header-actions">
              <button
                className={`hub-nav-btn ${view === 'hub' ? 'active' : ''}`}
                onClick={() => setView('hub')}
                style={{
                  background: view === 'hub' ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: view === 'hub' ? '#00e5ff' : '#cbd5e0',
                  border: view === 'hub' ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                🏠 服務總部
              </button>
              <button
                className={`boss-nav-btn ${view === 'lobby' || view === 'room' ? 'active' : ''}`}
                onClick={() => setView('lobby')}
                style={{
                  background: (view === 'lobby' || view === 'room') ? 'rgba(255, 65, 108, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: (view === 'lobby' || view === 'room') ? '#ff5252' : '#cbd5e0',
                  border: (view === 'lobby' || view === 'room') ? '1px solid rgba(255, 65, 108, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                👑 打王趣
              </button>
              <button
                className={`exp-nav-btn ${view === 'exp-helper' ? 'active' : ''}`}
                onClick={() => setView('exp-helper')}
                style={{
                  background: view === 'exp-helper' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: view === 'exp-helper' ? '#ffd700' : '#cbd5e0',
                  border: view === 'exp-helper' ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ⚡ 經驗小助手
              </button>
              <button
                className={`leaderboard-hall-btn ${view === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setView('leaderboard')}
              >
                🏆 榮譽榜
              </button>
              <button
                className={`medal-hall-btn ${view === 'medals' ? 'active' : ''}`}
                onClick={() => setView('medals')}
              >
                🎖️ 勳章
              </button>
              {isAdmin && (
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

            {/* Mobile Nav Drawer */}
            <div className={`mobile-nav-drawer ${showMobileNav ? 'open' : ''}`}>
              <div className="nav-drawer-header">
                <div className="nav-user-info">
                  <div className="nav-avatar">
                    {renderAvatar(currentUser.photoURL, "nav-avatar-img")}
                  </div>
                  <div className="nav-user-details">
                    <span className="nav-user-name">{userName}</span>
                    <span className="nav-user-email">{currentUser.email}</span>
                  </div>
                </div>
                <button className="nav-close-btn" onClick={() => setShowMobileNav(false)}>×</button>
              </div>

              <div className="nav-drawer-links">
                <button className={`nav-link ${view === 'hub' ? 'active' : ''}`} onClick={() => { setView('hub'); setShowMobileNav(false); }}>
                  🏠 服務總部 (Hub)
                </button>
                <button className={`nav-link ${view === 'lobby' ? 'active' : ''}`} onClick={() => { setView('lobby'); setShowMobileNav(false); }}>
                  👑 打王趣 (Boss Tracker)
                </button>
                <button className={`nav-link ${view === 'exp-helper' ? 'active' : ''}`} onClick={() => { setView('exp-helper'); setShowMobileNav(false); }}>
                  ⚡ 經驗小助手 (EXP Helper)
                </button>
                <button className={`nav-link ${view === 'profile' ? 'active' : ''}`} onClick={() => { setView('profile'); setShowMobileNav(false); }}>
                  👤 個人檔案
                </button>
                <button className={`nav-link ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => { setView('leaderboard'); setShowMobileNav(false); }}>
                  🏆 榮譽排行榜
                </button>
                <button className={`nav-link ${view === 'medals' ? 'active' : ''}`} onClick={() => { setView('medals'); setShowMobileNav(false); }}>
                  🎖️ 勳章成就館
                </button>
                {isAdmin && (
                  <button className={`nav-link admin ${view === 'admin' ? 'active' : ''}`} onClick={() => { setView('admin'); setShowMobileNav(false); }}>
                    🛡️ 指揮部管理員
                  </button>
                )}
                <div className="nav-divider"></div>
                <button className="nav-link logout" onClick={() => { handleLogout(); setShowMobileNav(false); }}>
                  🚪 安全登出
                </button>
              </div>
            </div>
            {showMobileNav && <div className="nav-overlay" onClick={() => setShowMobileNav(false)}></div>}

            {/* Mobile-only avatar shortcut in header */}
            <div className="mobile-user-shortcut" onClick={() => setView('profile')}>
              {renderAvatar(currentUser.photoURL, "header-avatar-img-mobile")}
            </div>
          </>
        )}
      </header>
      <main className="main-content-area">{renderContent()}</main>
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

      {showLoveModal && (
        <div className="modal-overlay">
          <div className="v30-hud-console love-console" onClick={e => e.stopPropagation()}>
            {/* Header Area */}
            <div className="v30-console-header">
              <div className="v30-title-group">
                <span className="v30-accent-bar pink"></span>
                <div className="v30-title-text">
                  <h2 className="text-pink">把愛傳下去</h2>
                  <p>CROSS-ROOM TACTICAL TRANSFER // 跨房轉移系統</p>
                </div>
              </div>
              <div className="v30-header-actions">
                <button className="v30-refresh-btn" onClick={fetchRoomSummaries} title="重新獲取實時大廳資訊">🔄</button>
                <button className="v30-close-btn" onClick={() => setShowLoveModal(false)}>×</button>
              </div>
            </div>

            <div className="v30-console-body">
              {loveStep === 1 && (
                <div className="love-step-content">
                  <p className="v30-section-label">SELECT TARGET SECTOR // 選擇接收的大愛房號</p>
                  <div className="love-room-list v9-scrollbar">
                    {Object.values(roomSummaries || {})
                      .filter(r => r.bossId === currentRoom.bossId && r.id !== currentRoomId)
                      .map(r => (
                        <div
                          key={r.id}
                          className={`love-room-item v30-card ${selectedTargetRoomId === r.id ? 'active' : ''}`}
                          onClick={() => setSelectedTargetRoomId(r.id)}
                        >
                          <div className="r-id-row">
                            <div className="r-id">房號: <span className="text-pink">{r.id}</span></div>
                            <div className="r-conductor">房主: {r.conductor}</div>
                          </div>
                          <div className="r-members-list">
                            <div className="m-label">當前成員 ({Object.keys(r.members || {}).length} 人):</div>
                            <div className="m-names">
                              {(r.memberNames || []).join(', ') || '載入中...'}
                            </div>
                          </div>
                        </div>
                      ))}
                    {Object.values(roomSummaries || {}).filter(r => r.bossId === currentRoom.bossId && r.id !== currentRoomId).length === 0 && (
                      <div className="v30-empty-status">
                        <div className="icon">📡</div>
                        <p>OUT OF RANGE // 目前沒有在線的相同 BOSS 房</p>
                      </div>
                    )}
                  </div>
                  <div className="v30-footer-btns">
                    <button
                      className={`v30-btn-primary pink ${(!selectedTargetRoomId) ? 'disabled' : ''}`}
                      disabled={!selectedTargetRoomId}
                      onClick={() => setLoveStep(2)}
                    >
                      把愛給它
                    </button>
                    <button className="v30-btn-secondary" onClick={() => setShowLoveModal(false)}>取消傳送</button>
                  </div>
                </div>
              )}

              {loveStep === 2 && (
                <div className="love-step-content">
                  <p className="v30-section-label">TRANSFER SCOPE // 傳送詳情設定</p>
                  <div className="v30-options-grid">
                    <div className={`v30-opt-card ${loveTransferMode === 'all' ? 'active' : ''}`} onClick={() => setLoveTransferMode('all')}>
                      <div className="opt-header">
                        <span className="opt-title">全部頻道紀錄</span>
                        <span className="opt-tag">MAX LOAD</span>
                      </div>
                      <p>整顆心都給你 [ALL]</p>
                    </div>
                    <div className={`v30-opt-card ${loveTransferMode === 'odd' ? 'active' : ''}`} onClick={() => setLoveTransferMode('odd')}>
                      <div className="opt-header">
                        <span className="opt-title">僅奇數頻道</span>
                        <span className="opt-tag">FILTER</span>
                      </div>
                      <p>好奇友 [1, 3, 5...]</p>
                    </div>
                    <div className={`v30-opt-card ${loveTransferMode === 'even' ? 'active' : ''}`} onClick={() => setLoveTransferMode('even')}>
                      <div className="opt-header">
                        <span className="opt-title">僅偶數頻道</span>
                        <span className="opt-tag">FILTER</span>
                      </div>
                      <p>偶素誰 [2, 4, 6...]</p>
                    </div>
                  </div>

                  <div className="v30-footer-btns">
                    <button
                      className="v30-btn-primary pink"
                      onClick={() => setLoveStep(2.5)}
                    >
                      大愛預覽
                    </button>
                    <button className="v30-btn-secondary" onClick={() => setLoveStep(1)}>回上一步</button>
                  </div>
                </div>
              )}

              {loveStep === 2.5 && (
                <div className="love-step-content">
                  <p className="v30-section-label">CONFIRM CHANNELS // 待傳送清單預覽</p>
                  <div className="love-channel-preview v9-scrollbar">
                    {(() => {
                      const records = currentRoom.records || {};
                      const previewList = Object.entries(records).filter(([ch]) => {
                        if (loveTransferMode === 'all') return true;
                        const num = parseInt(ch.replace(/[^0-9]/g, ''));
                        if (loveTransferMode === 'odd') return num % 2 !== 0;
                        if (loveTransferMode === 'even') return num % 2 === 0;
                        return false;
                      });

                      if (previewList.length === 0) return <div className="no-p-msg">無符合選取條件的頻道資料</div>;

                      return previewList.map(([ch, data]) => {
                        const hasMaxTime = Boolean(currentBoss && currentBoss.maxTime);
                        const elapsedMin = (now - data.lastKill) / 60000;
                        const remainingMin = currentBoss.time - elapsedMin;
                        const remainingMax = hasMaxTime ? currentBoss.maxTime - elapsedMin : remainingMin;
                        const inWindow = hasMaxTime && remainingMin <= 0 && remainingMax > 0;
                        const isReady = hasMaxTime ? remainingMax <= 0 : remainingMin <= 0;

                        let statusText = `⏳ ${formatTime(remainingMin * 60000)}`;
                        if (isReady) statusText = '✅ 已登場';
                        else if (inWindow) statusText = `🎲 隨時出 (最遲 ${formatTime(remainingMax * 60000)})`;

                        return (
                          <div key={ch} className="p-ch-item">
                            <span className="p-ch-id">{ch}</span>
                            <span className="p-ch-status">{statusText}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="v30-footer-btns">
                    <button
                      className="v30-btn-primary pink"
                      onClick={() => {
                        const records = currentRoom.records || {};
                        const count = Object.entries(records).filter(([ch]) => {
                          if (loveTransferMode === 'all') return true;
                          const num = parseInt(ch.replace(/[^0-9]/g, ''));
                          if (loveTransferMode === 'odd') return num % 2 !== 0;
                          if (loveTransferMode === 'even') return num % 2 === 0;
                          return false;
                        }).length;

                        if (count === 0) return alert("無資料可發送，請重新選擇。");

                        if (loveTransferMode === 'all') setLoveStep(3);
                        else sendLoveRequest();
                      }}
                    >
                      發送訊號
                    </button>
                    <button className="v30-btn-secondary" onClick={() => setLoveStep(2)}>回上一步</button>
                  </div>
                </div>
              )}

              {loveStep === 3 && (
                <div className="love-step-content warning">
                  <div className="v30-warn-panel">
                    <h3>⚠️ 終結警告 ⚠️</h3>
                    <p>若「全部頻道」成功轉移後，本戰區將自動銷毀。</p>
                    <p>所有成員將自動跳轉回大廳休息。</p>
                  </div>
                  <div className="v30-footer-btns stacked">
                    <button className="v30-btn-danger" onClick={sendLoveRequest}>沒問題，我願意</button>
                    <button className="v30-btn-secondary" onClick={() => setLoveStep(2)}>再考慮一下</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 把愛傳下去 - 接收方通知 (v13.0) */}
      {incomingLoveRequest && (
        <div className="modal-overlay">
          <div className="v30-hud-console incoming-love" onClick={e => e.stopPropagation()}>
            <div className="v30-love-header pulse">
              <div className="heart-icon">💖</div>
              <h2>收到一份戰區大愛！</h2>
            </div>

            <div className="v30-console-body centered">
              <p className="v30-from-info">來自房主 <span className="text-pink">{incomingLoveRequest.fromConductor}</span> 的愛心連結</p>

              <div className="v30-preview-panel">
                <div className="prev-row">
                  <span className="l">傳送模式 // MODE</span>
                  <span className="v text-pink">{incomingLoveRequest.mode === 'all' ? '全部頻道紀錄' : incomingLoveRequest.mode === 'odd' ? '僅奇數頻道' : '僅偶數頻道'}</span>
                </div>
                <div className="prev-row">
                  <span className="l">頻道負載 // LOAD</span>
                  <span className="v">{Object.keys(incomingLoveRequest.channels || {}).length} 個頻道</span>
                </div>
              </div>

              <div className="v30-footer-btns">
                <button className="v30-btn-primary pink-pulse" onClick={acceptLoveRequest}>接受愛愛❤️</button>
                <button className="v30-btn-danger" onClick={refuseLoveRequest}>狠狠拒絕💔</button>
              </div>
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
                <div className="v30-control-section full-width">
                  <div className="v30-section-label">
                    <span className="dot volume"></span> 音量大小 (VOLUME: {Math.round(voiceSettings.volume * 100)}%)
                    <label className="v30-mute-shortcut">
                      <input
                        type="checkbox"
                        checked={voiceSettings.isMuted}
                        onChange={e => setVoiceSettings(prev => ({ ...prev, isMuted: e.target.checked }))}
                      />
                      <span className="mute-text">{voiceSettings.isMuted ? '🔇 已靜音' : '🔊 播放中'}</span>
                    </label>
                  </div>
                  <div className="v30-range-wrapper volume-track">
                    <input
                      type="range" min="0" max="1" step="0.05"
                      className="v30-range-input"
                      value={voiceSettings.isMuted ? 0 : voiceSettings.volume}
                      disabled={voiceSettings.isMuted}
                      onChange={e => setVoiceSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                    />
                    <div className="v30-range-track-bg"></div>
                    <div className="v30-volume-visual-bars">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className={`bar ${voiceSettings.volume > (i / 10) && !voiceSettings.isMuted ? 'active' : ''}`}></div>
                      ))}
                    </div>
                  </div>
                </div>

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
                  <div className={`v30-sync-light ${voiceSettings.isMuted ? 'muted' : 'online'}`}></div>
                  <span>系統狀態: {voiceSettings.isMuted ? '靜音中 (MUTED)' : '待命 (READY)'}</span>
                </div>
                <div className="v30-action-group">
                  <button
                    className="v30-btn-test"
                    onClick={handleTestVoice}
                    disabled={voiceSettings.isMuted}
                  >
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
