/*global Ultraviolet*/
(function () {
  var base = "/";
  try {
    if (self.document) {
      var scripts = self.document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src || "";
        if (!src) continue;
        if (/uv\.config\.js/i.test(src)) {
          var u = new URL(src, self.location.href);
          // /repo/uv/uv.config.js -> /repo/
          base = u.pathname.replace(/\/uv\/uv\.config\.js$/i, "/");
          if (!base.endsWith("/")) base += "/";
          break;
        }
      }
    }
  } catch (e) {}

  if (!base.startsWith("/")) base = "/" + base;
  if (!base.endsWith("/")) base += "/";

  self.__uv$config = {
    prefix: base + "service/",
    bare: [
      "https://wes-prox.ksimmisk497.workers.dev/",
      "https://tomp.app/"
    ],
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: base + "uv/uv.handler.js",
    client: base + "uv/uv.client.js",
    bundle: base + "uv/uv.bundle.js",
    config: base + "uv/uv.config.js",
    sw: base + "uv/uv.sw.js",
    base: base
  };
})();
