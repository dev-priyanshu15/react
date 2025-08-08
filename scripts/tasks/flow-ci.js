/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

process.on('unhandledRejection', err => {
  throw err;
});

const runFlow = require('../flow/runFlow');
const inlinedHostConfigs = require('../shared/inlinedHostConfigs');

async function check(shortName) {
  if (shortName == null) {
    throw new Error('Expected an inlinedHostConfig shortName');
  }
  const rendererInfo = inlinedHostConfigs.find(
    config => config.shortName === shortName
  );
  if (rendererInfo == null) {
    throw new Error(`Could not find inlinedHostConfig for ${shortName}`);
  }
  if (rendererInfo.isFlowTyped) {
    await runFlow(rendererInfo.shortName, ['check']);
  }
}

// If a shortName is provided, check only that; otherwise, run checks for all
// Flow-typed inlined host configs. This behavior is suitable for CI.
(async () => {
  const maybeShortName = process.argv[2];
  if (maybeShortName) {
    await check(maybeShortName);
  } else {
    for (const cfg of inlinedHostConfigs) {
      if (cfg.isFlowTyped) {
        await check(cfg.shortName);
      }
    }
  }
})();
