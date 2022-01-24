export const changeListFactory = (action, id, record) => {
  console.log({ action, id, record });
  switch (action) {
    case 'INSERT':
      return {
        action: 'insert',
        key: Buffer.from(id).toString('hex'),
        value: Buffer.from(JSON.stringify(record)).toString('hex'),
      };
    case 'UPDATE':
      return [
        {
          action: 'delete',
          key: Buffer.from(id).toString('hex'),
        },
        {
          action: 'insert',
          key: Buffer.from(id).toString('hex'),
          value: Buffer.from(JSON.stringify(record)).toString('hex'),
        },
      ];
    case 'DELETE':
      return {
        action: 'delete',
        key: Buffer.from(id).toString('hex'),
      };
  }
};
