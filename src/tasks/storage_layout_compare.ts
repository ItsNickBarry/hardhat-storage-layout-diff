import {
  loadStorageLayout,
  mergeStorageLayouts,
} from '../lib/storage_layout_diff';
import { TASK_STORAGE_LAYOUT_COMPARE } from '../task_names';
import ejs from 'ejs';
import { task } from 'hardhat/config';
import fs from 'node:fs';
import path from 'node:path';

task(TASK_STORAGE_LAYOUT_COMPARE)
  .addParam('a', 'First contract to diff')
  .addParam('b', 'Second contract to diff')
  .addOptionalParam('aRef', 'Git reference where contract A is defined')
  .addOptionalParam('bRef', 'Git reference where contract B is defined')
  .setAction(async function ({ a, b, aRef, bRef }, hre) {
    const storageA = await loadStorageLayout(hre, a, aRef);
    const storageB = await loadStorageLayout(hre, b, bRef);
    const data = mergeStorageLayouts(storageA, storageB);

    const contents = await ejs.renderFile(
      path.resolve(__dirname, 'template.html.ejs'),
      { data, titleA: a, titleB: b },
    );

    await fs.promises.writeFile('./out.html', contents);
  });
