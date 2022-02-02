import { Organization } from '../models/organizations';

import { assertHomeOrgExists } from '../utils/data-assertions';

export const findAll = async (req, res) => {
  return res.json(await Organization.getOrgsMap());
};

export const create = async (req, res) => {
  const myOrganization = await Organization.getHomeOrg();

  if (myOrganization) {
    return res.json({
      message: 'Your organization already exists.',
      orgId: myOrganization.orgUid,
    });
  } else {
    const { name, icon } = req.body;
    return res.json({
      message: 'New organization created successfully.',
      orgId: await Organization.createHomeOrganization(name, icon, 'v1'),
    });
  }
};

// eslint-disable-next-line
export const importOrg = async (req, res) => {};

export const subscribeToOrganization = async (req, res) => {
  try {
    await assertHomeOrgExists();

    await Organization.subscribeToOrganization(req.body.orgUid);

    return res.json({
      message: 'Subscribed to organization',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error subscribing to organization',
      error: error.message,
    });
  }
};
