import { createDeletePreview } from '../../utils/v2-delete-preview.js';
import {
  isReadOnlyError,
  sendReadOnlyError,
} from '../../utils/read-only-response.js';

export const deletePreview = (table) => async (req, res) => {
  try {
    const preview = await createDeletePreview(table, req.params.id);
    res.set('Cache-Control', 'no-store').json(preview);
  } catch (error) {
    if (isReadOnlyError(error)) return sendReadOnlyError(res);
    res.status(error.status || 400).json({
      success: false,
      message: `Cannot preview ${table} deletion`,
      error: error.message,
      ...(error.code && { code: error.code }),
      ...(error.references && { references: error.references }),
    });
  }
};
