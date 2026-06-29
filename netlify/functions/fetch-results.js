import Groq from 'groq-sdk'

// Các URL pattern để thử
function buildUrls(date, region) {
  // date format đầu vào: DD-MM-YYYY
  const [d, m, y] = date.split('-')
  return [
    `https://xosominhngoc.com/ket-qua-xo-so/${region}/${d}-${m}-${y}`,
    `https://xosominhngoc.com/ket-qua-xo-so/${region}`,
    `https://xosominhngoc.com/`,
  ]
}

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Referer': 'https://xosominhngoc.com/',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} từ ${url}`)
  return res.text()
}

// Rút gọn HTML — lấy phần có kết quả xổ số, bỏ header/footer/script
function extractRelevantText(html) {
  // Xóa script, style, head
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Tìm đoạn chứa từ khóa kết quả xổ số
  const keywords = ['đặc biệt', 'giải nhất', 'giải nhì', 'giải ba', 'kết quả']
  const lc = text.toLowerCase()
  let start = -1
  for (const kw of keywords) {
    const idx = lc.indexOf(kw)
    if (idx !== -1 && (start === -1 || idx < start)) start = idx
  }

  if (start > 200) start -= 200
  else start = 0

  // Lấy tối đa 4000 ký tự từ vùng kết quả
  return text.slice(start, start + 4000)
}

// Dùng Groq để phân tích text và trả về prizes JSON
async function parseWithGroq(text, apiKey, date, region) {
  const groq = new Groq({ apiKey })
  const prompt = `Bạn là AI phân tích kết quả xổ số Việt Nam.
Dưới đây là nội dung trang web xổ số. Hãy trích xuất kết quả xổ số và trả về JSON.

Nội dung trang:
${text}

Trả về JSON theo format sau (không có markdown):
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
  "station": "tên đài",
  "date": "ngày xổ"
}

Nếu không tìm thấy kết quả xổ số trong nội dung, trả về: {"error": "Không có kết quả"}`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.1,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
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

  const urls = buildUrls(date, region)
  let html = null
  let fetchError = ''

  for (const url of urls) {
    try {
      html = await fetchHTML(url)
      // Kiểm tra có nội dung xổ số không
      const lc = html.toLowerCase()
      if (lc.includes('đặc biệt') || lc.includes('giai nhat') || lc.includes('giải nhất') || lc.includes('kqxs')) {
        break // URL này có dữ liệu
      }
      html = null // Thử URL khác
    } catch (e) {
      fetchError = e.message
      console.error('Fetch failed:', e.message)
    }
  }

  if (!html) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: `Không kết nối được xosominhngoc.com. Lỗi: ${fetchError}. Vui lòng thử lại sau.`
      })
    }
  }

  // Trích xuất phần text liên quan rồi cho Groq phân tích
  const relevantText = extractRelevantText(html)

  let parsed
  try {
    parsed = await parseWithGroq(relevantText, apiKey, date, region)
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'AI phân tích thất bại: ' + e.message })
    }
  }

  if (parsed.error) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: `Không tìm thấy kết quả xổ số cho ngày ${date}. Có thể chưa có kết quả hoặc đài không xổ ngày này.`
      })
    }
  }

  // Validate prizes có dữ liệu không
  const prizes = parsed.prizes ?? {}
  if (Object.keys(prizes).length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: `Không có dữ liệu kết quả cho ngày ${date}.` })
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prizes,
      date: parsed.date || date,
      station: parsed.station || province,
    })
  }
}
