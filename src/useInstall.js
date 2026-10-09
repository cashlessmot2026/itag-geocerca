import { useEffect, useState, useCallback } from 'react'

// Captura el evento de instalación de la PWA para usar un botón propio
export function useInstall() {
  const [evt, setEvt] = useState(null)
  const [installed, setInstalled] = useState(false)
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e) }
    const onDone = () => { setInstalled(true); setEvt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onDone)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onDone)
    }
  }, [])
  const install = useCallback(async () => {
    if (!evt) return
    evt.prompt()
    await evt.userChoice
    setEvt(null)
  }, [evt])
  return { canInstall: !!evt && !installed, install }
}
