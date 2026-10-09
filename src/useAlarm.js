import { useRef, useCallback, useMemo } from 'react'

// Sirena generada con WebAudio (sin archivos de audio)
export function useAlarm() {
  const ctxRef = useRef(null)
  const nodesRef = useRef(null)

  const start = useCallback(() => {
    if (nodesRef.current) return
    const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx
    ctx.resume()
    const osc = ctx.createOscillator()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    lfo.frequency.value = 4
    lfoGain.gain.value = 300
    gain.gain.value = 0.15
    lfo.connect(lfoGain).connect(osc.frequency)
    osc.connect(gain).connect(ctx.destination)
    osc.start(); lfo.start()
    nodesRef.current = { osc, lfo }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300])
  }, [])

  const stop = useCallback(() => {
    const n = nodesRef.current
    if (!n) return
    n.osc.stop(); n.lfo.stop()
    nodesRef.current = null
    if (navigator.vibrate) navigator.vibrate(0)
  }, [])

  return useMemo(() => ({ start, stop }), [start, stop])
}
