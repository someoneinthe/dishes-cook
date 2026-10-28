// What a browser gives the web modules (`*.web.ts`), for their tests: Jest runs on Node. Each
// helper sets a global and returns what the test checks; `removeBrowser` takes them all back.

type FakeFile = Readonly<{ blob: Blob; name: string }>;

const GLOBAL_LIST = ['document', 'localStorage', 'location', 'navigator'] as const;

// Object URLs (URL.createObjectURL): "blob:1", "blob:2"… revoked ones listed.
export function fakeObjectUrls() {
  let count = 0;
  const revokedList: string[] = [];
  jest.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    count += 1;
    return `blob:${count}`;
  });
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revokedList.push(url);
  });
  return { revokedList };
}

// The site's private file system (navigator.storage.getDirectory): folders of files, in memory.
export function fakePrivateFiles() {
  const folderMap = new Map<string, Map<string, FakeFile>>();
  const folderHandle = (name: string) => {
    const fileMap = folderMap.get(name) ?? new Map<string, FakeFile>();
    folderMap.set(name, fileMap);
    return {
      getFileHandle: (fileName: string) =>
        Promise.resolve({
          createWritable: () => {
            const partList: Blob[] = [];
            return Promise.resolve({
              close: () => {
                fileMap.set(fileName, { blob: new Blob(partList), name: fileName });
                return Promise.resolve();
              },
              write: (blob: Blob) => {
                partList.push(blob);
                return Promise.resolve();
              },
            });
          },
          getFile: () => Promise.resolve(fileMap.get(fileName)?.blob ?? new Blob()),
        }),
      removeEntry: (fileName: string) =>
        fileMap.delete(fileName) ? Promise.resolve() : Promise.reject(new Error(`No ${fileName}`)),
      async *values() {
        for (const [fileName, file] of fileMap) {
          yield {
            getFile: () => Promise.resolve(file.blob),
            kind: 'file' as const,
            name: fileName,
          };
        }
        await Promise.resolve();
        yield { kind: 'directory' as const, name: 'a-folder' };
      },
    };
  };
  return {
    folderMap,
    storage: {
      getDirectory: () =>
        Promise.resolve({
          getDirectoryHandle: (name: string) => Promise.resolve(folderHandle(name)),
        }),
      persist: jest.fn(() => Promise.resolve(true)),
    },
  };
}

export function removeBrowser() {
  for (const name of GLOBAL_LIST) {
    Reflect.deleteProperty(globalThis, name);
  }
}

// The browser's globals for a test: those not given stay undefined.
export function setBrowser(globals: Partial<Record<(typeof GLOBAL_LIST)[number], unknown>>) {
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
}
