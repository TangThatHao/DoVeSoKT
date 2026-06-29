// Fetch & parse lottery results from xosominhngoc.com
import * as cheerio from 'cheerio'

const PRIZE_ORDER = ['Đặc Biệt','Giải Nhất','Giải Nhì','Giải Ba','Giải Tư','Giải Năm','Giải Sáu','Giải Bảy','Giải Tám']

// Map Vietnamese prize names from site → our standard names
const PRIZE_NAME_MAP = {
  'đặc biệt': 'Đặc Biệt', 'db': 'Đặc Biệt', 'đb': 'Đặc Biệt', 'giải đặc biệt': 'Đặc Biệt',
  'giải nhất': 'Giải Nhất', 'giải 1': 'Giải Nhất', 'nhất': 'Giải Nhất',
  'giải nhì': 'Giải Nhì',  'giải 2': 'Giải Nhì',  'nhì': 'Giải Nhì',
  'giải ba':  'Giải Ba',   'giải 3': 'Giải Ba',   'ba': 'Giải Ba',
  'giải tư':  'Giải Tư',   'giải 4': 'Giải Tư',   'tư': 'Giải Tư',
  'giải năm': 'Giải Năm',  'giải 5': 'Giải Năm',  'năm': 'Giải Năm',
  'giải sáu': 'Giải Sáu',  'giải 6': 'Giải Sáu',  'sáu': 'Giải Sáu',
  'giải bảy': 'Giải Bảy',  'giải 7': 'Giải Bảy',  'bảy': 'Giải Bảy',
  'giải tám': 'Giải Tám',  'giải 8': 'Giải Tám',  'tám': 'Giải Tám',
  'giải chín':'Giải Tám',  'giải 9': 'Giải Tám',
}

function normalizePrizeName(raw) {
  const key = raw.toLowerCase().trim().replace(/\s+/g,' ')
  return PRIZE_NAME_MAP[key] ?? null
}

function extractNumbers(text) {
  return (text.match(/\d{2,8}/g) ?? []).filter(n => n.length >= 2)
}

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.5',
      'Cache-Control': 'no-cache',
      'Referer': 'https://xosominhngoc.com/',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function parseResultsHTML(html) {
  const $ = cheerio.load(html)
  const prizes = {}

  // Strategy 1: look for table rows with prize labels
  $('table tr, .result-table tr, .kqxs-table tr').each((_, row) => {
    const cells = $(row).find('td, th')
    if (cells.length < 2) return
    const labelCell = $(cells[0]).text().trim()
    const mapped = normalizePrizeName(labelCell)
    if (!mapped) return
    const nums = []
    cells.slice(1).each((_, td) => {
      const t = $(td).text()
      extractNumbers(t).forEach(n => nums.push(n))
    })
    if (nums.length) {
      if (!prizes[mapped]) prizes[mapped] = []
      prizes[mapped].push(...nums)
    }
  })

  // Strategy 2: look for elements with class names containing prize keywords
  if (Object.keys(prizes).length === 0) {
    $('[class*="giai"], [class*="prize"], [class*="special"]').each((_, el) => {
      const text = $(el).text().trim()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      for (let i = 0; i < lines.length; i++) {
        const mapped = normalizePrizeName(lines[i])
        if (mapped) {
          const nums = []
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            extractNumbers(lines[j]).forEach(n => nums.push(n))
            if (normalizePrizeName(lines[j])) break
          }
          if (nums.length) {
            if (!prizes[mapped]) prizes[mapped] = []
            prizes[mapped].push(...nums)
          }
        }
      }
    })
  }

  // Strategy 3: full text parse — look for prize name followed by numbers
  if (Object.keys(prizes).length === 0) {
    const fullText = $.root().text()
    const lines = fullText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0)
    let currentPrize = null
    for (const line of lines) {
      const mapped = normalizePrizeName(line)
      if (mapped) {
        currentPrize = mapped
        if (!prizes[currentPrize]) prizes[currentPrize] = []
      } else if (currentPrize) {
        const nums = extractNumbers(line)
        if (nums.length > 0) {
          prizes[currentPrize].push(...nums)
          // Only add numbers to first matching line then reset
        } else if (line.length > 1 && !/^\s*$/.test(line)) {
          currentPrize = null // next meaningful text resets
        }
      }
    }
  }

  // Deduplicate
  for (const k of Object.keys(prizes)) {
    prizes[k] = [...new Set(prizes[k])]
  }

  // Sort by standard prize order
  const sorted = {}
  for (const name of PRIZE_ORDER) {
    if (prizes[name]?.length) sorted[name] = prizes[name]
  }
  // Add any extra prizes we found
  for (const [k, v] of Object.entries(prizes)) {
    if (!sorted[k] && v.length) sorted[k] = v
  }

  return sorted
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { date, region, province } = body
  if (!date || !region) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Thiếu date hoặc region' }) }
  }

  // Build URL variants to try
  const urls = [
    `https://xosominhngoc.com/ket-qua-xo-so/${region}/${date}`,
    `https://xosominhngoc.com/ket-qua-xo-so/${region}/`,
    `https://xosominhngoc.com/`,
  ]

  let html = null
  let usedUrl = null
  for (const url of urls) {
    try {
      html = await fetchHTML(url)
      usedUrl = url
      break
    } catch (e) {
      console.error('Failed URL:', url, e.message)
    }
  }

  if (!html) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Không thể kết nối đến xosominhngoc.com. Vui lòng thử lại sau.' }),
    }
  }

  const prizes = parseResultsHTML(html)

  if (Object.keys(prizes).length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: `Không tìm thấy kết quả xổ số cho ngày ${date}. Có thể chưa có kết quả hoặc ngày không hợp lệ.`,
      }),
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prizes,
      date,
      station: province ?? region,
      source: usedUrl,
    }),
  }
}
