export const READ_ONLY_ERROR = Object.freeze({
  message: 'This CADT instance is configured as read-only',
  error: 'Write operations are not permitted in read-only mode',
  success: false,
});

export const sendReadOnlyError = (res) => {
  return res.status(403).json(READ_ONLY_ERROR);
};

export const createReadOnlyError = () => {
  const error = new Error(READ_ONLY_ERROR.error);
  error.code = 'READ_ONLY';
  error.status = 403;
  return error;
};

export const isReadOnlyError = (error) => {
  return error?.code === 'READ_ONLY';
};
