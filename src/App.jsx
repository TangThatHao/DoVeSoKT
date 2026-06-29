import React, { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'

// ─── Constants ───────────────────────────────────────────────────────────────
const PRIZE_VALUES = {
  'Đặc Biệt':  { value: 2_000_000_000, digits: 6, color: '#f59e0b' },
  'Giải Nhất': { value:    30_000_000, digits: 5, color: '#ef4444' },
  'Giải Nhì':  { value:    15_000_000, digits: 5, color: '#f97316' },
  'Giải Ba':   { value:    10_000_000, digits: 5, color: '#eab308' },
  'Giải Tư':   { value:     3_000_000, digits: 5, color: '#84cc16' },
  'Giải Năm':  { value:     1_000_000, digits: 4, color: '#22c55e' },
  'Giải Sáu':  { value:       400_000, digits: 4, color: '#06b6d4' },
  'Giải Bảy':  { value:       200_000, digits: 3, color: '#8b5cf6' },
  'Giải Tám':  { value:       100_000, digits: 2, color: '#6b7280' },
}
const PRIZE_ORDER = Object.keys(PRIZE_VALUES)

const REGIONS = [
  { id: 'mien-nam',   label: 'Miền Nam' },
  { id: 'mien-bac',   label: 'Miền Bắc' },
  { id: 'mien-trung', label: 'Miền Trung' },
]
const PROVINCES = {
  'mien-nam':   ['TP. Hồ Chí Minh','Đồng Nai','Cần Thơ','Đồng Tháp','Cà Mau','Bến Tre','Vũng Tàu','Bạc Liêu','Bình Dương','An Giang','Tây Ninh','Bình Thuận','Vĩnh Long','Bình Phước','Trà Vinh','Long An','Tiền Giang','Kiên Giang','Hậu Giang','Sóc Trăng'],
  'mien-bac':   ['Hà Nội','Nam Định','Thái Bình','Hải Phòng','Ninh Bình','Bắc Ninh','Bắc Giang','Hưng Yên','Vĩnh Phúc','Hải Dương','Quảng Ninh','Thái Nguyên'],
  'mien-trung': ['Đà Nẵng','Khánh Hòa','Thừa Thiên Huế','Phú Yên','Quảng Nam','Bình Định','Quảng Ngãi','Đắk Lắk','Quảng Bình','Quảng Trị','Ninh Thuận','Gia Lai','Đắk Nông','Kon Tum'],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtMoney = n => {
  if (n >= 1_000_000_000) return (n/1_000_000_000).toFixed(n%1_000_000_000===0?0:1)+' tỷ'
  if (n >= 1_000_000)     return (n/1_000_000).toFixed(0)+' triệu'
  if (n >= 1_000)         return (n/1_000).toFixed(0)+' nghìn'
  return n+'đ'
}

const checkTicket = (ticketNum, prizes) => {
  const wins = []
  for (const [name, nums] of Object.entries(prizes)) {
    for (const num of nums) {
      const n = num.replace(/\s/g,'')
      if (!n) continue
      if (ticketNum.slice(-n.length) === n)
        wins.push({ prize: name, number: n, value: PRIZE_VALUES[name]?.value ?? 0, color: PRIZE_VALUES[name]?.color ?? '#f59e0b' })
    }
  }
  return wins
}

const fireConfetti = () => {
  const end = Date.now()+4000
  const iv = setInterval(()=>{
    if (Date.now()>end){clearInterval(iv);return}
    const p = 80*(end-Date.now())/4000
    const d = {startVelocity:30,spread:360,ticks:60,zIndex:9999}
    confetti({...d,particleCount:p,origin:{x:Math.random()*.4,y:Math.random()-.2},colors:['#f59e0b','#fbbf24','#c0392b','#e74c3c','#fff']})
    confetti({...d,particleCount:p,origin:{x:.6+Math.random()*.4,y:Math.random()-.2},colors:['#f59e0b','#fbbf24','#c0392b','#e74c3c','#fff']})
  },250)
}

let _id = 0
const newTicket = (num='') => ({ id: ++_id, number: num, label: '' })

// ─── TicketRow component ──────────────────────────────────────────────────────
function TicketRow({ ticket, index, onChange, onRemove, canRemove, result }) {
  const isWin  = result && result.wins.length > 0
  const isLose = result && result.wins.length === 0

  return (
    <div className={`rounded-xl p-3 mb-2 transition-all ${
      isWin  ? 'bg-gradient-to-r from-red-900/40 to-yellow-900/30 border border-yellow-500/50' :
      isLose ? 'bg-black/30 border border-gray-700/30' :
               'bg-black/20 border border-yellow-900/20'
    }`}>
      <div className="flex items-center gap-2">
        {/* Index badge */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-900/50 border border-yellow-700/40 flex items-center justify-center text-yellow-400 text-xs font-bold">
          {index+1}
        </div>

        {/* Number input */}
        <input
          type="text"
          inputMode="numeric"
          placeholder="6 số vé"
          maxLength={6}
          value={ticket.number}
          onChange={e => onChange(ticket.id, 'number', e.target.value.replace(/\D/g,'').slice(0,6))}
          className="input-lottery flex-1 rounded-lg px-3 py-2 text-base font-mono tracking-[0.2em] text-center min-w-0"
        />

        {/* Label input */}
        <input
          type="text"
          placeholder="Ghi chú"
          value={ticket.label}
          onChange={e => onChange(ticket.id, 'label', e.target.value)}
          className="input-lottery rounded-lg px-2 py-2 text-xs w-20 sm:w-28"
        />

        {/* Remove button */}
        {canRemove && (
          <button
            onClick={() => onRemove(ticket.id)}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-900/40 border border-red-700/40 text-red-400 hover:bg-red-800/60 flex items-center justify-center transition-all"
          >✕</button>
        )}
      </div>

      {/* Result inline */}
      {result && (
        <div className={`mt-2 text-xs px-2 flex items-center gap-2 flex-wrap ${isWin ? 'text-yellow-300' : 'text-gray-500'}`}>
          {isWin ? (
            <>
              <span className="text-green-400 font-bold">🏆 TRÚNG!</span>
              {result.wins.map((w,i) => (
                <span key={i} className="bg-red-900/50 border border-red-600/40 text-red-200 px-2 py-0.5 rounded-full font-semibold">
                  {w.prize} ({w.number}) +{fmtMoney(w.value)}
                </span>
              ))}
            </>
          ) : (
            <span>😔 Không trúng giải nào</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const today = new Date().toISOString().split('T')[0]
  const [date,     setDate]     = useState(today)
  const [region,   setRegion]   = useState('mien-nam')
  const [province, setProvince] = useState('TP. Hồ Chí Minh')
  const [tickets,  setTickets]  = useState([newTicket()])

  // batch paste modal
  const [showBatch,    setShowBatch]    = useState(false)
  const [batchText,    setBatchText]    = useState('')

  // image
  const [imagePreview,  setImagePreview]  = useState(null)
  const [imageBase64,   setImageBase64]   = useState(null)
  const [recognizing,   setRecognizing]   = useState(false)
  const [recognizeMsg,  setRecognizeMsg]  = useState('')

  // results
  const [checking,     setChecking]     = useState(false)
  const [results,      setResults]      = useState(null)  // { prizes, byTicket:{id:{wins}} }
  const [prizes,       setPrizes]       = useState(null)
  const [error,        setError]        = useState('')
  const [dragging,     setDragging]     = useState(false)

  const cameraRef  = useRef()
  const galleryRef = useRef()
  const resultRef  = useRef()

  useEffect(() => { setProvince(PROVINCES[region][0]) }, [region])

  // ── Ticket list ops ──
  const addTicket    = ()           => setTickets(t => [...t, newTicket()])
  const removeTicket = (id)         => setTickets(t => t.filter(x => x.id !== id))
  const changeTicket = (id, k, v)   => setTickets(t => t.map(x => x.id===id ? {...x,[k]:v} : x))
  const clearAll     = ()           => { setTickets([newTicket()]); setResults(null); setPrizes(null); setError('') }

  // ── Batch paste ──
  const applyBatch = () => {
    const nums = batchText.split(/[\n,;\s]+/).map(s=>s.replace(/\D/g,'').slice(0,6)).filter(s=>s.length>=2)
    if (!nums.length) return
    setTickets(nums.map(n => newTicket(n)))
    setShowBatch(false)
    setBatchText('')
  }

  // ── Image handling ──
  const handleImage = useCallback(file => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      setImagePreview(e.target.result)
      setImageBase64(e.target.result.split(',')[1])
      setRecognizeMsg('Ảnh đã tải — nhấn "Nhận Diện" để AI đọc tất cả số vé.')
    }
    reader.readAsDataURL(file)
  }, [])

  const onDrop = e => { e.preventDefault(); setDragging(false); handleImage(e.dataTransfer.files[0]) }

  // ── AI OCR (multiple tickets) ──
  const recognizeTickets = async () => {
    if (!imageBase64) return
    setRecognizing(true); setError('')
    setRecognizeMsg('🤖 AI đang nhận diện tất cả vé trong ảnh...')
    try {
      const res  = await fetch('/.netlify/functions/recognize-ticket', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ imageBase64, multiTicket: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error||'Lỗi nhận diện')

      if (data.tickets?.length) {
        setTickets(data.tickets.map(t => newTicket(t.replace(/\D/g,''))))
        setRecognizeMsg(`✅ Nhận diện được ${data.tickets.length} vé!`)
      } else if (data.ticketNumber) {
        setTickets([newTicket(data.ticketNumber.replace(/\D/g,''))])
        setRecognizeMsg('✅ Nhận diện được 1 vé.')
      } else {
        setRecognizeMsg('⚠️ Không đọc được số vé. Thử chụp rõ hơn.')
      }
      if (data.date)     setDate(data.date)
      if (data.region)   setRegion(data.region)
      if (data.province) setProvince(data.province)
    } catch(e) {
      setError('Lỗi: '+e.message); setRecognizeMsg('')
    } finally {
      setRecognizing(false)
    }
  }

  // ── Check all tickets ──
  const checkAll = async () => {
    const validTickets = tickets.filter(t => t.number.length >= 2)
    if (!validTickets.length) { setError('Nhập ít nhất 1 số vé (tối thiểu 2 chữ số).'); return }
    setChecking(true); setError(''); setResults(null); setPrizes(null)
    try {
      const [y,m,d] = date.split('-')
      const dateDMY = `${d}-${m}-${y}`

      // Bước 1: Browser fetch HTML trực tiếp (IP Việt Nam)
      setError('')
      const targetUrl = `https://www.xosominhngoc.com/ket-qua-xo-so/${region}/${dateDMY}`
      const proxyUrl  = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`

      let htmlText = ''
      try {
        const htmlRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) })
        if (htmlRes.ok) htmlText = await htmlRes.text()
      } catch(e) {
        // Thử proxy thay thế
        try {
          const alt = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
          const altRes = await fetch(alt, { signal: AbortSignal.timeout(15000) })
          if (altRes.ok) htmlText = await altRes.text()
        } catch {}
      }

      if (!htmlText) throw new Error('Không lấy được trang kết quả. Kiểm tra kết nối mạng.')

      // Bước 2: Gửi HTML cho Groq phân tích qua Netlify Function
      const res = await fetch('/.netlify/functions/parse-results', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ htmlText, date: dateDMY, province }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error||'Không lấy được kết quả')

      const byTicket = {}
      for (const t of validTickets) {
        byTicket[t.id] = { wins: checkTicket(t.number, data.prizes), number: t.number }
      }
      setPrizes(data.prizes)
      setResults({ byTicket, station: data.station||province, drawDate: data.date||`${d}-${m}-${y}` })

      const anyWin = Object.values(byTicket).some(r => r.wins.length > 0)
      if (anyWin) setTimeout(() => fireConfetti(), 300)
      setTimeout(() => resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'}), 400)
    } catch(e) {
      setError('Lỗi dò vé: '+e.message)
    } finally {
      setChecking(false)
    }
  }

  // ── Summary stats ──
  const totalWin      = results ? Object.values(results.byTicket).reduce((s,r)=>s+r.wins.reduce((a,w)=>a+w.value,0),0) : 0
  const winCount      = results ? Object.values(results.byTicket).filter(r=>r.wins.length>0).length : 0
  const checkedCount  = results ? Object.values(results.byTicket).length : 0

  return (
    <div className="min-h-screen py-4 px-3 sm:py-6 sm:px-4">

      {/* ── Header ── */}
      <header className="max-w-2xl mx-auto mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-3xl sm:text-4xl">🎰</span>
          <h1 className="text-3xl sm:text-4xl font-black text-shimmer tracking-wide">DÒ VÉ SỐ AI</h1>
          <span className="text-3xl sm:text-4xl">🎰</span>
        </div>
        <p className="text-gold-400 text-xs sm:text-sm font-medium opacity-70">Nhận diện nhiều vé · Dò kết quả hàng loạt</p>
        <div className="dragon-divider mt-2 text-base">✦ ✦ ✦ ✦ ✦</div>
      </header>

      <div className="max-w-2xl mx-auto space-y-3">

        {/* ── Draw info card ── */}
        <div className="card-lottery rounded-2xl p-4">
          <h2 className="text-gold-400 font-bold text-base mb-3 flex items-center gap-2">📅 Thông Tin Xổ Số</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-gold-400 text-xs font-semibold mb-1 uppercase tracking-wider">Ngày Xổ</label>
              <input type="date" value={date} max={today} onChange={e=>setDate(e.target.value)}
                className="input-lottery w-full rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-gold-400 text-xs font-semibold mb-1 uppercase tracking-wider">Miền</label>
              <select value={region} onChange={e=>setRegion(e.target.value)}
                className="input-lottery w-full rounded-lg px-3 py-2 text-sm">
                {REGIONS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-gold-400 text-xs font-semibold mb-1 uppercase tracking-wider">Đài / Tỉnh</label>
            <select value={province} onChange={e=>setProvince(e.target.value)}
              className="input-lottery w-full rounded-lg px-3 py-2 text-sm">
              {PROVINCES[region].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* ── Ticket list card ── */}
        <div className="card-lottery rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gold-400 font-bold text-base flex items-center gap-2">
              🎟️ Danh Sách Vé
              <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-normal">
                {tickets.length} vé
              </span>
            </h2>
            <button onClick={clearAll}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/20">
              Xóa tất cả
            </button>
          </div>

          {/* Ticket rows */}
          <div className="max-h-72 overflow-y-auto pr-1 mb-3">
            {tickets.map((t,i) => (
              <TicketRow
                key={t.id}
                ticket={t}
                index={i}
                onChange={changeTicket}
                onRemove={removeTicket}
                canRemove={tickets.length > 1}
                result={results?.byTicket?.[t.id]}
              />
            ))}
          </div>

          {/* Action buttons row */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={addTicket}
              className="btn-gold rounded-xl py-2.5 text-sm flex items-center justify-center gap-1">
              ➕ Thêm Vé
            </button>
            <button onClick={() => setShowBatch(true)}
              className="btn-red rounded-xl py-2.5 text-sm flex items-center justify-center gap-1">
              📋 Nhập Hàng Loạt
            </button>
          </div>
        </div>

        {/* ── Image OCR card ── */}
        <div className="card-lottery rounded-2xl p-4">
          <h2 className="text-gold-400 font-bold text-base mb-3 flex items-center gap-2">📸 Chụp / Chọn Ảnh Vé</h2>

          <div
            className={`upload-zone rounded-xl p-4 text-center mb-3 ${dragging?'dragging':''}`}
            onDragOver={e=>{e.preventDefault();setDragging(true)}}
            onDragLeave={()=>setDragging(false)}
            onDrop={onDrop}
            onClick={()=>galleryRef.current?.click()}
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Vé số" className="max-h-36 mx-auto rounded-lg object-contain" />
                <button className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
                  onClick={e=>{e.stopPropagation();setImagePreview(null);setImageBase64(null);setRecognizeMsg('')}}>✕</button>
              </div>
            ) : (
              <>
                <div className="text-3xl mb-1">📸</div>
                <p className="text-gold-400 text-sm font-medium">Chụp hoặc chọn ảnh nhiều vé</p>
                <p className="text-gold-600 text-xs mt-0.5">AI tự nhận diện tất cả số vé trong ảnh</p>
              </>
            )}
          </div>

          {recognizeMsg && (
            <p className="text-gold-300 text-xs text-center mb-2 bg-black/20 rounded-lg px-3 py-2">{recognizeMsg}</p>
          )}

          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e=>handleImage(e.target.files[0])} />
          <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>handleImage(e.target.files[0])} />

          <div className="grid grid-cols-2 gap-2 mb-2">
            <button className="btn-gold rounded-xl py-2.5 text-sm flex items-center justify-center gap-1"
              onClick={()=>cameraRef.current?.click()}>📷 Chụp Ảnh</button>
            <button className="btn-gold rounded-xl py-2.5 text-sm flex items-center justify-center gap-1"
              onClick={()=>galleryRef.current?.click()}>🖼️ Thư Viện</button>
          </div>

          {imageBase64 && (
            <button onClick={recognizeTickets} disabled={recognizing}
              className="w-full btn-red rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {recognizing
                ? <><div className="spinner w-4 h-4"/>Đang nhận diện tất cả vé...</>
                : <><span>🤖</span>Nhận Diện Tất Cả Vé Trong Ảnh</>}
            </button>
          )}
        </div>

        {/* ── Check button ── */}
        <button onClick={checkAll} disabled={checking}
          className="w-full btn-gold rounded-2xl py-4 text-lg font-black flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg">
          {checking
            ? <><div className="spinner w-5 h-5"/>Đang dò {tickets.filter(t=>t.number.length>=2).length} vé...</>
            : <><span className="text-2xl">🎯</span>DÒ TẤT CẢ {tickets.filter(t=>t.number.length>=2).length} VÉ</>}
        </button>

        {error && (
          <div className="bg-red-900/40 border border-red-600/50 rounded-xl px-4 py-3 text-red-300 text-sm">⚠️ {error}</div>
        )}

        {/* ── Results ── */}
        {results && (
          <div ref={resultRef} className="card-lottery rounded-2xl p-4 space-y-4">

            {/* Summary banner */}
            {winCount > 0 ? (
              <div className="win-banner rounded-2xl p-4 text-center">
                <div className="text-4xl mb-1">🎉</div>
                <h2 className="text-white text-xl font-black uppercase tracking-widest">TRÚNG RỒI!</h2>
                <p className="text-yellow-200 text-sm mt-1">
                  <span className="font-bold text-white text-lg">{winCount}/{checkedCount}</span> vé trúng giải
                </p>
                <p className="text-yellow-100 text-lg font-bold mt-1">
                  Tổng: <span className="text-white text-xl">{fmtMoney(totalWin)} đồng</span>
                </p>
              </div>
            ) : (
              <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 text-center">
                <div className="text-3xl mb-1">😔</div>
                <h2 className="text-gray-300 text-lg font-bold">Chưa Trúng</h2>
                <p className="text-gray-500 text-xs mt-1">Đã dò {checkedCount} vé — không trúng giải nào. Chúc may mắn lần sau!</p>
              </div>
            )}

            {/* Per-ticket summary */}
            {checkedCount > 1 && (
              <div className="space-y-2">
                <h3 className="text-gold-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2">🎟️ Kết Quả Từng Vé</h3>
                {tickets.filter(t=>t.number.length>=2).map((t,i) => {
                  const r = results.byTicket[t.id]
                  if (!r) return null
                  const won = r.wins.length > 0
                  return (
                    <div key={t.id} className={`rounded-xl px-3 py-2.5 flex items-center gap-3 ${won?'bg-gradient-to-r from-red-900/40 to-yellow-900/30 border border-yellow-500/40':'bg-black/30 border border-gray-700/30'}`}>
                      <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-xs text-yellow-600 font-bold flex-shrink-0">{i+1}</div>
                      <div className="font-mono font-bold text-yellow-300 text-base tracking-widest w-20">{t.number}</div>
                      {t.label && <div className="text-gray-500 text-xs">{t.label}</div>}
                      <div className="flex-1 text-right">
                        {won ? (
                          <div className="flex flex-col items-end gap-0.5">
                            {r.wins.map((w,j)=>(
                              <span key={j} className="text-xs text-yellow-300 font-semibold">🏆 {w.prize} +{fmtMoney(w.value)}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">Không trúng</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Draw info */}
            <div className="flex flex-wrap gap-2 text-xs text-gold-600 bg-black/20 rounded-lg px-3 py-2">
              <span>📅 {results.drawDate}</span>
              <span>🏛️ {results.station}</span>
            </div>

            {/* Prize table */}
            {prizes && (
              <div>
                <h3 className="text-gold-400 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">📊 Bảng Kết Quả Xổ Số</h3>
                <div className="space-y-1">
                  {Object.entries(prizes).map(([prizeName, numbers]) => {
                    const meta = PRIZE_VALUES[prizeName]
                    // Collect all matched numbers from all tickets
                    const allMatchedNums = new Set()
                    Object.values(results.byTicket).forEach(r => {
                      r.wins.filter(w=>w.prize===prizeName).forEach(w=>allMatchedNums.add(w.number))
                    })
                    const isWinRow = allMatchedNums.size > 0
                    return (
                      <div key={prizeName} className={`prize-row rounded-xl px-3 py-2 ${isWinRow?'winning':'bg-black/20'}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-20">
                            <div className="text-xs font-bold" style={{color:meta?.color??'#f59e0b'}}>{prizeName}</div>
                            {meta && <div className="text-gray-600 text-xs">{fmtMoney(meta.value)}</div>}
                          </div>
                          <div className="flex-1 flex flex-wrap gap-1">
                            {numbers.map((num,i) => {
                              const n = num.replace(/\s/g,'')
                              const matched = allMatchedNums.has(n)
                              return (
                                <span key={i} className={`prize-number-box ${matched?'matched':''}`}>
                                  {matched?'⭐ ':''}{num}
                                </span>
                              )
                            })}
                          </div>
                          {isWinRow && <span className="status-win status-badge flex-shrink-0">🏆</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="dragon-divider text-sm">✦ ✦ ✦ ✦ ✦</div>
            <p className="text-center text-gray-700 text-xs">Nguồn: xosominhngoc.com · Chỉ mang tính tham khảo</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto mt-6 pb-8 text-center">
        <p className="text-gray-700 text-xs">🤖 Powered by Groq AI · 🍀 Chúc may mắn!</p>
      </footer>

      {/* ── Batch input modal ── */}
      {showBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card-lottery rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-gold-400 font-bold text-lg mb-1">📋 Nhập Hàng Loạt</h3>
            <p className="text-gray-400 text-xs mb-3">Nhập mỗi số vé một dòng, hoặc ngăn cách bởi dấu phẩy</p>
            <textarea
              value={batchText}
              onChange={e=>setBatchText(e.target.value)}
              placeholder={"123456\n789012\n345678\n\nhoặc: 123456, 789012, 345678"}
              rows={7}
              className="input-lottery w-full rounded-xl px-3 py-2 text-sm font-mono resize-none mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={()=>{setShowBatch(false);setBatchText('')}}
                className="flex-1 bg-gray-800 text-gray-300 rounded-xl py-3 font-semibold hover:bg-gray-700 transition-colors">
                Hủy
              </button>
              <button onClick={applyBatch}
                className="flex-1 btn-gold rounded-xl py-3">
                Xác Nhận ({batchText.split(/[\n,;\s]+/).filter(s=>s.replace(/\D/g,'').length>=2).length} vé)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
