// Nhận HTML từ client, dùng Groq phân tích kết quả xổ số
import Groq from 'groq-sdk'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey)
    return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY chưa cấu hình' }) }

  let body
  try { body = JSON.parse(event.body) }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { htmlText, date, province } = body
  if (!htmlText)
    return { statusCode: 400, body: JSON.stringify({ error: 'Thiếu htmlText' }) }

  // Làm sạch HTML — xóa script/style, giữ text
  const cleanText = htmlText
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 6000) // Giới hạn để tiết kiệm token

  try {
    const groq = new Groq({ apiKey })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Đây là nội dung trang web kết quả xổ số Việt Nam ngày ${date}:

${cleanText}

Hãy trích xuất KẾT QUẢ XỔ SỐ và trả về JSON thuần (không có markdown):
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
  "station": "tên đài xổ"
}

Chỉ điền các giải tìm thấy trong nội dung. Nếu không có kết quả xổ số trả về: {"error":"no data"}`
      }],
      max_tokens: 800,
      temperature: 0.1,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/```json?\n?/g,'').replace(/```/g,'').trim()
    const parsed = JSON.parse(cleaned)

    if (parsed.error || !parsed.prizes || Object.keys(parsed.prizes).length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Không tìm thấy kết quả xổ số trong trang. Thử chọn đúng đài và ngày xổ.' })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prizes: parsed.prizes, station: parsed.station || province })
    }
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Groq lỗi: ' + e.message })
    }
  }
}
