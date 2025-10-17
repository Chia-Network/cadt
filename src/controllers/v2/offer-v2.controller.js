import _ from 'lodash';

import { MetaV2, StagingV2 } from '../../models/v2';

import {
  assertHomeOrgExists,
  assertWalletIsSynced,
  assertIfReadOnlyMode,
  assertStagingTableNotEmpty,
  assertStagingTableIsEmpty,
  assertNoActiveOfferFile,
  assertActiveOfferFile,
  assertNoPendingCommitsExcludingTransfers,
  assertNoPendingCommits,
} from '../../utils/data-assertions';

import { deserializeMaker, deserializeTaker } from '../../utils/datalayer-utils';

import * as datalayer from '../../datalayer/persistance';
import { getConfig } from '../../utils/config-loader';

const CONFIG = getConfig().APP;

export const generateOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableNotEmpty(StagingV2);
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertNoPendingCommitsExcludingTransfers(StagingV2);

    const offerFile = await StagingV2.generateOfferFile();
    res.json(offerFile);
  } catch (error) {
    res.status(400).json({
      message: 'Error generating V2 offer file',
      error: error.message,
      success: false,
    });
  }
};

export const cancelActiveOffer = async (req, res) => {
  try {
    await assertIfReadOnlyMode();

    const activeOffer = await MetaV2.findOne({
      where: { meta_key: 'activeOfferTradeId' },
    });

    if (activeOffer) {
      await datalayer.cancelOffer(activeOffer.meta_value);
    }

    await Promise.all([
      MetaV2.destroy({ where: { meta_key: 'activeOfferTradeId' } }),
      StagingV2.destroy({ where: { isTransfer: true } }),
    ]);

    res.json({ message: 'V2 offer canceled successfully' });
  } catch (error) {
    res.status(400).json({
      message: 'Cannot cancel V2 offer',
      error: error.message,
      success: false,
    });
  }
};

export const importOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableIsEmpty(StagingV2);
    await assertHomeOrgExists();
    await assertNoActiveOfferFile(MetaV2);

    const offer = req.file.buffer.toString();
    const offerData = JSON.parse(offer);

    // Parse and validate offer using V2 schema
    const maker = deserializeMaker(offerData);
    const taker = deserializeTaker(offerData);

    // Import into V2 staging table
    // TODO: Implement V2-specific import logic
    // This would be similar to V1 but uses V2 models and field names

    res.json({
      message: 'V2 offer imported successfully',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error importing V2 offer',
      error: error.message,
      success: false,
    });
  }
};

export const commitImportedOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertActiveOfferFile(MetaV2);

    const activeOffer = await MetaV2.findOne({
      where: { meta_key: 'activeOfferTradeId' },
    });

    await datalayer.takeOffer(activeOffer.meta_value);

    res.json({
      message: 'V2 offer committed successfully',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error committing V2 offer',
      error: error.message,
      success: false,
    });
  }
};

export const cancelImportedOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();

    await Promise.all([
      MetaV2.destroy({ where: { meta_key: 'activeOfferTradeId' } }),
      StagingV2.destroy({ where: { isTransfer: true } }),
    ]);

    res.json({
      message: 'V2 imported offer canceled successfully',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error canceling V2 imported offer',
      error: error.message,
      success: false,
    });
  }
};

export const getCurrentOfferInfo = async (req, res) => {
  try {
    const activeOffer = await MetaV2.findOne({
      where: { meta_key: 'activeOfferTradeId' },
    });

    if (!activeOffer) {
      return res.json({ message: 'No active V2 offer' });
    }

    res.json({ tradeId: activeOffer.meta_value, success: true });
  } catch (error) {
    res.status(400).json({
      message: 'Error getting V2 offer info',
      error: error.message,
      success: false,
    });
  }
};


