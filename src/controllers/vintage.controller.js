import { Vintage, Organization } from '../models';

export const findAll = async (req, res) => {
  const homeOrg = await Organization.getHomeOrg();
  console.log({ orgUid: Object.keys(homeOrg)[0] });
  return res.json(
    await Vintage.findAll({
      where: { orgUid: Object.keys(homeOrg)[0] },
    }),
  );
};
