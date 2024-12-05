import { Meta, Staging } from '../models';

import {
  assertHomeOrgExists,
  assertNoPendingCommits,
  assertWalletIsSynced,
  assertIfReadOnlyMode,
  assertStagingTableNotEmpty,
  assertStagingTableIsEmpty,
  assertNoActiveOfferFile,
  assertActiveOfferFile,
} from '../utils/data-assertions';

import { deserializeMaker, deserializeTaker } from '../utils/datalayer-utils';

import * as datalayer from '../datalayer/persistance';
import { CONFIG } from '../user-config';

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
      success: false,
    });
  }
};

export const cancelActiveOffer = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertNoPendingCommits();

    const activeOffer = await Meta.findOne({
      where: { metaKey: 'activeOfferTradeId' },
    });

    if (activeOffer) {
      await datalayer.cancelOffer(activeOffer.metaValue);
    }

    await Promise.all([
      Meta.destroy({ where: { metaKey: 'activeOfferTradeId' } }),
      Staging.destroy({ where: { isTransfer: true } }),
    ]);

    res.status(200).json({
      message: 'Active offer has been canceled.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Can not cancel active offer',
      error: error.message,
      success: false,
    });
  }
};

export const importOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableIsEmpty();
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertNoPendingCommits();
    await assertNoActiveOfferFile();

    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const offerFileBuffer = req.file.buffer;
    const offerFile = offerFileBuffer.toString('utf-8');
    const offerParsed = JSON.parse(offerFile);
    offerParsed.fee = CONFIG().CHIA?.DEFAULT_FEE || 300000000;
    delete offerParsed.success;
    const offerJSON = JSON.stringify(offerParsed);

    await datalayer.verifyOffer(offerJSON);

    await Meta.upsert({
      metaKey: 'activeOffer',
      metaValue: offerJSON,
    });

    res.json({
      message: 'Offer has been imported for review.',
      success: true,
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Can not import offer file.',
      error: error.message,
      success: false,
    });
  }
};

export const commitImportedOfferFile = async (req, res) => {
  try {
    await assertActiveOfferFile();
    await assertIfReadOnlyMode();
    await assertStagingTableIsEmpty();
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertNoPendingCommits();

    const offerFile = await Meta.findOne({
      where: { metaKey: 'activeOffer' },
      raw: true,
    });

    const response = await datalayer.takeOffer(JSON.parse(offerFile.metaValue));

    res.json({
      message: 'Offer Accepted.',
      tradeId: response.trade_id,
      success: true,
    });

    await Meta.destroy({
      where: {
        metaKey: 'activeOffer',
      },
    });
  } catch (error) {
    res.status(400).json({
      message: 'Can not commit offer.',
      error: error.message,
      success: false,
    });
  }
};

export const cancelImportedOfferFile = async (req, res) => {
  try {
    await assertActiveOfferFile();

    await Meta.destroy({
      where: {
        metaKey: 'activeOffer',
      },
    });
  } catch (error) {
    res.status(400).json({
      message: 'Can not cancel offer.',
      error: error.message,
      success: false,
    });
  }
};

export const getCurrentOfferInfo = async (req, res) => {
  try {
    try {
      await assertActiveOfferFile();
    } catch {
      res.status(200).json({
        message: 'No offer to accept',
        success: true,
      });
      return;
    }

    const offerFileJson = await Meta.findOne({
      where: { metaKey: 'activeOffer' },
      raw: true,
    });

    const offerFile = JSON.parse(offerFileJson.metaValue);

    // Out of time so just hard coding this
    const projectChildRecords = [
      'issuances',
      'projectLocations',
      'estimations',
      'labels',
      'projectRatings',
      'coBenefits',
      'relatedProjects',
    ];

    const makerChanges = deserializeMaker(offerFile.offer.maker);
    const takerChanges = deserializeTaker(offerFile.offer.taker);

    console.log(makerChanges);

    let maker = makerChanges.filter((record) => record.table === 'project');

    makerChanges.forEach((record) => {
      if (projectChildRecords.includes(record.table)) {
        if (!maker[0].value[record.table]) {
          maker[0].value[record.table] = [];
        }

        maker[0].value[record.table].push(record.value);
      }
    });

    maker = maker.concat(
      makerChanges.filter((record) => record.table === 'unit'),
    );

    let taker = takerChanges.filter((record) => record.table === 'project');

    takerChanges.forEach((record) => {
      if (projectChildRecords.includes(record.table)) {
        if (!taker[0].value[record.table]) {
          taker[0].value[record.table] = [];
        }

        taker[0].value[record.table].push(record.value);
      }
    });

    taker = taker.concat(
      takerChanges.filter((record) => record.table === 'unit'),
    );

    res.status(200).json({
      changes: {
        maker,
        taker,
      },
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Can not get offer.',
      error: error.message,
      success: false,
    });
  }
};
