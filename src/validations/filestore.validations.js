import Joi from 'joi';

export const getFileSchema = Joi.object({
  // Should be the SHA256 hash of the file you want to retreive
  fileId: Joi.string().required(),
});
