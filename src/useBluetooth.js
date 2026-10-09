import { useRef, useState, useCallback, useEffect } from 'react'

const LOST_AFTER_MS = 5000 // sin anuncios del tag durante este tiempo = fuera de alcance

// Web Bluetooth (Chrome Android/PC). Lee la señal (RSSI) que el iTag emite
// continuamente SIN conectarse: al conectar, muchos iTag dejan de anunciarse.
export function useBluetooth({ onRssi, onLost }) {
  const [state, setState] = useState('idle') // idle | scanning | lost | error
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const devRef = useRef(null)
  const lastSeen = useRef(0)
  const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth

  const connect = useCallback(async () => {
    try {
      setError('')
      const dev = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['immediate_alert', 'link_loss', 'battery_service'],
      })
      if (!dev.watchAdvertisements) {
        throw new Error('Tu Chrome no permite leer la señal en vivo. Activa chrome://flags/#enable-experimental-web-platform-features y reinicia.')
      }
      devRef.current = dev
      setName(dev.name || 'iTag')
      dev.addEventListener('advertisementreceived', (e) => {
        if (e.rssi == null) return
        lastSeen.current = Date.now()
        setState('scanning')
        onRssi(e.rssi)
      })
      lastSeen.current = Date.now()
      setState('scanning')
      await dev.watchAdvertisements()
    } catch (e) {
      if (e.name === 'NotFoundError') { setState('idle'); return } // el usuario cerró el selector
      setState('error'); setError(e.message)
    }
  }, [onRssi])

  // Vigilante: si el tag deja de anunciarse, se considera fuera de alcance
  useEffect(() => {
    if (state !== 'scanning') return
    const id = setInterval(() => {
      if (Date.now() - lastSeen.current > LOST_AFTER_MS) {
        setState('lost'); onLost()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [state, onLost])

  // Hace sonar el buzzer del propio iTag: conecta, avisa y se desconecta
  const ringTag = useCallback(async () => {
    const dev = devRef.current
    if (!dev) return
    try {
      const server = await dev.gatt.connect()
      const svc = await server.getPrimaryService('immediate_alert')
      const ch = await svc.getCharacteristic('alert_level')
      await ch.writeValueWithoutResponse(Uint8Array.of(2))
      setTimeout(() => dev.gatt.connected && dev.gatt.disconnect(), 3000)
    } catch (e) {
      setError('No se pudo sonar el tag: ' + e.message)
    }
  }, [])

  const stop = useCallback(() => {
    setState('idle')
    devRef.current?.unwatchAdvertisements?.()
  }, [])

  return { supported, state, error, name, connect, ringTag, stop }
}
