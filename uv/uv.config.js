/*global Ultraviolet*/
self.__uv$config = {
  prefix: "/service/",
  bare: "https://wes-prox.ksimmisk497.workers.dev/",
  // Used by Dizzy's uv.js pickBestBare()
  bareServers: [
    "https://wes-prox.ksimmisk497.workers.dev/",
    "https://uv.holyubofficial.net/",
    "https://bare.operand.org/",
    "https://bareserver.r58playz.dev/"
  ],
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/uv.handler.js",
  client: "/uv/uv.client.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/uv.sw.js"
};
