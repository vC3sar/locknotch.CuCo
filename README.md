# 🏝️ LockNotch 2.0

> **Dynamic Island interactiva y elegante para Windows 10 y 11 con mascota virtual (CUCO), control multimedia avanzado, letras sincronizadas en tiempo real y notificaciones del sistema.**

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?logo=windows&logoColor=white)](https://github.com/vC3sar/locknotch.CuCo)
[![Electron](https://img.shields.io/badge/Electron-33.2.1-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![.NET](https://img.shields.io/badge/.NET-8.0%20(GSMTC)-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Descripción General

**LockNotch** transforma la parte superior de tu pantalla en una **Dynamic Island** flotante ultra fluida a 60 FPS, inspirada en las mejores interfaces modernas pero diseñada específicamente para el ecosistema de **Windows**.

A diferencia de simples widgets visuales, LockNotch se conecta directamente con los subsistemas nativos de Windows:
* **GSMTC (*Global System Media Transport Controls*)**: Lee en tiempo real metadatos de Spotify, Apple Music, YouTube, navegadores y reproductores locales.
* **Click-Through Inteligente**: Deja pasar el ratón hacia las ventanas de fondo cuando está colapsado y activa la captura de clics únicamente sobre el área activa o al expandirse.
* **Mascota Interactiva CUCO**: Un compañero robótico vectorial SVG con máquina de estados finitos, animaciones contextuales, reacciones de hardware y ciclos dinámicos.
* **Letras Sincronizadas LRCLIB**: Visualiza verso por verso la letra de la canción que estás escuchando con compensación de latencia en milisegundos.

---

## 🚀 Características Principales

### 🏝️ Dynamic Island Inteligente
- **Física de Resortes (Spring Animations)**: Transición elástica y continua entre modos compacto, expandido y notificaciones.
- **Transparencia & Click-Through Nativo**: Ventana sin bordes (*frameless*) que no interfiere con tus videojuegos, navegadores ni barras de título.
- **Auto-adaptación de Color (Album Tinting)**: Extrae los colores dominantes de la carátula del álbum y calcula el contraste dinámico mediante el estándar perceptivo **WCAG 2.1**.
- **Modos Visuales**: Estilos de borde personalizables (*Microlínea translúcida*, *Sin borde* o *Contraste sutil*).

### 🤖 CUCO: Mascota Virtual del Notch
- **Motor de Expresiones Procedimentales**: Ojos, párpados y visores vectoriales con seguimiento de mirada y parpadeo biológico.
- **Modo Baile Musical**: Si detecta música activa, CUCO se coloca sus auriculares y baila al ritmo acústico.
- **Modo TV / Cine**: Al reproducir videos (YouTube, Twitch, Netflix, etc.), CUCO despliega un televisor retro y se sienta como espectador.
- **Reacción a Hardware (USB y Batería)**: Anima el enchufe y desenchufe de cables al conectar periféricos.
- **Modo Reposo / Bloqueo**: Se duerme automáticamente cuando Windows entra en inactividad (`system-idle`) o bloqueas la sesión (<kbd>Win</kbd> + <kbd>L</kbd>).
- **Interacción Directa**: Haz clic sobre CUCO en el notch o desde el panel de ajustes para que te salude con mensajes aleatorios.

### 🎵 Reproductor Multimedia & Letras en Vivo
- **Compatibilidad Universal**: Spotify, Apple Music, YouTube Music, Deezer, Tidal, Chrome, Edge, Firefox, VLC, etc.
- **Controles Táctiles y de Teclado**: Play / Pausa, pista anterior, pista siguiente y barra de progreso interactiva con búsqueda por clic (*timeline seeking*).
- **Disco de Vinilo Giratorio**: Carátula circular con animación de rotación continua y pulsos de ecualizador.
- **Letras Sincronizadas (LRCLIB)**: Obtención automática de archivos `.lrc` con algoritmo de búsqueda inteligente y compensación de desfase ajustable en milisegundos.
- **Marquee Cinematográfico en Modo TV**: Un cintillo de texto continuo y fluido que pasa por debajo de CUCO, configurado por ciclos inteligentes (por defecto: 1 minuto visible / 8 minutos oculto) alternando con la hora y el clima local.

### 🔌 Notificaciones de Sistema & Hardware
- **Detección USB en Tiempo Real**: Avisos elegantes tipo HUD al conectar o desconectar memorias USB, discos externos y accesorios.
- **Cápsula de Batería Inteligente**: Visualización del nivel de carga integrado dentro de la propia píldora de batería o en modo numérico clásico, con alertas visuales de batería baja (<= 20%).
- **Clima y Ubicación en Directo**: Temperatura local y estado del cielo consultados automáticamente mediante la API de Open-Meteo.

### 📥 Monitor de Descargas en Vivo (Extensión Chromium)
- Conecta Google Chrome, Microsoft Edge, Brave u Opera para transmitir en vivo a LockNotch el nombre del archivo descargado, porcentaje completado y velocidad de transferencia en MB/s.

### ⚙️ Panel de Configuración & Bandeja del Sistema (Tray)
- Icono en el área de notificación de Windows con menú contextual rápido.
- Ventana de ajustes translúcida moderna con navegación por pestañas:
  - **General**: Inicio con Windows, cerrar con Escape, mantener siempre visible.
  - **Apariencia**: Estilo de bordes, degradado de carátula, formato de batería, animaciones fluidas.
  - **Mascota CUCO**: Toggles de baile, modo TV, animaciones USB, descanso por inactividad y botón de saludo.
  - **Multimedia & Letras**: Conmutador de letras, slider de compensación en milisegundos y temporizador de modo TV.
  - **Notificaciones & Hardware**: Avisos USB, alertas de batería baja, botones de simulación y reinicio de servicios.

---

## ⌨️ Atajos de Teclado

Cuando LockNotch está expandido:

| Tecla | Acción |
| :--- | :--- |
| <kbd>Escape</kbd> | Colapsar la isla (configurable en ajustes) |
| <kbd>Espacio</kbd> | Alternar Reproducción / Pausa |
| <kbd>→</kbd> | Siguiente canción |
| <kbd>←</kbd> | Canción anterior |
| **Clic en CUCO** | Saludar / Reacción de alegría |

---

## 📋 Requisitos del Sistema

* **Sistema Operativo**: Windows 10 (Build 19041 o superior) o Windows 11.
* **Node.js**: Versión 18.0 o superior ([Descargar Node.js](https://nodejs.org/)).
* **Gestor de paquetes**: `npm` o `pnpm`.
* *(Opcional)* **.NET 8 SDK**: Solo necesario si deseas compilar desde cero el servicio C# `media-service` ([Descargar .NET 8](https://dotnet.microsoft.com/download/dotnet/8.0)). El repositorio ya incluye el ejecutable compilado listo para usar.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone https://github.com/vC3sar/locknotch.CuCo.git
cd locknotch.CuCo
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar la aplicación en modo desarrollo
```bash
npm start
```
*También puedes hacer doble clic en el archivo `iniciar_locknotch.bat` para ejecutar la aplicación directamente.*

---

## 📦 Compilación y Creación de Ejecutables

### 1. Compilar el servicio GSMTC (.NET 8)
Si modificas el código de captura de medios en [`scripts/media-service/Program.cs`](file:///scripts/media-service/Program.cs):
```bash
cd scripts/media-service
dotnet build -c Release
cd ../..
```
Esto generará el ejecutable binario en `scripts/media-service/bin/Release/net8.0-windows10.0.19041.0/media-service.exe`.

### 2. Empaquetar la aplicación con Electron Builder
Para empaquetar LockNotch en una carpeta ejecutable portátil:
```bash
npm run pack
```

Para generar el instalador de Windows (`.exe` / `.msi`):
```bash
npm run dist
```
Los archivos de distribución se generarán en la carpeta `dist/`.

---

## 🧩 Instalación de la Extensión de Navegador

Para habilitar la visualización de descargas en tiempo real en la isla:

1. Abre **Google Chrome**, **Microsoft Edge**, **Brave** u **Opera**.
2. Dirígete a la gestión de extensiones:
   - En Chrome/Brave: `chrome://extensions/`
   - En Edge: `edge://extensions/`
3. Activa la casilla o interruptor **Modo de desarrollador** (arriba a la derecha).
4. Haz clic en **Cargar descomprimida** (*Load unpacked*).
5. Selecciona la carpeta `extension/` que se encuentra dentro del directorio de LockNotch.

¡Listo! Cuando comience una descarga, la isla cambiará automáticamente al modo de descarga mostrando el progreso, velocidad y un indicador animado al finalizar.

---

## 🔌 API HTTP Local

LockNotch incluye un servidor HTTP ligero en el puerto local `4040` (`http://127.0.0.1:4040`) para integraciones externas y scripting:

| Método | Endpoint | Cuerpo (JSON) | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/download` | `{"name": "setup.exe", "progress": 45, "speed": 5242880, "state": "in_progress"}` | Transmite un estado de descarga a la Dynamic Island. |
| `POST` | `/settings` | *Vacío* | Abre la ventana de configuración de LockNotch. |
| `POST` | `/usb` | `{"action": "connected" \| "disconnected", "device": "USB Kingston"}` | Simula o notifica un evento USB. |

---

## 📁 Estructura del Proyecto

```text
LockNotch/
├── assets/                  # Iconos, sonidos, carátulas y recursos visuales
│   ├── current_media.jpg    # Caché temporal de portada extraída de GSMTC
│   └── tray_icon.png        # Icono nativo para la bandeja del sistema
├── cuco/                    # Mascota virtual interactiva
│   ├── cuco-state.js        # Máquina de estados finitos y transiciones
│   ├── cuco.js              # Controlador SVG, eventos y montaje DOM
│   └── cuco.css             # Animaciones por capas (ojos, brazos, visor, TV)
├── extension/               # Extensión Chromium (Manifest V3)
│   ├── manifest.json        # Manifiesto de la extensión
│   └── background.js        # Listener de downloads de Chrome hacia el puerto 4040
├── scripts/                 # Servicios nativos en segundo plano
│   ├── media-service/       # Servicio C# .NET 8 que consume Windows.Media.Control
│   ├── usb_monitor.ps1      # Monitor WMI para detección de periféricos USB
│   └── media_reader.ps1     # Script fallback de PowerShell para lectura GSMTC
├── index.html               # Estructura DOM de la Dynamic Island
├── styles.css               # Estilos del notch, transiciones y temas de contraste
├── renderer.js              # Controlador principal del frontend, letras y eventos
├── main.js                  # Proceso principal de Electron, tray, IPC y HTTP server
├── settings.html            # Interfaz del panel de ajustes
├── settings.css             # Estilos de la ventana de configuración
├── settings.js              # Persistencia (localStorage) y lógica de configuración
├── iniciar_locknotch.bat     # Lanzador rápido para Windows
└── package.json             # Configuración del proyecto y dependencias de Electron
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si tienes sugerencias, mejoras para animaciones, nuevos accesorios para CUCO o soporte para otros servicios:

1. Realiza un Fork del repositorio.
2. Crea tu rama de características (`git checkout -b feature/NuevaCaracteristica`).
3. Confirma tus cambios (`git commit -m 'feat: añadir nueva funcionalidad'`).
4. Sube tu rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un **Pull Request**.

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE). Siéntete libre de usarlo, modificarlo y compartirlo.

---

<p align="center">
  Hecho con ❤️ para la comunidad de Windows.
</p>
