# 1. Introduccion

Documento de documentacion del proyecto **UNJBG News**. Describe el contexto, los
objetivos, el alcance y la justificacion. El plan de trabajo y el detalle de las
fases estan en `plan.md`; la arquitectura tecnica, en `04-arquitectura.md`.

## 1.1 Contexto y planteamiento del problema

La Universidad Nacional Jorge Basadre Grohmann (UNJBG) y su entorno —la ciudad
de Tacna y la region— generan a diario informacion de interes publico:
comunicados, actividades academicas, obras, eventos deportivos y culturales,
avisos de servicios y noticias locales. Sin embargo, esa informacion **no llega
por un canal unico**. Circula dispersa entre:

- **WhatsApp:** canales institucionales y grupos de estudiantes, docentes y
  organizaciones. Suele ser el canal donde la noticia aparece primero.
- **Facebook:** paginas oficiales y grupos donde se comparte y se comenta.
- **Sitios web y RSS:** los pocos medios o dependencias que publican de forma
  formal.

Esta dispersion genera varios problemas concretos:

- Para estar informado hay que revisar **muchas fuentes** de forma manual y
  constante; es facil perderse algo.
- No existe un **punto unico de consulta** que reuna todo el contenido.
- Mucha informacion relevante **nunca llega** a los portales tradicionales,
  porque nace y muere en un grupo de WhatsApp.
- Las fuentes **no comparten formato**: un mensaje de WhatsApp es texto plano
  con enlaces y hashtags; una pagina de Facebook es HTML con imagenes; un sitio
  web puede tener RSS o no. Unificar todo eso a mano es inviable.

**Planteamiento.** Construir una plataforma web que compile, ordene y publique
automaticamente contenido proveniente de esas fuentes, con una **curacion
hibrida**: las fuentes de confianza publican solas y el resto pasa por una cola
de moderacion revisada por una persona. El sitio publico se muestra con un
estilo clasico, sencillo y de carga rapida.

## 1.2 Objetivos

**Objetivo general**

Desarrollar un sitio de noticias que integre de forma automatica contenido de
WhatsApp, Facebook y sitios web, lo normalice y lo publique con una curacion
hibrida, operando en un servidor propio de bajo costo.

**Objetivos especificos**

1. Implementar **adaptadores de ingesta** para cada tipo de fuente (WhatsApp,
   Facebook, web/RSS), con extraccion centralizada de identidad y contenido.
- Evitar duplicados mediante **deduplicacion** por identificador de origen y por
  similitud de titulo.
- Procesar automaticamente el contenido: descarga y optimizacion de imagenes
  (`sharp`), limpieza de HTML y asignacion de categoria.
- Ofrecer una **cola de moderacion** con acciones de revisar, editar, publicar y
  rechazar.
- Publicar un sitio publico con secciones, ficha de noticia, busqueda y
  metadatos para buscadores (SEO).
- Medir el interes del publico con un contador de visitas para armar la seccion
  "Lo mas leido".
- Desplegar el sistema completo con Docker Compose en un VPS, con respaldo
  automatico de la base de datos.

## 1.3 Alcance

**Incluye:**

- Integracion de **20 a 100 fuentes** entre WhatsApp, Facebook y web/RSS.
- Panel de administracion con cola de moderacion y ABM de fuentes y categorias.
- Sitio publico con portada, secciones, ficha de noticia, busqueda y paginado.
- Carga de imagenes procesadas (redimensionadas y comprimidas).
- SEO basico: metadatos, Open Graph, `sitemap.xml` y `robots.txt`.
- Publicidad en laterales como **marcador de posicion** (placeholder).
- Despliegue en local y en un VPS con `app` + `postgres` + `nginx`.

**No incluye (por ahora):**

- Aplicacion movil nativa.
- Cuentas de lectores, comentarios o interaccion de usuarios.
- Monetizacion real con Google AdSense (se activa cuando exista un dominio
  propio y algo de trafico).
- Soporte multi-idioma.
- Traduccion o resumen automatico con modelos de lenguaje.

## 1.4 Justificacion

- **WhatsApp primero.** Es el canal donde la informacion local aparece antes y
  el que mas gente usa a diario. Ignorarlo seria dejar afuera la mayor parte del
  contenido. Tecnicamente se accede mediante Baileys, la forma estandar de
  conectarse a WhatsApp Web desde Node.js.
- **Facebook como complemento.** Las paginas institucionales publican avisos
  formales y los grupos concentran contenido local y vecinal.
- **Web y RSS como base formal.** Son las fuentes mejor estructuradas y las que
  aportan texto limpio, lo que mejora la calidad del resultado.
- **Curacion hibrida.** Automatizar todo reduciria el trabajo, pero publicar sin
  control contenido de origen no verificado afectaria la credibilidad. El
  equilibrio es dejar que las fuentes de confianza publiquen solas y moderar el
  resto.
- **Estilo clasico de portal.** Una maqueta simple, de carga rapida y familiar,
  favorece la lectura y el rendimiento en conexiones lentas, y se acerca al
  aspecto de los portales de la decada de 2010.
- **Costo controlado.** Toda la solucion corre en un unico VPS barato, sin
  servicios en la nube cobrados por uso.
