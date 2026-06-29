import Groq from 'groq-sdk'

// ─── API xoso.me trả về JSON chuẩn ──────────────────────────────────────────
// URL: https://api.xoso.me/xs/{region}/{YYYY-MM-DD}.js
// Trả về JSONP dạng: setData({...})  hoặc JSON thuần

const REGION_MAP = {
  'mien-nam':   'mien-nam',
  'mien-bac':   'mien-bac',
  'mien-trung': 'mien-trung',
}

// Chuyển DD-MM-YYYY → YYYY-MM-DD
function toISO(dateDMY) {
  const [d, m, y] = dateDMY.split('-')
  return `${y}-${m}-${d}`
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'vi-VN,vi;q=0.9',
  'Referer': 'https://xoso.me/',
  'Origin': 'https://xoso.me',
}

async function tryFetch(url, timeout = 10000) {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(timeout),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// Parse JSONP: setData({...})  hoặc JSON thuần
function parseXosoAPI(text) {
  // Thử JSON thuần trước
  try { return JSON.parse(text) } catch {}
  // Thử strip JSONP wrapper
  const m = text.match(/\w+\s*\(\s*(\{[\s\S]*\})\s*\)/)
  if (m) { try { return JSON.parse(m[1]) } catch {} }
  return null
}

// Chuyển data từ xoso.me → prizes object theo format chuẩn của app
function normalizeXosoData(data) {
  // data.result là mảng [{ tinh, kqxs: { db, g1, g2, g3, g4, g5, g6, g7, g8 } }]
  if (!data?.result || !data.result.length) return null

  // Gộp tất cả đài trong ngày
  const prizes = {}
  const add = (key, ...vals) => {
    if (!prizes[key]) prizes[key] = []
    prizes[key].push(...vals.filter(Boolean).map(v => String(v).trim()).filter(v => /\d{2,}/.test(v)))
  }

  for (const entry of data.result) {
    const k = entry.kqxs || entry
    add('Đặc Biệt',  k.db  || k['giaidb'])
    add('Giải Nhất', k.g1  || k['giai1'])
    add('Giải Nhì',  k.g2  || k['giai2'])
    if (Array.isArray(k.g3)) add('Giải Ba',  ...k.g3)
    else add('Giải Ba', k.g3 || k['giai3'])
    if (Array.isArray(k.g4)) add('Giải Tư',  ...k.g4)
    else add('Giải Tư', k.g4 || k['giai4'])
    add('Giải Năm',  k.g5  || k['giai5'])
    if (Array.isArray(k.g6)) add('Giải Sáu', ...k.g6)
    else add('Giải Sáu', k.g6 || k['giai6'])
    if (Array.isArray(k.g7)) add('Giải Bảy', ...k.g7)
    else add('Giải Bảy', k.g7 || k['giai7'])
    if (Array.isArray(k.g8)) add('Giải Tám', ...k.g8)
    else add('Giải Tám', k.g8 || k['giai8'])
  }

  // Xóa key rỗng
  for (const k of Object.keys(prizes)) {
    prizes[k] = prizes[k].filter(Boolean)
    if (!prizes[k].length) delete prizes[k]
  }

  const station = data.result.map(r => r.tinh || r.station || '').filter(Boolean).join(', ')
  return { prizes, station }
}

// Dùng Groq phân tích text nếu API JSON thất bại
async function parseWithGroq(text, apiKey) {
  const groq = new Groq({ apiKey })
  const snippet = text.slice(0, 5000)
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: `Đây là dữ liệu kết quả xổ số Việt Nam (có thể là JSON, JSONP, hoặc text HTML):

${snippet}

Hãy trích xuất kết quả xổ số và trả về JSON thuần (không markdown):
{
  "prizes": {
    "Đặc Biệt": ["123456"],
    "Giải Nhất": ["12345"],
    "Giải Nhì": ["12345"],
    "Giải Ba": ["12345","67890"],
    "Giải Tư": ["1234","5678","9012","3456","7890","1234","5678"],
    "Giải Năm": ["1234"],
    "Giải Sáu": ["123","456","789"],
    "Giải Bảy": ["12","34","56","78"],
    "Giải Tám": ["12","34","56"]
  },
  "station": "tên đài/tỉnh"
}

Nếu không có dữ liệu xổ số hợp lệ trả về: {"error":"no data"}`
    }],
    max_tokens: 1000,
    temperature: 0.1,
  })
  const raw = completion.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/```json?\n?/g,'').replace(/```/g,'').trim()
  return JSON.parse(cleaned)
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey)
    return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY chưa cấu hình' }) }

  let body
  try { body = JSON.parse(event.body) }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { date, region, province } = body
  if (!date || !region)
    return { statusCode: 400, body: JSON.stringify({ error: 'Thiếu date hoặc region' }) }

  const isoDate  = toISO(date)          // YYYY-MM-DD
  const regionId = REGION_MAP[region] ?? 'mien-nam'

  // Danh sách URL thử theo thứ tự ưu tiên
  const urlsToTry = [
    // API JSON chính thức xoso.me
    `https://api.xoso.me/xs/${regionId}/${isoDate}.js`,
    // Backup: xoso.net.vn
    `https://xoso.net.vn/api/v1/xs/${regionId}/${isoDate}`,
    // Backup: xsapi
    `https://xsapi.net/api/xs?region=${regionId}&date=${isoDate}`,
    // Fallback: trang chủ xosominhngoc
    `https://www.minhngoc.net.vn/ket-qua-xo-so/${regionId}.html`,
  ]

  let lastError = ''
  for (const url of urlsToTry) {
    let text
    try {
      text = await tryFetch(url)
    } catch(e) {
      lastError = `${url}: ${e.message}`
      console.error('fetch failed:', lastError)
      continue
    }

    // Thử parse JSON/JSONP trước
    const parsed = parseXosoAPI(text)
    if (parsed) {
      const normalized = normalizeXosoData(parsed)
      if (normalized && Object.keys(normalized.prizes).length > 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prizes: normalized.prizes,
            date,
            station: normalized.station || province,
          })
        }
      }
    }

    // Thử cho Groq phân tích
    const hasLotteryContent = /đặc biệt|giải nhất|giai nhat|giaidb|kqxs/i.test(text)
    if (hasLotteryContent) {
      try {
        const groqResult = await parseWithGroq(text, apiKey)
        if (groqResult.prizes && Object.keys(groqResult.prizes).length > 0) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prizes: groqResult.prizes,
              date,
              station: groqResult.station || province,
            })
          }
        }
      } catch(e) {
        console.error('Groq parse error:', e.message)
      }
    }
  }

  return {
    statusCode: 502,
    body: JSON.stringify({
      error: `Không lấy được kết quả xổ số cho ngày ${date}. Có thể chưa có kết quả hoặc đài không xổ ngày này. (${lastError})`
    })
  }
}
