import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * 🎯 視窗取景器與滑鼠拖曳框選元件 (Interactive Game Viewfinder)
 * 允許使用者在分享的遊戲視窗畫面上，直接以滑鼠按住拖曳拉出經驗值辨識範圍
 */
export default function ExpViewfinder({
  videoRef,
  isScreenSharing,
  cropRegion,
  onCropChange,
  previewCanvasRef,
  lastOcrResult,
  onAutoDetect,
  zoomScale,
  setZoomScale,
  onAdjustCrop,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // 拖曳狀態管理
  const [dragState, setDragState] = useState({
    isDragging: false,
    mode: null, // 'create' | 'move' | 'resize'
    resizeHandle: null, // 'tl' | 'tr' | 'bl' | 'br'
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    initialBox: null,
  });

  // 取得真實視訊或影像尺寸
  const getVideoDimensions = useCallback(() => {
    const video = videoRef?.current;
    if (video && video.videoWidth && video.videoHeight) {
      return { width: video.videoWidth, height: video.videoHeight };
    }
    return { width: 800, height: 600 };
  }, [videoRef]);

  // 座標轉換：真實影片座標 ➔ 畫布顯示座標
  const toCanvasCoords = useCallback((realCrop, canvasW, canvasH) => {
    const { width: vidW, height: vidH } = getVideoDimensions();
    const scaleX = canvasW / vidW;
    const scaleY = canvasH / vidH;
    return {
      x: realCrop.x * scaleX,
      y: realCrop.y * scaleY,
      w: realCrop.w * scaleX,
      h: realCrop.h * scaleY,
    };
  }, [getVideoDimensions]);

  // 座標轉換：畫布顯示座標 ➔ 真實影片座標
  const toVideoCoords = useCallback((canvasBox, canvasW, canvasH) => {
    const { width: vidW, height: vidH } = getVideoDimensions();
    const scaleX = vidW / canvasW;
    const scaleY = vidH / canvasH;
    return {
      x: Math.round(Math.max(0, canvasBox.x * scaleX)),
      y: Math.round(Math.max(0, canvasBox.y * scaleY)),
      w: Math.round(Math.min(vidW - (canvasBox.x * scaleX), Math.max(10, canvasBox.w * scaleX))),
      h: Math.round(Math.min(vidH - (canvasBox.y * scaleY), Math.max(6, canvasBox.h * scaleY))),
    };
  }, [getVideoDimensions]);

  // 繪製取景器 Canvas (包含遊戲畫面、半透明遮罩、發光選取框與控制把手)
  const drawViewfinder = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const video = videoRef?.current;

    const cw = canvas.width;
    const ch = canvas.height;

    // 1. 繪製背景底圖 (即時視訊串流)
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      ctx.drawImage(video, 0, 0, cw, ch);
    } else {
      // 未啟動串流時的質感待機畫面
      ctx.fillStyle = '#0a0d18';
      ctx.fillRect(0, 0, cw, ch);

      // 格線裝飾
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < cw; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
        ctx.stroke();
      }
      for (let y = 0; y < ch; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('請先點擊上方「🖥️ 選擇遊戲視窗」啟動串流', cw / 2, ch / 2 - 10);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = 'rgba(0, 229, 255, 0.6)';
      ctx.fillText('啟動後即可直接在此畫面上拖曳拉出選取框', cw / 2, ch / 2 + 18);
      return;
    }

    // 2. 計算當前選取框在畫布上的位置
    let box = null;
    if (dragState.isDragging && dragState.mode === 'create') {
      const minX = Math.min(dragState.startX, dragState.currentX);
      const minY = Math.min(dragState.startY, dragState.currentY);
      const w = Math.abs(dragState.currentX - dragState.startX);
      const h = Math.abs(dragState.currentY - dragState.startY);
      box = { x: minX, y: minY, w, h };
    } else {
      box = toCanvasCoords(cropRegion, cw, ch);
    }

    // 3. 繪製半透明暗色遮罩 (Highlight 內部選取區)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    // 上
    ctx.fillRect(0, 0, cw, Math.max(0, box.y));
    // 下
    ctx.fillRect(0, box.y + box.h, cw, Math.max(0, ch - (box.y + box.h)));
    // 左
    ctx.fillRect(0, box.y, Math.max(0, box.x), box.h);
    // 右
    ctx.fillRect(box.x + box.w, box.y, Math.max(0, cw - (box.x + box.w)), box.h);

    // 4. 繪製選取框邊框 (霓虹青光 + 虛線框)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]); // 重設虛線

    // 邊角發光強化
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 3;
    const cornerSize = Math.min(12, Math.min(box.w / 3, box.h / 3));
    // 左上
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + cornerSize);
    ctx.lineTo(box.x, box.y);
    ctx.lineTo(box.x + cornerSize, box.y);
    ctx.stroke();
    // 右上
    ctx.beginPath();
    ctx.moveTo(box.x + box.w - cornerSize, box.y);
    ctx.lineTo(box.x + box.w, box.y);
    ctx.lineTo(box.x + box.w, box.y + cornerSize);
    ctx.stroke();
    // 左下
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.h - cornerSize);
    ctx.lineTo(box.x, box.y + box.h);
    ctx.lineTo(box.x + cornerSize, box.y + box.h);
    ctx.stroke();
    // 右下
    ctx.beginPath();
    ctx.moveTo(box.x + box.w - cornerSize, box.y + box.h);
    ctx.lineTo(box.x + box.w, box.y + box.h);
    ctx.lineTo(box.x + box.w, box.y + box.h - cornerSize);
    ctx.stroke();

    // 5. 繪製 4 角可拖拉控制把手 (Handles)
    const handleRadius = 4.5;
    const drawHandle = (hx, hy) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    drawHandle(box.x, box.y);
    drawHandle(box.x + box.w, box.y);
    drawHandle(box.x, box.y + box.h);
    drawHandle(box.x + box.w, box.y + box.h);

    // 6. 頂部浮動座標標籤
    const tagText = `🎯 EXP 偵測區 [${Math.round(cropRegion.w)}×${Math.round(cropRegion.h)}]`;
    ctx.font = 'bold 11px Inter, sans-serif';
    const tagWidth = ctx.measureText(tagText).width + 16;
    const tagX = Math.max(4, Math.min(cw - tagWidth - 4, box.x));
    const tagY = box.y > 24 ? box.y - 6 : box.y + box.h + 18;

    ctx.fillStyle = 'rgba(0, 229, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY - 14, tagWidth, 18, 5);
    ctx.fill();

    ctx.fillStyle = '#031422';
    ctx.textAlign = 'left';
    ctx.fillText(tagText, tagX + 8, tagY);
  }, [cropRegion, dragState, toCanvasCoords, videoRef]);

  // 動畫循環：持續繪製視訊取景器
  useEffect(() => {
    let isRunning = true;
    const loop = () => {
      if (!isRunning) return;
      drawViewfinder();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawViewfinder]);

  // 更新畫布解析度以吻合容器尺寸
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const { width: vidW, height: vidH } = getVideoDimensions();
      const aspect = vidW / vidH;

      const cw = rect.width;
      const ch = Math.round(cw / aspect);

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = Math.max(220, ch);
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [getVideoDimensions]);

  // 取得滑鼠在畫布上的座標
  const getCanvasMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  // 判斷滑鼠是否點在把手上
  const getHandleAtPos = (pos, box) => {
    const threshold = 12;
    if (Math.hypot(pos.x - box.x, pos.y - box.y) < threshold) return 'tl';
    if (Math.hypot(pos.x - (box.x + box.w), pos.y - box.y) < threshold) return 'tr';
    if (Math.hypot(pos.x - box.x, pos.y - (box.y + box.h)) < threshold) return 'bl';
    if (Math.hypot(pos.x - (box.x + box.w), pos.y - (box.y + box.h)) < threshold) return 'br';
    return null;
  };

  // 滑鼠按下：開始拖曳
  const handleMouseDown = (e) => {
    if (!isScreenSharing) return;
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentBox = toCanvasCoords(cropRegion, canvas.width, canvas.height);
    const handle = getHandleAtPos(pos, currentBox);

    if (handle) {
      // 點在角把手上 ➔ 進入 resize 模式
      setDragState({
        isDragging: true,
        mode: 'resize',
        resizeHandle: handle,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        initialBox: { ...currentBox },
      });
    } else if (
      pos.x >= currentBox.x &&
      pos.x <= currentBox.x + currentBox.w &&
      pos.y >= currentBox.y &&
      pos.y <= currentBox.y + currentBox.h
    ) {
      // 點在現有選取框內部 ➔ 進入平移 (move) 模式
      setDragState({
        isDragging: true,
        mode: 'move',
        resizeHandle: null,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        initialBox: { ...currentBox },
      });
    } else {
      // 點在選取框外部 ➔ 重新拉一個新的選取框 (create 模式)
      setDragState({
        isDragging: true,
        mode: 'create',
        resizeHandle: null,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        initialBox: null,
      });
    }
  };

  // 滑鼠移動：更新拖曳狀態與游標樣式
  const handleMouseMove = (e) => {
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!dragState.isDragging) {
      // 更新 Hover 游標
      const currentBox = toCanvasCoords(cropRegion, canvas.width, canvas.height);
      const handle = getHandleAtPos(pos, currentBox);
      if (handle === 'tl' || handle === 'br') {
        canvas.style.cursor = 'nwse-resize';
      } else if (handle === 'tr' || handle === 'bl') {
        canvas.style.cursor = 'nesw-resize';
      } else if (
        pos.x >= currentBox.x &&
        pos.x <= currentBox.x + currentBox.w &&
        pos.y >= currentBox.y &&
        pos.y <= currentBox.y + currentBox.h
      ) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'crosshair';
      }
      return;
    }

    // 正在拖曳中
    setDragState((prev) => ({
      ...prev,
      currentX: pos.x,
      currentY: pos.y,
    }));

    if (dragState.mode === 'move' && dragState.initialBox) {
      const dx = pos.x - dragState.startX;
      const dy = pos.y - dragState.startY;
      const newBox = {
        x: Math.max(0, Math.min(canvas.width - dragState.initialBox.w, dragState.initialBox.x + dx)),
        y: Math.max(0, Math.min(canvas.height - dragState.initialBox.h, dragState.initialBox.y + dy)),
        w: dragState.initialBox.w,
        h: dragState.initialBox.h,
      };
      const videoCoords = toVideoCoords(newBox, canvas.width, canvas.height);
      onCropChange(videoCoords);
    } else if (dragState.mode === 'resize' && dragState.initialBox) {
      const { initialBox, resizeHandle } = dragState;
      let newBox = { ...initialBox };
      if (resizeHandle === 'br') {
        newBox.w = Math.max(20, pos.x - initialBox.x);
        newBox.h = Math.max(12, pos.y - initialBox.y);
      } else if (resizeHandle === 'bl') {
        const right = initialBox.x + initialBox.w;
        newBox.x = Math.min(right - 20, pos.x);
        newBox.w = right - newBox.x;
        newBox.h = Math.max(12, pos.y - initialBox.y);
      } else if (resizeHandle === 'tr') {
        const bottom = initialBox.y + initialBox.h;
        newBox.y = Math.min(bottom - 12, pos.y);
        newBox.h = bottom - newBox.y;
        newBox.w = Math.max(20, pos.x - initialBox.x);
      } else if (resizeHandle === 'tl') {
        const right = initialBox.x + initialBox.w;
        const bottom = initialBox.y + initialBox.h;
        newBox.x = Math.min(right - 20, pos.x);
        newBox.y = Math.min(bottom - 12, pos.y);
        newBox.w = right - newBox.x;
        newBox.h = bottom - newBox.y;
      }
      const videoCoords = toVideoCoords(newBox, canvas.width, canvas.height);
      onCropChange(videoCoords);
    }
  };

  // 滑鼠放開：完成拖曳並將座標回傳
  const handleMouseUp = () => {
    if (!dragState.isDragging) return;
    const canvas = canvasRef.current;

    if (dragState.mode === 'create' && canvas) {
      const minX = Math.min(dragState.startX, dragState.currentX);
      const minY = Math.min(dragState.startY, dragState.currentY);
      const w = Math.abs(dragState.currentX - dragState.startX);
      const h = Math.abs(dragState.currentY - dragState.startY);

      // 只要寬度大於 15px 且高度大於 8px，視為有效選取
      if (w > 15 && h > 8) {
        const videoCoords = toVideoCoords({ x: minX, y: minY, w, h }, canvas.width, canvas.height);
        onCropChange(videoCoords);
      }
    }

    setDragState({
      isDragging: false,
      mode: null,
      resizeHandle: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      initialBox: null,
    });
  };

  // 快捷對位：快速移動到遊戲右下角 (楓之谷標準經驗值條常見位置)
  const handleSnapToBottomRight = () => {
    const { width: vidW, height: vidH } = getVideoDimensions();
    const boxW = Math.round(Math.min(220, vidW * 0.3));
    const boxH = Math.round(Math.min(36, vidH * 0.08));
    const boxX = Math.round(vidW - boxW - (vidW * 0.04));
    const boxY = Math.round(vidH - boxH - (vidH * 0.015));

    onCropChange({
      x: Math.max(0, boxX),
      y: Math.max(0, boxY),
      w: boxW,
      h: boxH,
    });
  };

  return (
    <div className="viewfinder-wrapper" ref={containerRef}>
      {/* 取景器頂部提示列 */}
      <div className="viewfinder-header-row">
        <div className="viewfinder-title">
          <span>🎯</span> 畫面取景器 (直接在畫面上拖曳拉出經驗值範圍)
        </div>
        <div className="viewfinder-actions">
          <button
            className="exp-btn-glass"
            style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '6px' }}
            onClick={handleSnapToBottomRight}
            title="將選取框自動放置於畫面右下角 (楓之谷經驗條常見位置)"
          >
            📍 貼齊右下角
          </button>
          <button
            className="exp-btn-glass"
            style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '6px', color: '#00e676' }}
            onClick={onAutoDetect}
            title="利用綠色括號特徵自動偵測 EXP 座標"
          >
            🎯 智慧偵測
          </button>
        </div>
      </div>

      {/* 互動式 Canvas：支援滑鼠直接拖曳框選 */}
      <div className="viewfinder-canvas-container">
        <canvas
          ref={canvasRef}
          className="viewfinder-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
        <div className="viewfinder-hint-floating">
          <span>🖱️ 提示：按住滑鼠左鍵可重新拉框，點擊框內可移動位置，拖拉四角把手可縮放</span>
        </div>
      </div>

      {/* 底部特寫放大鏡 (Magnifier) 與即時辨識回饋 */}
      <div className="viewfinder-detail-bar">
        {/* 左側：放大鏡特寫 Canvas */}
        <div className="magnifier-box">
          <div className="magnifier-label">
            <span>🔍</span> 框選特寫 (放大鏡)
            <div className="zoom-chips-mini">
              {[1.5, 2.0, 2.5].map((s) => (
                <button
                  key={s}
                  className={`zoom-chip-mini ${zoomScale === s ? 'active' : ''}`}
                  onClick={() => setZoomScale(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <div className="magnifier-viewport">
            <canvas
              ref={previewCanvasRef}
              className="magnifier-canvas"
              style={{ transform: `scale(${zoomScale})` }}
            />
          </div>
        </div>

        {/* 右側：即時辨識狀態回饋卡片 */}
        <div className="ocr-feedback-card">
          <div className="feedback-status-title">即時解析狀態</div>
          {lastOcrResult && lastOcrResult.currentExp !== null ? (
            <div className="feedback-success">
              <div className="feedback-badge-row">
                <span className="feedback-glow-dot"></span>
                <span className="feedback-highlight">
                  {lastOcrResult.isPixelMatch ? '💎 點陣精準鎖定' : '🔍 OCR 辨識成功'}
                </span>
                <span className="feedback-level">Lv.{lastOcrResult.level}</span>
              </div>
              <div className="feedback-numbers">
                EXP: <b>{lastOcrResult.currentExp?.toLocaleString()}</b>
                <span className="feedback-pct">[{lastOcrResult.correctedPercent ?? lastOcrResult.rawPercent ?? '0.00'}%]</span>
              </div>
            </div>
          ) : (
            <div className="feedback-pending">
              <span className="feedback-spinner">⏳</span>
              <span>請在上方畫面上拖曳青色選取框，對準遊戲右下角「EXP 與百分比」</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
