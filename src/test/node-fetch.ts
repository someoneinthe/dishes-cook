import { request } from 'node:http';

// `fetch` over node:http, for tests against a real server (sync-engine.pocketbase.test.ts): the
// React Native Jest preset replaces the global fetch with a mock. Plain HTTP only, string bodies.
export const nodeFetch = ((input: RequestInfo | URL, init: RequestInit = {}) =>
  new Promise<Response>((resolve, reject) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const outgoing = request(
      url,
      {
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        method: init.method ?? 'GET',
        signal: init.signal ?? undefined,
      },
      (incoming) => {
        const chunkList: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => {
          chunkList.push(chunk);
        });
        incoming.on('error', reject);
        incoming.on('end', () => {
          const status = incoming.statusCode ?? 0;
          resolve(
            new Response(status === 204 ? null : Buffer.concat(chunkList).toString('utf8'), {
              headers: incoming.headers as Record<string, string>,
              status,
            }),
          );
        });
      },
    );
    outgoing.on('error', reject);
    outgoing.end(typeof init.body === 'string' ? init.body : undefined);
  })) as typeof fetch;
