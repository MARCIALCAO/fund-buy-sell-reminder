/**
 * API 模块：负责从天天基金/东方财富拉取实时估值与基金信息
 * 支持多源降级与 CORS 代理
 */

const FundAPI = {
  // 主接口：天天基金最新批量估值 API
  DIRECT_API: 'https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast',
  BACKUP_DIRECT_API: 'https://fundcomapi.eastmoney.com/mm/newCore/FundValuationLast',
  PROXY_API: '/api/fund', // Vercel / Cloudflare Pages 部署时的内置反代

  /**
   * 批量获取基金估值与净值数据
   * @param {string[]} codes 基金代码数组，如 ['161725', '001632']
   * @returns {Promise<Object<string, FundValuation>>}
   */
  async fetchValuations(codes) {
    if (!codes || codes.length === 0) return {};
    const cleanCodes = codes.map(c => String(c).trim()).filter(Boolean);
    const codeStr = cleanCodes.join(',');
    const fields = 'FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE';

    // 尝试策略 1: 直接请求（接口支持 CORS * 通配）
    try {
      const url = `${this.DIRECT_API}?FCODES=${encodeURIComponent(codeStr)}&FIELDS=${fields}`;
      const res = await this._fetchWithTimeout(url, 6000);
      if (res && res.data) {
        return this._transformData(res.data);
      }
    } catch (e) {
      console.warn('[FundAPI] Direct API failed, trying backup API...', e);
    }

    // 尝试策略 2: 备用域名直接请求
    try {
      const url = `${this.BACKUP_DIRECT_API}?FCODES=${encodeURIComponent(codeStr)}&FIELDS=${fields}`;
      const res = await this._fetchWithTimeout(url, 6000);
      if (res && res.data) {
        return this._transformData(res.data);
      }
    } catch (e) {
      console.warn('[FundAPI] Backup direct API failed, trying local proxy /api/fund...', e);
    }

    // 尝试策略 3: 本地/部署站点反向代理 (/api/fund)
    try {
      const url = `${this.PROXY_API}?codes=${encodeURIComponent(codeStr)}`;
      const res = await this._fetchWithTimeout(url, 6000);
      if (res && res.data) {
        return this._transformData(res.data);
      }
    } catch (e) {
      console.warn('[FundAPI] Proxy /api/fund failed, trying public CORS proxy...', e);
    }

    // 尝试策略 4: 公开 CORS 代理兜底 (AllOrigins)
    try {
      const targetUrl = `${this.DIRECT_API}?FCODES=${encodeURIComponent(codeStr)}&FIELDS=${fields}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      const res = await this._fetchWithTimeout(proxyUrl, 9000);
      if (res && res.data) {
        return this._transformData(res.data);
      }
    } catch (e) {
      console.error('[FundAPI] All API attempts failed:', e);
    }

    throw new Error('未能获取基金行情数据，请检查网络或稍后重试');
  },

  /**
   * 单只基金查询（用于新增基金输入代码后的自动联想与净值预填）
   * @param {string} code 6位基金代码
   */
  async fetchSingleFund(code) {
    const map = await this.fetchValuations([code]);
    return map[code] || null;
  },

  /**
   * 格式化 API 返回结果为以基金代码为 Key 的字典
   */
  _transformData(list) {
    const result = {};
    if (!Array.isArray(list)) return result;

    for (const item of list) {
      if (!item || !item.FCODE) continue;
      const code = String(item.FCODE);
      const nav = typeof item.NAV === 'number' ? item.NAV : parseFloat(item.NAV) || null;
      const gsz = typeof item.GSZ === 'number' ? item.GSZ : parseFloat(item.GSZ) || null;
      const gszzl = typeof item.GSZZL === 'number' ? item.GSZZL : parseFloat(item.GSZZL) || 0;

      result[code] = {
        code: code,
        name: item.SHORTNAME || '未知基金',
        nav: nav, // 上一个交易日净值
        navDate: item.PDATE || '', // 净值日期
        gsz: gsz, // 今日估值（部分基金盘中无估值则为 null）
        gszzl: gszzl, // 估值涨跌幅（%）
        gzTime: item.GZTIME || '', // 估值更新时间
        // 当前用于计算的参考最新价（优先用今日估值，没有则用上一净值）
        currentPrice: (gsz !== null && !isNaN(gsz)) ? gsz : nav,
        hasValuation: gsz !== null && !isNaN(gsz)
      };
    }
    return result;
  },

  /**
   * 带超时控制的 Fetch 请求
   */
  async _fetchWithTimeout(url, timeoutMs = 6000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(id);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
};

window.FundAPI = FundAPI;
