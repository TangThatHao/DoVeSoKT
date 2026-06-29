import React, { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'

// ─── Prize values (VND per tờ vé 10,000đ) ───────────────────────────────────
const PRIZE_VALUES = {
  'Đặc Biệt':    { value: 2_000_000_000, label: 'ĐB',  digits: 6, color: '#f59e0b' },
  'Giải Nhất':   { value:    30_000_000, label: 'G1',  digits: 5, color: '#ef4444' },
  'Giải Nhì':    { value:    15_000_000, label: 'G2',  digits: 5, color: '#f97316' },
  'Giải Ba':     { value:    10_000_000, label: 'G3',  digits: 5, color: '#eab308' },
  'Giải Tư':     { value:     3_000_000, label: 'G4',  digits: 5, color: '#84cc16' },
  'Giải Năm':    { value:     1_000_000, label: 'G5',  digits: 4, color: '#22c55e' },
  'Giải Sáu':    { value:       400_000, label: 'G6',  digits: 4, color: '#06b6d4' },
  'Giải Bảy':    { value:       200_000, label: 'G7',  digits: 3, color: '#8b5cf6' },
  'Giải Tám':    { value:       100_000, label: 'G8',  digits: 2, color: '#6b7280' },
}

const REGIONS = [
  { id: 'mien-nam', label: 'Miền Nam', short: 'MN' },
  { id: 'mien-bac', label: 'Miền Bắc', short: 'MB' },
  { id: 'mien-trung', label: 'Miền Trung', short: 'MT' },
]

const PROVINCES_MN = [
  'TP. Hồ Chí Minh','Đồng Nai','Cần Thơ','Đồng Tháp','Cà Mau',
  'Bến Tre','Vũng Tàu','Bạc Liêu','Bình Dương','An Giang',
  'Tây Ninh','Bình Thuận','Vĩnh Long','Bình Phước','Trà Vinh',
  'Long An','Tiền Giang','Kiên Giang','Hậu Giang','Sóc Trăng',
]
const PROVINCES_MT = [
  'Đà Nẵng','Khánh Hòa','Thừa Thiên Huế','Phú Yên','Quảng Nam',
  'Bình Định','Quảng Ngãi','Đắk Lắk','Quảng Bình','Quảng Trị','Ninh Thuận','Gia Lai','Đắk Nông','Kon Tum',
]
const PROVINCES_MB = ['Hà Nội','Nam Định','Thái Bình','Hải Phòng','Ninh Bình','Bắc Ninh','Bắc Giang','Hưng Yên','Vĩnh Phúc','Hải Dương','Quảng Ninh','Thái Nguyên']

function formatMoney(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1) + ' tỷ'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' triệu'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' nghìn'
  return n + 'đ'
}

function checkTicketAgainstPrizes(ticketNum, prizes) {
  const wins = []
  for (const [prizeName, numbers] of Object.entries(prizes)) {
    const meta = PRIZE_VALUES[prizeName]
    for (const num of numbers) {
      const n = num.replace(/\s/g, '')
      if (!n) continue
      const suffix = ticketNum.slice(-n.length)
      if (suffix === n) {
        wins.push({ prize: prizeName, number: n, value: meta?.value ?? 0, color: meta?.color ?? '#f59e0b' })
      }
    }
  }
  return wins
}

