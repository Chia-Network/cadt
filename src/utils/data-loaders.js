import request from 'request-promise';
import dotenv from 'dotenv';
dotenv.config();

let downloadedPickList = {};
export const getPicklistValues = () => downloadedPickList;

export const pullPickListValues = async () => {
  const options = {
    method: 'GET',
    url: process.env.PICKLIST_URL,
  };

  downloadedPickList = JSON.parse(await request(Object.assign({}, options)));
};

export const getDefaultOrganizationList = async () => {
  const options = {
    method: 'GET',
    url: process.env.DEFAULT_ORGANIZATIONS,
  };

  return JSON.parse(await request(Object.assign({}, options)));
};

export const serverAvailable = async (server, port) => {
  const options = {
    method: 'GET',
    url: `http://${server}:${port}`,
  };

  try {
    await request(Object.assign({}, options));
    return true;
  } catch (err) {
    if (JSON.stringify(err).includes('Python')) {
      console.log('SERVER IS AVAILABLE');
      return true;
    } else {
      return false;
    }
  }
};
