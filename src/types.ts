export interface StorageLayoutDiffConfig {
  path: string;
  clear: boolean;
  flat: boolean;
  only: string[];
  except: string[];
  spacing: number;
}

export type StorageLayoutDiffUserConfig = Partial<StorageLayoutDiffConfig>;
