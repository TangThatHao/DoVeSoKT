import Groq from 'groq-sdk'

// ─── Province → URL slug ──────────────────────────────────────────────────────
const SLUG = {
  // Miền Nam
  'TP. Hồ Chí Minh': 'tp-hcm',   'Đồng Nai': 'dong-nai',
  'Cần Thơ': 'can-tho',           'Đồng Tháp': 'dong-thap',
  'Cà Mau': 'ca-mau',             'Bến Tre': 'ben-tre',
  'Vũng Tàu': 'vung-tau',         'Bạc Liêu': 'bac-lieu',
  'Bình Dương': 'binh-duong',     'An Giang': 'an-giang',
  'Tây Ninh': 'tay-ninh',         'Bình Thuận': 'binh-thuan',
  'Vĩnh Long': 'vinh-long',       'Bình Phước': 'binh-phuoc',
  'Trà Vinh': 'tra-vinh',         'Long An': 'long-an',
  'Tiền Giang': 'tien-giang',     'Kiên Giang': 'kien-giang',
  'Hậu Giang': 'hau-giang',       'Sóc Trăng': 'soc-trang',
  // Miền Trung
  'Đà Nẵng': 'da-nang',           'Khánh Hòa': 'khanh-hoa',
  'Thừa Thiên Huế': 'thua-thien-hue', 'Phú Yên': 'phu-yen',
  'Quảng Nam': 'quang-nam',       'Bình Định': 'binh-dinh',
  'Quảng Ngãi': 'quang-ngai',     'Đắk Lắk': 'dak-lak',
  'Quảng Bình': 'quang-binh',     'Quảng Trị': 'quang-tri',
  'Ninh Thuận': 'ninh-thuan',     'Gia Lai': 'gia-lai',
  'Đắk Nông': 'dak-nong',         'Kon Tum': 'kon-tum',
  // Miền Bắc
  'Hà Nội': 'ha-noi',             'Nam Định': 'nam-dinh',
  'Thái Bình': 'thai-binh',       'Hải Phòng': 'hai-phong',
  'Ninh Bình': 'ninh-binh',       'Bắc Ninh': 'bac-ninh',
  'Bắc Giang': 'bac-giang',       'Hưng Yên': 'hung-yen',
  'Vĩnh Phúc': 'vinh-phuc',       'Hải Dương': 'hai-duong',
  'Quảng Ninh': 'quang-ninh',     'Thái Nguyên': 'thai-nguyen',
}

const PRIZE_NAMES = {
  'đặc biệt': 'Đặc Biệt', 'db': 'Đặc Biệt',
  'nhất': 'Giải Nhất', '1': 'Giải Nhất',
  'nhì': 'Giải Nhì',   '2': 'Giải Nhì',
  'ba': 'Giải Ba',     '3': 'Giải Ba',
  'tư': 'Giải Tư',     '4': 'Giải Tư',
  'năm': 'Giải Năm',   '5': 'Giải Năm',
  'sáu': 'Giải Sáu',   '6': 'Giải Sáu',
  'bảy': 'Giải Bảy',   '7': 'Giải Bảy',
  'tám': 'Giải Tám',   '8': 'Giải Tám',
}
const PRIZE_ORDER = ['Đặc Biệt','Giải Nhất','Giải Nhì','Giải Ba','Giải Tư','Giải Năm','Giải Sáu','Giải Bảy','Giải Tám']

function normalizePrize(raw) {
  const s = raw.toLowerCase().replace(/giải\s*/,'').trim()
  return PRIZE_NAMES[s] ?? null
}

// Parse HTML → prizes (regex, không cần cheerio)
function parseHTML(html) {
  const prizes = {}

  // Xóa tags, giữ cấu trúc row/cell bằng placeholder
  const rowRx  = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRx = /<td[^>]*>([\s\S]*?)<\/td>/gi

  let row
  while ((row = rowRx.exec(html)) !== null) {
    const cells = []
    let cell
    const cellReg = /<td[^>]*>([\s\S]*?)<\/td>/gi
    cellReg.lastIndex = 0
    const rowHtml = row[1]
    while ((cell = cellReg.exec(rowHtml)) !== null) {
      // Dùng space khi xóa tag để tránh số bị dính: "82950"+"51229" → "82950 51229"
      const text = cell[1].replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()
      if (text) cells.push(text)
    }
    if (cells.length < 2) continue
    const prizeName = normalizePrize(cells[0])
    if (!prizeName) continue
    const numbers = cells.slice(1)
      .flatMap(c => c.split(/[\s,]+/))
      .map(s => s.replace(/\D/g,''))
      .filter(s => s.length >= 2)
    if (numbers.length) {
      if (!prizes[prizeName]) prizes[prizeName] = []
      prizes[prizeName].push(...numbers)
    }
  }

  return prizes
}

