'use strict';

export default {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'mysql' && dialect !== 'mariadb') return;

    const [rows] = await queryInterface.sequelize.query(
      'SHOW CREATE TABLE `project`',
    );
    // Reuse the server's complete column definition so custom charset,
    // collation, nullability, defaults and comments survive the MODIFY.
    const clauses = [];
    for (const [column, length] of [
      ['project_name', 500],
      ['project_sector', 768],
      ['project_type', 768],
    ]) {
      const definition = rows[0]['Create Table']
        .match(new RegExp(`^\\s*(\`${column}\` [^\\r\\n]*),?$`, 'm'))?.[1]
        .replace(/,$/, '');
      const varchar = definition?.match(/^`[^`]+` varchar\((\d+)\)/i);

      if (!varchar) {
        if (/^`[^`]+` (?:text|mediumtext|longtext)(?:\s|$)/i.test(definition))
          continue;
        throw new Error(
          `project.${column} has an unsupported column definition; manual schema review is required before widening to VARCHAR(${length})`,
        );
      }
      if (Number(varchar[1]) >= length) continue;
      clauses.push(
        `MODIFY COLUMN ${definition.replace(/varchar\(\d+\)/i, `varchar(${length})`)}`,
      );
    }
    if (clauses.length === 0) return;

    // Validate every field before issuing one ALTER: an unsafe later field must
    // not leave earlier fields widened on an otherwise failed migration.
    // INPLACE prevents a COPY fallback that can silently turn an oversized
    // MariaDB unique BTREE index into HASH. Copy-required schemas need review.
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`project\` ${clauses.join(', ')}, ALGORITHM=INPLACE`,
      );
    } catch (error) {
      throw new Error(
        `Unable to widen project fields with ALGORITHM=INPLACE; manual schema review is required: ${error.message}`,
        { cause: error },
      );
    }
  },

  async down() {
    // Corrective widening is irreversible: narrowing could truncate mirror data.
  },
};
