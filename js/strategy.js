/**
 * 金字塔与倒金字塔核心算法模型
 */

const FundStrategy = {
  // 默认策略配置
  DEFAULT_CONFIG: {
    stepPercent: 5, // 每档步长（%）
    tiers: [
      { step: 1, percent: 5, buyRatio: 10, sellRatio: 10 },
      { step: 2, percent: 10, buyRatio: 20, sellRatio: 20 },
      { step: 3, percent: 15, buyRatio: 30, sellRatio: 30 },
      { step: 4, percent: 20, buyRatio: 40, sellRatio: 40 }
    ],
    buyAnchorMode: 'initialCost',  // 买入基准: 'initialCost' | 'fixedCost' | 'lastTrade' | 'avgCost'
    sellAnchorMode: 'initialCost', // 卖出基准: 'initialCost' | 'fixedCost' | 'lastTrade' | 'avgCost'
    anchorMode: 'initialCost',     // 兼容字段
    plannedAmount: 10000 // 默认计划总投入金额（元）
  },

  /**
   * 初始化持仓数据反推
   * @param {Object} input
   *  - code: 基金代码
   *  - name: 基金名称
   *  - holdingAmount: 用户输入的当前持有金额（元），与 holdingShares 二选一
   *  - holdingShares: 用户输入的当前持有份额（份）
   *  - profitAmount: 用户输入的当前累计盈亏（元），与 profitRate 二选一
   *  - profitRate: 用户输入的当前盈亏率（%，如 5.5 表示 +5.5%）
   *  - currentNav: 当前最新单位净值 (NAV)
   *  - plannedAmount: 计划总投入预算（元）
   *  - buyAnchorMode: 买入基准模式
   *  - buyBenchmarkPrice: 买入基准价格
   *  - sellAnchorMode: 卖出基准模式
   *  - sellBenchmarkPrice: 卖出基准价格
   */
  createInitialPosition(input) {
    const currentNav = parseFloat(input.currentNav) || 1.0;
    let shares = 0;
    let holdingAmount = 0;

    if (input.holdingShares !== undefined && input.holdingShares !== null && input.holdingShares !== '') {
      shares = parseFloat(input.holdingShares) || 0;
      holdingAmount = shares * currentNav;
    } else {
      holdingAmount = parseFloat(input.holdingAmount) || 0;
      shares = currentNav > 0 ? holdingAmount / currentNav : 0;
    }

    let profit = 0;
    if (input.profitAmount !== undefined && input.profitAmount !== null && input.profitAmount !== '') {
      profit = parseFloat(input.profitAmount) || 0;
    } else if (input.profitRate !== undefined && input.profitRate !== null && input.profitRate !== '') {
      const rate = parseFloat(input.profitRate) || 0;
      // profit = holdingAmount - holdingAmount / (1 + rate / 100)
      if (rate !== -100) {
        const cost = holdingAmount / (1 + rate / 100);
        profit = holdingAmount - cost;
      }
    }

    const totalCost = Math.max(0, holdingAmount - profit);
    const unitCost = shares > 0 ? totalCost / shares : currentNav;

    const buyAnchorMode = input.buyAnchorMode || input.anchorMode || this.DEFAULT_CONFIG.buyAnchorMode;
    const sellAnchorMode = input.sellAnchorMode || input.anchorMode || this.DEFAULT_CONFIG.sellAnchorMode;
    const buyBenchmarkPrice = (input.buyBenchmarkPrice !== undefined && input.buyBenchmarkPrice !== null && input.buyBenchmarkPrice !== '') ? parseFloat(input.buyBenchmarkPrice) : unitCost;
    const sellBenchmarkPrice = (input.sellBenchmarkPrice !== undefined && input.sellBenchmarkPrice !== null && input.sellBenchmarkPrice !== '') ? parseFloat(input.sellBenchmarkPrice) : unitCost;

    return {
      id: 'fund_' + String(input.code) + '_' + Date.now(),
      code: String(input.code).trim(),
      name: input.name || '待获取基金',
      shares: shares, // 当前持有份额
      totalCost: totalCost, // 总投入成本
      avgCost: unitCost, // 持仓均价
      initialCost: unitCost, // 初始建仓成本价（默认锚点）
      lastTradePrice: unitCost, // 最新交易价
      plannedAmount: parseFloat(input.plannedAmount) || this.DEFAULT_CONFIG.plannedAmount,
      buyAnchorMode: buyAnchorMode,
      buyBenchmarkPrice: buyBenchmarkPrice,
      sellAnchorMode: sellAnchorMode,
      sellBenchmarkPrice: sellBenchmarkPrice,
      anchorMode: buyAnchorMode, // 兼容历史字段
      stepPercent: parseFloat(input.stepPercent) || this.DEFAULT_CONFIG.stepPercent,
      tiers: input.tiers || JSON.parse(JSON.stringify(this.DEFAULT_CONFIG.tiers)),
      createdAt: new Date().toISOString(),
      alertHistory: input.alertHistory || [],
      trades: [
        {
          id: 'trade_init_' + Date.now(),
          type: 'init', // 初始建仓
          date: new Date().toISOString().split('T')[0],
          amount: totalCost,
          shares: shares,
          price: unitCost,
          remark: '初始建仓/录入',
          timestamp: Date.now()
        }
      ]
    };
  },

  /**
   * 计算单只基金当前分析数据（盈亏、下一次买卖点、各阶梯状态）
   * @param {Object} fund 持仓对象
   * @param {Object} valuation 实时估值对象 (来自 FundAPI)
   */
  analyzePosition(fund, valuation) {
    const officialNav = (valuation && valuation.nav && !isNaN(valuation.nav)) ? Number(valuation.nav) : (Number(fund.avgCost) || 1.0);
    const navDate = (valuation && valuation.navDate) ? valuation.navDate : '';
    const currentPrice = (valuation && valuation.gsz && !isNaN(valuation.gsz)) ? Number(valuation.gsz) : officialNav;
    const gsz = valuation ? valuation.gsz : null;
    const gszzl = valuation ? valuation.gszzl : 0;
    const gzTime = valuation ? valuation.gzTime : '';
    const hasValuation = valuation ? valuation.hasValuation : false;

    // 持仓市值与累计盈亏（严格按照正式公布的官方净值 NAV 计算）
    const marketValue = fund.shares * officialNav;
    const totalProfit = marketValue - fund.totalCost;
    const profitRate = fund.totalCost > 0 ? (totalProfit / fund.totalCost) * 100 : 0;

    // 今日预估浮动盈亏（元）（基于盘中实时估值相比上一净值的变动）
    const todayChangePercent = gszzl || 0;
    const todayEstimatedProfit = hasValuation ? (fund.shares * officialNav * (todayChangePercent / 100)) : 0;

    // 1. 确定买入基准价格
    const buyAnchorMode = fund.buyAnchorMode || fund.anchorMode || 'initialCost';
    let buyBasePrice = (fund.buyBenchmarkPrice !== undefined && fund.buyBenchmarkPrice !== null && !isNaN(fund.buyBenchmarkPrice) && Number(fund.buyBenchmarkPrice) > 0) ? Number(fund.buyBenchmarkPrice) : fund.initialCost;
    if (buyAnchorMode === 'avgCost') {
      buyBasePrice = fund.avgCost;
    } else if (buyAnchorMode === 'initialCost') {
      buyBasePrice = fund.initialCost;
    } else if (buyAnchorMode === 'lastTrade') {
      buyBasePrice = fund.lastTradePrice || fund.avgCost || fund.initialCost;
    } else if (buyAnchorMode === 'fixedCost') {
      buyBasePrice = (fund.buyBenchmarkPrice && Number(fund.buyBenchmarkPrice) > 0) ? Number(fund.buyBenchmarkPrice) : (fund.initialCost || currentPrice);
    }
    if (!buyBasePrice || buyBasePrice <= 0) buyBasePrice = currentPrice;

    // 2. 确定卖出基准价格
    const sellAnchorMode = fund.sellAnchorMode || fund.anchorMode || 'initialCost';
    let sellBasePrice = (fund.sellBenchmarkPrice !== undefined && fund.sellBenchmarkPrice !== null && !isNaN(fund.sellBenchmarkPrice) && Number(fund.sellBenchmarkPrice) > 0) ? Number(fund.sellBenchmarkPrice) : fund.initialCost;
    if (sellAnchorMode === 'avgCost') {
      sellBasePrice = fund.avgCost;
    } else if (sellAnchorMode === 'initialCost') {
      sellBasePrice = fund.initialCost;
    } else if (sellAnchorMode === 'lastTrade') {
      sellBasePrice = fund.lastTradePrice || fund.avgCost || fund.initialCost;
    } else if (sellAnchorMode === 'fixedCost') {
      sellBasePrice = (fund.sellBenchmarkPrice && Number(fund.sellBenchmarkPrice) > 0) ? Number(fund.sellBenchmarkPrice) : (fund.avgCost || fund.initialCost || currentPrice);
    }
    if (!sellBasePrice || sellBasePrice <= 0) sellBasePrice = currentPrice;

    const modeDescMap = {
      initialCost: '建仓价',
      fixedCost: '固定价',
      lastTrade: '上次成交',
      avgCost: '持仓均价'
    };
    const buyAnchorDesc = modeDescMap[buyAnchorMode] || '建仓价';
    const sellAnchorDesc = modeDescMap[sellAnchorMode] || '建仓价';

    // 相对买入基准与卖出基准的涨跌偏离度（%）
    const buyDeviation = ((currentPrice - buyBasePrice) / buyBasePrice) * 100;
    const sellDeviation = ((currentPrice - sellBasePrice) / sellBasePrice) * 100;

    // 计算各阶梯买入点（金字塔：基于 buyBasePrice 越跌越买）与卖出点（倒金字塔：基于 sellBasePrice 越涨越卖）
    const tiers = (fund.tiers && fund.tiers.length > 0) ? fund.tiers : this.DEFAULT_CONFIG.tiers;
    const plannedAmount = fund.plannedAmount || this.DEFAULT_CONFIG.plannedAmount;

    const buyLadders = [];
    const sellLadders = [];

    let nextBuy = null;
    let nextSell = null;
    let triggeredBuy = null;
    let triggeredSell = null;

    // 1. 金字塔买入阶梯（基于 buyBasePrice 跌 5%, 10%, 15%, 20%...）
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const targetPercent = tier.percent; // 如 5, 10, 15, 20
      const triggerPrice = buyBasePrice * (1 - targetPercent / 100);
      const buyAmount = (plannedAmount * (tier.buyRatio / 100));
      const estBuyShares = triggerPrice > 0 ? buyAmount / triggerPrice : 0;

      // 判断是否已达到或穿透触发点
      const isTriggered = currentPrice <= triggerPrice;
      const distPercent = ((triggerPrice - currentPrice) / currentPrice) * 100; // 离当前还差多少%（负数代表还需再跌多少）

      const ladderItem = {
        level: i + 1,
        percent: targetPercent,
        ratio: tier.buyRatio,
        triggerPrice: triggerPrice,
        amount: buyAmount,
        estShares: estBuyShares,
        isTriggered: isTriggered,
        distPercent: distPercent
      };
      buyLadders.push(ladderItem);

      // 寻找下一个未触发的买入阶梯（距离当前价格最近且在价格下方的买点）
      if (!nextBuy && !isTriggered) {
        nextBuy = ladderItem;
      }
      // 记录最新被触发的档位
      if (isTriggered) {
        triggeredBuy = ladderItem;
      }
    }

    // 2. 倒金字塔卖出阶梯（基于 sellBasePrice 涨 5%, 10%, 15%, 20%...）
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const targetPercent = tier.percent; // 如 5, 10, 15, 20
      const triggerPrice = sellBasePrice * (1 + targetPercent / 100);
      const sellShares = fund.shares * (tier.sellRatio / 100);
      const estSellAmount = sellShares * triggerPrice;

      // 判断是否已达到或穿透触发点
      const isTriggered = currentPrice >= triggerPrice;
      const distPercent = ((triggerPrice - currentPrice) / currentPrice) * 100; // 离当前还差多少%（正数代表还需再涨多少）

      const ladderItem = {
        level: i + 1,
        percent: targetPercent,
        ratio: tier.sellRatio,
        triggerPrice: triggerPrice,
        shares: sellShares,
        estAmount: estSellAmount,
        isTriggered: isTriggered,
        distPercent: distPercent
      };
      sellLadders.push(ladderItem);

      // 寻找下一个未触发的卖出阶梯（在当前价格上方的卖点）
      if (!nextSell && !isTriggered) {
        nextSell = ladderItem;
      }
      // 记录最新被触发的卖出档位
      if (isTriggered) {
        triggeredSell = ladderItem;
      }
    }

    // 如果所有买点都已触发，下一个就是最深一档
    if (!nextBuy && buyLadders.length > 0) {
      nextBuy = buyLadders[buyLadders.length - 1];
    }
    // 如果所有卖点都已触发，下一个就是最高一档
    if (!nextSell && sellLadders.length > 0) {
      nextSell = sellLadders[sellLadders.length - 1];
    }

    return {
      fundId: fund.id,
      code: fund.code,
      name: fund.name,
      currentPrice: currentPrice, // 盘中参考最新价
      officialNav: officialNav,   // 正式公布的单位净值
      currentNav: officialNav,    // 兼容字段
      navDate: navDate,           // 正式净值公布日期
      gsz: gsz,                   // 今日盘中参考估值
      gszzl: gszzl,               // 估值涨跌幅 %
      gzTime: gzTime,
      hasValuation: hasValuation,
      shares: fund.shares,
      totalCost: fund.totalCost,
      avgCost: fund.avgCost,
      buyBasePrice: buyBasePrice,
      sellBasePrice: sellBasePrice,
      buyAnchorMode: buyAnchorMode,
      sellAnchorMode: sellAnchorMode,
      buyAnchorDesc: buyAnchorDesc,
      sellAnchorDesc: sellAnchorDesc,
      buyDeviation: buyDeviation,
      sellDeviation: sellDeviation,
      basePrice: buyBasePrice, // 兼容字段
      deviationFromBase: buyDeviation, // 兼容字段
      marketValue: marketValue,
      totalProfit: totalProfit,
      profitRate: profitRate,
      todayEstimatedProfit: todayEstimatedProfit,
      buyLadders: buyLadders,
      sellLadders: sellLadders,
      nextBuy: nextBuy,
      nextSell: nextSell,
      triggeredBuy: triggeredBuy, // 盘中已触及买点的最高档位（需提示买入）
      triggeredSell: triggeredSell // 盘中已触及卖点的最高档位（需提示卖出）
    };
  },

  /**
   * 执行手动加仓（买入）
   * @param {Object} fund 持仓对象
   * @param {Object} tradeRecord
   *  - amount: 买入金额（元）
   *  - price: 成交净值 (买入净值)
   *  - date: 成交日期
   *  - remark: 备注
   */
  applyBuy(fund, tradeRecord) {
    const buyAmount = parseFloat(tradeRecord.amount) || 0;
    const price = parseFloat(tradeRecord.price) || fund.avgCost;
    if (buyAmount <= 0 || price <= 0) return fund;

    const boughtShares = buyAmount / price;
    const newShares = fund.shares + boughtShares;
    const newTotalCost = fund.totalCost + buyAmount;
    const newAvgCost = newShares > 0 ? newTotalCost / newShares : price;

    fund.shares = newShares;
    fund.totalCost = newTotalCost;
    fund.avgCost = newAvgCost;
    fund.lastTradePrice = price;

    // 自动联动更新最新基准价（若选择上一次成交价或持仓均价模式）
    if (fund.buyAnchorMode === 'lastTrade') fund.buyBenchmarkPrice = price;
    if (fund.buyAnchorMode === 'avgCost') fund.buyBenchmarkPrice = newAvgCost;
    if (fund.sellAnchorMode === 'lastTrade') fund.sellBenchmarkPrice = price;
    if (fund.sellAnchorMode === 'avgCost') fund.sellBenchmarkPrice = newAvgCost;

    if (!Array.isArray(fund.trades)) fund.trades = [];
    fund.trades.push({
      id: 'trade_' + Date.now(),
      type: 'buy',
      date: tradeRecord.date || new Date().toISOString().split('T')[0],
      amount: buyAmount,
      shares: boughtShares,
      price: price,
      status: tradeRecord.status || 'confirmed',
      isEstimated: !!tradeRecord.isEstimated,
      autoConfirm: tradeRecord.autoConfirm !== undefined ? tradeRecord.autoConfirm : true,
      targetNavDate: tradeRecord.targetNavDate || tradeRecord.date || new Date().toISOString().split('T')[0],
      remark: tradeRecord.remark || '手动加仓',
      timestamp: Date.now()
    });

    return fund;
  },

  /**
   * 执行手动减仓（卖出）
   * @param {Object} fund 持仓对象
   * @param {Object} tradeRecord
   *  - shares: 卖出份额（份），与 amount 二选一
   *  - amount: 卖出金额（元）
   *  - price: 成交净值
   *  - date: 成交日期
   *  - remark: 备注
   */
  applySell(fund, tradeRecord) {
    const price = parseFloat(tradeRecord.price) || fund.avgCost;
    let sellShares = 0;
    let sellAmount = 0;

    if (tradeRecord.shares !== undefined && tradeRecord.shares !== null && tradeRecord.shares !== '') {
      sellShares = parseFloat(tradeRecord.shares) || 0;
      sellAmount = sellShares * price;
    } else {
      sellAmount = parseFloat(tradeRecord.amount) || 0;
      sellShares = price > 0 ? sellAmount / price : 0;
    }

    if (sellShares <= 0 || price <= 0) return fund;

    // 扣减持仓与对应成本
    const oldAvgCost = fund.avgCost;
    const costDeduction = sellShares * oldAvgCost;
    const newShares = Math.max(0, fund.shares - sellShares);
    const newTotalCost = Math.max(0, fund.totalCost - costDeduction);
    const newAvgCost = newShares > 0 ? newTotalCost / newShares : oldAvgCost;

    fund.shares = newShares;
    fund.totalCost = newTotalCost;
    fund.avgCost = newAvgCost;
    fund.lastTradePrice = price;

    // 自动联动更新最新基准价（若选择上一次成交价或持仓均价模式）
    if (fund.buyAnchorMode === 'lastTrade') fund.buyBenchmarkPrice = price;
    if (fund.buyAnchorMode === 'avgCost') fund.buyBenchmarkPrice = newAvgCost;
    if (fund.sellAnchorMode === 'lastTrade') fund.sellBenchmarkPrice = price;
    if (fund.sellAnchorMode === 'avgCost') fund.sellBenchmarkPrice = newAvgCost;

    if (!Array.isArray(fund.trades)) fund.trades = [];
    fund.trades.push({
      id: 'trade_' + Date.now(),
      type: 'sell',
      date: tradeRecord.date || new Date().toISOString().split('T')[0],
      amount: sellAmount,
      shares: sellShares,
      price: price,
      status: tradeRecord.status || 'confirmed',
      isEstimated: !!tradeRecord.isEstimated,
      autoConfirm: tradeRecord.autoConfirm !== undefined ? tradeRecord.autoConfirm : true,
      targetNavDate: tradeRecord.targetNavDate || tradeRecord.date || new Date().toISOString().split('T')[0],
      realizedProfit: sellAmount - costDeduction,
      remark: tradeRecord.remark || '手动减仓',
      timestamp: Date.now()
    });

    return fund;
  },

  /**
   * 官方正式净值公布后，核准并校准单笔待确认的交易记录（自动更新份额与真实成本）
   * @param {Object} fund 基金持仓对象
   * @param {string} tradeId 交易记录ID
   * @param {number} officialNav 官方正式公布的收盘净值
   */
  confirmTrade(fund, tradeId, officialNav) {
    if (!fund || !Array.isArray(fund.trades) || !officialNav || officialNav <= 0) return fund;
    const trade = fund.trades.find(t => t.id === tradeId);
    if (!trade || trade.status === 'confirmed') return fund;

    if (trade.type === 'buy') {
      const buyAmount = parseFloat(trade.amount) || 0;
      const oldShares = parseFloat(trade.shares) || 0;
      const realShares = buyAmount / officialNav;
      const deltaShares = realShares - oldShares;

      // 更新真实持仓份额（本金不变，份额以官方净值精确计算）
      fund.shares = Math.max(0, fund.shares + deltaShares);
      fund.avgCost = fund.shares > 0 ? fund.totalCost / fund.shares : officialNav;
      fund.lastTradePrice = officialNav;

      // 更新交易明细为已确认
      trade.status = 'confirmed';
      trade.isEstimated = false;
      trade.confirmedNav = officialNav;
      trade.price = officialNav;
      trade.shares = realShares;
      trade.confirmedAt = new Date().toISOString();
      trade.remark = (trade.remark || '').replace(' (15:00前预估暂记)', '') + ' (已按官方净值确认)';

      // 联动基准价格
      if (fund.buyAnchorMode === 'lastTrade') fund.buyBenchmarkPrice = officialNav;
      if (fund.buyAnchorMode === 'avgCost') fund.buyBenchmarkPrice = fund.avgCost;
      if (fund.sellAnchorMode === 'lastTrade') fund.sellBenchmarkPrice = officialNav;
      if (fund.sellAnchorMode === 'avgCost') fund.sellBenchmarkPrice = fund.avgCost;
    } else if (trade.type === 'sell') {
      const sellShares = parseFloat(trade.shares) || 0;
      const realAmount = sellShares * officialNav;

      trade.status = 'confirmed';
      trade.isEstimated = false;
      trade.confirmedNav = officialNav;
      trade.price = officialNav;
      trade.amount = realAmount;
      trade.confirmedAt = new Date().toISOString();
      trade.remark = (trade.remark || '').replace(' (15:00前预估暂记)', '') + ' (已按官方净值确认)';
      fund.lastTradePrice = officialNav;

      if (fund.buyAnchorMode === 'lastTrade') fund.buyBenchmarkPrice = officialNav;
      if (fund.sellAnchorMode === 'lastTrade') fund.sellBenchmarkPrice = officialNav;
    }

    return fund;
  }
};

if (typeof window !== 'undefined') {
  window.FundStrategy = FundStrategy;
}
if (typeof module !== 'undefined') {
  module.exports = FundStrategy;
}
