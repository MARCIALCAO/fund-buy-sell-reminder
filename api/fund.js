/**
 * Vercel Serverless Function: /api/fund
 * 部署至 Vercel 时自动运行，免费反代天天基金数据
 */

export default async function handler(req, res) {
  // CORS 头支持
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { codes, FCODES } = req.query;
  const targetCodes = codes || FCODES || '161725';
  const fields = 'FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE';

  const targetUrl = `https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast?FCODES=${encodeURIComponent(targetCodes)}&FIELDS=${fields}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://fund.eastmoney.com/'
      }
    });

    const data = await response.json();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message, success: false });
  }
}
