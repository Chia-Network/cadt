import { Organization } from '../models/organizations';

export const findAll = async (req, res) => {
  return res.json({
    ...(await Organization.getHomeOrg()),
    '35f92331-c8d7-4e9e-a8d2-cd0a86cbb2cf': {
      name: 'chili',
      icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/chili.svg',
    },
    'fbffae6b-0203-4ac0-a08b-1551b730783b': {
      name: 'belgium',
      icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/belgium.svg',
    },
    '70150fde-57f6-44a6-9486-1fef49528475': {
      name: 'bulgaria',
      icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/bulgaria.svg',
    },
  });
};
