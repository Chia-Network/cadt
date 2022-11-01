export const encodeHex = (str) => {
  return Buffer.from(str).toString('hex');
};

export const decodeHex = (str = '') => {
  return Buffer.from(str.replace('0x', ''), 'hex').toString('utf8');
};

export const decodeDataLayerResponse = (data) => {
  return data.keys_values.map((item) => ({
    key: decodeHex(item.key),
    value: decodeHex(item.value),
  }));
};

export const keyValueToChangeList = (key, value, includeDelete) => {
  const changeList = [];

  if (includeDelete) {
    changeList.push({
      action: 'delete',
      key: encodeHex(key),
    });
  }

  changeList.push({
    action: 'insert',
    key: encodeHex(key),
    value: encodeHex(value),
  });

  return changeList;
};

export const generateOffer = (maker, taker) => {
  return {
    maker: [
      {
        store_id: maker.storeId,
        inclusions: maker.inclusions,
      },
    ],
    taker: [
      {
        store_id: taker.storeId,
        inclusions: taker.inclusions,
      },
    ],
    fee: 0,
  };
};

export const deserializeTaker = (taker) => {
  const changes = taker[0].inclusions.map((inclusion) => {
    const tableKey = decodeHex(inclusion.key);
    const table = tableKey.split('|')[0];
    const value = JSON.parse(decodeHex(inclusion.value));
    return { table, value };
  });

  return changes;
};

export const deserializeMaker = (maker) => {
  const changes = maker[0].proofs.map((inclusion) => {
    const tableKey = decodeHex(inclusion.key);
    const table = tableKey.split('|')[0];
    const value = JSON.parse(decodeHex(inclusion.value));
    return { table, value };
  });

  return changes;
};