function fireConfetti() {
  const duration = 4000
  const animEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

  const interval = setInterval(() => {
    const timeLeft = animEnd - Date.now()
    if (timeLeft <= 0) { clearInterval(interval); return }
    const particleCount = 80 * (timeLeft / duration)
    confetti({ ...defaults, particleCount, origin: { x: Math.random() * 0.4, y: Math.random() - 0.2 }, colors: ['#f59e0b','#fbbf24','#c0392b','#e74c3c','#fff'] })
    confetti({ ...defaults, particleCount, origin: { x: 0.6 + Math.random() * 0.4, y: Math.random() - 0.2 }, colors: ['#f59e0b','#fbbf24','#c0392b','#e74c3c','#fff'] })
  }, 250)
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [region, setRegion] = useState('mien-nam')
  const [province, setProvince] = useState('TP. Hồ Chí Minh')
  const [ticketNumber, setTicketNumber] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)

  const [recognizing, setRecognizing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null) // { wins, prizes, rawDate, station, ticketNum }
  const [error, setError] = useState('')
  const [recognizeInfo, setRecognizeInfo] = useState('')
  const [dragging, setDragging] = useState(false)

  const cameraRef = useRef()
  const galleryRef = useRef()
  const resultRef = useRef()

  // Province list based on region
  const provinces = region === 'mien-nam' ? PROVINCES_MN : region === 'mien-trung' ? PROVINCES_MT : PROVINCES_MB

  useEffect(() => {
    setProvince(provinces[0])
  }, [region])

  // ── Image handling ──────────────────────────────────────────────────────────
  const handleImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target.result
      setImagePreview(result)
      setImageBase64(result.split(',')[1])
      setRecognizeInfo('Ảnh đã tải — nhấn "Nhận Diện Vé" để AI đọc thông tin.')
    }
    reader.readAsDataURL(file)
  }, [])

  const onFileChange = (e) => handleImage(e.target.files[0])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleImage(e.dataTransfer.files[0])
  }

  // ── AI OCR ──────────────────────────────────────────────────────────────────
  const recognizeTicket = async () => {
    if (!imageBase64) return
    setRecognizing(true)
    setError('')
    setRecognizeInfo('Đang nhận diện vé bằng AI...')
    try {
      const res = await fetch('/.netlify/functions/recognize-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi nhận diện')
      if (data.ticketNumber) setTicketNumber(data.ticketNumber.replace(/\D/g, ''))
      if (data.date) setDate(data.date)
      if (data.region) setRegion(data.region)
      if (data.province) setProvince(data.province)
      setRecognizeInfo(`✅ Nhận diện xong! ${data.note || ''}`)
    } catch (e) {
      setError('Lỗi nhận diện: ' + e.message)
      setRecognizeInfo('')
    } finally {
      setRecognizing(false)
    }
  }

  // ── Check lottery ───────────────────────────────────────────────────────────
  const checkLottery = async () => {
    if (!ticketNumber || ticketNumber.length < 2) {
      setError('Vui lòng nhập số vé (ít nhất 2 chữ số cuối).')
      return
    }
    setChecking(true)
    setError('')
    setCheckResult(null)
    try {
      const [y, m, d] = date.split('-')
      const fmtDate = `${d}-${m}-${y}`
      const res = await fetch('/.netlify/functions/fetch-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: fmtDate, region, province }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không lấy được kết quả')

      const wins = checkTicketAgainstPrizes(ticketNumber, data.prizes)
      setCheckResult({ wins, prizes: data.prizes, station: data.station || province, ticketNum: ticketNumber, drawDate: data.date || fmtDate })

      if (wins.length > 0) {
        setTimeout(() => fireConfetti(), 300)
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400)
      } else {
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
      }
    } catch (e) {
      setError('Lỗi dò vé: ' + e.message)
    } finally {
      setChecking(false)
    }
  }

  const totalWin = checkResult?.wins?.reduce((s, w) => s + w.value, 0) ?? 0
  const isWin = checkResult && checkResult.wins.length > 0

  return (
    <div className="min-h-screen py-4 px-3 sm:py-6 sm:px-4">
      {/* ── Header ── */}
      <header className="max-w-2xl mx-auto mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-3xl sm:text-4xl">🎰</span>
          <h1 className="text-3xl sm:text-4xl font-black text-shimmer tracking-wide">DÒ VÉ SỐ AI</h1>
          <span className="text-3xl sm:text-4xl">🎰</span>
        </div>
        <p className="text-gold-400 text-xs sm:text-sm font-medium opacity-70">Nhận diện vé số thông minh · Dò kết quả tự động</p>
        <div className="dragon-divider mt-2 text-base sm:text-xl">✦ ✦ ✦ ✦ ✦</div>
      </header>

      <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">

        {/* ── Input Card ── */}
        <div className="card-lottery rounded-2xl p-4 sm:p-6">
          <h2 className="text-gold-400 font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
            <span>📋</span> Thông Tin Vé Số
          </h2>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
            {/* Date */}
            <div>
              <label className="block text-gold-400 text-xs font-semibold mb-1 uppercase tracking-wider">Ngày Xổ</label>
              <input
                type="date"
                value={date}
                max={today}
                onChange={e => setDate(e.target.value)}
                className="input-lottery w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            {/* Region */}
            <div>
              <label className="block text-gold-400 text-xs font-semibold mb-1 uppercase tracking-wider">Miền</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="input-lottery w-full rounded-lg px-3 py-2.5 text-sm"
              >
                {REGIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Province */}
          <div className="mb-3">
            <label className="block text-gold-400 text-xs font-semibold mb-1 uppercase tracking-wider">Đài / Tỉnh</label>
            <select
              value={province}
              onChange={e => setProvince(e.target.value)}
              className="input-lottery w-full rounded-lg px-3 py-2.5 text-sm"
            >
              {provinces.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Ticket number */}
          <div className="mb-4">
            <label className="block text-gold-400 text-xs font-semibold mb-1 uppercase tracking-wider">Dãy Số Vé</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Nhập 6 số (VD: 123456)"
              maxLength={6}
              value={ticketNumber}
              onChange={e => setTicketNumber(e.target.value.replace(/\D/g,'').slice(0,6))}
              className="input-lottery w-full rounded-lg px-3 py-2.5 text-lg font-mono tracking-[0.2em] sm:tracking-[0.3em] text-center"
            />
            {/* Visual digit boxes */}
            {ticketNumber && (
              <div className="flex justify-center gap-1 mt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="ticket-digit">
                    {ticketNumber[i] || ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image upload zone */}
          <div
            className={`upload-zone rounded-xl p-4 sm:p-5 text-center mb-3 ${dragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => galleryRef.current?.click()}
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Vé số" className="max-h-40 mx-auto rounded-lg object-contain" />
                <button
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
                  onClick={e => { e.stopPropagation(); setImagePreview(null); setImageBase64(null); setRecognizeInfo('') }}
                >✕</button>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-2">📸</div>
                <p className="text-gold-400 text-sm font-medium">Chụp hoặc chọn ảnh vé số</p>
                <p className="text-gold-600 text-xs mt-1">Kéo thả • Chọn thư viện • Chụp ảnh</p>
              </>
            )}
          </div>

          {recognizeInfo && (
            <p className="text-gold-300 text-xs text-center mb-3 bg-black/20 rounded-lg px-3 py-2">{recognizeInfo}</p>
          )}

          {/* Camera / Gallery buttons */}
          <div className="flex gap-2 mb-4">
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />

            <button
              className="flex-1 btn-gold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2"
              onClick={() => cameraRef.current?.click()}
            >📷 Chụp Ảnh</button>
            <button
              className="flex-1 btn-gold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2"
              onClick={() => galleryRef.current?.click()}
            >🖼️ Thư Viện</button>
          </div>

          {/* Recognize button */}
          {imageBase64 && (
            <button
              onClick={recognizeTicket}
              disabled={recognizing}
              className="w-full btn-red rounded-xl py-3 text-sm flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
            >
              {recognizing ? <><div className="spinner w-5 h-5" /> Đang nhận diện...</> : <><span>🤖</span> Nhận Diện Vé Bằng AI</>}
            </button>
          )}

          {/* Check button */}
          <button
            onClick={checkLottery}
            disabled={checking || !ticketNumber}
            className="w-full btn-gold rounded-xl py-4 sm:py-4 text-base sm:text-lg flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {checking
              ? <><div className="spinner w-5 h-5" /> Đang dò vé...</>
              : <><span className="text-xl">🎯</span> TIẾN HÀNH DÒ VÉ</>}
          </button>

          {error && (
            <div className="mt-3 bg-red-900/40 border border-red-600/50 rounded-lg px-4 py-3 text-red-300 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {checkResult && (
          <div ref={resultRef} className="card-lottery rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">

            {/* Win / Lose banner */}
            {isWin ? (
              <div className="win-banner rounded-2xl p-5 text-center animate-bounce-in">
                <div className="text-5xl mb-2">🎉</div>
                <h2 className="text-white text-2xl font-black uppercase tracking-widest">TRÚNG RỒI!</h2>
                <p className="text-yellow-200 text-lg font-bold mt-1">
                  Tổng thưởng: <span className="text-white text-2xl">{formatMoney(totalWin)} đồng</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {checkResult.wins.map((w, i) => (
                    <span key={i} className="bg-white/20 text-white text-sm font-bold px-3 py-1 rounded-full">
                      {w.prize} — {w.number} (+{formatMoney(w.value)})
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">😔</div>
                <h2 className="text-gray-300 text-xl font-bold">Chưa Trúng</h2>
                <p className="text-gray-500 text-sm mt-1">Số vé <span className="text-gold-400 font-mono font-bold">{checkResult.ticketNum}</span> không trúng giải nào. Chúc may mắn lần sau!</p>
              </div>
            )}

            {/* Draw info */}
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-gold-600 bg-black/20 rounded-lg px-3 py-2">
              <span>📅 Ngày: <span className="text-gold-400 font-semibold">{checkResult.drawDate}</span></span>
              <span>🏛️ Đài: <span className="text-gold-400 font-semibold">{checkResult.station}</span></span>
              <span>🎟️ Vé: <span className="text-gold-400 font-mono font-bold">{checkResult.ticketNum}</span></span>
            </div>

            {/* Prize table */}
            <div>
              <h3 className="text-gold-400 font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>📊</span> Bảng Kết Quả Xổ Số
              </h3>
              <div className="space-y-1.5">
                {Object.entries(checkResult.prizes).map(([prizeName, numbers]) => {
                  const meta = PRIZE_VALUES[prizeName]
                  const winNumbers = checkResult.wins.filter(w => w.prize === prizeName).map(w => w.number)
                  const isWinRow = winNumbers.length > 0
                  return (
                    <div key={prizeName} className={`prize-row rounded-xl px-3 py-2.5 ${isWinRow ? 'winning' : 'bg-black/20'}`}>
                      <div className="flex items-start gap-3">
                        {/* Prize label */}
                        <div className="flex-shrink-0 w-24">
                          <div className="text-xs font-bold" style={{ color: meta?.color ?? '#f59e0b' }}>
                            {prizeName}
                          </div>
                          {meta && (
                            <div className="text-gray-500 text-xs">{formatMoney(meta.value)}</div>
                          )}
                        </div>
                        {/* Numbers */}
                        <div className="flex-1 flex flex-wrap gap-1">
                          {numbers.map((num, i) => {
                            const isMatch = winNumbers.includes(num.replace(/\s/g,''))
                            return (
                              <span key={i} className={`prize-number-box ${isMatch ? 'matched' : ''}`}>
                                {isMatch ? '⭐ ' : ''}{num}
                              </span>
                            )
                          })}
                        </div>
                        {/* Win badge */}
                        {isWinRow && (
                          <div className="flex-shrink-0">
                            <span className="status-win status-badge">🏆 TRÚNG</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="dragon-divider">✦ ✦ ✦ ✦ ✦</div>
            <p className="text-center text-gray-600 text-xs">Nguồn: xosominhngoc.com · Kết quả chỉ mang tính tham khảo</p>
          </div>
        )}
      </div>

      {/* Footer — extra bottom padding cho iPhone home bar */}
      <footer className="max-w-2xl mx-auto mt-6 pb-6 text-center">
        <p className="text-gray-700 text-xs">🤖 Powered by Groq AI · 🍀 Chúc may mắn!</p>
      </footer>
    </div>
  )
}
