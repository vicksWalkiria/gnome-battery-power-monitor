# GNOME Battery Power & Time Monitor

Extensión ligera para **GNOME Shell (40–44)** que muestra en la barra superior —junto al reloj y las notificaciones— el **consumo real en vatios (W)** y el **tiempo estimado de batería restante** (o tiempo de carga).

---

## ¿Para qué tipo de PC es este programa?

Esta extensión está pensada para **ordenadores portátiles con Linux y escritorio GNOME Shell (versiones 40 a 44)**.

### Entorno en el que se ha desarrollado y probado
- **Equipo:** Portátil **VANT MOOVE15 (2023)** (plataforma **Clevo**).
- **Sistema operativo:** **Ubuntu 22.04 LTS** (Linux kernel 6.8).
- **Escritorio:** **GNOME Shell 42.9** (compatible con GNOME Shell **40, 41, 42, 43 y 44**).

### Compatibilidad con otros portátiles
- **Compatible con prácticamente cualquier portátil Linux** (VANT, Clevo, TUXEDO, Slimbook, ThinkPad, Dell, HP, ASUS, Acer, Framework, etc.) cuya batería esté expuesta de forma estándar por ACPI en `/sys/class/power_supply/BAT*`.
- Soporta tanto baterías que reportan potencia/energía directa (`power_now`, `energy_now`, `energy_full`) como aquellas que reportan corriente y voltaje (`current_now`, `voltage_now`, `charge_now`, `charge_full`).
- **Comprobación rápida:** ejecuta `ls /sys/class/power_supply/` en una terminal; si aparece `BAT0` (o cualquier `BAT*`), tu portátil es compatible.

### ¿Para qué equipos NO sirve?
- **PCs de sobremesa** sin batería integrada (no existen métricas `BAT*` en `/sys/class/power_supply/`).
- **Otros entornos o sistemas operativos:** no funciona en Windows, macOS, KDE Plasma, XFCE ni en **GNOME Shell 45 o superior** sin migrar la extensión al formato ESM (`import`/`export`).

---

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

### Si no aparece el widget tras reiniciar sesión

Comprueba que las extensiones de usuario no estén desactivadas globalmente en GNOME (el script `install.sh` ya lo corrige automáticamente):

```bash
gsettings set org.gnome.shell disable-user-extensions false
gnome-extensions enable battery-power@vant
gnome-extensions info battery-power@vant
```

## Desinstalación

```bash
gnome-extensions disable battery-power@vant 2>/dev/null || true
rm -rf ~/.local/share/gnome-shell/extensions/battery-power@vant
```

## Extensiones relacionadas

- [gnome-keyboard-backlight-rgb](https://github.com/vicksWalkiria/gnome-keyboard-backlight-rgb): control rápido de retroiluminación, paleta de colores RGB y efectos para teclados retroiluminados en GNOME Shell 40–44.

## Licencia

MIT
