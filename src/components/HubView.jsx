import React from 'react';

export default function HubView({
  currentUser,
  userName,
  rankInfo,
  roleInfo,
  onNavigate,
  onLogout,
}) {
  const isEmoji = !currentUser?.photoURL || !currentUser?.photoURL.startsWith('http');

  return (
    <div className="hub-portal-container">
      {/* 頂部歡迎與身分卡 */}
      <div className="hub-hero-card glass-panel">
        <div className="hub-user-summary">
          <div className="hub-avatar-ring">
            {isEmoji ? (
              <span className="hub-avatar-emoji">{currentUser?.photoURL || '🐶'}</span>
            ) : (
              <img src={currentUser?.photoURL} alt="Avatar" className="hub-avatar-img" />
            )}
            <span className="hub-rank-badge">{rankInfo?.badge || '🌱'}</span>
          </div>

          <div className="hub-user-details">
            <div className="hub-user-tags">
              <span className="hub-role-pill" style={{ borderColor: roleInfo?.color, color: roleInfo?.color }}>
                {roleInfo?.role || '作戰成員'}
              </span>
              <span className="hub-level-pill" style={{ color: rankInfo?.color }}>
                {rankInfo?.fullTitle || '初心者 一階'} (Lv.{rankInfo?.level || 1})
              </span>
            </div>
            <h1 className="hub-welcome-title">
              歡迎歸隊，<span className="hub-user-name">{userName || '公會英雄'}</span>
            </h1>
            <p className="hub-welcome-subtitle">
              PiKaPi 戰略指揮核心平台・請選擇您要執行的作戰模組
            </p>
          </div>
        </div>

        <div className="hub-quick-stats">
          <div className="hub-stat-item">
            <span className="h-stat-label">累積野王擊殺</span>
            <span className="h-stat-val">{currentUser?.profile?.totalKills || 0} <small>隻</small></span>
          </div>
          <div className="hub-stat-item">
            <span className="h-stat-label">隨車執勤時長</span>
            <span className="h-stat-val">{(currentUser?.profile?.totalHours || 0).toFixed(1)} <small>h</small></span>
          </div>
        </div>
      </div>

      {/* 兩大核心作戰模組入口卡片 */}
      <div className="hub-cards-grid">
        {/* 卡片 1: 打王趣 (Boss Tracker) */}
        <div className="hub-mission-card boss-card" onClick={() => onNavigate('lobby')}>
          <div className="mission-card-badge">🔥 即時協同作戰</div>
          <div className="mission-card-icon">👑</div>
          <h2 className="mission-card-title">PiKaPi 公會和諧打王趣</h2>
          <p className="mission-card-desc">
            全頻道野王即時倒數計時、多人車隊蹲點防搶機制、TTS 真人語音報時與「把愛傳下去」跨房無縫交接。
          </p>

          <div className="mission-features-list">
            <div className="feature-chip">🎯 9 大野王分流計時</div>
            <div className="feature-chip">🟢 三態佔位確認防搶</div>
            <div className="feature-chip">💖 把愛傳下去數據移交</div>
            <div className="feature-chip">🔊 TTS 語音廣播提醒</div>
          </div>

          <button className="hub-enter-btn boss-btn">
            進入作戰指揮部 ➔
          </button>
        </div>

        {/* 卡片 2: 經驗值小助手 (EXP Helper) */}
        <div className="hub-mission-card exp-card" onClick={() => onNavigate('exp-helper')}>
          <div className="mission-card-badge exp-badge">⚡ 高精確練功測速</div>
          <div className="mission-card-icon">📈</div>
          <h2 className="mission-card-title">PiKaPi 經驗值小助手</h2>
          <p className="mission-card-desc">
            支援視窗畫面擷取 OCR、智慧文字行隔離（去進度條）、楓之谷 1~200 等等級反向適配與升級 ETA 動態推估。
          </p>

          <div className="mission-features-list">
            <div className="feature-chip">📹 視窗畫面擷取 & OCR</div>
            <div className="feature-chip">📊 1~200 等經驗表適配</div>
            <div className="feature-chip">⏳ 等待打首怪狀態機</div>
            <div className="feature-chip">🎮 儀表板 & 懸浮小窗</div>
          </div>

          <button className="hub-enter-btn exp-btn">
            啟動經驗小助手 ➔
          </button>
        </div>
      </div>

      {/* 底部功能捷徑 */}
      <div className="hub-shortcuts-bar glass-panel">
        <span className="shortcuts-title">快速通道：</span>
        <div className="shortcuts-links">
          <button className="shortcut-btn" onClick={() => onNavigate('leaderboard')}>
            🏆 戰功排行榜
          </button>
          <button className="shortcut-btn" onClick={() => onNavigate('medals')}>
            🎖️ 榮譽勳章
          </button>
          <button className="shortcut-btn" onClick={() => onNavigate('profile')}>
            👤 個人檔案
          </button>
          {roleInfo?.role === 'Pika' || roleInfo?.role === '管理員' ? (
            <button className="shortcut-btn admin-shortcut" onClick={() => onNavigate('admin')}>
              🛡️ 戰略指揮後台
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
