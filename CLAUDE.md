# Faktia — frontend

Faktia: sistema de facturación electrónica multi-tenant (ARCA). Vite 6 + React 19 + React Router 7 + TanStack Query 5 + Tailwind 4 + lucide-react.
Arquitectura general en `../ARCHITECTURE.md`; estado y pendientes en `../PLAN.md`. Backend en `../faktia-backend`.

## Forma de trabajo

- **No crear ramas, commits ni push.** Se trabaja sobre la rama actual y el usuario commitea. Al terminar, decir qué archivos van juntos para que pueda commitear por partes.
- No cambiar lógica de negocio, endpoints ni integraciones cuando el pedido es de UI.
- Antes de dar algo por terminado: `npm run typecheck`, `npm run lint` y `npm run build` (el CI corre lint + build).
- Finales de línea LF (`.gitattributes`). Si se reescribe un archivo desde un script en Windows, guardarlo en UTF-8 sin BOM y con LF.
- Textos de la UI en español rioplatense con voseo ("Elegí", "Cargá"), frases cortas, sin emojis. Nombres de variables, componentes y comentarios también en español, como el resto del código.

## Identidad visual (Faktia)

Estilo nórdico: minimalista, mucho aire, pocos colores bien usados, nada recargado. Sin gradientes, sin sombras pesadas.

- **Nombre:** "Faktia"; en el logo siempre "faktia" en minúscula.
- **Logos:** en `public/brand/` (horizontal, ícono, app-icon, favicon, cada uno en versión normal, negativo y mono). **No redibujar ni recolorear**: usar los archivos.
  - Negativo sobre fiordo (sidebar, header mobile); horizontal en el login; ícono mono gris en estados vacíos; ícono en los loaders.
- **Tokens:** única fuente en `src/styles/tokens.css` (variables `--fk-*` en `:root` y utilidades de Tailwind con el mismo nombre: `bg-fk-fiordo`, `text-fk-gris-texto`, `rounded-fk`, `shadow-fk-modal`…). **Nunca hex sueltos** en componentes. La paleta por defecto de Tailwind está desactivada (`red-500` y similares no existen).
  - Fiordo `#1E3A4C` principal · Terracota `#C45C3B` solo acento sin texto (pliegue, barra activa) · Terracota texto `#A84A2C` para texto chico y fondo del CTA · Blanco roto `#F2F1EC` fondo · Blanco cards/tablas/inputs · Grafito `#1B262D` texto · Gris texto `#4A5258` secundario · Niebla `#DDE3E6` superficies y hover · Borde `#E4E2DA` · Pino `#23423A` OK.
  - Estados (fondo/texto): OK `#E3ECE8/#23423A`, pendiente `#F6EDD8/#8A6414`, error `#F7E2DE/#A3352B`, info/borrador `#DDE3E6/#1E3A4C`.
  - Si hace falta un color nuevo, **no inventarlo**: preguntar.
- **Contraste:** mínimo WCAG AA (4,5:1 en texto normal). El terracota `#C45C3B` no da AA con texto blanco chico: para botones y texto usar `terracota-texto`. Si un par no llega, avisar.
- **Tipografía:** Familjen Grotesk (Google Fonts, 400/500/600/700) para todo. Monoespaciada solo para hashes, API keys, PEM y código.
  - Título de página `fk-titulo` (32/600, -0.02em, fiordo) · subtítulo/título de card `fk-subtitulo` (20/600) · cuerpo 15–16/400, interlineado 1.5 · etiquetas y headers de tabla `fk-etiqueta` (12/700, mayúsculas, 0.12em, gris texto).
  - Importes, números de comprobante, CUIT y fechas con `tabular-nums`; importes alineados a la derecha (`fk-num`).
- **Espaciado y forma:** escala de 4 px. Radios: 4 px (`rounded-fk`) inputs, botones y cards; 8 px (`rounded-fk-modal`) modales; 999 px (`rounded-fk-badge`) solo badges. Cards con borde 1 px, sin sombra; modales con `shadow-fk-modal`.
- **Foco visible** en todo lo interactivo (global en `index.css`): outline 2 px fiordo, offset 2 px. Sobre fondos fiordo, envolver en `.fk-sobre-oscuro` (el foco pasa a blanco roto).
- **Favicon, apple-touch-icon y manifest** ya configurados (`index.html`, `public/manifest.webmanifest`, theme `#1E3A4C`, fondo `#F2F1EC`, title "Faktia").

## Componentes (usar estos antes de armar estilos a mano)

`src/components/ui.tsx` y `src/components/estilos.ts`:

- `Boton` con variantes:
  - `primario` (terracota-texto, texto blanco): **uno solo por pantalla**, el CTA principal (el terracota no pasa del ~5% de la pantalla).
  - `secundario` (fondo fiordo).
  - `terciario` (borde fiordo): Cancelar, Anterior/Siguiente, acciones secundarias.
  - `destructivo` (texto `#A3352B`): eliminar, revocar, descartar.
  - `fantasma` (solo texto): acciones dentro de filas (Editar, Quitar).
  - Altura mínima 40 px. Para algo que no es `<button>`, usar `claseBoton(variante)`.
