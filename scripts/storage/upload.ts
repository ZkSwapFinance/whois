import { S3Client } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import PQueue from 'p-queue';
import path from 'path';
import { parsePath, readData, uploadData } from 'scripts/utils';
import { DATA_BASE_PATH } from 'scripts/utils/constants';
import { AddressType } from 'scripts/utils/types';
import walkdir from 'walkdir';

config();

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: false,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET,
  },
});

const pQueue = new PQueue({ concurrency: 10_000 });

export const uploadGeneratedData = async (addressType: AddressType, ...additionalPath: string[]) => {
  const paths = await walkdir.async(path.join(DATA_BASE_PATH, 'generated', addressType, ...additionalPath));
  const dataPaths = paths.filter((path) => path.endsWith('.json'));

  await Promise.all(
    dataPaths.map(async (dataPath) =>
      pQueue.add(async () => {
        const { addressType, subdirectoryOrChainId, identifier } = parsePath(dataPath);
        const data = await readData('generated', addressType, subdirectoryOrChainId, identifier);
        await uploadData(
          s3Client,
          process.env.S3_BUCKET,
          'generated',
          addressType,
          subdirectoryOrChainId,
          identifier,
          data,
        );
      }),
    ),
  );

  console.log('Finished uploading', addressType);
};

if (process.argv.includes('tokens')) {
  console.log('Uploading tokens data...');
  uploadGeneratedData('tokens');
}

if (process.argv.includes('spenders')) {
  console.log('Uploading spenders data...');
  uploadGeneratedData('spenders');
}

if (process.argv.includes('scamsniffer')) {
  console.log('Uploading scamsniffer spenders data...');
  uploadGeneratedData('spenders', 'scamsniffer');
}
