import pkg from '../../package.json';
import { getRawStorageLayout } from '../lib/storage_layout_diff.js';
import { TASK_EXPORT_STORAGE_LAYOUT } from '../task_names.js';
import { task } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import fs from 'node:fs';
import path from 'node:path';

export default task(TASK_EXPORT_STORAGE_LAYOUT)
  .setAction(async (args, hre) => {
    const config = hre.config.storageLayoutDiff;

    const outputDirectory = path.resolve(hre.config.paths.root, config.path);

    if (!outputDirectory.startsWith(hre.config.paths.root)) {
      throw new HardhatPluginError(
        pkg.name,
        'resolved path must be inside of project directory',
      );
    }

    if (outputDirectory === hre.config.paths.root) {
      throw new HardhatPluginError(
        pkg.name,
        'resolved path must not be root directory',
      );
    }

    if (config.clear && fs.existsSync(outputDirectory)) {
      fs.rmdirSync(outputDirectory, { recursive: true });
    }

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    for (let fullName of await hre.artifacts.getAllFullyQualifiedNames()) {
      if (config.only.length && !config.only.some((m) => fullName.match(m)))
        continue;
      if (config.except.length && config.except.some((m) => fullName.match(m)))
        continue;

      const storageLayout = await getRawStorageLayout(hre, fullName);
      const { storage, types } = storageLayout;

      if (!storage.length) continue;

      const destination =
        path.resolve(outputDirectory, config.flat ? '' : '', fullName) +
        '.json';

      if (!fs.existsSync(path.dirname(destination))) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
      }

      fs.writeFileSync(
        destination,
        `${JSON.stringify({ storage, types }, null, config.spacing)}\n`,
      );
    }
  })
  .build();
