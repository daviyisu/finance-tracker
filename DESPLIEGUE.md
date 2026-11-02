# Desplegar la PWA en Cloudflare Pages

La app es una web estática: se compila en la carpeta `www` y Cloudflare Pages la sirve con HTTPS, gratis.

## 1. Crear el proyecto (una sola vez)

1. Entra en <https://dash.cloudflare.com> (crea una cuenta gratuita si no tienes).
2. **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
3. Autoriza GitHub y elige el repositorio `daviyisu/finance-tracker`.
4. Configuración de compilación:

   | Campo                  | Valor           |
   | ---------------------- | --------------- |
   | Production branch      | `main`          |
   | Framework preset       | `None`          |
   | Build command          | `npm run build` |
   | Build output directory | `www`           |

   La versión de Node se toma del archivo `.node-version` del repositorio; no hace falta configurarla.

5. **Save and Deploy**. En un par de minutos tendrás la app en `https://<nombre-del-proyecto>.pages.dev`.

A partir de ahí, cada push a `main` se despliega solo.

## 2. Cosas que ya están resueltas

- **Rutas de la app**: como no hay `404.html`, Cloudflare Pages devuelve `index.html` para cualquier ruta
  (p. ej. al recargar en `/tabs/ajustes`). No hace falta `_redirects`.
- **Actualizaciones**: Cloudflare sirve los archivos sin caché larga, así que el service worker detecta
  enseguida las versiones nuevas. La versión nueva se aplica la siguiente vez que se abre la app.

## 3. Instalar la app en el móvil

- **iPhone**: abre la URL en **Safari** → botón Compartir → **Añadir a pantalla de inicio**.
- **Android**: abre la URL en Chrome → **Instalar app** (o menú ⋮ → Instalar).

## 4. Importante sobre los datos

- Los datos se guardan **solo en el dispositivo**, dentro del navegador, y van ligados al dominio.
  Usa siempre la misma URL: si cambias de dominio, la app empezará vacía.
- Las URL de vista previa que Cloudflare crea para otras ramas (`<hash>.<proyecto>.pages.dev`)
  son dominios distintos, con datos distintos. Úsalas solo para probar.
- En iPhone, la app instalada y Safari tienen datos separados: instálala antes de empezar a usarla.
- Haz copias de vez en cuando desde **Ajustes → Exportar copia de seguridad** y guárdalas
  (Archivos, iCloud, correo...). Con **Restaurar copia de seguridad** recuperas los datos
  en otro móvil, en otro navegador o en la app nativa.

## 5. Dominio propio (opcional)

En el proyecto de Pages → **Custom domains** → **Set up a custom domain**. Si vas a usar uno,
configúralo **antes** de empezar a meter datos (ver punto 4).

## Probar la versión de producción en local

```bash
npm run build
npx http-server www -p 8080 --proxy http://localhost:8080?
```

Y abre <http://localhost:8080>. El service worker solo funciona en `localhost` o con HTTPS.
