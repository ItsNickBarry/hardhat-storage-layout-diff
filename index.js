const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const simpleGit = require('simple-git');

const {
  TASK_COMPILE,
} = require('hardhat/builtin-tasks/task-names');

task(TASK_COMPILE, async function (args, hre, runSuper) {
  for (let compiler of hre.config.solidity.compilers) {
    compiler.settings.outputSelection['*']['*'].push('storageLayout');
  }

  await runSuper();
});

task(
  'storage-layout-diff'
).addParam(
  'a', 'First contract to diff'
).addParam(
  'b', 'Second contract to diff'
).addOptionalParam(
  'aRef', 'Git reference where contract A is defined'
).addOptionalParam(
  'bRef', 'Git reference where contract B is defined'
).setAction(async function ({ a, b, aRef, bRef }, hre) {
  const repository = simpleGit();
  await repository.init();

  const { latest } = await repository.log();
  aRef = aRef || latest.hash;
  bRef = bRef || latest.hash;

  const parseStorageLayout = async function (contractName, ref) {
    await repository.checkout(ref);
    await hre.run(TASK_COMPILE);

    const info = await hre.artifacts.getBuildInfo(contractName);
    const [file, contract] = contractName.split(':');
    const { storage, types } = info.output.contracts[file][contract].storageLayout;

    await repository.checkout('-');

    return storage.reduce(function (acc, { label, offset, slot, type}) {
      const size = parseInt(types[type].numberOfBytes);
      const bytesStart = parseInt(slot) * 32 + parseInt(offset);
      const bytesEnd = bytesStart + size - 1;

      if (acc.length > 0 && bytesStart > acc[acc.length - 1].bytesEnd + 1) {
        acc.push({
          label: '',
          type: '',
          bytesStart: acc[acc.length - 1].bytesEnd + 1,
          bytesEnd: bytesStart - 1,
        });
      }

      acc.push({
        label,
        type: types[type].label,
        slot: parseInt(slot),
        offset,
        size,
        bytesStart,
        bytesEnd,
      });

      return acc;
    }, []);
  };

  const mergeStorageLayouts = function (storageA, storageB) {
    const equal = function (a, b) {
      return a.label == b.label && a.type?.replace(/\[\d*\]/, '[]') == b.type?.replace(/\[\d*\]/, '[]');
    };

    let bytesIndex = 0;
    let indexA = 0;
    let indexB = 0;

    // ensure even byte lengths

    const tail = {
      bytesEnd: Math.max(
        storageA[storageA.length - 1].bytesEnd,
        storageB[storageB.length - 1].bytesEnd
      )
    };

    storageA.push(tail);
    storageB.push(tail);

    const output = [];

    while (storageA[indexA] && storageB[indexB]) {
      const elementA = storageA[indexA];
      const elementB = storageB[indexB];

      const bytesEndA = elementA.bytesEnd;
      const bytesEndB = elementB.bytesEnd;

      const bytesStart = bytesIndex;
      const bytesEnd = Math.min(bytesEndA, bytesEndB);

      output.push({
        bytesStart,
        bytesEnd,
        elementA,
        elementB,
        changed: !equal(elementA, elementB),
      });

      if (bytesEndA >= bytesEndB) {
        indexB++;
      }

      if (bytesEndB >= bytesEndA) {
        indexA++;
      }

      bytesIndex = bytesEnd + 1;
    }

    return output;
  };

  const storageA = await parseStorageLayout(a, aRef);
  const storageB = await parseStorageLayout(b, bRef);
  const data = mergeStorageLayouts(storageA, storageB);

  ejs.renderFile(path.resolve(__dirname, 'template.html.ejs'), { data, titleA: a, titleB: b }, {}, function (err, result) {
    if (err) {
      console.log(err);
    } else {
      fs.writeFileSync('./out.html', result);
    }
  });
});
