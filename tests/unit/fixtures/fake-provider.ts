// Written with the help of Claude
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ReceivedRequest {
  method: string | undefined;
  path: string | undefined;
  authorization: string | undefined;
  body: unknown;
}

/**
 * A local HTTP server standing in for an external provider: it answers every request with `reply`
 * and records what it received, so an adapter can be tested with real HTTP.
 */
export async function startFakeProvider(reply: () => { status?: number; body: unknown }) {
  const received: ReceivedRequest[] = [];
  const server: Server = createServer((req, res) => {
    void readJson(req).then((body) => {
      received.push({ method: req.method, path: req.url, authorization: req.headers.authorization, body });
      const { status = 200, body: replyBody } = reply();
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(replyBody));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://localhost:${port}`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of req) {
    text += String(chunk);
  }
  return text ? JSON.parse(text) : undefined;
}
