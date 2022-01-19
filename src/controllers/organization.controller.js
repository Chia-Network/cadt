import { Organization } from '../models/organizations';

export const findAll = async (req, res) => {
  return res.json(await Organization.getOrgsMap());
};
