# 4. Arquitectura

Documento de documentacion del proyecto **UNJBG News**. Describe la arquitectura
tecnica del sistema. El plan y las fases estan en `plan.md`; el contexto y los
objetivos, en `01-introduccion.md`.

## 4.1 Arquitectura general

La plataforma es **una sola aplicacion Next.js** (App Router) que cumple tres
funciones a la vez: sitio publico, panel de administracion y API de ingesta. Se
apoya en PostgreSQL para los datos y guarda las imagenes en disco. Todo el
sistema se ejecuta con Docker Compose.

### 4.1.1 Vista general

```
[Fuentes: sitios web / RSS / Facebook / WhatsApp]
          |  un adaptador por fuente
          v
 [API de ingesta] --> PostgreSQL "raw_items"
          |          (dedup por fuente + id externo + hash de contenido)
          v
 [Pipeline] -- descarga de fotos -> sharp -> limpieza HTML -> categoria
          v
 [Cola de moderacion: borrador / publicado / rechazado]
          |   fuente de confianza = publica sola; el resto espera al admin
          v
 [Sitio publico Next.js]  <--  [Panel admin (aprobar / editar / descartar)]
```

### 4.1.1 Componentes

- **Adaptadores de fuentes.** Un modulo por tipo de fuente (web, RSS, Facebook,
  WhatsApp) que obtiene los elementos crudos y los normaliza a una forma comun.
  Los adaptadores no escriben en la base de datos directamente: entregan los
  datos a la capa de ingesta.
- **API de ingesta.** Recibe los elementos normalizados, calcula el identificador
  externo y el hash de contenido, y los guarda en `raw_items`. Aqui ocurre la
  **deduplicacion**: no se vuelve a insertar un elemento ya visto.
- **Pipeline de procesamiento.** Toma los `raw_items` pendientes y genera el
  `post` final: descarga y comprime las imagenes con `sharp`, limpia el HTML,
  asigna una categoria y calcula el texto de busqueda en espanol.
- **Base de datos (PostgreSQL).** Guarda fuentes, elementos crudos, noticias
  publicadas, categorias y usuarios del panel. Incluye busqueda de texto completo
  en espanol y coincidencia aproximada de titulos para no duplicar la misma nota
  tomada de varias fuentes.
- **Panel de administracion.** Interfaz privada donde el equipo revisa la cola de
  moderacion, edita titulares e imagenes, aprueba o rechaza, y administra fuentes
  y categorias.
- **Sitio publico.** Interfaz de lectura, renderizada en el servidor, con
  portada, secciones, ficha de noticia, busqueda y paginado.
- **Almacenamiento de medios.** Las imagenes procesadas se guardan en disco y se
  sirven como archivos estaticos (mediante `nginx` en produccion).
- **Programador de tareas.** Un proceso que dispara la recoleccion con la
  frecuencia configurada por fuente (minutos para WhatsApp y Facebook, intervalos
  mayores para los sitios web).

### 4.1.2 Flujo de una noticia

1. El programador o la API activa el adaptador de una fuente.
2. El adaptador obtiene los elementos nuevos y los entrega a la ingesta.
3. La ingesta descarta duplicados y guarda lo nuevo en `raw_items`.
4. El pipeline procesa cada elemento: imagenes, limpieza de HTML, categoria y
   texto de busqueda.
5. Segun el indicador de la fuente:
   - fuente de confianza (`autopublish = true`): la noticia se publica sola.
   - fuente no verificada (`autopublish = false`): queda en la cola de
     moderacion.
6. Un editor revisa, edita o rechaza lo que esta en cola.
7. La noticia publicada aparece en el sitio, en su seccion y en el buscador.

### 4.1.3 Decisiones de arquitectura

- **Una sola aplicacion.** El sitio publico, el panel y la API viven en el mismo
  proyecto Next.js. Reduce la cantidad de piezas que desplegar y mantener, algo
  importante para un equipo con poca experiencia en JavaScript.
- **Renderizado en el servidor.** Los listados y las fichas se generan en el
  servidor en cada peticion, lo que garantiza contenido fresco y evita depender
  de la base de datos durante la compilacion.
- **Curacion hibrida.** El indicador `autopublish` por fuente define que se
  publica automaticamente y que requiere revision humana.
- **Deduplicacion en dos niveles.** Un identificador unico por fuente y elemento
   mas la coincidencia aproximada de titulos evita publicar la misma noticia
   varias veces cuando es tomada de varias fuentes.
- **Un unico VPS.** `app` + `postgres` + `nginx` con Docker Compose, imagenes en
  un volumen de disco y respaldo diario de la base. Sin costos por uso.

### 4.1.4 Entornos

- **Desarrollo (local).** Se ejecuta en la maquina del equipo. WhatsApp se
  vincula con un numero personal y el contenido procesado se usa para ajustar
  filtros y categorias.
- **Produccion (VPS).** El mismo conjunto de contenedores, con `nginx` para
  servir los archivos de imagen y terminar el HTTPS, y un numero de telefono
  dedicado para el bot.
