'use strict';

import crypto from 'crypto';
import { FilestoreV2 } from '../../models/v2/index.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
} from '../../utils/v2-data-assertions.js';
import { loggerV2 } from '../../config/logger.js';

/**
 * Subscribe to a file store for an organization
 * POST /v2/filestore/subscribe
 */
export const subscribeToFileStore = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();

    const { orgUid } = req.body;

    if (!orgUid) {
      return res.status(400).json({
        message: 'Cannot subscribe to file store',
        error: 'orgUid is required',
        success: false,
      });
    }

    await FilestoreV2.subscribeToFileStore(orgUid);

    res.status(200).json({
      message: `${orgUid} subscribed to file store.`,
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error subscribing to file store:', error);
    res.status(400).json({
      message: 'Can not subscribe to file store',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Unsubscribe from a file store for an organization
 * POST /v2/filestore/unsubscribe
 */
export const unsubscribeFromFileStore = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();

    const { orgUid } = req.body;

    if (!orgUid) {
      return res.status(400).json({
        message: 'Cannot unsubscribe from file store',
        error: 'orgUid is required',
        success: false,
      });
    }

    await FilestoreV2.unsubscribeFromFileStore(orgUid);

    res.status(200).json({
      message: `Unsubscribed file store from ${orgUid}`,
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error unsubscribing from file store:', error);
    res.status(400).json({
      message: 'Can not unsubscribe from file store',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Get list of all files in the file store
 * GET /v2/filestore/get_file_list
 */
export const getFileList = async (req, res) => {
  try {
    await assertV2HomeOrgExists();

    const files = await FilestoreV2.getFileStoreList();
    res.json(files);
  } catch (error) {
    loggerV2.error('[v2]: Error retrieving file list:', error);
    res.status(400).json({
      message: 'Cannot retrieve file list from filestore',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Delete a file from the file store
 * DELETE /v2/filestore/delete_file
 */
export const deleteFile = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();

    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({
        message: 'Cannot delete file from filestore',
        error: 'fileId is required',
        success: false,
      });
    }

    await FilestoreV2.deleteFileStoreItem(fileId);

    res.status(200).json({
      message:
        'File will be deleted from the filestore, but it will take a few mins to confirm.',
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error deleting file:', error);
    res.status(400).json({
      message: 'Can not delete file from filestore',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Get a file from the file store by fileId (SHA256)
 * GET /v2/filestore/get_file
 */
export const getFile = async (req, res) => {
  try {
    await assertV2HomeOrgExists();

    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({
        message: 'Cannot retrieve file from filestore',
        error: 'fileId is required',
        success: false,
      });
    }

    const file = await FilestoreV2.getFileStoreItem(fileId);

    // Convert base64 string to buffer and send as download
    // Note: file is already base64 string from model
    // V1 pattern: Buffer.from(file.toString('utf-8'), 'base64')
    // But file is already a string, so we decode directly
    const download = Buffer.from(file, 'base64');
    res.end(download);
  } catch (error) {
    loggerV2.error('[v2]: Error retrieving file:', error);

    // Check if it's a "not found" error
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        message: `FileId ${req.body.fileId || 'unknown'} not found in the filestore.`,
        success: false,
      });
    }

    res.status(400).json({
      message: 'Can not retrieve file from filestore',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Add a file to the file store
 * POST /v2/filestore/add_file
 */
export const addFile = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();

    if (!req.file) {
      return res.status(400).json({
        message: 'Cannot add file to file store',
        error: 'Missing file data. Cannot upload file without file data.',
        success: false,
      });
    }

    const { originalname: fileName, buffer } = req.file;

    if (!fileName) {
      return res.status(400).json({
        message: 'Cannot add file to file store',
        error: 'Missing file name. Cannot upload file without a file name.',
        success: false,
      });
    }

    // Convert buffer to base64
    const base64File = buffer.toString('base64');

    // Generate SHA256 hash of the base64 file content
    const SHA256 = crypto
      .createHash('sha256')
      .update(base64File)
      .digest('base64');

    await FilestoreV2.addFileToFileStore(SHA256, fileName, base64File);

    return res.json({
      message:
        'File is being added to the file store, please wait for it to confirm.',
      fileId: SHA256,
      success: true,
    });
  } catch (error) {
    loggerV2.error('[v2]: Error adding file to file store:', error);
    res.status(400).json({
      message: 'Can not add file to file store',
      error: error.message,
      success: false,
    });
  }
};

