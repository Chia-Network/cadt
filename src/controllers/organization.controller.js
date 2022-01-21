import { Organization } from '../models/organizations';
import { updateOrganization } from '../fullnode/dataLayerService';
export const findAll = async (req, res) => {
  return res.json(await Organization.getOrgsMap());
};

export const create = async (req, res) => {
  const { name, icon, website } = req.body;
  return res.json({
    message: 'New organization created successfully.',
    orgId: await updateOrganization(name, icon, website),
  });
};
