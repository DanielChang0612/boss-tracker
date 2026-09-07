import { createWorker } from 'tesseract.js';
import expData from '../../data/exp_table.json';

let worker = null;
let isInitializing = false;

/**
 * 初始化 Tesseract OCR 引擎 (單一實例保持活化)
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
      tessedit_pageseg_mode: '7', // 單行文字模式 PSM 7
      tessedit_char_whitelist: '0123456789[],. %EXPe/x:+-()', // 白名單字符
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
 * ① 智慧型文字行隔離演算法 (Smart Text-Row Isolation)
 * - 依色彩特徵掃描白字與萊姆綠百分比
 * - 自動定位文字上下邊界，100% 抹除下方經驗進度條
 * - 4.0 倍像素放大與銳化黑白二值化
 */
export function preprocessCanvas(sourceCanvas, crop) {
  const { x = 0, y = 0, w = sourceCanvas.width, h = sourceCanvas.height } = crop || {};

  // 1. 建立裁切暫存 Canvas
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(10, Math.min(w, sourceCanvas.width - x));
  cropCanvas.height = Math.max(10, Math.min(h, sourceCanvas.height - y));
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
  cropCtx.drawImage(sourceCanvas, x, y, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);

  const imgData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
  const data = imgData.data;
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;

  // 2. 逐行掃描字元特徵，定位文字邊界
  const textRowVotes = new Array(ch).fill(0);
  for (let row = 0; row < ch; row++) {
    for (let col = 0; col < cw; col++) {
      const idx = (row * cw + col) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // 白字判定: Y = 0.299R + 0.587G + 0.114B > 130
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const isWhite = lum > 130 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25;

      // 萊姆綠括號與百分比判定: G > 130 且 G > 1.05R 且 G > 1.2B
      const isLimeGreen = g > 120 && g > 1.05 * r && g > 1.2 * b;

      if (isWhite || isLimeGreen) {
        textRowVotes[row]++;
      }
    }
  }

  // 找出文字開始行與結束行
  let textStartY = 0;
  let textEndY = ch - 1;
  const voteThreshold = Math.max(2, Math.floor(cw * 0.03));

  for (let r = 0; r < ch; r++) {
    if (textRowVotes[r] >= voteThreshold) {
      textStartY = Math.max(0, r - 1);
      break;
    }
  }

  // 從下方往上找文字結束（避免進度條被計入）
  for (let r = textStartY + 5; r < ch; r++) {
    // 若連續 2 行投票數極低，且距離上方已有文字高度，視為文字區結束
    if (r < ch - 2 && textRowVotes[r] < voteThreshold && textRowVotes[r + 1] < voteThreshold) {
      textEndY = r;
      break;
    }
  }
  // 確保文字高度合理 (大約 8 ~ 25px)
  if (textEndY - textStartY < 6) textEndY = Math.min(ch - 1, textStartY + 18);

  // 3. 抹除文字邊界以外（特別是下方進度條塗純白）
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

        // 二值化: 文字變純黑，背景純白 (Tesseract 最喜愛的高對比)
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

  // 4. 4.0 倍像素放大與銳化
  const scale = 4.0;
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = Math.round(cropCanvas.width * scale);
  scaledCanvas.height = Math.round(cropCanvas.height * scale);
  const sCtx = scaledCanvas.getContext('2d');
  sCtx.imageSmoothingEnabled = false; // 點陣銳化
  sCtx.fillStyle = '#ffffff';
  sCtx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
  sCtx.drawImage(cropCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

  return scaledCanvas;
}

/**
 * ② 楓之谷經驗表反向適配演算法 (Level Fit Optimizer)
 * 解決 1px 小數點遺漏問題 (例如 7.56% 誤讀為 75.6% 或 75.61%)
 */
export function findBestLevelFit(currentExp, rawPercent, manualLevel = null) {
  if (!currentExp || currentExp <= 0) {
    return { level: manualLevel || 1, expToNext: expData[0].expToNext, correctedPercent: 0, confidence: 0 };
  }

  // 如果使用者手動指定了等級
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

  // 自動推估所有可能的百分比候選
  const candidates = [];
  if (rawPercent !== null && !isNaN(rawPercent)) {
    candidates.push(rawPercent);
    // 常見 OCR 誤讀校正：75.6 -> 7.56, 75.61 -> 7.56
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

  // 若比對誤差在 5% 以內，視為高信度匹配成功
  if (bestFit && bestFit.error <= 0.05) {
    return bestFit;
  }

  // 如果未能高信度匹配，嘗試直接由 currentExp 估計大概等級
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

  // 嘗試匹配 EXP [XX.XX%] 或 53,658 [7.56%] 等
  // 匹配數字 (含逗號)
  const expMatch = clean.match(/(\d{1,3}(?:,\d{3})+|\d+)/);
  let currentExp = null;
  if (expMatch) {
    currentExp = parseInt(expMatch[1].replace(/,/g, ''), 10);
  }

  // 匹配百分比 [7.56%] 或 7.56% 或 (7.56%)
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
 * 執行一次圖像辨識
 */
export async function recognizeExpCanvas(processedCanvas, currentManualLevel = null) {
  const ocrWorker = await initOCR();
  const { data: { text, confidence } } = await ocrWorker.recognize(processedCanvas);
  const parsed = parseOcrText(text, currentManualLevel);
  return {
    ...parsed,
    ocrConfidence: confidence,
  };
}
