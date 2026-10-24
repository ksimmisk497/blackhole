/*global Ultraviolet*/
self.__uv$config = {
  prefix: "/service/",
  // Multiple bare servers — UV 1.x picks one at random; uv.js also probes & prefers fastest
  bare: [
    "https://wes-prox.ksimmisk497.workers.dev/",
    "https://tomp.app/",
    "https://bare.benrogo.net/",
    "https://bare-1.cobalt.tools/"
  ],
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/uv.handler.js",
  client: "/uv/uv.client.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/uv.sw.js"
};
