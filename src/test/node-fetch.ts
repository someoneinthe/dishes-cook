import { request } from 'node:http';

// `fetch` over node:http, for tests against a real server (sync-engine.pocketbase.test.ts): the
// React Native Jest preset replaces the global fetch with a mock. Plain HTTP only. Bodies: strings,
// and forms (a photo upload), sent multipart; responses as bytes (a downloaded photo).
export const nodeFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const { body, contentType } = await encodeBody(init.body);
  return new Promise<Response>((resolve, reject) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const outgoing = request(
      url,
      {
        headers: contentType === undefined ? headers : { ...headers, 'content-type': contentType },
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
            new Response(status === 204 ? null : Buffer.concat(chunkList), {
              // Name/value pairs as received (a repeated header stays repeated).
              headers: pairsOf(incoming.rawHeaders),
              status,
            }),
          );
        });
      },
    );
    outgoing.on('error', reject);
    outgoing.end(body);
  });
}) as typeof fetch;

// The bytes to send, and the content type of a form (multipart, with its boundary).
async function encodeBody(
  body: RequestInit['body'],
): Promise<Readonly<{ body?: Buffer | string; contentType?: string }>> {
  if (typeof body === 'string') {
    return { body };
  }
  if (!(body instanceof FormData)) {
    return {};
  }
  const encoded = new Response(body);
  return {
    body: Buffer.from(await encoded.arrayBuffer()),
    contentType: encoded.headers.get('content-type') ?? undefined,
  };
}

// ['Name', 'value', 'Name', 'value', …] -> [['Name', 'value'], …]
function pairsOf(rawHeaderList: string[]): [string, string][] {
  const pairList: [string, string][] = [];
  for (let index = 0; index + 1 < rawHeaderList.length; index += 2) {
    pairList.push([rawHeaderList[index] ?? '', rawHeaderList[index + 1] ?? '']);
  }
  return pairList;
}
