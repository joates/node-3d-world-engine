;"use strict"

exports.get = get_map_tile

var level = require('levelup')
  , sublevel = require('level-sublevel')
  , LRU = require('lru-cache')
  , map_tile_cache = LRU({ max: 9 })
  , async = require('async')
  , db_path = '/home/joates/code/node-3d-world-engine/db/world'
  , db_opts = { valueEncoding: 'json' }
  , db = sublevel(level(db_path, db_opts))
  , db_map_tile = db.sublevel('map_tile')

var map_size = 256
  , min_distance = 10
  , Voronoi = require('voronoi')
  , Regions = require('./Regions')

// fixes rounding of float values in javascript
Number.prototype.round = function(num_places) {
  return +(Math.round(this +'e+'+ num_places) +'e-'+ num_places)
}

var EPSILON = 1e-6

var edge = {          // used in weld_edges()
    NORTH: 0
  , SOUTH: 1
  , EAST:  2
  , WEST:  3
  , _MIN: EPSILON
  , _MAX: map_size - EPSILON
}
Object.freeze(edge)

function get_map_tile(x, y, cb) {
  return (function() {
    var key = encode_key(x, y)

    // does this tile already exist in the database ?
    db_get_tile(key, function(err, tile_from_db) {
      if (! tile_from_db) {

        // nope... create a new one and store it
        var tile = create_map_tile(x, y, function(err, tile) {
          if (err) cb(err)

          db_map_tile.put(tile.key, tile, function(err) {
            if (err) cb('Map-Tile::get_map_tile::db_map_tile.put -> '+ err)
            console.log('   > new map tile stored:', tile.key)

            // update the cache
            map_tile_cache.set(tile.key, tile)
          })

          cb(null, tile)
        })

        return
      }

      // ok no errors...
      // response is the map tile pulled from storage (cache / database)
      cb(null, tile_from_db)
    })
  }())
}

function create_map_tile(x, y, cb) {
  var start_time = Date.now()
    , tile = {}

  tile.key = encode_key(x, y)
  tile.size = { x: map_size, y: map_size }
  tile.grid = { position: { x: x, y: y } }
  tile.regions = Regions.create(map_size, min_distance)

  // @TODO: how to make better use of the welded_edge_flags ??
  tile.welded_edge_flags = 0        // Note: bitmask (4 bits)

  weld_edges.call(tile, function(err, _tile) {
    if (err) cb('Map-Tile::create_map_tile::weld_edges.call -> '+ err)

    tile.exec_time = Date.now() - start_time
    cb(null, _tile)
  })
}

function db_get_tile(key, cb) {
  // check the cache first
  var map_tile_from_cache = map_tile_cache.get(key)
  if (map_tile_from_cache) {
    console.log('     | using cached map tile:', key)
    cb(null, map_tile_from_cache)
    return
  } else {
    // fetch map tile from the database
    db_map_tile.get(key, function(err, db_map_tile) {
      if (err && err.notFound) {
        cb(null, undefined)
        return
      }
      else if (err) {
        cb('Map-Tile::db_map_tile.get::Error -> ('+ key +') '+ err)
        return
      }
      cb(null, db_map_tile)
    })
  }
}

