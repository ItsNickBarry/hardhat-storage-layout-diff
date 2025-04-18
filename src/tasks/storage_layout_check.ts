import {
  parseStorageLayout,
  loadStorageLayout,
  mergeStorageLayouts,
} from '../lib/storage_layout_diff';
import { TASK_STORAGE_LAYOUT_CHECK } from '../task_names';
import ejs from 'ejs';
import { task } from 'hardhat/config';
import fs from 'node:fs';
import path from 'node:path';

task(TASK_STORAGE_LAYOUT_CHECK)
  .addParam('source', 'Path to storage layout JSON')
  .addParam('b', 'Contract to check against storage layout')
  .addOptionalParam('bRef', 'Git reference where contract B is defined')
  .setAction(async function ({ source, b, bRef }, hre) {
    const layout = parseStorageLayout(
      JSON.parse(fs.readFileSync(source, 'utf-8')),
    );
    const storageB = await loadStorageLayout(hre, b, bRef);
    const data = mergeStorageLayouts(layout, storageB);

    const contents = await ejs.renderFile(
      path.resolve(__dirname, 'template.html.ejs'),
      { data, titleA: source, titleB: b },
    );

    await fs.promises.writeFile('./out.html', contents);
  });
