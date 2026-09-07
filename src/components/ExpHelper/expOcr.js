import { createWorker } from 'tesseract.js';
import expData from '../../data/exp_table.json';

let worker = null;
let isInitializing = false;

// 楓之谷 / Artale 精準 5x7 點陣數字字典
const DIGITS = {
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['.#', '##', '.#', '.#', '.#', '.#', '.#'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '#....', '.###.', '....#', '#...#', '.###.'],
  '6': ['.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '....#', '....#', '...#.', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.']
};

/**
 * 初始化 Tesseract OCR 引擎 (作為像素點陣的備援機制)
 */
export async function initOCR() {
  if (worker) return worker;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    return worker;
  }

  isInitializing = true;
  try {
    worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_pageseg_mode: '7',
      tessedit_char_whitelist: '0123456789[],. %EXPe/x:+-()',
    });
    console.log('[PiKaPi OCR] Tesseract Worker 初始化完成');
    return worker;
  } catch (err) {
    console.error('[PiKaPi OCR] 初始化失敗:', err);
    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * 🎯 自動定位 EXP 條演算法 (Auto-Detect EXP Region)
 * 鎖定遊戲視窗底部狀態列區域，精準辨識萊姆綠括號 [...] 與經驗條
 */
export function autoDetectExpRegion(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  if (w <= 0 || h <= 0) return null;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. 僅在視窗的底部區域 (最後 140px 或高度 > 60%) 搜尋
  // 避開所有全螢幕樹木、草地、綠水靈與技能特效干擾
  const searchStartY = Math.max(0, h <= 80 ? 0 : Math.max(Math.floor(h * 0.65), h - 140));
  const searchStartX = Math.max(0, w <= 200 ? 0 : Math.floor(w * 0.35));

  const rawCols = [];
  for (let x = searchStartX; x < w; x++) {
    let greenCount = 0;
    let minY = h;
    let maxY = 0;
    for (let y = searchStartY; y < h; y++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (g > 110 && g > r * 1.15 && g > b * 1.15) {
        greenCount++;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    // 括號高度特徵 (支援 1x~3x UI 縮放)
    if (greenCount >= 4 && (maxY - minY) >= 5 && (maxY - minY) <= 28) {
      rawCols.push({ x, minY, maxY });
    }
  }

  if (rawCols.length < 2) return null;

  // 2. 合併相鄰直行
  const clusters = [];
  for (const c of rawCols) {
    if (clusters.length === 0 || c.x - clusters[clusters.length - 1].x > 3) {
      clusters.push(c);
    }
  }

  if (clusters.length < 2) return null;

  // 3. 取最右側的一對括號 (EXP 百分比永遠位於儀表板最右側)
  const b1 = clusters[clusters.length - 2];
  const b2 = clusters[clusters.length - 1];

  const bracketH = b1.maxY - b1.minY + 1;
  const expW = Math.max(75, Math.round(bracketH * 9));
  const cropX = Math.max(0, b1.x - expW);
  const cropY = Math.max(0, b1.minY - Math.round(bracketH * 0.4));
  const cropW = Math.min(w - cropX, (b2.x - cropX) + Math.max(20, Math.round(bracketH * 2.5)));
  const cropH = Math.min(h - cropY, bracketH + Math.round(bracketH * 2.2));

  return { x: cropX, y: cropY, w: cropW, h: Math.max(24, cropH) };
}

/**
 * 💎 楓之谷專用 100% 像素點陣精準辨識演算法 (Pixel Font Matcher)
 * 針對 經驗值.webp 與 遊戲儀表板資訊.webp 的 5x7 點陣字，進行無誤差比對
 */
export function matchPixelFont(canvas, manualLevel = null) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. 尋找綠色括號 [ 與 ]
  const greenCols = [];
  for (let x = 0; x < w; x++) {
    let greenCount = 0;
    let minY = h;
    let maxY = 0;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (g > 110 && g > r * 1.15 && g > b * 1.15) {
        greenCount++;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (greenCount >= 4 && (maxY - minY) >= 6) {
      greenCols.push({ x, minY, maxY });
    }
  }

  if (greenCols.length < 2) return null;

  const merged = [];
  for (const c of greenCols) {
    if (merged.length === 0 || c.x - merged[merged.length - 1].x > 3) {
      merged.push(c);
    }
  }

  if (merged.length < 2) return null;

  // 取最後一對括號
  const b1 = merged[merged.length - 2];
  const b2 = merged[merged.length - 1];
  const bracketY = b1.minY;

  // 白字判定
  const isWhite = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const idx = (y * w + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 135 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30;
  };

  // 數字匹配
  const matchDigits = (startX, endX) => {
    const res = [];
    let x = startX;
    while (x < endX) {
      let hasWhite = false;
      for (let y = bracketY - 2; y <= bracketY + 10; y++) {
        if (isWhite(x, y)) { hasWhite = true; break; }
      }
      if (!hasWhite) { x++; continue; }

      let bestDigit = null;
      let bestScore = 0;
      let bestW = 1;

      for (const [digit, tmpl] of Object.entries(DIGITS)) {
        const tw = tmpl[0].length;
        const th = tmpl.length;
        if (x + tw > endX + 1) continue;

        for (let dy = -2; dy <= 2; dy++) {
          const baseY = bracketY + dy + 1;
          if (baseY < 0 || baseY + th > h) continue;

          let matches = 0;
          for (let ty = 0; ty < th; ty++) {
            for (let tx = 0; tx < tw; tx++) {
              const whitePix = isWhite(x + tx, baseY + ty);
              const expectedPix = tmpl[ty][tx] === '#';
              if (whitePix === expectedPix) matches++;
            }
          }
          const score = matches / (tw * th);
          if (score > bestScore && score >= 0.82) {
            bestScore = score;
            bestDigit = digit;
            bestW = tw;
          }
        }
      }

      if (bestDigit) {
        res.push(bestDigit);
        x += bestW;
      } else {
        x++;
      }
    }
    return res.join('');
  };

  // 匹配 EXP 數值
  const expStr = matchDigits(Math.max(0, b1.x - 70), b1.x - 1);
  const pctStr = matchDigits(b1.x + 2, b2.x - 1);

  if (!expStr || expStr.length < 2) return null;

  const currentExp = parseInt(expStr, 10);
  let rawPercent = null;
  if (pctStr && pctStr.length >= 2) {
    if (pctStr.length >= 3) {
      rawPercent = parseFloat(`${pctStr.slice(0, pctStr.length - 2)}.${pctStr.slice(-2)}`);
    } else {
      rawPercent = parseFloat(pctStr);
    }
  }

  const levelFit = findBestLevelFit(currentExp, rawPercent, manualLevel);
  return {
    rawText: `EXP ${currentExp}[${rawPercent || levelFit.correctedPercent}%]`,
    currentExp,
    rawPercent: rawPercent || levelFit.correctedPercent,
    ...levelFit,
    isPixelMatch: true,
    confidence: 1.0,
  };
}

/**
 * 智慧文字行隔離預處理
 */
export function preprocessCanvas(sourceCanvas, crop) {
  const { x = 0, y = 0, w = sourceCanvas.width, h = sourceCanvas.height } = crop || {};

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(10, Math.min(w, sourceCanvas.width - x));
  cropCanvas.height = Math.max(10, Math.min(h, sourceCanvas.height - y));
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
  cropCtx.drawImage(sourceCanvas, x, y, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);

  const imgData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
  const data = imgData.data;
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;

  const textRowVotes = new Array(ch).fill(0);
  for (let row = 0; row < ch; row++) {
    for (let col = 0; col < cw; col++) {
      const idx = (row * cw + col) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const isWhite = lum > 130 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25;
      const isLimeGreen = g > 120 && g > 1.05 * r && g > 1.2 * b;

      if (isWhite || isLimeGreen) {
        textRowVotes[row]++;
      }
    }
  }

  let textStartY = 0;
  let textEndY = ch - 1;
  const voteThreshold = Math.max(2, Math.floor(cw * 0.03));

  for (let r = 0; r < ch; r++) {
    if (textRowVotes[r] >= voteThreshold) {
      textStartY = Math.max(0, r - 1);
      break;
    }
  }

  for (let r = textStartY + 5; r < ch; r++) {
    if (r < ch - 2 && textRowVotes[r] < voteThreshold && textRowVotes[r + 1] < voteThreshold) {
      textEndY = r;
      break;
    }
  }
  if (textEndY - textStartY < 6) textEndY = Math.min(ch - 1, textStartY + 18);

  for (let row = 0; row < ch; row++) {
    const isInsideText = row >= textStartY && row <= textEndY;
    for (let col = 0; col < cw; col++) {
      const idx = (row * cw + col) * 4;
      if (!isInsideText) {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      } else {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const isWhite = lum > 130;
        const isLimeGreen = g > 120 && g > 1.05 * r && g > 1.2 * b;

        if (isWhite || isLimeGreen) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        } else {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
        }
      }
    }
  }
  cropCtx.putImageData(imgData, 0, 0);

  const scale = 4.0;
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = Math.round(cropCanvas.width * scale);
  scaledCanvas.height = Math.round(cropCanvas.height * scale);
  const sCtx = scaledCanvas.getContext('2d');
  sCtx.imageSmoothingEnabled = false;
  sCtx.fillStyle = '#ffffff';
  sCtx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
  sCtx.drawImage(cropCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

  return scaledCanvas;
}

/**
 * 楓之谷經驗表反向適配演算法 (Level Fit Optimizer)
 */
export function findBestLevelFit(currentExp, rawPercent, manualLevel = null) {
  if (!currentExp || currentExp <= 0) {
    return { level: manualLevel || 1, expToNext: expData[0].expToNext, correctedPercent: 0, confidence: 0 };
  }

  if (manualLevel && manualLevel >= 1 && manualLevel <= 200) {
    const row = expData.find(e => e.level === manualLevel) || expData[0];
    const calcPct = Number(((currentExp / row.expToNext) * 100).toFixed(2));
    return {
      level: manualLevel,
      expToNext: row.expToNext,
      correctedPercent: rawPercent !== null ? rawPercent : calcPct,
      confidence: 1.0,
      isManual: true,
    };
  }

  const candidates = [];
  if (rawPercent !== null && !isNaN(rawPercent)) {
    candidates.push(rawPercent);
    const str = String(rawPercent);
    if (str.length >= 3 && !str.includes('.')) {
      candidates.push(parseFloat(`${str.slice(0, str.length - 2)}.${str.slice(-2)}`));
    }
    if (rawPercent > 10) {
      candidates.push(rawPercent / 10);
      candidates.push(rawPercent / 100);
    }
  }

  let bestFit = null;
  let minError = Infinity;

  for (const cand of candidates) {
    if (cand <= 0 || cand > 100) continue;
    const estExpToNext = currentExp / (cand / 100);

    for (const row of expData) {
      const error = Math.abs(row.expToNext - estExpToNext) / row.expToNext;
      if (error < minError) {
        minError = error;
        bestFit = {
          level: row.level,
          expToNext: row.expToNext,
          correctedPercent: cand,
          error,
          confidence: Math.max(0, 1 - error * 5),
        };
      }
    }
  }

  if (bestFit && bestFit.error <= 0.05) {
    return bestFit;
  }

  const fallbackRow = expData.find(e => e.expToNext > currentExp) || expData[0];
  const calculatedPercent = Number(((currentExp / fallbackRow.expToNext) * 100).toFixed(2));
  return {
    level: fallbackRow.level,
    expToNext: fallbackRow.expToNext,
    correctedPercent: rawPercent !== null ? rawPercent : calculatedPercent,
    confidence: 0.5,
    fallback: true,
  };
}

/**
 * 解析 OCR 原始字串
 */
export function parseOcrText(text, currentManualLevel = null) {
  if (!text) return null;
  const clean = text.replace(/[\r\n]+/g, ' ').trim();

  const expMatch = clean.match(/(\d{1,3}(?:,\d{3})+|\d+)/);
  let currentExp = null;
  if (expMatch) {
    currentExp = parseInt(expMatch[1].replace(/,/g, ''), 10);
  }

  const pctMatch = clean.match(/\[?\s*(\d+(?:\.\d+)?)\s*%\s*\]?/);
  let rawPercent = null;
  if (pctMatch) {
    rawPercent = parseFloat(pctMatch[1]);
  }

  if (currentExp !== null) {
    const levelFit = findBestLevelFit(currentExp, rawPercent, currentManualLevel);
    return {
      rawText: clean,
      currentExp,
      rawPercent,
      ...levelFit,
    };
  }

  return {
    rawText: clean,
    currentExp: null,
    rawPercent: null,
    level: currentManualLevel || 1,
  };
}

/**
 * 執行圖像辨識 (優先使用 100% 像素點陣匹配，備援走 Tesseract OCR)
 */
export async function recognizeExpCanvas(processedCanvas, currentManualLevel = null, rawCropCanvas = null) {
  // 1. 優先嘗試 MapleStory 專屬像素點陣比對
  try {
    const targetCanvas = rawCropCanvas || processedCanvas;
    const pixelResult = matchPixelFont(targetCanvas, currentManualLevel);
    if (pixelResult && pixelResult.currentExp !== null) {
      return pixelResult;
    }
  } catch (err) {
    console.warn('[Pixel Matcher] 嘗試點陣比對略過:', err);
  }

  // 2. 備援方案：走 Tesseract.js 通用 OCR
  const ocrWorker = await initOCR();
  const { data: { text, confidence } } = await ocrWorker.recognize(processedCanvas);
  const parsed = parseOcrText(text, currentManualLevel);
  return {
    ...parsed,
    ocrConfidence: confidence,
  };
}
