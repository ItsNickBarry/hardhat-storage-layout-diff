import pkg from '../package.json';
import './tasks/diff_storage_layout';
import './tasks/export_storage_layout';
import './tasks/inspect_storage_layout';
import './tasks/storage_layout_check';
import './type_extensions';
import type { StorageLayoutDiffConfig } from './types.js';
import { extendConfig } from 'hardhat/config';
import type { HardhatPlugin } from 'hardhat/types/plugins';

// TODO: types may be incomplete

const DEFAULT_CONFIG: StorageLayoutDiffConfig = {
  path: './storage_layout',
  clear: false,
  flat: false,
  only: [],
  except: [],
  spacing: 2,
};

extendConfig(function (config, userConfig) {
  config.storageLayoutDiff = Object.assign(
    {},
    DEFAULT_CONFIG,
    userConfig.storageLayoutDiff,
  );

  for (const compiler of config.solidity.compilers) {
    const outputSelection = compiler.settings.outputSelection['*']['*'];

    if (!outputSelection.includes('storageLayout')) {
      outputSelection.push('storageLayout');
    }
  }
});

const plugin: HardhatPlugin = {
  id: pkg.name,
  npmPackage: pkg.name,
};

export default plugin;
