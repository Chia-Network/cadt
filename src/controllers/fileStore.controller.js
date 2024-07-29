import crypto from 'crypto';
import { FileStore } from '../models/index.js';

export const subscribeToFileStore = (req, res) => {
  try {
    const { orgUid } = req.body;

    FileStore.subscribeToFileStore(orgUid);

    res.status(200).json({
      message: `${orgUid} subscribed to file store.`,
    });
  } catch (error) {
    res.status(400).json({
      message: `Can not subscribe to file store.`,
      error: error.message,
      success: false,
    });
  }
};

export const unsubscribeFromFileStore = (req, res) => {
  try {
    const { orgUid } = req.body;

    FileStore.unsubscribeFromFileStore(orgUid);

    res.status(200).json({
      message: `Can not unsubscribe the fileStore from ${orgUid}`,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Can not retrieve file list from filestore',
      error: error.message,
      success: false,
    });
  }
};

export const getFileList = async (req, res) => {
  try {
    const files = await FileStore.getFileStoreList();
    res.json(files);
  } catch (error) {
    res.status(400).json({
      message: 'Can not retrieve file list from filestore',
      error: error.message,
      success: false,
    });
  }
};

export const deleteFile = async (req, res) => {
  try {
    await FileStore.deleteFileStoreItem(req.body.fileId);
    res.status(200).json({
      message:
        'File will be deleted from the filestore, but it will take a few mins to confirm.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Can not delete file from filestore',
      error: error.message,
      success: false,
    });
  }
};

export const getFile = async (req, res) => {
  try {
    const { fileId } = req.body;
    const file = await FileStore.getFileStoreItem(fileId);
    if (file) {
      const download = Buffer.from(file.toString('utf-8'), 'base64');
      res.end(download);
    } else {
      res.status(400).json({
        message: `FileId ${fileId} not found in the filestore.`,
        success: false,
      });
    }
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive file list from filestore',
      error: error.message,
      success: false,
    });
  }
};

export const addFileToFileStore = async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('Missing file data, can not upload file.');
    }

    const { originalname: fileName, buffer } = req.file;

    if (!fileName) {
      throw new Error('Missing file name, can not upload file');
    }

    const base64File = buffer.toString('base64');
    const SHA256 = crypto
      .createHash('sha256')
      .update(base64File)
      .digest('base64');

    await FileStore.addFileToFileStore(SHA256, fileName, base64File);

    return res.json({
      message:
        'File is being added to the file store, please wait for it to confirm.',
      fileId: SHA256,
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Can not add file to file store',
      error: error.message,
      success: false,
    });
  }
};
