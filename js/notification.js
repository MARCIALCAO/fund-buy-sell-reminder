/**
 * 提醒与 14:00 定时巡检模块
 * 规则：每个交易日 14:00 精准定时抓取一次
 */

const FundNotification = {
  timerId: null,
  audioCtx: null,

  /**
   * 初始化 14:00 定时监控
   * @param {Function} onSnapshotTriggered 回调函数，执行行情抓取与信号判断
   */
  initScheduler(onSnapshotTriggered) {
    this._scheduleNext1400(onSnapshotTriggered);
    // 每分钟检查一次时间，以防手机休眠或页面隐藏唤醒后错过
    setInterval(() => {
      this._checkIf1400Needed(onSnapshotTriggered);
    }, 60000);
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
   * 检查今天 14:00 是否已经抓取过
   */
  hasSnapshotTakenToday() {
    const record = FundStorage.getSnapshotRecord();
    if (!record) return false;
    return record.date === this.getTodayDateString();
  },

  /**
   * 记录今天 14:00 抓取完成
   */
  markSnapshotTakenToday(results = {}) {
    FundStorage.saveSnapshotRecord({
      date: this.getTodayDateString(),
      timestamp: new Date().toISOString(),
      results: results
    });
  },

  /**
   * 计算距离今日或下个交易日 14:00 的毫秒数，并安排一次性定时器
   */
  _scheduleNext1400(onSnapshotTriggered) {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    const now = new Date();
    const todayStr = this.getTodayDateString(now);

    // 如果今天是交易日
    if (this.isTradingDay(now)) {
      const targetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0, 0);

      // 如果当前时间已经过了 14:00
      if (now.getTime() >= targetToday.getTime()) {
        // 如果今天尚未抓取过 14:00 估值，且在交易时段内（14:00-15:30），立即补抓一次
        if (!this.hasSnapshotTakenToday() && now.getHours() < 16) {
          console.log('[Notification] 今日已到 14:00 且尚未抓取，立即执行今日单次抓取');
          this._executeSnapshot(onSnapshotTriggered);
        }
        return;
      } else {
        // 今天还没到 14:00，设置精确定时器
        const delay = targetToday.getTime() - now.getTime();
        console.log(`[Notification] 已设定定时抓取：距离今天 14:00 还有 ${(delay / 1000 / 60).toFixed(1)} 分钟`);
        this.timerId = setTimeout(() => {
          this._executeSnapshot(onSnapshotTriggered);
        }, delay);
        return;
      }
    }
  },

  /**
   * 定期轮询检查（处理页面后台唤醒或跨越 14:00）
   */
  _checkIf1400Needed(onSnapshotTriggered) {
    const now = new Date();
    if (this.isTradingDay(now)) {
      if (now.getHours() === 14 && !this.hasSnapshotTakenToday()) {
        console.log('[Notification] 14:00 定时检查触发：执行今日单次抓取');
        this._executeSnapshot(onSnapshotTriggered);
      }
    }
  },

  /**
   * 执行 14:00 单次抓取
   */
  async _executeSnapshot(onSnapshotTriggered) {
    try {
      this.markSnapshotTakenToday();
      if (typeof onSnapshotTriggered === 'function') {
        await onSnapshotTriggered(true); // true 表示是由 14:00 定时巡检触发的
      }
    } catch (e) {
      console.error('[Notification] Snapshot execution failed:', e);
    }
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
