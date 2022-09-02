import { Meta, Staging } from '../models';

import {
  assertHomeOrgExists,
  assertNoPendingCommits,
  assertWalletIsSynced,
  assertIfReadOnlyMode,
  assertStagingTableNotEmpty,
} from '../utils/data-assertions';

import datalayer from '../datalayer/persistance';

export const generateOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertNoPendingCommits();

    const offerFile = await Staging.generateOfferFile();
    res.json(offerFile);
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error generating offer file.',
      error: error.message,
    });
  }
};

export const cancelActiveOffer = async (req, res) => {
  try {
    const activeOffer = await Meta.findOne({
      where: { metaKey: 'activeOfferTradeId' },
    });

    if (!activeOffer) {
      throw new Error(`There is no active offer to cancel`);
    }

    await datalayer.cancelActiveOffer(activeOffer.metaValue);
    await Meta.destroy({ where: { metaKey: 'activeOfferTradeId' } });

    res.json({
      message: 'Active offer has been canceled.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Can not cancel active offer',
      error: error.message,
    });
  }
};
