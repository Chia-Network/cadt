import { Issuance, Organization } from '../models';
import { Sequelize } from 'sequelize';
import { assertHomeOrgExists } from '../utils/data-assertions';
import { _ } from 'sequelize-mock/src/utils';

export const findAll = async (req, res) => {
  try {
    await assertHomeOrgExists();
    const homeOrg = await Organization.getHomeOrg();

    let { issuanceIds } = req.query;

    let where = {};

    if (issuanceIds) {
      where = {
        id: {
          [Sequelize.Op.in]: _.flatten([issuanceIds]),
        },
      };
    } else {
      where = { orgUid: homeOrg.orgUid };
    }

    return res.json(await Issuance.findAll({ where }));
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Can not retreive issuances',
      error: error.message,
    });
  }
};
