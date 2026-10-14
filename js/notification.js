/**
 * 节假日与 A 股/基金交易日历管理模块
 * 特性：内置 2025/2026 法定休市日历（离线秒开），同时后台静默向公共接口同步更新并持久化至 localStorage
 */
const FundHoliday = {
  API_URL: 'https://timor.tech/api/holiday/year/',

  // 内置 2026 年法定休市日历（即使完全离线或断网也能精准避开所有法定节假日）
  PRESET_HOLIDAYS: {
    '2026': [
      '2026-01-01','2026-01-02','2026-01-03','2026-02-15','2026-02-16','2026-02-17','2026-02-18',
      '2026-02-19','2026-02-20','2026-02-21','2026-02-22','2026-02-23','2026-04-04','2026-04-05',
      '2026-04-06','2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05','2026-06-19',
      '2026-06-20','2026-06-21','2026-09-25','2026-09-26','2026-09-27','2026-10-01','2026-10-02',
      '2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07'
    ]
  },

  /**
   * 格式化 Date 为 YYYY-MM-DD
   */
  formatDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /**
   * 获取指定年份的法定节假日列表（优先 localStorage，兜底内置预置）
   */
  getYearHolidays(year) {
    const key = `fund_pyramid_holidays_${year}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return this.PRESET_HOLIDAYS[String(year)] || [];
  },

  /**
   * 判断某一天是否为法定节假日（非交易日）
   */
  isHoliday(date = new Date()) {
    const dStr = this.formatDate(date);
    const year = dStr.slice(0, 4);
    const list = this.getYearHolidays(year);
    return list.includes(dStr);
  },

  /**
   * 判断某一天是否为 A 股/基金交易日（周一至周五 且 非法定节假日）
   * 注：国内即便在法定调休上班的周末（周六/周日），证券基金市场依然统一闭市，故周末一律为 false
   */
  isTradingDay(date = new Date()) {
    const day = date.getDay();
    if (day === 0 || day === 6) return false;
    return !this.isHoliday(date);
  },

  /**
   * 精确计算下一个交易日开盘时刻（Date 对象）
   * 自动跨越周末、小长假（如3天端午/中秋）及长假（如7天国庆/春节）
   */
  getNextTradingDayOpen(now = new Date()) {
    const curSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const morningOpen = 9 * 3600 + 30 * 60;   // 09:30:00
    const morningClose = 11 * 3600 + 30 * 60; // 11:30:00
    const afternoonOpen = 13 * 3600;          // 13:00:00

    if (this.isTradingDay(now)) {
      if (curSec < morningOpen) {
        const target = new Date(now.getTime());
        target.setHours(9, 30, 0, 0);
        return target;
      }
      if (curSec >= morningClose && curSec < afternoonOpen) {
        const target = new Date(now.getTime());
        target.setHours(13, 0, 0, 0);
        return target;
      }
    }

    // 搜索未来最近的一个交易日 09:30
    const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0, 0);
    cur.setDate(cur.getDate() + 1);
    while (!this.isTradingDay(cur)) {
      cur.setDate(cur.getDate() + 1);
    }
    return cur;
  },

  /**
   * 自动在后台静默同步当前年份（及下一年度）的节假日日历
   */
  async autoSyncHolidays() {
    const now = new Date();
    const curYear = now.getFullYear();
    const key = `fund_pyramid_holidays_${curYear}`;

    // 如果当年尚未在本地缓存，或已超过 30 天，则静默更新
    const lastSyncTime = parseInt(localStorage.getItem(`fund_pyramid_holidays_sync_${curYear}`) || '0', 10);
    const nowMs = Date.now();
    const oneMonthMs = 30 * 24 * 3600 * 1000;

    if (!localStorage.getItem(key) || (nowMs - lastSyncTime > oneMonthMs)) {
      await this.fetchAndCacheYear(curYear);
    }

    // 如果到了年底 11 月之后，尝试预同步下一年度日历
    if (now.getMonth() >= 10) {
      const nextYear = curYear + 1;
      const nextKey = `fund_pyramid_holidays_${nextYear}`;
      if (!localStorage.getItem(nextKey)) {
        await this.fetchAndCacheYear(nextYear);
      }
    }
  },

  /**
   * 从公共节假日 API 抓取指定年份并写入 localStorage
   */
  async fetchAndCacheYear(year) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${this.API_URL}${year}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timer);

      if (!res.ok) return;
      const data = await res.json();
      if (data && data.code === 0 && data.holiday) {
        const holidayList = [];
        for (const [k, v] of Object.entries(data.holiday)) {
          if (v && v.holiday === true) {
            const dateStr = v.date || `${year}-${k}`;
            holidayList.push(dateStr);
          }
        }
        if (holidayList.length > 0) {
          localStorage.setItem(`fund_pyramid_holidays_${year}`, JSON.stringify(holidayList.sort()));
          localStorage.setItem(`fund_pyramid_holidays_sync_${year}`, String(Date.now()));
          console.log(`[FundHoliday] 成功同步 ${year} 年法定节假日 (${holidayList.length} 天)`);
        }
      }
    } catch (e) {
      console.warn(`[FundHoliday] 静默同步 ${year} 节假日异常 (已自动降级内置日历):`, e.message);
    }
  }
};

const FundNotification = {
  timerId: null,
  audioCtx: null,

  /**
   * 初始化通知调度器（已升级为14:00后首次打开应用按需提醒，无需后台常驻定时器）
   */
  initScheduler(onSnapshotTriggered) {
    // 兼容保留接口，已无需后台强制定时抓取
  },

  /**
   * 判断今天是否为交易日（周一至周五 且 非法定节假日）
   */
  isTradingDay(date = new Date()) {
    return FundHoliday.isTradingDay(date);
  },

  /**
   * 获取今日日期字符串 YYYY-MM-DD
   */
  getTodayDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /**
   * 检查今天 14:00 之后是否已经弹出过交易点预警 Notification
   */
  hasNotifiedToday() {
    try {
      const record = localStorage.getItem('fund_pyramid_notified_today');
      return record === this.getTodayDateString();
    } catch (e) {
      return false;
    }
  },

  /**
   * 记录今天已发送过 14:00 后的首访交易点预警 Notification
   */
  markNotifiedToday() {
    try {
      localStorage.setItem('fund_pyramid_notified_today', this.getTodayDateString());
    } catch (e) {
      console.error('[Notification] Failed to save notified state:', e);
    }
  },

  /**
   * 检查今天 14:00 是否已经抓取过 (兼容旧数据)
   */
  hasSnapshotTakenToday() {
    const record = FundStorage.getSnapshotRecord();
    if (!record) return false;
    return record.date === this.getTodayDateString();
  },

  /**
   * 记录今天 14:00 抓取完成 (兼容旧数据)
   */
  markSnapshotTakenToday(results = {}) {
    FundStorage.saveSnapshotRecord({
      date: this.getTodayDateString(),
      timestamp: new Date().toISOString(),
      results: results
    });
  },

  /**
   * 请求系统通知权限
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('当前浏览器不支持系统通知');
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
    return false;
  },

  /**
   * 触发系统 Notification 弹窗
   */
  sendSystemNotification(title, body, tag = 'fund-alert') {
    const settings = FundStorage.getSettings();
    if (!settings.notifyEnabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: tag,
          vibrate: [200, 100, 200]
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn('[Notification] Failed to show Notification:', e);
      }
    }
  },

  /**
   * 播放清脆的买卖提醒提示音（Web Audio API 原生合成音，零外链延迟）
   */
  playChime(type = 'buy') {
    const settings = FundStorage.getSettings();
    if (!settings.soundEnabled) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'buy') {
        // 买入信号：向上清脆和弦 (523Hz -> 659Hz -> 784Hz / C5 -> E5 -> G5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(784.0, now + 0.3);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.start(now);
        osc.stop(now + 0.5);
      } else {
        // 卖出/止盈信号：清亮双音
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.25);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {
      console.warn('[Notification] Audio play failed:', e);
    }
  }
};

window.FundHoliday = FundHoliday;
window.FundNotification = FundNotification;
