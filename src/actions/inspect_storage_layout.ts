import {
  getCollatedStorageLayout,
  printCollatedSlots,
} from '../lib/storage_layout_diff.js';
import { NewTaskActionFunction } from 'hardhat/types/tasks';

interface InspectStorageLayoutTaskActionArguments {
  contract: string;
}

const action: NewTaskActionFunction<
  InspectStorageLayoutTaskActionArguments
> = async (args, hre) => {
  // TODO: import task name constant
  await hre.tasks.getTask('compile').run();

  const slots = await getCollatedStorageLayout(hre, args.contract);

  printCollatedSlots(slots);
};

export default action;
