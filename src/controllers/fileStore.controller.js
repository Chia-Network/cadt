import _ from 'lodash';

import crypto from 'crypto';
import { FileStore } from '../models';

/*export const getFileList = async (req, res) => {
  try {
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive audit data',
      error: error.message,
    });
  }
};*/

export const addFileToFileStore = async (req, res) => {
  try {
    if (_.get(req, 'files.file.data')) {
      const { fileName } = req.body;
      if (!fileName) {
        throw new Error('Missing file name, can not upload file');
      }
      const buffer = req.files.file.data;
      const base64File = buffer.toString('base64');
      const SHA256 = crypto.createHash('sha256', base64File).digest('base64');
      FileStore.addFileToFileStore(SHA256, fileName, base64File);
      return res.json({
        message:
          'File is being added to the file store, please wait for it to confirm.',
      });
    } else {
      throw new Error('Missing file data, can not upload file.');
    }
  } catch (error) {
    res.status(400).json({
      message: 'Can not add file to file store',
      error: error.message,
    });
  }
};
