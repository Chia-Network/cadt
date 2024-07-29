import _ from 'lodash';

import { Meta, Staging } from '../models/index.js';

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
} from '../utils/data-assertions.js';

import {
  deserializeMaker,
  deserializeTaker,
} from '../utils/datalayer-utils.js';

import * as datalayer from '../datalayer/persistance.js';
import { getConfig } from '../utils/config-loader.js';

const CONFIG = getConfig().APP;

export const generateOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertNoPendingCommitsExcludingTransfers();

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
    await assertNoPendingCommitsExcludingTransfers();

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
    offerParsed.fee = _.get(CONFIG, 'DEFAULT_FEE', 300000000);
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
    await assertNoPendingCommitsExcludingTransfers();

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
    await assertActiveOfferFile();

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
