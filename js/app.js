/**
 * 主应用控制器 (App Controller)
 * 整合 API、策略计算、本地存储与 14:00 定时提醒
 */

(function () {
  'use strict';

  // 全局运行时状态
  let currentFunds = [];
  let currentValuations = {};
  let currentAnalyses = [];
  let currentSettings = {};
  let currentEditingTiers = []; // 策略弹窗正在编辑的动态档位数组
  let isAlertBannerHiddenByUser = false; // 用户是否点击了“收起”
  let latestTriggeredSignals = []; // 最近触发的买卖信号列表
  let isLinking = false; // 防持仓字段联动循环触发
  let lastProfitField = 'amount'; // 记录最近编辑收益项：'amount' | 'rate'
  let isTradeLinking = false; // 防修改交易字段联动循环触发
  let lastEditedTradeField = 'amount'; // 记录修改加减仓最近编辑项：'amount' | 'shares'

  // DOM 元素引用
  const elements = {
    sumTotalValue: document.getElementById('sumTotalValue'),
    sumPlannedBudget: document.getElementById('sumPlannedBudget'),
    sumTotalCost: document.getElementById('sumTotalCost'),
    sumCostCoverage: document.getElementById('sumCostCoverage'),
    sumTotalProfit: document.getElementById('sumTotalProfit'),
    sumProfitRate: document.getElementById('sumProfitRate'),
    sumTodayProfit: document.getElementById('sumTodayProfit'),
    sumLastUpdated: document.getElementById('sumLastUpdated'),
    fundListContainer: document.getElementById('fundListContainer'),
    fundCountBadge: document.getElementById('fundCountBadge'),
    snapshotStatusPill: document.getElementById('snapshotStatusPill'),
    snapshotStatusText: document.getElementById('snapshotStatusText'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnToggleSignalAlert: document.getElementById('btnToggleSignalAlert'),
    signalBadgeText: document.getElementById('signalBadgeText'),
    signalAlertBanner: document.getElementById('signalAlertBanner'),
    signalAlertItemsContainer: document.getElementById('signalAlertItemsContainer'),
    alertIcon: document.getElementById('alertIcon'),
    alertTitle: document.getElementById('alertTitle'),
    alertDesc: document.getElementById('alertDesc'),
    btnCopySignal: document.getElementById('btnCopySignal'),
    btnCloseAlert: document.getElementById('btnCloseAlert'),
    btnOpenAddFund: document.getElementById('btnOpenAddFund'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    // 添加/修改持仓弹窗
    modalAddFund: document.getElementById('modalAddFund'),
    modalAddFundTitle: document.getElementById('modalAddFundTitle'),
    formAddFund: document.getElementById('formAddFund'),
    editFundId: document.getElementById('editFundId'),
    inputFundCode: document.getElementById('inputFundCode'),
    inputFundName: document.getElementById('inputFundName'),
    fundQueryStatus: document.getElementById('fundQueryStatus'),
    inputHoldingAmount: document.getElementById('inputHoldingAmount'),
    inputHoldingShares: document.getElementById('inputHoldingShares'),
    inputProfitAmount: document.getElementById('inputProfitAmount'),
    inputProfitRate: document.getElementById('inputProfitRate'),
    inputPlannedAmount: document.getElementById('inputPlannedAmount'),
    selectBuyAnchorMode: document.getElementById('selectBuyAnchorMode'),
    inputBuyBenchmarkPrice: document.getElementById('inputBuyBenchmarkPrice'),
    selectSellAnchorMode: document.getElementById('selectSellAnchorMode'),
    inputSellBenchmarkPrice: document.getElementById('inputSellBenchmarkPrice'),
    inputCurrentNav: document.getElementById('inputCurrentNav'),

    // 加减仓弹窗
    modalTrade: document.getElementById('modalTrade'),
    formTrade: document.getElementById('formTrade'),
    modalTradeTitle: document.getElementById('modalTradeTitle'),
    tradeFundId: document.getElementById('tradeFundId'),
    tradeType: document.getElementById('tradeType'),
    tradeFundInfo: document.getElementById('tradeFundInfo'),
    tradeDate: document.getElementById('tradeDate'),
    tradePrice: document.getElementById('tradePrice'),
    tradeBuySection: document.getElementById('tradeBuySection'),
    tradeBuyAmount: document.getElementById('tradeBuyAmount'),
    tradeSellSection: document.getElementById('tradeSellSection'),
    tradeSellShares: document.getElementById('tradeSellShares'),
    maxSellSharesTip: document.getElementById('maxSellSharesTip'),
    tradeRemark: document.getElementById('tradeRemark'),
    tradeNavRuleTip: document.getElementById('tradeNavRuleTip'),
    tradeNavRuleText: document.getElementById('tradeNavRuleText'),
    tradeDateTip: document.getElementById('tradeDateTip'),
    tradePriceStatusBadge: document.getElementById('tradePriceStatusBadge'),
    tradeAutoConfirmOption: document.getElementById('tradeAutoConfirmOption'),
    chkAutoConfirmNav: document.getElementById('chkAutoConfirmNav'),
    btnSubmitTrade: document.getElementById('btnSubmitTrade'),

    // 修改加减仓记录弹窗
    modalEditTrade: document.getElementById('modalEditTrade'),
    formEditTrade: document.getElementById('formEditTrade'),
    modalEditTradeTitle: document.getElementById('modalEditTradeTitle'),
    editTradeFundId: document.getElementById('editTradeFundId'),
    editTradeId: document.getElementById('editTradeId'),
    editTradeType: document.getElementById('editTradeType'),
    editTradeFundInfo: document.getElementById('editTradeFundInfo'),
    editTradeTypeBadge: document.getElementById('editTradeTypeBadge'),
    editTradeDate: document.getElementById('editTradeDate'),
    editTradePrice: document.getElementById('editTradePrice'),
    editTradeAmount: document.getElementById('editTradeAmount'),
    editTradeAmountLabel: document.getElementById('editTradeAmountLabel'),
    editTradeShares: document.getElementById('editTradeShares'),
    editTradeSharesLabel: document.getElementById('editTradeSharesLabel'),
    editTradeRemark: document.getElementById('editTradeRemark'),
    btnDeleteTrade: document.getElementById('btnDeleteTrade'),
    btnSubmitEditTrade: document.getElementById('btnSubmitEditTrade'),

    // 策略参数配置弹窗
    modalStrategyConfig: document.getElementById('modalStrategyConfig'),
    formStrategyConfig: document.getElementById('formStrategyConfig'),
    configFundId: document.getElementById('configFundId'),
    cfgStepPercent: document.getElementById('cfgStepPercent'),
    cfgPlannedAmount: document.getElementById('cfgPlannedAmount'),
    btnAddTier: document.getElementById('btnAddTier'),
    cfgTiersList: document.getElementById('cfgTiersList'),
    cfgTotalRatioBadge: document.getElementById('cfgTotalRatioBadge'),
    cfgTierErrorMsg: document.getElementById('cfgTierErrorMsg'),
    cfgBuyAnchorMode: document.getElementById('cfgBuyAnchorMode'),
    cfgBuyBenchmarkPrice: document.getElementById('cfgBuyBenchmarkPrice'),
    cfgSellAnchorMode: document.getElementById('cfgSellAnchorMode'),
    cfgSellBenchmarkPrice: document.getElementById('cfgSellBenchmarkPrice'),
    cfgPreviewTable: document.getElementById('cfgPreviewTable'),

    // 系统设置与备份弹窗
    modalSettings: document.getElementById('modalSettings'),
    btnThemeDark: document.getElementById('btnThemeDark'),
    btnThemeLight: document.getElementById('btnThemeLight'),
    btnColorCn: document.getElementById('btnColorCn'),
    btnColorIntl: document.getElementById('btnColorIntl'),
    chkAutoRefresh: document.getElementById('chkAutoRefresh'),
    inputAutoRefreshMinutes: document.getElementById('inputAutoRefreshMinutes'),
    autoRefreshIntervalRow: document.getElementById('autoRefreshIntervalRow'),
    chkSound: document.getElementById('chkSound'),
    chkNotify: document.getElementById('chkNotify'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnTriggerImport: document.getElementById('btnTriggerImport'),
    fileImportJSON: document.getElementById('fileImportJSON'),
    btnLoadDemo: document.getElementById('btnLoadDemo'),
    btnClearAll: document.getElementById('btnClearAll'),

    // 基金历程时间轴弹窗
    modalTimeline: document.getElementById('modalTimeline'),
    timelineModalTitle: document.getElementById('timelineModalTitle'),
    timelineModalSub: document.getElementById('timelineModalSub'),
    timelineContainer: document.getElementById('timelineContainer')
  };

  /**
   * 应用初始化入口
   */
  async function init() {
    loadSettings();
    loadFunds();
    bindEvents();
    initMarketStatusTimer();
    restartAutoRefresh();
    await refreshData(false);
  }

  /**
   * 加载并应用用户设置
   */
  function loadSettings() {
    currentSettings = FundStorage.getSettings();
    applyTheme(currentSettings.theme);
    applyColorMode(currentSettings.colorMode);
    elements.chkSound.checked = !!currentSettings.soundEnabled;
    elements.chkNotify.checked = !!currentSettings.notifyEnabled;
    if (elements.chkAutoRefresh) {
      elements.chkAutoRefresh.checked = currentSettings.autoRefreshEnabled !== false;
    }
    if (elements.inputAutoRefreshMinutes) {
      elements.inputAutoRefreshMinutes.value = currentSettings.autoRefreshMinutes || 10;
    }
    if (elements.autoRefreshIntervalRow) {
      elements.autoRefreshIntervalRow.style.display = (currentSettings.autoRefreshEnabled !== false) ? 'flex' : 'none';
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    currentSettings.theme = theme;
    FundStorage.saveSettings(currentSettings);
  }

  function applyColorMode(mode) {
    document.documentElement.setAttribute('data-color-mode', mode);
    currentSettings.colorMode = mode;
    FundStorage.saveSettings(currentSettings);
  }

  /**
   * 加载持仓列表
   */
  function loadFunds() {
    currentFunds = FundStorage.getFunds();
  }

  let marketStatusTimer = null;
  let autoRefreshTimer = null;

  /**
   * 初始化交易状态与倒计时秒级定时器
   */
  function initMarketStatusTimer() {
    updateMarketStatusPill();
    if (marketStatusTimer) clearInterval(marketStatusTimer);
    marketStatusTimer = setInterval(updateMarketStatusPill, 1000);
  }

  /**
   * 更新交易时段状态与开盘倒计时 UI
   */
  function updateMarketStatusPill() {
    if (!elements.snapshotStatusPill || !elements.snapshotStatusText) return;

    const now = new Date();
    const day = now.getDay(); // 0: 周日, 1-5: 周一至周五, 6: 周六
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const curSec = h * 3600 + m * 60 + s;

    const isTradingDay = (day >= 1 && day <= 5);
    const morningOpen = 9 * 3600 + 30 * 60;   // 09:30:00 = 34200
    const morningClose = 11 * 3600 + 30 * 60; // 11:30:00 = 41400
    const afternoonOpen = 13 * 3600;          // 13:00:00 = 46800
    const afternoonClose = 15 * 3600;         // 15:00:00 = 54000

    const isMorningTrading = isTradingDay && (curSec >= morningOpen && curSec < morningClose);
    const isAfternoonTrading = isTradingDay && (curSec >= afternoonOpen && curSec < afternoonClose);
    const isTrading = isMorningTrading || isAfternoonTrading;

    const pad = num => String(num).padStart(2, '0');

    if (isTrading) {
      elements.snapshotStatusPill.className = 'snapshot-pill trading';
      elements.snapshotStatusText.textContent = `实时盘中交易时间：${pad(h)}:${pad(m)}:${pad(s)}`;
    } else {
      // 计算距离下次开盘的目标时间
      let target = new Date(now.getTime());

      if (isTradingDay) {
        if (curSec < morningOpen) {
          // 00:00:00 - 09:30:00: 今日早盘开盘
          target.setHours(9, 30, 0, 0);
        } else if (curSec >= morningClose && curSec < afternoonOpen) {
          // 11:30:00 - 13:00:00: 午间休市，今日午盘开盘
          target.setHours(13, 0, 0, 0);
        } else {
          // 15:00:00 之后，如果周五则跳到下周一，否则跳到明天
          const daysToAdd = (day === 5) ? 3 : 1;
          target.setDate(target.getDate() + daysToAdd);
          target.setHours(9, 30, 0, 0);
        }
      } else {
        // 周末：周六加2天到周一，周日加1天到周一
        const daysToAdd = (day === 6) ? 2 : 1;
        target.setDate(target.getDate() + daysToAdd);
        target.setHours(9, 30, 0, 0);
      }

      const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
      const countdownH = pad(Math.floor(diffSec / 3600));
      const countdownM = pad(Math.floor((diffSec % 3600) / 60));
      const countdownS = pad(diffSec % 60);

      elements.snapshotStatusPill.className = 'snapshot-pill closed';
      elements.snapshotStatusText.textContent = `距离开盘：${countdownH}:${countdownM}:${countdownS}`;
    }
  }

  /**
   * 重启/启动盘中自动刷新定时器
   */
  function restartAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    const settings = FundStorage.getSettings();
    if (settings.autoRefreshEnabled !== false) {
      const minutes = Math.max(1, parseInt(settings.autoRefreshMinutes, 10) || 10);
      autoRefreshTimer = setInterval(async () => {
        if (currentFunds && currentFunds.length > 0) {
          console.log(`[AutoRefresh] 执行定时自动刷新 (${minutes} 分钟间隔)...`);
          await refreshData(false);
        }
      }, minutes * 60 * 1000);
    }
  }

  /**
   * 刷新基金估值与重算视图
   * @param {boolean} isFrom1400 是否是 14:00 定时抓取触发
   */
  async function refreshData(isFrom1400 = false) {
    if (!currentFunds || currentFunds.length === 0) {
      renderEmpty();
      return;
    }

    setRefreshLoading(true);
    const codes = currentFunds.map(f => f.code);

    try {
      currentValuations = await FundAPI.fetchValuations(codes);
    } catch (err) {
      console.warn('[App] 获取最新估值失败，使用历史正式净值:', err);
    } finally {
      setRefreshLoading(false);
    }

    // 核心新增：自动检查并核准待确认的加减仓记录（收盘公布官方净值后自动校准真实份额与成本）
    await checkAndConfirmPendingTrades();

    // 执行每只基金的策略分析
    currentAnalyses = currentFunds.map(fund => {
      const val = currentValuations[fund.code] || null;
      return FundStrategy.analyzePosition(fund, val);
    });

    renderSummary(currentAnalyses);
    renderFundCards(currentAnalyses);
    checkSignalAlerts(currentAnalyses, isFrom1400);
    updateSnapshotPillUI();
  }

  /**
   * 显示轻量浮动提示卡片
   */
  function showToast(message, duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'glass-panel';
    toast.style.cssText = `
      padding: 11px 16px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-primary);
      border: 1px solid var(--border-glass-bright);
      background: var(--bg-card);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      border-radius: var(--radius-md);
      pointer-events: auto;
      animation: fade-in 0.25s ease-out;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    `;
    toast.innerHTML = `<span style="font-size: 16px; line-height: 1.3;">🔔</span><div style="flex: 1;">${message}</div>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  /**
   * 自动巡检并核准待确认的交易记录 (T日15:00前申报按当日收盘公布官方净值结算，公布后自动校准真实份额与成本)
   */
  async function checkAndConfirmPendingTrades() {
    let hasAnyConfirmed = false;
    const confirmedNotices = [];

    for (const fund of currentFunds) {
      if (!Array.isArray(fund.trades) || fund.trades.length === 0) continue;
      const val = currentValuations[fund.code];
      let fundChanged = false;

      for (const trade of fund.trades) {
        if (trade.status !== 'pending' && !trade.isEstimated) continue;

        const targetDate = trade.targetNavDate || trade.date;
        let officialNav = null;

        // 策略 1: 批量拉取的最新官方净值日期与目标交易日完全吻合（最常见场景：今晚公布或次日清晨拉取）
        if (val && val.nav && Number(val.nav) > 0 && val.navDate === targetDate) {
          officialNav = Number(val.nav);
        } else if (val && val.navDate && val.navDate > targetDate) {
          // 策略 2: 最新净值日期已超过该交易日（例如隔了几天未打开网页），拉取该日历史正式净值
          try {
            officialNav = await FundAPI.fetchHistoricalNav(fund.code, targetDate);
          } catch (e) {
            console.warn('[AutoConfirm] 历史净值获取失败:', fund.code, targetDate, e);
          }
        }

        if (officialNav && officialNav > 0) {
          FundStrategy.confirmTrade(fund, trade.id, officialNav);
          fundChanged = true;
          hasAnyConfirmed = true;
          const typeName = trade.type === 'buy' ? '加仓' : '减仓';
          confirmedNotices.push(`<strong>${fund.name}</strong> 的${typeName}已按 ${targetDate} 官方收盘净值 <strong>¥${officialNav.toFixed(4)}</strong> 完成校准确认！`);
        }
      }

      if (fundChanged) {
        FundStorage.updateFund(fund);
      }
    }

    if (hasAnyConfirmed) {
      loadFunds();
      if (confirmedNotices.length > 0) {
        showToast(`🎉 <strong>官方净值公布自动校准完成</strong><br>${confirmedNotices.join('<br>')}`, 6000);
      }
    }
  }

  /**
   * 设置刷新按钮加载状态动画
   */
  function setRefreshLoading(isLoading) {
    if (isLoading) {
      elements.btnRefresh.style.opacity = '0.6';
      elements.btnRefresh.style.pointerEvents = 'none';
      elements.btnRefresh.querySelector('.btn-text').textContent = '更新中...';
    } else {
      elements.btnRefresh.style.opacity = '1';
      elements.btnRefresh.style.pointerEvents = 'auto';
      elements.btnRefresh.querySelector('.btn-text').textContent = '刷新';
    }
  }

  /**
   * 格式化估值时间（附带 MM-DD 日期，应对半夜 24:00 后、次日开盘前或非交易日场景）
   * @param {string} gzTime 如 "2026-10-14 15:00"
   * @param {string} navDate 如 "2026-10-14"
   * @returns {string} 如 "10-14 15:00"
   */
  function formatGzTimeWithDate(gzTime, navDate) {
    if (gzTime && gzTime.includes(' ')) {
      const parts = gzTime.split(' ');
      const datePart = parts[0].length > 5 ? parts[0].slice(5) : parts[0];
      const timePart = parts[1].length >= 5 ? parts[1].slice(0, 5) : parts[1];
      return `${datePart} ${timePart}`;
    }
    if (gzTime && gzTime.includes('-')) {
      return gzTime.length > 5 ? gzTime.slice(5) : gzTime;
    }
    if (navDate) {
      const shortD = navDate.length > 5 ? navDate.slice(5) : navDate;
      return `${shortD} 15:00`;
    }
    return '';
  }

  /**
   * 渲染资产总览卡片 (Summary)
   * 严格按照官方公布正式净值计算持仓市值与累计收益
   */
  function renderSummary(analyses) {
    let totalMarketValue = 0;
    let totalCost = 0;
    let totalPlannedBudget = 0;
    let totalTodayEstimatedProfit = 0;
    let latestRawGzTime = '';

    analyses.forEach(item => {
      totalMarketValue += item.marketValue; // 按正式 NAV 计算的市值
      totalCost += item.totalCost;
      const fund = currentFunds.find(f => f.id === item.fundId);
      if (fund) totalPlannedBudget += (fund.plannedAmount !== undefined && fund.plannedAmount !== null && !isNaN(Number(fund.plannedAmount))) ? Number(fund.plannedAmount) : 0;
      totalTodayEstimatedProfit += item.todayEstimatedProfit;
      const itemGz = item.gzTime || (item.navDate ? `${item.navDate} 15:00` : '');
      if (itemGz && itemGz > latestRawGzTime) {
        latestRawGzTime = itemGz;
      }
    });

    const latestUpdateTime = formatGzTimeWithDate(latestRawGzTime) || '--:--';

    // 累计盈亏以总投入成本为基准
    const totalProfit = totalMarketValue - totalCost;
    const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const coverage = totalPlannedBudget > 0 ? (totalCost / totalPlannedBudget) * 100 : 0;

    elements.sumTotalValue.textContent = `¥${totalMarketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elements.sumPlannedBudget.textContent = `计划总投入: ¥${totalPlannedBudget.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    elements.sumTotalCost.textContent = `¥${totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elements.sumCostCoverage.textContent = `已用仓位: ${coverage.toFixed(1)}%`;

    // 累计盈亏染色
    elements.sumTotalProfit.textContent = (totalProfit >= 0 ? '+¥' : '-¥') + Math.abs(totalProfit).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    elements.sumProfitRate.textContent = (profitRate >= 0 ? '+' : '') + profitRate.toFixed(2) + '%';
    elements.sumTotalProfit.className = `summary-value tabular-nums ${totalProfit >= 0 ? 'text-up' : 'text-down'}`;
    elements.sumProfitRate.className = `summary-sub tabular-nums ${profitRate >= 0 ? 'text-up' : 'text-down'}`;

    // 今日盘中预估/实际浮动
    elements.sumTodayProfit.textContent = (totalTodayEstimatedProfit >= 0 ? '+¥' : '-¥') + Math.abs(totalTodayEstimatedProfit).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    elements.sumTodayProfit.className = `summary-value tabular-nums ${totalTodayEstimatedProfit >= 0 ? 'text-up' : 'text-down'}`;
    elements.sumLastUpdated.textContent = `估值时间: ${latestUpdateTime}`;

    elements.fundCountBadge.textContent = currentFunds.length;
  }

  /**
   * 渲染单只基金卡片列表 (Fund Cards)
   * 1. 份额统一保留 2 位小数
   * 2. 分别清晰展示官方正式公布净值与盘中参考估值
   * 3. 持仓市值与盈亏按正式公布净值计算
   * 4. 增加“修改持仓”入口并使用事件委托处理点击
   */
  function renderFundCards(analyses) {
    if (!analyses || analyses.length === 0) {
      renderEmpty();
      return;
    }

    elements.fundListContainer.innerHTML = '';

    analyses.forEach(item => {
      const fund = currentFunds.find(f => f.id === item.fundId);
      if (!fund) return;

      const card = document.createElement('div');
      card.className = 'glass-panel fund-card';

      // 估值涨跌判断
      const isUp = item.gszzl >= 0;
      const rateText = (isUp ? '+' : '') + item.gszzl.toFixed(2) + '%';
      const rateClass = isUp ? 'badge-up' : 'badge-down';
      const pnlRateText = (item.profitRate >= 0 ? '+' : '') + item.profitRate.toFixed(2) + '%';
      const pnlRateClass = item.profitRate >= 0 ? 'text-up' : 'text-down';

      const todayStr = new Date().toISOString().split('T')[0];
      const hasExecutedBuyToday = (fund.trades || []).some(t => t.date === todayStr && t.type === 'buy');
      const hasExecutedSellToday = (fund.trades || []).some(t => t.date === todayStr && t.type === 'sell');

      // 下一步买点信息（份额保留2位小数）
      let nextBuyHtml = '';
      if (item.nextBuy) {
        const isTriggered = item.nextBuy.isTriggered;
        const buySharesFormatted = (Number(item.nextBuy.estShares) || 0).toFixed(2);
        const buyPillClass = isTriggered ? (hasExecutedBuyToday ? 'buy-alert buy-executed' : 'buy-alert') : '';
        const buyTitleText = isTriggered
          ? (hasExecutedBuyToday ? '✅ 今日已执行加仓 (第' + item.nextBuy.level + '档)' : '🚨 已触及买点 (第' + item.nextBuy.level + '档)')
          : '📉 下一买点 (第' + item.nextBuy.level + '档)';
        nextBuyHtml = `
          <div class="action-pill ${buyPillClass}">
            <div class="action-header">
              <span style="color: var(--color-down)">${buyTitleText}</span>
              <span class="tabular-nums">${item.nextBuy.triggerPrice.toFixed(4)} (${item.nextBuy.distPercent.toFixed(1)}%)</span>
            </div>
            <div class="action-detail">
              建议买入：<strong>¥${(Number(item.nextBuy.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (约 ${buySharesFormatted} 份)
            </div>
          </div>
        `;
      }

      // 下一步卖点信息（份额保留2位小数）
      let nextSellHtml = '';
      if (item.nextSell) {
        const isTriggered = item.nextSell.isTriggered;
        const sellSharesFormatted = (Number(item.nextSell.shares) || 0).toFixed(2);
        const sellPillClass = isTriggered ? (hasExecutedSellToday ? 'sell-alert sell-executed' : 'sell-alert') : '';
        const sellTitleText = isTriggered
          ? (hasExecutedSellToday ? '✅ 今日已执行减仓 (第' + item.nextSell.level + '档)' : '🚨 已触及卖点 (第' + item.nextSell.level + '档)')
          : '📈 下一卖点 (第' + item.nextSell.level + '档)';
        nextSellHtml = `
          <div class="action-pill ${sellPillClass}">
            <div class="action-header">
              <span style="color: var(--color-up)">${sellTitleText}</span>
              <span class="tabular-nums">${item.nextSell.triggerPrice.toFixed(4)} (${(item.nextSell.distPercent >= 0 ? '+' : '') + item.nextSell.distPercent.toFixed(1)}%)</span>
            </div>
            <div class="action-detail">
              建议卖出：<strong>${sellSharesFormatted} 份</strong> (约 ¥${(Number(item.nextSell.estAmount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </div>
          </div>
        `;
      }

      // 渲染金字塔阶梯横向指示刻度
      const ladderTrackHtml = renderLadderTrack(item);

      const sharesFormatted = (Number(item.shares) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const shortNavDate = item.navDate ? (item.navDate.length > 5 ? item.navDate.slice(5) : item.navDate) : '';
      const formattedGzTime = formatGzTimeWithDate(item.gzTime, item.navDate);
      const gzTimeDisplay = formattedGzTime ? `${formattedGzTime} 估值` : '收盘净值计';
      const isOfficial = !!item.isOfficialPublished;

      card.innerHTML = `
        <div class="fund-header">
          <div class="fund-info-group">
            <div class="fund-name">
              <span>${item.name}</span>
            </div>
            <div class="fund-meta">
              <span class="fund-code">${item.code}</span>
              <span>买基准: ¥${item.buyBasePrice.toFixed(4)} (${item.buyAnchorDesc})</span>
              <span>卖基准: ¥${item.sellBasePrice.toFixed(4)} (${item.sellAnchorDesc})</span>
            </div>
          </div>
          <div class="fund-rate-group">
            <div class="fund-rate-badge ${rateClass} tabular-nums">
              <span class="rate-label">${isOfficial ? '今日实际' : '今日预估'}</span>
              <span>${rateText}</span>
            </div>
            <span class="fund-gz-time">${gzTimeDisplay}</span>
          </div>
        </div>

        <div class="fund-metrics-box">
          <!-- 第一行：公布净值与当前持仓核心指标 -->
          <div class="metrics-row">
            <div class="metric-col">
              <span class="metric-title">单位净值</span>
              <span class="metric-number tabular-nums">
                ¥${item.officialNav.toFixed(4)}${shortNavDate ? `<span class="metric-date">(${shortNavDate})</span>` : ''}
              </span>
            </div>

            <div class="metric-col">
              <span class="metric-title">持仓市值</span>
              <span class="metric-number tabular-nums">¥${item.marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div class="metric-col">
              <span class="metric-title">当前持仓份额</span>
              <span class="metric-number tabular-nums">${sharesFormatted} 份</span>
            </div>

            <div class="metric-col">
              <span class="metric-title">持有收益 (收益率)</span>
              <span class="metric-number tabular-nums ${pnlRateClass}">
                ${(item.totalProfit >= 0 ? '+¥' : '-¥') + Math.abs(item.totalProfit).toFixed(2)}
                <span class="metric-rate-sub">(${pnlRateText})</span>
              </span>
            </div>
          </div>

          <div class="metrics-divider">
            <span class="divider-text">盘中估算与成本参考</span>
          </div>

          <!-- 第二行：盘中估值、浮动与成本基准 -->
          <div class="metrics-row">
            <div class="metric-col">
              <span class="metric-title">${isOfficial ? '收盘确认净值' : '盘中参考估值'}</span>
              <span class="metric-number tabular-nums">
                ${item.hasValuation ? '¥' + item.gsz.toFixed(4) : '以净值计'}
              </span>
            </div>

            <div class="metric-col">
              <span class="metric-title">${isOfficial ? '今日实际收益' : '今日预估浮动'}</span>
              <span class="metric-number tabular-nums ${item.todayEstimatedProfit >= 0 ? 'text-up' : 'text-down'}">
                ${(item.todayEstimatedProfit >= 0 ? '+¥' : '-¥') + Math.abs(item.todayEstimatedProfit).toFixed(2)}
              </span>
            </div>

            <div class="metric-col">
              <span class="metric-title">持仓成本均价</span>
              <span class="metric-number tabular-nums">
                ¥${(Number(item.avgCost) || 0).toFixed(4)}
              </span>
            </div>

            <div class="metric-col">
              <span class="metric-title">累计总投入本金</span>
              <span class="metric-number tabular-nums">
                ¥${(Number(item.totalCost) || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div class="ladder-section">
          <div class="ladder-header">
            <span>金字塔阶梯买卖决策 (每跌加仓 · 每涨减仓)</span>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <span class="anchor-tag" style="color: var(--color-down); border-color: var(--color-down-border);">买偏离：${(item.buyDeviation >= 0 ? '+' : '') + item.buyDeviation.toFixed(2)}%</span>
              <span class="anchor-tag" style="color: var(--color-up); border-color: var(--color-up-border);">卖偏离：${(item.sellDeviation >= 0 ? '+' : '') + item.sellDeviation.toFixed(2)}%</span>
            </div>
          </div>

          <div class="next-action-row">
            ${nextBuyHtml}
            ${nextSellHtml}
          </div>

          ${ladderTrackHtml}
        </div>

        <div class="fund-card-actions">
          <button class="btn btn-sm" data-action="buy" data-fund-id="${item.fundId}">
            <span style="color: var(--color-down)">＋</span> 记录加仓
          </button>
          <button class="btn btn-sm" data-action="sell" data-fund-id="${item.fundId}">
            <span style="color: var(--color-up)">－</span> 记录减仓
          </button>
          <button class="btn btn-sm" data-action="timeline" data-fund-id="${item.fundId}" title="查看历程时间轴">
            📅 时间轴
          </button>
          <button class="btn btn-sm" data-action="strategy" data-fund-id="${item.fundId}">
            ⚙️ 策略微调
          </button>
          <button class="btn btn-sm" data-action="edit" data-fund-id="${item.fundId}">
            ✏️ 修改持仓
          </button>
          <button class="btn btn-sm" data-action="delete" data-fund-id="${item.fundId}" style="color: var(--text-muted)">
            删除
          </button>
        </div>
      `;

      elements.fundListContainer.appendChild(card);
    });
  }

  /**
   * 生成阶梯可视化刻度条（支持动态档位数量）
   * 若未触及最小买卖点，则在“基准”对应的刻度条处亮起绿灯指示当前处于正常持仓区间
   */
  function renderLadderTrack(item) {
    const buyTiers = item.buyLadders || [];
    const sellTiers = item.sellLadders || [];

    // 判断是否未达到最小买卖点（即当前净值处于基准区间）
    const hasTriggeredBuy = buyTiers.some(t => t.isTriggered);
    const hasTriggeredSell = sellTiers.some(t => t.isTriggered);
    const isBaseActive = !hasTriggeredBuy && !hasTriggeredSell;

    const steps = [];

    // 买入档位（越深越在左侧）
    for (let i = buyTiers.length - 1; i >= 0; i--) {
      steps.push({
        label: `-${buyTiers[i].percent}%`,
        buyTier: buyTiers[i]
      });
    }

    // 中间基准
    steps.push({
      label: '基准',
      isBase: true,
      isBaseActive: isBaseActive
    });

    // 卖出档位
    for (let i = 0; i < sellTiers.length; i++) {
      steps.push({
        label: `+${sellTiers[i].percent}%`,
        sellTier: sellTiers[i]
      });
    }

    let barsHtml = '';
    steps.forEach(step => {
      let activeClass = '';
      let isBaseActiveStep = false;

      if (step.buyTier && step.buyTier.isTriggered) {
        activeClass = 'active-buy';
      } else if (step.sellTier && step.sellTier.isTriggered) {
        activeClass = 'active-sell';
      } else if (step.isBase && step.isBaseActive) {
        activeClass = 'active-base';
        isBaseActiveStep = true;
      }

      const itemTooltip = step.isBase && step.isBaseActive
        ? 'title="当前处于基准持仓区间（未达加减仓点位）"'
        : '';

      barsHtml += `
        <div class="tier-step-item ${isBaseActiveStep ? 'is-base-active' : ''}" ${itemTooltip}>
          <div class="tier-bar ${activeClass}"></div>
          <span class="tier-label">${step.label}</span>
        </div>
      `;
    });

    return `<div class="ladder-track">${barsHtml}</div>`;
  }

  /**
   * 检查买卖信号并触发告警横幅、音效与通知
   * 1. 自动记录触发事件至 fund.alertHistory (避免重复刷屏)
   * 2. 对已完成加减仓的信号显示为绿色背景“已成功执行加减仓”
   * 3. 对未完成的信号显示对应【＋ 去加仓】/【－ 去减仓】快捷按钮
   */
  function checkSignalAlerts(analyses, isFrom1400 = false) {
    const triggeredList = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    analyses.forEach(item => {
      const fund = currentFunds.find(f => f.id === item.fundId);
      if (!fund) return;
      if (!Array.isArray(fund.alertHistory)) fund.alertHistory = [];

      let fundUpdated = false;

      if (item.triggeredBuy) {
        const todayBuy = (fund.trades || []).find(t => t.date === todayStr && t.type === 'buy');
        const isExecuted = !!todayBuy;
        const isPending = todayBuy ? (todayBuy.status === 'pending' || todayBuy.isEstimated) : false;
        const alertKey = `${todayStr}_buy_${item.triggeredBuy.level}`;
        const existingAlert = fund.alertHistory.find(a => a.key === alertKey);

        if (!existingAlert) {
          fund.alertHistory.push({
            id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            key: alertKey,
            type: 'buy_alert',
            date: todayStr,
            time: nowTime,
            level: item.triggeredBuy.level,
            triggerPrice: item.triggeredBuy.triggerPrice,
            currentPrice: item.currentPrice,
            amount: item.triggeredBuy.amount,
            estShares: item.triggeredBuy.estShares,
            timestamp: Date.now()
          });
          fundUpdated = true;
        }

        triggeredList.push({
          fundId: item.fundId,
          type: 'buy',
          name: item.name,
          code: item.code,
          level: item.triggeredBuy.level,
          amount: item.triggeredBuy.amount,
          estShares: item.triggeredBuy.estShares,
          triggerPrice: item.triggeredBuy.triggerPrice,
          currentPrice: item.currentPrice,
          isExecuted: isExecuted,
          isPending: isPending
        });
      }

      if (item.triggeredSell) {
        const todaySell = (fund.trades || []).find(t => t.date === todayStr && t.type === 'sell');
        const isExecuted = !!todaySell;
        const isPending = todaySell ? (todaySell.status === 'pending' || todaySell.isEstimated) : false;
        const alertKey = `${todayStr}_sell_${item.triggeredSell.level}`;
        const existingAlert = fund.alertHistory.find(a => a.key === alertKey);

        if (!existingAlert) {
          fund.alertHistory.push({
            id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            key: alertKey,
            type: 'sell_alert',
            date: todayStr,
            time: nowTime,
            level: item.triggeredSell.level,
            triggerPrice: item.triggeredSell.triggerPrice,
            currentPrice: item.currentPrice,
            shares: item.triggeredSell.shares,
            estAmount: item.triggeredSell.estAmount,
            timestamp: Date.now()
          });
          fundUpdated = true;
        }

        triggeredList.push({
          fundId: item.fundId,
          type: 'sell',
          name: item.name,
          code: item.code,
          level: item.triggeredSell.level,
          shares: item.triggeredSell.shares,
          estAmount: item.triggeredSell.estAmount,
          triggerPrice: item.triggeredSell.triggerPrice,
          currentPrice: item.currentPrice,
          isExecuted: isExecuted,
          isPending: isPending
        });
      }

      if (fundUpdated) {
        FundStorage.updateFund(fund);
      }
    });

    if (triggeredList.length > 0) {
      const unexecutedList = triggeredList.filter(t => !t.isExecuted);
      const executedList = triggeredList.filter(t => t.isExecuted);

      // 顶部常驻快捷提醒按钮展示
      if (elements.btnToggleSignalAlert) {
        elements.btnToggleSignalAlert.style.display = 'inline-flex';
        if (elements.signalBadgeText) {
          if (unexecutedList.length > 0) {
            elements.signalBadgeText.textContent = `${unexecutedList.length} 笔买卖待执行`;
            elements.btnToggleSignalAlert.classList.remove('all-done');
            elements.btnToggleSignalAlert.classList.add('pending');
          } else {
            elements.signalBadgeText.textContent = `今日买卖已全部执行 (${executedList.length})`;
            elements.btnToggleSignalAlert.classList.remove('pending');
            elements.btnToggleSignalAlert.classList.add('all-done');
          }
        }
      }

      // 若用户未手动收起，则展示横幅
      if (!isAlertBannerHiddenByUser) {
        elements.signalAlertBanner.classList.add('active');
      } else {
        elements.signalAlertBanner.classList.remove('active');
      }

      const buyCount = triggeredList.filter(t => t.type === 'buy').length;
      const sellCount = triggeredList.filter(t => t.type === 'sell').length;

      let msg = '';
      if (buyCount > 0) msg += `${buyCount} 笔买点 `;
      if (sellCount > 0) msg += `${sellCount} 笔卖点`;

      latestTriggeredSignals = triggeredList;

      if (elements.alertIcon) {
        elements.alertIcon.textContent = unexecutedList.length === 0 ? '✅' : '🚨';
      }

      if (unexecutedList.length === 0) {
        elements.alertTitle.textContent = `今日买卖触发点位（已全部执行加减仓）`;
        elements.alertDesc.textContent = `检测到的 ${triggeredList.length} 笔策略触发点位今日均已成功执行记账`;
      } else {
        elements.alertTitle.textContent = `买卖点已触及（${msg.trim()}，待执行 ${unexecutedList.length} 笔）`;
        elements.alertDesc.textContent = `盘中估值已触及金字塔策略设定的买入或卖出点位，可直接在下方卡片快捷执行加减仓：`;
      }

      // 渲染动态操作卡片
      if (elements.signalAlertItemsContainer) {
        let cardsHtml = '';
        triggeredList.forEach(sig => {
          const isExec = sig.isExecuted;
          const isPending = sig.isPending;
          const badgeClass = isExec ? 'badge-executed' : (sig.type === 'buy' ? 'badge-buy' : 'badge-sell');
          let badgeText = '';
          if (isExec) {
            badgeText = isPending
              ? `⏳ 已记录${sig.type === 'buy' ? '加仓' : '减仓'}申报 (待收盘官方净值校准)`
              : `✅ 已成功执行${sig.type === 'buy' ? '加仓' : '减仓'}`;
          } else {
            badgeText = `🚨 达到${sig.type === 'buy' ? '加仓' : '减仓'}点 (第${sig.level}档)`;
          }

          let detailText = '';
          if (sig.type === 'buy') {
            const buySharesStr = (Number(sig.estShares) || 0).toFixed(2);
            detailText = `触发买入价: <strong class="tabular-nums">¥${sig.triggerPrice.toFixed(4)}</strong> · 建议加仓 <strong>¥${(Number(sig.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (约 ${buySharesStr} 份)`;
          } else {
            const sellAmtStr = (Number(sig.estAmount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            detailText = `触发卖出价: <strong class="tabular-nums">¥${sig.triggerPrice.toFixed(4)}</strong> · 建议减仓 <strong>${(Number(sig.shares) || 0).toFixed(2)} 份</strong> (约 ¥${sellAmtStr})`;
          }

          let actionBtnHtml = '';
          if (isExec) {
            if (isPending) {
              actionBtnHtml = `<span class="signal-executed-tag" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px dashed rgba(245, 158, 11, 0.4);">✓ 15:00前预估暂记 (待官方公布净值自动校准)</span>`;
            } else {
              actionBtnHtml = `<span class="signal-executed-tag">✓ 今日已成功执行加减仓</span>`;
            }
          } else {
            actionBtnHtml = `<button class="btn btn-sm ${sig.type === 'buy' ? 'btn-action-buy' : 'btn-action-sell'}" data-action="quick-trade" data-fund-id="${sig.fundId}" data-trade-type="${sig.type}" data-amount="${sig.amount || ''}" data-shares="${sig.shares || ''}" data-price="${sig.triggerPrice}" data-level="${sig.level}">
                 ${sig.type === 'buy' ? '＋ 去加仓' : '－ 去减仓'}
               </button>`;
          }

          cardsHtml += `
            <div class="signal-alert-card ${isExec ? 'executed' : ''}">
              <div class="signal-alert-main">
                <div class="signal-alert-title-row">
                  <span class="signal-alert-badge ${badgeClass}">${badgeText}</span>
                  <span class="signal-alert-fund-name">${sig.name} <span class="fund-code">${sig.code}</span></span>
                </div>
                <div class="signal-alert-detail">${detailText}</div>
              </div>
              <div class="signal-alert-action-box">
                ${actionBtnHtml}
              </div>
            </div>
          `;
        });
        elements.signalAlertItemsContainer.innerHTML = cardsHtml;
      }

      // 14:00 后首次打开网页或应用时，如果检测到未执行交易点，触发提示音与系统 Notification 弹窗
      const now = new Date();
      const isTradingDay = FundNotification.isTradingDay(now);
      const isAfter1400 = now.getHours() >= 14;
      const alreadyNotified = FundNotification.hasNotifiedToday();

      if (isTradingDay && isAfter1400 && !alreadyNotified && unexecutedList.length > 0) {
        const hasBuy = unexecutedList.some(t => t.type === 'buy');
        FundNotification.playChime(hasBuy ? 'buy' : 'sell');
        const details = unexecutedList.map(t => `${t.name}: 第${t.level}档${t.type === 'buy' ? '加仓' : '减仓'}`).join('；');
        FundNotification.sendSystemNotification('【基金金字塔交易点位预警】', details);
        FundNotification.markNotifiedToday();
      }
    } else {
      if (elements.btnToggleSignalAlert) {
        elements.btnToggleSignalAlert.style.display = 'none';
        elements.btnToggleSignalAlert.classList.remove('pending', 'all-done');
      }
      elements.signalAlertBanner.classList.remove('active');
      isAlertBannerHiddenByUser = false;
    }
  }

  /**
   * 复制买卖指令文本
   */
  function copySignalText() {
    if (!latestTriggeredSignals || latestTriggeredSignals.length === 0) {
      const text = elements.alertDesc ? elements.alertDesc.textContent : '';
      if (!text) return;
      navigator.clipboard.writeText(`【金字塔买卖提醒】\n${text}\n执行时间：${new Date().toLocaleTimeString()}`).then(() => {
        showToast('📋 已复制操作建议文本至剪贴板');
      }).catch(() => {
        prompt('请手动复制以下操作指令：', text);
      });
      return;
    }

    const lines = [];
    const title = elements.alertTitle ? elements.alertTitle.textContent : '今日买卖触发信号';
    lines.push(`【金字塔买卖操作建议】${title}`);
    lines.push(`生成时间：${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    lines.push('----------------------------------------');
    latestTriggeredSignals.forEach((sig, idx) => {
      const typeStr = sig.type === 'buy' ? '加仓买入' : '减仓卖出';
      const actionStr = sig.type === 'buy'
        ? `建议加仓 ¥${(Number(sig.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (约 ${(Number(sig.estShares) || 0).toFixed(2)} 份)`
        : `建议减仓 ${(Number(sig.shares) || 0).toFixed(2)} 份 (约 ¥${(Number(sig.estAmount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
      const statusStr = sig.isExecuted ? ' [已记录执行]' : ' [待执行]';
      lines.push(`${idx + 1}. ${sig.name} (${sig.code})\n   触发${typeStr}(第${sig.level}档, 触发价 ¥${sig.triggerPrice.toFixed(4)})\n   ${actionStr}${statusStr}`);
    });

    const fullText = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        showToast('📋 已复制买卖操作建议清单至剪贴板，可前往交易软件操作！');
      }).catch(() => {
        prompt('请手动长按复制以下操作指令：', fullText);
      });
    } else {
      prompt('请手动长按复制以下操作指令：', fullText);
    }
  }

  /**
   * 渲染空状态
   */
  function renderEmpty() {
    elements.fundListContainer.innerHTML = `
      <div class="glass-panel empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-text">暂无持仓基金</div>
        <div class="empty-sub">点击右上角“添加基金”录入您的真实持仓，或按需载入示例基金体验阶梯策略</div>
        <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; justify-content: center;">
          <button class="btn btn-primary" onclick="App.openAddModal()">＋ 添加第一只基金</button>
          <button class="btn" onclick="App.loadDemoData()">✨ 载入示例体验</button>
        </div>
      </div>
    `;
    elements.sumTotalValue.textContent = '¥0.00';
    elements.sumPlannedBudget.textContent = '计划总投入: ¥0.00';
    elements.sumTotalCost.textContent = '¥0.00';
    elements.sumCostCoverage.textContent = '已用仓位: 0.0%';
    elements.sumTotalProfit.textContent = '¥0.00';
    elements.sumProfitRate.textContent = '0.00%';
    elements.sumTodayProfit.textContent = '¥0.00';
    elements.fundCountBadge.textContent = '0';
    elements.signalAlertBanner.classList.remove('active');
  }

  /**
   * 绑定所有 DOM 交互事件（统一采用事件委托，杜绝无反应问题）
   */
  function bindEvents() {
    // 立即刷新
    elements.btnRefresh.addEventListener('click', () => refreshData(false));

    // 收起/隐藏告警横幅（临时隐藏，可在顶部随时点出）
    elements.btnCloseAlert.addEventListener('click', () => {
      isAlertBannerHiddenByUser = true;
      elements.signalAlertBanner.classList.remove('active');
    });

    // 顶部买卖信号快捷按钮：点击重新弹出/收起横幅
    if (elements.btnToggleSignalAlert) {
      elements.btnToggleSignalAlert.addEventListener('click', () => {
        isAlertBannerHiddenByUser = !isAlertBannerHiddenByUser;
        if (!isAlertBannerHiddenByUser) {
          elements.signalAlertBanner.classList.add('active');
          elements.signalAlertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          elements.signalAlertBanner.classList.remove('active');
        }
      });
    }

    // 复制告警指令
    elements.btnCopySignal.addEventListener('click', copySignalText);

    // 弹窗打开与关闭
    elements.btnOpenAddFund.addEventListener('click', () => openAddModal());
    elements.btnOpenSettings.addEventListener('click', () => openModal(elements.modalSettings));

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.getAttribute('data-close');
        closeModal(document.getElementById(modalId));
      });
    });

    // 点击蒙层背景关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay);
        }
      });
    });

    // 持仓列表容器事件委托（处理加仓、减仓、时间轴、修改、策略、删除）
    elements.fundListContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const fundId = btn.getAttribute('data-fund-id');
      if (!fundId) return;

      if (action === 'buy') {
        openTradeModal(fundId, 'buy');
      } else if (action === 'sell') {
        openTradeModal(fundId, 'sell');
      } else if (action === 'timeline') {
        openTimelineModal(fundId);
      } else if (action === 'edit') {
        openEditModal(fundId);
      } else if (action === 'strategy') {
        openStrategyModal(fundId);
      } else if (action === 'delete') {
        deleteFundConfirm(fundId);
      }
    });

    // 告警横幅中快捷加减仓按钮点击处理
    if (elements.signalAlertBanner) {
      elements.signalAlertBanner.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action="quick-trade"]');
        if (!btn) return;
        const fundId = btn.getAttribute('data-fund-id');
        const type = btn.getAttribute('data-trade-type');
        const amount = btn.getAttribute('data-amount');
        const shares = btn.getAttribute('data-shares');
        const price = btn.getAttribute('data-price');
        const level = btn.getAttribute('data-level');

        openTradeModal(fundId, type, {
          amount: amount ? parseFloat(amount) : '',
          shares: shares ? parseFloat(shares) : '',
          price: price ? parseFloat(price) : '',
          remark: `触及第${level}档${type === 'buy' ? '加仓' : '减仓'}`
        });
      });
    }

    // 时间轴弹窗中点击交易修改
    if (elements.timelineContainer) {
      elements.timelineContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action="edit-trade"]');
        if (!btn) return;
        const fundId = btn.getAttribute('data-fund-id');
        const tradeId = btn.getAttribute('data-trade-id');
        if (fundId && tradeId) {
          openEditTradeModal(fundId, tradeId);
        }
      });
    }

    // 修改加减仓记录输入联动与表单事件
    if (elements.editTradeAmount) {
      elements.editTradeAmount.addEventListener('input', syncEditTradeFromAmount);
    }
    if (elements.editTradeShares) {
      elements.editTradeShares.addEventListener('input', syncEditTradeFromShares);
    }
    if (elements.editTradePrice) {
      elements.editTradePrice.addEventListener('input', syncEditTradeFromPrice);
    }
    if (elements.formEditTrade) {
      elements.formEditTrade.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEditTradeRecord();
      });
    }
    if (elements.btnDeleteTrade) {
      elements.btnDeleteTrade.addEventListener('click', deleteTradeRecord);
    }

    // 添加基金：输入代码防抖自动联想
    let debounceTimer = null;
    elements.inputFundCode.addEventListener('input', (e) => {
      const code = e.target.value.trim();
      clearTimeout(debounceTimer);
      if (code.length === 6) {
        elements.fundQueryStatus.textContent = '正在获取基金信息...';
        debounceTimer = setTimeout(async () => {
          try {
            const info = await FundAPI.fetchSingleFund(code);
            if (info && info.name) {
              elements.inputFundName.value = info.name;
              const newNav = parseFloat(info.nav) || 1.0;
              elements.inputCurrentNav.value = newNav;
              elements.fundQueryStatus.textContent = `最新单位净值: ${info.nav} (${info.navDate || '近期'})`;
              syncNavChanged(newNav);
            } else {
              elements.fundQueryStatus.textContent = '未检索到此基金，可手动填写名称与净值';
            }
          } catch (err) {
            elements.fundQueryStatus.textContent = '查询超时，可手动录入';
          }
        }, 300);
      } else {
        elements.fundQueryStatus.textContent = '输入后自动获取名称与净值';
      }
    });

    // 根据持仓金额计算并同步持仓份额
    function syncFromHoldingAmount() {
      if (isLinking) return;
      isLinking = true;
      try {
        const nav = parseFloat(elements.inputCurrentNav.value) || 1.0;
        const amountVal = elements.inputHoldingAmount.value.trim();

        if (amountVal === '') {
          elements.inputHoldingShares.value = '';
          if (lastProfitField === 'rate') {
            elements.inputProfitAmount.value = '';
          } else {
            elements.inputProfitRate.value = '';
          }
          updateAddModalBenchmarkDefaults('all');
          return;
        }

        const amount = parseFloat(amountVal);
        if (!isNaN(amount) && nav > 0) {
          elements.inputHoldingShares.value = (amount / nav).toFixed(2);
        }

        syncProfitFromHoldingChange(amount);
        updateAddModalBenchmarkDefaults('all');
      } finally {
        isLinking = false;
      }
    }

    // 根据持仓份额计算并同步持仓金额
    function syncFromHoldingShares() {
      if (isLinking) return;
      isLinking = true;
      try {
        const nav = parseFloat(elements.inputCurrentNav.value) || 1.0;
        const sharesVal = elements.inputHoldingShares.value.trim();

        if (sharesVal === '') {
          elements.inputHoldingAmount.value = '';
          if (lastProfitField === 'rate') {
            elements.inputProfitAmount.value = '';
          } else {
            elements.inputProfitRate.value = '';
          }
          updateAddModalBenchmarkDefaults('all');
          return;
        }

        const shares = parseFloat(sharesVal);
        if (!isNaN(shares) && nav > 0) {
          const amount = shares * nav;
          elements.inputHoldingAmount.value = amount.toFixed(2);
          syncProfitFromHoldingChange(amount);
        }
        updateAddModalBenchmarkDefaults('all');
      } finally {
        isLinking = false;
      }
    }

    // 当持仓金额改变时，保持持有收益或持有收益率联动
    function syncProfitFromHoldingChange(amount) {
      if (isNaN(amount) || amount <= 0) return;

      if (lastProfitField === 'rate') {
        const rateVal = elements.inputProfitRate.value.trim();
        if (rateVal !== '' && !isNaN(parseFloat(rateVal))) {
          const rate = parseFloat(rateVal);
          if (1 + rate / 100 > 0) {
            const profit = amount * ((rate / 100) / (1 + rate / 100));
            elements.inputProfitAmount.value = profit.toFixed(2);
          } else {
            elements.inputProfitAmount.value = (-amount).toFixed(2);
          }
        }
      } else {
        const profitVal = elements.inputProfitAmount.value.trim();
        if (profitVal !== '' && !isNaN(parseFloat(profitVal))) {
          const profit = parseFloat(profitVal);
          const principal = amount - profit;
          if (principal > 0) {
            elements.inputProfitRate.value = ((profit / principal) * 100).toFixed(2);
          } else {
            elements.inputProfitRate.value = '';
          }
        }
      }
    }

    // 用户编辑持有收益 (元)
    function syncFromProfitAmount() {
      if (isLinking) return;
      isLinking = true;
      try {
        lastProfitField = 'amount';
        const profitVal = elements.inputProfitAmount.value.trim();

        if (profitVal === '') {
          elements.inputProfitRate.value = '';
          updateAddModalBenchmarkDefaults('all');
          return;
        }

        const profit = parseFloat(profitVal);
        if (isNaN(profit)) return;

        const amountVal = elements.inputHoldingAmount.value.trim();
        const amount = parseFloat(amountVal);

        if (!isNaN(amount) && amount > 0) {
          const principal = amount - profit;
          if (principal > 0) {
            const rate = (profit / principal) * 100;
            elements.inputProfitRate.value = rate.toFixed(2);
          } else {
            elements.inputProfitRate.value = '';
          }
        }
        updateAddModalBenchmarkDefaults('all');
      } finally {
        isLinking = false;
      }
    }

    // 用户编辑持有收益率 (%)
    function syncFromProfitRate() {
      if (isLinking) return;
      isLinking = true;
      try {
        lastProfitField = 'rate';
        const rateVal = elements.inputProfitRate.value.trim();

        if (rateVal === '') {
          elements.inputProfitAmount.value = '';
          updateAddModalBenchmarkDefaults('all');
          return;
        }

        const rate = parseFloat(rateVal);
        if (isNaN(rate)) return;

        const amountVal = elements.inputHoldingAmount.value.trim();
        const amount = parseFloat(amountVal);

        if (!isNaN(amount) && amount > 0) {
          if (1 + rate / 100 > 0) {
            const profit = amount * ((rate / 100) / (1 + rate / 100));
            elements.inputProfitAmount.value = profit.toFixed(2);
          } else {
            elements.inputProfitAmount.value = (-amount).toFixed(2);
          }
        }
        updateAddModalBenchmarkDefaults('all');
      } finally {
        isLinking = false;
      }
    }

    // 当最新单位净值加载或更新时
    function syncNavChanged(newNav) {
      if (!newNav || newNav <= 0) return;
      const amountVal = elements.inputHoldingAmount.value.trim();
      const sharesVal = elements.inputHoldingShares.value.trim();

      if (amountVal !== '' && !isNaN(parseFloat(amountVal))) {
        const amount = parseFloat(amountVal);
        elements.inputHoldingShares.value = (amount / newNav).toFixed(2);
      } else if (sharesVal !== '' && !isNaN(parseFloat(sharesVal))) {
        const shares = parseFloat(sharesVal);
        const amount = shares * newNav;
        elements.inputHoldingAmount.value = amount.toFixed(2);
        syncProfitFromHoldingChange(amount);
      }
      updateAddModalBenchmarkDefaults('all');
    }

    function updateAddModalBenchmarkDefaults(side = 'all') {
      const nav = parseFloat(elements.inputCurrentNav.value) || 1.0;
      const amount = parseFloat(elements.inputHoldingAmount.value) || 0;
      const profit = parseFloat(elements.inputProfitAmount.value) || 0;
      let shares = parseFloat(elements.inputHoldingShares.value);
      if (isNaN(shares) || shares <= 0) {
        shares = nav > 0 ? amount / nav : 0;
      }
      const cost = Math.max(0, amount - profit);
      const unitCost = shares > 0 ? cost / shares : nav;

      if (side === 'buy' || side === 'all') {
        const mode = elements.selectBuyAnchorMode.value;
        if (mode !== 'fixedCost') {
          elements.inputBuyBenchmarkPrice.value = unitCost.toFixed(4);
        }
      }
      if (side === 'sell' || side === 'all') {
        const mode = elements.selectSellAnchorMode.value;
        if (mode !== 'fixedCost') {
          elements.inputSellBenchmarkPrice.value = unitCost.toFixed(4);
        }
      }
    }

    elements.inputHoldingAmount.addEventListener('input', syncFromHoldingAmount);
    elements.inputHoldingShares.addEventListener('input', syncFromHoldingShares);
    elements.inputProfitAmount.addEventListener('input', syncFromProfitAmount);
    elements.inputProfitRate.addEventListener('input', syncFromProfitRate);

    if (elements.selectBuyAnchorMode) {
      elements.selectBuyAnchorMode.addEventListener('change', () => {
        updateAddModalBenchmarkDefaults('buy');
      });
    }
    if (elements.inputBuyBenchmarkPrice) {
      elements.inputBuyBenchmarkPrice.addEventListener('input', () => {
        if (elements.selectBuyAnchorMode.value !== 'fixedCost') {
          elements.selectBuyAnchorMode.value = 'fixedCost';
        }
      });
    }

    if (elements.selectSellAnchorMode) {
      elements.selectSellAnchorMode.addEventListener('change', () => {
        updateAddModalBenchmarkDefaults('sell');
      });
    }
    if (elements.inputSellBenchmarkPrice) {
      elements.inputSellBenchmarkPrice.addEventListener('input', () => {
        if (elements.selectSellAnchorMode.value !== 'fixedCost') {
          elements.selectSellAnchorMode.value = 'fixedCost';
        }
      });
    }

    // 策略微调弹窗买卖基准交互联动
    if (elements.cfgBuyAnchorMode) {
      elements.cfgBuyAnchorMode.addEventListener('change', () => {
        const fund = currentFunds.find(f => f.id === elements.configFundId.value);
        if (!fund) return;
        const mode = elements.cfgBuyAnchorMode.value;
        if (mode === 'initialCost') {
          elements.cfgBuyBenchmarkPrice.value = (Number(fund.initialCost) || 1.0).toFixed(4);
        } else if (mode === 'avgCost') {
          elements.cfgBuyBenchmarkPrice.value = (Number(fund.avgCost) || Number(fund.initialCost) || 1.0).toFixed(4);
        } else if (mode === 'lastTrade') {
          elements.cfgBuyBenchmarkPrice.value = (Number(fund.lastTradePrice) || Number(fund.avgCost) || Number(fund.initialCost) || 1.0).toFixed(4);
        }
        updateStrategyModalPreview();
      });
    }

    if (elements.cfgBuyBenchmarkPrice) {
      elements.cfgBuyBenchmarkPrice.addEventListener('input', () => {
        if (elements.cfgBuyAnchorMode.value !== 'fixedCost') {
          elements.cfgBuyAnchorMode.value = 'fixedCost';
        }
        updateStrategyModalPreview();
      });
    }

    if (elements.cfgSellAnchorMode) {
      elements.cfgSellAnchorMode.addEventListener('change', () => {
        const fund = currentFunds.find(f => f.id === elements.configFundId.value);
        if (!fund) return;
        const mode = elements.cfgSellAnchorMode.value;
        if (mode === 'initialCost') {
          elements.cfgSellBenchmarkPrice.value = (Number(fund.initialCost) || 1.0).toFixed(4);
        } else if (mode === 'avgCost') {
          elements.cfgSellBenchmarkPrice.value = (Number(fund.avgCost) || Number(fund.initialCost) || 1.0).toFixed(4);
        } else if (mode === 'lastTrade') {
          elements.cfgSellBenchmarkPrice.value = (Number(fund.lastTradePrice) || Number(fund.avgCost) || Number(fund.initialCost) || 1.0).toFixed(4);
        }
        updateStrategyModalPreview();
      });
    }

    if (elements.cfgSellBenchmarkPrice) {
      elements.cfgSellBenchmarkPrice.addEventListener('input', () => {
        if (elements.cfgSellAnchorMode.value !== 'fixedCost') {
          elements.cfgSellAnchorMode.value = 'fixedCost';
        }
        updateStrategyModalPreview();
      });
    }

    // 保存持仓表单 (添加或修改)
    elements.formAddFund.addEventListener('submit', (e) => {
      e.preventDefault();
      saveNewFund();
    });

    // 记账表单 (加仓/减仓)
    if (elements.tradeDate) {
      elements.tradeDate.addEventListener('change', () => {
        updateTradeNoticeAndStatus();
      });
    }

    elements.formTrade.addEventListener('submit', (e) => {
      e.preventDefault();
      saveTradeRecord();
    });

    // 策略修改表单提交
    elements.formStrategyConfig.addEventListener('submit', (e) => {
      e.preventDefault();
      saveStrategyConfig();
    });

    // 增加档位按钮
    if (elements.btnAddTier) {
      elements.btnAddTier.addEventListener('click', () => {
        addNewTier();
      });
    }

    // 策略步长与总预算输入联动
    if (elements.cfgStepPercent) {
      elements.cfgStepPercent.addEventListener('input', () => {
        renderTiersEditor();
      });
    }
    if (elements.cfgPlannedAmount) {
      elements.cfgPlannedAmount.addEventListener('input', () => {
        updateStrategyModalPreview();
      });
    }

    // 设置与主题切换
    elements.btnThemeDark.addEventListener('click', () => applyTheme('dark'));
    elements.btnThemeLight.addEventListener('click', () => applyTheme('light'));
    elements.btnColorCn.addEventListener('click', () => applyColorMode('cn'));
    elements.btnColorIntl.addEventListener('click', () => applyColorMode('intl'));

    elements.chkSound.addEventListener('change', (e) => {
      currentSettings.soundEnabled = e.target.checked;
      FundStorage.saveSettings(currentSettings);
    });

    if (elements.chkAutoRefresh) {
      elements.chkAutoRefresh.addEventListener('change', (e) => {
        currentSettings.autoRefreshEnabled = e.target.checked;
        if (elements.autoRefreshIntervalRow) {
          elements.autoRefreshIntervalRow.style.display = e.target.checked ? 'flex' : 'none';
        }
        FundStorage.saveSettings(currentSettings);
        restartAutoRefresh();
      });
    }

    if (elements.inputAutoRefreshMinutes) {
      elements.inputAutoRefreshMinutes.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 120) val = 120;
        e.target.value = val;
        currentSettings.autoRefreshMinutes = val;
        FundStorage.saveSettings(currentSettings);
        restartAutoRefresh();
      });
    }

    elements.chkNotify.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const ok = await FundNotification.requestPermission();
        if (!ok) {
          e.target.checked = false;
          alert('请在浏览器设置中允许此网站发送通知');
        }
      }
      currentSettings.notifyEnabled = e.target.checked;
      FundStorage.saveSettings(currentSettings);
    });

    // 导出与导入
    elements.btnExportJSON.addEventListener('click', () => FundStorage.exportJSON());
    elements.btnTriggerImport.addEventListener('click', () => elements.fileImportJSON.click());
    elements.fileImportJSON.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          FundStorage.importJSON(event.target.result);
          alert('数据恢复成功！');
          location.reload();
        } catch (err) {
          alert('导入失败，请检查文件格式是否正确');
        }
      };
      reader.readAsText(file);
    });

    // 载入示例基金
    elements.btnLoadDemo.addEventListener('click', () => {
      if (confirm('载入精选示例数据？现有同名持仓将被更新。')) {
        FundStorage.saveFunds(FundStorage.DEMO_FUNDS);
        loadFunds();
        closeModal(elements.modalSettings);
        refreshData(false);
      }
    });

    // 清空数据
    elements.btnClearAll.addEventListener('click', () => {
      if (confirm('确定要清空所有持仓和设置吗？此操作不可逆！')) {
        FundStorage.clearAll();
        loadFunds();
        closeModal(elements.modalSettings);
        refreshData(false);
      }
    });
  }

  function openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('active');
  }

  /**
   * 打开新增基金弹窗
   */
  function openAddModal() {
    elements.formAddFund.reset();
    elements.editFundId.value = '';
    elements.inputFundCode.disabled = false;
    elements.modalAddFundTitle.textContent = '录入持仓基金';
    elements.fundQueryStatus.textContent = '输入后自动获取名称与净值';
    elements.inputCurrentNav.value = '1.0';
    elements.selectBuyAnchorMode.value = 'initialCost';
    elements.inputBuyBenchmarkPrice.value = '1.0000';
    elements.selectSellAnchorMode.value = 'initialCost';
    elements.inputSellBenchmarkPrice.value = '1.0000';
    elements.inputPlannedAmount.value = '15000';
    lastProfitField = 'amount';
    openModal(elements.modalAddFund);
    elements.inputFundCode.focus();
  }

  /**
   * 打开修改持仓弹窗
   */
  function openEditModal(fundId) {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) return;

    elements.formAddFund.reset();
    elements.editFundId.value = fund.id;
    elements.modalAddFundTitle.textContent = `修改持仓 - ${fund.name}`;
    elements.inputFundCode.value = fund.code;
    elements.inputFundCode.disabled = true; // 代码不可直接更改
    elements.inputFundName.value = fund.name;

    const val = currentValuations[fund.code];
    const officialNav = (val && val.nav) ? Number(val.nav) : (Number(fund.avgCost) || 1.0);
    elements.inputCurrentNav.value = officialNav;

    elements.inputHoldingShares.value = (Number(fund.shares) || 0).toFixed(2);
    elements.inputHoldingAmount.value = ((Number(fund.shares) || 0) * officialNav).toFixed(2);

    const totalProfit = (Number(fund.shares) || 0) * officialNav - (Number(fund.totalCost) || 0);
    elements.inputProfitAmount.value = totalProfit.toFixed(2);
    const profitRate = fund.totalCost > 0 ? (totalProfit / fund.totalCost) * 100 : 0;
    elements.inputProfitRate.value = profitRate.toFixed(2);
    lastProfitField = 'amount';

    elements.inputPlannedAmount.value = (fund.plannedAmount !== undefined && fund.plannedAmount !== null && fund.plannedAmount !== '') ? fund.plannedAmount : 15000;

    const buyMode = fund.buyAnchorMode || fund.anchorMode || 'initialCost';
    elements.selectBuyAnchorMode.value = buyMode;
    const defaultBuyPrice = (fund.buyBenchmarkPrice !== undefined && Number(fund.buyBenchmarkPrice) > 0) ? Number(fund.buyBenchmarkPrice) : (Number(fund.initialCost) || officialNav);
    elements.inputBuyBenchmarkPrice.value = defaultBuyPrice.toFixed(4);

    const sellMode = fund.sellAnchorMode || fund.anchorMode || 'initialCost';
    elements.selectSellAnchorMode.value = sellMode;
    const defaultSellPrice = (fund.sellBenchmarkPrice !== undefined && Number(fund.sellBenchmarkPrice) > 0) ? Number(fund.sellBenchmarkPrice) : (Number(fund.avgCost) || Number(fund.initialCost) || officialNav);
    elements.inputSellBenchmarkPrice.value = defaultSellPrice.toFixed(4);

    elements.fundQueryStatus.textContent = `当前单位净值: ${officialNav} (原持仓成本价: ¥${(Number(fund.avgCost) || 0).toFixed(4)})`;

    openModal(elements.modalAddFund);
  }

  /**
   * 保存录入或修改的持仓
   */
  function saveNewFund() {
    const isEdit = !!elements.editFundId.value;
    const code = elements.inputFundCode.value.trim();
    const name = elements.inputFundName.value.trim();
    const holdingAmount = elements.inputHoldingAmount.value;
    const holdingShares = elements.inputHoldingShares.value;
    const profitAmount = elements.inputProfitAmount.value;
    const profitRate = elements.inputProfitRate.value;
    const plannedAmount = elements.inputPlannedAmount.value;
    const buyAnchorMode = elements.selectBuyAnchorMode.value;
    const buyBenchmarkPrice = parseFloat(elements.inputBuyBenchmarkPrice.value) || 0;
    const sellAnchorMode = elements.selectSellAnchorMode.value;
    const sellBenchmarkPrice = parseFloat(elements.inputSellBenchmarkPrice.value) || 0;
    const currentNav = elements.inputCurrentNav.value;

    if (isEdit) {
      const fund = currentFunds.find(f => f.id === elements.editFundId.value);
      if (fund) {
        fund.name = name;
        const updated = FundStrategy.createInitialPosition({
          code: code,
          name: name,
          holdingAmount: holdingAmount,
          holdingShares: holdingShares,
          profitAmount: profitAmount,
          profitRate: profitRate,
          plannedAmount: plannedAmount,
          buyAnchorMode: buyAnchorMode,
          buyBenchmarkPrice: buyBenchmarkPrice,
          sellAnchorMode: sellAnchorMode,
          sellBenchmarkPrice: sellBenchmarkPrice,
          currentNav: currentNav,
          stepPercent: fund.stepPercent,
          tiers: fund.tiers
        });
        fund.shares = updated.shares;
        fund.totalCost = updated.totalCost;
        fund.avgCost = updated.avgCost;
        fund.initialCost = updated.initialCost;
        fund.plannedAmount = updated.plannedAmount;
        fund.buyAnchorMode = buyAnchorMode;
        fund.buyBenchmarkPrice = buyBenchmarkPrice || updated.initialCost;
        fund.sellAnchorMode = sellAnchorMode;
        fund.sellBenchmarkPrice = sellBenchmarkPrice || updated.avgCost;
        fund.anchorMode = buyAnchorMode;
        FundStorage.updateFund(fund);
      }
    } else {
      const fundObj = FundStrategy.createInitialPosition({
        code: code,
        name: name,
        holdingAmount: holdingAmount,
        holdingShares: holdingShares,
        profitAmount: profitAmount,
        profitRate: profitRate,
        plannedAmount: plannedAmount,
        buyAnchorMode: buyAnchorMode,
        buyBenchmarkPrice: buyBenchmarkPrice,
        sellAnchorMode: sellAnchorMode,
        sellBenchmarkPrice: sellBenchmarkPrice,
        currentNav: currentNav
      });
      FundStorage.addFund(fundObj);
    }

    elements.inputFundCode.disabled = false;
    elements.editFundId.value = '';
    loadFunds();
    closeModal(elements.modalAddFund);
    refreshData(false);
  }

  /**
   * 打开基金历程时间轴弹窗 (Timeline Modal)
   * 纵向排列展示：添加基金日期、加减仓记录、提醒到达买卖点事件
   * 最新时间点带有呼吸灯动效
   */
  function openTimelineModal(fundId) {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) {
      console.warn('[openTimelineModal] 未找到基金:', fundId);
      return;
    }

    if (elements.timelineModalTitle) {
      elements.timelineModalTitle.textContent = `${fund.name} (${fund.code})`;
    }
    if (elements.timelineModalSub) {
      elements.timelineModalSub.textContent = `初始建仓成本: ¥${(Number(fund.initialCost) || 0).toFixed(4)} · 当前持仓成本: ¥${(Number(fund.avgCost) || 0).toFixed(4)} · 累计交易: ${(fund.trades || []).length} 笔`;
    }

    const events = [];

    // 1. 基金录入/初始建仓事件
    const createdTime = fund.createdAt ? new Date(fund.createdAt).getTime() : 0;
    const createdDateStr = fund.createdAt ? fund.createdAt.replace('T', ' ').slice(0, 16) : '初始录入';
    events.push({
      id: 'event_init',
      type: 'init',
      title: '录入/初始建仓',
      timeStr: createdDateStr,
      timestamp: createdTime || 1,
      tagText: '🚀 初始建仓',
      tagClass: 'tag-init',
      dotClass: 'dot-init',
      content: `初始总本金 <strong>¥${(Number(fund.totalCost) || 0).toFixed(2)}</strong>，持仓份额 ${(Number(fund.shares) || 0).toFixed(2)} 份，初始成本价 ¥${(Number(fund.initialCost) || 0).toFixed(4)}`,
      subDetail: `买入基准方式: ${fund.buyAnchorMode === 'initialCost' ? '初始建仓价' : (fund.buyAnchorMode === 'avgCost' ? '当前持仓均价' : (fund.buyAnchorMode === 'lastTrade' ? '上次成交价' : '固定成本价'))} · 卖出基准方式: ${fund.sellAnchorMode === 'initialCost' ? '初始建仓价' : (fund.sellAnchorMode === 'avgCost' ? '当前持仓均价' : (fund.sellAnchorMode === 'lastTrade' ? '上次成交价' : '固定成本价'))}`
    });

    // 2. 加减仓记账事件 (来自 fund.trades)
    (fund.trades || []).forEach((trade, idx) => {
      if (trade.type === 'init') return; // 已在初始建仓中统一展示

      const isBuy = trade.type === 'buy';
      const isPending = trade.status === 'pending' || trade.isEstimated;
      const tradeTimeStr = trade.date || '交易记录';
      const tradeTs = trade.timestamp || (new Date(trade.date || fund.createdAt || 0).getTime() + idx * 1000);

      let mainDesc = '';
      let subDesc = '';
      if (isBuy) {
        if (isPending) {
          mainDesc = `申购加仓金额 <strong>¥${(Number(trade.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>，暂按参考估值 ¥${(Number(trade.price) || 0).toFixed(4)} 预估 ${(Number(trade.shares) || 0).toFixed(2)} 份 <span style="display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; margin-left: 4px;">⏳ 待收盘公布官方净值后自动校准</span>`;
        } else {
          mainDesc = `申购加仓金额 <strong>¥${(Number(trade.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>，成交官方净值 ¥${(Number(trade.price) || 0).toFixed(4)}，确认份额 ${(Number(trade.shares) || 0).toFixed(2)} 份 <span style="display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; background: rgba(16, 185, 129, 0.15); color: var(--color-down); margin-left: 4px;">✅ 官方净值已确认</span>`;
        }
      } else {
        if (isPending) {
          mainDesc = `赎回减仓份额 <strong>${(Number(trade.shares) || 0).toFixed(2)} 份</strong>，暂按参考估值 ¥${(Number(trade.price) || 0).toFixed(4)} 预估赎回金额 ¥${(Number(trade.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; margin-left: 4px;">⏳ 待收盘公布官方净值后自动校准</span>`;
        } else {
          mainDesc = `赎回减仓份额 <strong>${(Number(trade.shares) || 0).toFixed(2)} 份</strong>，成交官方净值 ¥${(Number(trade.price) || 0).toFixed(4)}，赎回金额 ¥${(Number(trade.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; background: rgba(16, 185, 129, 0.15); color: var(--color-down); margin-left: 4px;">✅ 官方净值已确认</span>`;
        }
        if (trade.realizedProfit !== undefined) {
          subDesc += `实现盈亏: ${trade.realizedProfit >= 0 ? '+' : ''}¥${trade.realizedProfit.toFixed(2)} · `;
        }
      }
      if (trade.remark) {
        subDesc += `备注: ${trade.remark}`;
      }

      let tagText = isBuy ? '➕ 加仓记账' : '➖ 减仓记账';
      let tagClass = isBuy ? 'tag-buy' : 'tag-sell';
      let dotClass = isBuy ? 'dot-buy' : 'dot-sell';
      if (isPending) {
        tagText = isBuy ? '⏳ 待确认加仓' : '⏳ 待确认减仓';
        tagClass = 'tag-pending';
        dotClass = 'dot-pending';
      }

      if (!trade.id) trade.id = `trade_${idx}_${trade.timestamp || Date.now()}`;

      events.push({
        id: trade.id,
        tradeId: trade.id,
        canEdit: true,
        type: isBuy ? 'buy' : 'sell',
        title: isPending ? (isBuy ? '加仓申报 (待官方净值确认)' : '减仓申报 (待官方净值确认)') : (isBuy ? '加仓买入记账' : '减仓赎回记账'),
        timeStr: tradeTimeStr,
        timestamp: tradeTs,
        tagText: tagText,
        tagClass: tagClass,
        dotClass: dotClass,
        content: mainDesc,
        subDetail: subDesc
      });
    });

    // 3. 买卖点触发提醒事件 (来自 fund.alertHistory)
    (fund.alertHistory || []).forEach((alert, idx) => {
      const isBuy = alert.type === 'buy_alert';
      const alertTimeStr = `${alert.date || ''} ${alert.time || ''}`.trim() || '点位提醒';
      const alertTs = alert.timestamp || (new Date(alert.date || 0).getTime() + idx * 1000);

      let mainDesc = '';
      if (isBuy) {
        mainDesc = `盘中参考估值达 <strong class="tabular-nums">¥${(Number(alert.currentPrice) || 0).toFixed(4)}</strong>，触及第 ${alert.level} 档买点 (触发价 ¥${(Number(alert.triggerPrice) || 0).toFixed(4)})，建议买入 <strong>¥${(Number(alert.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (约 ${(Number(alert.estShares) || 0).toFixed(2)} 份)`;
      } else {
        mainDesc = `盘中参考估值达 <strong class="tabular-nums">¥${(Number(alert.currentPrice) || 0).toFixed(4)}</strong>，触及第 ${alert.level} 档卖点 (触发价 ¥${(Number(alert.triggerPrice) || 0).toFixed(4)})，建议减仓 <strong>${(Number(alert.shares) || 0).toFixed(2)} 份</strong>`;
      }

      events.push({
        id: alert.id || `alert_${idx}`,
        type: alert.type,
        title: isBuy ? `买点到达提醒 (第${alert.level}档)` : `卖点到达提醒 (第${alert.level}档)`,
        timeStr: alertTimeStr,
        timestamp: alertTs,
        tagText: isBuy ? '🚨 买点到达' : '🚨 卖点到达',
        tagClass: isBuy ? 'tag-buy_alert' : 'tag-sell_alert',
        dotClass: isBuy ? 'dot-buy_alert' : 'dot-sell_alert',
        content: mainDesc,
        subDetail: '系统根据当前设定的金字塔阶梯策略自动监测判定'
      });
    });

    // 按时间降序排序（最新时间点排在最顶端）
    events.sort((a, b) => b.timestamp - a.timestamp);

    if (elements.timelineContainer) {
      if (events.length === 0) {
        elements.timelineContainer.innerHTML = `
          <div style="text-align: center; padding: 36px 12px; color: var(--text-muted); font-size: 13px;">
            暂无历史事件记录
          </div>
        `;
      } else {
        let html = '<div class="timeline-track">';
        events.forEach((ev, index) => {
          const isLatest = index === 0;
          html += `
            <div class="timeline-item">
              <div class="timeline-dot ${ev.dotClass} ${isLatest ? 'latest breathing-glow' : ''}" title="${isLatest ? '最新时间节点 (呼吸灯提示)' : ''}"></div>
              <div class="timeline-card ${isLatest ? 'is-latest-card' : ''}">
                <div class="timeline-header">
                  <div class="timeline-badge-group">
                    <span class="timeline-tag ${ev.tagClass}">${ev.tagText}</span>
                    ${isLatest ? '<span class="timeline-latest-pill"><span class="pill-dot" style="width: 5px; height: 5px; background: #60a5fa; animation: pulse-dot 1s infinite;"></span> 最新事件</span>' : ''}
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    ${ev.canEdit ? `<button type="button" class="timeline-btn-edit" data-action="edit-trade" data-fund-id="${fund.id}" data-trade-id="${ev.tradeId}" title="修改此笔交易的金额、净值与份额">✏️ 修改</button>` : ''}
                    <span class="timeline-time tabular-nums">${ev.timeStr}</span>
                  </div>
                </div>
                <div class="timeline-body">${ev.content}</div>
                ${ev.subDetail ? `<div class="timeline-sub-detail">${ev.subDetail}</div>` : ''}
              </div>
            </div>
          `;
        });
        html += '</div>';
        elements.timelineContainer.innerHTML = html;
      }
    }

    openModal(elements.modalTimeline);
  }

  /**
   * 打开加仓/减仓记账弹窗（完全安全，支持快捷带入推荐点位与规模，支持15:00未知价自动校准）
   */
  function openTradeModal(fundId, type = 'buy', prefillData = null) {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) {
      console.warn('[openTradeModal] 未找到基金:', fundId);
      return;
    }

    elements.formTrade.reset();
    elements.tradeFundId.value = fundId;
    elements.tradeType.value = type;
    elements.tradeFundInfo.textContent = `${fund.name} (${fund.code})`;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    elements.tradeDate.value = todayStr;

    const val = currentValuations[fund.code];
    let priceCandidate = (val && val.currentPrice && !isNaN(val.currentPrice))
      ? Number(val.currentPrice)
      : (Number(fund.avgCost) || Number(fund.initialCost) || 1.0);
    if (prefillData && prefillData.price) {
      priceCandidate = Number(prefillData.price);
    }
    elements.tradePrice.value = priceCandidate.toFixed(4);

    const currentShares = (typeof fund.shares === 'number' && !isNaN(fund.shares)) ? fund.shares : 0;

    if (type === 'buy') {
      elements.modalTradeTitle.textContent = '记录加仓 (申购买入)';
      elements.tradeBuySection.style.display = 'block';
      elements.tradeSellSection.style.display = 'none';
      elements.btnSubmitTrade.textContent = '确认加仓记账';
      if (prefillData && prefillData.amount) {
        elements.tradeBuyAmount.value = Number(prefillData.amount).toFixed(2);
      }
    } else {
      elements.modalTradeTitle.textContent = '记录减仓 (赎回卖出)';
      elements.tradeBuySection.style.display = 'none';
      elements.tradeSellSection.style.display = 'block';
      elements.maxSellSharesTip.textContent = `当前持仓: ${currentShares.toFixed(2)} 份`;
      elements.btnSubmitTrade.textContent = '确认减仓记账';
      if (prefillData && prefillData.shares) {
        elements.tradeSellShares.value = Number(prefillData.shares).toFixed(2);
      }
    }

    if (prefillData && prefillData.remark) {
      elements.tradeRemark.value = prefillData.remark;
    }

    // 动态刷新 15:00 交易规则与官方净值公布状态提示
    updateTradeNoticeAndStatus(fund);

    openModal(elements.modalTrade);
  }

  /**
   * 动态更新加减仓弹窗的交易规则提示与净值状态
   */
  function updateTradeNoticeAndStatus(fund) {
    if (!fund) {
      fund = currentFunds.find(f => f.id === elements.tradeFundId.value);
    }
    if (!fund) return;

    const tradeDate = elements.tradeDate.value;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const isToday = tradeDate === todayStr;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isBefore1500 = (currentHour < 15) || (currentHour === 15 && currentMinute === 0);

    const val = currentValuations[fund.code];
    const hasOfficialNavForDate = val && val.nav && Number(val.nav) > 0 && val.navDate === tradeDate;

    if (hasOfficialNavForDate) {
      if (elements.tradeNavRuleTip) {
        elements.tradeNavRuleTip.style.background = 'rgba(16, 185, 129, 0.08)';
        elements.tradeNavRuleTip.style.borderColor = 'rgba(16, 185, 129, 0.25)';
      }
      if (elements.tradeNavRuleText) {
        elements.tradeNavRuleText.innerHTML = `✅ <strong>官方净值已公布</strong>：${tradeDate} 官方收盘净值为 <strong>¥${Number(val.nav).toFixed(4)}</strong>，本次交易将直接以正式净值记账确认。`;
      }
      if (elements.tradePriceStatusBadge) {
        elements.tradePriceStatusBadge.textContent = '（官方正式净值）';
        elements.tradePriceStatusBadge.style.color = 'var(--color-down)';
      }
      if (elements.tradeAutoConfirmOption) {
        elements.tradeAutoConfirmOption.style.display = 'none';
      }
      if (elements.chkAutoConfirmNav) {
        elements.chkAutoConfirmNav.checked = false;
      }
      elements.tradePrice.value = Number(val.nav).toFixed(4);
    } else if (isToday) {
      if (isBefore1500) {
        if (elements.tradeNavRuleTip) {
          elements.tradeNavRuleTip.style.background = 'rgba(59, 130, 246, 0.08)';
          elements.tradeNavRuleTip.style.borderColor = 'rgba(59, 130, 246, 0.25)';
        }
        if (elements.tradeNavRuleText) {
          elements.tradeNavRuleText.innerHTML = `💡 <strong>公募基金未知价成交规则</strong>：在 <strong>15:00 前</strong> 执行的加减仓申报，成交价格为<strong>当天交易日收盘后公布的官方净值</strong>（通常当晚 20:00~22:00 公布）。系统当前以盘中参考估值暂记，待官方净值公布后（今晚或次日刷新拉取时）系统将<strong>自动校准确认</strong>真实净值与份额。`;
        }
        if (elements.tradePriceStatusBadge) {
          elements.tradePriceStatusBadge.textContent = '（盘中参考估值 · 待收盘确认）';
          elements.tradePriceStatusBadge.style.color = '#3b82f6';
        }
        if (elements.tradeAutoConfirmOption) {
          elements.tradeAutoConfirmOption.style.display = 'block';
        }
        if (elements.chkAutoConfirmNav) {
          elements.chkAutoConfirmNav.checked = true;
        }
      } else {
        if (elements.tradeNavRuleTip) {
          elements.tradeNavRuleTip.style.background = 'rgba(245, 158, 11, 0.1)';
          elements.tradeNavRuleTip.style.borderColor = 'rgba(245, 158, 11, 0.25)';
        }
        if (elements.tradeNavRuleText) {
          elements.tradeNavRuleText.innerHTML = `⚠️ <strong>盘后委托提醒</strong>：当前已超过 15:00，公募基金申报通常顺延至<strong>下一交易日 (T+1) 收盘官方净值</strong>成交。勾选自动校准后，系统将自动跟踪官方净值并核准确认。`;
        }
        if (elements.tradePriceStatusBadge) {
          elements.tradePriceStatusBadge.textContent = '（盘后估值参考）';
          elements.tradePriceStatusBadge.style.color = '#f59e0b';
        }
        if (elements.tradeAutoConfirmOption) {
          elements.tradeAutoConfirmOption.style.display = 'block';
        }
        if (elements.chkAutoConfirmNav) {
          elements.chkAutoConfirmNav.checked = true;
        }
      }
    } else {
      if (elements.tradeNavRuleTip) {
        elements.tradeNavRuleTip.style.background = 'rgba(255, 255, 255, 0.04)';
        elements.tradeNavRuleTip.style.borderColor = 'var(--border-glass)';
      }
      if (elements.tradeNavRuleText) {
        elements.tradeNavRuleText.innerHTML = `ℹ️ 自定义日期交易：若已在交易软件中查到该笔实际成交净值，可直接填入；若开启自动校准，系统将尝试匹配官方历史净值确认。`;
      }
      if (elements.tradePriceStatusBadge) {
        elements.tradePriceStatusBadge.textContent = '（参考输入）';
        elements.tradePriceStatusBadge.style.color = 'var(--text-muted)';
      }
      if (elements.tradeAutoConfirmOption) {
        elements.tradeAutoConfirmOption.style.display = 'block';
      }
    }
  }

  /**
   * 保存交易记录
   */
  function saveTradeRecord() {
    const fundId = elements.tradeFundId.value;
    const type = elements.tradeType.value;
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) return;

    const date = elements.tradeDate.value;
    const price = parseFloat(elements.tradePrice.value) || fund.avgCost;
    const remark = elements.tradeRemark.value;
    const autoConfirm = elements.chkAutoConfirmNav ? elements.chkAutoConfirmNav.checked : true;

    // 检查当前交易日的官方净值是否已公布
    const val = currentValuations[fund.code];
    const isOfficialNavAvailable = val && val.nav && Number(val.nav) > 0 && val.navDate === date;

    // 如果未公布官方净值且勾选了自动确认，则标记为待收盘官方净值确认 (pending)
    const isPending = autoConfirm && !isOfficialNavAvailable;
    const status = isPending ? 'pending' : 'confirmed';
    const isEstimated = isPending;
    const targetNavDate = date;

    let tradeRemark = remark;
    if (isPending) {
      tradeRemark = tradeRemark ? `${tradeRemark} (15:00前预估暂记)` : '15:00前预估暂记，待收盘官方净值自动确认';
    }

    if (type === 'buy') {
      const amount = parseFloat(elements.tradeBuyAmount.value) || 0;
      if (amount <= 0) {
        alert('请输入有效的买入金额！');
        return;
      }
      FundStrategy.applyBuy(fund, {
        amount,
        price,
        date,
        status,
        isEstimated,
        autoConfirm,
        targetNavDate,
        remark: tradeRemark
      });
    } else {
      const shares = parseFloat(elements.tradeSellShares.value) || 0;
      if (shares <= 0) {
        alert('请输入有效的卖出份额！');
        return;
      }
      if (shares > fund.shares + 0.0001) {
        alert(`赎回份额 (${shares.toFixed(2)}) 超过了当前可用持仓 (${fund.shares.toFixed(2)})！`);
        return;
      }
      FundStrategy.applySell(fund, {
        shares,
        price,
        date,
        status,
        isEstimated,
        autoConfirm,
        targetNavDate,
        remark: tradeRemark
      });
    }

    FundStorage.updateFund(fund);
    loadFunds();
    closeModal(elements.modalTrade);
    refreshData(false);

    if (isPending) {
      showToast(`📝 <strong>加减仓已记录</strong><br>由于在 15:00 前执行，当前按盘中估值暂记；今日收盘公布官方净值后（今晚或次日刷新时）系统将<strong>自动校准确认</strong>真实份额！`, 5500);
    } else {
      showToast(`✅ <strong>记账成功</strong><br>已按成交净值 ¥${price.toFixed(4)} 确认交易！`, 3000);
    }
  }

  /**
   * 打开修改加减仓记录弹窗
   */
  function openEditTradeModal(fundId, tradeId) {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund || !Array.isArray(fund.trades)) return;
    const trade = fund.trades.find(t => t.id === tradeId);
    if (!trade) return;

    elements.formEditTrade.reset();
    elements.editTradeFundId.value = fundId;
    elements.editTradeId.value = tradeId;
    elements.editTradeType.value = trade.type;
    elements.editTradeFundInfo.textContent = `${fund.name} (${fund.code})`;

    const isBuy = trade.type === 'buy';
    if (isBuy) {
      elements.modalEditTradeTitle.textContent = '修改加仓记录 (申购)';
      elements.editTradeTypeBadge.className = 'timeline-tag tag-buy';
      elements.editTradeTypeBadge.textContent = '➕ 加仓申购';
      elements.editTradeAmountLabel.textContent = '申购加仓金额 (元)';
      elements.editTradeSharesLabel.textContent = '确认份额 (份)';
      lastEditedTradeField = 'amount';
    } else {
      elements.modalEditTradeTitle.textContent = '修改减仓记录 (赎回)';
      elements.editTradeTypeBadge.className = 'timeline-tag tag-sell';
      elements.editTradeTypeBadge.textContent = '➖ 减仓赎回';
      elements.editTradeAmountLabel.textContent = '赎回减仓金额 (元)';
      elements.editTradeSharesLabel.textContent = '赎回份额 (份)';
      lastEditedTradeField = 'shares';
    }

    elements.editTradeDate.value = trade.date || new Date().toISOString().split('T')[0];
    const price = (Number(trade.price) || (Number(trade.shares) > 0 ? Number(trade.amount) / Number(trade.shares) : 1.0));
    elements.editTradePrice.value = price.toFixed(4);

    const shares = Number(trade.shares) || 0;
    elements.editTradeShares.value = shares.toFixed(2);

    const amount = (Number(trade.amount) || (shares * price));
    elements.editTradeAmount.value = amount.toFixed(2);

    elements.editTradeRemark.value = trade.remark || '';
    openModal(elements.modalEditTrade);
  }

  function syncEditTradeFromAmount() {
    if (isTradeLinking) return;
    isTradeLinking = true;
    try {
      lastEditedTradeField = 'amount';
      const amount = parseFloat(elements.editTradeAmount.value);
      const price = parseFloat(elements.editTradePrice.value);
      if (!isNaN(amount) && !isNaN(price) && price > 0) {
        elements.editTradeShares.value = (amount / price).toFixed(2);
      }
    } finally {
      isTradeLinking = false;
    }
  }

  function syncEditTradeFromShares() {
    if (isTradeLinking) return;
    isTradeLinking = true;
    try {
      lastEditedTradeField = 'shares';
      const shares = parseFloat(elements.editTradeShares.value);
      const price = parseFloat(elements.editTradePrice.value);
      if (!isNaN(shares) && !isNaN(price) && price > 0) {
        elements.editTradeAmount.value = (shares * price).toFixed(2);
      }
    } finally {
      isTradeLinking = false;
    }
  }

  function syncEditTradeFromPrice() {
    if (isTradeLinking) return;
    isTradeLinking = true;
    try {
      const price = parseFloat(elements.editTradePrice.value);
      if (!isNaN(price) && price > 0) {
        if (lastEditedTradeField === 'shares') {
          const shares = parseFloat(elements.editTradeShares.value);
          if (!isNaN(shares) && shares > 0) {
            elements.editTradeAmount.value = (shares * price).toFixed(2);
          }
        } else {
          const amount = parseFloat(elements.editTradeAmount.value);
          if (!isNaN(amount) && amount > 0) {
            elements.editTradeShares.value = (amount / price).toFixed(2);
          }
        }
      }
    } finally {
      isTradeLinking = false;
    }
  }

  /**
   * 保存修改的交易记录并严格确保 金额 = 份额 * 净值
   */
  function saveEditTradeRecord() {
    const fundId = elements.editTradeFundId.value;
    const tradeId = elements.editTradeId.value;
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund || !Array.isArray(fund.trades)) return;

    const trade = fund.trades.find(t => t.id === tradeId);
    if (!trade) return;

    const price = parseFloat(elements.editTradePrice.value) || 0;
    const shares = parseFloat(elements.editTradeShares.value) || 0;
    const amountInput = parseFloat(elements.editTradeAmount.value) || 0;
    const date = elements.editTradeDate.value;
    const remark = elements.editTradeRemark.value.trim();

    if (price <= 0) {
      alert('请输入有效的成交确认净值！');
      return;
    }
    if (shares <= 0 || amountInput <= 0) {
      alert('加减仓金额与份额必须大于 0！');
      return;
    }

    // 严格确保 金额 = 确认份额 * 净值
    const exactAmount = Number((shares * price).toFixed(2));

    trade.price = price;
    trade.shares = shares;
    trade.amount = exactAmount;
    trade.date = date;
    trade.remark = remark;
    trade.status = 'confirmed';
    trade.isEstimated = false;
    trade.confirmedNav = price;
    trade.confirmedAt = new Date().toISOString();

    // 重新推演持仓与加权成本
    FundStrategy.recalculateFundPositions(fund);
    FundStorage.updateFund(fund);

    loadFunds();
    closeModal(elements.modalEditTrade);
    openTimelineModal(fund.id); // 刷新时间轴展示
    refreshData(false);

    showToast(`✅ <strong>交易已更新</strong><br>已按 <strong>¥${exactAmount.toFixed(2)} = ${shares.toFixed(2)} 份 × ¥${price.toFixed(4)}</strong> 完成校准并重算持仓！`, 3500);
  }

  /**
   * 删除指定的加减仓记录
   */
  function deleteTradeRecord() {
    const fundId = elements.editTradeFundId.value;
    const tradeId = elements.editTradeId.value;
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund || !Array.isArray(fund.trades)) return;

    if (!confirm('确定要删除这笔交易记录吗？删除后将依据剩余交易重新计算持仓份额与成本！此操作不可逆。')) {
      return;
    }

    fund.trades = fund.trades.filter(t => t.id !== tradeId);
    FundStrategy.recalculateFundPositions(fund);
    FundStorage.updateFund(fund);

    loadFunds();
    closeModal(elements.modalEditTrade);
    openTimelineModal(fund.id);
    refreshData(false);

    showToast('🗑️ 该笔交易记录已删除，持仓已重新计算！', 3000);
  }

  /**
   * 打开策略微调弹窗
   */
  function openStrategyModal(fundId) {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) return;

    elements.configFundId.value = fundId;
    elements.cfgStepPercent.value = fund.stepPercent || 5.0;
    elements.cfgPlannedAmount.value = (fund.plannedAmount !== undefined && fund.plannedAmount !== null && fund.plannedAmount !== '') ? fund.plannedAmount : 10000;

    const buyMode = fund.buyAnchorMode || fund.anchorMode || 'initialCost';
    elements.cfgBuyAnchorMode.value = buyMode;
    const defaultBuyPrice = (fund.buyBenchmarkPrice !== undefined && Number(fund.buyBenchmarkPrice) > 0) ? Number(fund.buyBenchmarkPrice) : (Number(fund.initialCost) || 1.0);
    elements.cfgBuyBenchmarkPrice.value = defaultBuyPrice.toFixed(4);

    const sellMode = fund.sellAnchorMode || fund.anchorMode || 'initialCost';
    elements.cfgSellAnchorMode.value = sellMode;
    const defaultSellPrice = (fund.sellBenchmarkPrice !== undefined && Number(fund.sellBenchmarkPrice) > 0) ? Number(fund.sellBenchmarkPrice) : (Number(fund.avgCost) || Number(fund.initialCost) || 1.0);
    elements.cfgSellBenchmarkPrice.value = defaultSellPrice.toFixed(4);

    // 深拷贝档位列表供动态编辑
    currentEditingTiers = JSON.parse(JSON.stringify(fund.tiers && fund.tiers.length > 0 ? fund.tiers : FundStrategy.DEFAULT_CONFIG.tiers));

    renderTiersEditor();
    openModal(elements.modalStrategyConfig);
  }

  /**
   * 渲染动态档位编辑器（支持加减格子）
   */
  function renderTiersEditor() {
    if (!elements.cfgTiersList) return;
    elements.cfgTiersList.innerHTML = '';
    const step = parseFloat(elements.cfgStepPercent.value) || 5.0;

    let sumRatio = 0;
    currentEditingTiers.forEach((tier, index) => {
      const ratio = parseFloat(tier.buyRatio) || 0;
      sumRatio += ratio;
      const triggerPct = (step * (index + 1)).toFixed(1);

      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);';
      row.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; min-width: 52px;">第 ${index + 1} 档</div>
        <div style="font-size: 11px; color: var(--text-muted); min-width: 96px;">跌 -${triggerPct}% / 涨 +${triggerPct}%</div>
        <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
          <input type="number" step="any" min="0" max="100" class="form-input tier-ratio-input" data-index="${index}" value="${ratio}" style="padding: 4px 8px; font-size: 13px; text-align: right; height: 32px;">
          <span style="font-size: 12px; color: var(--text-muted)">%</span>
        </div>
        ${currentEditingTiers.length > 1 ? `<button type="button" class="btn btn-sm btn-icon-only btn-remove-tier" data-index="${index}" style="width: 30px; height: 30px; color: var(--text-muted); border: none; background: transparent;" title="删除此档">✕</button>` : '<div style="width: 30px;"></div>'}
      `;
      elements.cfgTiersList.appendChild(row);
    });

    // 绑定格子数值输入与删除事件
    elements.cfgTiersList.querySelectorAll('.tier-ratio-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        const val = parseFloat(e.target.value) || 0;
        if (currentEditingTiers[idx]) {
          currentEditingTiers[idx].buyRatio = val;
          currentEditingTiers[idx].sellRatio = val;
        }
        validateTiersRatio();
        updateStrategyModalPreview();
      });
    });

    elements.cfgTiersList.querySelectorAll('.btn-remove-tier').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        currentEditingTiers.splice(idx, 1);
        currentEditingTiers.forEach((t, i) => {
          t.step = i + 1;
        });
        renderTiersEditor();
      });
    });

    validateTiersRatio();
    updateStrategyModalPreview();
  }

  /**
   * 增加一个新档位
   */
  function addNewTier() {
    const step = parseFloat(elements.cfgStepPercent.value) || 5.0;
    let sum = 0;
    currentEditingTiers.forEach(t => sum += (parseFloat(t.buyRatio) || 0));

    // 计算推荐补充比例（剩余比例或 10%）
    const remaining = Math.max(5, 100 - sum);
    const nextLevel = currentEditingTiers.length + 1;

    currentEditingTiers.push({
      step: nextLevel,
      percent: step * nextLevel,
      buyRatio: remaining > 0 ? remaining : 10,
      sellRatio: remaining > 0 ? remaining : 10
    });

    renderTiersEditor();
  }

  /**
   * 校验各档总比例是否超过 100%
   */
  function validateTiersRatio() {
    let sum = 0;
    currentEditingTiers.forEach(t => sum += (parseFloat(t.buyRatio) || 0));

    const isOver = sum > 100;
    if (elements.cfgTotalRatioBadge) {
      elements.cfgTotalRatioBadge.textContent = `合计: ${sum.toFixed(1)}%${isOver ? ' (超过100%)' : ''}`;
      elements.cfgTotalRatioBadge.style.background = isOver ? 'var(--color-up-bg)' : 'rgba(16, 185, 129, 0.2)';
      elements.cfgTotalRatioBadge.style.color = isOver ? 'var(--color-up)' : 'var(--color-down)';
    }
    if (elements.cfgTierErrorMsg) {
      elements.cfgTierErrorMsg.style.display = isOver ? 'block' : 'none';
      if (isOver) {
        elements.cfgTierErrorMsg.textContent = `⚠️ 各档买卖仓位比例之和已达 ${sum.toFixed(1)}%（超过 100%），请调整后再保存！`;
      }
    }

    return !isOver;
  }

  /**
   * 动态生成策略对照预览表 (点位 vs 规模)
   */
  function updateStrategyModalPreview() {
    if (!elements.cfgPreviewTable) return;
    const step = parseFloat(elements.cfgStepPercent.value) || 5.0;
    const buyPrice = parseFloat(elements.cfgBuyBenchmarkPrice.value) || 1.0;
    const sellPrice = parseFloat(elements.cfgSellBenchmarkPrice.value) || 1.0;

    let rows = '';
    currentEditingTiers.forEach((tier, index) => {
      const p = (step * (index + 1)).toFixed(1);
      const buyTrigger = (buyPrice * (1 - p / 100)).toFixed(4);
      const sellTrigger = (sellPrice * (1 + p / 100)).toFixed(4);
      const isLast = index === currentEditingTiers.length - 1;
      const borderStyle = isLast ? '' : 'border-bottom: 1px dashed var(--border-glass);';

      rows += `
        <div style="display: flex; align-items: center; justify-content: flex-start; padding: 6px 0; ${borderStyle} font-size: 12px; gap: 4px; flex-wrap: wrap;">
          <strong style="color: var(--text-primary); min-width: 48px;">第 ${index + 1} 档：</strong>
          <span style="white-space: nowrap;">跌 <span style="color: var(--color-down); font-weight: 600;">-${p}%</span> (买价 <span class="tabular-nums" style="color: var(--color-down); font-weight: 600;">¥${buyTrigger}</span>)</span>
          <span style="color: var(--text-muted); opacity: 0.5; margin: 0 4px;">｜</span>
          <span style="white-space: nowrap;">涨 <span style="color: var(--color-up); font-weight: 600;">+${p}%</span> (卖价 <span class="tabular-nums" style="color: var(--color-up); font-weight: 600;">¥${sellTrigger}</span>)</span>
        </div>
      `;
    });

    elements.cfgPreviewTable.innerHTML = rows;
  }

  /**
   * 保存策略修改
   */
  function saveStrategyConfig() {
    const fundId = elements.configFundId.value;
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) return;

    // 校验总和不可超过 100%
    let sum = 0;
    currentEditingTiers.forEach(t => sum += (parseFloat(t.buyRatio) || 0));
    if (sum > 100) {
      alert(`各档买卖仓位比例之和不能超过 100%（当前合计已达 ${sum.toFixed(1)}%），请调整后再保存！`);
      return;
    }

    const step = parseFloat(elements.cfgStepPercent.value) || 5.0;
    const plannedVal = elements.cfgPlannedAmount.value.trim();
    const planned = (plannedVal !== '' && !isNaN(Number(plannedVal))) ? Math.max(0, parseFloat(plannedVal)) : 10000;
    const buyAnchorMode = elements.cfgBuyAnchorMode.value;
    const buyBenchmarkPrice = parseFloat(elements.cfgBuyBenchmarkPrice.value) || fund.initialCost;
    const sellAnchorMode = elements.cfgSellAnchorMode.value;
    const sellBenchmarkPrice = parseFloat(elements.cfgSellBenchmarkPrice.value) || fund.avgCost || fund.initialCost;

    fund.stepPercent = step;
    fund.plannedAmount = planned;
    fund.buyAnchorMode = buyAnchorMode;
    fund.buyBenchmarkPrice = buyBenchmarkPrice;
    fund.sellAnchorMode = sellAnchorMode;
    fund.sellBenchmarkPrice = sellBenchmarkPrice;
    fund.anchorMode = buyAnchorMode; // 兼容
    fund.tiers = currentEditingTiers.map((t, idx) => ({
      step: idx + 1,
      percent: step * (idx + 1),
      buyRatio: parseFloat(t.buyRatio) || 0,
      sellRatio: parseFloat(t.sellRatio) || 0
    }));

    FundStorage.updateFund(fund);
    loadFunds();
    closeModal(elements.modalStrategyConfig);
    refreshData(false);
  }

  /**
   * 删除持仓基金
   */
  function deleteFundConfirm(fundId) {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) return;
    if (confirm(`确定要移除持仓基金【${fund.name} (${fund.code})】吗？所有交易记录也将被移除。`)) {
      currentFunds = FundStorage.deleteFund(fundId);
      refreshData(false);
    }
  }

  /**
   * 按需载入示例基金
   */
  function loadDemoData() {
    FundStorage.saveFunds(FundStorage.DEMO_FUNDS);
    loadFunds();
    refreshData(false);
  }

  // 暴露公共方法供外部与 HTML 调用
  window.App = {
    openAddModal,
    openEditModal,
    openTradeModal,
    openEditTradeModal,
    openStrategyModal,
    openTimelineModal,
    deleteFundConfirm,
    loadDemoData
  };

  // 页面加载完成后启动
  document.addEventListener('DOMContentLoaded', () => {
    init();

    // 注册 PWA Service Worker (若支持)
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('[PWA] Service Worker 注册就绪');
        // 页面打开时主动检查服务端是否有更新的 sw.js
        reg.update();
      }).catch(err => {
        console.log('[PWA] Service Worker 注册跳过:', err);
      });

      // 当新版本 Service Worker 接管页面时，自动平滑重载页面
      let isRefreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isRefreshing) {
          isRefreshing = true;
          window.location.reload();
        }
      });
    }
  });
})();
