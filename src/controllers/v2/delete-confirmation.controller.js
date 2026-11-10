import { loggerV2 } from '../../config/logger.js';
import { confirmDelete } from '../../utils/v2-delete-confirmation.js';
import {
  isReadOnlyError,
  sendReadOnlyError,
} from '../../utils/read-only-response.js';
import { buildReferenceConflictBody } from '../../utils/v2-reference-guards.js';

export const deleteConfirmation = (table) => async (req, res) => {
  try {
    res.json(
      await confirmDelete(
        table,
        req.params.id,
        req.get('X-Deletion-Confirmation'),
      ),
    );
  } catch (error) {
    if (isReadOnlyError(error)) return sendReadOnlyError(res);
    if (error.references)
      return res
        .status(409)
        .json(
          buildReferenceConflictBody(table, { references: error.references }),
        );
    if (!error.status) loggerV2.error(`[v2]: Error deleting ${table}:`, error);
    const name = `${table[0].toUpperCase()}${table.slice(1)}`;
    res.status(error.status || 400).json({
      success: false,
      message:
        error.status === 404 ? `${name} not found` : `Error deleting ${table}`,
      ...(error.status !== 404 && { error: error.message }),
      ...(error.code && { code: error.code }),
      ...(error.previewRoute && { previewRoute: error.previewRoute }),
    });
  }
};
