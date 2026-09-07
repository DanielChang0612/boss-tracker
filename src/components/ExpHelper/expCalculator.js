/**
 * 格式化時間 (秒數轉為 HH:MM:SS)
 */
export function formatDuration(seconds) {
  const s = Math.floor(seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 格式化 ETA 倒數時間
 */
export function formatEta(seconds) {
  if (seconds === null || isNaN(seconds) || seconds === Infinity || seconds <= 0) {
    return '--:--';
  }
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 99) return '> 99小時';
  if (hrs > 0) {
    return `${hrs}時 ${String(mins).padStart(2, '0')}分`;
  }
  return `${String(mins).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 格式化帶逗號的數字
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Math.round(num).toLocaleString('zh-TW');
}

/**
 * 實時動態速率引擎 (Real-time Pace Engine)
 */
export function calculatePaceStats({
  startTime,
  pausedDuration = 0,
  baseExp,
  currentExp,
  expToNext,
  now = Date.now(),
}) {
  if (!startTime || currentExp === null || baseExp === null) {
    return {
      elapsedSeconds: 0,
      gainedExp: 0,
      gainedPercent: 0,
      expPerMin: 0,
      est10Min: 0,
      est60Min: 0,
      remainingExp: expToNext ? Math.max(0, expToNext - (currentExp || 0)) : 0,
      etaSeconds: null,
    };
  }

  const elapsedMs = Math.max(0, now - startTime - pausedDuration);
  const elapsedSeconds = Math.max(1, Math.floor(elapsedMs / 1000));
  const gainedExp = Math.max(0, currentExp - baseExp);
  const gainedPercent = expToNext > 0 ? (gainedExp / expToNext) * 100 : 0;

  // 每分鐘獲得 EXP
  const expPerMin = (gainedExp / elapsedSeconds) * 60;
  const est10Min = expPerMin * 10;
  const est60Min = expPerMin * 60;

  const remainingExp = expToNext ? Math.max(0, expToNext - currentExp) : 0;
  const etaSeconds = expPerMin > 0 ? (remainingExp / (expPerMin / 60)) : null;

  return {
    elapsedSeconds,
    gainedExp,
    gainedPercent,
    expPerMin,
    est10Min,
    est60Min,
    remainingExp,
    etaSeconds,
  };
}
