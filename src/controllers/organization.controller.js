import { Organization } from '../models/organizations';

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
