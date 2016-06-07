;'use strict'

exports.get = fetch_from_world
var Tile = require('../misc/Tile')

function fetch_from_world(id, opts, cb) {
  return (function() {

    switch (id) {
      case 'map_tile':
        Tile.get(opts, function(err, map_tiles) {
          if (err) cb(err)

          if (map_tiles.length === 1)
            cb(null, map_tiles[0])
          else {
            for (var i = 0, il = map_tiles.length; i < il; i++) {
              cb(null, map_tiles[i])
            }
          }
        })
        break
      default:
        cb('[World::fetch_from_world] Error: unrecognized identifier -> '+ id)
    }

  }())
}
