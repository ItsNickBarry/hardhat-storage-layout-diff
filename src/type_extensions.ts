import type {
  StorageLayoutDiffConfig,
  StorageLayoutDiffUserConfig,
} from './types';
import 'hardhat/types/config';

declare module 'hardhat/types/config' {
  interface HardhatConfig {
    storageLayoutDiff: StorageLayoutDiffConfig;
  }

  interface HardhatUserConfig {
    storageLayoutDiff?: StorageLayoutDiffUserConfig;
  }
}
