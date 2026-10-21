import type { Text } from '@infinitered/react-native-mlkit-text-recognition';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { File } from 'expo-file-system';
import { readDocument, toScannedBlocks } from './read-document';

// A line of the text recognition, with its words' boxes: "Tarte" tall, "aux" short.
const recognizedPage: Text = {
  blocks: [
    {
      frame: { bottom: 64, left: 0, right: 400, top: 0 },
      lines: [
        {
          elements: [
            {
              frame: { bottom: 50, left: 0, right: 100, top: 0 },
              recognizedLanguages: [],
              text: 'Tarte',
            },
            {
              frame: { bottom: 50, left: 110, right: 160, top: 20 },
              recognizedLanguages: [],
              text: 'aux',
            },
            {
              frame: { bottom: 64, left: 170, right: 300, top: 20 },
              recognizedLanguages: [],
              text: 'pommes',
            },
          ],
          frame: { bottom: 64, left: 0, right: 300, top: 0 },
          recognizedLanguages: [],
          text: 'Tarte aux pommes',
        },
      ],
      recognizedLanguages: [],
      text: 'Tarte aux pommes',
    },
  ],
  text: 'Tarte aux pommes',
};

describe('readDocument', () => {
  it('measures a photo’s letters by its words, a level page’s by its lines', () => {
    expect(toScannedBlocks(recognizedPage)[0]?.lineList[0]?.height).toBe(44);
    expect(toScannedBlocks(recognizedPage, true)[0]?.lineList[0]?.height).toBe(64);
  });

  it('reads a photo with the text recognition: a photo may be slanted', async () => {
    jest.mocked(recognizeText).mockResolvedValueOnce(recognizedPage);

    await expect(readDocument('file:///photo.jpg', 'image')).resolves.toMatchObject({
      isCut: false,
      isLevel: false,
    });
    expect(recognizeText).toHaveBeenLastCalledWith('file:///photo.jpg');
  });

  it('reads a text file as text: level, like the other documents', async () => {
    const fileImplementation = jest.mocked(File).getMockImplementation();
    jest.mocked(File).mockImplementationOnce(
      (...partList) =>
        ({
          ...fileImplementation?.(...partList),
          text: jest.fn(() => Promise.resolve('Mojito\n10 cl rum')),
        }) as unknown as File,
    );

    await expect(readDocument('file:///mojito.txt', 'text')).resolves.toMatchObject({
      blockList: [{ lineList: [{ text: 'Mojito' }] }, { lineList: [{ text: '10 cl rum' }] }],
      isLevel: true,
    });
  });
});
