// Dùng Groq Compound Beta (có web search) để tìm kết quả xổ số
import Groq from 'groq-sdk'

const PRIZE_ORDER = ['Đặc Biệt','Giải Nhất','Giải Nhì','Giải Ba','Giải Tư','Giải Năm','Giải Sáu','Giải Bảy','Giải Tám']

export const handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey)
    return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY chưa cấu hình' }) }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { date, region, province } = body
  if (!date || !region)
    return { statusCode: 400, body: JSON.stringify({ error: 'Thiếu date hoặc region' }) }

  // date format: DD-MM-YYYY
  const [d, m, y] = date.split('-')

  const regionLabel = region === 'mien-nam' ? 'miền Nam' : region === 'mien-bac' ? 'miền Bắc' : 'miền Trung'
  const stationInfo = province ? `đài ${province}` : regionLabel

  try {
    const groq = new Groq({ apiKey })

    // Groq Compound Beta tự search web tìm kết quả xổ số
    const completion = await groq.chat.completions.create({
      model: 'compound-beta',
      messages: [{
        role: 'user',
        content: `Tìm kết quả xổ số ${regionLabel} ${stationInfo} ngày ${d}/${m}/${y} trên trang xosominhngoc.com hoặc các trang xổ số Việt Nam.

Sau khi tìm được, trả về JSON thuần (không markdown):
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
  "station": "tên đài thực tế xổ ngày đó"
}

Chỉ điền các giải có trong kết quả thực tế. Nếu không tìm được trả về: {"error":"Không tìm thấy kết quả ngày ${d}/${m}/${y}"}`
      }],
      max_tokens: 1000,
      temperature: 0.1,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/```json?\n?/g,'').replace(/```/g,'').trim()

    let parsed
    try { parsed = JSON.parse(cleaned) }
    catch {
      // Groq có thể trả về text kèm JSON — tìm JSON trong đó
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error('Không parse được JSON từ Groq: ' + cleaned.slice(0,200))
    }

    if (parsed.error) {
      return { statusCode: 404, body: JSON.stringify({ error: parsed.error }) }
    }

    if (!parsed.prizes || Object.keys(parsed.prizes).length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: `Không có kết quả xổ số ${regionLabel} ngày ${date}` }) }
    }

    // Sắp xếp theo thứ tự giải chuẩn
    const sorted = {}
    for (const name of PRIZE_ORDER) {
      if (parsed.prizes[name]?.length) sorted[name] = parsed.prizes[name]
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prizes: sorted,
        date,
        station: parsed.station || province,
      })
    }
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Lỗi tìm kiếm: ' + e.message })
    }
  }
}
