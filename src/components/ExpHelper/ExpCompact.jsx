import React, { useState } from 'react';
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
  onSwitchToDashboard,
}) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(0.85);

  return (
    <div className="exp-compact-wrapper">
      <div
        className="compact-card"
        style={{
          '--compact-opacity': opacity,
          '--compact-color': selectedColor,
          '--compact-font-size': `${fontSize}px`,
        }}
      >
        {/* 頂部列 */}
        <div className="compact-header">
          <div className="compact-title-group">
            <span className="pulse-dot pulsing" style={{ color: trackingState === 'RECORDING' ? '#00e676' : '#ffab00' }}></span>
            <span>PiKaPi 經驗小助手</span>
          </div>
          <div className="compact-actions">
            <button
              className="compact-icon-btn"
              onClick={() => setShowDrawer(!showDrawer)}
              title="外觀設定抽屜"
            >
              🎨
            </button>
            <button
              className="compact-icon-btn"
              onClick={onSwitchToDashboard}
              title="放大回儀表板"
            >
              ⛶
            </button>
          </div>
        </div>

        {/* 精簡數據清單 */}
        <div className="compact-stats-list">
          <div className="compact-stat-row">
            <span className="compact-stat-label">統計時間</span>
            <span className="compact-stat-value">{formatDuration(stats.elapsedSeconds)}</span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">EXP [ % ]</span>
            <span className="compact-stat-value">
              {formatNumber(currentExp)} [{correctedPercent ?? rawPercent ?? '0.00'}%]
            </span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">當前等級</span>
            <span className="compact-stat-value">Lv. {level || 1}</span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">累積獲得</span>
            <span className="compact-stat-value" style={{ color: '#00e676' }}>
              +{formatNumber(stats.gainedExp)} (+{stats.gainedPercent.toFixed(2)}%)
            </span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">EXP / 分</span>
            <span className="compact-stat-value" style={{ color: '#00e5ff' }}>
              +{formatNumber(stats.expPerMin)}
            </span>
          </div>

          <div className="compact-stat-row">
            <span className="compact-stat-label">升等 ETA</span>
            <span className="compact-stat-value" style={{ color: '#c084fc' }}>
              {formatEta(stats.etaSeconds)}
            </span>
          </div>
        </div>

        {/* 快捷膠囊控制鈕 */}
        <div className="compact-btn-row">
          {trackingState === 'IDLE' ? (
            <button
              className="exp-btn exp-btn-green"
              style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
              onClick={onStartTracking}
            >
              ▶ 開始記錄 (F11)
            </button>
          ) : (
            <button
              className="exp-btn exp-btn-red"
              style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
              onClick={onStopTracking}
            >
              ⏹ 停止記錄 (F11)
            </button>
          )}
        </div>

        {/* 外觀自訂抽屜 */}
        {showDrawer && (
          <div className="compact-drawer">
            {/* 字體大小 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span>字體大小 ({fontSize}px)</span>
              <input
                type="range"
                min="12"
                max="20"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                style={{ width: '120px' }}
              />
            </div>

            {/* 透明度 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span>背景透明度</span>
              <input
                type="range"
                min="0.3"
                max="0.95"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                style={{ width: '120px' }}
              />
            </div>

            {/* 6 色調色盤 */}
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
