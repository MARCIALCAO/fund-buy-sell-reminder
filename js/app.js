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
    selectAnchorMode: document.getElementById('selectAnchorMode'),
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
    btnSubmitTrade: document.getElementById('btnSubmitTrade'),

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
    cfgAnchorMode: document.getElementById('cfgAnchorMode'),
    cfgPreviewTable: document.getElementById('cfgPreviewTable'),

    // 系统设置与备份弹窗
    modalSettings: document.getElementById('modalSettings'),
    btnThemeDark: document.getElementById('btnThemeDark'),
    btnThemeLight: document.getElementById('btnThemeLight'),
    btnColorCn: document.getElementById('btnColorCn'),
    btnColorIntl: document.getElementById('btnColorIntl'),
    chkSound: document.getElementById('chkSound'),
    chkNotify: document.getElementById('chkNotify'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnTriggerImport: document.getElementById('btnTriggerImport'),
    fileImportJSON: document.getElementById('fileImportJSON'),
    btnLoadDemo: document.getElementById('btnLoadDemo'),
    btnClearAll: document.getElementById('btnClearAll')
  };

  /**
   * 应用初始化入口
   */
  async function init() {
    loadSettings();
    loadFunds();
    bindEvents();
    init1400Scheduler();
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

  /**
   * 初始化 14:00 定时抓取调度器（交易日精准一次）
   */
  function init1400Scheduler() {
    updateSnapshotPillUI();

    FundNotification.initScheduler(async (isScheduled1400) => {
      console.log('[App] 14:00 定时抓取触发！执行单次拉取与策略分析...');
      await refreshData(isScheduled1400);
      updateSnapshotPillUI();
    });
  }

  /**
   * 更新 14:00 抓取状态小胶囊 UI
   */
  function updateSnapshotPillUI() {
    const isTodayDone = FundNotification.hasSnapshotTakenToday();
    const isTradingDay = FundNotification.isTradingDay();

    if (!isTradingDay) {
      elements.snapshotStatusPill.className = 'snapshot-pill';
      elements.snapshotStatusText.textContent = '非交易日 (休市)';
      return;
    }

    if (isTodayDone) {
      elements.snapshotStatusPill.className = 'snapshot-pill done';
      elements.snapshotStatusText.textContent = '14:00 已抓取快照';
    } else {
      const now = new Date();
      if (now.getHours() < 14) {
        elements.snapshotStatusPill.className = 'snapshot-pill';
        elements.snapshotStatusText.textContent = '14:00 待抓取';
      } else {
        elements.snapshotStatusPill.className = 'snapshot-pill done';
        elements.snapshotStatusText.textContent = '今日交易已收盘';
      }
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
   * 渲染资产总览卡片 (Summary)
   * 严格按照官方公布正式净值计算持仓市值与累计收益
   */
  function renderSummary(analyses) {
    let totalMarketValue = 0;
    let totalCost = 0;
    let totalPlannedBudget = 0;
    let totalTodayEstimatedProfit = 0;
    let latestUpdateTime = '--:--';

    analyses.forEach(item => {
      totalMarketValue += item.marketValue; // 按正式 NAV 计算的市值
      totalCost += item.totalCost;
      const fund = currentFunds.find(f => f.id === item.fundId);
      if (fund) totalPlannedBudget += (fund.plannedAmount || 0);
      totalTodayEstimatedProfit += item.todayEstimatedProfit;
      if (item.gzTime && item.gzTime > latestUpdateTime) {
        latestUpdateTime = item.gzTime.split(' ')[1] || item.gzTime;
      }
    });

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

    // 今日盘中预估浮动
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

      // 下一步买点信息（份额保留2位小数）
      let nextBuyHtml = '';
      if (item.nextBuy) {
        const isTriggered = item.nextBuy.isTriggered;
        const buySharesFormatted = (Number(item.nextBuy.estShares) || 0).toFixed(2);
        nextBuyHtml = `
          <div class="action-pill ${isTriggered ? 'buy-alert' : ''}">
            <div class="action-header">
              <span style="color: var(--color-down)">${isTriggered ? '🚨 已触及买点 (第' + item.nextBuy.level + '档)' : '📉 下一买点 (第' + item.nextBuy.level + '档)'}</span>
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
        nextSellHtml = `
          <div class="action-pill ${isTriggered ? 'sell-alert' : ''}">
            <div class="action-header">
              <span style="color: var(--color-up)">${isTriggered ? '🚨 已触及卖点 (第' + item.nextSell.level + '档)' : '📈 下一卖点 (第' + item.nextSell.level + '档)'}</span>
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

      // 锚点说明与格式化
      const anchorDesc = fund.anchorMode === 'avgCost' ? '持仓均价' : (fund.anchorMode === 'lastTrade' ? '最近成交价' : '初始建仓价');
      const sharesFormatted = (Number(item.shares) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const shortNavDate = item.navDate ? (item.navDate.length > 5 ? item.navDate.slice(5) : item.navDate) : '';
      const timeOnly = item.gzTime ? (item.gzTime.includes(' ') ? item.gzTime.split(' ')[1] : item.gzTime) : '';
      const gzTimeDisplay = item.hasValuation ? `${timeOnly} 估值` : '收盘净值计';

      card.innerHTML = `
        <div class="fund-header">
          <div class="fund-info-group">
            <div class="fund-name">
              <span>${item.name}</span>
            </div>
            <div class="fund-meta">
              <span class="fund-code">${item.code}</span>
              <span>基准: ${anchorDesc} (¥${item.basePrice.toFixed(4)})</span>
            </div>
          </div>
          <div class="fund-rate-group">
            <div class="fund-rate-badge ${rateClass} tabular-nums">
              <span class="rate-label">今日预估</span>
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
              <span class="metric-title">累计持有收益 (盈亏率)</span>
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
              <span class="metric-title">盘中参考估值</span>
              <span class="metric-number tabular-nums">
                ${item.hasValuation ? '¥' + item.gsz.toFixed(4) : '以净值计'}
              </span>
            </div>

            <div class="metric-col">
              <span class="metric-title">今日预估浮动</span>
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
            <span class="anchor-tag">偏离基准：${(item.deviationFromBase >= 0 ? '+' : '') + item.deviationFromBase.toFixed(2)}%</span>
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
          <button class="btn btn-sm" data-action="edit" data-fund-id="${item.fundId}">
            ✏️ 修改持仓
          </button>
          <button class="btn btn-sm" data-action="strategy" data-fund-id="${item.fundId}">
            ⚙️ 策略微调
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
   */
  function renderLadderTrack(item) {
    const buyTiers = item.buyLadders || [];
    const sellTiers = item.sellLadders || [];

    const steps = [];

    // 买入档位（越深越在左侧）
    for (let i = buyTiers.length - 1; i >= 0; i--) {
      steps.push({
        label: `-${buyTiers[i].percent}%`,
        buyTier: buyTiers[i]
      });
    }

    // 中间基准
    steps.push({ label: '基准', isBase: true });

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
      if (step.buyTier && step.buyTier.isTriggered) {
        activeClass = 'active-buy';
      } else if (step.sellTier && step.sellTier.isTriggered) {
        activeClass = 'active-sell';
      }

      barsHtml += `
        <div class="tier-step-item">
          <div class="tier-bar ${activeClass}"></div>
          <span class="tier-label">${step.label}</span>
        </div>
      `;
    });

    return `<div class="ladder-track">${barsHtml}</div>`;
  }

  /**
   * 检查买卖信号并触发告警横幅、音效与通知
   */
  function checkSignalAlerts(analyses, isFrom1400 = false) {
    const triggeredList = [];

    analyses.forEach(item => {
      if (item.triggeredBuy) {
        triggeredList.push({
          type: 'buy',
          name: item.name,
          code: item.code,
          level: item.triggeredBuy.level,
          amount: item.triggeredBuy.amount
        });
      }
      if (item.triggeredSell) {
        triggeredList.push({
          type: 'sell',
          name: item.name,
          code: item.code,
          level: item.triggeredSell.level,
          shares: item.triggeredSell.shares
        });
      }
    });

    if (triggeredList.length > 0) {
      // 顶部常驻快捷提醒按钮展示
      if (elements.btnToggleSignalAlert) {
        elements.btnToggleSignalAlert.style.display = 'inline-flex';
        if (elements.signalBadgeText) {
          elements.signalBadgeText.textContent = `${triggeredList.length} 笔买卖提醒`;
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

      let msg = `检测到 `;
      if (buyCount > 0) msg += `${buyCount} 笔加仓信号 `;
      if (sellCount > 0) msg += `${sellCount} 笔减仓信号`;
      elements.alertTitle.textContent = `🚨 买卖点已触及（${msg}）`;

      const details = triggeredList.map(t => {
        if (t.type === 'buy') {
          return `${t.name}: 达买点第${t.level}档，建议买入 ¥${(Number(t.amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
          return `${t.name}: 达卖点第${t.level}档，建议减仓 ${(Number(t.shares) || 0).toFixed(2)} 份`;
        }
      }).join('；');

      elements.alertDesc.textContent = details;

      // 如果是 14:00 定时抓取或检测到信号，触发声音与系统弹窗
      if (isFrom1400) {
        const hasBuy = buyCount > 0;
        FundNotification.playChime(hasBuy ? 'buy' : 'sell');
        FundNotification.sendSystemNotification('【基金金字塔交易点位预警】', details);
      }
    } else {
      if (elements.btnToggleSignalAlert) {
        elements.btnToggleSignalAlert.style.display = 'none';
      }
      elements.signalAlertBanner.classList.remove('active');
      isAlertBannerHiddenByUser = false;
    }
  }

  /**
   * 复制买卖指令文本
   */
  function copySignalText() {
    const text = elements.alertDesc.textContent;
    if (!text) return;
    navigator.clipboard.writeText(`【金字塔买卖提醒】\n${text}\n执行时间：${new Date().toLocaleTimeString()}`).then(() => {
      alert('已复制操作建议文本至剪贴板，可直接前往交易软件操作！');
    }).catch(() => {
      prompt('请手动复制以下操作指令：', text);
    });
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

    // 持仓列表容器事件委托（处理加仓、减仓、修改、策略、删除）
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
      } else if (action === 'edit') {
        openEditModal(fundId);
      } else if (action === 'strategy') {
        openStrategyModal(fundId);
      } else if (action === 'delete') {
        deleteFundConfirm(fundId);
      }
    });

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
              elements.inputCurrentNav.value = info.nav || 1.0;
              elements.fundQueryStatus.textContent = `最新单位净值: ${info.nav} (${info.navDate || '近期'})`;
              calcSharesFromAmount();
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

    elements.inputHoldingAmount.addEventListener('input', calcSharesFromAmount);
    function calcSharesFromAmount() {
      const nav = parseFloat(elements.inputCurrentNav.value) || 1.0;
      const amount = parseFloat(elements.inputHoldingAmount.value) || 0;
      if (amount > 0 && nav > 0 && !elements.inputHoldingShares.value) {
        elements.inputHoldingShares.placeholder = `约 ${(amount / nav).toFixed(2)} 份`;
      }
    }

    // 保存持仓表单 (添加或修改)
    elements.formAddFund.addEventListener('submit', (e) => {
      e.preventDefault();
      saveNewFund();
    });

    // 记账表单 (加仓/减仓)
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
    elements.selectAnchorMode.value = 'initialCost';
    elements.inputPlannedAmount.value = '15000';
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

    elements.inputPlannedAmount.value = fund.plannedAmount || 15000;
    elements.selectAnchorMode.value = fund.anchorMode || 'initialCost';
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
    const anchorMode = elements.selectAnchorMode.value;
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
          anchorMode: anchorMode,
          currentNav: currentNav,
          stepPercent: fund.stepPercent,
          tiers: fund.tiers
        });
        fund.shares = updated.shares;
        fund.totalCost = updated.totalCost;
        fund.avgCost = updated.avgCost;
        fund.initialCost = updated.initialCost;
        fund.plannedAmount = updated.plannedAmount;
        fund.anchorMode = updated.anchorMode;
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
        anchorMode: anchorMode,
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
   * 打开加仓/减仓记账弹窗（完全安全，杜绝异常）
   */
  function openTradeModal(fundId, type = 'buy') {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) {
      console.warn('[openTradeModal] 未找到基金:', fundId);
      return;
    }

    elements.formTrade.reset();
    elements.tradeFundId.value = fundId;
    elements.tradeType.value = type;
    elements.tradeFundInfo.textContent = `${fund.name} (${fund.code})`;
    elements.tradeDate.value = new Date().toISOString().split('T')[0];

    const val = currentValuations[fund.code];
    const priceCandidate = (val && val.currentPrice && !isNaN(val.currentPrice))
      ? Number(val.currentPrice)
      : (Number(fund.avgCost) || Number(fund.initialCost) || 1.0);
    elements.tradePrice.value = priceCandidate.toFixed(4);

    const currentShares = (typeof fund.shares === 'number' && !isNaN(fund.shares)) ? fund.shares : 0;

    if (type === 'buy') {
      elements.modalTradeTitle.textContent = '记录加仓 (申购买入)';
      elements.tradeBuySection.style.display = 'block';
      elements.tradeSellSection.style.display = 'none';
      elements.btnSubmitTrade.textContent = '确认加仓';
    } else {
      elements.modalTradeTitle.textContent = '记录减仓 (赎回卖出)';
      elements.tradeBuySection.style.display = 'none';
      elements.tradeSellSection.style.display = 'block';
      elements.maxSellSharesTip.textContent = `当前持仓: ${currentShares.toFixed(2)} 份`;
      elements.btnSubmitTrade.textContent = '确认减仓';
    }

    openModal(elements.modalTrade);
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

    if (type === 'buy') {
      const amount = parseFloat(elements.tradeBuyAmount.value) || 0;
      if (amount <= 0) {
        alert('请输入有效的买入金额！');
        return;
      }
      FundStrategy.applyBuy(fund, { amount, price, date, remark });
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
      FundStrategy.applySell(fund, { shares, price, date, remark });
    }

    FundStorage.updateFund(fund);
    loadFunds();
    closeModal(elements.modalTrade);
    refreshData(false);
  }

  /**
   * 打开策略微调弹窗
   */
  function openStrategyModal(fundId) {
    const fund = currentFunds.find(f => f.id === fundId);
    if (!fund) return;

    elements.configFundId.value = fundId;
    elements.cfgStepPercent.value = fund.stepPercent || 5.0;
    elements.cfgPlannedAmount.value = fund.plannedAmount || 10000;
    elements.cfgAnchorMode.value = fund.anchorMode || 'initialCost';

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
          <input type="number" min="1" max="100" class="form-input tier-ratio-input" data-index="${index}" value="${ratio}" style="padding: 4px 8px; font-size: 13px; text-align: right; height: 32px;">
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
    const budget = parseFloat(elements.cfgPlannedAmount.value) || 10000;

    let rows = '';
    currentEditingTiers.forEach((tier, index) => {
      const p = (step * (index + 1)).toFixed(1);
      const r = parseFloat(tier.buyRatio) || 0;
      const buyAmt = Math.round(budget * (r / 100));

      rows += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.06);">
          <span><strong>第 ${index + 1} 档：</strong>跌 <span style="color: var(--color-down)">-${p}%</span> (涨 <span style="color: var(--color-up)">+${p}%</span>)</span>
          <span>买入 <strong style="color: var(--color-down)">${r}%</strong> (¥${buyAmt.toLocaleString()}) ｜ 卖出 <strong style="color: var(--color-up)">${r}%</strong></span>
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
    const planned = parseFloat(elements.cfgPlannedAmount.value) || 10000;
    const anchor = elements.cfgAnchorMode.value;

    fund.stepPercent = step;
    fund.plannedAmount = planned;
    fund.anchorMode = anchor;
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
    openStrategyModal,
    deleteFundConfirm,
    loadDemoData
  };

  // 页面加载完成后启动
  document.addEventListener('DOMContentLoaded', () => {
    init();

    // 注册 PWA Service Worker (若支持)
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').then(() => {
        console.log('[PWA] Service Worker 注册就绪');
      }).catch(err => {
        console.log('[PWA] Service Worker 注册跳过:', err);
      });
    }
  });
})();
