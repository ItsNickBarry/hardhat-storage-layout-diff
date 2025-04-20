import type { StorageLayoutDiffConfig } from '../types.js';
import type { ConfigHooks } from 'hardhat/types/hooks';

const DEFAULT_CONFIG: StorageLayoutDiffConfig = {
  path: './storage_layout',
  clear: false,
  flat: false,
  only: [],
  except: [],
  spacing: 2,
};

export default async (): Promise<Partial<ConfigHooks>> => ({
  resolveUserConfig: async (userConfig, resolveConfigurationVariable, next) => {
    const result = {
      ...(await next(userConfig, resolveConfigurationVariable)),
      storageLayoutDiff: {
        ...DEFAULT_CONFIG,
        ...userConfig.storageLayoutDiff,
      },
    };

    for (const key in result.solidity.profiles) {
      const profile = result.solidity.profiles[key];

      for (const compiler of profile.compilers) {
        const settings = compiler.settings;
        settings.outputSelection ??= {};
        settings.outputSelection['*'] ??= {};
        settings.outputSelection['*']['*'] ??= [];

        if (!settings.outputSelection['*']['*'].includes('storageLayout')) {
          settings.outputSelection['*']['*'].push('storageLayout');
        }
      }
    }

    return result;
  },
});
