import Groq from 'groq-sdk'

const SYSTEM_PROMPT = `Bạn là AI chuyên nhận diện vé số xổ số kiến thiết Việt Nam.
Khi nhận được ảnh (có thể chứa 1 hoặc NHIỀU tờ vé số), hãy trích xuất:
- tickets: mảng tất cả các dãy 6 số cuối tìm thấy trong ảnh (mỗi tờ vé 1 phần tử)
- date: ngày xổ định dạng YYYY-MM-DD (nếu đọc được)
- province: tên đài/tỉnh (nếu đọc được)
- region: "mien-nam", "mien-bac", hoặc "mien-trung" (nếu đọc được)
- note: ghi chú nếu cần

Trả về JSON thuần (không markdown), ví dụ:
{"tickets":["123456","789012","345678"],"date":"2024-01-15","province":"TP. Hồ Chí Minh","region":"mien-nam","note":""}

Nếu chỉ có 1 vé thì tickets vẫn là mảng 1 phần tử.
Nếu không đọc được rõ một số nào đó thì bỏ qua, không đoán mò.`

export const handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey)
    return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY chưa được cấu hình' }) }

  let body
  try { body = JSON.parse(event.body) }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { imageBase64 } = body
  if (!imageBase64)
    return { statusCode: 400, body: JSON.stringify({ error: 'Thiếu imageBase64' }) }

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
            { type: 'text', text: 'Nhận diện tất cả số vé trong ảnh này.' },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const cleaned = raw.replace(/```json?\n?/g,'').replace(/```/g,'').trim()
    let parsed = {}
    try { parsed = JSON.parse(cleaned) }
    catch { parsed = { note: 'Không parse được: ' + raw.slice(0,100) } }

    // Normalize: ensure tickets is array
    if (!parsed.tickets && parsed.ticketNumber) {
      parsed.tickets = [parsed.ticketNumber]
    }
    if (!Array.isArray(parsed.tickets)) parsed.tickets = []

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