async function fetchDirect(url) {
  const HDRS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
    'Accept-Language': 'vi-VN,vi;q=0.9',
    'Referer': 'https://www.xosominhngoc.com/',
  }
  // Thử trực tiếp
  try {
    const r = await fetch(url, { headers: HDRS, signal: AbortSignal.timeout(8000) })
    if (r.ok) return r.text()
  } catch {}
  // Thử allorigins proxy
  try {
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(10000) })
    if (r.ok) return r.text()
  } catch {}
  // Thử corsproxy
  const r = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

// Groq parse — lọc đúng 1 đài
async function groqParse(text, apiKey, province) {
  const groq = new Groq({ apiKey })
  const snippet = text.replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]+>/g,' ').replace(/\s{2,}/g,' ').trim().slice(0, 6000)

  const r = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role:'user', content:
      `Trang web xổ số có thể chứa nhiều đài. Hãy chỉ lấy kết quả của đài "${province}".

Nội dung trang:
${snippet}

Trả về JSON thuần (không markdown) CHỈ của đài ${province}:
{
  "prizes": {
    "Đặc Biệt": ["6chuso"],
    "Giải Nhất": ["5chuso"],
    "Giải Nhì": ["5chuso"],
    "Giải Ba": ["5chuso","5chuso"],
    "Giải Tư": ["5chuso","5chuso","5chuso","5chuso","5chuso","5chuso","5chuso"],
    "Giải Năm": ["4chuso"],
    "Giải Sáu": ["4chuso","4chuso","4chuso"],
    "Giải Bảy": ["3chuso","3chuso","3chuso","3chuso"],
    "Giải Tám": ["2chuso","2chuso","2chuso"]
  },
  "station": "${province}"
}
Nếu không tìm thấy đài "${province}" trả về: {"error":"no data"}` }],
    max_tokens: 600, temperature: 0.1,
  })
  const raw = r.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/```json?\n?/g,'').replace(/```/g,'').trim()
  const m = cleaned.match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : cleaned)
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

  const { date, region, province } = body  // date = DD-MM-YYYY
  if (!date || !region)
    return { statusCode: 400, body: JSON.stringify({ error: 'Thiếu tham số' }) }

  const slug = SLUG[province] ?? region
  // URL đúng định dạng: /ket-qua-xo-so/{region}/{province-slug}/{DD-MM-YYYY}.html
  const urls = [
    `https://www.xosominhngoc.com/ket-qua-xo-so/${region}/${slug}/${date}.html`,
    `https://www.xosominhngoc.com/ket-qua-xo-so/${region}/${date}.html`,
    `https://www.xosominhngoc.com/ket-qua-xo-so/${region}/`,
  ]

  let html = null
  let lastErr = ''
  for (const url of urls) {
    try {
      html = await fetchDirect(url)
      if (html && html.toLowerCase().includes('đặc biệt')) break
      html = null
    } catch(e) { lastErr = e.message }
  }

  if (!html) {
    // Cuối cùng thử Groq web search (compound-beta)
    try {
      const groq = new Groq({ apiKey })
      const [d,m,y] = date.split('-')
      const completion = await groq.chat.completions.create({
        model: 'compound-beta',
        messages: [{ role:'user', content:
          `Kết quả xổ số ${province} ngày ${d}/${m}/${y} trên xosominhngoc.com. Trả JSON: {"prizes":{"Đặc Biệt":["..."],...},"station":"..."}` }],
        max_tokens: 600, temperature: 0.1,
      })
      const raw = completion.choices[0]?.message?.content ?? '{}'
      const m2 = raw.replace(/```json?\n?/g,'').replace(/```/g,'').match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(m2 ? m2[0] : '{}')
      if (parsed.prizes && Object.keys(parsed.prizes).length > 0) {
        const sorted = {}
        for (const n of PRIZE_ORDER) if (parsed.prizes[n]) sorted[n] = parsed.prizes[n]
        return { statusCode: 200, headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ prizes: sorted, date, station: parsed.station || province }) }
      }
    } catch {}
    return { statusCode: 502, body: JSON.stringify({
      error: `Không lấy được kết quả ngày ${date}. Có thể chưa có kết quả hoặc đài không xổ ngày này.`
    })}
  }

  // Dùng Groq parse — truyền province để lọc đúng 1 đài
  let prizes = {}
  try {
    const parsed = await groqParse(html, apiKey, province)
    if (parsed.prizes && Object.keys(parsed.prizes).length >= 3) prizes = parsed.prizes
  } catch {}

  // Fallback regex nếu Groq fail
  if (Object.keys(prizes).length < 3) prizes = parseHTML(html)

  if (Object.keys(prizes).length === 0)
    return { statusCode: 404, body: JSON.stringify({ error: `Không tìm thấy kết quả ngày ${date}.` }) }

  // Sắp xếp theo thứ tự giải
  const sorted = {}
  for (const n of PRIZE_ORDER) if (prizes[n]?.length) sorted[n] = prizes[n]

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prizes: sorted, date, station: province })
  }
}
