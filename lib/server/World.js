;'use strict'

module.exports = World
var map_tile = require('./Map-Tile')

// Constructor:
function World() {
  if (! (this instanceof World)) return new World()
}
var proto = World.prototype


// Public API:
proto.get = fetch_from_world


// Class Methods:
function fetch_from_world(id, opts, cb) {
  switch (id) {
    case 'map_tile':
      map_tile.get(opts[0], opts[1], function(err, map_tiles) {
        if (err) cb('World::fetch_from_world::map_tile.get -> '+ err)

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
      console.warn('Unrecognized World fetch identifier:', id)
  }
}
