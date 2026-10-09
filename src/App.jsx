import { useState, useRef, useEffect, useCallback } from 'react'
import { useAlarm } from './useAlarm'
import { useBluetooth } from './useBluetooth'
import { useInstall } from './useInstall'
import { useWakeLock } from './useWakeLock'

const MAX_M = 10 // alcance del radar en metros
const rssiToMeters = (rssi) => Math.pow(10, (-59 - rssi) / 20) // modelo log-distancia simple

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

export default function App() {
  const [mode, setMode] = useState('demo') // demo | bluetooth
  const [meters, setMeters] = useState(1.5)
  const [fence, setFence] = useState(4)
  const [armed, setArmed] = useState(true)
  const [walking, setWalking] = useState(false)
  const radarRef = useRef(null)
  const dragging = useRef(false)
  const angle = useRef(-0.8)
  const alarm = useAlarm()

  const onRssi = useCallback((rssi, lost) => {
    setMeters(lost ? MAX_M : Math.min(MAX_M, rssiToMeters(rssi)))
  }, [])
  const bt = useBluetooth(onRssi)
  const pwa = useInstall()
  useWakeLock(armed)

  const outside = meters > fence
  const alerting = armed && outside

  useEffect(() => {
    if (alerting) alarm.start()
    else alarm.stop()
    return alarm.stop
  }, [alerting, alarm])

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

  const pct = (meters / MAX_M) * 50
  const tagStyle = {
    left: `${50 + Math.cos(angle.current) * pct}%`,
    top: `${50 + Math.sin(angle.current) * pct}%`,
  }
  const fenceSize = (fence / MAX_M) * 100

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
        <div className={`tag ${alerting ? 'alerting' : ''}`} style={tagStyle}>
          <span className="pulse" />🏷️
        </div>
      </div>

      <div className="readout">
        <div><b>{meters.toFixed(1)} m</b><small>distancia</small></div>
        <div><b>{fence.toFixed(1)} m</b><small>geocerca</small></div>
      </div>

      <label className="slider">
        Radio de la geocerca
        <input type="range" min="1" max="8" step="0.5" value={fence} onChange={(e) => setFence(+e.target.value)} />
      </label>

      <div className="row">
        <AnimButton variant={armed ? 'primary' : 'ghost'} active={armed} onClick={() => setArmed((a) => !a)}>
          {armed ? '🛡️ Armado' : '🔓 Desarmado'}
        </AnimButton>
        {alerting && <AnimButton variant="danger" onClick={() => setArmed(false)}>🔇 Silenciar</AnimButton>}
      </div>

      <div className="row">
        <AnimButton variant={mode === 'demo' ? 'primary' : 'ghost'} onClick={() => setMode('demo')}>🎮 Demo</AnimButton>
        <AnimButton variant={mode === 'bluetooth' ? 'primary' : 'ghost'} onClick={() => setMode('bluetooth')}>📡 Bluetooth</AnimButton>
      </div>

      {mode === 'demo' ? (
        <div className="row">
          <AnimButton onClick={() => setWalking(true)}>🚶 Alejar tag</AnimButton>
          <AnimButton variant="ghost" onClick={() => { setWalking(false); setMeters(1) }}>↩️ Acercar</AnimButton>
          <p className="hint">También puedes arrastrar el tag en el radar.</p>
        </div>
      ) : (
        <div className="row">
          {bt.supported ? (
            <>
              <AnimButton onClick={bt.connect} disabled={bt.state === 'connecting'}>
                {bt.state === 'connected' ? '✅ Conectado' : bt.state === 'connecting' ? 'Conectando…' : '🔗 Conectar iTag'}
              </AnimButton>
              <AnimButton variant="ghost" onClick={() => bt.ringTag().catch(() => {})} disabled={bt.state !== 'connected'}>
                🔔 Sonar tag
              </AnimButton>
              {bt.error && <p className="hint err">{bt.error}</p>}
            </>
          ) : (
            <p className="hint err">Tu navegador no soporta Web Bluetooth. Usa Chrome en Android o PC.</p>
          )}
        </div>
      )}
    </div>
  )
}
