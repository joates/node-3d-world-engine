;'use strict'

var EPSILON = 1e-6

var _db = {
    path: '/home/joates/code/node-3d-world-engine/db/world'
  , options: { valueEncoding: 'json' }
}
Object.freeze(_db)

var _tile = {
    size: 256
  , key_depth: 5
}
Object.freeze(_tile)

var _edge = {          //  used in *tile.flags.welded_edges
    NORTH: 1
  , SOUTH: 2
  , EAST:  4
  , WEST:  8
  , _MIN: EPSILON
  , _MAX: _tile.size - EPSILON
}
Object.freeze(_edge)

var _region = {        //  used in Region.flags
    BOUNDARY: 1
  , CORNER:   2
  , WELDED:   4
  , WATER:    8
  , min_distance: _tile.size / 18
}
Object.freeze(_region)

var _cache = {
    max: 9
}
Object.freeze(_cache)

exports.db = _db
exports.edge = _edge
exports.cache = _cache
exports.region = _region
exports.map_tile = _tile
exports.EPSILON = EPSILON
