/**
 * Punto de entrada en Vercel.
 *
 * Está en JavaScript plano y a propósito: Vercel compila los archivos de `api/`
 * con esbuild, que no emite metadata de decoradores. Nest depende de esa
 * metadata para inyectar dependencias, así que el código decorado tiene que
 * llegar ya compilado por `tsc` (lo hace `npm run build`) y este archivo
 * limitarse a requerirlo.
 */
const { createApp } = require('../dist/src/main');

// La instancia se reusa entre invocaciones que caigan en el mismo contenedor:
// levantar Nest y abrir los pools de Postgres en cada request agregaría
// segundos a cada llamada. Se guarda la promesa, no la app, para que dos
// requests concurrentes durante el arranque en frío esperen el mismo boot en
// vez de arrancar cada uno el suyo.
let appPromise;

async function obtenerHandler() {
  if (!appPromise) {
    appPromise = (async () => {
      const app = await createApp();
      // `init()` monta middlewares, filtros y rutas. Es lo que `listen()` hace
      // antes de abrir el socket, y acá el socket lo pone Vercel.
      await app.init();
      return app.getHttpAdapter().getInstance();
    })().catch((err) => {
      // Sin esto, un fallo de arranque queda cacheado y todas las invocaciones
      // siguientes fallan con el mismo error sin volver a intentarlo.
      appPromise = undefined;
      throw err;
    });
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const express = await obtenerHandler();
  return express(req, res);
};

// Vercel parsea el cuerpo del request por defecto y deja el stream consumido.
// Multer, que es quien recibe los PDFs, lee ese stream: sin desactivarlo acá,
// las cargas llegan vacías al controlador.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
