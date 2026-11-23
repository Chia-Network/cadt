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
    const definition = rows[0]['Create Table']
      .match(/^\s*(`project_name` [^\r\n]*),?$/m)?.[1]
      .replace(/,$/, '');
    const varchar = definition?.match(/^`project_name` varchar\((\d+)\)/i);

    if (!varchar) {
      if (
        /^`project_name` (?:text|mediumtext|longtext)(?:\s|$)/i.test(definition)
      )
        return;
      throw new Error(
        'project.project_name has an unsupported column definition; manual schema review is required before widening to VARCHAR(500)',
      );
    }
    if (Number(varchar[1]) >= 500) return;

    const widened = definition.replace(
      /^`project_name` varchar\(\d+\)/i,
      '`project_name` varchar(500)',
    );
    // INPLACE prevents a COPY fallback that can silently turn an oversized
    // MariaDB unique BTREE index into HASH. Copy-required schemas need review.
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`project\` MODIFY COLUMN ${widened}, ALGORITHM=INPLACE`,
      );
    } catch (error) {
      throw new Error(
        `Unable to widen project.project_name with ALGORITHM=INPLACE; manual schema review is required: ${error.message}`,
        { cause: error },
      );
    }
  },

  async down() {
    // Corrective widening is irreversible: narrowing could truncate mirror data.
  },
};
