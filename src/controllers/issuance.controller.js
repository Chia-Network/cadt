import { Issuance, Organization } from '../models';

import { assertHomeOrgExists } from '../utils/data-assertions';

export const findAll = async (req, res) => {
  try {
    await assertHomeOrgExists();
    const homeOrg = await Organization.getHomeOrg();

    return res.json(
      await Issuance.findAll({
        where: { orgUid: Object.keys(homeOrg)[0] },
      }),
    );
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive issuances',
      error: error.message,
    });
  }
};
