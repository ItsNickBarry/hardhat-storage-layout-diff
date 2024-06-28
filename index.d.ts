import 'hardhat/types/config';

declare module 'hardhat/types/config' {
  interface HardhatUserConfig {
    storageLayoutDiff?: {
      path?: string;
      only?: string[];
      except?: string[];
      spacing?: number;
    };
  }

  interface HardhatConfig {
    storageLayoutDiff: {
      path: string;
      only: string[];
      except: string[];
      spacing: number;
    };
  }
}
