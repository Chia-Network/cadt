import { Audit } from '../models';

export const findAll = async (req, res) => {
  try {
    const { orgUid } = req.query;
    const auditResults = await Audit.findAll({ where: { orgUid } });
    return res.json(auditResults);
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive issuances',
      error: error.message,
    });
  }
};