function weld_edges(cb) {

  var tile = this
    , grid_pos = tile.grid.position

  if (grid_pos.x === -1 || grid_pos.y === -1) {
    cb(null, tile)
    return
  }

  var tile_key_WEST = encode_key(grid_pos.x - 1, grid_pos.y)
  var tile_key_SOUTH = encode_key(grid_pos.x, grid_pos.y - 1)
  var tile_key_SOUTH_WEST = encode_key(grid_pos.x - 1, grid_pos.y - 1)

  async.series([
        function(db_cb) { db_get_tile(tile_key_WEST, db_cb) }
      , function(db_cb) { db_get_tile(tile_key_SOUTH, db_cb) }
      , function(db_cb) { db_get_tile(tile_key_SOUTH_WEST, db_cb) }
    ]
  , function(err, db_tiles) {

    if (db_tiles && db_tiles.length !== 3) {
      cb('Map-Tile::weld_edges::db_get_tile -> Callback did not receive _exactly_ 3 map tiles from db')
      return
    }

    var quad_tile = []

    // build the quad tile
    db_tiles.forEach(function(db_tile, db_tile_id) {
      db_tile.regions.forEach(function(region, region_id) {
        var pos = region.center.position
          , pos_x
          , pos_y
        switch (db_tile_id) {
          case 0:
            pos_x = pos.x; pos_y = pos.z                       // North West quadrant
            break
          case 1:
            pos_x = map_size+pos.x; pos_y = map_size+pos.z     // South East quadrant
            break
          case 2:
            pos_x = pos.x; pos_y = map_size+pos.z              // South West quadrant
            break
          default:
        }
        quad_tile.push({ x: pos_x, y: pos_y, tile: db_tile_id + 1, original_voronoiId: region_id })
      })
    })
    tile.regions.forEach(function(region, region_id) {         // North East quadrant
      var pos = region.center.position
      quad_tile.push({ x: map_size+pos.x, y: pos.z, tile: 0, original_voronoiId: region_id })
    })

    var voronoi = new Voronoi()
      , bbox = { xl: 0, xr: map_size * 2, yt: 0, yb: map_size * 2 }
      , voronoi_regions = voronoi.compute(quad_tile, bbox)

    var weld = {}
    weld.regions = Regions.decode_voronoi(voronoi_regions, quad_tile, false)
    weld.map = new Array(4)

    // Note: region identifiers for both welded and original region are encoded into quad_tile[]
    //       (identity of db_tiles in 'weld.map' are offset by +1 !!)

    // define the relationships between regions of all four map tiles
    quad_tile.forEach(function(quad_cell) {
      if (! weld.map[quad_cell.tile]) weld.map[quad_cell.tile] = {}
      weld.map[quad_cell.tile][quad_cell.original_voronoiId] = quad_cell.voronoiId
    })

    // repair boundary of newly created map_tile (located in North-East quadrant)
    tile.regions.forEach(function(region, region_id) {
      if (region.boundary) {
        region = repair_region_geometry(0, region, tile.regions, region_id, weld, [ edge.SOUTH, edge.WEST ], [ 'NW', 'SE' ])

        // update only welded regions
        if (region.welded) tile.regions[region_id] = region
      }
    })

    // update the newly created map_tile's wedled edge flags
    tile.welded_edge_flags |= (1 << edge.SOUTH | 1 << edge.WEST)

    // repair boundary of db_tiles[0] (located in Nouth-West quadrant)
    //   also boundary of db_tiles[1] (located in South-East quadrant)
    //   also boundary of db_tiles[2] (located in South-West quadrant)
    db_tiles.forEach(function(db_tile, db_tile_id) {

      db_tile.regions.forEach(function(region, region_id) {

        // prevent overwriting regions that are already welded !!
        if (region.welded) return

        if (region.boundary) {
          var edges, corners

          switch(db_tile_id) {
            case 0:
              edges = [ edge.SOUTH, edge.EAST ]
              corners = [ 'NE', 'SW' ]
              break
            case 1:
              edges = [ edge.NORTH, edge.WEST ]
              corners = [ 'NE', 'SW' ]
              break
            case 2:
              edges = [ edge.NORTH, edge.EAST ]
              corners = [ 'NW', 'SE' ]
              break
            default:
          }

          region = repair_region_geometry(db_tile_id+1, region, db_tile.regions, region_id, weld, edges, corners)

          // update only welded regions
          if (region.welded) db_tile.regions[region_id] = region
        }
      })

      // update the db_tile's welded edge flags
      switch (db_tile_id) {
        case 0:
          db_tile.welded_edge_flags |= (1 << edge.SOUTH | 1 << edge.EAST)
          break
        case 1:
          db_tile.welded_edge_flags |= (1 << edge.NORTH | 1 << edge.WEST)
          break
        case 2:
          db_tile.welded_edge_flags |= (1 << edge.NORTH | 1 << edge.EAST)
          break
        default:
      }

      // store the modified db_tile
      db_map_tile.put(db_tile.key, db_tile, function(err) {
        if (err) cb('Map-Tile::weld_edges::db_map_tile.put -> ['+ db_tile_id +'] '+ err)
        console.log('     | db map tile updated:', db_tile.key)
      })

    })

    cb(null, tile)
    return
  })
}

