/**
 * 提醒与 14:00 定时巡检模块
 * 规则：每个交易日 14:00 精准定时抓取一次
 */

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
   * 判断今天是否为交易日（周一至周五）
   */
  isTradingDay(date = new Date()) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
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

window.FundNotification = FundNotification;
