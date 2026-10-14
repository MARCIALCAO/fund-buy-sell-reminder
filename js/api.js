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
    const fields = 'FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE,NAVCHGRT';

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
   * 拉取单只基金的历史正式净值，匹配目标交易日的官方公布净值
   * @param {string} code 6位基金代码
   * @param {string} targetDate 目标日期 "YYYY-MM-DD"
   * @returns {Promise<number|null>}
   */
  async fetchHistoricalNav(code, targetDate) {
    if (!code || !targetDate) return null;
    const cleanCode = String(code).trim();
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${encodeURIComponent(cleanCode)}&pageIndex=1&pageSize=20`;

    // 尝试 1: 直接请求
    try {
      const res = await this._fetchWithTimeout(url, 4000);
      if (res && res.Data && Array.isArray(res.Data.LSJZList)) {
        const found = res.Data.LSJZList.find(item => item.FSRQ === targetDate);
        if (found && found.DWJZ) {
          const navNum = parseFloat(found.DWJZ);
          if (!isNaN(navNum) && navNum > 0) return navNum;
        }
      }
    } catch (e) {
      // ignore
    }

    // 尝试 2: 公开 CORS 代理兜底
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await this._fetchWithTimeout(proxyUrl, 6000);
      if (res && res.Data && Array.isArray(res.Data.LSJZList)) {
        const found = res.Data.LSJZList.find(item => item.FSRQ === targetDate);
        if (found && found.DWJZ) {
          const navNum = parseFloat(found.DWJZ);
          if (!isNaN(navNum) && navNum > 0) return navNum;
        }
      }
    } catch (e) {
      console.warn('[FundAPI] fetchHistoricalNav failed:', code, targetDate, e);
    }

    return null;
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
      let gsz = typeof item.GSZ === 'number' ? item.GSZ : parseFloat(item.GSZ) || null;
      let gszzl = typeof item.GSZZL === 'number' ? item.GSZZL : parseFloat(item.GSZZL) || null;
      const navchgrt = typeof item.NAVCHGRT === 'number' ? item.NAVCHGRT : parseFloat(item.NAVCHGRT) || null;
      let gzTime = item.GZTIME || '';
      const navDate = item.PDATE || '';

      // 提取估值时间中的日期（例如 "2026-10-14 15:00" -> "2026-10-14"）
      const gzDate = gzTime ? (gzTime.includes(' ') ? gzTime.split(' ')[0] : (gzTime.length === 10 ? gzTime : '')) : '';

      // 判断当日官方正式净值是否已公布：
      // 1. 如果有估值日期，且 navDate >= gzDate，说明官方公布的净值日期已赶上或超过该估值日（通常在晚上或次日早晨）
      // 2. 如果 GZTIME/GSZ 为空或 null（天天基金晚上正式清算后估值数据清空），只要 nav 和 navDate 有效，即表示已为正式净值
      let isOfficialPublished = false;
      if (nav !== null && !isNaN(nav) && navDate) {
        if (gzDate) {
          if (navDate >= gzDate) {
            isOfficialPublished = true;
          }
        } else {
          isOfficialPublished = true;
        }
      }

      // 当到了晚上抓取到的基金净值更新为当日正式净值之后，最后收盘时的净值预估值要改为正式的净值
      if (isOfficialPublished && nav !== null && !isNaN(nav)) {
        gsz = nav; // 收盘预估净值自动校准为官方正式净值
        if (navchgrt !== null && !isNaN(navchgrt)) {
          gszzl = navchgrt; // 采用官方公布的实际涨跌幅
        }
        if (!gzTime && navDate) {
          gzTime = `${navDate} 15:00`;
        }
      }

      const hasValuation = (gsz !== null && !isNaN(gsz)) || (nav !== null && !isNaN(nav));
      const currentPrice = (gsz !== null && !isNaN(gsz)) ? gsz : nav;

      result[code] = {
        code: code,
        name: item.SHORTNAME || '未知基金',
        nav: nav, // 官方最新公布净值
        navDate: navDate, // 净值日期
        gsz: gsz !== null ? gsz : nav, // 预估净值（已收盘公布正式净值则为正式净值）
        gszzl: gszzl !== null ? gszzl : (navchgrt || 0), // 涨跌幅（%）
        gzTime: gzTime, // 估值更新时间（包含完整日期时间）
        isOfficialPublished: isOfficialPublished, // 是否已为当日正式净值
        currentPrice: currentPrice, // 当前用于阶梯计算的最新价格
        hasValuation: hasValuation
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
