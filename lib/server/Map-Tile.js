;"use strict"

exports.get = get_map_tile
//exports.create = create_map_tile
exports.encode_key = encode_key
exports.decode_key = decode_key

var level = require('levelup')
  , sublevel = require('level-sublevel')
  , db_path = '/home/joates/code/node-3d-world-engine/db/world'
  , db_opts = { valueEncoding: 'json' }
  , db = sublevel(level(db_path, db_opts))
  , db_map_tile = db.sublevel('map_tile')
//, db_mesh_geo = db.sublevel('mesh_geometry')
//, db_mesh_mat = db.sublevel('mesh_material')

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
    //tile = weld_edges(tile)
    tile.exec_time = Date.now() - start_time
    return tile
  }())
}

function weld_edges(tile) {
  if (tile.grid.x === -1 || tile.grid.y === -1) return tile

  // @TODO: south egde

  // @TODO: west edge

}

function get_map_tile(x, y, cb) {
  return (function() {
    var key = encode_key(x, y)

    // does this tile already exist in the database ?
    db_map_tile.get(key, function(err, tile_from_db) {
      if (err && err.notFound) {
        // nope... create a new one and store it
        var tile = create_map_tile(x, y)
        db_map_tile.put(tile.key, tile, function(err) {
          if (err) console.error('World::get_map_tile::db_map_tile.put ->', err)
          console.log('   > new map tile stored:', tile.key)
        })
        cb(tile)
        return
      }
      else if (err) throw new Error(err, err.stack)

      // use the stored map tile
      cb(tile_from_db)
    })
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
