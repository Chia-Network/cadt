import { Label, Organization } from '../models/index.js';

import { assertHomeOrgExists } from '../utils/data-assertions.js';

export const findAll = async (req, res) => {
  try {
    await assertHomeOrgExists();
    const homeOrg = await Organization.getHomeOrg();

    return res.json(
      await Label.findAll({
        where: { orgUid: homeOrg.orgUid },
      }),
    );
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive labels',
      error: error.message,
      success: false,
    });
  }
};
