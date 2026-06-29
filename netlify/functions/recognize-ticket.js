// Groq Vision OCR — nhận diện vé số từ ảnh
import Groq from 'groq-sdk'

const SYSTEM_PROMPT = `Bạn là AI chuyên nhận diện vé số xổ số kiến thiết Việt Nam.
Khi nhận được ảnh vé số, hãy trích xuất các thông tin sau (nếu có):
- ticketNumber: 6 chữ số cuối trên vé (dãy số chính)
- date: ngày xổ định dạng YYYY-MM-DD
- province: tên đài / tỉnh (VD: "TP. Hồ Chí Minh", "Đồng Nai")
- region: "mien-nam", "mien-bac", hoặc "mien-trung"
- note: ghi chú ngắn nếu cần

Trả về JSON thuần (không có markdown), ví dụ:
{"ticketNumber":"123456","date":"2024-01-15","province":"TP. Hồ Chí Minh","region":"mien-nam","note":"Đọc OK"}

Nếu không đọc được rõ, hãy ghi vào note và để trống các trường không chắc chắn.`

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY chưa được cấu hình' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { imageBase64 } = body
  if (!imageBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Thiếu imageBase64' }) }
  }

  try {
    const groq = new Groq({ apiKey })
    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: 'Nhận diện thông tin từ vé số trong ảnh này.' },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    // Strip markdown fences if present
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    let parsed = {}
    try { parsed = JSON.parse(cleaned) } catch { parsed = { note: 'AI trả về dữ liệu không hợp lệ: ' + raw.slice(0, 100) } }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
