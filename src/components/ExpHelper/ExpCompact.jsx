import React, { useState, useEffect, useRef } from 'react';
import { formatDuration, formatEta, formatNumber } from './expCalculator';

const COLOR_PALETTE = [
  { name: '白色', hex: '#ffffff' },
  { name: '天藍', hex: '#38bdf8' },
  { name: '嫩綠', hex: '#4ade80' },
  { name: '檸黃', hex: '#fde047' },
  { name: '亮橘', hex: '#fb923c' },
  { name: '桃粉', hex: '#f472b6' },
];

export default function ExpCompact({
  trackingState,
  currentExp,
  rawPercent,
  correctedPercent,
  level,
  stats,
  onStartTracking,
  onStopTracking,
  onPauseTracking,
  onResetTracking,
  onSwitchToDashboard,
  onLaunchPip,
  isPipWindow = false,
}) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(0.88);

  // 分頁內滑鼠自由拖曳 (Draggable) - 僅在非原生 PiP 時生效
  const [pos, setPos] = useState({ x: 30, y: 30 }); // 預設靠右下
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (isPipWindow) return; // 原生 PiP 視窗由作業系統原生邊框拖曳
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.compact-drawer')) return;
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragOffset.current.x;
      const dy = e.clientY - dragOffset.current.y;
      dragOffset.current = { x: e.clientX, y: e.clientY };
      setPos((prev) => ({
        x: Math.max(10, prev.x - dx), // relative to right
        y: Math.max(10, prev.y - dy), // relative to bottom
      }));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 確保在原生 PiP 視窗中永远 100% 水平與垂直置中，零邊緣裁切
  const containerStyle = isPipWindow
    ? {
        position: 'static',
        margin: '0 auto',
        width: '100%',
        maxWidth: '360px',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }
    : {
        position: 'fixed',
        right: `${pos.x}px`,
        bottom: `${pos.y}px`,
      };

  const activePct = correctedPercent ?? rawPercent ?? 0;

  return (
    <div className={`exp-compact-wrapper ${isPipWindow ? 'in-pip-window' : ''}`} style={containerStyle}>
      <div
        className="compact-card"
        style={{
          '--compact-opacity': opacity,
          '--compact-color': selectedColor,
          '--compact-font-size': `${fontSize}px`,
        }}
      >
        {/* 頂部列 */}
        <div
          className="compact-header"
          onMouseDown={handleMouseDown}
          style={{ cursor: isPipWindow ? 'default' : 'grab', userSelect: 'none' }}
          title={isPipWindow ? '' : '按住可自由拖曳懸浮窗位置'}
        >
          <div className="compact-title-group">
            <span
              className="pulse-dot pulsing"
              style={{ color: trackingState === 'RECORDING' ? '#00e676' : '#ffab00' }}
            ></span>
            <span>PiKaPi 經驗小助手</span>
            {!isPipWindow && <span style={{ fontSize: '10px', opacity: 0.5 }}>✥ 可拖曳</span>}
          </div>

          <div className="compact-actions">
            {!isPipWindow && onLaunchPip && (
              <button
                className="compact-icon-btn"
                onClick={onLaunchPip}
                title="啟動永遠置頂 OS 浮動小窗 (Picture-in-Picture)"
              >
                🪟
              </button>
            )}
            <button
              className="compact-icon-btn"
              onClick={() => setShowDrawer(!showDrawer)}
              title="外觀設定抽屜"
            >
              🎨
            </button>
            {!isPipWindow && (
              <button
                className="compact-icon-btn"
                onClick={onSwitchToDashboard}
                title="放大回儀表板"
              >
                ⛶
              </button>
            )}
          </div>
        </div>

        {/* 經驗值微型進度條 */}
        <div className="compact-progress-track" title={`目前升級進度：${Number(activePct).toFixed(2)}%`}>
          <div className="compact-progress-fill" style={{ width: `${Math.min(100, Math.max(0, activePct))}%` }} />
        </div>

        {/* 核心數據清單 (包含使用者指定的新增資訊) */}
        <div className="compact-stats-list">
          <div className="compact-stat-row">
            <span className="compact-stat-label">⏱️ 統計時間</span>
            <span className="compact-stat-value">{formatDuration(stats.elapsedSeconds)}</span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">📊 當前經驗</span>
            <span className="compact-stat-value">
              {formatNumber(currentExp)}
              <span className="compact-stat-sub">[{Number(activePct).toFixed(2)}%]</span>
            </span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">🎖️ 當前等級</span>
            <span className="compact-stat-value" style={{ color: '#fbbf24' }}>Lv. {level || 1}</span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">📈 累積獲得</span>
            <span className="compact-stat-value" style={{ color: '#00e676' }}>
              +{formatNumber(stats.gainedExp)}
              <span className="compact-stat-sub">(+{stats.gainedPercent.toFixed(2)}%)</span>
            </span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">⚡ 實時分均</span>
            <span className="compact-stat-value" style={{ color: '#00e5ff' }}>
              +{formatNumber(stats.expPerMin)} <span className="compact-stat-sub">/分</span>
            </span>
          </div>

          {/* 分隔線 */}
          <div className="compact-divider"></div>

          {/* 🎯 預估 10 分鐘 */}
          <div className="compact-stat-row">
            <span className="compact-stat-label">⏳ 預估 10分鐘</span>
            <span className="compact-stat-value" style={{ color: '#fb923c' }}>
              +{formatNumber(stats.est10Min)}
            </span>
          </div>

          {/* 🎯 預估 60 分鐘 */}
          <div className="compact-stat-row">
            <span className="compact-stat-label">🕐 預估 60分鐘</span>
            <span className="compact-stat-value" style={{ color: '#f472b6' }}>
              +{formatNumber(stats.est60Min)}
            </span>
          </div>

          {/* 🎯 距離升級還差 */}
          <div className="compact-stat-row">
            <span className="compact-stat-label">🎯 距離升級還差</span>
            <span className="compact-stat-value" style={{ color: '#f87171' }}>
              {formatNumber(stats.remainingExp)}
            </span>
          </div>

          {/* 🎯 升級預估 (ETA) */}
          <div className="compact-stat-row">
            <span className="compact-stat-label">🚀 升級預估 (ETA)</span>
            <span className="compact-stat-value" style={{ color: '#c084fc' }}>
              {formatEta(stats.etaSeconds)}
            </span>
          </div>
        </div>

        {/* 快捷控制列 */}
        <div className="compact-btn-row">
          {trackingState === 'IDLE' ? (
            <button
              className="exp-btn exp-btn-green"
              style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
              onClick={onStartTracking}
            >
              ▶ 開始記錄 (F11)
            </button>
          ) : (
            <>
              <button
                className="exp-btn exp-btn-red"
                style={{ flex: 1.2, padding: '7px 10px', fontSize: '12px' }}
                onClick={onStopTracking}
              >
                ⏹ 停止 (F11)
              </button>
              {onPauseTracking && (
                <button
                  className="exp-btn exp-btn-glass"
                  style={{ flex: 1, padding: '7px 8px', fontSize: '12px' }}
                  onClick={onPauseTracking}
                  title="暫停/繼續 (F7)"
                >
                  {trackingState === 'PAUSED' ? '▶ 繼續' : '⏸ 暫停'}
                </button>
              )}
              {onResetTracking && (
                <button
                  className="exp-btn exp-btn-glass"
                  style={{ padding: '7px 10px', fontSize: '12px' }}
                  onClick={onResetTracking}
                  title="重設數據 (F8)"
                >
                  🔄
                </button>
              )}
            </>
          )}
        </div>

        {/* 外觀自訂抽屜 */}
        {showDrawer && (
          <div className="compact-drawer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span>字體大小 ({fontSize}px)</span>
              <input
                type="range"
                min="11"
                max="17"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                style={{ width: '120px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span>背景透明度</span>
              <input
                type="range"
                min="0.3"
                max="0.98"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                style={{ width: '120px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
              <span>字體顏色</span>
              <div className="palette-row">
                {COLOR_PALETTE.map((c) => (
                  <div
                    key={c.hex}
                    className={`color-swatch ${selectedColor === c.hex ? 'active' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => setSelectedColor(c.hex)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
