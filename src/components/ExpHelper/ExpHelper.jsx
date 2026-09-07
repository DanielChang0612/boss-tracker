import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import ExpDashboard from './ExpDashboard';
import ExpCompact from './ExpCompact';
import { calculatePaceStats, formatDuration, formatEta, formatNumber } from './expCalculator';
import { preprocessCanvas, recognizeExpCanvas, findBestLevelFit } from './expOcr';
import expData from '../../data/exp_table.json';
import './ExpHelper.css';

export default function ExpHelper({ currentUser, userName, onBackToHub }) {
  // 檢視模式: 'dashboard' | 'compact'
  const [viewMode, setViewMode] = useState('dashboard');

  // 計時狀態機: 'IDLE' | 'WAITING' | 'RECORDING' | 'PAUSED'
  const [trackingState, setTrackingState] = useState('IDLE');

  // 經驗數值狀態
  const [currentExp, setCurrentExp] = useState(53658); // 預設提供初始參考數值
  const [baseExp, setBaseExp] = useState(53658);
  const [rawPercent, setRawPercent] = useState(7.56);
  const [correctedPercent, setCorrectedPercent] = useState(7.56);
  const [level, setLevel] = useState(50);
  const [expToNext, setExpToNext] = useState(709716);
  const [isManualLevel, setIsManualLevel] = useState(false);

  // 計時器時間戳
  const [startTime, setStartTime] = useState(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [pauseStartTs, setPauseStartTs] = useState(null);
  const [now, setNow] = useState(Date.now());

  // 螢幕分享與 OCR 串流
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [zoomScale, setZoomScale] = useState(2.0);
  const [cropRegion, setCropRegion] = useState({ x: 180, y: 480, w: 220, h: 26 });
  const [ocrLogs, setOcrLogs] = useState([]);

  // DOM 參考
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const offscreenCanvasRef = useRef(document.createElement('canvas'));
  const ocrTimerRef = useRef(null);
  const reportRef = useRef(null);

  // 記錄日誌
  const addLog = useCallback((text, type = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setOcrLogs((prev) => [{ time, text, type }, ...prev.slice(0, 40)]);
  }, []);

  // 1 秒時鐘脈衝 (當正在記錄或等待時更新)
  useEffect(() => {
    const timer = setInterval(() => {
      if (trackingState === 'RECORDING') {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [trackingState]);

  // 動態速率數據
  const stats = calculatePaceStats({
    startTime,
    pausedDuration,
    baseExp,
    currentExp,
    expToNext,
    now,
  });

  // 更新經驗數值與觸發狀態機
  const handleExpUpdate = useCallback((newExp, newPercent = null) => {
    if (newExp === null || isNaN(newExp)) return;

    // 檢查反推等級
    const fit = findBestLevelFit(newExp, newPercent, isManualLevel ? level : null);
    setCurrentExp(newExp);
    if (newPercent !== null) setRawPercent(newPercent);
    setCorrectedPercent(fit.correctedPercent);
    if (!isManualLevel) {
      setLevel(fit.level);
      setExpToNext(fit.expToNext);
    }

    // 狀態機檢測：如果正在 WAITING 且新 EXP 大於 baseExp，立即啟動計時
    setTrackingState((prev) => {
      if (prev === 'WAITING') {
        if (newExp > baseExp) {
          setStartTime(Date.now());
          setPausedDuration(0);
          addLog(`⚡ 偵測到經驗浮動 (+${newExp - baseExp})，正式啟動計時！`, 'success');
          return 'RECORDING';
        }
      }
      return prev;
    });
  }, [baseExp, isManualLevel, level, addLog]);

  // 開始記錄 (F11)
  const handleStartTracking = () => {
    setBaseExp(currentExp);
    setTrackingState('WAITING');
    setStartTime(null);
    setPausedDuration(0);
    addLog(`⏳ 開始記錄，鎖定基準 EXP: ${formatNumber(currentExp)}，等待打死第一隻怪...`, 'warn');
  };

  // 停止記錄 (F11)
  const handleStopTracking = () => {
    setTrackingState('IDLE');
    addLog(`⏹ 停止記錄，統計時長: ${formatDuration(stats.elapsedSeconds)}，累計獲得: +${formatNumber(stats.gainedExp)} EXP`, 'info');
  };

  // 暫停 / 繼續 (F7)
  const handlePauseTracking = () => {
    if (trackingState === 'RECORDING') {
      setTrackingState('PAUSED');
      setPauseStartTs(Date.now());
      addLog('⏸ 計時已暫停', 'warn');
    } else if (trackingState === 'PAUSED') {
      const pauseDuration = pauseStartTs ? Date.now() - pauseStartTs : 0;
      setPausedDuration((prev) => prev + pauseDuration);
      setPauseStartTs(null);
      setTrackingState('RECORDING');
      addLog('▶ 計時已繼續', 'success');
    }
  };

  // 重置數據 (F8)
  const handleResetTracking = () => {
    setTrackingState('IDLE');
    setStartTime(null);
    setPausedDuration(0);
    setBaseExp(currentExp);
    addLog('🔄 已重置所有統計數據', 'info');
  };

  // 手動指定等級
  const handleSetManualLevel = (manualLvl) => {
    setIsManualLevel(true);
    setLevel(manualLvl);
    const row = expData.find((e) => e.level === manualLvl) || expData[0];
    setExpToNext(row.expToNext);
    addLog(`已手動鎖定等級: Lv.${manualLvl} (升級需 ${formatNumber(row.expToNext)})`, 'info');
  };

  // 啟動螢幕畫面分享 (Screen Capture)
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'never', frameRate: 15 },
        audio: false,
      });

      streamRef.current = stream;
      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setIsScreenSharing(true);
      addLog('🖥️ 視窗串流已啟動，開始即時框選辨識', 'success');

      // 監聽使用者按瀏覽器原生的「停止共用」
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // 啟動定時截圖與 OCR 流程 (每 1.8 秒執行一次)
      runScreenOcrLoop();
    } catch (err) {
      console.error('Screen capture error:', err);
      addLog(`無法啟動視窗擷取: ${err.message}`, 'warn');
    }
  };

  // 停止螢幕畫面分享
  const stopScreenShare = () => {
    if (ocrTimerRef.current) {
      clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
    addLog('⏹ 視窗串流已停止', 'info');
  };

  // 定時取格與 OCR 循環
  const runScreenOcrLoop = () => {
    if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);

    ocrTimerRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const offCanvas = offscreenCanvasRef.current;
      offCanvas.width = video.videoWidth;
      offCanvas.height = video.videoHeight;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(video, 0, 0);

      // 執行智慧文字行隔離
      const processed = preprocessCanvas(offCanvas, cropRegion);

      // 渲染至右側預覽窗
      if (previewCanvasRef.current) {
        const pCanvas = previewCanvasRef.current;
        pCanvas.width = processed.width;
        pCanvas.height = processed.height;
        const pCtx = pCanvas.getContext('2d');
        pCtx.imageSmoothingEnabled = false;
        pCtx.drawImage(processed, 0, 0);
      }

      // 執行 OCR 辨識
      try {
        const result = await recognizeExpCanvas(processed, isManualLevel ? level : null);
        if (result && result.currentExp !== null) {
          handleExpUpdate(result.currentExp, result.rawPercent);
          addLog(`OCR 辨識成功: EXP ${formatNumber(result.currentExp)} [${result.correctedPercent}%] (Lv.${result.level})`, 'success');
        }
      } catch (err) {
        console.warn('OCR error:', err);
      }
    }, 1800);
  };

  // 調整框選區域
  const handleAdjustCrop = (axis, delta) => {
    setCropRegion((prev) => ({
      ...prev,
      [axis]: Math.max(0, prev[axis] + delta),
    }));
  };

  // 貼上截圖監聽 (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          const img = new Image();
          img.src = URL.createObjectURL(blob);
          img.onload = async () => {
            const offCanvas = offscreenCanvasRef.current;
            offCanvas.width = img.width;
            offCanvas.height = img.height;
            const offCtx = offCanvas.getContext('2d');
            offCtx.drawImage(img, 0, 0);

            const processed = preprocessCanvas(offCanvas, { x: 0, y: 0, w: img.width, h: img.height });
            if (previewCanvasRef.current) {
              const pCanvas = previewCanvasRef.current;
              pCanvas.width = processed.width;
              pCanvas.height = processed.height;
              pCanvas.getContext('2d').drawImage(processed, 0, 0);
            }

            addLog('📋 收到剪貼簿圖片，正在辨識...', 'info');
            try {
              const result = await recognizeExpCanvas(processed, isManualLevel ? level : null);
              if (result && result.currentExp !== null) {
                handleExpUpdate(result.currentExp, result.rawPercent);
                addLog(`截圖辨識成功: ${formatNumber(result.currentExp)} [${result.correctedPercent}%]`, 'success');
              } else {
                addLog(`未能在截圖中找到清楚的 EXP 文字 (${result?.rawText || ''})`, 'warn');
              }
            } catch (err) {
              addLog(`截圖辨識失敗: ${err.message}`, 'warn');
            }
          };
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleExpUpdate, isManualLevel, level, addLog]);

  // 全域快捷鍵 (F7~F11)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F7') {
        e.preventDefault();
        handlePauseTracking();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleResetTracking();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setViewMode((m) => (m === 'dashboard' ? 'compact' : 'dashboard'));
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (trackingState === 'IDLE') {
          handleStartTracking();
        } else {
          handleStopTracking();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // 匯出戰報圖片 (PNG)
  const exportBattleReport = async () => {
    if (!reportRef.current) return;
    try {
      addLog('🖼️ 正在生成戰報圖片...', 'info');
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0d111e',
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `PiKaPi_練功戰報_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      addLog('✅ 練功結算戰報圖片匯出成功！', 'success');
    } catch (err) {
      console.error('Export report failed:', err);
      addLog(`戰報匯出失敗: ${err.message}`, 'warn');
    }
  };

  return (
    <div className="exp-helper-container">
      {/* 頂部導航控制列 */}
      <div className="exp-top-bar">
        <div className="exp-brand-group">
          <span className="exp-brand-icon">⚡</span>
          <div className="exp-brand-title">
            PiKaPi 經驗值小助手
            <span className="exp-version-pill">Web v1.0</span>
          </div>
        </div>

        <div className="exp-top-actions">
          <button
            className={`exp-btn ${viewMode === 'compact' ? 'exp-btn-primary' : 'exp-btn-glass'}`}
            onClick={() => setViewMode(viewMode === 'dashboard' ? 'compact' : 'dashboard')}
            title="快捷切換懸浮窗模式 (F9)"
          >
            {viewMode === 'dashboard' ? '🎮 遊戲懸浮模式 (F9)' : '🖥️ 儀表板模式 (F9)'}
          </button>

          <button className="exp-btn exp-btn-glass" onClick={onBackToHub}>
            🏠 返回服務大廳
          </button>
        </div>
      </div>

      {/* 模式 A：儀表板模式 */}
      {viewMode === 'dashboard' && (
        <ExpDashboard
          trackingState={trackingState}
          currentExp={currentExp}
          rawPercent={rawPercent}
          correctedPercent={correctedPercent}
          level={level}
          expToNext={expToNext}
          isManualLevel={isManualLevel}
          stats={stats}
          onStartTracking={handleStartTracking}
          onStopTracking={handleStopTracking}
          onPauseTracking={handlePauseTracking}
          onResetTracking={handleResetTracking}
          onManualExpUpdate={handleExpUpdate}
          onSetManualLevel={handleSetManualLevel}
          onExportReport={exportBattleReport}
          isScreenSharing={isScreenSharing}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
          previewCanvasRef={previewCanvasRef}
          zoomScale={zoomScale}
          setZoomScale={setZoomScale}
          cropRegion={cropRegion}
          onAdjustCrop={handleAdjustCrop}
          ocrLogs={ocrLogs}
        />
      )}

      {/* 模式 B：遊戲精簡懸浮模式 */}
      {viewMode === 'compact' && (
        <>
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8892b0' }}>
            <h2>🎮 精簡懸浮視窗已在畫面右下角開啟</h2>
            <p>可自由調整字體大小與 6 色調色盤，點擊右上角「⛶」或按 <b>F9</b> 可切換回儀表板主視窗。</p>
            <button className="exp-btn exp-btn-primary" style={{ marginTop: '16px' }} onClick={() => setViewMode('dashboard')}>
              返回儀表板模式
            </button>
          </div>

          <ExpCompact
            trackingState={trackingState}
            currentExp={currentExp}
            rawPercent={rawPercent}
            correctedPercent={correctedPercent}
            level={level}
            stats={stats}
            onStartTracking={handleStartTracking}
            onStopTracking={handleStopTracking}
            onSwitchToDashboard={() => setViewMode('dashboard')}
          />
        </>
      )}

      {/* 隱藏戰報卡片 (html2canvas 截圖專用) */}
      <div ref={reportRef} className="exp-report-capture">
        <div className="report-header-banner">
          <div>
            <h1 className="report-brand-h1">PIKAPI 練功作戰情報網</h1>
            <p className="report-subtitle-p">經驗值效率結算戰報・EXP PACE REPORT</p>
          </div>
          <div className="report-badge-classified">【 訓練結算 】</div>
        </div>

        <div className="report-metrics-grid">
          <div className="report-metric-box">
            <label>作戰英雄</label>
            <span style={{ color: '#ffd700' }}>{userName || '公會英雄'}</span>
          </div>
          <div className="report-metric-box">
            <label>當前等級</label>
            <span>Lv. {level}</span>
          </div>
          <div className="report-metric-box">
            <label>總統計時間</label>
            <span>{formatDuration(stats.elapsedSeconds)}</span>
          </div>
          <div className="report-metric-box">
            <label>累積獲得 EXP</label>
            <span style={{ color: '#00e676' }}>+{formatNumber(stats.gainedExp)}</span>
          </div>
          <div className="report-metric-box">
            <label>累積進度增量</label>
            <span style={{ color: '#a3e635' }}>+{stats.gainedPercent.toFixed(2)}%</span>
          </div>
          <div className="report-metric-box">
            <label>預估每小時效率</label>
            <span style={{ color: '#f472b6' }}>+{formatNumber(stats.est60Min)}</span>
          </div>
        </div>

        <div className="report-footer-banner">
          <span>報告產出時間：{new Date().toLocaleString('zh-TW')}</span>
          <span>PIKAPI GUILD TRACKER v16.3 / EXP HELPER WEB</span>
        </div>
      </div>
    </div>
  );
}
