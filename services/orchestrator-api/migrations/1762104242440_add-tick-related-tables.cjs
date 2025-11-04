/* eslint-disable */
/** @param {import('node-pg-migrate').MigrationBuilder} pg */
exports.up = (pg) => {
  // raw ticks (dedup on (symbol, ts))
  pg.createTable('ticks_history', {
    symbol: { type: 'text', notNull: true },
    ts:     { type: 'timestamptz', notNull: true },
    price:  { type: 'double precision', notNull: true },
  });
  pg.addConstraint('ticks_history', 'ticks_history_pk', {
    primaryKey: ['symbol', 'ts'],
  });
  pg.createIndex('ticks_history', ['symbol', { name: 'ts', sort: 'DESC' }], {
    name: 'ticks_history_symbol_ts_idx',
    method: 'btree',
  });

  // per-minute OHLC
  pg.createTable('ohlc_1m', {
    symbol:       { type: 'text', notNull: true },
    bucket_start: { type: 'timestamptz', notNull: true }, // minute-aligned
    open:         { type: 'double precision', notNull: true },
    open_ts:      { type: 'timestamptz', notNull: true },
    high:         { type: 'double precision', notNull: true },
    low:          { type: 'double precision', notNull: true },
    close:        { type: 'double precision', notNull: true },
    close_ts:     { type: 'timestamptz', notNull: true },
    count:        { type: 'integer', notNull: true, default: 0 },
  });
  pg.addConstraint('ohlc_1m', 'ohlc_1m_pk', { primaryKey: ['symbol', 'bucket_start'] });
  pg.createIndex('ohlc_1m', ['symbol', { name: 'bucket_start', sort: 'DESC' }], {
    name: 'ohlc_1m_symbol_bucket_idx',
    method: 'btree',
  });

  // per-minute metrics (count/sum/min/max/last)
  pg.createTable('metrics_1m', {
    symbol:       { type: 'text', notNull: true },
    bucket_start: { type: 'timestamptz', notNull: true },
    count:        { type: 'integer', notNull: true },
    sum:          { type: 'double precision', notNull: true },
    min:          { type: 'double precision', notNull: true },
    max:          { type: 'double precision', notNull: true },
    last:         { type: 'double precision', notNull: true },
    last_ts:      { type: 'timestamptz', notNull: true },
  });
  pg.addConstraint('metrics_1m', 'metrics_1m_pk', { primaryKey: ['symbol', 'bucket_start'] });
  pg.createIndex('metrics_1m', ['symbol', { name: 'bucket_start', sort: 'DESC' }], {
    name: 'metrics_1m_symbol_bucket_idx',
    method: 'btree',
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pg */
exports.down = (pg) => {
  pg.dropTable('metrics_1m');
  pg.dropTable('ohlc_1m');
  pg.dropTable('ticks_history');
};