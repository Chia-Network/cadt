// const { exec } = require('child_process');

// before(function () {
//   console.log('SETTING UP TEST;');
//   return new Promise((resolve, reject) => {
//     const migrate = exec('npm run resetdb', { env: process.env }, (err) =>
//       err ? reject(err) : setTimeout(resolve, 5000),
//     );

//     // Forward stdout+stderr to this process
//     migrate.stdout.pipe(process.stdout);
//     migrate.stderr.pipe(process.stderr);
//   });

//   // exec('npm run resetdb');
//   // setTimeout(() => {
//   //   done();
//   // }, 9000);
// });

import 'regenerator-runtime/runtime.js';
