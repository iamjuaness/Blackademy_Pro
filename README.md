# ♠♥ Blackademy Pro & Hi-Lo Counter Trainer

**Blackademy Pro** es un simulador avanzado y plataforma de entrenamiento profesional de Blackjack y conteo de cartas (método Hi-Lo), diseñado bajo principios de valor esperado positivo (+EV), desviaciones estratégicas de Don Schlesinger (*Illustrious 18*) y arquitectura modular en JavaScript nativo (ES Modules).

La aplicación es completamente responsiva, funciona sin dependencias externas ni compiladores y está optimizada para desplegarse como Single Page Application (SPA) estática.

---

## 🚀 Características Principales

### 1. Mesa de Juego Multislot (5 Ranuras Activas)
- **Reparto secuencial realista:** Animaciones y tiempos de reparto carta por carta entre jugadores y crupier.
- **Configuración dinámica de asientos:** Cada uno de los 5 slots puede alternarse en cualquier momento entre:
  - **Jugador Humano:** Control manual con retroalimentación en tiempo real.
  - **Bot de Estrategia Básica:** Aplica las decisiones matemáticamente óptimas según la tabla clásica.
  - **Bot Contador Hi-Lo:** Modula el tamaño de sus apuestas (*bet ramp*) según el *True Count* y ejecuta desviaciones de juego.
  - **Vacío:** Permite simular mesas con distinta densidad de jugadores.
- **Reglas completas de casino:**
  - Blackjack natural paga 3:2 (o configurable a 6:5).
  - Reglas de crupier S17 (*Stand on Soft 17*) o H17 (*Hit on Soft 17*).
  - División de parejas (*Split* hasta 4 manos simultáneas).
  - Doblaje (*Double Down*) y Rendición Tardía (*Late Surrender*).
  - Saldo persistente y control de apuestas por ranura (+25, +100, -25).

### 2. Gimnasio de Conteo de Cartas (Método Hi-Lo)
- **Modos de entrenamiento dedicados:**
  - **Progresivo:** Aumenta el nivel y la velocidad a medida que mantienes rachas de aciertos.
  - **Velocidad Fija:** Cadencia constante seleccionable entre 200 ms y 3000 ms por naipe.
  - **Cancelación de Parejas:** Muestra naipes de a dos para entrenar la técnica de anulación visual (+1 con -1).
- **Métricas de rendimiento:** Precisión acumulada, racha récord, velocidad media y retroalimentación matemática (+EV con sugerencia de apuesta óptima).

### 3. Flashcard Quiz de Toma de Decisiones
- Evaluador interactivo de jugadas en situaciones de alta varianza.
- Desglose con demostración matemática y justificación de probabilidad detrás de cada decisión (*Hit, Stand, Double, Split, Surrender*).

### 4. Mnemotecnia y Palacio de Memoria
- Heurísticas estructuradas en 4 anclas mentales para interiorizar la estrategia básica sin memorizar mecánicamente más de 250 combinaciones:
  - *La Sala de los Bustos* (Dealer 2 al 6).
  - *El Pasillo del Doble Ataque* (Totales 9, 10 y 11).
  - *El Jardín de los Ases Suaves* (A,2 a A,7).
  - *La Bóveda de las Parejas* (Regla de Ases, 8s, 5s y 10s).

### 5. Tablas Matriciales Interactivas y Desviaciones
- Matrices de totales duros, suaves y parejas.
- Tabla detallada de las **18 Desviaciones Ilustres de Schlesinger (Illustrious 18)** con umbrales de *True Count* para alterar la estrategia básica contra la ventaja de la casa.
- Vista optimizada para móviles con columna de mano fijada (`sticky`) durante el desplazamiento horizontal.

### 6. Audio Sintético por Web Audio API
- Efectos de sonido integrados para cartas, fichas, aciertos, fallos y alertas sin requerir archivos de audio externos ni generar peticiones de red adicionales.

### 7. Persistencia Total (LocalStorage)
- Guarda automáticamente la configuración de reglas, saldos de los 5 slots, estadísticas del entrenador de conteo y récords del quiz.

---

## 📂 Estructura del Proyecto

```text
blackademy-pro/
├── css/
│   └── styles.css        # Hoja de estilos responsiva con tema casino dark
├── js/
│   ├── app.js            # Orquestador de la UI, eventos DOM y persistencia
│   ├── audio.js          # Motor de audio con Web Audio API (cero assets)
│   ├── counting.js       # Lógica del gimnasio de conteo Hi-Lo y atajos
│   ├── engine.js         # Motor de mesa, zapato (Shoe), slots y bots
│   ├── quiz.js           # Generador y validador de preguntas tipo flashcard
│   └── strategy.js       # Matrices de estrategia básica, Illustrious 18 y EV
├── index.html            # Estructura principal y navegación por pestañas
├── vercel.json           # Configuración de despliegue estático y cabeceras
└── README.md             # Documentación del proyecto
```

---

## 🛠️ Tecnologías Empleadas

- **HTML5 Semántico**
- **CSS3 Puro:** Variables CSS, Media Queries, CSS Grid, Flexbox y tipografía fluida mediante `clamp()`.
- **JavaScript Moderno (ES6+ Modules):** Programación orientada a objetos modularizada, promesas asíncronas para el reparto secuencial y tipado débil controlado.
- **Web Audio API:** Generación procedural de frecuencias y envolventes acústicas.
- **Web Storage API:** Persistencia local de partidas y configuraciones.

---

## 💻 Instalación y Ejecución Local

Dado que el proyecto utiliza módulos de JavaScript nativos (`import`/`export`), debe ejecutarse mediante un servidor HTTP local (no abriendo directamente el archivo mediante `file://`).

### Opción 1: Con Python (Recomendado)
```bash
# Python 3
python -m http.server 8000

# Abre en tu navegador:
# http://localhost:8000
```

### Opción 2: Con Node.js (`npx serve`)
```bash
npx serve .
```

### Opción 3: Con la extensión Live Server de VS Code
1. Abre la carpeta del proyecto en Visual Studio Code.
2. Haz clic derecho sobre `index.html`.
3. Selecciona **"Open with Live Server"**.

---

## 🌐 Despliegue en Producción

El repositorio cuenta con configuración lista para **Vercel** a través de `vercel.json`:

```bash
# Despliegue directo mediante Vercel CLI
npm i -g vercel
vercel --prod
```

También puede alojarse sin pasos de compilación (*buildless*) en:
- **GitHub Pages**
- **Cloudflare Pages**
- **Netlify**

---

## 📖 Reglas y Convenciones del Conteo Hi-Lo

| Grupo de Cartas | Valor Hi-Lo | Impacto en el Zapato |
| :--- | :---: | :--- |
| **2, 3, 4, 5, 6** | `+1` | Favorecen al crupier al agotarse; aumentan la ventaja del jugador restante. |
| **7, 8, 9** | `0` | Cartas neutrales sin impacto significativo. |
| **10, J, Q, K, A** | `-1` | Favorecen al jugador (Blackjacks y manos de doblaje); al salir, reducen la ventaja. |

**Cálculo del True Count (TC):**
$$\text{True Count} = \frac{\text{Running Count (RC)}}{\text{Barajas Restantes en el Zapato}}$$

---

## 📄 Licencia

Este proyecto está disponible bajo la licencia **MIT**. Consulta el código fuente para fines educativos, analíticos o recreativos.