- `Campo` (label 13/600 arriba, `ayuda` o `error` debajo), `Entrada`, `EntradaNumero` (formato argentino, alineado a la derecha), `Selector`, `claseInput`, `claseArchivo` para `<input type="file">`.
- `Tarjeta`: card blanca con borde y título opcional.
- `EncabezadoPagina`: título, `migas`, descripción, `acciones` y `junto` (número o badge al lado del título).
- `Migas`: breadcrumbs. **En pantallas de detalle o alta se usan breadcrumbs, no un link "← volver".** Ejemplo: `Comprobantes › Nueva factura`.
- Tablas: `<ContenedorTabla><table className="fk-tabla">`. Header en etiqueta, filas de 48 px, hover niebla, `className="fk-num"` en celdas y `th` de importes. En mobile la tabla scrollea dentro de su contenedor.
- `Etiqueta` (badge con `tono`: ok, pendiente, error, info) y `EtiquetaEstado`.
  - Los estados se definen en `src/lib/formato.ts` como `{ texto, tono, tachado? }`, nunca con clases sueltas.
  - Mapeo:
    - ok: emitido, cobrado, facturado, listo, confirmado.
    - pendiente: verificando, en revisión, ambiente de pruebas.
    - error: rechazado, con errores, fallido.
    - info: borrador, inactivo, anulado (este último tachado).
- `Aviso` (ambar, azul, verde) y `AlertaError` (error de API con detalle técnico desplegable).
- `Modal`, `Cargando` (ícono de la marca) y `Vacio`: ícono mono gris, frase corta y `accion` con el CTA cuando tiene sentido.
- **Toasts (éxito y error):** toda acción que guarda, crea, borra o cambia algo avisa con un toast. Tienen forma de ticket (`components/Toasts.tsx`, estilos `.fk-ticket*` en `index.css`): no cambiarlo por un toast genérico.
  - **Cada `useMutation` lleva `meta`** con mensajes propios, cortos y en voseo: `meta: { exito: 'Cliente creado.', error: 'No se pudo guardar el cliente.' }`. El `MutationCache` de `main.tsx` los muestra solo.
  - `exito`: sin él no hay toast de éxito (sirve para consultas que ya muestran su resultado en pantalla). Puede depender del render: `cliente ? 'Cliente actualizado.' : 'Cliente creado.'`.
  - `error`: es el título; debajo va el mensaje de la API. Sin él, el título es el mensaje de la API. `error: false` lo silencia (solo si el error ya se maneja de otra forma). Los 401 no muestran toast.
  - Si el mensaje depende de las variables o de la respuesta (estado nuevo, activar/desactivar, resultado de ARCA), llamar `toast.exito()` / `toast.error()` de `@/lib/toasts` en el `onSuccess` y no poner `exito` en `meta`.
  - El `AlertaError` del formulario se mantiene: el toast avisa aunque el error quede fuera de la vista y el `AlertaError` deja el detalle junto al formulario.
- `MarcoPublico`: pantallas sin sesión (fondo fiordo, card blanca con el logo y el tagline "Facturar no debería ser un trámite.").

## Layout y criterios de pantalla

- `AppLayout`:
  - **Desktop:** sidebar fiordo a toda la altura, con el logo negativo arriba (ícono cuando está colapsado). Ítems en blanco roto; el activo lleva barra terracota de 3 px, fondo y texto en 600 (la barra sola no llega a 3:1).
  - **Mobile:** header fiordo con el logo y menú desplegable.
- **Barra superior:** solo el aviso de "Ambiente de pruebas" y el usuario. **No repetir el nombre de la empresa** (es redundante con el usuario).
- **Aprovechar el ancho:** el contenido usa casi todo el ancho (`--fk-ancho-contenido`) con márgenes laterales, sin grandes vacíos arriba ni a los costados.
  - Formularios largos: en pantallas anchas, cards lado a lado (`xl:grid-cols-2`) o más columnas en la grilla de campos (ej.: Recibos, Datos del emisor).
- **Pestañas: cada pestaña lleva un ícono** de `lucide-react` a la izquierda del texto (`h-4 w-4`, `strokeWidth={1.75}`, `aria-hidden`).
  - Vale también para los selectores que funcionan como pestañas: filtros por estado, elección de tipo.
  - Referencias: `ConfiguracionPage.tsx`, filtros de `ImportacionDetallePage.tsx`, tipo de recibo en `RecibosPage.tsx`.
  - La fila de pestañas puede deslizarse en horizontal en mobile, **sin barra de scroll visible**.
- **Responsive:** en mobile el sidebar pasa a menú desplegable y las tablas scrollean horizontalmente dentro de su contenedor. Nada debe generar scroll horizontal de la página.
- **Íconos:** siempre `lucide-react`, trazo 1.75, nunca emojis.
- **Reordenar con flechas (subir/bajar):** el movimiento se anima para que se vea qué renglón sube y cuál baja. Usar `useAnimarMovimiento()` de `src/lib/animarMovimiento.ts`:
  - `ref={animar.ref(clave)}` en el elemento de cada renglón, con la misma clave estable del `key` (nunca el índice).
  - `animar.capturar()` justo antes del `setState` que cambia el orden.
  - El renglón necesita fondo propio (`bg-fk-blanco`) para no transparentar al cruzarse con el vecino.
  - Ya respeta "reducir movimiento" del sistema. Referencia: ítems de `PresupuestoPage.tsx`.

## Revisión visual

Para mirar pantallas sin backend: un API simulado con Node más Vite con `VITE_API_URL` apuntando a él. Chrome headless no baja de ~500 px de ancho: para mobile, capturar dentro de un iframe de 390 px. Borrar cualquier archivo temporal agregado a `public/`.
