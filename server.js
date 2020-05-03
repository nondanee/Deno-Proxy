import { serve } from "https://deno.land/std/http/server.ts";
import { encoder } from "https://deno.land/std/encoding/utf8.ts";

const readBody = async (req) => {
  const { contentLength } = req;
  const buffer = new Uint8Array(contentLength);
  let bufferSlice = buffer;
  let total = 0;
  while (true) {
    const size = await req.body.read(bufferSlice);
    if (!size) break;
    total += size;
    if (total >= contentLength) break;
    bufferSlice = bufferSlice.subarray(read);
  }
  return buffer;
};

const mitm = async (req) => {
  const { url, method, headers } = req;
  if (!url.startsWith("http://")) {
    return req.respond({ status: 400, body: "invalid" });
  }
  headers.delete("proxy-connection");

  try {
    const res = await fetch(
      url,
      { method, headers, body: await readBody(req) },
    );
    await req.respond(res).catch(() => null);
  } catch (e) {
    await req.respond({ status: 502 });
  }
};

const tunnel = async (req) => {
  const url = new URL(`https://${req.url}`);
  const { hostname, port } = url;
  await req.w.write(
    encoder.encode(`${req.proto} 200 Connection established\r\n\r\n`),
  );
  await req.w.flush();

  let conn = null;
  try {
    conn = await Deno.connect(
      { hostname, port: parseInt(port || 443), transport: "tcp" },
    );
  } catch (e) {
    await req.finalize();
  }
  if (conn) {
    Deno.copy(req.conn, conn).catch(() => null);
    Deno.copy(conn, req.conn).catch(() => null);
  }
};

const options = { port: 8080, hostname: "0.0.0.0" };
const s = serve(options);
console.log(
  `HTTP proxy listening on http://${options.hostname}:${options.port}/`,
);

for await (const req of s) {
  (req.method === "CONNECT" ? tunnel : mitm)(req);
}
