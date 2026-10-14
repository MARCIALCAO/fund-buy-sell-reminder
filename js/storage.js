/**
 * 数据存储模块：负责 LocalStorage 持久化与 JSON 导入/导出
 */

const FundStorage = {
  KEYS: {
    FUNDS: 'fund_pyramid_portfolio_v1',
    SETTINGS: 'fund_pyramid_settings_v1',
    SNAPSHOT: 'fund_pyramid_snapshot_v1'
  },

  DEFAULT_SETTINGS: {
    colorMode: 'cn', // 'cn' (红涨绿跌) | 'intl' (绿涨红跌)
    theme: 'dark', // 'dark' (深邃暗黑磨砂玻璃) | 'light' (通透清新浅色)
    soundEnabled: true,
    notifyEnabled: true,
    snapshotHour: 14,
    snapshotMinute: 0
  },

  DEMO_FUNDS: [
    {
      id: 'fund_demo_161725',
      code: '161725',
      name: '招商中证白酒指数(LOF)A',
      shares: 18921.48,
      totalCost: 10000,
      avgCost: 0.5285,
      initialCost: 0.5285,
      lastTradePrice: 0.5285,
      plannedAmount: 15000,
      anchorMode: 'initialCost',
      stepPercent: 5,
      tiers: [
        { step: 1, percent: 5, buyRatio: 10, sellRatio: 10 },
        { step: 2, percent: 10, buyRatio: 20, sellRatio: 20 },
        { step: 3, percent: 15, buyRatio: 30, sellRatio: 30 },
        { step: 4, percent: 20, buyRatio: 40, sellRatio: 40 }
      ],
      createdAt: new Date().toISOString(),
      trades: [
        {
          id: 'trade_demo_1',
          type: 'init',
          date: '2026-10-01',
          amount: 10000,
          shares: 18921.48,
          price: 0.5285,
          remark: '初始买入建仓'
        }
      ]
    },
    {
      id: 'fund_demo_001632',
      code: '001632',
      name: '天弘中证食品饮料ETF联接C',
      shares: 5548.16,
      totalCost: 10000,
      avgCost: 1.8024,
      initialCost: 1.8024,
      lastTradePrice: 1.8024,
      plannedAmount: 12000,
      anchorMode: 'initialCost',
      stepPercent: 5,
      tiers: [
        { step: 1, percent: 5, buyRatio: 10, sellRatio: 10 },
        { step: 2, percent: 10, buyRatio: 20, sellRatio: 20 },
        { step: 3, percent: 15, buyRatio: 30, sellRatio: 30 },
        { step: 4, percent: 20, buyRatio: 40, sellRatio: 40 }
      ],
      createdAt: new Date().toISOString(),
      trades: [
        {
          id: 'trade_demo_2',
          type: 'init',
          date: '2026-10-08',
          amount: 10000,
          shares: 5548.16,
          price: 1.8024,
          remark: '初始建仓'
        }
      ]
    }
  ],

  getFunds() {
    try {
      const raw = localStorage.getItem(this.KEYS.FUNDS);
      if (!raw) {
        // 初始为空，由用户自行添加或主动点击载入示例
        return [];
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('[FundStorage] Failed to read funds:', e);
      return [];
    }
  },

  saveFunds(funds) {
    try {
      localStorage.setItem(this.KEYS.FUNDS, JSON.stringify(funds));
    } catch (e) {
      console.error('[FundStorage] Failed to save funds:', e);
    }
  },

  addFund(fund) {
    const list = this.getFunds();
    // 检查是否已存在相同代码的基金
    const existingIndex = list.findIndex(f => f.code === fund.code);
    if (existingIndex >= 0) {
      list[existingIndex] = fund;
    } else {
      list.unshift(fund);
    }
    this.saveFunds(list);
    return list;
  },

  updateFund(updatedFund) {
    const list = this.getFunds();
    const index = list.findIndex(f => f.id === updatedFund.id);
    if (index >= 0) {
      list[index] = updatedFund;
      this.saveFunds(list);
    }
    return list;
  },

  deleteFund(fundId) {
    const list = this.getFunds().filter(f => f.id !== fundId);
    this.saveFunds(list);
    return list;
  },

  getSettings() {
    try {
      const raw = localStorage.getItem(this.KEYS.SETTINGS);
      if (!raw) return { ...this.DEFAULT_SETTINGS };
      return { ...this.DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...this.DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('[FundStorage] Failed to save settings:', e);
    }
  },

  getSnapshotRecord() {
    try {
      const raw = localStorage.getItem(this.KEYS.SNAPSHOT);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  saveSnapshotRecord(record) {
    try {
      localStorage.setItem(this.KEYS.SNAPSHOT, JSON.stringify(record));
    } catch (e) {
      console.error('[FundStorage] Failed to save snapshot:', e);
    }
  },

  /**
   * 导出全部数据为 JSON 文件
   */
  exportJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      funds: this.getFunds(),
      settings: this.getSettings()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `fund-pyramid-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 导入 JSON 数据
   * @param {string} jsonStr
   * @returns {boolean} 是否成功
   */
  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || !Array.isArray(data.funds)) {
        throw new Error('无效的备份文件格式');
      }
      this.saveFunds(data.funds);
      if (data.settings) {
        this.saveSettings(data.settings);
      }
      return true;
    } catch (err) {
      console.error('[FundStorage] Import failed:', err);
      throw err;
    }
  },

  /**
   * 清空所有本地数据
   */
  clearAll() {
    localStorage.setItem(this.KEYS.FUNDS, JSON.stringify([]));
    localStorage.removeItem(this.KEYS.SNAPSHOT);
  }
};

if (typeof window !== 'undefined') {
  window.FundStorage = FundStorage;
}
if (typeof module !== 'undefined') {
  module.exports = FundStorage;
}
