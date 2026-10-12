# Changelog

## 1.1.0
**Motor:** reinicio de RC al barajar (sin barajar a mitad de mano), peek de blackjack del dealer, Ases divididos con una carta,
21 tras split ya no es blackjack, rendición solo en las dos primeras cartas sin split, DAS configurable, validación de acciones,
timers ligados a la ronda (`destroy()`), recompra, `baseBet` ya no se corrompe con saldo bajo, scheduler inyectable para tests.
**Estrategia:** tablas S17/H17 reales (`getStrategyTable`), motor de desviaciones Illustrious 18 data-driven (15 índices de jugada + seguro),
explicaciones sin cifras inventadas.
**Quiz:** `H` ya no vale cuando lo óptimo es rendirse, repaso de fallos, precisión por celda.
**Conteo:** TC real según mazos restantes, consejo de apuesta corregido, validación de entrada y doble envío.
**Gamificación:** progresión sin bloqueos, tipos avanzados opcionales, racha por fecha local, regeneración de corazones, gemas con uso, XP anti-farmeo.
**Calidad:** 49 tests (`npm test`) incluida simulación Monte Carlo; CI en GitHub Actions.
**Despliegue:** `vercel.json` sin `routes` redundantes y con caché real para JS/CSS.
