;'use strict'

module.exports = World

var level = require('levelup')
  , sublevel = require('level-sublevel')
  , db_path = '/home/joates/code/node-3d-world-engine/db/world'
  , db_opts = { valueEncoding: 'json' }
  , db = sublevel(level(db_path, db_opts))
  , db_map_tile = db.sublevel('map_tile')
//, db_mesh_geo = db.sublevel('mesh_geometry')
//, db_mesh_mat = db.sublevel('mesh_material')
  , map_tile = require('./Map-Tile')


// Constructor:
function World() {
  if (! (this instanceof World)) return new World()

  // Note: could implement lru-cache of map tiles here
  //       also lru-cache(s) of other db objects ??
}
var proto = World.prototype


// Public API:
proto.get = fetch_from_world


// Class Methods:
function fetch_from_world(id, opts, cb) {
  switch (id) {
    case 'map_tile':
      get_map_tile(opts[0], opts[1], cb)
      break
    default:
      console.warn('Unrecognized World fetch identifier:', id)
  }
}

function get_map_tile(x, y, cb) {
  var key = map_tile.encode_key(x, y)

  // does this tile already exist in the database ?
  db_map_tile.get(key, function(err, tile_from_db) {
    if (err && err.notFound) {
      // nope... create a new one and store it
      var tile = map_tile.create(x, y)
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
}