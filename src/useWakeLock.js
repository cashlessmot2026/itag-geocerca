import { useEffect } from 'react'

// Mantiene la pantalla encendida mientras la geocerca está armada
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock
    const acquire = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
    acquire()
    const onVis = () => document.visibilityState === 'visible' && acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [active])
}
