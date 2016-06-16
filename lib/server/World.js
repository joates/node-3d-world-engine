;'use strict'

exports.get = fetch_from_world
var Tile = require('../misc/Tile')

function fetch_from_world(id, opts, cb) {
  return (function() {

    switch (id) {
      case 'map_tile':
        Tile.get(opts, function(err, map_tiles) {
          if (err) throw new Error(err, err.stack)

          if (map_tiles.length === 1) {
            var render_tile = { key: map_tiles[0].key, mesh_data: map_tiles[0].mesh_data, grid_position: map_tiles[0].grid.position }
            cb(null, render_tile)
          }
          else {
            var render_tiles = map_tiles.map(function(_tile) { return { key: _tile.key, mesh_data: _tile.mesh_data, grid_position: _tile.grid.position } })
            for (var i = 0, il = render_tiles.length; i < il; i++) {
              cb(null, render_tiles[i])
            }
          }
        })
        break
      default:
        cb('[World::fetch_from_world] Error: unrecognized identifier -> '+ id)
    }

  }())
}
