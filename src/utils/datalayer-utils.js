export const encodeHex = (str) => {
  return Buffer.from(str).toString('hex');
};

export const decodeHex = (str) => {
  return Buffer.from(str.replace('0x', ''), 'hex').toString();
};

export const decodeDataLayerResponse = (data) => {
  return data.keys_values.map((item) => ({
    key: decodeHex(item.key),
    value: decodeHex(item.value),
  }));
};
