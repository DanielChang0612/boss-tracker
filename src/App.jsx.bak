import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth, googleProvider } from './firebase';
import { ref, onValue, set, update, remove, onDisconnect, get, off } from 'firebase/database';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import html2canvas from 'html2canvas';
import './membership.css';

// 6 個萌系動物預設選項 (v4.8)
const DEFAULT_ANIMALS = ['🐶', '🐱', '🦊', '🐼', '🐨', '🐯'];

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
const ADMIN_UID = 'Ib9T643jMNcTNjIAd3aHMuNPTBj2'; // 管理員專屬完整的 UID

// 稱號與等級定義
const getRankInfo = (kills = 0, hours = 0) => {
  if (kills >= 500) return { title: "🍁 楓之谷守護神", color: "#ff4081", badge: "🎖️" };
  if (kills >= 200) return { title: "⚔️ 野王收割者", color: "#d4af37", badge: "⚔️" };
  if (kills >= 100) return { title: "🛡️ 高級近衛兵", color: "#00e676", badge: "🛡️" };
  if (kills >= 50) return { title: "🍗 專業打野人", color: "#2196f3", badge: "🍖" };
  if (kills >= 10) return { title: "🐣 打王見習生", color: "#bbb", badge: "🐣" };
  return { title: "🌱 冒險新兵", color: "#888", badge: "🌱" };
};

