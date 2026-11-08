// Cloudflare Pages middleware: send every *.pages.dev request to the app's own domain.
const CANONICAL_HOST = "contour.parthchandak.info";

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname.endsWith(".pages.dev")) {
    url.hostname = CANONICAL_HOST;
    url.port = "";
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
