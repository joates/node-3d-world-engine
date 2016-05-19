;"use strict"

exports.create = create_map_tile
exports.encode_key = encode_key
exports.decode_key = decode_key

var map_size = 256
  , min_distance = 10
  , Regions = require('./Regions')()

function create_map_tile(x, y) {
  return (function() {
    var start_time = Date.now()
      , tile = {}

    tile.key = encode_key(x, y)
    tile.size = { x: map_size, y: map_size }
    tile.grid = { position: { x: x, y: y } }
    tile.regions = Regions.create(map_size, min_distance)
    tile.exec_time = Date.now() - start_time
    return tile
  }())
}

function encode_key(x, y) {
  return (function() {
    return ('00000'+ ++x).slice(-5) +'_'+ ('00000'+ ++y).slice(-5)
  }())
}

function decode_key(key) {
  return (function() {
    var parts = key.split('_')
    return { x: parseInt(parts[0]) - 1, y: parseInt(parts[1]) - 1 }
  }())
}
