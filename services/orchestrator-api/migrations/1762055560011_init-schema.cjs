/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('symbols', {
    symbol: { type: 'text', primaryKey: true },
    base: { type: 'text', notNull: true },
    quote: { type: 'text', notNull: true },
    active: { type: 'boolean', notNull: true, default: true }
  });

  pgm.createTable('ticks_raw', {
    id_key: { type: 'text', primaryKey: true },
    symbol: { type: 'text', notNull: true, references: 'symbols' },
    ts: { type: 'timestamptz', notNull: true },
    price: { type: 'double precision', notNull: true },
    volume: { type: 'double precision' },
    source: { type: 'text', notNull: true, default: 'feeder' }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('ticks_raw');
  pgm.dropTable('symbols');
};