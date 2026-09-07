import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import ExpDashboard from './ExpDashboard';
import ExpCompact from './ExpCompact';
import { calculatePaceStats, formatDuration, formatEta, formatNumber } from './expCalculator';
import { preprocessCanvas, recognizeExpCanvas, findBestLevelFit, autoDetectExpRegion } from './expOcr';
import expData from '../../data/exp_table.json';
import './ExpHelper.css';

export default function ExpHelper({ currentUser, userName, onBackToHub }) {
  // 檢視模式: 'dashboard' | 'compact'
  const [viewMode, setViewMode] = useState('dashboard');

  // 計時狀態機: 'IDLE' | 'WAITING' | 'RECORDING' | 'PAUSED'
  const [trackingState, setTrackingState] = useState('IDLE');

  // 經驗數值狀態 (初始預設帶入 57823 / 8.15% 吻合測試圖)
  const [currentExp, setCurrentExp] = useState(57823);
  const [baseExp, setBaseExp] = useState(57823);
  const [rawPercent, setRawPercent] = useState(8.15);
  const [correctedPercent, setCorrectedPercent] = useState(8.15);
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
  // 預設框選比例更貼合常見的 EXP 條 (寬度 140, 高度 32)
  const [cropRegion, setCropRegion] = useState({ x: 430, y: 4, w: 140, h: 32 });
  const [ocrLogs, setOcrLogs] = useState([]);

  // Document Picture-in-Picture 狀態
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [pipContainer, setPipContainer] = useState(null);
  const pipWindowRef = useRef(null);

  // DOM 參考
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const offscreenCanvasRef = useRef(document.createElement('canvas'));
  const offscreenCropRef = useRef(document.createElement('canvas'));
  const ocrTimerRef = useRef(null);
  const reportRef = useRef(null);

  const addLog = useCallback((text, type = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setOcrLogs((prev) => [{ time, text, type }, ...prev.slice(0, 40)]);
  }, []);

  // 1 秒時鐘脈衝
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

    const fit = findBestLevelFit(newExp, newPercent, isManualLevel ? level : null);
    setCurrentExp(newExp);
    if (newPercent !== null) setRawPercent(newPercent);
    setCorrectedPercent(fit.correctedPercent);
    if (!isManualLevel) {
      setLevel(fit.level);
      setExpToNext(fit.expToNext);
    }

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

  // 🎯 一鍵自動定位 EXP 條
  const handleAutoDetectExp = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      addLog('請先啟動視窗畫面分享，方可執行自動偵測', 'warn');
      return;
    }
    const offCanvas = offscreenCanvasRef.current;
    const region = autoDetectExpRegion(offCanvas);
    if (region) {
      setCropRegion(region);
      addLog(`🎯 成功自動鎖定 EXP 條位置！(X: ${region.x}, Y: ${region.y}, W: ${region.w}, H: ${region.h})`, 'success');
    } else {
      addLog('在當前畫面未找到特徵綠色括號 [...]，請手動確認遊戲介面是否可見', 'warn');
    }
  };

  // 啟動螢幕畫面分享
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

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // 串流啟動 1 秒後，嘗試自動抓取一次 EXP 條座標
      setTimeout(() => {
        handleAutoDetectExp();
      }, 1000);

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

      // 建立裁切的原始點陣 Canvas (供給 Pixel Matcher)
      const cropCanvas = offscreenCropRef.current;
      cropCanvas.width = Math.max(10, Math.min(cropRegion.w, offCanvas.width - cropRegion.x));
      cropCanvas.height = Math.max(10, Math.min(cropRegion.h, offCanvas.height - cropRegion.y));
      const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
      cropCtx.drawImage(
        offCanvas,
        cropRegion.x,
        cropRegion.y,
        cropCanvas.width,
        cropCanvas.height,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      // 執行文字行隔離 (去進度條)
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

      // 執行圖像辨識 (優先點陣比對，備援 Tesseract)
      try {
        const result = await recognizeExpCanvas(processed, isManualLevel ? level : null, cropCanvas);
        if (result && result.currentExp !== null) {
          handleExpUpdate(result.currentExp, result.rawPercent);
          const methodTag = result.isPixelMatch ? '💎 [點陣精準比對]' : '🔍 [Tesseract OCR]';
          addLog(`${methodTag} EXP ${formatNumber(result.currentExp)} [${result.correctedPercent}%] (Lv.${result.level})`, 'success');
        }
      } catch (err) {
        console.warn('OCR error:', err);
      }
    }, 1600);
  };

  // 調整框選區域
  const handleAdjustCrop = (axis, delta) => {
    setCropRegion((prev) => ({
      ...prev,
      [axis]: Math.max(0, prev[axis] + delta),
    }));
  };

  // 貼上截圖監聽
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

            // 自動偵測圖片內的 EXP 條
            const detected = autoDetectExpRegion(offCanvas);
            const activeRegion = detected || { x: 0, y: 0, w: img.width, h: img.height };
            if (detected) {
              setCropRegion(detected);
              addLog(`🎯 截圖中自動偵測到 EXP 條位置！(X:${detected.x}, Y:${detected.y})`, 'success');
            }

            const cropCanvas = offscreenCropRef.current;
            cropCanvas.width = activeRegion.w;
            cropCanvas.height = activeRegion.h;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(offCanvas, activeRegion.x, activeRegion.y, activeRegion.w, activeRegion.h, 0, 0, activeRegion.w, activeRegion.h);

            const processed = preprocessCanvas(offCanvas, activeRegion);
            if (previewCanvasRef.current) {
              const pCanvas = previewCanvasRef.current;
              pCanvas.width = processed.width;
              pCanvas.height = processed.height;
              pCanvas.getContext('2d').drawImage(processed, 0, 0);
            }

            addLog('📋 收到截圖，正在辨識...', 'info');
            try {
              const result = await recognizeExpCanvas(processed, isManualLevel ? level : null, cropCanvas);
              if (result && result.currentExp !== null) {
                handleExpUpdate(result.currentExp, result.rawPercent);
                const tag = result.isPixelMatch ? '💎 [點陣精準比對]' : '🔍 [OCR]';
                addLog(`${tag} 辨識成功: ${formatNumber(result.currentExp)} [${result.correctedPercent}%]`, 'success');
              } else {
                addLog(`未能在截圖中找到清晰的 EXP 文字 (${result?.rawText || ''})`, 'warn');
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

  // 🎮 啟動作業系統永遠置頂獨立懸浮小窗 (Document Picture-in-Picture)
  const togglePipWindow = async () => {
    if (isPipOpen && pipWindowRef.current) {
      pipWindowRef.current.close();
      return;
    }

    if ('documentPictureInPicture' in window) {
      try {
        const pip = await window.documentPictureInPicture.requestWindow({
          width: 340,
          height: 440,
        });
        pipWindowRef.current = pip;

        // 複製父頁面的所有 CSS 樣式到置頂小窗
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pip.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = styleSheet.href;
            pip.document.head.appendChild(link);
          }
        });

        // 建立 Portal 容器
        const container = pip.document.createElement('div');
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.background = '#0d111e';
        pip.document.body.style.margin = '0';
        pip.document.body.style.padding = '0';
        pip.document.body.appendChild(container);

        setPipContainer(container);
        setIsPipOpen(true);
        addLog('🎮 成功啟動 OS 永遠置頂獨立懸浮窗！可直接拖曳至遊戲視窗上方。', 'success');

        pip.addEventListener('pagehide', () => {
          setIsPipOpen(false);
          setPipContainer(null);
          pipWindowRef.current = null;
          addLog('置頂懸浮窗已關閉', 'info');
        });
      } catch (err) {
        console.error('PiP error:', err);
        addLog(`無法開啟置頂懸浮窗: ${err.message}`, 'warn');
      }
    } else {
      alert('您的瀏覽器尚未支援原生置頂畫中畫 (建議使用 Chrome 116+ 或 Edge)！已為您在目前分頁開啟可自由拖曳的懸浮窗模式。');
      setViewMode('compact');
    }
  };

  // 全域快捷鍵
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

  // 匯出戰報
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
            <span className="exp-version-pill">Web v1.1 點陣增強版</span>
          </div>
        </div>

        <div className="exp-top-actions">
          <button
            className="exp-btn exp-btn-primary"
            onClick={togglePipWindow}
            title="啟動永遠置頂 OS 懸浮窗，可直接拖曳到遊戲畫面正上方"
          >
            🎮 {isPipOpen ? '關閉置頂懸浮窗' : '遊戲置頂懸浮窗 (PiP)'}
          </button>

          <button
            className={`exp-btn ${viewMode === 'compact' ? 'exp-btn-primary' : 'exp-btn-glass'}`}
            onClick={() => setViewMode(viewMode === 'dashboard' ? 'compact' : 'dashboard')}
            title="快捷切換懸浮窗模式 (F9)"
          >
            {viewMode === 'dashboard' ? '📱 簡約懸浮模式 (F9)' : '🖥️ 儀表板模式 (F9)'}
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
          onAutoDetectExp={handleAutoDetectExp}
          onLaunchPip={togglePipWindow}
          isPipOpen={isPipOpen}
          previewCanvasRef={previewCanvasRef}
          zoomScale={zoomScale}
          setZoomScale={setZoomScale}
          cropRegion={cropRegion}
          onAdjustCrop={handleAdjustCrop}
          ocrLogs={ocrLogs}
        />
      )}

      {/* 模式 B：分頁內自由拖曳精簡懸浮模式 */}
      {viewMode === 'compact' && !isPipOpen && (
        <>
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8892b0' }}>
            <h2>🎮 精簡懸浮視窗已在畫面右下角開啟 (支援滑鼠按住拖曳)</h2>
            <p>可按住頂部標題列自由拖曳至畫面任一處；亦可點擊上方按鈕啟動「遊戲置頂懸浮窗 (PiP)」直接懸浮於遊戲上。</p>
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
            onLaunchPip={togglePipWindow}
          />
        </>
      )}

      {/* 作業系統級別 Always-on-Top 畫中畫懸浮窗 Portal */}
      {isPipOpen && pipContainer && createPortal(
        <ExpCompact
          trackingState={trackingState}
          currentExp={currentExp}
          rawPercent={rawPercent}
          correctedPercent={correctedPercent}
          level={level}
          stats={stats}
          onStartTracking={handleStartTracking}
          onStopTracking={handleStopTracking}
          onSwitchToDashboard={() => {
            if (pipWindowRef.current) pipWindowRef.current.close();
            setViewMode('dashboard');
          }}
          isPipWindow={true}
        />,
        pipContainer
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
          <span>PIKAPI GUILD TRACKER v16.3 / EXP HELPER WEB v1.1</span>
        </div>
      </div>
    </div>
  );
}
