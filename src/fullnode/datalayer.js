import fs from 'fs';
import path from 'path';
import request from 'request';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const certFile = path.resolve(
  `${process.env.CHIA_ROOT}/config/ssl/data_layer/private_data_layer.crt`,
);
const keyFile = path.resolve(
  `${process.env.CHIA_ROOT}/config/ssl/data_layer/private_data_layer.key`,
);

const rpcUrl = process.env.DATALAYER_URL;

const baseOptions = {
  method: 'POST',
  cert: fs.readFileSync(certFile),
  key: fs.readFileSync(keyFile),
};

export const pushChangeListToDatalayer = (changeList) => {
  return new Promise((resolve, reject) => {
    const options = {
      url: `${rpcUrl}/update_data_store`,
      body: JSON.stringify({
        changelist: changeList,
        id: 'c19cfd5a1f0a221976debcd1206daca0a07bf5e949949c2f30488562870a2fff',
      }),
    };

    console.log(changeList);

    request(
      Object.assign({}, baseOptions, options),
      function (error, response) {
        if (error) {
          console.log('!!!!!!');
          reject(error);
          return;
        }
        console.log(response.body);
        resolve(response);
      },
    );
  });
};
