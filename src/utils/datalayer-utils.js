export const encodeHex = (str) => {
  return Buffer.from(str).toString('hex');
};

export const decodeHex = (str) => {
  return Buffer.from(str.replace('0x', ''), 'hex').toString();
};
