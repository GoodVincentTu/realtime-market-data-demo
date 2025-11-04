/* eslint-disable */
exports.up = (pgm) => {
  pgm.addColumn('metrics_1m', {
    volume_sum: { type: 'double precision', notNull: true, default: 0 },
  });
};
exports.down = (pgm) => {
  pgm.dropColumn('metrics_1m', 'volume_sum');
};