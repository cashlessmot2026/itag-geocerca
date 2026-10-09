import { useRef, useCallback, useMemo } from 'react'

// Sirena y pitidos generados con WebAudio (sin archivos de audio)
export function useAlarm() {
  const ctxRef = useRef(null)
  const nodesRef = useRef(null)

  const getCtx = () => {
    const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx
    ctx.resume()
    return ctx
  }

  const start = useCallback(() => {
    if (nodesRef.current) return
    const ctx = getCtx()
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

  // Pitido corto para el modo buscar (más agudo = más cerca)
  const beep = useCallback((freq = 800) => {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.13)
    if (navigator.vibrate) navigator.vibrate(30)
  }, [])

  return useMemo(() => ({ start, stop, beep }), [start, stop, beep])
}
