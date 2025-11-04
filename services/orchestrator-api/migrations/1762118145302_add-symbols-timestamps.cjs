/* eslint-disable */
/** @param {import('node-pg-migrate').MigrationBuilder} pg */
exports.up = (pg) => {
  pg.addColumn('symbols', {
    created_at: { type: 'timestamptz', notNull: true, default: pg.func('now()') },
  });
  pg.addColumn('symbols', {
    updated_at: { type: 'timestamptz', notNull: true, default: pg.func('now()') },
  });
};

exports.down = (pg) => {
  pg.dropColumn('symbols', 'updated_at');
  pg.dropColumn('symbols', 'created_at');
};