import request from 'request-promise';
import dotenv from 'dotenv';
dotenv.config();

let downloadedValues = {};
export const getPicklistValues = () => downloadedValues;

export const pullPickListValues = async () => {
  const options = {
    method: 'GET',
    url: process.env.PICKLIST_URL,
  };

  downloadedValues = JSON.parse(await request(Object.assign({}, options)));

  //console.log(downloadedValues);
};
