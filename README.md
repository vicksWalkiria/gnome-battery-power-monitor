# GNOME Battery Power & Time Monitor

Extensión ligera para **GNOME Shell (40–44)** que muestra en la barra superior —junto al reloj y las notificaciones— el **consumo real en vatios (W)** y el **tiempo estimado de batería restante** (o tiempo de carga).

## Características

- **Lectura directa desde `/sys/class/power_supply/BAT*`** cada 5 segundos sin lanzar subprocesos externos (consumo mínimo de CPU).
- **Tiempo estimado suavizado** usando media móvil de ~30 s para evitar saltos bruscos.
- **Indicador de color** según el consumo actual:
  - Normal (`< 9,5 W`)
  - Ámbar (`9,5 – 14 W`)
  - Rojo (`≥ 14 W`)
  - Verde (cargando / conectado a corriente)
- **Menú desplegable al hacer clic** con:
  - Estado (Descargando / Cargando / AC)
  - Consumo instantáneo (`W`, `A` y `V`)
  - Media de los últimos 30 s
  - Tiempo estimado
  - Energía restante (`Wh` y `%`)
  - Salud de la batería (`full / design`)
  - Botón de actualización manual

## Instalación

```bash
git clone https://github.com/vicksWalkiria/gnome-battery-power-monitor.git
cd gnome-battery-power-monitor
chmod +x install.sh
./install.sh
```

> **Nota para Wayland:** GNOME Shell solo detecta extensiones nuevas al iniciar sesión. Tras ejecutar `./install.sh`, cierra sesión y vuelve a entrar (o reinicia). En X11 basta con `Alt+F2` → `r` → `Enter`.

## Desinstalación

```bash
gnome-extensions disable battery-power@vant 2>/dev/null || true
rm -rf ~/.local/share/gnome-shell/extensions/battery-power@vant
```

## Licencia

MIT
