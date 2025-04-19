import {
  getCollatedStorageLayout,
  mergeCollatedSlots,
  printMergedCollatedSlots,
} from '../lib/storage_layout_diff.js';
import { NewTaskActionFunction } from 'hardhat/types/tasks';

interface DiffStorageLayoutTaskActionArguments {
  a: string;
  b: string;
  aRef: string;
  bRef: string;
}

const action: NewTaskActionFunction<
  DiffStorageLayoutTaskActionArguments
> = async (args, hre) => {
  // TODO: import task name constant
  await hre.tasks.getTask('compile').run();

  // TODO: check default values of ref parameters
  const slotsA = await getCollatedStorageLayout(hre, args.a, args.aRef);
  const slotsB = await getCollatedStorageLayout(hre, args.b, args.bRef);

  const slots = mergeCollatedSlots(slotsA, slotsB);

  printMergedCollatedSlots(slots);
};

export default action;
