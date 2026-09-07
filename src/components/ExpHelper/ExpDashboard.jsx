import React, { useState } from 'react';
import { formatDuration, formatEta, formatNumber } from './expCalculator';
import ExpViewfinder from './ExpViewfinder';

export default function ExpDashboard({
  trackingState,
  currentExp,
  rawPercent,
  correctedPercent,
  level,
  expToNext,
  isManualLevel,
  stats,
  onStartTracking,
  onStopTracking,
  onPauseTracking,
  onResetTracking,
  onManualExpUpdate,
  onSetManualLevel,
  onExportReport,
  isScreenSharing,
  onStartScreenShare,
  onStopScreenShare,
  onAutoDetectExp,
  onLaunchPip,
  isPipOpen,
  previewCanvasRef,
  zoomScale,
  setZoomScale,
  cropRegion,
  onCropChange,
  onAdjustCrop,
  ocrLogs,
  videoRef,
  lastOcrResult,
}) {
  const [manualExpInput, setManualExpInput] = useState('');
  const [manualPctInput, setManualPctInput] = useState('');
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [tempLevelInput, setTempLevelInput] = useState(level || 1);

  const memoryInfo = (performance && performance.memory)
    ? `${Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))} MB`
    : '正常 (WASM)';

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualExpInput && !manualPctInput) return;
    const expVal = manualExpInput ? parseInt(manualExpInput.replace(/,/g, ''), 10) : currentExp;
    const pctVal = manualPctInput ? parseFloat(manualPctInput) : null;
    onManualExpUpdate(expVal, pctVal);
    setManualExpInput('');
    setManualPctInput('');
  };

  const handleLevelSubmit = (e) => {
    e.preventDefault();
    const parsedLvl = parseInt(tempLevelInput, 10);
    if (!isNaN(parsedLvl) && parsedLvl >= 1 && parsedLvl <= 200) {
      onSetManualLevel(parsedLvl);
    }
    setIsEditingLevel(false);
  };

  return (
    <div className="exp-dashboard-grid">
      {/* 左側：11 項大數據指標面板 */}
      <div className="exp-stats-panel">
        <div className="panel-header-row">
          <div className="panel-title">
            <span>📊</span> 實時數據儀表板 (Dashboard)
          </div>
          <div className={`tracking-badge ${trackingState.toLowerCase()}`}>
            <span className={`pulse-dot ${trackingState === 'RECORDING' ? 'pulsing' : ''}`}></span>
            {trackingState === 'IDLE' && '未記錄'}
            {trackingState === 'WAITING' && '⏳ 等待經驗值浮動中...'}
            {trackingState === 'RECORDING' && '⚡ 正在記錄中'}
            {trackingState === 'PAUSED' && '⏸ 已暫停'}
          </div>
        </div>

        {/* 11 項數據卡片網格 */}
        <div className="stats-cards-grid">
          {/* 1. M 記憶體 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#a78bfa' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">M</span> 系統狀態</span>
            </div>
            <div className="stat-card-value">{memoryInfo}</div>
          </div>

          {/* 2. T 統計時間 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#38bdf8' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">T</span> 統計時間</span>
            </div>
            <div className="stat-card-value large">{formatDuration(stats.elapsedSeconds)}</div>
          </div>

          {/* 3. E EXP */}
          <div className="stat-card-v1" style={{ '--stat-color': '#4ade80' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">E</span> 目前 EXP</span>
            </div>
            <div className="stat-card-value">
              {formatNumber(currentExp)}
              <span className="stat-card-sub">[{correctedPercent ?? rawPercent ?? '0.00'}%]</span>
            </div>
          </div>

          {/* 4. Lv 等級 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#fbbf24' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">Lv</span> 當前等級</span>
              <button
                className="exp-btn-glass"
                style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '6px' }}
                onClick={() => setIsEditingLevel(!isEditingLevel)}
              >
                {isManualLevel ? '手動 ✎' : '自動 ✎'}
              </button>
            </div>
            {isEditingLevel ? (
              <form onSubmit={handleLevelSubmit} style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={tempLevelInput}
                  onChange={(e) => setTempLevelInput(e.target.value)}
                  style={{ width: '70px', background: '#000', border: '1px solid #fbbf24', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '16px' }}
                  autoFocus
                />
                <button type="submit" className="exp-btn-green" style={{ padding: '2px 8px', fontSize: '12px' }}>存</button>
              </form>
            ) : (
              <div className="stat-card-value large">
                Lv. {level || 1}
                <span className="stat-card-sub">升級需: {formatNumber(expToNext)}</span>
              </div>
            )}
          </div>

          {/* 5. A 累積獲得 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#34d399' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">A</span> 累積獲得 EXP</span>
            </div>
            <div className="stat-card-value large">+{formatNumber(stats.gainedExp)}</div>
          </div>

          {/* 6. % 累積獲得% */}
          <div className="stat-card-v1" style={{ '--stat-color': '#a3e635' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">%</span> 累積獲得 %</span>
            </div>
            <div className="stat-card-value large">+{stats.gainedPercent.toFixed(2)}%</div>
          </div>

          {/* 7. S EXP / 分 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#22d3ee' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">S</span> 實時分均經驗</span>
            </div>
            <div className="stat-card-value">+{formatNumber(stats.expPerMin)} <span className="stat-card-sub">/分</span></div>
          </div>

          {/* 8. 10 預估 10 分 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#fb923c' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">10</span> 預估 10 分鐘</span>
            </div>
            <div className="stat-card-value">+{formatNumber(stats.est10Min)}</div>
          </div>

          {/* 9. 60 預估 60 分 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#f472b6' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">60</span> 預估 60 分鐘 (時均)</span>
            </div>
            <div className="stat-card-value">+{formatNumber(stats.est60Min)}</div>
          </div>

          {/* 10. 剩 升等還差 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#f87171' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">剩</span> 距離升級還差</span>
            </div>
            <div className="stat-card-value">{formatNumber(stats.remainingExp)}</div>
          </div>

          {/* 11. U 升級預估 */}
          <div className="stat-card-v1" style={{ '--stat-color': '#c084fc' }}>
            <div className="stat-card-header">
              <span className="stat-card-tag"><span className="stat-card-key">U</span> 升級預估 (ETA)</span>
            </div>
            <div className="stat-card-value large">{formatEta(stats.etaSeconds)}</div>
          </div>
        </div>

        {/* 底部主要操作控制列 */}
        <div className="record-controls-row">
          {trackingState === 'IDLE' ? (
            <button className="exp-btn exp-btn-green record-btn-main" onClick={onStartTracking}>
              ▶ 開始記錄 (F11)
            </button>
          ) : (
            <button className="exp-btn exp-btn-red record-btn-main" onClick={onStopTracking}>
              ⏹ 停止記錄 (F11)
            </button>
          )}

          <button
            className="exp-btn exp-btn-glass"
            disabled={trackingState === 'IDLE'}
            onClick={onPauseTracking}
            title="暫停/繼續累計"
          >
            {trackingState === 'PAUSED' ? '▶ 繼續 (F7)' : '⏸ 暫停 (F7)'}
          </button>

          <button className="exp-btn exp-btn-glass" onClick={onResetTracking} title="重設數據">
            🔄 重置 (F8)
          </button>

          <button className="exp-btn exp-btn-primary" onClick={onExportReport} title="匯出高畫質戰報圖片">
            🖼️ 匯出戰報
          </button>
        </div>
      </div>

      {/* 右側：即時取景器、畫面分享與微調區 */}
      <div className="exp-monitor-panel">
        <div className="monitor-box">
          {/* 視窗串流與置頂懸浮窗頂部控制列 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {!isScreenSharing ? (
              <button className="exp-btn exp-btn-primary" style={{ flex: 1.2, padding: '12px 18px', fontSize: '14px' }} onClick={onStartScreenShare}>
                🖥️ 選擇遊戲視窗 (Screen Capture)
              </button>
            ) : (
              <button className="exp-btn exp-btn-red" style={{ flex: 1 }} onClick={onStopScreenShare}>
                ⏹ 停止畫面串流
              </button>
            )}

            <button
              className="exp-btn exp-btn-glass"
              style={{ flex: 1, borderColor: isPipOpen ? '#00e676' : '#00e5ff', color: isPipOpen ? '#00e676' : '#00e5ff' }}
              onClick={onLaunchPip}
              title="在作業系統桌面開啟永遠置頂的浮動小視窗，可直接拖曳到楓之谷遊戲畫面上！"
            >
              🎮 {isPipOpen ? '關閉置頂小窗' : '遊戲置頂小窗 (PiP)'}
            </button>
          </div>

          {/* 🎯 核心取景器：支援在視窗畫面上直接拖曳框選經驗值範圍 */}
          <ExpViewfinder
            videoRef={videoRef}
            isScreenSharing={isScreenSharing}
            cropRegion={cropRegion}
            onCropChange={onCropChange}
            previewCanvasRef={previewCanvasRef}
            lastOcrResult={lastOcrResult}
            onAutoDetect={onAutoDetectExp}
            zoomScale={zoomScale}
            setZoomScale={setZoomScale}
            onAdjustCrop={onAdjustCrop}
          />
        </div>

        {/* D-Pad 十字鍵座標微調區 */}
        <div className="monitor-box">
          <div className="panel-title" style={{ fontSize: '14px', marginBottom: '12px' }}>
            <span>🎯</span> 座標微調 (D-Pad 微調框選位置)
          </div>
          <div className="dpad-section">
            <div className="dpad-layout">
              <div></div>
              <button className="dpad-btn" onClick={() => onAdjustCrop('y', -2)} title="上移">▲</button>
              <div></div>
              <button className="dpad-btn" onClick={() => onAdjustCrop('x', -2)} title="左移">◀</button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', opacity: 0.4 }}>•</div>
              <button className="dpad-btn" onClick={() => onAdjustCrop('x', 2)} title="右移">▶</button>
              <div></div>
              <button className="dpad-btn" onClick={() => onAdjustCrop('y', 2)} title="下移">▼</button>
              <div></div>
            </div>

            <div className="coord-readouts">
              <div className="coord-row"><span>X 座標:</span> <b>{cropRegion.x} px</b></div>
              <div className="coord-row"><span>Y 座標:</span> <b>{cropRegion.y} px</b></div>
              <div className="coord-row"><span>寬度 W:</span> <b>{cropRegion.w} px</b></div>
              <div className="coord-row"><span>高度 H:</span> <b>{cropRegion.h} px</b></div>
            </div>
          </div>
        </div>

        {/* 手動極速更新列 */}
        <div className="monitor-box">
          <div className="panel-title" style={{ fontSize: '14px', marginBottom: '10px' }}>
            <span>⌨️</span> 手動極速更新 (無螢幕分享時可用)
          </div>
          <form className="manual-entry-bar" onSubmit={handleManualSubmit}>
            <div className="manual-input-box">
              <input
                type="text"
                placeholder="當前 EXP (如 57823)"
                value={manualExpInput}
                onChange={(e) => setManualExpInput(e.target.value)}
              />
            </div>
            <div className="manual-input-box" style={{ maxWidth: '120px' }}>
              <input
                type="text"
                placeholder="% (如 8.15)"
                value={manualPctInput}
                onChange={(e) => setManualPctInput(e.target.value)}
              />
            </div>
            <button type="submit" className="exp-btn exp-btn-primary" style={{ padding: '8px 16px' }}>
              更新
            </button>
          </form>
        </div>

        {/* OCR 原始記錄 Console */}
        <div className="monitor-box">
          <div className="panel-title" style={{ fontSize: '13px', marginBottom: '8px' }}>
            <span>📜</span> 辨識紀錄日誌 (Log)
          </div>
          <div className="ocr-log-console">
            {ocrLogs.length === 0 ? (
              <div className="ocr-log-line">尚無識別記錄，請開啟視窗分享或貼上截圖...</div>
            ) : (
              ocrLogs.map((log, idx) => (
                <div key={idx} className={`ocr-log-line ${log.type || ''}`}>
                  [{log.time}] {log.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
