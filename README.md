# Mochi Garden — PWA de estudio

## Ejecutar
Ejecuta `python -m http.server 8000` desde esta carpeta y abre `http://localhost:8000`. Para instalarla en el móvil, publícala en HTTPS.

## Recompensas
- 1 gema por cada minuto completo estudiado.
- Al pulsar “Completar sesión”, se calcula el bonus con `floor(0.01*t² + 0.15*t)`, donde `t` son todos los minutos completos, incluidos los minutos extra posteriores al temporizador.
- El temporizador no finaliza automáticamente: al llegar a cero entra en tiempo extra y espera a que la persona confirme que ha terminado.
- Si se cancela o abandona la página, se conservan gemas por minutos completos, pero no se entrega bonus.
- La comida comprada se guarda en el Almacén y solo se consume al pulsar “Dar a Mochi”.
- Las pestañas de tienda, almacén, enfoque y progreso ocultan el banner de bienvenida para mostrar directamente su contenido.

## Limitación del navegador
El temporizador usa marcas de tiempo, así que no depende de actualizaciones puntuales de JavaScript. La app no cancela por `visibilitychange` ni `blur`, para permitir apagar la pantalla; usa `pagehide` para invalidar una sesión al salir/navegar fuera de la página. El comportamiento exacto varía entre navegadores móviles. Los datos se guardan en `localStorage` del dispositivo.