function App() {
  const [rooms, setRooms] = useState({});
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

  // Admin 專屬狀態
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
  const avatarInputRef = useRef(null); // 隱藏的上傳輸入框

  const userHasSeenSelfInRoom = useRef(false);

  const currentRoom = (currentRoomId && rooms && rooms[currentRoomId]) ? rooms[currentRoomId] : null;
  const currentBoss = (currentRoom && currentRoom.bossId && BOSSES[currentRoom.bossId])
    ? BOSSES[currentRoom.bossId]
    : BOSSES[selectedBossId] || Object.values(BOSSES)[0];

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

  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    return onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      setRooms(data || {});

      if (currentRoomId && view === 'room' && (!data || !data[currentRoomId])) {
        setView('lobby');
        setCurrentRoomId(null);
        window.history.pushState({}, '', window.location.pathname);
      }
    });
  }, [currentRoomId, view]);

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

  useEffect(() => {
    if (currentUser?.uid === ADMIN_UID) {
      const usersRef = ref(db, 'users');
      return onValue(usersRef, (snapshot) => {
        setAllUsers(snapshot.val() || {});
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true && currentRoomId && userName && view === 'room') {
        const memberRef = ref(db, `rooms/${currentRoomId}/members/${userName}`);
        update(memberRef, { 
          isOnline: true, 
          lastSeen: Date.now() 
        });
      }
    });
    return () => unsubscribe();
  }, [currentRoomId, userName, view]);

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
            photoURL: user.photoURL,
            totalKills: 0,
            totalHours: 0,
            status: user.uid === ADMIN_UID ? 'approved' : 'new', // 管理員自動核准，新戶為 new
            createdAt: Date.now()
          };
          update(userRef, userData);
        }
        
        setCurrentUser({ ...user, profile: userData });
        setUserName(userData.displayName);
        
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

  // 全域廣播監聽與語音報讀
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

        // 5秒後自動隱藏橫幅
        setTimeout(() => setGlobalBroadcast(null), 8000);
      }
    });
    return () => unsubscribe();
  }, []);

  // 檢查是否被踢出房間
  useEffect(() => {
    if (currentRoomId && rooms[currentRoomId] && userName) {
      const members = rooms[currentRoomId].members || {};
      if (!members[userName]) {
        // 您被踢出了
        setCurrentRoomId(null);
        setView('lobby');
        setSessionStartTime(null);
        alert("您已被管理員移出房間");
      }
    }
  }, [rooms, currentRoomId, userName]);

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

  // 更新個人頭像邏輯 (v4.8)
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) return alert("圖片太大囉 (限 500KB 以內)");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      updateProfileAvatar(base64);
    };
    reader.readAsDataURL(file);
  };

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
  useEffect(() => {
    if (!currentRoomId || !rooms[currentRoomId] || view !== 'room') return;
    const alert = rooms[currentRoomId].voiceAlert;
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
  }, [rooms, currentRoomId, view, voiceSettings, availableVoices]);

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
    if (!newRoomConductor.trim()) return alert("請輸入車長名稱");
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const newRoom = {
      id,
      bossId: selectedBossId,
      password: Math.random().toString(36).substr(2, 4),
      conductor: newRoomConductor.trim(),
      members: { [newRoomConductor.trim()]: { joinedAt: Date.now(), startKills: 0 } },
      records: {},
      totalKills: 0,
      createdAt: Date.now(),
      emptySince: null
    };
    set(ref(db, `rooms/${id}`), newRoom);
    setUserName(newRoomConductor.trim());
    setCurrentRoomId(id);
    setView('room');
    setSessionStartTime(Date.now()); // 開始計時
    setShowCreateModal(false);
    window.history.pushState({}, '', `#${id}`);
  };

  const joinRoom = () => {
    const room = rooms[currentRoomId];
    if (!room) return alert("房間已不存在");
    if (!joinNameInput.trim()) return alert("請輸入您的名稱");
    if (room.password !== passwordInput) return alert("密碼錯誤");

    update(ref(db, `rooms/${currentRoomId}/members`), {
      [joinNameInput.trim()]: { joinedAt: Date.now(), startKills: room.totalKills || 0 }
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
    remove(ref(db, `rooms/${currentRoomId}/members/${targetName}`));
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
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { stationed: userName });
  };

  const addRecord = (manualChKey) => {
    const chKey = manualChKey || `CH ${inputChannel.trim()}`;
    if (!manualChKey && !inputChannel.trim()) return;
    update(ref(db, `rooms/${currentRoomId}/records/${chKey}`), { 
      lastKill: Date.now(),
      reporter: userName,
      stationed: null
    });

    // 增加房間總擊殺
    update(ref(db, `rooms/${currentRoomId}`), { 
      totalKills: (currentRoom.totalKills || 0) + 1,
      wildBossExplore: null
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
      stationed: null
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
              </div>
              
              {/* --- 申請等待區 (v4.9) --- */}
              {adminUserSubTab === 'directory' && Object.values(allUsers).some(u => u.status === 'pending') && (
                <div className="admin-pending-section glass-panel">
                  <h3>🛡️ 申請等待區 (Pending Requests)</h3>
                  <div className="pending-list">
                    {Object.values(allUsers).filter(u => u.status === 'pending').map(pu => (
                      <div key={pu.uid} className="pending-card">
                        <div className="p-user-info">
                          <img src={pu.photoURL || 'https://via.placeholder.com/40'} alt="avatar" />
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
                            <img src={u.photoURL || 'https://via.placeholder.com/30'} alt="avatar" className="admin-mini-avatar" />
                            <span>{u.nickname || u.displayName}</span>
                          </td>
                          <td className="admin-uid code-font" style={{wordBreak: 'break-all', maxWidth: '200px', fontSize: '10px'}}>{u.uid}</td>
                          <td>
                            <span className={`status-dot ${u.isOnline ? 'online' : 'offline'}`}></span>
                            {u.isOnline ? '在線上' : '離線'}
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
            </div>
          )}
        </div>
      </div>
    );
  };

  const bossRooms = useMemo(() => {
    if (!rooms) return [];
    return Object.values(rooms).filter(r => r && r.bossId === selectedBossId);
  }, [rooms, selectedBossId]);

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
      if (view === 'profile') {
        const stats = currentUser.profile?.bossStats || {};
        const rank = getRankInfo(currentUser.profile?.totalKills, currentUser.profile?.totalHours);
        
        return (
          <div className="profile-page-container">
            <div className="profile-card glass-panel">
              <div className="profile-header">
                <div className="avatar-wrapper" onClick={() => avatarInputRef.current.click()}>
                  <img src={currentUser.photoURL || 'https://via.placeholder.com/150'} alt="Avatar" className="profile-avatar-large" />
                  <div className="rank-badge-overlay">{rank.badge}</div>
                  <div className="avatar-edit-overlay">更換</div>
                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    style={{display: 'none'}} 
                    accept="image/*" 
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="profile-info">
                  <p className="profile-rank" style={{ color: rank.color }}>{rank.title}</p>
                  <h2>{userName}</h2>
                  <p className="profile-uid" style={{fontSize: '10px', opacity: 0.5}}>{currentUser.uid}</p>
                  <div className="profile-edit-name">
                    <input type="text" defaultValue={userName} id="profileNameInput" placeholder="暱稱" />
                    <button onClick={() => updateProfileName(document.getElementById('profileNameInput').value)}>更新</button>
                    <button className="btn-secondary-glass" onClick={() => setShowAvatarModal(true)}>使用預設頭像</button>
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
              
              <button className="back-lobby-btn" onClick={backToLobby}>回大廳</button>
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
              <button className="create-btn" onClick={() => setShowCreateModal(true)}>創建打王房間</button>
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
                    <div className="col-timer">{Object.keys(room.members || {}).length}/4</div>
                    <div className="col-status">{formatTime(now - room.createdAt)}</div>
                    <div className="col-window">
                      {Object.keys(room.members || {}).length === 0 ? (
                        <span className="delete-countdown">無成員 (清理中: {formatTime(ROOM_AUTO_DELETE_MS - (now - room.emptySince))})</span>
                      ) : "熱烈打王中..."}
                    </div>
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
                  <input type="text" value={newRoomConductor} onChange={(e) => setNewRoomConductor(e.target.value)} placeholder="車長名稱" />
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
        const wildExplorers = Object.entries(currentRoom.wildBossExplore || {}).filter(([,v]) => v).map(([k]) => k);

        return (
          <div className={`room-container boss-theme-${currentRoom.bossId}`}>
            {/* 左側欄 */}
            <aside className="room-sidebar">
              <div className="my-identity">
                <label>您的身分：</label>
                <div className="identity-val">
                  <span className="badge-role">{isConductor ? '幸運車長' : '晏客成員'}</span>
                  <span className="badge-name">{userName}</span>
                </div>
              </div>

              <div className="member-list">
                <h3 style={{marginBottom:'12px', color:'var(--gold)', fontSize:'0.85rem'}}>車內成員 {members.length}/4</h3>
                {members.map(m => (
                  <div key={m} className="member-item">
                    <div className="member-info">
                      <span>🚗</span>
                      <span>{m}</span>
                      {m === currentRoom.conductor && <span className="badge-role" style={{fontSize:'0.65rem'}}>車長</span>}
                    </div>
                    {isConductor && m !== userName && (
                      <div className="member-actions">
                        <button className="remove-btn-mini" onClick={() => removeMember(m)}>踢除</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="boss-info-panel">
                <h3 style={{marginBottom:'12px', color:'var(--gold)', fontSize:'0.85rem'}}>BOSS 資訊</h3>
                <div style={{fontSize:'1.1rem', fontWeight:'800', color:'var(--accent)', marginBottom:'6px'}}>{currentBoss.name}</div>
                <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>重生時間: <strong style={{color:'#fff'}}>{currentBoss.time} 分鐘</strong></div>
                <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>地區: {currentBoss.area}</div>
              </div>

              <div className="kill-report-panel">
                <h3>📊 擊殺報告 (TODAY)</h3>
                <div className="report-content">
                  <div className="report-group-title">房內總累計 (OVERALL)</div>
                  <div className="report-item">
                    <span className="label">房號 / BOSS:</span>
                    <span className="val highlight">{currentRoomId} - {currentBoss.name}</span>
                  </div>
                  <div className="report-item total-kills-row">
                    <span className="label">總擊殺次數:</span>
                    <span className="val highlight count-box">{currentRoom.totalKills || 0} 次</span>
                  </div>
                  <div className="report-item">
                    <span className="label">總共航程:</span>
                    <span className="val">{formatTime(now - currentRoom.createdAt)}</span>
                  </div>
                  <div className="report-divider" />
                  <div className="report-group-title guest-title">您的隨車里程 (YOUR SESSION)</div>
                  <div className="report-personal-grid">
                    <div className="personal-stat-card">
                      <span className="p-label">已隨車</span>
                      <span className="p-val">{formatTime(now - (sessionStartTime || now))}</span>
                    </div>
                    <div className="personal-stat-card">
                      <span className="p-label">共擊殺</span>
                      <span className="p-val">{sessionKills}<small>次</small></span>
                    </div>
                    <div className="personal-stat-card">
                      <span className="p-label">時薪效率</span>
                      <span className="p-val">{efficiency}<small>隻/hr</small></span>
                    </div>
                  </div>
                  <div style={{fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'8px'}}>
                    <div style={{marginBottom:'4px', color:'#888'}}>目前成員:</div>
                    <div>{members.join('  ')}</div>
                  </div>
                </div>
                <button className="export-btn" onClick={exportReport}>🖼️ 匯出擊殺戰報 (PNG)</button>
                <button className="love-btn" onClick={() => setShowInheritanceModal(true)}>
                  <span>❤️</span> 把愛傳下去 (繼承給他房)
                </button>
              </div>
            </aside>

            {/* 右側主區 */}
            <main className="room-main">
              {wildExplorers.length > 0 && (
                <div className="wild-boss-broadcast">
                  <span className="broadcast-icon">🍖</span>
                  <span className="broadcast-text">
                    <span className="explorers">{wildExplorers.join('、')}</span> 餓了去打野王！
                  </span>
                </div>
              )}

              <div className="room-header">
                <div className="room-info">
                  <h2 style={{color:'var(--gold)', fontSize:'1.6rem'}}>房號: <strong>{currentRoomId}</strong></h2>
                  <div className="room-password" style={{marginTop:'8px'}}>
                    <span style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>房間密碼:</span>
                    <div className="password-controls">
                      <span className="password-large">{currentRoom.password || '無'}</span>
                      <button className="copy-btn-mini" onClick={() => navigator.clipboard.writeText(currentRoom.password || '').then(() => alert('已複製！'))}>複製</button>
                    </div>
                  </div>
                </div>
                <div className="header-actions">
                  <button className="voice-config-btn" onClick={() => setShowVoiceSettings(true)}>⚙️ 語音設定</button>
                  <button className="share-btn" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => alert('連結已複製！'))}>分享房間連結</button>
                  <button className="leave-btn" onClick={() => setShowLeaveModal(true)}>下車離開 (返回大廳)</button>
                  <button className={`explore-toggle-btn ${currentRoom.wildBossExplore?.[userName] ? 'active' : ''}`} onClick={toggleWildBossExplore}>
                    {currentRoom.wildBossExplore?.[userName] ? '❌ 取消打野' : '🍖 餓了去打野'}
                  </button>
                </div>
              </div>

              <div className="input-section">
                <input
                  type="text"
                  value={inputChannel}
                  onChange={e => setInputC
��設定</button>
                  <button className="v16-btn-share" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => alert('連結已複製！'))}>分享房間連結</button>
                  <button className="v16-btn-leave" onClick={() => setShowLeaveModal(true)}>下車離開 (返回大廳)</button>
                  <button className={`v16-btn-wild ${currentRoom.wildBossExplore?.[userName] ? 'active' : ''}`} onClick={toggleWildBossExplore}>
                    {currentRoom.wildBossExplore?.[userName] ? '❌ 取消打野' : '🍖 餓了去打野'}
                  </button>
                </div>
              </header>

              <section className="v16-input-section">
                <input type="text" value={inputChannel} onChange={e => setInputChannel(e.target.value)} placeholder="輸入頻道 (例: 5)" onKeyPress={e => e.key === 'Enter' && addRecord()} className="v16-ch-input" />
                <button onClick={() => addRecord()} className="v16-btn-kill">已擊殺開始計時</button>
              </section>

              <section className="v16-table-section">
                <div className="v16-table-container">
                  <div className="v16-table-header">
                    <span>頻道</span><span>野王名稱</span><span>倒數計時</span><span>目前狀態</span><span>回報者</span><span>頻道操作</span>
                  </div>
                  {Object.keys(records).length === 0 ? (
                    <div className="v16-empty">目前沒有紀錄，請輸入頻道開始。</div>
                  ) : (
                    Object.keys(records).sort((a,b) => records[a].lastKill - records[b].lastKill).map(ch => {
                      const remaining = currentBoss.time - (now - records[ch].lastKill) / 60000;
                      const isReady = remaining <= 0;
                      return (
                        <div key={ch} className={`v16-table-row ${isReady ? 'row-ready' : ''}`}>
                          <span className="v16-col-ch">{ch}</span>
                          <span className="v16-col-bossname">{currentBoss.name}</span>
                          <span className="v16-col-timer">{isReady ? 'READY' : formatTime(remaining * 60000)}</span>
                          <span className="v16-col-status">
                            <span className={isReady ? 'badge-ready' : 'badge-wait'}>{isReady ? 'READY' : '重生中'}</span>
                          </span>
                          <span className="v16-col-reporter">{records[ch].reporter}</span>
                          <span className="v16-col-actions">
                            <button onClick={() => handleStationed(ch)}>佔位</button>
                            <button className="v16-kill-btn" onClick={() => addRecord(ch)}>擊殺</button>
                            <button className="v16-del-btn" onClick={() => removeRecord(ch)}>刪除</button>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
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
              {currentUser?.uid === ADMIN_UID && (
                <button 
                  className={`admin-entry-btn ${view === 'admin' ? 'active' : ''}`} 
                  onClick={() => setView('admin')}
                >
                  🛡️ 指揮部
                </button>
              )}
              <span className="user-greeting">Hi, {userName}</span>
              <img src={currentUser.photoURL || 'https://via.placeholder.com/40'} alt="avatar" className="header-avatar" onClick={() => setView('profile')} />
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
            <h2 style={{marginBottom: '25px'}}>選擇預設頭像</h2>
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
            <div className="modal-btns" style={{marginTop: '30px'}}>
              <button 
                onClick={() => {
                  if (selectedEmoji) {
                    updateProfileAvatar(selectedEmoji);
                    setShowAvatarModal(false);
                  }
                }}
                disabled={!selectedEmoji}
              >
                確定
              </button>
              <button onClick={() => setShowAvatarModal(false)} className="cancel-btn">取消</button>
            </div>
          </div>
        </div>
      )}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>確定下車？</h2>
            <button onClick={confirmLeave}>確定</button>
            <button onClick={() => setShowLeaveModal(false)} className="cancel-btn">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
