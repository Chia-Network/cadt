'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { pushDataLayerChangeList } from '../../fullnode';
import { Project, Unit, Organization } from '../../models';

import rxjs from 'rxjs';
import { sequelize } from '../database';

import ModelTypes from './staging.modeltypes.cjs';

class Staging extends Model {
  static changes = new rxjs.Subject();

  static async create(values, options) {
    Staging.changes.next(['staging']);
    return super.create(values, options);
  }

  static async destroy(values) {
    Staging.changes.next(['staging']);
    return super.destroy(values);
  }

  static async pushToDataLayer() {
    const coBenefitsChangeList = [];
    const projectLocationChangeList = [];
    const projectsChangeList = [];
    const projectRatingChangeList = [];
    const relatedProjectsChangeList = [];
    const qualificationsChangeList = [];
    const unitsChangeList = [];
    const vintagesChangeList = [];

    const stagedChangeList = await Staging.findAll();

    await Promise.all(
      stagedChangeList.map(async (stagingRecord) => {
        const {
          // eslint-disable-next-line
          id: stagingRecordId,
          uuid,
          table,
          action,
          commited,
          data: rawData,
        } = stagingRecord;
        let dataSet = JSON.parse(rawData);

        await Promise.all(
          dataSet.map(async (data) => {
            if (table === 'Projects' && !commited) {
              const [
                thisProjectChangeList,
                thisProjectLocationChangeList,
                thisQualificationsChangeList,
                thisProjectRatingChangeList,
                thisCoBenefitsChangeList,
                thisVintagesChangeList,
                thisRelatedProjectsChangeList,
              ] = await Project.generateFullProjectModelChangeListFromStagedRecord(
                action,
                uuid,
                data,
              );

              if (thisProjectChangeList) {
                projectsChangeList.push(thisProjectChangeList);
              }

              if (thisProjectLocationChangeList) {
                projectLocationChangeList.push(thisProjectLocationChangeList);
              }

              if (thisQualificationsChangeList) {
                qualificationsChangeList.push(thisQualificationsChangeList);
              }

              if (thisProjectRatingChangeList) {
                projectRatingChangeList.push(thisProjectRatingChangeList);
              }

              if (thisCoBenefitsChangeList) {
                coBenefitsChangeList.push(thisCoBenefitsChangeList);
              }

              if (thisVintagesChangeList) {
                vintagesChangeList.push(thisVintagesChangeList);
              }

              if (thisRelatedProjectsChangeList) {
                relatedProjectsChangeList.push(thisRelatedProjectsChangeList);
              }
            } else if (table === 'Units' && !commited) {
              const [
                thisUnitsChangeList,
                thisVintagesChangeList,
                thisQualificationsChangeList,
              ] = await Unit.generateUnitModelChangeListFromStagedRecord(
                action,
                uuid,
                data,
              );

              if (thisUnitsChangeList) {
                unitsChangeList.push(thisUnitsChangeList);
              }

              if (thisVintagesChangeList) {
                vintagesChangeList.push(thisVintagesChangeList);
              }

              if (thisQualificationsChangeList) {
                qualificationsChangeList.push(thisQualificationsChangeList);
              }
            }
          }),
        );
      }),
    );

    const {
      projectLocationStoreId,
      projectRatingStoreId,
      coBenefitsStoreId,
      projectsStoreId,
      relatedProjectsStoreId,
      vintagesStoreId,
      qualificationsStoreId,
      //  qualificationUnitJunctionStoreId,
      unitsStoreId,
    } = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    await Promise.all([
      coBenefitsChangeList.length &&
        pushDataLayerChangeList(coBenefitsStoreId, coBenefitsChangeList),
      projectLocationChangeList.length &&
        pushDataLayerChangeList(
          projectLocationStoreId,
          projectLocationChangeList,
        ),
      projectsChangeList.length &&
        pushDataLayerChangeList(projectsStoreId, projectsChangeList),
      projectRatingChangeList.length &&
        pushDataLayerChangeList(projectRatingStoreId, projectRatingChangeList),
      relatedProjectsChangeList.length &&
        pushDataLayerChangeList(
          relatedProjectsStoreId,
          relatedProjectsChangeList,
        ),
      qualificationsChangeList.length &&
        pushDataLayerChangeList(
          qualificationsStoreId,
          qualificationsChangeList,
        ),
      unitsChangeList.length &&
        pushDataLayerChangeList(unitsStoreId, unitsChangeList),
      vintagesChangeList.length &&
        pushDataLayerChangeList(vintagesStoreId, vintagesChangeList),
    ]);
  }
}

Staging.init(ModelTypes, {
  sequelize,
  modelName: 'staging',
  freezeTableName: true,
});

export { Staging };
