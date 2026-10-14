# Anverso

Galería online de obras únicas de artistas independientes. Cualquier persona puede crear su perfil de artista, publicar sus obras y venderlas; la plata de cada venta le llega directo a su cuenta de Mercado Pago.

Publicada en: https://santicarrillo.github.io/Pagina-Obras/

## Cómo está armada

| Pieza | Para qué |
| --- | --- |
| Angular 22 (`src/`) | La página. Componentes standalone, señales, sin zone.js. |
| GitHub Pages | Donde se publica la página (rama `gh-pages`). |
| Firebase Auth | Login con link por mail o con Google. |
| Firestore | Obras, perfiles, pedidos. Protegida por `firestore.rules`. |
| Cloud Functions (`functions/index.js`) | Todo lo que mueve plata: conectar Mercado Pago, crear pagos, confirmar ventas, devoluciones, envíos y mails. Región `southamerica-east1`. |
| Cloudinary | Las fotos de las obras (cuenta `xmmd0cpx`, preset `obras_arte`). |
| Mercado Pago | Cobros en modo marketplace: cada artista conecta su cuenta por OAuth. |

Carpetas de la página:

- `public/`: lo que ve cualquiera (galería, obra, artista, login, legales, 404).
- `comprador/`: carrito, mis pedidos, mi cuenta, quiero vender.
- `admin/`: panel del artista (mis obras, nueva/editar obra, mis ventas, perfil).
- `shared/`: piezas que se usan en varias pantallas.
- `core/`: servicios (Firebase, obras, pedidos, carrito, Mercado Pago) y datos fijos.

## Levantar la página en tu compu

```powershell
npm install
ng serve
```

Abrí http://localhost:4200. En modo desarrollo aparecen obras y artistas de prueba (`core/data/obras-demo.ts`); en la versión publicada no.

## Publicar la página

```powershell
ng deploy --base-href=/Pagina-Obras/
git add .
git commit -m "Qué cambió"
git push
```

## Publicar funciones y reglas

```powershell
cd functions
npm install
cd ..
$env:FUNCTIONS_DISCOVERY_TIMEOUT=60
firebase deploy --only functions,firestore:rules
```

## Configuración y secretos

`functions/.env` solo tiene datos públicos:

```
MP_CLIENT_ID=...
WEB_URL=https://santicarrillo.github.io/Pagina-Obras
COMISION_PORCENTAJE=0
SMTP_USER=mail-de-anverso@gmail.com
```

Los secretos **nunca** van al repo ni se pegan en ningún chat. Se cargan desde un archivo fuera del proyecto y después se borra:

```powershell
firebase functions:secrets:set MP_CLIENT_SECRET --data-file C:\ruta\fuera\del\proyecto\secreto.txt
firebase functions:secrets:set SMTP_PASS --data-file C:\ruta\fuera\del\proyecto\mail.txt
```

## Cómo funciona una venta

1. El comprador arma el carrito (un pago por artista) y completa sus datos de envío.
2. `crearPago` lee precios desde Firestore (nunca del navegador), crea el pedido `pendiente` y un link de pago de Mercado Pago que vence en una hora.
3. Mercado Pago avisa a `mpWebhook`, que vuelve a consultar el pago y llama a `confirmarVenta`.
4. `confirmarVenta`, en una transacción, marca las obras como `vendida` y el pedido como `pagado`. Si la obra ya se vendió, cambió el precio o el monto no coincide, devuelve el pago solo.
5. El artista carga el envío en "Mis ventas" (`actualizarEnvio`) y el comprador lo sigue en "Mis pedidos". Cada paso manda un mail.
