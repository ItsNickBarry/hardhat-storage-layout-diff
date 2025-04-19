import {
  collateStorageLayout,
  getCollatedStorageLayout,
  mergeCollatedSlots,
  printMergedCollatedSlots,
} from '../lib/storage_layout_diff.js';
import { NewTaskActionFunction } from 'hardhat/types/tasks';
import fs from 'node:fs';

interface StorageLayoutCheckTaskActionArguments {
  source: string;
  b: string;
  bRef: string;
}

const action: NewTaskActionFunction<
  StorageLayoutCheckTaskActionArguments
> = async (args, hre) => {
  const slotsA = collateStorageLayout(
    JSON.parse(fs.readFileSync(args.source, 'utf-8')),
  );
  const slotsB = await getCollatedStorageLayout(hre, args.b, args.bRef);
  const data = mergeCollatedSlots(slotsA, slotsB);

  printMergedCollatedSlots(data);
};
