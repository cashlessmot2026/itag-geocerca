# iTag Geocerca (PWA)

App en React que usa un iTag (llavero Bluetooth) como geocerca: si el tag se aleja del radio configurado, suena una alerta.

- Radar animado, slider de geocerca, botones animados
- Modo Demo (arrastra el tag) y modo Bluetooth (Web Bluetooth, Chrome Android/PC)
- PWA instalable con service worker (requiere HTTPS)

## Uso

```bash
npm install
npm run dev      # desarrollo
npm run build    # produccion (carpeta dist)
```

La distancia por Bluetooth se estima con RSSI, por lo que es aproximada.