function repair_region_geometry(tile_id, region, orig, orig_id, weld, targeted_edges, excluded_corners) {
  var edge_N, edge_W, edge_S, edge_E
    , corner_NW, corner_NE, corner_SW, corner_SE

  edge_N = edge_W = edge_S = edge_E = false
  corner_NW = corner_NE = corner_SW = corner_SE = false

  orig[orig_id].vertices.forEach(function(vert, vert_id) {
    if (vert.x < edge._MIN && vert.z < edge._MIN) corner_NW = true
    if (vert.x < edge._MIN && vert.z > edge._MAX) corner_SW = true
    if (vert.x > edge._MAX && vert.z < edge._MIN) corner_NE = true
    if (vert.x > edge._MAX && vert.z > edge._MAX) corner_SE = true
    if (vert.x < edge._MIN) edge_W = true
    if (vert.x > edge._MAX) edge_E = true
    if (vert.z < edge._MIN) edge_N = true
    if (vert.z > edge._MAX) edge_S = true
  })

  // avoid welding certain corner locations..
  if (corner_NW && (excluded_corners[0] === 'NW' || excluded_corners[1] === 'NW')) return region
  if (corner_NE && (excluded_corners[0] === 'NE' || excluded_corners[1] === 'NE')) return region
  if (corner_SW && (excluded_corners[0] === 'SW' || excluded_corners[1] === 'SW')) return region
  if (corner_SE && (excluded_corners[0] === 'SE' || excluded_corners[1] === 'SE')) return region

  // only interested in welding the targeted edge locations..
  if ( edge_N && (targeted_edges[0] === edge.NORTH || targeted_edges[1] === edge.NORTH)
    || edge_W && (targeted_edges[0] === edge.WEST  || targeted_edges[1] === edge.WEST )
    || edge_S && (targeted_edges[0] === edge.SOUTH || targeted_edges[1] === edge.SOUTH)
    || edge_E && (targeted_edges[0] === edge.EAST  || targeted_edges[1] === edge.EAST ) ) {

    var center = region.center
      , moisture = region.moisture

    // repair region geometry
    region = deep_copy(weld.regions[weld.map[tile_id][orig_id]])
    region.center = center
    region.moisture = moisture
    region.boundary = true

    // compensate for offset in quad_tile vertices
    switch(tile_id) {
      case 0:
        for (var i = 0, il = region.vertices.length; i < il; i++) {
          region.vertices[i].x -= map_size
        }
        break
      case 1:      // Note: no vertex coordinate modification needed at this location
        break
      case 2:
        for (var i = 0, il = region.vertices.length; i < il; i++) {
          region.vertices[i].x -= map_size
          region.vertices[i].z -= map_size
        }
        break
      case 3:
        for (var i = 0, il = region.vertices.length; i < il; i++) {
          region.vertices[i].z -= map_size
        }
        break
      default:      // Note: nothing to do
    }

    // @TODO: decode neighbors across map tile boundaries !!

    region.welded = true
  }
  return region
}

function deep_copy(obj) {
  var copy = obj
    , k
  if (obj && typeof obj === 'object') {
    copy = Object.prototype.toString.call(obj) === '[object Array]' ? [] : {}
    for (k in obj) {
      copy[k] = deep_copy(obj[k])
    }
  }
  return copy
}

function encode_key(x, y) {
  return ('00000'+ ++x).slice(-5) +'_'+ ('00000'+ ++y).slice(-5)
}

function decode_key(key) {
  var parts = key.split('_')
  return { x: parseInt(parts[0]) - 1, y: parseInt(parts[1]) - 1 }
}
