import { useRef, useState, useCallback } from 'react'

// Web Bluetooth (Chrome Android/PC). El iTag anuncia señal; usamos RSSI para estimar distancia.
export function useBluetooth(onRssi) {
  const [state, setState] = useState('idle') // idle | connecting | connected | error
  const [error, setError] = useState('')
  const devRef = useRef(null)
  const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth

  const connect = useCallback(async () => {
    try {
      setState('connecting'); setError('')
      const dev = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['immediate_alert', 'link_loss', 'battery_service'],
      })
      devRef.current = dev
      dev.addEventListener('gattserverdisconnected', () => onRssi(-100, true))
      if (dev.watchAdvertisements) {
        dev.addEventListener('advertisementreceived', (e) => onRssi(e.rssi, false))
        await dev.watchAdvertisements()
      }
      await dev.gatt.connect()
      setState('connected')
    } catch (e) {
      setState('error'); setError(e.message)
    }
  }, [onRssi])

  // Hace sonar el buzzer del propio iTag (Immediate Alert, nivel alto)
  const ringTag = useCallback(async () => {
    const server = devRef.current?.gatt
    if (!server?.connected) return
    const svc = await server.getPrimaryService('immediate_alert')
    const ch = await svc.getCharacteristic('alert_level')
    await ch.writeValueWithoutResponse(Uint8Array.of(2))
  }, [])

  return { supported, state, error, connect, ringTag }
}
