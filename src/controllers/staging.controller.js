import { Staging, StagingMock } from '../models';

export const findAll = async (req, res) => {
  if (req.query.useMock) {
    res.json(StagingMock.findAll());
    return;
  }

  res.json(Staging.findAll());
};

export const destroy = (req, res) => {
  Staging.destroy({
    where: {
      uuid: req.body.uuid,
    },
  })
    .then(() => {
      res.json({
        message: 'Deleted',
      });
    })
    .catch((err) => {
      res.json({
        message: err,
      });
    });
};
