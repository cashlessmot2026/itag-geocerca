import { useState, useRef, useEffect, useCallback } from 'react'
import { useAlarm } from './useAlarm'
import { useBluetooth } from './useBluetooth'
import { useInstall } from './useInstall'
import { useWakeLock } from './useWakeLock'

const MAX_M = 10 // alcance del radar en metros
const SMOOTH = 0.3 // peso de la lectura nueva en el promedio (0-1)
const TREND_M = 0.3 // cambio mínimo (m) para considerar que te acercas o alejas
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function AnimButton({ children, onClick, variant = 'primary', disabled, active }) {
  const [ripples, setRipples] = useState([])
  const handle = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const id = Date.now() + Math.random()
    setRipples((p) => [...p, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    setTimeout(() => setRipples((p) => p.filter((x) => x.id !== id)), 600)
    onClick?.(e)
  }
  return (
    <button className={`btn ${variant} ${active ? 'active' : ''}`} onClick={handle} disabled={disabled}>
      {ripples.map((r) => (
        <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />
      ))}
      <span className="label">{children}</span>
    </button>
  )
}

const TRENDS = {
  approach: { icon: '⬇️', text: 'Acercándose', cls: 'approach' },
  away: { icon: '⬆️', text: 'Alejándose', cls: 'away' },
  steady: { icon: '⏸️', text: 'Estable', cls: 'steady' },
  lost: { icon: '📵', text: 'Sin señal', cls: 'away' },
}

export default function App() {
  const [mode, setMode] = useState('demo') // demo | bluetooth
  const [meters, setMeters] = useState(1.5)
  const [rssi, setRssi] = useState(null)
  const [calib, setCalib] = useState(-59) // RSSI medido a 1 m del tag
  const [fence, setFence] = useState(4)
  const [armed, setArmed] = useState(true)
  const [walking, setWalking] = useState(false)
  const [finder, setFinder] = useState(false)
  const [trend, setTrend] = useState('steady')
  const radarRef = useRef(null)
  const dragging = useRef(false)
  const angle = useRef(-0.8)
  const smooth = useRef(null)
  const calibRef = useRef(calib)
  const history = useRef([])
  const metersRef = useRef(meters)
  const alarm = useAlarm()

  calibRef.current = calib
  metersRef.current = meters

  // Cada lectura de señal: promedio móvil -> distancia (modelo log-distancia)
  const onRssi = useCallback((value) => {
    smooth.current = smooth.current == null ? value : smooth.current * (1 - SMOOTH) + value * SMOOTH
    setRssi(Math.round(smooth.current))
    setMeters(clamp(Math.pow(10, (calibRef.current - smooth.current) / 20), 0.1, MAX_M))
  }, [])
  const onLost = useCallback(() => {
    smooth.current = null
    setRssi(null)
    setMeters(MAX_M)
  }, [])
  const bt = useBluetooth({ onRssi, onLost })
  const pwa = useInstall()
  useWakeLock(armed)

  const lost = mode === 'bluetooth' && bt.state === 'lost'
  const outside = meters > fence
  const alerting = armed && outside

  useEffect(() => {
    if (alerting) alarm.start()
    else alarm.stop()
    return alarm.stop
  }, [alerting, alarm])

  // Tendencia en tiempo real: compara la distancia actual con la de hace ~2 s
  useEffect(() => {
    const now = Date.now()
    history.current.push({ t: now, m: meters })
    history.current = history.current.filter((h) => now - h.t <= 2500)
    const first = history.current[0]
    // si deja de moverse, vuelve a "Estable"
    const idle = setTimeout(() => setTrend('steady'), 1500)
    if (now - first.t >= 1000) {
      const d = meters - first.m
      setTrend(d < -TREND_M ? 'approach' : d > TREND_M ? 'away' : 'steady')
    }
    return () => clearTimeout(idle)
  }, [meters])

  // Modo buscar: pitidos más rápidos y agudos cuanto más cerca está el tag
  useEffect(() => {
    if (!finder || alerting) return
    let id
    const tick = () => {
      const m = metersRef.current
      alarm.beep(500 + (1 - m / MAX_M) * 1100)
      id = setTimeout(tick, clamp(120 + m * 130, 120, 1400))
    }
    tick()
    return () => clearTimeout(id)
  }, [finder, alerting, alarm])

  // Demo: caminar hacia afuera
  useEffect(() => {
    if (!walking) return
    const id = setInterval(() => {
      setMeters((m) => {
        if (m >= MAX_M) { setWalking(false); return MAX_M }
        return Math.min(MAX_M, m + 0.12)
      })
    }, 50)
    return () => clearInterval(id)
  }, [walking])

  // Demo: arrastrar el tag en el radar
  const moveTo = (e) => {
    const r = radarRef.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    angle.current = Math.atan2(dy, dx)
    const dist = Math.hypot(dx, dy) / (r.width / 2)
    setMeters(Math.max(0.2, Math.min(MAX_M, dist * MAX_M)))
  }
  const down = (e) => {
    if (mode !== 'demo') return
    setWalking(false)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    moveTo(e)
  }
  const move = (e) => dragging.current && moveTo(e)
  const up = () => (dragging.current = false)

  const switchMode = (m) => {
    setMode(m)
    smooth.current = null
    if (m === 'demo') setRssi(null)
  }

  const pct = (meters / MAX_M) * 50
  const tagStyle = {
    left: `${50 + Math.cos(angle.current) * pct}%`,
    top: `${50 + Math.sin(angle.current) * pct}%`,
  }
  const fenceSize = (fence / MAX_M) * 100
  const heat = Math.round((1 - meters / MAX_M) * 100)
  const here = meters < 0.6
  const t = TRENDS[lost ? 'lost' : trend]
  const bars = rssi == null ? 0 : rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : 1

  return (
    <div className={`app ${alerting ? 'danger' : ''}`}>
      {pwa.canInstall && (
        <div className="row">
          <AnimButton onClick={pwa.install}>⬇️ Instalar app</AnimButton>
        </div>
      )}

      <header>
        <h1>📍 iTag Geocerca</h1>
        <div className={`status ${alerting ? 'bad' : armed ? 'ok' : 'off'}`}>
          {alerting ? '¡FUERA DE ZONA!' : armed ? 'Protegido' : 'Desarmado'}
        </div>
      </header>

      <div className="radar" ref={radarRef} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="ring r3" />
        <div className="sweep" />
        <div className={`fence ${outside ? 'breach' : ''}`} style={{ width: `${fenceSize}%`, height: `${fenceSize}%` }} />
        <div className="me">📱</div>
        <div className={`tag ${alerting ? 'alerting' : ''} ${here ? 'here' : ''}`} style={tagStyle}>
          <span className="pulse" />🏷️
        </div>
      </div>

      <div key={here ? 'here' : t.cls} className={`trend ${here ? 'approach' : t.cls}`}>
        <span className="ticon">{here ? '🎯' : t.icon}</span>
        <span>{here ? '¡Está aquí!' : t.text}</span>
      </div>

      <div className="heat">
        <div className="heat-fill" style={{ width: `${heat}%` }} />
        <span>{heat >= 85 ? '🔥 Muy cerca' : heat >= 60 ? '🌤️ Tibio' : '❄️ Lejos'}</span>
      </div>

      <div className="readout">
        <div><b>{meters.toFixed(1)} m</b><small>distancia</small></div>
        <div><b>{fence.toFixed(1)} m</b><small>geocerca</small></div>
        <div>
          <b className="bars">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= bars ? 'on' : ''} style={{ height: 6 + i * 4 }} />)}</b>
          <small>{rssi == null ? 'sin señal' : `${rssi} dBm`}</small>
        </div>
      </div>

      <label className="slider">
        Radio de la geocerca
        <input type="range" min="1" max="8" step="0.5" value={fence} onChange={(e) => setFence(+e.target.value)} />
      </label>

      <div className="row">
        <AnimButton variant={armed ? 'primary' : 'ghost'} active={armed} onClick={() => setArmed((a) => !a)}>
          {armed ? '🛡️ Armado' : '🔓 Desarmado'}
        </AnimButton>
        <AnimButton variant={finder ? 'primary' : 'ghost'} active={finder} onClick={() => setFinder((f) => !f)}>
          {finder ? '🔊 Buscando…' : '🔎 Buscar tag'}
        </AnimButton>
        {alerting && <AnimButton variant="danger" onClick={() => setArmed(false)}>🔇 Silenciar</AnimButton>}
      </div>

      <div className="row">
        <AnimButton variant={mode === 'demo' ? 'primary' : 'ghost'} onClick={() => switchMode('demo')}>🎮 Demo</AnimButton>
        <AnimButton variant={mode === 'bluetooth' ? 'primary' : 'ghost'} onClick={() => switchMode('bluetooth')}>📡 Bluetooth</AnimButton>
      </div>

      {mode === 'demo' ? (
        <div className="row">
          <AnimButton onClick={() => setWalking(true)}>🚶 Alejar tag</AnimButton>
          <AnimButton variant="ghost" onClick={() => { setWalking(false); setMeters(1) }}>↩️ Acercar</AnimButton>
          <p className="hint">También puedes arrastrar el tag en el radar.</p>
        </div>
      ) : (
        <>
          <div className="row">
            {bt.supported ? (
              <>
                <AnimButton onClick={bt.connect} disabled={bt.state === 'scanning'}>
                  {bt.state === 'scanning' ? `📶 Rastreando ${bt.name}` : bt.state === 'lost' ? '🔄 Reconectar' : '🔗 Buscar iTag'}
                </AnimButton>
                <AnimButton variant="ghost" onClick={bt.ringTag} disabled={!bt.name}>🔔 Sonar tag</AnimButton>
                {bt.error && <p className="hint err">{bt.error}</p>}
              </>
            ) : (
              <p className="hint err">Tu navegador no soporta Web Bluetooth. Usa Chrome en Android o PC.</p>
            )}
          </div>
          <label className="slider">
            Calibración: señal a 1 m ({calib} dBm). Pon el tag a 1 m y ajusta hasta que marque 1.0 m.
            <input type="range" min="-80" max="-40" step="1" value={calib} onChange={(e) => setCalib(+e.target.value)} />
          </label>
        </>
      )}
    </div>
  )
}
