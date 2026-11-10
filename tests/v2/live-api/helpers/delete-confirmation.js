// Cascade-capable clients must review a fresh complete preview before DELETE.
// Failures are returned unchanged; callers retain their endpoint assertions.
export const requestDeleteWithPreview = async (
  request,
  endpoint,
  options = {},
) => {
  let token;
  if (/^\/v2\/(project|verification|issuance|unit)\/[^/]+$/.test(endpoint)) {
    const preview = await request.get(`${endpoint}/delete-preview`);
    if (preview.status !== 200) return preview;
    token = preview.body.confirmationToken;
    if (typeof token !== 'string' || !token)
      throw new Error(
        `Delete preview for ${endpoint} did not return a confirmation token`,
      );
  }
  let operation = request.delete(endpoint);
  if (token) operation = operation.set('X-Deletion-Confirmation', token);
  if (options.query) operation = operation.query(options.query);
  return operation;
};

// Commit descendant work before previewing an ancestor. Pending descendant
// DELETEs are intentionally conflicting work, not approval for another cascade.
export const DELETE_DEPENDENCY_BATCHES = [
  [
    'unit-label',
    'stakeholder-projects',
    'aef-t5-authorized-entities',
    'aef-t4-holdings',
    'aef-t3-actions',
    'aef-t2-authorizations',
  ],
  ['unit'],
  ['issuance'],
  [
    'verification',
    'project-methodology',
    'location',
    'estimation',
    'rating',
    'co-benefit',
    'validation',
  ],
  ['project'],
  ['methodology', 'program', 'stakeholder', 'label', 'aef-t1-submission'],
];
